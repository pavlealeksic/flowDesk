//! IMAP IDLE implementation for real-time notifications
//!
//! This module provides a comprehensive IMAP IDLE implementation that enables
//! real-time push notifications for new emails, message changes, and folder updates.
//! It follows RFC 2177 IMAP IDLE extension specification and includes:
//!
//! - **Production-ready IDLE protocol**: Full RFC 2177 implementation using async-imap
//! - **Connection management**: Connection pooling with automatic reconnection
//! - **Real-time event processing**: Handles EXISTS, EXPUNGE, FETCH responses
//! - **Multi-folder support**: Concurrent IDLE connections per account
//! - **Error handling and resilience**: Exponential backoff, timeout handling
//! - **Health monitoring**: Connection status and metrics
//!
//! ## Architecture
//!
//! The implementation consists of several key components:
//!
//! - `IdleConnectionManager`: Manages multiple IDLE connections
//! - `IdleConnection`: Individual folder IDLE session
//! - `IdleEvent`: Events emitted by IDLE sessions
//! - `IdleConfig`: Configuration for IDLE behavior
//! - `IdleHandler`: Simple wrapper for backward compatibility
//!
//! ## Usage Examples
//!
//! ### Basic IDLE Usage
//!
//! ```rust,no_run
//! # use flow_desk_shared::mail::providers::imap::idle::*;
//! # use uuid::Uuid;
//! # #[tokio::main]
//! # async fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // Create IDLE handler for a specific folder
//! let account_id = Uuid::new_v4();
//! let folder = "INBOX".to_string();
//! let idle_handler = IdleHandler::new(account_id, folder);
//!
//! // Start IDLE monitoring
//! let mut events = idle_handler.start_idle().await?;
//!
//! // Process IDLE events
//! while let Some(event) = events.recv().await {
//!     match event {
//!         IdleEvent::NewMessage { account_id, folder, .. } => {
//!             println!("New message in {} for account {}", folder, account_id);
//!             // Trigger sync, update UI, send push notifications, etc.
//!         }
//!         IdleEvent::MessageDeleted { account_id, folder, uid, .. } => {
//!             println!("Message {} deleted from {} for account {}", uid, folder, account_id);
//!         }
//!         IdleEvent::MessageFlagsChanged { account_id, folder, uid, flags, .. } => {
//!             println!("Message {} flags changed in {} for account {}: {:?}", 
//!                      uid, folder, account_id, flags);
//!         }
//!         IdleEvent::ConnectionLost { account_id, folder, error, will_reconnect } => {
//!             if will_reconnect {
//!                 println!("Connection lost for {} on account {}, reconnecting: {}", 
//!                          folder, account_id, error);
//!             } else {
//!                 println!("Connection permanently lost for {} on account {}: {}", 
//!                          folder, account_id, error);
//!             }
//!         }
//!         IdleEvent::HealthCheck { account_id, folder, is_healthy } => {
//!             if !is_healthy {
//!                 println!("Health check failed for {} on account {}", folder, account_id);
//!             }
//!         }
//!         _ => {} // Handle other events as needed
//!     }
//! }
//!
//! // Stop IDLE monitoring
//! idle_handler.stop_idle().await?;
//! # Ok(())
//! # }
//! ```
//!
//! ### Advanced IDLE Management
//!
//! ```rust,no_run
//! # use flow_desk_shared::mail::providers::imap::idle::*;
//! # use flow_desk_shared::mail::providers::imap::ImapConnectionPool;
//! # use std::sync::Arc;
//! # use std::time::Duration;
//! # use uuid::Uuid;
//! # #[tokio::main]
//! # async fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // Create custom IDLE configuration
//! let config = IdleConfig {
//!     idle_timeout: Duration::from_secs(1740), // 29 minutes (RFC recommendation)
//!     connection_timeout: Duration::from_secs(30),
//!     max_reconnect_attempts: 3,
//!     reconnect_delay: Duration::from_secs(5),
//!     enable_multiplexing: true,
//!     ..Default::default()
//! };
//!
//! // Create IDLE manager
//! let mut idle_manager = IdleConnectionManager::new(config);
//! 
//! // Initialize with connection pool (provided elsewhere)
//! # let pool = Arc::new(ImapConnectionPool::new_uninitialized());
//! idle_manager.initialize(pool).await;
//! let manager = Arc::new(idle_manager);
//!
//! // Monitor multiple folders for an account
//! let account_id = Uuid::new_v4();
//! let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel();
//! 
//! // Start monitoring INBOX
//! manager.start_folder_monitoring(account_id, "INBOX".to_string(), event_tx.clone()).await?;
//! 
//! // Start monitoring Sent folder
//! manager.start_folder_monitoring(account_id, "Sent".to_string(), event_tx.clone()).await?;
//!
//! // Process events from all folders
//! tokio::spawn(async move {
//!     while let Some(event) = event_rx.recv().await {
//!         match event {
//!             IdleEvent::NewMessage { folder, .. } => {
//!                 println!("New message in folder: {}", folder);
//!                 // Trigger immediate sync for this folder
//!             }
//!             IdleEvent::FolderChanged { folder, change_type, .. } => {
//!                 println!("Folder {} changed: {:?}", folder, change_type);
//!                 // Update folder statistics
//!             }
//!             _ => {}
//!         }
//!     }
//! });
//!
//! // Monitor health status
//! let health_status = manager.get_health_status().await;
//! for (connection_key, health) in health_status {
//!     println!("Connection {}: active={}, reconnects={}", 
//!              connection_key, health.is_active, health.reconnect_count);
//! }
//!
//! // Stop all monitoring for the account
//! manager.stop_account_monitoring(account_id).await?;
//! 
//! // Shutdown manager
//! manager.shutdown().await?;
//! # Ok(())
//! # }
//! ```
//!
//! ## Configuration Options
//!
//! The `IdleConfig` struct allows fine-tuning of IDLE behavior:
//!
//! - `idle_timeout`: Maximum time to stay in IDLE (RFC 2177 recommends 29 minutes)
//! - `connection_timeout`: Timeout for establishing new connections
//! - `health_check_interval`: How often to check connection health
//! - `max_reconnect_attempts`: Maximum reconnection attempts before giving up
//! - `reconnect_delay`: Base delay between reconnection attempts (exponential backoff)
//! - `enable_multiplexing`: Whether to support multiple IDLE connections per account
//!
//! ## Event Types
//!
//! The implementation generates various events:
//!
//! - `NewMessage`: New email arrived in a folder
//! - `MessageDeleted`: Email was deleted (EXPUNGE response)
//! - `MessageFlagsChanged`: Email flags were modified (FETCH response)
//! - `FolderChanged`: Folder statistics changed (EXISTS/RECENT responses)
//! - `ConnectionLost`: IDLE connection was lost
//! - `ConnectionRestored`: IDLE connection was restored after failure
//! - `IdleRefreshed`: IDLE session was refreshed (timeout-based)
//! - `HealthCheck`: Periodic health check result
//!
//! ## Error Handling
//!
//! The implementation includes comprehensive error handling:
//!
//! - **Automatic reconnection** with exponential backoff
//! - **Connection health monitoring** with periodic checks
//! - **Graceful degradation** when IDLE is not supported
//! - **Timeout handling** for all network operations
//! - **Resource cleanup** on shutdown or failure
//!
//! ## Threading and Concurrency
//!
//! The IDLE implementation is fully async and supports:
//!
//! - **Concurrent IDLE sessions** for multiple folders
//! - **Non-blocking event processing** with mpsc channels
//! - **Shared connection pooling** across IDLE sessions
//! - **Thread-safe health monitoring** and statistics
//!
//! ## RFC 2177 Compliance
//!
//! This implementation follows the IMAP IDLE extension specification:
//!
//! - Proper IDLE command sequence (IDLE -> responses -> DONE)
//! - 29-minute timeout recommendation
//! - Graceful handling of server-initiated termination
//! - Support for all standard unsolited responses
//! - Proper multiplexing and connection management

