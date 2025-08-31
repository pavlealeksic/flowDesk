//! Import/Export transport for configuration sync
//! 
//! Provides functionality to:
//! - Export configuration as encrypted .workosync archives
//! - Import configuration from archives
//! - Generate QR codes for device pairing
//! - Handle secure archive creation and extraction

use std::path::PathBuf;
use std::collections::HashMap;
use std::io::{Write, Read, Cursor};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tar::{Archive, Builder};
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use flate2::Compression;

use crate::crypto::*;
use crate::config_sync::*;

/// Archive format types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArchiveFormat {
    WorkoSync, // Custom encrypted format
    Zip,       // Standard ZIP with encryption
}

/// Import/Export transport configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportExportConfig {
    /// Archive format
    pub format: ArchiveFormat,
    /// Default export location
    pub export_location: PathBuf,
    /// Auto-export settings
    pub auto_export: AutoExportConfig,
    /// Compression level (0-9)
    pub compression_level: u32,
    /// Include metadata in exports
    pub include_metadata: bool,
    /// Maximum archive size in bytes
    pub max_archive_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoExportConfig {
    /// Enable auto-export
    pub enabled: bool,
    /// Export frequency in hours
    pub frequency_hours: u32,
    /// Export location for auto-exports
    pub location: PathBuf,
    /// Maximum number of auto-export files to keep
    pub max_files: u32,
}

/// Archive metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveMetadata {
    /// Archive creation timestamp
    pub created_at: DateTime<Utc>,
    /// Creator device information
    pub creator_device: String,
    /// Archive format version
    pub format_version: String,
    /// Configuration schema version
    pub config_schema_version: String,
    /// Archive description
    pub description: Option<String>,
    /// Archive size in bytes
    pub size_bytes: u64,
    /// Archive checksum
    pub checksum: String,
}

/// Import/Export transport implementation
pub struct ImportExportTransport {
    /// Transport configuration
    config: ImportExportConfig,
    /// Device information
    device_info: DeviceInfo,
    /// Transport ID
    id: String,
    /// Last operation timestamp
    last_activity: Option<DateTime<Utc>>,
}

impl ImportExportTransport {
    /// Create a new import/export transport
    pub fn new(config: ImportExportConfig, device_info: DeviceInfo) -> Self {
        Self {
            config,
            device_info,
            id: "import_export".to_string(),
            last_activity: None,
        }
    }
    
    /// Export configuration to encrypted archive
    pub async fn export_config(
        &self,
        config: &VersionedConfig,
        export_path: &PathBuf,
        description: Option<String>,
    ) -> Result<ArchiveMetadata> {
        let mut archive_data = Vec::new();
        
        match self.config.format {
            ArchiveFormat::WorkoSync => {
                self.create_workosync_archive(config, &mut archive_data, description.as_deref()).await?;
            }
            ArchiveFormat::Zip => {
                return Err(anyhow!("ZIP format not yet implemented"));
            }
        }
        
        // Write archive to file
        tokio::fs::write(export_path, &archive_data).await?;
        
        // Create metadata
        let metadata = ArchiveMetadata {
            created_at: Utc::now(),
            creator_device: self.device_info.device_id.clone(),
            format_version: "1.0.0".to_string(),
            config_schema_version: config.schema_version.clone(),
            description,
            size_bytes: archive_data.len() as u64,
            checksum: hash_to_hex(&archive_data),
        };
        
        Ok(metadata)
    }
    
    /// Import configuration from encrypted archive
    pub async fn import_config(&self, archive_path: &PathBuf) -> Result<(VersionedConfig, ArchiveMetadata)> {
        let archive_data = tokio::fs::read(archive_path).await?;
        
        // Verify checksum would go here
        
        match self.config.format {
            ArchiveFormat::WorkoSync => {
                self.extract_workosync_archive(&archive_data).await
            }
            ArchiveFormat::Zip => {
                Err(anyhow!("ZIP format not yet implemented"))
            }
        }
    }
    
