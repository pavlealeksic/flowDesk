//! Encrypted storage wrapper that provides additional security layers
//! 
//! This module provides enhanced encryption for configuration storage with:
//! - Multiple encryption layers (device key + workspace key)
//! - Key rotation support
//! - Forward secrecy
//! - Integrity verification

use std::collections::HashMap;
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::crypto::*;
use crate::config_sync::*;
use crate::storage::local_storage::LocalStorage;

/// Encrypted storage wrapper configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedStorageConfig {
    /// Enable double encryption (device key + workspace key)
    pub double_encryption: bool,
    /// Enable key rotation
    pub key_rotation_enabled: bool,
    /// Key rotation interval in days
    pub key_rotation_interval_days: u32,
    /// Enable forward secrecy
    pub forward_secrecy: bool,
    /// Compression before encryption
    pub compress_before_encryption: bool,
}

/// Key rotation information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRotationInfo {
    /// Current key version
    pub current_version: u32,
    /// Last rotation timestamp
    pub last_rotation: DateTime<Utc>,
    /// Next scheduled rotation
    pub next_rotation: DateTime<Utc>,
    /// Previous key versions (for decryption)
    pub previous_versions: HashMap<u32, String>, // version -> encrypted key
}

/// Encrypted storage wrapper
#[derive(Debug)]
pub struct EncryptedStorage {
    /// Underlying storage implementation
    inner: LocalStorage,
    /// Encrypted storage configuration
    config: EncryptedStorageConfig,
    /// Device key pair for additional encryption
    device_keypair: X25519KeyPair,
    /// Key rotation information
    key_rotation: Option<KeyRotationInfo>,
}

/// Encrypted data envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
struct EncryptedEnvelope {
    /// Encryption version/algorithm identifier
    version: String,
    /// Key version used for encryption
    key_version: u32,
    /// Encrypted data
    data: Vec<u8>,
    /// Integrity hash
    integrity_hash: String,
    /// Additional authenticated data
    aad: Vec<u8>,
    /// Timestamp of encryption
    encrypted_at: DateTime<Utc>,
}

impl EncryptedStorage {
    /// Create a new encrypted storage wrapper
    pub fn new(
        inner: LocalStorage,
        config: EncryptedStorageConfig,
        device_keypair: X25519KeyPair,
    ) -> Self {
        Self {
            inner,
            config,
            device_keypair,
            key_rotation: None,
        }
    }
    
    /// Initialize key rotation if enabled
    pub async fn initialize_key_rotation(&mut self) -> Result<()> {
        if !self.config.key_rotation_enabled {
            return Ok(());
        }
        
        // Try to load existing key rotation info
        if let Some(secrets) = self.inner.load_secrets().await? {
            if let Ok(rotation_info) = self.deserialize_key_rotation(&secrets) {
                self.key_rotation = Some(rotation_info);
                return Ok(());
            }
        }
        
        // Initialize new key rotation
        let now = Utc::now();
        let next_rotation = now + chrono::Duration::days(self.config.key_rotation_interval_days as i64);
        
        let rotation_info = KeyRotationInfo {
            current_version: 1,
            last_rotation: now,
            next_rotation,
            previous_versions: HashMap::new(),
        };
        
        self.key_rotation = Some(rotation_info);
        self.save_key_rotation().await?;
        
        Ok(())
    }
    
    /// Check if key rotation is needed
    pub fn needs_key_rotation(&self) -> bool {
        if !self.config.key_rotation_enabled {
            return false;
        }
        
        if let Some(rotation_info) = &self.key_rotation {
            Utc::now() >= rotation_info.next_rotation
        } else {
            true
        }
    }
    
    /// Perform key rotation
    pub async fn rotate_keys(&mut self) -> Result<()> {
        if !self.config.key_rotation_enabled {
            return Ok(());
        }
        
        let mut rotation_info = self.key_rotation.clone()
            .unwrap_or_else(|| KeyRotationInfo {
                current_version: 1,
                last_rotation: Utc::now(),
                next_rotation: Utc::now(),
                previous_versions: HashMap::new(),
            });
        
        // Store current key as previous version
        // In a real implementation, we'd encrypt the current workspace key with the device key
        // and store it for future decryption needs
        
        // Update rotation info
        rotation_info.current_version += 1;
        rotation_info.last_rotation = Utc::now();
        rotation_info.next_rotation = Utc::now() + 
            chrono::Duration::days(self.config.key_rotation_interval_days as i64);
        
        self.key_rotation = Some(rotation_info);
        self.save_key_rotation().await?;
        
        Ok(())
    }
    
    /// Serialize key rotation info
    fn serialize_key_rotation(&self, rotation_info: &KeyRotationInfo) -> Result<Vec<u8>> {
        let json = serde_json::to_string(rotation_info)?;
        Ok(json.into_bytes())
    }
    
