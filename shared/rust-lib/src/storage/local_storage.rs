//! Local storage implementation for configuration files
//! 
//! Handles secure storage of config.json and secrets.bin files with:
//! - Encrypted secrets storage
//! - Configuration backups with rotation
//! - Atomic file operations
//! - Cross-platform file system access

use std::path::{Path, PathBuf};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::fs as async_fs;

use crate::crypto::*;
use crate::config_sync::*;

#[cfg(test)]
use crate::vector_clock::VectorClock;

/// Local storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalStorageConfig {
    /// Base directory for storage
    pub base_directory: PathBuf,
    /// Configuration file name
    pub config_filename: String,
    /// Secrets file name
    pub secrets_filename: String,
    /// Backup directory name
    pub backup_directory: String,
    /// Maximum number of backups to keep
    pub max_backups: u32,
    /// Enable atomic file operations
    pub atomic_writes: bool,
    /// File permissions (Unix only)
    pub file_permissions: u32,
}

/// Local file system storage implementation
#[derive(Debug)]
pub struct LocalStorage {
    /// Storage configuration
    config: LocalStorageConfig,
    /// Workspace sync key for secrets encryption
    workspace_sync_key: Option<ChaChaKey>,
}

impl LocalStorage {
    /// Create a new local storage instance
    pub fn new(config: LocalStorageConfig) -> Self {
        Self {
            config,
            workspace_sync_key: None,
        }
    }
    
    /// Set the workspace sync key for secrets encryption
    pub fn set_workspace_sync_key(&mut self, key: ChaChaKey) {
        self.workspace_sync_key = Some(key);
    }
    
    /// Get the configuration file path
    fn get_config_path(&self) -> PathBuf {
        self.config.base_directory.join(&self.config.config_filename)
    }
    
    /// Get the secrets file path
    fn get_secrets_path(&self) -> PathBuf {
        self.config.base_directory.join(&self.config.secrets_filename)
    }
    
    /// Get the backup directory path
    fn get_backup_directory(&self) -> PathBuf {
        self.config.base_directory.join(&self.config.backup_directory)
    }
    
    /// Ensure storage directories exist
    async fn ensure_directories(&self) -> Result<()> {
        async_fs::create_dir_all(&self.config.base_directory).await?;
        async_fs::create_dir_all(&self.get_backup_directory()).await?;
        Ok(())
    }
    
    /// Write data to file atomically
    async fn atomic_write(&self, path: &Path, data: &[u8]) -> Result<()> {
        if self.config.atomic_writes {
            // Write to temporary file first, then rename
            let temp_path = path.with_extension("tmp");
            
            async_fs::write(&temp_path, data).await?;
            
            // Set file permissions on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let permissions = std::fs::Permissions::from_mode(self.config.file_permissions);
                async_fs::set_permissions(&temp_path, permissions).await?;
            }
            
            async_fs::rename(&temp_path, path).await?;
        } else {
            async_fs::write(path, data).await?;
            
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let permissions = std::fs::Permissions::from_mode(self.config.file_permissions);
                async_fs::set_permissions(path, permissions).await?;
            }
        }
        
        Ok(())
    }
    
    /// Generate backup filename with timestamp
    fn generate_backup_filename(&self, suffix: &str) -> String {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S_%3f");
        format!("config_backup_{}_{}.json", timestamp, suffix)
    }
    
    /// Clean up old backups to maintain max_backups limit
    async fn cleanup_old_backups(&self) -> Result<()> {
        let backup_dir = self.get_backup_directory();
        
        if !backup_dir.exists() {
            return Ok(());
        }
        
        // Get all backup files
        let mut backup_files = Vec::new();
        let mut entries = async_fs::read_dir(&backup_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension() == Some(std::ffi::OsStr::new("json")) &&
               path.file_name()
                   .and_then(|name| name.to_str())
                   .map_or(false, |name| name.starts_with("config_backup_")) {
                
                if let Ok(metadata) = entry.metadata().await {
                    if let Ok(created) = metadata.created() {
                        let datetime: DateTime<Utc> = created.into();
                        backup_files.push((path, datetime));
                    }
                }
            }
        }
        
        // Sort by creation time (newest first)
        backup_files.sort_by(|a, b| b.1.cmp(&a.1));
        
        // Remove excess backups
        if backup_files.len() > self.config.max_backups as usize {
            for (path, _) in backup_files.iter().skip(self.config.max_backups as usize) {
                if let Err(e) = async_fs::remove_file(path).await {
                    eprintln!("Failed to remove old backup {}: {}", path.display(), e);
                }
            }
        }
        
        Ok(())
    }
}

#[async_trait::async_trait]
impl ConfigStorage for LocalStorage {
    async fn save_config(&self, config: &VersionedConfig) -> Result<()> {
        self.ensure_directories().await?;
        
        // Serialize configuration
        let config_json = serde_json::to_string_pretty(config)?;
        let config_data = config_json.as_bytes();
        
        // Write configuration file atomically
        let config_path = self.get_config_path();
        self.atomic_write(&config_path, config_data).await?;
        
        Ok(())
    }
    
