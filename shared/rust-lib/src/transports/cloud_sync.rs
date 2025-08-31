//! Cloud folder synchronization transport
//! 
//! Supports syncing configuration files through cloud storage providers:
//! - iCloud Drive
//! - OneDrive  
//! - Dropbox
//! - Google Drive
//! 
//! Files are encrypted end-to-end and stored as config.json + secrets.bin

use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::fs;
use std::time::SystemTime;
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::fs as async_fs;
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use flate2::Compression;
use std::io::{Write, Read};

use crate::crypto::*;
use crate::config_sync::*;

/// Cloud storage provider types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CloudProvider {
    ICloud,
    OneDrive,
    Dropbox,
    GoogleDrive,
}

impl CloudProvider {
    /// Get the default folder path for this provider on the current platform
    pub fn default_path(&self) -> Option<PathBuf> {
        match self {
            CloudProvider::ICloud => {
                #[cfg(target_os = "macos")]
                {
                    if let Some(home) = dirs::home_dir() {
                        Some(home.join("Library/Mobile Documents/com~apple~CloudDocs/FlowDesk"))
                    } else {
                        None
                    }
                }
                #[cfg(not(target_os = "macos"))]
                None
            },
            CloudProvider::OneDrive => {
                if let Some(home) = dirs::home_dir() {
                    #[cfg(target_os = "windows")]
                    {
                        Some(home.join("OneDrive/FlowDesk"))
                    }
                    #[cfg(target_os = "macos")]
                    {
                        Some(home.join("OneDrive/FlowDesk"))
                    }
                    #[cfg(target_os = "linux")]
                    {
                        Some(home.join("OneDrive/FlowDesk"))
                    }
                    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
                    None
                } else {
                    None
                }
            },
            CloudProvider::Dropbox => {
                if let Some(home) = dirs::home_dir() {
                    Some(home.join("Dropbox/FlowDesk"))
                } else {
                    None
                }
            },
            CloudProvider::GoogleDrive => {
                if let Some(home) = dirs::home_dir() {
                    #[cfg(target_os = "windows")]
                    {
                        Some(home.join("Google Drive/FlowDesk"))
                    }
                    #[cfg(target_os = "macos")]
                    {
                        Some(home.join("Google Drive/FlowDesk"))
                    }
                    #[cfg(target_os = "linux")]
                    {
                        Some(home.join("google-drive-ocamlfuse/FlowDesk"))
                    }
                    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
                    None
                } else {
                    None
                }
            },
        }
    }
    
    /// Get provider display name
    pub fn display_name(&self) -> &'static str {
        match self {
            CloudProvider::ICloud => "iCloud Drive",
            CloudProvider::OneDrive => "OneDrive",
            CloudProvider::Dropbox => "Dropbox", 
            CloudProvider::GoogleDrive => "Google Drive",
        }
    }
}

/// Configuration for cloud sync transport
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncConfig {
    /// Cloud provider
    pub provider: CloudProvider,
    /// Folder path for sync files
    pub folder_path: PathBuf,
    /// Workspace sync key for encryption
    pub workspace_sync_key: Option<String>, // Base64 encoded
    /// Device credentials (if needed for API access)
    pub credentials: HashMap<String, String>,
    /// Sync frequency in seconds
    pub sync_frequency: u64,
    /// Enable compression
    pub compression: bool,
    /// Maximum file size in bytes
    pub max_file_size: u64,
}

/// Cloud synchronization transport implementation
pub struct CloudSyncTransport {
    /// Transport configuration
    config: CloudSyncConfig,
    /// Transport ID
    id: String,
    /// Last activity timestamp
    last_activity: Option<DateTime<Utc>>,
    /// Error state
    last_error: Option<String>,
}

impl CloudSyncTransport {
    /// Create a new cloud sync transport
    pub fn new(config: CloudSyncConfig) -> Self {
        let id = format!("cloud_{}", config.provider.display_name().to_lowercase().replace(' ', "_"));
        
        Self {
            config,
            id,
            last_activity: None,
            last_error: None,
        }
    }
    