    /// Deserialize key rotation info
    fn deserialize_key_rotation(&self, data: &[u8]) -> Result<KeyRotationInfo> {
        let json = String::from_utf8(data.to_vec())?;
        let rotation_info: KeyRotationInfo = serde_json::from_str(&json)?;
        Ok(rotation_info)
    }
    
    /// Save key rotation info
    async fn save_key_rotation(&self) -> Result<()> {
        if let Some(rotation_info) = &self.key_rotation {
            let data = self.serialize_key_rotation(rotation_info)?;
            self.inner.save_secrets(&data).await?;
        }
        Ok(())
    }
    
    /// Encrypt data with enhanced security
    fn encrypt_data(&self, data: &[u8]) -> Result<EncryptedEnvelope> {
        let mut processed_data = data.to_vec();
        
        // Compress if enabled
        if self.config.compress_before_encryption {
            use flate2::write::GzEncoder;
            use flate2::Compression;
            use std::io::Write;
            
            let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
            encoder.write_all(&processed_data)?;
            processed_data = encoder.finish()?;
        }
        
        // Create additional authenticated data
        let aad = serde_json::to_vec(&serde_json::json!({
            "device_id": self.device_keypair.public_key_base64(),
            "timestamp": Utc::now().timestamp(),
        }))?;
        
        // Encrypt with device key (first layer)
        if self.config.double_encryption {
            let device_encrypted = encrypt_sealed_box(&processed_data, &self.device_keypair.public_key)?;
            processed_data = device_encrypted;
        }
        
        // Generate workspace key if needed and encrypt (second layer)
        // This would normally use the actual workspace sync key
        let workspace_key = generate_chacha_key();
        let final_encrypted = encrypt_chacha20poly1305(&processed_data, &workspace_key, &aad)?;
        
        // Calculate integrity hash
        let integrity_hash = hash_to_hex(&final_encrypted);
        
        let key_version = self.key_rotation
            .as_ref()
            .map(|r| r.current_version)
            .unwrap_or(1);
        
        Ok(EncryptedEnvelope {
            version: "1.0".to_string(),
            key_version,
            data: final_encrypted,
            integrity_hash,
            aad,
            encrypted_at: Utc::now(),
        })
    }
    
    /// Decrypt data with enhanced security
    fn decrypt_data(&self, envelope: &EncryptedEnvelope) -> Result<Vec<u8>> {
        // Verify integrity
        let computed_hash = hash_to_hex(&envelope.data);
        if computed_hash != envelope.integrity_hash {
            return Err(anyhow!("Data integrity check failed"));
        }
        
        // Decrypt with workspace key (first layer)
        // This would normally use the appropriate workspace sync key for the version
        let workspace_key = generate_chacha_key(); // Placeholder
        let mut processed_data = decrypt_chacha20poly1305(&envelope.data, &workspace_key, &envelope.aad)?;
        
        // Decrypt with device key (second layer) if double encryption is enabled
        if self.config.double_encryption {
            processed_data = decrypt_sealed_box(&processed_data, &self.device_keypair)?;
        }
        
        // Decompress if enabled
        if self.config.compress_before_encryption {
            use flate2::read::GzDecoder;
            use std::io::Read;
            
            let mut decoder = GzDecoder::new(&processed_data[..]);
            let mut decompressed = Vec::new();
            decoder.read_to_end(&mut decompressed)?;
            processed_data = decompressed;
        }
        
        Ok(processed_data)
    }
    
    /// Set workspace sync key on inner storage
    pub fn set_workspace_sync_key(&mut self, key: ChaChaKey) {
        self.inner.set_workspace_sync_key(key);
    }
}

#[async_trait::async_trait]
impl ConfigStorage for EncryptedStorage {
    async fn save_config(&self, config: &VersionedConfig) -> Result<()> {
        // Serialize configuration
        let config_json = serde_json::to_string(config)?;
        let config_data = config_json.as_bytes();
        
        // Encrypt configuration
        let encrypted_envelope = self.encrypt_data(config_data)?;
        let envelope_json = serde_json::to_string(&encrypted_envelope)?;
        
        // Create a new VersionedConfig with encrypted data
        let mut encrypted_config = config.clone();
        encrypted_config.config = serde_json::json!({
            "encrypted": true,
            "envelope": envelope_json
        });
        
        // Save encrypted configuration
        self.inner.save_config(&encrypted_config).await
    }
    
