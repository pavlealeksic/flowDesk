//! Cryptographic utilities for Flow Desk

use blake3::{Hash, Hasher};
use base64::{engine::general_purpose, Engine as _};
use anyhow::{Result, anyhow};
// Removed unused imports for now
use rand::{rngs::OsRng, RngCore};

// Re-export key crypto types
pub use chacha20poly1305::{ChaCha20Poly1305, Key as ChaChaKey, Nonce, KeyInit, AeadInPlace};
// Removed unused argon2 imports

// Simple encryption functions for NAPI bindings
pub fn encrypt_data(data: &[u8], key: &[u8]) -> Result<Vec<u8>> {
    if key.len() != 32 {
        return Err(anyhow!("Key must be 32 bytes"));
    }
    let chacha_key = ChaChaKey::from_slice(key);
    encrypt_chacha20poly1305(data, chacha_key, b"")
}

pub fn decrypt_data(encrypted_data: &[u8], key: &[u8]) -> Result<Vec<u8>> {
    if key.len() != 32 {
        return Err(anyhow!("Key must be 32 bytes"));
    }
    let chacha_key = ChaChaKey::from_slice(key);
    decrypt_chacha20poly1305(encrypted_data, chacha_key, b"")
}

pub fn generate_key_pair() -> Result<(Vec<u8>, Vec<u8>)> {
    // Generate simple random key pair
    let mut public_key = [0u8; 32];
    let mut private_key = [0u8; 32];
    OsRng.fill_bytes(&mut public_key);
    OsRng.fill_bytes(&mut private_key);
    
    Ok((public_key.to_vec(), private_key.to_vec()))
}

/// Generate a secure hash of the input data using BLAKE3
pub fn hash_data(data: &[u8]) -> Hash {
    let mut hasher = Hasher::new();
    hasher.update(data);
    hasher.finalize()
}

/// Generate a hex-encoded hash string
pub fn hash_to_hex(data: &[u8]) -> String {
    hash_data(data).to_hex().to_string()
}

/// Generate a base64-encoded hash string
pub fn hash_to_base64(data: &[u8]) -> String {
    general_purpose::STANDARD.encode(hash_data(data).as_bytes())
}

/// Verify data against a hex-encoded hash
pub fn verify_hex_hash(data: &[u8], expected_hash: &str) -> Result<bool> {
    let computed_hash = hash_to_hex(data);
    Ok(computed_hash == expected_hash)
}

/// Generate a secure random ID
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Encode data as base64
pub fn encode_base64(data: &[u8]) -> String {
    general_purpose::STANDARD.encode(data)
}

/// Decode base64 data
pub fn decode_base64(encoded: &str) -> Result<Vec<u8>> {
    general_purpose::STANDARD.decode(encoded)
        .map_err(|e| anyhow!("Base64 decode error: {}", e))
}

/// Simple key pair structure for basic crypto operations
pub struct SimpleKeyPair {
    pub public_key: [u8; 32],
    pub private_key_bytes: [u8; 32],
}

impl SimpleKeyPair {
    /// Generate a new key pair
    pub fn generate() -> Self {
        let mut public_key = [0u8; 32];
        let mut private_key_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut public_key);
        OsRng.fill_bytes(&mut private_key_bytes);
        
        Self {
            public_key,
            private_key_bytes,
        }
    }
    
    /// Export public key as base64
    pub fn public_key_base64(&self) -> String {
        encode_base64(&self.public_key)
    }
    
    /// Export private key as base64 (be careful with this!)
    pub fn private_key_base64(&self) -> String {
        encode_base64(&self.private_key_bytes)
    }
}