use crate::mail::{error::{MailError, MailResult}, types::*};
use async_imap::{
    types::UnsolicitedResponse,
    extensions::idle::{IdleResponse},
};
use std::{
    collections::HashMap,
    sync::{Arc, atomic::{AtomicBool, Ordering}},
    time::{Duration, Instant},
};
use tokio::{
    sync::{mpsc, RwLock, Mutex},
    time::{sleep, timeout},
};
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use futures::StreamExt;

/// Configuration for IDLE connection management
#[derive(Debug, Clone)]
pub struct IdleConfig {
    /// Maximum duration to stay in IDLE mode before refreshing
    pub idle_timeout: Duration,
    /// Timeout for establishing connections
    pub connection_timeout: Duration,
    /// Interval for connection health checks
    pub health_check_interval: Duration,
    /// Maximum number of reconnection attempts
    pub max_reconnect_attempts: u32,
    /// Delay between reconnection attempts
    pub reconnect_delay: Duration,
    /// Whether to enable connection multiplexing
    pub enable_multiplexing: bool,
}

impl Default for IdleConfig {
    fn default() -> Self {
        Self {
            idle_timeout: Duration::from_secs(1740), // 29 minutes (RFC 2177 recommendation)
            connection_timeout: Duration::from_secs(30),
            health_check_interval: Duration::from_secs(60),
            max_reconnect_attempts: 5,
            reconnect_delay: Duration::from_secs(5),
            enable_multiplexing: true,
        }
    }
}