    async fn load_config(&self) -> Result<Option<VersionedConfig>> {
        let config_path = self.get_config_path();
        
        if !config_path.exists() {
            return Ok(None);
        }
        
        // Read configuration file
        let config_data = async_fs::read(&config_path).await?;
        let config_json = String::from_utf8(config_data)?;
        
        // Deserialize configuration
        let config: VersionedConfig = serde_json::from_str(&config_json)?;
        
        // Verify configuration integrity
        let computed_hash = hash_to_hex(serde_json::to_string(&config.config)?.as_bytes());
        if computed_hash != config.config_hash {
            return Err(anyhow!("Configuration integrity check failed"));
        }
        
        Ok(Some(config))
    }
    
    async fn save_secrets(&self, secrets: &[u8]) -> Result<()> {
        self.ensure_directories().await?;
        
        // Encrypt secrets if workspace sync key is available
        let encrypted_secrets = if let Some(key) = &self.workspace_sync_key {
            encrypt_chacha20poly1305(secrets, key, b"secrets")?
        } else {
            // Store unencrypted (not recommended for production)
            secrets.to_vec()
        };
        
        // Write secrets file atomically
        let secrets_path = self.get_secrets_path();
        self.atomic_write(&secrets_path, &encrypted_secrets).await?;
        
        Ok(())
    }
    
    async fn load_secrets(&self) -> Result<Option<Vec<u8>>> {
        let secrets_path = self.get_secrets_path();
        
        if !secrets_path.exists() {
            return Ok(None);
        }
        
        // Read secrets file
        let encrypted_secrets = async_fs::read(&secrets_path).await?;
        
        // Decrypt secrets if workspace sync key is available
        let secrets = if let Some(key) = &self.workspace_sync_key {
            decrypt_chacha20poly1305(&encrypted_secrets, key, b"secrets")?
        } else {
            // Assume unencrypted
            encrypted_secrets
        };
        
        Ok(Some(secrets))
    }
    
    async fn create_backup(&self, config: &VersionedConfig) -> Result<String> {
        self.ensure_directories().await?;
        
        // Generate backup ID and filename
        let backup_id = generate_id();
        let backup_filename = self.generate_backup_filename(&backup_id[0..8]);
        let backup_path = self.get_backup_directory().join(&backup_filename);
        
        // Create backup metadata
        let backup_metadata = BackupMetadata {
            id: backup_id.clone(),
            original_config_hash: config.config_hash.clone(),
            created_at: Utc::now(),
            description: "Automatic backup".to_string(),
            size_bytes: 0, // Will be updated after serialization
        };
        
        // Create backup package
        let backup_package = BackupPackage {
            metadata: backup_metadata,
            config: config.clone(),
        };
        
        // Serialize and save backup
        let backup_json = serde_json::to_string_pretty(&backup_package)?;
        let backup_data = backup_json.as_bytes();
        
        self.atomic_write(&backup_path, backup_data).await?;
        
        // Clean up old backups
        self.cleanup_old_backups().await?;
        
        Ok(backup_id)
    }
    
    async fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        let backup_dir = self.get_backup_directory();
        
        if !backup_dir.exists() {
            return Ok(Vec::new());
        }
        
        let mut backups = Vec::new();
        let mut entries = async_fs::read_dir(&backup_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.extension() == Some(std::ffi::OsStr::new("json")) {
                // Try to read backup metadata
                if let Ok(backup_data) = async_fs::read(&path).await {
                    if let Ok(backup_json) = String::from_utf8(backup_data) {
                        if let Ok(backup_package) = serde_json::from_str::<BackupPackage>(&backup_json) {
                            let metadata = entry.metadata().await?;
                            
                            backups.push(BackupInfo {
                                id: backup_package.metadata.id,
                                created_at: backup_package.metadata.created_at,
                                size_bytes: metadata.len(),
                                description: backup_package.metadata.description,
                            });
                        }
                    }
                }
            }
        }
        
