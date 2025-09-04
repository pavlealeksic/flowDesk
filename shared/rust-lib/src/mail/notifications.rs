//! Real-time email notification system
//!
//! This module provides a comprehensive notification system for email events,
//! including push notifications, background sync triggering, and UI updates.

use crate::mail::{
    error::{MailError, MailResult},
    providers::imap::idle::{IdleEvent, IdleConnectionManager, IdleConfig},
    types::*,
};
use std::{
    collections::HashMap,
    sync::{Arc, atomic::{AtomicBool, Ordering}},
    time::{Duration, Instant},
};
use tokio::{
    sync::{mpsc, RwLock, Mutex},
    time::{interval, sleep},
};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Configuration for the notification system
#[derive(Debug, Clone)]
pub struct NotificationConfig {
    /// Maximum number of queued notifications
    pub max_queue_size: usize,
    /// Batch size for processing notifications
    pub batch_size: usize,
    /// Interval for batching notifications
    pub batch_interval: Duration,
    /// Whether to enable push notifications to UI
    pub enable_push_notifications: bool,
    /// Whether to enable background sync on new messages
    pub enable_background_sync: bool,
    /// Debounce time for sync operations
    pub sync_debounce_time: Duration,
    /// Maximum concurrent sync operations
    pub max_concurrent_syncs: u32,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            max_queue_size: 10000,
            batch_size: 50,
            batch_interval: Duration::from_millis(100),
            enable_push_notifications: true,
            enable_background_sync: true,
            sync_debounce_time: Duration::from_secs(1),
            max_concurrent_syncs: 5,
        }
    }
}

/// Email notification system
pub struct EmailNotificationSystem {
    /// Configuration
    config: NotificationConfig,
    /// IDLE connection manager
    idle_manager: Arc<IdleConnectionManager>,
    /// Event processor
    event_processor: Arc<EventProcessor>,
    /// Background sync coordinator
    sync_coordinator: Arc<SyncCoordinator>,
    /// Notification listeners
    listeners: Arc<RwLock<HashMap<String, NotificationListener>>>,
    /// System shutdown flag
    shutdown_flag: Arc<AtomicBool>,
    /// Main event loop handle
    event_loop_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

/// Event processor for handling IDLE events
struct EventProcessor {
    config: NotificationConfig,
    /// Queue for batching events
    event_queue: Arc<Mutex<Vec<ProcessedEvent>>>,
    /// Last batch time
    last_batch_time: Arc<RwLock<Instant>>,
}

/// Background sync coordinator
struct SyncCoordinator {
    /// Pending sync operations
    pending_syncs: Arc<RwLock<HashMap<Uuid, PendingSyncOperation>>>,
    /// Active sync operations
    active_syncs: Arc<RwLock<HashMap<Uuid, ActiveSyncOperation>>>,
    /// Sync debounce timers
    debounce_timers: Arc<RwLock<HashMap<Uuid, Instant>>>,
    /// Maximum concurrent syncs
    max_concurrent: u32,
}

/// Processed event for batching
#[derive(Debug, Clone)]
struct ProcessedEvent {
    pub event: IdleEvent,
    pub processed_at: Instant,
    pub requires_sync: bool,
    pub account_id: Uuid,
    pub folder: String,
}

/// Pending sync operation
#[derive(Debug, Clone)]
struct PendingSyncOperation {
    pub account_id: Uuid,
    pub folder: String,
    pub trigger_event: IdleEvent,
    pub scheduled_at: Instant,
}

/// Active sync operation
#[derive(Debug, Clone)]
struct ActiveSyncOperation {
    pub account_id: Uuid,
    pub folder: String,
    pub started_at: Instant,
    pub handle: Arc<tokio::task::JoinHandle<MailResult<()>>>,
}

/// Notification listener for UI updates
pub struct NotificationListener {
    /// Sender for UI notifications
    pub ui_sender: mpsc::UnboundedSender<UINotification>,
    /// Account filter (None for all accounts)
    pub account_filter: Option<Uuid>,
    /// Folder filter (None for all folders)
    pub folder_filter: Option<String>,
}

/// UI notification events
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum UINotification {
    /// New email arrived
    NewEmail {
        account_id: Uuid,
        folder: String,
        count: u32,
        preview: Option<EmailPreview>,
    },
    /// Email was deleted
    EmailDeleted {
        account_id: Uuid,
        folder: String,
        message_id: String,
    },
    /// Email flags changed
    EmailFlagsChanged {
        account_id: Uuid,
        folder: String,
        message_id: String,
        is_read: Option<bool>,
        is_starred: Option<bool>,
    },
    /// Folder counts updated
    FolderUpdated {
        account_id: Uuid,
        folder: String,
        total_count: u32,
        unread_count: u32,
    },
    /// Sync operation started
    SyncStarted {
        account_id: Uuid,
        folder: String,
    },
    /// Sync operation completed
    SyncCompleted {
        account_id: Uuid,
        folder: String,
        messages_synced: u32,
        success: bool,
        error: Option<String>,
    },
    /// Connection status changed
    ConnectionStatusChanged {
        account_id: Uuid,
        is_connected: bool,
        last_error: Option<String>,
    },
}

/// Email preview for notifications
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EmailPreview {
    pub subject: String,
    pub from: String,
    pub snippet: String,
    pub received_at: chrono::DateTime<chrono::Utc>,
}

impl EmailNotificationSystem {
    /// Create new email notification system
    pub async fn new(config: NotificationConfig) -> MailResult<Self> {
        let idle_config = IdleConfig::default();
        let idle_manager = Arc::new(IdleConnectionManager::new(idle_config));
        
        let event_processor = Arc::new(EventProcessor::new(config.clone()));
        let sync_coordinator = Arc::new(SyncCoordinator::new(config.max_concurrent_syncs));
        
        Ok(Self {
            config,
            idle_manager,
            event_processor,
            sync_coordinator,
            listeners: Arc::new(RwLock::new(HashMap::new())),
            shutdown_flag: Arc::new(AtomicBool::new(false)),
            event_loop_handle: Mutex::new(None),
        })
    }

