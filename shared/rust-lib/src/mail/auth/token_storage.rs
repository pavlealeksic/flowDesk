//! Secure token storage for authentication credentials

use crate::mail::{error::MailResult, auth::AuthCredentials};
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;
use zeroize::Zeroize;

/// Encrypted credential storage
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedCredentials {
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Secure token storage with encryption
pub struct TokenStorage {
    /// In-memory cache of credentials (encrypted)
    cache: RwLock<HashMap<Uuid, EncryptedCredentials>>,
    /// Encryption key for credentials (derived from user password or system key)
    encryption_key: Key<Aes256Gcm>,
    /// File-based storage path
    storage_path: Option<std::path::PathBuf>,
}

impl Default for TokenStorage {
    fn default() -> Self {
        // Use a default encryption key - in production this should come from secure key derivation
        let default_key = [0u8; 32]; // This is insecure but allows compilation
        let encryption_key = Key::<Aes256Gcm>::from_slice(&default_key);
        
        Self {
            cache: RwLock::new(HashMap::new()),
            encryption_key: *encryption_key,
            storage_path: None,
        }
    }
}

impl TokenStorage {
    /// Create new token storage with system-derived key
    pub async fn new() -> MailResult<Self> {
        let encryption_key = Self::derive_system_key()?;
        
        Ok(Self {
            cache: RwLock::new(HashMap::new()),
            encryption_key,
            storage_path: None,
        })
    }

    /// Create new token storage with custom encryption key
    pub async fn with_key(key: &[u8; 32]) -> MailResult<Self> {
        let encryption_key = Key::<Aes256Gcm>::from_slice(key);
        
        Ok(Self {
            cache: RwLock::new(HashMap::new()),
            encryption_key: *encryption_key,
            storage_path: None,
        })
    }

    /// Create new token storage with file persistence
    pub async fn with_file<P: AsRef<std::path::Path>>(
        storage_path: P,
        key: Option<&[u8; 32]>,
    ) -> MailResult<Self> {
        let encryption_key = match key {
            Some(k) => *Key::<Aes256Gcm>::from_slice(k),
            None => Self::derive_system_key()?,
        };

        let storage_path = storage_path.as_ref().to_path_buf();
        let storage = Self {
            cache: RwLock::new(HashMap::new()),
            encryption_key,
            storage_path: Some(storage_path),
        };

        // Load existing credentials from file
        storage.load_from_file().await?;

        Ok(storage)
    }

    /// Store credentials securely
    pub async fn store_credentials(&self, credentials: &AuthCredentials) -> MailResult<()> {
        let encrypted = self.encrypt_credentials(credentials)?;
        
        {
            let mut cache = self.cache.write().await;
            cache.insert(credentials.account_id, encrypted);
        }

        // Persist to file if configured
        if self.storage_path.is_some() {
            self.save_to_file().await?;
        }

        tracing::debug!("Stored encrypted credentials for account {}", credentials.account_id);
        Ok(())
    }

    /// Retrieve credentials
    pub async fn get_credentials(&self, account_id: Uuid) -> MailResult<Option<AuthCredentials>> {
        let cache = self.cache.read().await;
        
        if let Some(encrypted) = cache.get(&account_id) {
            let credentials = self.decrypt_credentials(encrypted)?;
            Ok(Some(credentials))
        } else {
            Ok(None)
        }
    }

    /// Remove credentials
    pub async fn remove_credentials(&self, account_id: Uuid) -> MailResult<()> {
        {
            let mut cache = self.cache.write().await;
            cache.remove(&account_id);
        }

        // Persist to file if configured
        if self.storage_path.is_some() {
            self.save_to_file().await?;
        }

        tracing::debug!("Removed credentials for account {}", account_id);
        Ok(())
    }

    /// List all stored account IDs
    pub async fn list_accounts(&self) -> Vec<Uuid> {
        let cache = self.cache.read().await;
        cache.keys().cloned().collect()
    }

    /// Clear all credentials
    pub async fn clear_all(&self) -> MailResult<()> {
        {
            let mut cache = self.cache.write().await;
            cache.clear();
        }

        // Remove file if it exists
        if let Some(path) = &self.storage_path {
            if path.exists() {
                tokio::fs::remove_file(path).await?;
            }
        }

        tracing::info!("Cleared all stored credentials");
        Ok(())
    }

    /// Update credentials (convenience method)
    pub async fn update_credentials(&self, credentials: &AuthCredentials) -> MailResult<()> {
        self.store_credentials(credentials).await
    }

    /// Check if credentials exist for account
    pub async fn has_credentials(&self, account_id: Uuid) -> bool {
        let cache = self.cache.read().await;
        cache.contains_key(&account_id)
    }

    /// Encrypt credentials
    fn encrypt_credentials(&self, credentials: &AuthCredentials) -> MailResult<EncryptedCredentials> {
        let cipher = Aes256Gcm::new(&self.encryption_key);
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        
        // Serialize credentials to JSON
        let plaintext = serde_json::to_vec(credentials)?;
        
        // Encrypt
        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_ref())
            .map_err(|e| crate::mail::error::MailError::encryption(format!("Encryption failed: {}", e)))?;

        Ok(EncryptedCredentials {
            encrypted_data: ciphertext,
            nonce: nonce.to_vec(),
            created_at: chrono::Utc::now(),
        })
    }

    /// Decrypt credentials
    fn decrypt_credentials(&self, encrypted: &EncryptedCredentials) -> MailResult<AuthCredentials> {
        let cipher = Aes256Gcm::new(&self.encryption_key);
        let nonce = Nonce::from_slice(&encrypted.nonce);
        
        // Decrypt
        let mut plaintext = cipher
            .decrypt(nonce, encrypted.encrypted_data.as_ref())
            .map_err(|e| crate::mail::error::MailError::encryption(format!("Decryption failed: {}", e)))?;

        // Deserialize from JSON
        let credentials = serde_json::from_slice(&plaintext)?;
        
        // Zero out plaintext for security
        plaintext.zeroize();
        
        Ok(credentials)
    }

    /// Derive system encryption key
    fn derive_system_key() -> MailResult<Key<Aes256Gcm>> {
        use ring::digest::{Context, SHA256};
        
        // Use system-specific information to derive key
        let mut context = Context::new(&SHA256);
        
        // Add system identifiers
        if let Some(machine_id) = Self::get_machine_id() {
            context.update(machine_id.as_bytes());
        }
        
        // Add application-specific salt
        context.update(b"flow_desk_mail_engine_v1");
        
        // Add user-specific information if available
        if let Some(username) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")).ok() {
            context.update(username.as_bytes());
        }
        
        let digest = context.finish();
        let key_bytes: [u8; 32] = digest.as_ref()[..32].try_into()
            .map_err(|_| crate::mail::error::MailError::encryption("Failed to derive system key"))?;
        
        Ok(*Key::<Aes256Gcm>::from_slice(&key_bytes))
    }

    /// Get machine ID for key derivation
    fn get_machine_id() -> Option<String> {
        // Try to get machine ID from various sources
        if let Ok(id) = std::process::Command::new("cat")
            .arg("/etc/machine-id")
            .output()
        {
            if id.status.success() {
                return Some(String::from_utf8_lossy(&id.stdout).trim().to_string());
            }
        }

        // Fallback to hostname
        if let Ok(hostname) = hostname::get() {
            return Some(hostname.to_string_lossy().to_string());
        }

        None
    }

    /// Load credentials from file
    async fn load_from_file(&self) -> MailResult<()> {
        let path = match &self.storage_path {
            Some(p) => p,
            None => return Ok(()),
        };

        if !path.exists() {
            return Ok(());
        }

        let data = tokio::fs::read(path).await?;
        let stored_data: HashMap<Uuid, EncryptedCredentials> = serde_json::from_slice(&data)?;

        let count = stored_data.len();
        {
            let mut cache = self.cache.write().await;
            *cache = stored_data;
        }

        tracing::debug!("Loaded {} credential entries from file", count);
        Ok(())
    }

    /// Save credentials to file
    async fn save_to_file(&self) -> MailResult<()> {
        let path = match &self.storage_path {
            Some(p) => p,
            None => return Ok(()),
        };

        let cache = self.cache.read().await;
        let data = serde_json::to_vec_pretty(&*cache)?;
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Write to temporary file first, then rename for atomicity
        let temp_path = path.with_extension("tmp");
        tokio::fs::write(&temp_path, &data).await?;
        tokio::fs::rename(&temp_path, path).await?;

        tracing::debug!("Saved {} credential entries to file", cache.len());
        Ok(())
    }
}