        // Sort by creation time (newest first)
        backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        Ok(backups)
    }
    
    async fn restore_backup(&self, backup_id: &str) -> Result<VersionedConfig> {
        let backup_dir = self.get_backup_directory();
        let mut entries = async_fs::read_dir(&backup_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.extension() == Some(std::ffi::OsStr::new("json")) {
                // Try to read backup
                if let Ok(backup_data) = async_fs::read(&path).await {
                    if let Ok(backup_json) = String::from_utf8(backup_data) {
                        if let Ok(backup_package) = serde_json::from_str::<BackupPackage>(&backup_json) {
                            if backup_package.metadata.id == backup_id {
                                return Ok(backup_package.config);
                            }
                        }
                    }
                }
            }
        }
        
        Err(anyhow!("Backup not found: {}", backup_id))
    }
    
    async fn delete_backup(&self, backup_id: &str) -> Result<()> {
        let backup_dir = self.get_backup_directory();
        let mut entries = async_fs::read_dir(&backup_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.extension() == Some(std::ffi::OsStr::new("json")) {
                // Try to read backup metadata
                if let Ok(backup_data) = async_fs::read(&path).await {
                    if let Ok(backup_json) = String::from_utf8(backup_data) {
                        if let Ok(backup_package) = serde_json::from_str::<BackupPackage>(&backup_json) {
                            if backup_package.metadata.id == backup_id {
                                async_fs::remove_file(&path).await?;
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }
        
        Err(anyhow!("Backup not found: {}", backup_id))
    }
}

/// Backup metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupMetadata {
    id: String,
    original_config_hash: String,
    created_at: DateTime<Utc>,
    description: String,
    size_bytes: u64,
}

/// Backup package containing metadata and configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupPackage {
    metadata: BackupMetadata,
    config: VersionedConfig,
}

impl Default for LocalStorageConfig {
    fn default() -> Self {
        let app_data_dir = dirs::data_local_dir()
            .or_else(|| dirs::data_dir())
            .or_else(|| dirs::home_dir())
            .unwrap_or_else(|| PathBuf::from("."))
            .join("FlowDesk");
        
        Self {
            base_directory: app_data_dir,
            config_filename: "config.json".to_string(),
            secrets_filename: "secrets.bin".to_string(),
            backup_directory: "backups".to_string(),
            max_backups: 10,
            atomic_writes: true,
            file_permissions: 0o600, // Read/write for owner only
        }
    }
}

/// Create a local storage instance with default configuration
pub fn create_default_local_storage() -> Result<LocalStorage> {
    let config = LocalStorageConfig::default();
    Ok(LocalStorage::new(config))
}

/// Create a local storage instance with custom directory
pub fn create_local_storage_with_directory(base_directory: PathBuf) -> Result<LocalStorage> {
    let mut config = LocalStorageConfig::default();
    config.base_directory = base_directory;
    Ok(LocalStorage::new(config))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_local_storage_config_operations() {
        let temp_dir = TempDir::new().unwrap();
        let storage = create_local_storage_with_directory(temp_dir.path().to_path_buf()).unwrap();
        
        // Create test configuration
        let config_data = serde_json::json!({
            "theme": "dark",
            "language": "en"
        });
        
        let config = VersionedConfig {
            config: config_data.clone(),
            vector_clock: VectorClock::with_device("test_device".to_string()),
            schema_version: "1.0.0".to_string(),
            modified_by: "test_device".to_string(),
            modified_at: Utc::now(),
            config_hash: hash_to_hex(serde_json::to_string(&config_data).unwrap().as_bytes()),
        };
        
        // Save configuration
        storage.save_config(&config).await.unwrap();
        
        // Load configuration
        let loaded_config = storage.load_config().await.unwrap();
        assert!(loaded_config.is_some());
        
        let loaded = loaded_config.unwrap();
        assert_eq!(loaded.config, config.config);
        assert_eq!(loaded.schema_version, config.schema_version);
    }

    #[tokio::test]
    async fn test_local_storage_secrets() {
        let temp_dir = TempDir::new().unwrap();
        let mut storage = create_local_storage_with_directory(temp_dir.path().to_path_buf()).unwrap();
        
        // Set workspace sync key
        let key = generate_chacha_key();
        storage.set_workspace_sync_key(key);
        
        let secrets_data = b"super secret data";
        
        // Save secrets
        storage.save_secrets(secrets_data).await.unwrap();
        
        // Load secrets
        let loaded_secrets = storage.load_secrets().await.unwrap();
        assert!(loaded_secrets.is_some());
        assert_eq!(loaded_secrets.unwrap(), secrets_data);
    }

    #[tokio::test]
    async fn test_local_storage_backups() {
        let temp_dir = TempDir::new().unwrap();
        let storage = create_local_storage_with_directory(temp_dir.path().to_path_buf()).unwrap();
        
        // Create test configuration
        let config_data = serde_json::json!({"test": "data"});
        let config = VersionedConfig {
            config: config_data.clone(),
            vector_clock: VectorClock::with_device("test_device".to_string()),
            schema_version: "1.0.0".to_string(),
            modified_by: "test_device".to_string(),
            modified_at: Utc::now(),
            config_hash: hash_to_hex(serde_json::to_string(&config_data).unwrap().as_bytes()),
        };
        
        // Create backup
        let backup_id = storage.create_backup(&config).await.unwrap();
        assert!(!backup_id.is_empty());
        
        // List backups
        let backups = storage.list_backups().await.unwrap();
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].id, backup_id);
        
        // Restore backup
        let restored_config = storage.restore_backup(&backup_id).await.unwrap();
        assert_eq!(restored_config.config, config.config);
        
        // Delete backup
        storage.delete_backup(&backup_id).await.unwrap();
        
        let backups_after_delete = storage.list_backups().await.unwrap();
        assert_eq!(backups_after_delete.len(), 0);
    }
}