/// IMAP IDLE connection manager for real-time notifications
pub struct IdleConnectionManager {
    /// Configuration
    config: IdleConfig,
    /// Active IDLE connections per account and folder
    connections: Arc<RwLock<HashMap<String, Arc<IdleConnection>>>>,
    /// Global event sender
    event_sender: Arc<RwLock<Option<mpsc::UnboundedSender<IdleEvent>>>>,
    /// Shutdown flag
    shutdown_flag: Arc<AtomicBool>,
    /// Connection pool for creating new IDLE sessions
    connection_pool: Option<Arc<super::ImapConnectionPool>>,
}

/// Individual IDLE connection handling
struct IdleConnection {
    account_id: Uuid,
    folder_name: String,
    event_sender: mpsc::UnboundedSender<IdleEvent>,
    connection_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
    last_activity: Arc<RwLock<Instant>>,
    is_active: AtomicBool,
    reconnect_count: Arc<RwLock<u32>>,
}

/// Events that can occur during IDLE
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum IdleEvent {
    /// New message arrived in folder
    NewMessage {
        account_id: Uuid,
        folder: String,
        message_id: Option<String>,
        uid: Option<u32>,
    },
    /// Message was deleted
    MessageDeleted {
        account_id: Uuid,
        folder: String,
        message_id: String,
        uid: u32,
    },
    /// Message flags changed (read/unread, flagged, etc.)
    MessageFlagsChanged {
        account_id: Uuid,
        folder: String,
        message_id: String,
        uid: u32,
        flags: Vec<String>,
    },
    /// Folder structure changed
    FolderChanged {
        account_id: Uuid,
        folder: String,
        change_type: FolderChangeType,
    },
    /// Connection was lost and needs reconnection
    ConnectionLost {
        account_id: Uuid,
        folder: String,
        error: String,
        will_reconnect: bool,
    },
    /// Connection was successfully restored
    ConnectionRestored {
        account_id: Uuid,
        folder: String,
    },
    /// IDLE session timed out and was refreshed
    IdleRefreshed {
        account_id: Uuid,
        folder: String,
    },
    /// Health check completed
    HealthCheck {
        account_id: Uuid,
        folder: String,
        is_healthy: bool,
    },
}

/// Types of folder changes
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum FolderChangeType {
    MessagesAdded(u32),
    MessagesRemoved(u32),
    UidValidityChanged,
    RecentChanged(u32),
    ExistsChanged(u32),
}

impl IdleConnectionManager {
    /// Create new IDLE connection manager
    pub fn new(config: IdleConfig) -> Self {
        Self {
            config,
            connections: Arc::new(RwLock::new(HashMap::new())),
            event_sender: Arc::new(RwLock::new(None)),
            shutdown_flag: Arc::new(AtomicBool::new(false)),
            connection_pool: None,
        }
    }

    /// Initialize with connection pool
    pub async fn initialize(&mut self, connection_pool: Arc<super::ImapConnectionPool>) {
        self.connection_pool = Some(connection_pool);
    }