    /// Get configuration file path
    fn get_config_path(&self) -> PathBuf {
        self.config.folder_path.join("config.json")
    }
    
    /// Get secrets file path
    fn get_secrets_path(&self) -> PathBuf {
        self.config.folder_path.join("secrets.bin")
    }
    
    /// Get metadata file path
    fn get_metadata_path(&self) -> PathBuf {
        self.config.folder_path.join("metadata.json")
    }
    
    /// Ensure sync directory exists
    async fn ensure_sync_directory(&self) -> Result<()> {
        if !self.config.folder_path.exists() {
            async_fs::create_dir_all(&self.config.folder_path).await?;
        }
        Ok(())
    }
    
    /// Encrypt and compress data if configured
    fn process_data_for_storage(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut processed_data = data.to_vec();
        
        // Compress if enabled
        if self.config.compression {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
            encoder.write_all(&processed_data)?;
            processed_data = encoder.finish()?;
        }
        
        // Encrypt with workspace sync key
        if let Some(key_b64) = &self.config.workspace_sync_key {
            let key_bytes = decode_base64(key_b64)?;
            if key_bytes.len() != 32 {
                return Err(anyhow!("Invalid workspace sync key length"));
            }
            
            let key = ChaChaKey::from_slice(&key_bytes);
            processed_data = encrypt_chacha20poly1305(&processed_data, key, b"config")?;
        }
        
        Ok(processed_data)
    }
    
    /// Decrypt and decompress data
    fn process_data_from_storage(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut processed_data = data.to_vec();
        
        // Decrypt with workspace sync key
        if let Some(key_b64) = &self.config.workspace_sync_key {
            let key_bytes = decode_base64(key_b64)?;
            if key_bytes.len() != 32 {
                return Err(anyhow!("Invalid workspace sync key length"));
            }
            
            let key = ChaChaKey::from_slice(&key_bytes);
            processed_data = decrypt_chacha20poly1305(&processed_data, key, b"config")?;
        }
        
        // Decompress if enabled
        if self.config.compression {
            let mut decoder = GzDecoder::new(&processed_data[..]);
            let mut decompressed = Vec::new();
            decoder.read_to_end(&mut decompressed)?;
            processed_data = decompressed;
        }
        
        Ok(processed_data)
    }
    
    /// Save metadata about the configuration
    async fn save_metadata(&self, config: &VersionedConfig) -> Result<()> {
        let metadata = ConfigMetadata {
            id: config.config_hash.clone(),
            schema_version: config.schema_version.clone(),
            modified_by: config.modified_by.clone(),
            modified_at: config.modified_at,
            size_bytes: serde_json::to_vec(&config.config)?.len() as u64,
            checksum: config.config_hash.clone(),
        };
        
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        let processed_data = self.process_data_for_storage(metadata_json.as_bytes())?;
        
        async_fs::write(&self.get_metadata_path(), processed_data).await?;
        Ok(())
    }
    
    /// Load metadata about the configuration
    async fn load_metadata(&self) -> Result<Option<ConfigMetadata>> {
        let metadata_path = self.get_metadata_path();
        
        if !metadata_path.exists() {
            return Ok(None);
        }
        
        let data = async_fs::read(&metadata_path).await?;
        let processed_data = self.process_data_from_storage(&data)?;
        let metadata_json = String::from_utf8(processed_data)?;
        let metadata: ConfigMetadata = serde_json::from_str(&metadata_json)?;
        
        Ok(Some(metadata))
    }
}

