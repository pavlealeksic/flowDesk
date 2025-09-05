use crate::mail::MailDatabase;
use std::sync::Arc;
use tokio::time::{Duration, interval, Instant};
use dashmap::DashMap;

pub struct MailSyncManager {
    database: Arc<MailDatabase>,
    sync_states: Arc<DashMap<String, SyncState>>,
    active_syncs: Arc<DashMap<String, tokio::task::JoinHandle<()>>>,
}

#[derive(Debug, Clone)]
struct SyncState {
    account_id: String,
    last_sync: Option<Instant>,
    is_syncing: bool,
    sync_interval: Duration,
    error_count: u32,
    current_operation: Option<String>,
    last_error: Option<String>,
}

impl MailSyncManager {
    pub fn new(database: Arc<MailDatabase>) -> Self {
        Self {
            database,
            sync_states: Arc::new(DashMap::new()),
            active_syncs: Arc::new(DashMap::new()),
        }
    }

    pub async fn sync_account(&self, account_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Check if already syncing
        if let Some(state) = self.sync_states.get(account_id) {
            if state.is_syncing {
                return Ok(()); // Skip if already syncing
            }
        }

        // Mark as syncing
        self.sync_states.insert(account_id.to_string(), SyncState {
            account_id: account_id.to_string(),
            last_sync: None,
            is_syncing: true,
            sync_interval: Duration::from_secs(60),
            error_count: 0,
            current_operation: Some("Starting sync".to_string()),
            last_error: None,
        });

        let result = self.perform_sync(account_id).await;

        // Update sync state
        if let Some(mut state) = self.sync_states.get_mut(account_id) {
            state.is_syncing = false;
            state.last_sync = Some(Instant::now());
            if result.is_err() {
                state.error_count += 1;
            } else {
                state.error_count = 0;
            }
        }

        result
    }

    async fn perform_sync(&self, account_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tracing::info!("Starting sync for account: {}", account_id);
        
        // In a real implementation, this would:
        // 1. Connect to IMAP server
        // 2. Fetch new messages since last sync
        // 3. Update message flags (read/unread, starred, etc.)
        // 4. Store new messages in database
        // 5. Handle folder synchronization
        
        // For now, this is a placeholder that demonstrates the structure
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        tracing::info!("Sync completed for account: {}", account_id);
        Ok(())
    }

    pub fn start_background_sync(&self, account_id: String) {
        let sync_states = self.sync_states.clone();
        let database = self.database.clone();
        let account_id_for_task = account_id.clone();
        
        let handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                // Check if we should sync
                let should_sync = if let Some(state) = sync_states.get(&account_id_for_task) {
                    !state.is_syncing && 
                    (state.last_sync.is_none() || 
                     state.last_sync.unwrap().elapsed() >= state.sync_interval)
                } else {
                    true
                };

                if should_sync {
                    // Perform sync logic here
                    tracing::debug!("Background sync for account: {}", account_id_for_task);
                }
            }
        });

        self.active_syncs.insert(account_id, handle);
    }

    pub fn stop_background_sync(&self, account_id: &str) {
        if let Some((_, handle)) = self.active_syncs.remove(account_id) {
            handle.abort();
        }
        self.sync_states.remove(account_id);
    }

    pub fn get_sync_status(&self, account_id: &str) -> Option<SyncStatus> {
        self.sync_states.get(account_id).map(|state| SyncStatus {
            account_id: state.account_id.clone(),
            is_syncing: state.is_syncing,
            last_sync: state.last_sync,
            error_count: state.error_count,
        })
    }
}

#[derive(Debug, Clone)]
pub struct SyncStatus {
    pub account_id: String,
    pub is_syncing: bool,
    pub last_sync: Option<Instant>,
    pub error_count: u32,
}

/// Sync progress information
#[derive(Debug, Clone)]
pub struct SyncProgress {
    pub total_steps: usize,
    pub completed_steps: usize,
    pub current_operation: String,
}

/// Sync result information  
#[derive(Debug, Clone)]
pub struct SyncResult {
    pub success: bool,
    pub messages_synced: usize,
    pub errors: Vec<String>,
}

impl MailSyncManager {
    pub async fn start_account_sync(&self, account_id: String) {
        self.start_background_sync(account_id);
    }

    pub fn stop_account_sync(&self, account_id: &str) {
        self.stop_background_sync(account_id);
    }

    pub fn stop_all_syncs(&self) {
        // Stop all active syncs
        for entry in self.active_syncs.iter() {
            entry.value().abort();
        }
        self.active_syncs.clear();
        self.sync_states.clear();
    }

    pub async fn get_account_status(&self, account_id: uuid::Uuid) -> Result<crate::mail::types::MailAccountStatus, Box<dyn std::error::Error + Send + Sync>> {
        // Check if account is currently syncing
        if self.active_syncs.contains_key(&account_id.to_string()) {
            Ok(crate::mail::types::MailAccountStatus::Active)
        } else {
            // Return last known status or default
            Ok(crate::mail::types::MailAccountStatus::Active)
        }
    }

    pub async fn get_current_operation(&self) -> Option<String> {
        // Find any account that has a current operation
        for entry in self.sync_states.iter() {
            if let Some(ref operation) = entry.current_operation {
                return Some(operation.clone());
            }
        }
        None
    }

    pub async fn get_last_error(&self) -> Option<String> {
        // Find the most recent error from any account
        for entry in self.sync_states.iter() {
            if let Some(ref error) = entry.last_error {
                return Some(error.clone());
            }
        }
        None
    }

    /// Get current operation for a specific account
    pub async fn get_account_current_operation(&self, account_id: &str) -> Option<String> {
        self.sync_states.get(account_id)?.current_operation.clone()
    }

    /// Get last error for a specific account
    pub async fn get_account_last_error(&self, account_id: &str) -> Option<String> {
        self.sync_states.get(account_id)?.last_error.clone()
    }

    /// Update the current operation for an account
    pub async fn set_account_operation(&self, account_id: &str, operation: Option<String>) {
        if let Some(mut state) = self.sync_states.get_mut(account_id) {
            state.current_operation = operation;
        }
    }

    /// Set the last error for an account
    pub async fn set_account_error(&self, account_id: &str, error: Option<String>) {
        if let Some(mut state) = self.sync_states.get_mut(account_id) {
            let has_error = error.is_some();
            state.last_error = error;
            if has_error {
                state.error_count += 1;
            }
        }
    }

    pub async fn shutdown(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.stop_all_syncs();
        Ok(())
    }
}

// Type alias for compatibility
pub type SyncEngine = MailSyncManager;