    /// Initialize the notification system
    pub async fn initialize(&mut self, connection_pool: Arc<crate::mail::providers::imap::ImapConnectionPool>) -> MailResult<()> {
        // Initialize IDLE manager
        let mut idle_manager = Arc::try_unwrap(self.idle_manager.clone())
            .map_err(|_| MailError::configuration("Failed to get exclusive access to IDLE manager"))?;
        idle_manager.initialize(connection_pool).await;
        self.idle_manager = Arc::new(idle_manager);

        // Start main event loop
        let handle = self.start_event_loop().await?;
        *self.event_loop_handle.lock().await = Some(handle);

        info!("Email notification system initialized");
        Ok(())
    }

    /// Start monitoring an account for notifications
    pub async fn start_account_monitoring(
        &self,
        account_id: Uuid,
        folders: Vec<String>,
    ) -> MailResult<()> {
        let (event_sender, mut event_receiver) = mpsc::unbounded_channel();
        
        // Start IDLE monitoring for each folder
        for folder in folders {
            self.idle_manager
                .start_folder_monitoring(account_id, folder.clone(), event_sender.clone())
                .await?;
        }

        // Start event processing task for this account
        let processor = self.event_processor.clone();
        let sync_coordinator = self.sync_coordinator.clone();
        let listeners = self.listeners.clone();
        let shutdown_flag = self.shutdown_flag.clone();

        tokio::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                if shutdown_flag.load(Ordering::SeqCst) {
                    break;
                }

                // Process the event
                if let Err(e) = Self::handle_idle_event(
                    &event,
                    &processor,
                    &sync_coordinator,
                    &listeners,
                ).await {
                    error!("Failed to handle IDLE event: {}", e);
                }
            }
        });

        info!("Started monitoring account {}", account_id);
        Ok(())
    }

    /// Stop monitoring an account
    pub async fn stop_account_monitoring(&self, account_id: Uuid) -> MailResult<()> {
        self.idle_manager.stop_account_monitoring(account_id).await?;
        
        // Cancel any pending sync operations for this account
        self.sync_coordinator.cancel_account_syncs(account_id).await;
        
        info!("Stopped monitoring account {}", account_id);
        Ok(())
    }

    /// Add a notification listener
    pub async fn add_listener(
        &self,
        listener_id: String,
        listener: NotificationListener,
    ) -> MailResult<()> {
        let mut listeners = self.listeners.write().await;
        listeners.insert(listener_id.clone(), listener);
        
        debug!("Added notification listener: {}", listener_id);
        Ok(())
    }

    /// Remove a notification listener
    pub async fn remove_listener(&self, listener_id: &str) -> MailResult<()> {
        let mut listeners = self.listeners.write().await;
        listeners.remove(listener_id);
        
        debug!("Removed notification listener: {}", listener_id);
        Ok(())
    }

    /// Get notification system health
    pub async fn get_health(&self) -> NotificationHealth {
        let idle_health = self.idle_manager.get_health_status().await;
        let sync_health = self.sync_coordinator.get_health_status().await;
        let listener_count = self.listeners.read().await.len();

        NotificationHealth {
            idle_connections: idle_health.len(),
            active_syncs: sync_health.active_syncs,
            pending_syncs: sync_health.pending_syncs,
            listeners: listener_count,
            is_healthy: idle_health.values().all(|h| h.is_active) && sync_health.is_healthy,
        }
    }

    /// Shutdown the notification system
    pub async fn shutdown(&self) -> MailResult<()> {
        info!("Shutting down email notification system...");

        // Set shutdown flag
        self.shutdown_flag.store(true, Ordering::SeqCst);

        // Shutdown IDLE manager
        self.idle_manager.shutdown().await?;

        // Cancel all sync operations
        self.sync_coordinator.shutdown().await;

        // Stop main event loop
        if let Some(handle) = self.event_loop_handle.lock().await.take() {
            handle.abort();
        }

        // Clear listeners
        self.listeners.write().await.clear();

        info!("Email notification system shutdown completed");
        Ok(())
    }

    /// Start the main event processing loop
    async fn start_event_loop(&self) -> MailResult<tokio::task::JoinHandle<()>> {
        let processor = self.event_processor.clone();
        let sync_coordinator = self.sync_coordinator.clone();
        let listeners = self.listeners.clone();
        let shutdown_flag = self.shutdown_flag.clone();
        let batch_interval = self.config.batch_interval;

        let handle = tokio::spawn(async move {
            let mut interval = interval(batch_interval);

            loop {
                interval.tick().await;
                
                if shutdown_flag.load(Ordering::SeqCst) {
                    break;
                }

                // Process batched events
                if let Err(e) = processor.process_batch(&listeners).await {
                    error!("Failed to process event batch: {}", e);
                }

                // Process sync operations
                if let Err(e) = sync_coordinator.process_pending_syncs().await {
                    error!("Failed to process pending syncs: {}", e);
                }
            }
        });

        Ok(handle)
    }

    /// Handle an IDLE event
    async fn handle_idle_event(
        event: &IdleEvent,
        processor: &Arc<EventProcessor>,
        sync_coordinator: &Arc<SyncCoordinator>,
        listeners: &Arc<RwLock<HashMap<String, NotificationListener>>>,
    ) -> MailResult<()> {
        // Determine if this event requires a sync
        let requires_sync = matches!(event, 
            IdleEvent::NewMessage { .. } | 
            IdleEvent::MessageDeleted { .. } | 
            IdleEvent::MessageFlagsChanged { .. } |
            IdleEvent::FolderChanged { .. }
        );

        let account_id = match event {
            IdleEvent::NewMessage { account_id, .. } |
            IdleEvent::MessageDeleted { account_id, .. } |
            IdleEvent::MessageFlagsChanged { account_id, .. } |
            IdleEvent::FolderChanged { account_id, .. } |
            IdleEvent::ConnectionLost { account_id, .. } |
            IdleEvent::ConnectionRestored { account_id, .. } |
            IdleEvent::IdleRefreshed { account_id, .. } |
            IdleEvent::HealthCheck { account_id, .. } => *account_id,
        };

        let folder = match event {
            IdleEvent::NewMessage { folder, .. } |
            IdleEvent::MessageDeleted { folder, .. } |
            IdleEvent::MessageFlagsChanged { folder, .. } |
            IdleEvent::FolderChanged { folder, .. } |
            IdleEvent::ConnectionLost { folder, .. } |
            IdleEvent::ConnectionRestored { folder, .. } |
            IdleEvent::IdleRefreshed { folder, .. } |
            IdleEvent::HealthCheck { folder, .. } => folder.clone(),
        };

        // Create processed event
        let processed_event = ProcessedEvent {
            event: event.clone(),
            processed_at: Instant::now(),
            requires_sync,
            account_id,
            folder: folder.clone(),
        };

        // Add to processing queue
        processor.add_event(processed_event).await?;

        // Schedule sync if required
        if requires_sync {
            sync_coordinator.schedule_sync(account_id, folder, event.clone()).await?;
        }

        Ok(())
    }
}