#[async_trait::async_trait]
impl SyncTransport for CloudSyncTransport {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        self.config.provider.display_name()
    }
    
    async fn is_available(&self) -> bool {
        // Check if the cloud folder exists and is accessible
        self.config.folder_path.exists()
    }
    
    async fn initialize(&mut self) -> Result<()> {
        self.ensure_sync_directory().await?;
        self.last_activity = Some(Utc::now());
        self.last_error = None;
        Ok(())
    }
    
    async fn push_config(&self, config: &VersionedConfig) -> Result<()> {
        self.ensure_sync_directory().await?;
        
        // Serialize configuration
        let config_json = serde_json::to_string_pretty(&config)?;
        let config_data = self.process_data_for_storage(config_json.as_bytes())?;
        
        // Check file size limit
        if config_data.len() as u64 > self.config.max_file_size {
            return Err(anyhow!("Configuration file too large: {} bytes", config_data.len()));
        }
        
        // Write configuration file
        async_fs::write(&self.get_config_path(), config_data).await?;
        
        // Save metadata
        self.save_metadata(config).await?;
        
        Ok(())
    }
    
    async fn pull_config(&self) -> Result<Option<VersionedConfig>> {
        let config_path = self.get_config_path();
        
        if !config_path.exists() {
            return Ok(None);
        }
        
        // Read and process configuration file
        let config_data = async_fs::read(&config_path).await?;
        let processed_data = self.process_data_from_storage(&config_data)?;
        let config_json = String::from_utf8(processed_data)?;
        
        // Deserialize configuration
        let config: VersionedConfig = serde_json::from_str(&config_json)?;
        
        // Verify integrity
        let computed_hash = hash_to_hex(serde_json::to_string(&config.config)?.as_bytes());
        if computed_hash != config.config_hash {
            return Err(anyhow!("Configuration integrity check failed"));
        }
        
        Ok(Some(config))
    }
    
    async fn list_configs(&self) -> Result<Vec<ConfigMetadata>> {
        let mut configs = Vec::new();
        
        if let Some(metadata) = self.load_metadata().await? {
            configs.push(metadata);
        }
        
        Ok(configs)
    }
    
    async fn delete_config(&self, _config_id: &str) -> Result<()> {
        // Remove all sync files
        let paths = [
            self.get_config_path(),
            self.get_secrets_path(),
            self.get_metadata_path(),
        ];
        
        for path in &paths {
            if path.exists() {
                async_fs::remove_file(path).await?;
            }
        }
        
        Ok(())
    }
    
    async fn get_status(&self) -> Result<TransportStatus> {
        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), self.config.provider.display_name().to_string());
        metadata.insert("folder_path".to_string(), self.config.folder_path.display().to_string());
        metadata.insert("compression".to_string(), self.config.compression.to_string());
        
        // Check if files exist
        let config_exists = self.get_config_path().exists();
        let secrets_exists = self.get_secrets_path().exists();
        let metadata_exists = self.get_metadata_path().exists();
        
        metadata.insert("config_exists".to_string(), config_exists.to_string());
        metadata.insert("secrets_exists".to_string(), secrets_exists.to_string());
        metadata.insert("metadata_exists".to_string(), metadata_exists.to_string());
        
        // Get file modification times
        if config_exists {
            if let Ok(config_metadata) = std::fs::metadata(&self.get_config_path()) {
                if let Ok(modified) = config_metadata.modified() {
                    let datetime: DateTime<Utc> = modified.into();
                    metadata.insert("config_modified".to_string(), datetime.to_rfc3339());
                }
            }
        }
        
        Ok(TransportStatus {
            connected: self.is_available().await,
            last_activity: self.last_activity,
            error: self.last_error.clone(),
            metadata,
        })
    }
}

/// Helper function to create cloud sync transport for iCloud
pub fn create_icloud_transport(folder_path: Option<PathBuf>) -> Result<CloudSyncTransport> {
    let path = if let Some(path) = folder_path {
        path
    } else {
        CloudProvider::ICloud.default_path()
            .ok_or_else(|| anyhow!("iCloud Drive not available on this platform"))?
    };
    
    let config = CloudSyncConfig {
        provider: CloudProvider::ICloud,
        folder_path: path,
        workspace_sync_key: None,
        credentials: HashMap::new(),
        sync_frequency: 300, // 5 minutes
        compression: true,
        max_file_size: 10 * 1024 * 1024, // 10MB
    };
    
    Ok(CloudSyncTransport::new(config))
}

