//! Configuration synchronization engine for Flow Desk
//! 
//! This module provides a comprehensive config sync system with local-first architecture,
//! end-to-end encryption, and support for multiple transport methods.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};

use crate::crypto::*;
use crate::vector_clock::*;

/// Configuration synchronization engine
pub struct ConfigSyncEngine {
    /// Device information
    device_info: DeviceInfo,
    /// Device key pair for authentication
    device_keypair: X25519KeyPair,
    /// Current workspace sync key
    workspace_sync_key: Arc<RwLock<Option<ChaChaKey>>>,
    /// Active transports
    transports: Arc<RwLock<HashMap<String, Box<dyn SyncTransport + Send + Sync>>>>,
    /// Local storage manager
    storage: Arc<dyn ConfigStorage + Send + Sync>,
    /// Current config with version info
    current_config: Arc<RwLock<Option<VersionedConfig>>>,
    /// Sync state
    sync_state: Arc<RwLock<SyncState>>,
    /// Event listeners
    event_listeners: Arc<RwLock<Vec<Box<dyn SyncEventListener + Send + Sync>>>>,
    /// Configuration for sync behavior
    sync_config: SyncConfiguration,
}

impl std::fmt::Debug for ConfigSyncEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ConfigSyncEngine")
            .field("device_info", &self.device_info)
            .field("device_keypair", &"<keypair>")
            .field("workspace_sync_key", &"<sync_key>")
            .field("transports", &format!("{} transport(s)", self.transports.try_read().map(|t| t.len()).unwrap_or(0)))
            .field("storage", &"<storage>")
            .field("current_config", &"<config>")
            .field("sync_state", &self.sync_state)
            .field("event_listeners", &format!("{} listener(s)", self.event_listeners.try_read().map(|l| l.len()).unwrap_or(0)))
            .field("sync_config", &self.sync_config)
            .finish()
    }
}

/// Device information for sync identification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    /// Unique device identifier
    pub device_id: String,
    /// Human-readable device name
    pub device_name: String,
    /// Device type (desktop, mobile, web)
    pub device_type: DeviceType,
    /// Platform information
    pub platform: PlatformInfo,
    /// Device capabilities
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeviceType {
    Desktop,
    Mobile,
    Web,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    /// Operating system
    pub os: String,
    /// OS version
    pub version: String,
    /// CPU architecture
    pub arch: String,
}

/// Versioned configuration with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedConfig {
    /// The configuration data
    pub config: serde_json::Value,
    /// Vector clock for conflict detection
    pub vector_clock: VectorClock,
    /// Schema version
    pub schema_version: String,
    /// Last modified device
    pub modified_by: String,
    /// Last modified timestamp
    pub modified_at: DateTime<Utc>,
    /// Configuration hash for integrity checking
    pub config_hash: String,
}

/// Synchronization state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    /// Current sync status
    pub status: SyncStatus,
    /// Last successful sync timestamp
    pub last_sync: Option<DateTime<Utc>>,
    /// Last sync error
    pub last_error: Option<SyncError>,
    /// Sync statistics
    pub stats: SyncStats,
    /// Pending operations
    pub pending_operations: Vec<PendingOperation>,
    /// Detected conflicts
    pub conflicts: Vec<ConfigConflict>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStatus {
    Idle,
    Syncing,
    Error,
    Paused,
    Conflict,
}