impl EventProcessor {
    fn new(config: NotificationConfig) -> Self {
        Self {
            config,
            event_queue: Arc::new(Mutex::new(Vec::new())),
            last_batch_time: Arc::new(RwLock::new(Instant::now())),
        }
    }

    async fn add_event(&self, event: ProcessedEvent) -> MailResult<()> {
        let mut queue = self.event_queue.lock().await;
        
        // Check queue size limit
        if queue.len() >= self.config.max_queue_size {
            warn!("Event queue is full, dropping oldest event");
            queue.remove(0);
        }

        queue.push(event);
        Ok(())
    }

    async fn process_batch(
        &self,
        listeners: &Arc<RwLock<HashMap<String, NotificationListener>>>,
    ) -> MailResult<()> {
        let events = {
            let mut queue = self.event_queue.lock().await;
            if queue.is_empty() {
                return Ok(());
            }

            // Take up to batch_size events
            let batch_size = self.config.batch_size.min(queue.len());
            queue.drain(0..batch_size).collect::<Vec<_>>()
        };

        if events.is_empty() {
            return Ok(());
        }

        debug!("Processing batch of {} events", events.len());

        // Convert events to UI notifications
        let mut notifications = Vec::new();
        for event in events {
            if let Some(notification) = self.event_to_notification(&event).await? {
                notifications.push(notification);
            }
        }

        // Send notifications to listeners
        let listeners_guard = listeners.read().await;
        for (listener_id, listener) in listeners_guard.iter() {
            for notification in &notifications {
                // Check filters
                if let Some(account_filter) = listener.account_filter {
                    if !self.notification_matches_account(&notification, account_filter) {
                        continue;
                    }
                }

                if let Some(ref folder_filter) = listener.folder_filter {
                    if !self.notification_matches_folder(&notification, folder_filter) {
                        continue;
                    }
                }

                // Send notification
                if let Err(e) = listener.ui_sender.send(notification.clone()) {
                    warn!("Failed to send notification to listener {}: {}", listener_id, e);
                }
            }
        }

        // Update last batch time
        *self.last_batch_time.write().await = Instant::now();

        debug!("Sent {} notifications to {} listeners", notifications.len(), listeners_guard.len());
        Ok(())
    }