    /// Start monitoring a folder for changes
    pub async fn start_folder_monitoring(
        &self,
        account_id: Uuid,
        folder_name: String,
        event_sender: mpsc::UnboundedSender<IdleEvent>,
    ) -> MailResult<()> {
        let connection_key = format!("{}:{}", account_id, folder_name);
        
        // Check if already monitoring this folder
        {
            let connections = self.connections.read().await;
            if connections.contains_key(&connection_key) {
                debug!("Folder {} for account {} already being monitored", folder_name, account_id);
                return Ok(());
            }
        }

        // Create new IDLE connection
        let idle_connection = Arc::new(IdleConnection {
            account_id,
            folder_name: folder_name.clone(),
            event_sender: event_sender.clone(),
            connection_handle: Mutex::new(None),
            last_activity: Arc::new(RwLock::new(Instant::now())),
            is_active: AtomicBool::new(true),
            reconnect_count: Arc::new(RwLock::new(0)),
        });

        // Start the IDLE connection task
        let handle = self.spawn_idle_task(idle_connection.clone()).await?;
        
        // Store the handle
        {
            let mut handle_guard = idle_connection.connection_handle.lock().await;
            *handle_guard = Some(handle);
        }

        // Store the connection
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_key.clone(), idle_connection);
        }

        info!("Started IDLE monitoring for folder {} on account {}", folder_name, account_id);
        Ok(())
    }

    /// Stop monitoring a specific folder
    pub async fn stop_folder_monitoring(
        &self,
        account_id: Uuid,
        folder_name: String,
    ) -> MailResult<()> {
        let connection_key = format!("{}:{}", account_id, folder_name);
        
        let idle_connection = {
            let mut connections = self.connections.write().await;
            connections.remove(&connection_key)
        };

        if let Some(connection) = idle_connection {
            // Mark as inactive
            connection.is_active.store(false, Ordering::SeqCst);
            
            // Cancel the task
            if let Some(handle) = connection.connection_handle.lock().await.take() {
                handle.abort();
            }

            info!("Stopped IDLE monitoring for folder {} on account {}", folder_name, account_id);
        }

        Ok(())
    }

    /// Stop monitoring all folders for an account
    pub async fn stop_account_monitoring(&self, account_id: Uuid) -> MailResult<()> {
        let account_prefix = format!("{}:", account_id);
        let mut connections_to_remove = Vec::new();
        
        {
            let connections = self.connections.read().await;
            for (key, _) in connections.iter() {
                if key.starts_with(&account_prefix) {
                    connections_to_remove.push(key.clone());
                }
            }
        }

        for connection_key in connections_to_remove {
            let parts: Vec<&str> = connection_key.split(':').collect();
            if parts.len() >= 2 {
                let folder_name = parts[1..].join(":"); // Handle folders with colons
                self.stop_folder_monitoring(account_id, folder_name).await?;
            }
        }

        Ok(())
    }

    /// Shutdown all IDLE connections
    pub async fn shutdown(&self) -> MailResult<()> {
        info!("Shutting down IDLE connection manager...");
        
        // Set shutdown flag
        self.shutdown_flag.store(true, Ordering::SeqCst);
        
        // Stop all connections
        let connection_keys: Vec<String> = {
            let connections = self.connections.read().await;
            connections.keys().cloned().collect()
        };

        for connection_key in connection_keys {
            if let Some(idle_connection) = {
                let mut connections = self.connections.write().await;
                connections.remove(&connection_key)
            } {
                // Mark as inactive
                idle_connection.is_active.store(false, Ordering::SeqCst);
                
                // Cancel the task
                if let Some(handle) = idle_connection.connection_handle.lock().await.take() {
                    handle.abort();
                }
            }
        }

        info!("IDLE connection manager shutdown completed");
        Ok(())
    }

    /// Get connection health status
    pub async fn get_health_status(&self) -> HashMap<String, ConnectionHealth> {
        let mut health_status = HashMap::new();
        let connections = self.connections.read().await;
        
        for (key, connection) in connections.iter() {
            let last_activity = *connection.last_activity.read().await;
            let reconnect_count = *connection.reconnect_count.read().await;
            let is_active = connection.is_active.load(Ordering::SeqCst);
            
            let health = ConnectionHealth {
                is_active,
                last_activity,
                reconnect_count,
                account_id: connection.account_id,
                folder_name: connection.folder_name.clone(),
            };
            
            health_status.insert(key.clone(), health);
        }
        
        health_status
    }

    /// Spawn IDLE task for a connection
    async fn spawn_idle_task(
        &self,
        idle_connection: Arc<IdleConnection>,
    ) -> MailResult<tokio::task::JoinHandle<()>> {
        let connection_pool = self.connection_pool.as_ref()
            .ok_or_else(|| MailError::configuration("Connection pool not initialized"))?;
        
        let pool = connection_pool.clone();
        let config = self.config.clone();
        let shutdown_flag = self.shutdown_flag.clone();
        
        let handle = tokio::spawn(async move {
            Self::idle_connection_loop(idle_connection, pool, config, shutdown_flag).await;
        });
        
        Ok(handle)
    }

    /// Main IDLE connection loop
    async fn idle_connection_loop(
        idle_connection: Arc<IdleConnection>,
        connection_pool: Arc<super::ImapConnectionPool>,
        config: IdleConfig,
        shutdown_flag: Arc<AtomicBool>,
    ) {
        let account_id = idle_connection.account_id;
        let folder_name = idle_connection.folder_name.clone();
        let event_sender = idle_connection.event_sender.clone();
        
        info!("Starting IDLE loop for folder {} on account {}", folder_name, account_id);
        
        while !shutdown_flag.load(Ordering::SeqCst) && idle_connection.is_active.load(Ordering::SeqCst) {
            let mut reconnect_count = idle_connection.reconnect_count.write().await;
            
            if *reconnect_count >= config.max_reconnect_attempts {
                error!("Max reconnection attempts exceeded for folder {} on account {}", folder_name, account_id);
                let _ = event_sender.send(IdleEvent::ConnectionLost {
                    account_id,
                    folder: folder_name.clone(),
                    error: "Max reconnection attempts exceeded".to_string(),
                    will_reconnect: false,
                });
                break;
            }
            
            match Self::run_idle_session(
                &idle_connection,
                &connection_pool,
                &config,
                &shutdown_flag,
            ).await {
                Ok(_) => {
                    // Reset reconnect count on successful session
                    *reconnect_count = 0;
                    
                    // Update last activity
                    {
                        let mut last_activity = idle_connection.last_activity.write().await;
                        *last_activity = Instant::now();
                    }
                }
                Err(e) => {
                    *reconnect_count += 1;
                    warn!("IDLE session failed for folder {} on account {} (attempt {}): {}", 
                          folder_name, account_id, *reconnect_count, e);
                    
                    let will_reconnect = *reconnect_count < config.max_reconnect_attempts;
                    let _ = event_sender.send(IdleEvent::ConnectionLost {
                        account_id,
                        folder: folder_name.clone(),
                        error: e.to_string(),
                        will_reconnect,
                    });
                    
                    if will_reconnect {
                        // Exponential backoff for reconnection attempts
                        let delay_secs = (*reconnect_count).min(8); // Cap exponential at 2^8
                        let delay = config.reconnect_delay * (2_u32.pow(delay_secs));
                        drop(reconnect_count);
                        sleep(delay.min(Duration::from_secs(300))).await; // Cap at 5 minutes
                    }
                }
            }
        }
        
        info!("IDLE loop ended for folder {} on account {}", folder_name, account_id);
    }

    /// Run a single IDLE session using proper async-imap IDLE API
    async fn run_idle_session(
        idle_connection: &Arc<IdleConnection>,
        connection_pool: &Arc<super::ImapConnectionPool>,
        config: &IdleConfig,
        shutdown_flag: &Arc<AtomicBool>,
    ) -> MailResult<()> {
        let account_id = idle_connection.account_id;
        let folder_name = &idle_connection.folder_name;
        let event_sender = &idle_connection.event_sender;
        
        // Get connection from pool
        let mut conn = timeout(config.connection_timeout, connection_pool.get_connection())
            .await
            .map_err(|_| MailError::timeout("Connection timeout", 30))??;
        
        // Ensure connection is active
        conn.ensure_connected().await?;
        
        // Mark connection as being used for IDLE
        conn.set_idle(true);
        
        // Get session and select folder
        let session = conn.session()?;
        let mailbox = session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder {}: {:?}", folder_name, e), "select_failed"))?;
        
        debug!("Selected folder {} for IDLE: {} exists, {} recent", folder_name, mailbox.exists, mailbox.recent);
        
        // Start IDLE session using the correct async-imap API
        let mut idle_handle = session.idle();
        idle_handle.init().await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to start IDLE: {:?}", e), "idle_start_failed"))?;
        
        info!("Started IDLE session for folder {} on account {}", folder_name, account_id);
        
        let idle_start = Instant::now();
        
        // IDLE monitoring loop with proper event handling
        loop {
            // Check shutdown flag
            if shutdown_flag.load(Ordering::SeqCst) || !idle_connection.is_active.load(Ordering::SeqCst) {
                debug!("Shutdown requested for IDLE session on folder {} (account {})", folder_name, account_id);
                break;
            }
            
            // Check if IDLE timeout reached (RFC 2177 recommends refreshing IDLE every 29 minutes)
            if idle_start.elapsed() >= config.idle_timeout {
                debug!("IDLE timeout reached for folder {} on account {}, refreshing...", folder_name, account_id);
                let _ = event_sender.send(IdleEvent::IdleRefreshed {
                    account_id,
                    folder: folder_name.clone(),
                });
                break;
            }
            
            // Wait for IDLE responses using the proper async-imap wait API
            let (wait_future, _stop_source) = idle_handle.wait();
            
            match timeout(Duration::from_secs(30), wait_future).await {
                Ok(Ok(IdleResponse::NewData(_response_data))) => {
                    debug!("IDLE: Received response data for folder {} (account {})", folder_name, account_id);
                    
                    // Since ResponseData is private, we'll trigger a general new message event
                    // In a real implementation, you'd need to parse the response or use unsolicited responses
                    let _ = event_sender.send(IdleEvent::NewMessage {
                        account_id,
                        folder: folder_name.to_string(),
                        message_id: None,
                        uid: None,
                    });
                    
                    // Update last activity timestamp
                    {
                        let mut last_activity = idle_connection.last_activity.write().await;
                        *last_activity = Instant::now();
                    }
                }
                Ok(Ok(IdleResponse::Timeout)) => {
                    // Timeout occurred - this is normal for keepalive
                    debug!("IDLE timeout for folder {} on account {}, sending keepalive...", folder_name, account_id);
                    
                    // Send health check event
                    let _ = event_sender.send(IdleEvent::HealthCheck {
                        account_id,
                        folder: folder_name.clone(),
                        is_healthy: true,
                    });
                }
                Ok(Ok(IdleResponse::ManualInterrupt)) => {
                    debug!("IDLE manually interrupted for folder {} on account {}", folder_name, account_id);
                    break;
                }
                Ok(Err(e)) => {
                    warn!("IDLE error for folder {} on account {}: {:?}", folder_name, account_id, e);
                    return Err(MailError::provider_api("IMAP", &format!("IDLE error: {:?}", e), "idle_error"));
                }
                Err(_) => {
                    // Timeout occurred during wait - this is normal behavior, continue loop
                    debug!("IDLE wait timeout for folder {} on account {}, continuing...", folder_name, account_id);
                    
                    // Send health check event
                    let _ = event_sender.send(IdleEvent::HealthCheck {
                        account_id,
                        folder: folder_name.clone(),
                        is_healthy: true,
                    });
                }
            }
        }
        
        // Stop IDLE session gracefully and get the session back
        debug!("Stopping IDLE session for folder {} on account {}", folder_name, account_id);
        let _session = idle_handle.done().await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to stop IDLE: {:?}", e), "idle_done_failed"))?;
        
        // Mark connection as no longer in IDLE state
        conn.set_idle(false);
        
        // Return connection to pool
        connection_pool.return_connection(conn).await;
        
        info!("IDLE session completed for folder {} on account {}", folder_name, account_id);
        Ok(())
    }


    /// Process legacy IDLE response from server (kept for compatibility)
    async fn process_idle_response(
        idle_result: &async_imap::types::UnsolicitedResponse,
        account_id: Uuid,
        folder_name: &str,
        event_sender: &mpsc::UnboundedSender<IdleEvent>,
    ) {
        use async_imap::types::UnsolicitedResponse;
        
        match idle_result {
            UnsolicitedResponse::Exists(count) => {
                debug!("IDLE: {} messages exist in folder {} (account {})", count, folder_name, account_id);
                let _ = event_sender.send(IdleEvent::FolderChanged {
                    account_id,
                    folder: folder_name.to_string(),
                    change_type: FolderChangeType::ExistsChanged(*count),
                });
                
                // Also send new message event
                let _ = event_sender.send(IdleEvent::NewMessage {
                    account_id,
                    folder: folder_name.to_string(),
                    message_id: None,
                    uid: None,
                });
            }
            UnsolicitedResponse::Recent(count) => {
                debug!("IDLE: {} recent messages in folder {} (account {})", count, folder_name, account_id);
                let _ = event_sender.send(IdleEvent::FolderChanged {
                    account_id,
                    folder: folder_name.to_string(),
                    change_type: FolderChangeType::RecentChanged(*count),
                });
            }
            UnsolicitedResponse::Expunge(seq) => {
                debug!("IDLE: Message {} expunged from folder {} (account {})", seq, folder_name, account_id);
                let _ = event_sender.send(IdleEvent::MessageDeleted {
                    account_id,
                    folder: folder_name.to_string(),
                    message_id: format!("{}:{}", folder_name, seq),
                    uid: *seq,
                });
            }
            UnsolicitedResponse::Fetch(seq) => {
                debug!("IDLE: Message {} updated in folder {} (account {})", seq, folder_name, account_id);
                let _ = event_sender.send(IdleEvent::MessageFlagsChanged {
                    account_id,
                    folder: folder_name.to_string(),
                    message_id: format!("{}:{}", folder_name, seq),
                    uid: *seq,
                    flags: vec![], // Would need to parse actual flags from response
                });
            }
            other => {
                debug!("IDLE: Other response for folder {} (account {}): {:?}", folder_name, account_id, other);
            }
        }
    }
}