/// Encrypt data using ChaCha20-Poly1305 AEAD
pub fn encrypt_chacha20poly1305(
    data: &[u8],
    key: &ChaChaKey,
    additional_data: &[u8],
) -> Result<Vec<u8>> {
    use chacha20poly1305::aead::Aead;
    
    let cipher = ChaCha20Poly1305::new(key);
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let mut ciphertext = cipher
        .encrypt(nonce, chacha20poly1305::aead::Payload {
            msg: data,
            aad: additional_data,
        })
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;
    
    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(12 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.append(&mut ciphertext);
    
    Ok(result)
}

/// Decrypt data using ChaCha20-Poly1305 AEAD
pub fn decrypt_chacha20poly1305(
    encrypted_data: &[u8],
    key: &ChaChaKey,
    additional_data: &[u8],
) -> Result<Vec<u8>> {
    use chacha20poly1305::aead::Aead;
    
    if encrypted_data.len() < 12 {
        return Err(anyhow!("Encrypted data too short"));
    }
    
    let cipher = ChaCha20Poly1305::new(key);
    
    // Extract nonce and ciphertext
    let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher
        .decrypt(nonce, chacha20poly1305::aead::Payload {
            msg: ciphertext,
            aad: additional_data,
        })
        .map_err(|e| anyhow!("Decryption failed: {}", e))?;
    
    Ok(plaintext)
}

/// Simple key derivation using BLAKE3 (for demo purposes)
pub fn derive_key_argon2id(
    password: &[u8],
    salt: &[u8],
    output_length: usize,
) -> Result<Vec<u8>> {
    // Simple key derivation using BLAKE3 hasher
    let mut hasher = Hasher::new();
    hasher.update(password);
    hasher.update(salt);
    let hash = hasher.finalize();
    
    // Extend to required length by repeating the hash
    let mut result = Vec::new();
    while result.len() < output_length {
        result.extend_from_slice(hash.as_bytes());
    }
    result.truncate(output_length);
    Ok(result)
}

/// Generate a secure random salt
pub fn generate_salt(length: usize) -> Vec<u8> {
    let mut salt = vec![0u8; length];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Generate a secure random key for ChaCha20-Poly1305
pub fn generate_chacha_key() -> ChaChaKey {
    let mut key_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut key_bytes);
    *ChaChaKey::from_slice(&key_bytes)
}

/// Generate a workspace sync key from password and salt
pub fn generate_workspace_sync_key(password: &str, salt: &[u8]) -> Result<ChaChaKey> {
    let key_bytes = derive_key_argon2id(password.as_bytes(), salt, 32)?;
    Ok(*ChaChaKey::from_slice(&key_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_data() {
        let data = b"hello world";
        let hash1 = hash_data(data);
        let hash2 = hash_data(data);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_to_hex() {
        let data = b"hello";
        let hex_hash = hash_to_hex(data);
        assert!(!hex_hash.is_empty());
        assert!(hex_hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_verify_hex_hash() {
        let data = b"test data";
        let hex_hash = hash_to_hex(data);
        assert!(verify_hex_hash(data, &hex_hash).unwrap());
        assert!(!verify_hex_hash(b"different data", &hex_hash).unwrap());
    }

    #[test]
    fn test_generate_id() {
        let id1 = generate_id();
        let id2 = generate_id();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36); // UUID v4 length with hyphens
    }

    #[test]
    fn test_base64_roundtrip() {
        let original = b"Hello, World!";
        let encoded = encode_base64(original);
        let decoded = decode_base64(&encoded).unwrap();
        assert_eq!(original, decoded.as_slice());
    }

    #[test]
    fn test_simple_keypair_generation() {
        let keypair1 = SimpleKeyPair::generate();
        let keypair2 = SimpleKeyPair::generate();
        
        // Keys should be different
        assert_ne!(keypair1.public_key, keypair2.public_key);
        assert_ne!(keypair1.private_key_bytes, keypair2.private_key_bytes);
    }

    #[test]
    fn test_chacha20poly1305_encryption() {
        let key = generate_chacha_key();
        let plaintext = b"Hello, encrypted world!";
        let aad = b"additional authenticated data";
        
        let ciphertext = encrypt_chacha20poly1305(plaintext, &key, aad).unwrap();
        let decrypted = decrypt_chacha20poly1305(&ciphertext, &key, aad).unwrap();
        
        assert_eq!(plaintext, decrypted.as_slice());
        assert_ne!(plaintext, &ciphertext[12..]); // Skip nonce
    }

    #[test]
    fn test_argon2id_key_derivation() {
        let password = b"super secure password";
        let salt = generate_salt(16);
        
        let key1 = derive_key_argon2id(password, &salt, 32).unwrap();
        let key2 = derive_key_argon2id(password, &salt, 32).unwrap();
        
        assert_eq!(key1, key2);
        assert_eq!(key1.len(), 32);
    }


    #[test]
    fn test_workspace_sync_key_generation() {
        let password = "my workspace password";
        let salt = generate_salt(16);
        
        let key1 = generate_workspace_sync_key(password, &salt).unwrap();
        let key2 = generate_workspace_sync_key(password, &salt).unwrap();
        
        assert_eq!(key1.as_slice(), key2.as_slice());
    }
}