    async fn event_to_notification(&self, event: &ProcessedEvent) -> MailResult<Option<UINotification>> {
        match &event.event {
            IdleEvent::NewMessage { account_id, folder, .. } => {
                Ok(Some(UINotification::NewEmail {
                    account_id: *account_id,
                    folder: folder.clone(),
                    count: 1, // Could be enhanced to track actual count
                    preview: None, // Could be enhanced to fetch preview
                }))
            }
            IdleEvent::MessageDeleted { account_id, folder, message_id, .. } => {
                Ok(Some(UINotification::EmailDeleted {
                    account_id: *account_id,
                    folder: folder.clone(),
                    message_id: message_id.clone(),
                }))
            }
            IdleEvent::MessageFlagsChanged { account_id, folder, message_id, flags, .. } => {
                let is_read = flags.iter().any(|f| f == "\\Seen");
                let is_starred = flags.iter().any(|f| f == "\\Flagged");
                
                Ok(Some(UINotification::EmailFlagsChanged {
                    account_id: *account_id,
                    folder: folder.clone(),
                    message_id: message_id.clone(),
                    is_read: Some(is_read),
                    is_starred: Some(is_starred),
                }))
            }
            IdleEvent::FolderChanged { account_id, folder, change_type } => {
                match change_type {
                    crate::mail::providers::imap::idle::FolderChangeType::ExistsChanged(count) => {
                        Ok(Some(UINotification::FolderUpdated {
                            account_id: *account_id,
                            folder: folder.clone(),
                            total_count: *count,
                            unread_count: 0, // Would need additional logic to track
                        }))
                    }
                    _ => Ok(None), // Other changes don't need UI notifications
                }
            }
            IdleEvent::ConnectionLost { account_id, .. } => {
                Ok(Some(UINotification::ConnectionStatusChanged {
                    account_id: *account_id,
                    is_connected: false,
                    last_error: Some("Connection lost".to_string()),
                }))
            }
            IdleEvent::ConnectionRestored { account_id, .. } => {
                Ok(Some(UINotification::ConnectionStatusChanged {
                    account_id: *account_id,
                    is_connected: true,
                    last_error: None,
                }))
            }
            _ => Ok(None), // Other events don't need UI notifications
        }
    }