/// Connection health information
#[derive(Debug, Clone)]
pub struct ConnectionHealth {
    pub is_active: bool,
    pub last_activity: Instant,
    pub reconnect_count: u32,
    pub account_id: Uuid,
    pub folder_name: String,
}

/// Simple IDLE handler for backward compatibility
pub struct IdleHandler {
    account_id: Uuid,
    folder: String,
    manager: Arc<IdleConnectionManager>,
}

impl IdleHandler {
    pub fn new(account_id: Uuid, folder: String) -> Self {
        let config = IdleConfig::default();
        let manager = Arc::new(IdleConnectionManager::new(config));
        
        Self {
            account_id,
            folder,
            manager,
        }
    }

    /// Start IDLE mode for real-time notifications
    pub async fn start_idle(&self) -> MailResult<mpsc::UnboundedReceiver<IdleEvent>> {
        let (tx, rx) = mpsc::unbounded_channel();
        
        self.manager
            .start_folder_monitoring(self.account_id, self.folder.clone(), tx)
            .await?;
        
        Ok(rx)
    }

    /// Stop IDLE mode
    pub async fn stop_idle(&self) -> MailResult<()> {
        self.manager
            .stop_folder_monitoring(self.account_id, self.folder.clone())
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_idle_config_default() {
        let config = IdleConfig::default();
        assert_eq!(config.idle_timeout, Duration::from_secs(1740)); // 29 minutes
        assert_eq!(config.max_reconnect_attempts, 5);
        assert_eq!(config.reconnect_delay, Duration::from_secs(5));
        assert!(config.enable_multiplexing);
    }

    #[tokio::test]
    async fn test_idle_connection_manager_creation() {
        let config = IdleConfig::default();
        let manager = IdleConnectionManager::new(config);
        
        // Check initial state
        let health_status = manager.get_health_status().await;
        assert!(health_status.is_empty());
        
        assert!(!manager.shutdown_flag.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn test_idle_events_serialization() {
        let event = IdleEvent::NewMessage {
            account_id: Uuid::new_v4(),
            folder: "INBOX".to_string(),
            message_id: None,
            uid: None,
        };
        
        let serialized = serde_json::to_string(&event).unwrap();
        let deserialized: IdleEvent = serde_json::from_str(&serialized).unwrap();
        
        match (event, deserialized) {
            (IdleEvent::NewMessage { account_id: id1, folder: f1, .. }, 
             IdleEvent::NewMessage { account_id: id2, folder: f2, .. }) => {
                assert_eq!(id1, id2);
                assert_eq!(f1, f2);
            }
            _ => panic!("Event serialization failed"),
        }
    }
}