/// Helper function to create cloud sync transport for OneDrive
pub fn create_onedrive_transport(folder_path: Option<PathBuf>) -> Result<CloudSyncTransport> {
    let path = if let Some(path) = folder_path {
        path
    } else {
        CloudProvider::OneDrive.default_path()
            .ok_or_else(|| anyhow!("OneDrive not available on this platform"))?
    };
    
    let config = CloudSyncConfig {
        provider: CloudProvider::OneDrive,
        folder_path: path,
        workspace_sync_key: None,
        credentials: HashMap::new(),
        sync_frequency: 300, // 5 minutes
        compression: true,
        max_file_size: 10 * 1024 * 1024, // 10MB
    };
    
    Ok(CloudSyncTransport::new(config))
}

/// Helper function to create cloud sync transport for Dropbox
pub fn create_dropbox_transport(folder_path: Option<PathBuf>) -> Result<CloudSyncTransport> {
    let path = if let Some(path) = folder_path {
        path
    } else {
        CloudProvider::Dropbox.default_path()
            .ok_or_else(|| anyhow!("Dropbox not available on this platform"))?
    };
    
    let config = CloudSyncConfig {
        provider: CloudProvider::Dropbox,
        folder_path: path,
        workspace_sync_key: None,
        credentials: HashMap::new(),
        sync_frequency: 300, // 5 minutes
        compression: true,
        max_file_size: 10 * 1024 * 1024, // 10MB
    };
    
    Ok(CloudSyncTransport::new(config))
}

/// Helper function to create cloud sync transport for Google Drive
pub fn create_googledrive_transport(folder_path: Option<PathBuf>) -> Result<CloudSyncTransport> {
    let path = if let Some(path) = folder_path {
        path
    } else {
        CloudProvider::GoogleDrive.default_path()
            .ok_or_else(|| anyhow!("Google Drive not available on this platform"))?
    };
    
    let config = CloudSyncConfig {
        provider: CloudProvider::GoogleDrive,
        folder_path: path,
        workspace_sync_key: None,
        credentials: HashMap::new(),
        sync_frequency: 300, // 5 minutes
        compression: true,
        max_file_size: 10 * 1024 * 1024, // 10MB
    };
    
    Ok(CloudSyncTransport::new(config))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_cloud_sync_transport_creation() {
        let temp_dir = TempDir::new().unwrap();
        let folder_path = temp_dir.path().to_path_buf();
        
        let transport = create_icloud_transport(Some(folder_path)).unwrap();
        assert_eq!(transport.name(), "iCloud Drive");
        assert_eq!(transport.id(), "cloud_icloud_drive");
    }

    #[tokio::test]
    async fn test_cloud_sync_push_pull() {
        let temp_dir = TempDir::new().unwrap();
        let folder_path = temp_dir.path().to_path_buf();
        
        let mut transport = create_icloud_transport(Some(folder_path)).unwrap();
        transport.initialize().await.unwrap();
        
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
        
        // Push configuration
        transport.push_config(&config).await.unwrap();
        
        // Pull configuration
        let pulled_config = transport.pull_config().await.unwrap();
        assert!(pulled_config.is_some());
        
        let pulled = pulled_config.unwrap();
        assert_eq!(pulled.config, config.config);
        assert_eq!(pulled.schema_version, config.schema_version);
    }

    #[tokio::test]
    async fn test_cloud_provider_paths() {
        // Test that provider paths are generated correctly
        let providers = [
            CloudProvider::ICloud,
            CloudProvider::OneDrive,
            CloudProvider::Dropbox,
            CloudProvider::GoogleDrive,
        ];
        
        for provider in &providers {
            let _path = provider.default_path(); // Should not panic
            assert!(!provider.display_name().is_empty());
        }
    }
}