    fn notification_matches_account(&self, notification: &UINotification, account_filter: Uuid) -> bool {
        match notification {
            UINotification::NewEmail { account_id, .. } |
            UINotification::EmailDeleted { account_id, .. } |
            UINotification::EmailFlagsChanged { account_id, .. } |
            UINotification::FolderUpdated { account_id, .. } |
            UINotification::SyncStarted { account_id, .. } |
            UINotification::SyncCompleted { account_id, .. } |
            UINotification::ConnectionStatusChanged { account_id, .. } => {
                *account_id == account_filter
            }
        }
    }

    fn notification_matches_folder(&self, notification: &UINotification, folder_filter: &str) -> bool {
        match notification {
            UINotification::NewEmail { folder, .. } |
            UINotification::EmailDeleted { folder, .. } |
            UINotification::EmailFlagsChanged { folder, .. } |
            UINotification::FolderUpdated { folder, .. } |
            UINotification::SyncStarted { folder, .. } |
            UINotification::SyncCompleted { folder, .. } => {
                folder == folder_filter
            }
            UINotification::ConnectionStatusChanged { .. } => true, // Connection status is not folder-specific
        }
    }
}

impl SyncCoordinator {
    fn new(max_concurrent: u32) -> Self {
        Self {
            pending_syncs: Arc::new(RwLock::new(HashMap::new())),
            active_syncs: Arc::new(RwLock::new(HashMap::new())),
            debounce_timers: Arc::new(RwLock::new(HashMap::new())),
            max_concurrent,
        }
    }