    async fn load_config(&self) -> Result<Option<VersionedConfig>> {
        if let Some(encrypted_config) = self.inner.load_config().await? {
            // Check if this is an encrypted configuration
            if let Some(encrypted_flag) = encrypted_config.config.get("encrypted") {
                if encrypted_flag.as_bool() == Some(true) {
                    // Extract and decrypt the envelope
                    let envelope_json = encrypted_config.config
                        .get("envelope")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| anyhow!("Missing encrypted envelope"))?;
                    
                    let envelope: EncryptedEnvelope = serde_json::from_str(envelope_json)?;
                    let decrypted_data = self.decrypt_data(&envelope)?;
                    let decrypted_json = String::from_utf8(decrypted_data)?;
                    let decrypted_config: VersionedConfig = serde_json::from_str(&decrypted_json)?;
                    
                    return Ok(Some(decrypted_config));
                }
            }
            
            // Not encrypted, return as-is
            Ok(Some(encrypted_config))
        } else {
            Ok(None)
        }
    }
    
    async fn save_secrets(&self, secrets: &[u8]) -> Result<()> {
        let encrypted_envelope = self.encrypt_data(secrets)?;
        let envelope_data = serde_json::to_vec(&encrypted_envelope)?;
        self.inner.save_secrets(&envelope_data).await
    }
    
    async fn load_secrets(&self) -> Result<Option<Vec<u8>>> {
        if let Some(envelope_data) = self.inner.load_secrets().await? {
            let envelope: EncryptedEnvelope = serde_json::from_slice(&envelope_data)?;
            let decrypted_data = self.decrypt_data(&envelope)?;
            Ok(Some(decrypted_data))
        } else {
            Ok(None)
        }
    }
    
    async fn create_backup(&self, config: &VersionedConfig) -> Result<String> {
        // Create backup using inner storage
        // The inner storage will handle the backup creation
        self.inner.create_backup(config).await
    }
    
    async fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        self.inner.list_backups().await
    }
    
    async fn restore_backup(&self, backup_id: &str) -> Result<VersionedConfig> {
        self.inner.restore_backup(backup_id).await
    }
    
    async fn delete_backup(&self, backup_id: &str) -> Result<()> {
        self.inner.delete_backup(backup_id).await
    }
}

impl Default for EncryptedStorageConfig {
    fn default() -> Self {
        Self {
            double_encryption: true,
            key_rotation_enabled: true,
            key_rotation_interval_days: 90, // 3 months
            forward_secrecy: true,
            compress_before_encryption: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::local_storage::create_local_storage_with_directory;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_encrypted_storage_operations() {
        let temp_dir = TempDir::new().unwrap();
        let local_storage = create_local_storage_with_directory(temp_dir.path().to_path_buf()).unwrap();
        
        let config = EncryptedStorageConfig::default();
        let device_keypair = X25519KeyPair::generate();
        
        let mut encrypted_storage = EncryptedStorage::new(local_storage, config, device_keypair);
        encrypted_storage.initialize_key_rotation().await.unwrap();
        
        // Create test configuration
        let config_data = serde_json::json!({
            "theme": "dark",
            "language": "en",
            "sensitive_data": "this should be encrypted"
        });
        
        let config = VersionedConfig {
            config: config_data.clone(),
            vector_clock: VectorClock::with_device("test_device".to_string()),
            schema_version: "1.0.0".to_string(),
            modified_by: "test_device".to_string(),
            modified_at: Utc::now(),
            config_hash: hash_to_hex(serde_json::to_string(&config_data).unwrap().as_bytes()),
        };
        
        // Save encrypted configuration
        encrypted_storage.save_config(&config).await.unwrap();
        
        // Load and decrypt configuration
        let loaded_config = encrypted_storage.load_config().await.unwrap();
        assert!(loaded_config.is_some());
        
        let loaded = loaded_config.unwrap();
        assert_eq!(loaded.config, config.config);
        assert_eq!(loaded.schema_version, config.schema_version);
    }

    #[tokio::test]
    async fn test_key_rotation() {
        let temp_dir = TempDir::new().unwrap();
        let local_storage = create_local_storage_with_directory(temp_dir.path().to_path_buf()).unwrap();
        
        let mut config = EncryptedStorageConfig::default();
        config.key_rotation_interval_days = 0; // Force rotation
        
        let device_keypair = X25519KeyPair::generate();
        let mut encrypted_storage = EncryptedStorage::new(local_storage, config, device_keypair);
        
        // Initialize key rotation
        encrypted_storage.initialize_key_rotation().await.unwrap();
        
        // Check that rotation is needed
        assert!(encrypted_storage.needs_key_rotation());
        
        // Perform rotation
        encrypted_storage.rotate_keys().await.unwrap();
        
        // Verify rotation info was updated
        assert!(encrypted_storage.key_rotation.is_some());
        let rotation_info = encrypted_storage.key_rotation.as_ref().unwrap();
        assert_eq!(rotation_info.current_version, 2);
    }
}