impl Drop for TokenStorage {
    fn drop(&mut self) {
        // Zero out the encryption key
        self.encryption_key.as_mut_slice().zeroize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mail::types::MailProvider;
    use chrono::Utc;
    use tempfile::tempdir;

    fn create_test_credentials() -> AuthCredentials {
        AuthCredentials {
            access_token: "test_access_token".to_string(),
            refresh_token: Some("test_refresh_token".to_string()),
            token_type: "Bearer".to_string(),
            expires_at: Some(Utc::now() + chrono::Duration::hours(1)),
            scopes: vec!["read".to_string(), "write".to_string()],
            provider: MailProvider::Gmail,
            account_id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_in_memory_storage() {
        let storage = TokenStorage::new().await.unwrap();
        let credentials = create_test_credentials();
        let account_id = credentials.account_id;

        // Store credentials
        storage.store_credentials(&credentials).await.unwrap();

        // Retrieve credentials
        let retrieved = storage.get_credentials(account_id).await.unwrap().unwrap();
        assert_eq!(retrieved.access_token, credentials.access_token);
        assert_eq!(retrieved.account_id, credentials.account_id);

        // Check existence
        assert!(storage.has_credentials(account_id).await);

        // Remove credentials
        storage.remove_credentials(account_id).await.unwrap();
        assert!(storage.get_credentials(account_id).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_file_persistence() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("credentials.json");
        let credentials = create_test_credentials();
        let account_id = credentials.account_id;

        // Create storage with file persistence
        {
            let storage = TokenStorage::with_file(&storage_path, None).await.unwrap();
            storage.store_credentials(&credentials).await.unwrap();
        }

        // Create new storage instance and verify data is loaded
        {
            let storage = TokenStorage::with_file(&storage_path, None).await.unwrap();
            let retrieved = storage.get_credentials(account_id).await.unwrap().unwrap();
            assert_eq!(retrieved.access_token, credentials.access_token);
        }
    }

    #[tokio::test]
    async fn test_encryption_decryption() {
        let key = [0u8; 32]; // Test key
        let storage = TokenStorage::with_key(&key).await.unwrap();
        let credentials = create_test_credentials();
        
        // Test encryption/decryption round trip
        let encrypted = storage.encrypt_credentials(&credentials).unwrap();
        let decrypted = storage.decrypt_credentials(&encrypted).unwrap();
        
        assert_eq!(decrypted.access_token, credentials.access_token);
        assert_eq!(decrypted.account_id, credentials.account_id);
        assert_eq!(decrypted.provider, credentials.provider);
    }

    #[tokio::test]
    async fn test_multiple_accounts() {
        let storage = TokenStorage::new().await.unwrap();
        let mut credentials_list = Vec::new();
        
        // Store multiple credentials
        for _ in 0..3 {
            let creds = create_test_credentials();
            storage.store_credentials(&creds).await.unwrap();
            credentials_list.push(creds);
        }

        // Verify all accounts are listed
        let account_ids = storage.list_accounts().await;
        assert_eq!(account_ids.len(), 3);

        for creds in &credentials_list {
            assert!(account_ids.contains(&creds.account_id));
        }

        // Clear all and verify
        storage.clear_all().await.unwrap();
        assert_eq!(storage.list_accounts().await.len(), 0);
    }
}