    async fn schedule_sync(&self, account_id: Uuid, folder: String, trigger_event: IdleEvent) -> MailResult<()> {
        let sync_key = format!("{}:{}", account_id, folder);
        
        // Update debounce timer
        {
            let mut timers = self.debounce_timers.write().await;
            timers.insert(account_id, Instant::now());
        }

        // Add to pending syncs
        let mut pending = self.pending_syncs.write().await;
        pending.insert(account_id, PendingSyncOperation {
            account_id,
            folder,
            trigger_event,
            scheduled_at: Instant::now(),
        });

        debug!("Scheduled sync for account {} folder {}", account_id, sync_key);
        Ok(())
    }

    async fn process_pending_syncs(&self) -> MailResult<()> {
        let pending_ops = {
            let pending = self.pending_syncs.read().await;
            pending.values().cloned().collect::<Vec<_>>()
        };

        let active_count = self.active_syncs.read().await.len() as u32;
        if active_count >= self.max_concurrent {
            return Ok(());
        }

        for op in pending_ops {
            // Check debounce
            {
                let timers = self.debounce_timers.read().await;
                if let Some(&last_timer) = timers.get(&op.account_id) {
                    if last_timer.elapsed() < Duration::from_secs(1) {
                        continue; // Still in debounce period
                    }
                }
            }

            // Start sync operation
            self.start_sync_operation(op).await?;

            // Check if we've reached the concurrent limit
            let active_count = self.active_syncs.read().await.len() as u32;
            if active_count >= self.max_concurrent {
                break;
            }
        }

        Ok(())
    }

    async fn start_sync_operation(&self, op: PendingSyncOperation) -> MailResult<()> {
        // Remove from pending
        {
            let mut pending = self.pending_syncs.write().await;
            pending.remove(&op.account_id);
        }

        // TODO: This would need access to the actual sync engine
        // For now, we'll create a placeholder task
        let handle = tokio::spawn(async move {
            // Placeholder sync operation
            sleep(Duration::from_millis(100)).await;
            Ok(())
        });

        // Add to active
        {
            let mut active = self.active_syncs.write().await;
            active.insert(op.account_id, ActiveSyncOperation {
                account_id: op.account_id,
                folder: op.folder.clone(),
                started_at: Instant::now(),
                handle: Arc::new(handle),
            });
        }

        info!("Started sync operation for account {} folder {}", op.account_id, op.folder);
        Ok(())
    }

    async fn cancel_account_syncs(&self, account_id: Uuid) {
        // Remove pending syncs
        {
            let mut pending = self.pending_syncs.write().await;
            pending.retain(|k, _| *k != account_id);
        }

        // Cancel active syncs
        {
            let mut active = self.active_syncs.write().await;
            if let Some(sync_op) = active.remove(&account_id) {
                sync_op.handle.abort();
            }
        }

        // Remove debounce timers
        {
            let mut timers = self.debounce_timers.write().await;
            timers.remove(&account_id);
        }
    }

    async fn get_health_status(&self) -> SyncHealthStatus {
        let active = self.active_syncs.read().await;
        let pending = self.pending_syncs.read().await;

        SyncHealthStatus {
            active_syncs: active.len(),
            pending_syncs: pending.len(),
            is_healthy: active.len() < self.max_concurrent as usize,
        }
    }

    async fn shutdown(&self) {
        // Cancel all active syncs
        let active_syncs = {
            let mut active = self.active_syncs.write().await;
            active.drain().collect::<Vec<_>>()
        };

        for (_, sync_op) in active_syncs {
            sync_op.handle.abort();
        }

        // Clear pending syncs
        self.pending_syncs.write().await.clear();
        self.debounce_timers.write().await.clear();
    }
}

/// Notification system health status
#[derive(Debug, Clone)]
pub struct NotificationHealth {
    pub idle_connections: usize,
    pub active_syncs: usize,
    pub pending_syncs: usize,
    pub listeners: usize,
    pub is_healthy: bool,
}

/// Sync health status
#[derive(Debug, Clone)]
struct SyncHealthStatus {
    pub active_syncs: usize,
    pub pending_syncs: usize,
    pub is_healthy: bool,
}