    /// Create WorkoSync archive format
    async fn create_workosync_archive(
        &self,
        config: &VersionedConfig,
        output: &mut Vec<u8>,
        description: Option<&str>,
    ) -> Result<()> {
        let mut tar_builder = Builder::new(Vec::new());
        
        // Add configuration file
        let config_json = serde_json::to_string_pretty(config)?;
        let config_bytes = config_json.as_bytes();
        let mut config_header = tar::Header::new_gnu();
        config_header.set_path("config.json")?;
        config_header.set_size(config_bytes.len() as u64);
        config_header.set_mode(0o644);
        config_header.set_cksum();
        tar_builder.append(&config_header, config_bytes)?;
        
        // Add metadata file
        let metadata = ArchiveMetadata {
            created_at: Utc::now(),
            creator_device: self.device_info.device_id.clone(),
            format_version: "1.0.0".to_string(),
            config_schema_version: config.schema_version.clone(),
            description: description.map(|s| s.to_string()),
            size_bytes: 0, // Will be updated later
            checksum: String::new(), // Will be updated later
        };
        
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        let metadata_bytes = metadata_json.as_bytes();
        let mut metadata_header = tar::Header::new_gnu();
        metadata_header.set_path("metadata.json")?;
        metadata_header.set_size(metadata_bytes.len() as u64);
        metadata_header.set_mode(0o644);
        metadata_header.set_cksum();
        tar_builder.append(&metadata_header, metadata_bytes)?;
        
        // Finalize tar archive
        let tar_data = tar_builder.into_inner()?;
        
        // Compress
        let mut encoder = GzEncoder::new(Vec::new(), Compression::new(self.config.compression_level));
        encoder.write_all(&tar_data)?;
        let compressed_data = encoder.finish()?;
        
        // TODO: Encrypt with workspace sync key or device key
        // For now, just store compressed data
        output.extend_from_slice(&compressed_data);
        
        Ok(())
    }
    
    /// Extract WorkoSync archive format
    async fn extract_workosync_archive(
        &self,
        archive_data: &[u8],
    ) -> Result<(VersionedConfig, ArchiveMetadata)> {
        // TODO: Decrypt archive data
        
        // Decompress
        let mut decoder = GzDecoder::new(archive_data);
        let mut decompressed_data = Vec::new();
        decoder.read_to_end(&mut decompressed_data)?;
        
        // Extract tar archive
        let mut archive = Archive::new(Cursor::new(decompressed_data));
        let entries = archive.entries()?;
        
        let mut config_data: Option<VersionedConfig> = None;
        let mut metadata: Option<ArchiveMetadata> = None;
        
        for entry in entries {
            let mut entry = entry?;
            let path = entry.path()?.to_path_buf();
            
            let mut contents = Vec::new();
            entry.read_to_end(&mut contents)?;
            let content_str = String::from_utf8(contents)?;
            
            match path.to_str() {
                Some("config.json") => {
                    config_data = Some(serde_json::from_str(&content_str)?);
                }
                Some("metadata.json") => {
                    metadata = Some(serde_json::from_str(&content_str)?);
                }
                _ => {
                    // Unknown file, skip
                }
            }
        }
        
        let config = config_data.ok_or_else(|| anyhow!("Configuration not found in archive"))?;
        let metadata = metadata.ok_or_else(|| anyhow!("Metadata not found in archive"))?;
        
        Ok((config, metadata))
    }
    
    /// Generate QR code data for device pairing
    pub fn generate_pairing_qr_data(&self, public_key: &PublicKey) -> Result<String> {
        let pairing_data = serde_json::json!({
            "type": "flowdesk_pairing",
            "version": "1.0",
            "device_id": self.device_info.device_id,
            "device_name": self.device_info.device_name,
            "device_type": self.device_info.device_type,
            "public_key": encode_base64(public_key.as_bytes()),
            "timestamp": Utc::now().timestamp(),
        });
        
        Ok(serde_json::to_string(&pairing_data)?)
    }
    
    /// Parse QR code data for device pairing
    pub fn parse_pairing_qr_data(&self, qr_data: &str) -> Result<PairingInfo> {
        let data: serde_json::Value = serde_json::from_str(qr_data)?;
        
        // Verify format
        if data["type"].as_str() != Some("flowdesk_pairing") {
            return Err(anyhow!("Invalid QR code format"));
        }
        
        let device_id = data["device_id"].as_str()
            .ok_or_else(|| anyhow!("Missing device_id"))?;
        let device_name = data["device_name"].as_str()
            .ok_or_else(|| anyhow!("Missing device_name"))?;
        let public_key_b64 = data["public_key"].as_str()
            .ok_or_else(|| anyhow!("Missing public_key"))?;
        
        let public_key_bytes = decode_base64(public_key_b64)?;
        if public_key_bytes.len() != 32 {
            return Err(anyhow!("Invalid public key length"));
        }
        
        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(&public_key_bytes);
        let public_key = PublicKey::from(key_array);
        
        Ok(PairingInfo {
            device_id: device_id.to_string(),
            device_name: device_name.to_string(),
            public_key,
        })
    }
}