/// Conflict detection result for VersionedConfig
#[derive(Debug, Clone)]
pub enum ConfigConflictResult {
    /// No conflict - one version is clearly newer
    NoConflict(VersionedConfig),
    /// Conflict detected - both versions are concurrent
    Conflict {
        local: VersionedConfig,
        remote: VersionedConfig,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncError {
    pub message: String,
    pub code: String,
    pub timestamp: DateTime<Utc>,
    pub transport: Option<String>,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub total_syncs: u64,
    pub successful_syncs: u64,
    pub failed_syncs: u64,
    pub conflicts_resolved: u64,
    pub last_sync_duration_ms: u64,
    pub avg_sync_duration_ms: u64,
    pub bytes_synced: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOperation {
    pub id: String,
    pub operation_type: OperationType,
    pub config_path: String,
    pub timestamp: DateTime<Utc>,
    pub retry_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    Push,
    Pull,
    Merge,
    Backup,
}

/// Configuration conflict information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigConflict {
    pub id: String,
    pub config_path: String,
    pub conflict_type: ConflictType,
    pub local_version: VersionedConfig,
    pub remote_version: VersionedConfig,
    pub detected_at: DateTime<Utc>,
    pub resolution: Option<ConflictResolution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictType {
    ConcurrentEdit,
    DeleteEdit,
    TypeMismatch,
    SchemaConflict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    UseLocal,
    UseRemote,
    Merge,
    Manual,
}

/// Sync configuration
#[derive(Debug, Clone)]
pub struct SyncConfiguration {
    /// Automatic sync enabled
    pub auto_sync: bool,
    /// Sync interval in seconds
    pub sync_interval_seconds: u64,
    /// Maximum retry attempts
    pub max_retries: u32,
    /// Retry backoff multiplier
    pub retry_backoff_multiplier: f64,
    /// Enable compression
    pub compression_enabled: bool,
    /// Conflict resolution strategy
    pub conflict_resolution: ConflictResolutionStrategy,
    /// Backup configuration
    pub backup_config: BackupConfiguration,
}

#[derive(Debug, Clone)]
pub enum ConflictResolutionStrategy {
    Manual,
    LastWriterWins,
    AutoMerge,
}

#[derive(Debug, Clone)]
pub struct BackupConfiguration {
    pub enabled: bool,
    pub max_backups: u32,
    pub backup_interval_hours: u32,
}

/// Sync transport trait for different synchronization methods
#[async_trait::async_trait]
pub trait SyncTransport {
    /// Transport identifier
    fn id(&self) -> &str;
    
    /// Transport display name
    fn name(&self) -> &str;
    
    /// Check if transport is available
    async fn is_available(&self) -> bool;
    
    /// Initialize the transport
    async fn initialize(&mut self) -> Result<()>;
    
    /// Push configuration to remote
    async fn push_config(&self, config: &VersionedConfig) -> Result<()>;
    
    /// Pull configuration from remote
    async fn pull_config(&self) -> Result<Option<VersionedConfig>>;
    
    /// List available configurations
    async fn list_configs(&self) -> Result<Vec<ConfigMetadata>>;
    
    /// Delete configuration from remote
    async fn delete_config(&self, config_id: &str) -> Result<()>;
    
    /// Get transport-specific status
    async fn get_status(&self) -> Result<TransportStatus>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMetadata {
    pub id: String,
    pub schema_version: String,
    pub modified_by: String,
    pub modified_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportStatus {
    pub connected: bool,
    pub last_activity: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Configuration storage trait
#[async_trait::async_trait]
pub trait ConfigStorage: std::fmt::Debug {
    /// Save configuration to local storage
    async fn save_config(&self, config: &VersionedConfig) -> Result<()>;
    
    /// Load configuration from local storage
    async fn load_config(&self) -> Result<Option<VersionedConfig>>;
    
    /// Save encrypted secrets
    async fn save_secrets(&self, secrets: &[u8]) -> Result<()>;
    
    /// Load encrypted secrets
    async fn load_secrets(&self) -> Result<Option<Vec<u8>>>;
    
    /// Create backup of current configuration
    async fn create_backup(&self, config: &VersionedConfig) -> Result<String>;
    
    /// List available backups
    async fn list_backups(&self) -> Result<Vec<BackupInfo>>;
    
    /// Restore from backup
    async fn restore_backup(&self, backup_id: &str) -> Result<VersionedConfig>;
    
    /// Delete backup
    async fn delete_backup(&self, backup_id: &str) -> Result<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub description: String,
}

/// Sync event listener trait
pub trait SyncEventListener {
    fn on_sync_started(&self, transport_id: &str);
    fn on_sync_progress(&self, progress: SyncProgress);
    fn on_sync_completed(&self, result: SyncResult);
    fn on_conflict_detected(&self, conflict: &ConfigConflict);
    fn on_error(&self, error: &SyncError);
}

#[derive(Debug, Clone)]
pub struct SyncProgress {
    pub transport_id: String,
    pub operation: String,
    pub progress_percent: f32,
    pub bytes_transferred: u64,
    pub estimated_remaining_ms: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct SyncResult {
    pub transport_id: String,
    pub success: bool,
    pub duration_ms: u64,
    pub bytes_transferred: u64,
    pub conflicts_detected: u32,
    pub error: Option<SyncError>,
}

impl ConfigSyncEngine {
    /// Create a new ConfigSyncEngine
    pub fn new(
        device_info: DeviceInfo,
        storage: Arc<dyn ConfigStorage + Send + Sync>,
        sync_config: SyncConfiguration,
    ) -> Self {
        let device_keypair = X25519KeyPair::generate();
        
        Self {
            device_info,
            device_keypair,
            workspace_sync_key: Arc::new(RwLock::new(None)),
            transports: Arc::new(RwLock::new(HashMap::new())),
            storage,
            current_config: Arc::new(RwLock::new(None)),
            sync_state: Arc::new(RwLock::new(SyncState {
                status: SyncStatus::Idle,
                last_sync: None,
                last_error: None,
                stats: SyncStats {
                    total_syncs: 0,
                    successful_syncs: 0,
                    failed_syncs: 0,
                    conflicts_resolved: 0,
                    last_sync_duration_ms: 0,
                    avg_sync_duration_ms: 0,
                    bytes_synced: 0,
                },
                pending_operations: Vec::new(),
                conflicts: Vec::new(),
            })),
            event_listeners: Arc::new(RwLock::new(Vec::new())),
            sync_config,
        }
    }
    
    /// Initialize the sync engine
    pub async fn initialize(&mut self) -> Result<()> {
        // Load existing configuration
        if let Some(config) = self.storage.load_config().await? {
            *self.current_config.write().await = Some(config);
        }
        
        // Initialize transports
        let mut transports = self.transports.write().await;
        for transport in transports.values_mut() {
            if let Err(e) = transport.initialize().await {
                eprintln!("Failed to initialize transport {}: {}", transport.id(), e);
            }
        }
        
        Ok(())
    }
    
    /// Set workspace sync key
    pub async fn set_workspace_sync_key(&self, key: ChaChaKey) {
        *self.workspace_sync_key.write().await = Some(key);
    }
    
    /// Add a sync transport
    pub async fn add_transport(&self, transport: Box<dyn SyncTransport + Send + Sync>) {
        let id = transport.id().to_string();
        self.transports.write().await.insert(id, transport);
    }
    
    /// Remove a sync transport
    pub async fn remove_transport(&self, transport_id: &str) {
        self.transports.write().await.remove(transport_id);
    }
    
    /// Add event listener
    pub async fn add_event_listener(&self, listener: Box<dyn SyncEventListener + Send + Sync>) {
        self.event_listeners.write().await.push(listener);
    }
    
    /// Update configuration
    pub async fn update_config(&self, config: serde_json::Value) -> Result<()> {
        let config_str = serde_json::to_string(&config)?;
        let config_hash = hash_to_hex(config_str.as_bytes());
        
        let mut vector_clock = if let Some(current) = self.current_config.read().await.as_ref() {
            let mut clock = current.vector_clock.clone();
            clock.increment(&self.device_info.device_id);
            clock
        } else {
            VectorClock::with_device(self.device_info.device_id.clone())
        };
        
        let versioned_config = VersionedConfig {
            config,
            vector_clock,
            schema_version: "1.0.0".to_string(),
            modified_by: self.device_info.device_id.clone(),
            modified_at: Utc::now(),
            config_hash,
        };
        
        // Save locally
        self.storage.save_config(&versioned_config).await?;
        *self.current_config.write().await = Some(versioned_config);
        
        // Trigger sync if auto-sync is enabled
        if self.sync_config.auto_sync {
            tokio::spawn(async move {
                // Auto-sync implementation would go here
            });
        }
        
        Ok(())
    }
    
    /// Perform full synchronization
    pub async fn sync(&self) -> Result<SyncResult> {
        let start_time = std::time::Instant::now();
        let mut sync_state = self.sync_state.write().await;
        sync_state.status = SyncStatus::Syncing;
        sync_state.stats.total_syncs += 1;
        drop(sync_state);
        
        // Notify listeners
        for listener in self.event_listeners.read().await.iter() {
            listener.on_sync_started("all");
        }
        
        let mut total_bytes = 0u64;
        let mut conflicts_detected = 0u32;
        let mut last_error = None;
        
        // Sync with all available transports
        let transports = self.transports.read().await;
        for (transport_id, transport) in transports.iter() {
            if !transport.is_available().await {
                continue;
            }
            
            match self.sync_with_transport(transport.as_ref()).await {
                Ok(bytes) => {
                    total_bytes += bytes;
                }
                Err(e) => {
                    last_error = Some(SyncError {
                        message: e.to_string(),
                        code: "TRANSPORT_ERROR".to_string(),
                        timestamp: Utc::now(),
                        transport: Some(transport_id.clone()),
                        retryable: true,
                    });
                }
            }
        }
        
        let duration = start_time.elapsed();
        let duration_ms = duration.as_millis() as u64;
        
        // Update sync state
        let mut sync_state = self.sync_state.write().await;
        sync_state.status = if last_error.is_some() { SyncStatus::Error } else { SyncStatus::Idle };
        sync_state.last_sync = Some(Utc::now());
        sync_state.last_error = last_error.clone();
        sync_state.stats.last_sync_duration_ms = duration_ms;
        sync_state.stats.bytes_synced += total_bytes;
        
        if last_error.is_none() {
            sync_state.stats.successful_syncs += 1;
        } else {
            sync_state.stats.failed_syncs += 1;
        }
        
        // Update average sync duration
        let total_syncs = sync_state.stats.total_syncs;
        sync_state.stats.avg_sync_duration_ms = 
            (sync_state.stats.avg_sync_duration_ms * (total_syncs - 1) + duration_ms) / total_syncs;
        
        drop(sync_state);
        
        let result = SyncResult {
            transport_id: "all".to_string(),
            success: last_error.is_none(),
            duration_ms,
            bytes_transferred: total_bytes,
            conflicts_detected,
            error: last_error,
        };
        
        // Notify listeners
        for listener in self.event_listeners.read().await.iter() {
            listener.on_sync_completed(result.clone());
        }
        
        Ok(result)
    }
    
    /// Sync with a specific transport
    async fn sync_with_transport(&self, transport: &dyn SyncTransport) -> Result<u64> {
        let current_config = self.current_config.read().await.clone();
        
        // Pull remote config
        if let Some(remote_config) = transport.pull_config().await? {
            if let Some(local_config) = &current_config {
                // Check for conflicts
                let conflict_result = self.detect_config_conflict(local_config, &remote_config);
                match conflict_result {
                    ConfigConflictResult::NoConflict(winner) => {
                        if winner.vector_clock != local_config.vector_clock {
                            // Remote version is newer, update local
                            self.storage.save_config(&winner).await?;
                            *self.current_config.write().await = Some(winner);
                        }
                    }
                    ConfigConflictResult::Conflict { local, remote } => {
                        // Handle conflict
                        let conflict = ConfigConflict {
                            id: generate_id(),
                            config_path: "root".to_string(),
                            conflict_type: ConflictType::ConcurrentEdit,
                            local_version: local,
                            remote_version: remote,
                            detected_at: Utc::now(),
                            resolution: None,
                        };
                        
                        self.sync_state.write().await.conflicts.push(conflict.clone());
                        
                        // Notify listeners
                        for listener in self.event_listeners.read().await.iter() {
                            listener.on_conflict_detected(&conflict);
                        }
                    }
                }
            } else {
                // No local config, use remote
                self.storage.save_config(&remote_config).await?;
                *self.current_config.write().await = Some(remote_config);
            }
        }
        
        // Push local config if we have one
        if let Some(local_config) = &current_config {
            transport.push_config(local_config).await?;
        }
        
        // Return estimated bytes transferred (simplified)
        Ok(1024) // Placeholder
    }
    
    /// Detect conflicts between VersionedConfig instances
    fn detect_config_conflict(&self, local: &VersionedConfig, remote: &VersionedConfig) -> ConfigConflictResult {
        match local.vector_clock.compare(&remote.vector_clock) {
            ClockComparison::Equal | ClockComparison::Before => {
                ConfigConflictResult::NoConflict(remote.clone())
            }
            ClockComparison::After => {
                ConfigConflictResult::NoConflict(local.clone())
            }
            ClockComparison::Concurrent => {
                ConfigConflictResult::Conflict {
                    local: local.clone(),
                    remote: remote.clone(),
                }
            }
        }
    }
    
    /// Resolve a configuration conflict
    pub async fn resolve_conflict(&self, conflict_id: &str, resolution: ConflictResolution) -> Result<()> {
        let mut sync_state = self.sync_state.write().await;
        
        if let Some(conflict) = sync_state.conflicts.iter_mut().find(|c| c.id == conflict_id) {
            match resolution {
                ConflictResolution::UseLocal => {
                    *self.current_config.write().await = Some(conflict.local_version.clone());
                    self.storage.save_config(&conflict.local_version).await?;
                }
                ConflictResolution::UseRemote => {
                    *self.current_config.write().await = Some(conflict.remote_version.clone());
                    self.storage.save_config(&conflict.remote_version).await?;
                }
                ConflictResolution::Merge => {
                    // Implement merge logic
                    return Err(anyhow!("Merge resolution not yet implemented"));
                }
                ConflictResolution::Manual => {
                    // Manual resolution handled externally
                }
            }
            
            conflict.resolution = Some(resolution);
            sync_state.stats.conflicts_resolved += 1;
        } else {
            return Err(anyhow!("Conflict not found: {}", conflict_id));
        }
        
        Ok(())
    }
    
    /// Get current sync state
    pub async fn get_sync_state(&self) -> SyncState {
        self.sync_state.read().await.clone()
    }
    
    /// Get current configuration
    pub async fn get_current_config(&self) -> Option<VersionedConfig> {
        self.current_config.read().await.clone()
    }
    
    /// Create a backup of current configuration
    pub async fn create_backup(&self, description: Option<String>) -> Result<String> {
        if let Some(config) = self.current_config.read().await.as_ref() {
            let backup_id = self.storage.create_backup(config).await?;
            Ok(backup_id)
        } else {
            Err(anyhow!("No configuration to backup"))
        }
    }
    
    /// List available backups
    pub async fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        self.storage.list_backups().await
    }
    
    /// Restore configuration from backup
    pub async fn restore_backup(&self, backup_id: &str) -> Result<()> {
        let config = self.storage.restore_backup(backup_id).await?;
        *self.current_config.write().await = Some(config.clone());
        self.storage.save_config(&config).await?;
        Ok(())
    }
}

impl Default for SyncConfiguration {
    fn default() -> Self {
        Self {
            auto_sync: true,
            sync_interval_seconds: 300, // 5 minutes
            max_retries: 3,
            retry_backoff_multiplier: 2.0,
            compression_enabled: true,
            conflict_resolution: ConflictResolutionStrategy::Manual,
            backup_config: BackupConfiguration {
                enabled: true,
                max_backups: 10,
                backup_interval_hours: 24,
            },
        }
    }
}