/// Device pairing information
#[derive(Debug, Clone)]
pub struct PairingInfo {
    pub device_id: String,
    pub device_name: String,
    pub public_key: PublicKey,
}

#[async_trait::async_trait]
impl SyncTransport for ImportExportTransport {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        "Import/Export"
    }
    
    async fn is_available(&self) -> bool {
        // Always available since it's file-based
        true
    }
    
    async fn initialize(&mut self) -> Result<()> {
        // Ensure export directory exists
        if !self.config.export_location.exists() {
            tokio::fs::create_dir_all(&self.config.export_location).await?;
        }
        
        self.last_activity = Some(Utc::now());
        Ok(())
    }
    
    async fn push_config(&self, config: &VersionedConfig) -> Result<()> {
        // For import/export, push means creating an export
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("flowdesk_config_{}.workosync", timestamp);
        let export_path = self.config.export_location.join(filename);
        
        self.export_config(config, &export_path, Some("Auto-export")).await?;
        Ok(())
    }
    
    async fn pull_config(&self) -> Result<Option<VersionedConfig>> {
        // For import/export, pull means looking for the latest import
        // This is typically handled manually, so return None
        Ok(None)
    }
    
    async fn list_configs(&self) -> Result<Vec<ConfigMetadata>> {
        // List available export files
        let mut configs = Vec::new();
        
        if self.config.export_location.exists() {
            let mut entries = tokio::fs::read_dir(&self.config.export_location).await?;
            
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if path.extension() == Some(std::ffi::OsStr::new("workosync")) {
                    if let Ok(metadata) = entry.metadata().await {
                        if let Ok(modified) = metadata.modified() {
                            let datetime: DateTime<Utc> = modified.into();
                            
                            configs.push(ConfigMetadata {
                                id: path.file_stem()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("unknown")
                                    .to_string(),
                                schema_version: "unknown".to_string(),
                                modified_by: self.device_info.device_id.clone(),
                                modified_at: datetime,
                                size_bytes: metadata.len(),
                                checksum: String::new(), // Would compute if needed
                            });
                        }
                    }
                }
            }
        }
        
        Ok(configs)
    }
    
    async fn delete_config(&self, config_id: &str) -> Result<()> {
        let filename = format!("{}.workosync", config_id);
        let file_path = self.config.export_location.join(filename);
        
        if file_path.exists() {
            tokio::fs::remove_file(file_path).await?;
        }
        
        Ok(())
    }
    
    async fn get_status(&self) -> Result<TransportStatus> {
        let mut metadata = HashMap::new();
        metadata.insert("format".to_string(), format!("{:?}", self.config.format));
        metadata.insert("export_location".to_string(), self.config.export_location.display().to_string());
        metadata.insert("auto_export".to_string(), self.config.auto_export.enabled.to_string());
        
        // Count export files
        let export_count = if self.config.export_location.exists() {
            let mut count = 0;
            let mut entries = tokio::fs::read_dir(&self.config.export_location).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if path.extension() == Some(std::ffi::OsStr::new("workosync")) {
                    count += 1;
                }
            }
            count
        } else {
            0
        };
        
        metadata.insert("export_files".to_string(), export_count.to_string());
        
        Ok(TransportStatus {
            connected: true,
            last_activity: self.last_activity,
            error: None,
            metadata,
        })
    }
}

impl Default for ImportExportConfig {
    fn default() -> Self {
        let default_location = dirs::document_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
            .join("FlowDesk");
        
        Self {
            format: ArchiveFormat::WorkoSync,
            export_location: default_location.clone(),
            auto_export: AutoExportConfig {
                enabled: false,
                frequency_hours: 24,
                location: default_location,
                max_files: 10,
            },
            compression_level: 6,
            include_metadata: true,
            max_archive_size: 50 * 1024 * 1024, // 50MB
        }
    }
}