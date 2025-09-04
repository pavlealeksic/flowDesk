/*!
 * Calendar Engine - Main Orchestrator
 * 
 * The main calendar engine that orchestrates all calendar operations across different
 * providers, manages sync operations, handles privacy sync, and provides a unified
 * API for calendar operations.
 */

use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, Mutex};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::calendar::providers::SyncStatus;

use crate::calendar::{
    CalendarResult, CalendarError, CalendarConfig, CalendarState,
    CalendarAccount, Calendar, CalendarEvent, CalendarProvider,
    CreateCalendarAccountInput, UpdateCalendarAccountInput,
    CreateCalendarEventInput, UpdateCalendarEventInput,
    CalendarPrivacySync, FreeBusyQuery, FreeBusyResponse,
    MeetingProposal, CalendarMetrics, CalendarSyncStatus,
    CalendarDatabase
};

use crate::calendar::providers::{CalendarProviderTrait, CalendarProviderFactory};
use crate::calendar::privacy_sync::{PrivacySyncEngine, PrivacySyncConfig, PrivacySyncResult, PrivacySyncRule, PrivacySyncState, PrivacySyncStatus, PrivacySyncStats};
use crate::calendar::webhook::{WebhookManager, CalendarWebhook};
use crate::calendar::search::CalendarSearchEngine;

/// Main calendar engine orchestrating all calendar operations
pub struct CalendarEngine {
    /// Configuration
    config: CalendarConfig,
    /// Database connection
    database: Arc<CalendarDatabase>,
    /// Global calendar state
    state: Arc<CalendarState>,
    /// Privacy sync engine
    privacy_sync: Arc<PrivacySyncEngine>,
    /// Webhook manager
    webhook_manager: Arc<Mutex<WebhookManager>>,
    /// Search engine integration
    search_engine: Arc<CalendarSearchEngine>,
    /// Active provider instances (account_id -> provider)
    providers: Arc<tokio::sync::Mutex<HashMap<String, Box<dyn CalendarProviderTrait>>>>,
    /// Sync operation locks (account_id -> mutex)
    sync_locks: Arc<RwLock<HashMap<String, Arc<Mutex<()>>>>>,
}

impl CalendarEngine {
    /// Create new calendar engine instance
    pub async fn new(config: CalendarConfig) -> CalendarResult<Self> {
        info!("Initializing calendar engine");

        // Initialize database
        let database = Arc::new(CalendarDatabase::new(&config.database_url).await?);
        
        // Initialize global state
        let state = Arc::new(CalendarState::default());

        // Initialize privacy sync engine
        let privacy_sync_config = PrivacySyncConfig {
            max_concurrent_syncs: config.max_concurrent_syncs,
            sync_interval_minutes: config.privacy_sync.sync_interval_minutes,
            max_past_days: config.privacy_sync.max_past_days,
            max_future_days: config.privacy_sync.max_future_days,
            default_privacy_title: config.privacy_sync.default_privacy_title.clone(),
            ..Default::default()
        };
        
        let privacy_sync = Arc::new(PrivacySyncEngine::new(
            Arc::clone(&database),
            privacy_sync_config,
        ));

        // Initialize webhook manager
        let webhook_manager = Arc::new(Mutex::new(WebhookManager::new(
            config.webhook_config.clone(),
            Arc::clone(&database),
        ).await?));

        // Initialize search engine
        let search_engine = Arc::new(CalendarSearchEngine::new(Arc::clone(&database))?);

        let engine = Self {
            config,
            database,
            state,
            privacy_sync,
            webhook_manager,
            search_engine,
            providers: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            sync_locks: Arc::new(RwLock::new(HashMap::new())),
        };

        info!("Calendar engine initialized successfully");
        Ok(engine)
    }

    /// Start the calendar engine background services
    pub async fn start(&self) -> CalendarResult<()> {
        info!("Starting calendar engine services");

        // Start privacy sync engine
        self.privacy_sync.start().await?;

        // Start webhook manager
        self.webhook_manager.lock().await.start().await?;

        // Start background sync scheduler
        self.start_sync_scheduler().await?;

        // Start metrics collection
        self.start_metrics_collection().await?;

        info!("Calendar engine services started successfully");
        Ok(())
    }

    /// Stop the calendar engine and cleanup resources
    pub async fn stop(&self) -> CalendarResult<()> {
        info!("Stopping calendar engine");

        // Stop webhook manager
        self.webhook_manager.lock().await.stop().await?;

        // Clear all providers
        self.providers.lock().await.clear();

        // Clear sync locks
        self.sync_locks.write().await.clear();

        info!("Calendar engine stopped");
        Ok(())
    }

    // === Account Management ===

    /// Create a new calendar account
    pub async fn create_account(&self, account_input: CreateCalendarAccountInput) -> CalendarResult<CalendarAccount> {
        info!("Creating calendar account: {} ({})", account_input.name, account_input.provider);

        // Create account in database
        let account = self.database.create_calendar_account(account_input).await?;

        // Initialize provider
        let mut boxed_provider = CalendarProviderFactory::create_boxed_provider(&account)?;

        // Test connection
        boxed_provider.test_connection().await?;

        // Store provider instance
        self.providers.lock().await.insert(account.id.to_string(), boxed_provider);

        // Schedule initial sync
        self.schedule_account_sync(&account.id.to_string(), false).await?;

        info!("Calendar account created successfully: {}", account.id);
        Ok(account)
    }

    /// Get calendar account by ID
    pub async fn get_account(&self, account_id: &str) -> CalendarResult<CalendarAccount> {
        self.database.get_calendar_account(account_id).await
    }

    /// Get all calendar accounts for a user
    pub async fn get_user_accounts(&self, user_id: &str) -> CalendarResult<Vec<CalendarAccount>> {
        self.database.get_user_calendar_accounts(user_id).await
    }

    /// Update calendar account
    pub async fn update_account(
        &self,
        account_id: &str,
        updates: UpdateCalendarAccountInput,
    ) -> CalendarResult<CalendarAccount> {
        let updated_account = self.database.update_calendar_account(account_id, updates).await?;

        // Reload provider if configuration changed
        if updated_account.is_enabled {
            self.reload_provider(&updated_account).await?;
        } else {
            // Remove provider if account is disabled
            self.providers.lock().await.remove(account_id);
        }

        Ok(updated_account)
    }

    /// Delete calendar account
    pub async fn delete_account(&self, account_id: &str) -> CalendarResult<()> {
        info!("Deleting calendar account: {}", account_id);

        // Remove provider instance
        self.providers.lock().await.remove(account_id);

        // Cancel any active syncs
        self.cancel_account_sync(account_id).await?;

        // Delete from database (cascades to calendars, events, etc.)
        self.database.delete_calendar_account(account_id).await?;

        info!("Calendar account deleted: {}", account_id);
        Ok(())
    }

    // === Calendar Operations ===

    /// List calendars for an account
    pub async fn list_calendars(&self, account_id: &str) -> CalendarResult<Vec<Calendar>> {
        let mut provider = self.get_provider(account_id).await?;
        provider.list_calendars().await
    }

    /// Get calendar by ID
    pub async fn get_calendar(&self, calendar_id: &str) -> CalendarResult<Calendar> {
        self.database.get_calendar(calendar_id).await
    }

    /// Create calendar
    pub async fn create_calendar(&self, calendar: &Calendar) -> CalendarResult<Calendar> {
        let mut provider = self.get_provider(&calendar.account_id.to_string()).await?;
        let created_calendar = provider.create_calendar(calendar).await?;
        
        // Store in database
        self.database.create_calendar(created_calendar.clone()).await?;
        
        Ok(created_calendar)
    }

    // === Event Operations ===

    /// Create calendar event
    pub async fn create_event(&self, event_input: &CreateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // Get calendar to determine account
        let calendar = self.database.get_calendar(&event_input.calendar_id).await?;
        let mut provider = self.get_provider(&calendar.account_id.to_string()).await?;

        // Create event via provider
        let created_event = provider.create_event(event_input).await?;

        // Store in database
        let stored_event = self.database.create_calendar_event(event_input.clone()).await?;

        // Index event for search
        self.search_engine.index_event(&stored_event).await?;

        // Trigger privacy sync if applicable
        self.trigger_privacy_sync_for_event(&stored_event).await?;

        debug!("Created calendar event: {}", created_event.id);
        Ok(created_event)
    }

    /// Update calendar event
    pub async fn update_event(
        &self,
        calendar_id: &str,
        event_id: &str,
        updates: &UpdateCalendarEventInput,
    ) -> CalendarResult<CalendarEvent> {
        // Get calendar to determine account
        let calendar = self.database.get_calendar(calendar_id).await?;
        let mut provider = self.get_provider(&calendar.account_id.to_string()).await?;

        // Update event via provider
        let updated_event = provider.update_event(calendar_id, event_id, updates).await?;

        // Update in database
        // (Implementation would update local copy)

        // Update search index
        self.search_engine.index_event(&updated_event).await?;

        // Trigger privacy sync if applicable
        self.trigger_privacy_sync_for_event(&updated_event).await?;

        debug!("Updated calendar event: {}", event_id);
        Ok(updated_event)
    }

    /// Delete calendar event
    pub async fn delete_event(&self, calendar_id: &str, event_id: &str) -> CalendarResult<()> {
        // Get calendar to determine account
        let calendar = self.database.get_calendar(calendar_id).await?;
        let mut provider = self.get_provider(&calendar.account_id.to_string()).await?;

        // Delete event via provider
        provider.delete_event(calendar_id, event_id).await?;

        // Remove from search index
        self.search_engine.remove_event(event_id).await?;

        // Trigger privacy sync cleanup if applicable
        self.cleanup_privacy_sync_for_event(event_id).await?;

        debug!("Deleted calendar event: {}", event_id);
        Ok(())
    }

    /// Get events in date range across multiple calendars
    pub async fn get_events_in_range(
        &self,
        calendar_ids: &[String],
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
    ) -> CalendarResult<Vec<CalendarEvent>> {
        let mut all_events = Vec::new();

        for calendar_id in calendar_ids {
            let events = self.database.get_events_in_range(calendar_id, time_min, time_max).await?;
            all_events.extend(events);
        }

        // Sort by start time
        all_events.sort_by_key(|event| event.start_time);

        Ok(all_events)
    }

    // === Free/Busy Operations ===

    /// Query free/busy across multiple accounts
    pub async fn query_free_busy(&self, query: &FreeBusyQuery) -> CalendarResult<FreeBusyResponse> {
        // Group emails by account/provider
        let mut provider_queries: HashMap<String, Vec<String>> = HashMap::new();
        
        // For now, use first available provider (would need email->account mapping)
        let accounts = self.database.get_user_calendar_accounts("current_user").await?;
        if let Some(account) = accounts.first() {
            provider_queries.insert(account.id.to_string(), query.emails.clone());
        }

        let mut merged_response = FreeBusyResponse {
            time_min: query.time_min,
            time_max: query.time_max,
            free_busy: HashMap::new(),
            errors: None,
        };

        // Query each provider
        for (account_id, emails) in provider_queries {
            let mut provider = self.get_provider(&account_id).await?;
            let provider_query = FreeBusyQuery {
                emails,
                time_min: query.time_min,
                time_max: query.time_max,
                timezone: query.timezone.clone(),
            };

            match provider.query_free_busy(&provider_query).await {
                Ok(response) => {
                    merged_response.free_busy.extend(response.free_busy);
                    if let Some(provider_errors) = response.errors {
                        merged_response.errors.get_or_insert_with(Vec::new).extend(provider_errors);
                    }
                },
                Err(e) => {
                    warn!("Free/busy query failed for account {}: {}", account_id, e);
                    for email in &provider_query.emails {
                        merged_response.errors.get_or_insert_with(Vec::new)
                            .push(format!("Query failed for {}: {}", email, e));
                    }
                }
            }
        }

        Ok(merged_response)
    }

    // === Sync Operations ===

    /// Trigger full sync for an account
    pub async fn sync_account(&self, account_id: &str, force: bool) -> CalendarResult<CalendarSyncStatus> {
        info!("Starting sync for account: {} (force: {})", account_id, force);

        // Get sync lock for this account
        let sync_lock = self.get_sync_lock(account_id).await;
        let _guard = sync_lock.lock().await;

        // Check if sync is already in progress
        if !force && self.is_account_syncing(account_id).await {
            return Err(CalendarError::SyncError {
                message: "Sync already in progress for this account".to_string(),
                account_id: account_id.to_string(),
                calendar_id: None,
                event_id: None,
                context: None,
                provider: None,
                sync_type: Some("full".to_string()),
                operation: Some("sync_start".to_string()),
                sync_token: None,
            });
        }

        let mut provider = self.get_provider(account_id).await?;
        
        // Mark sync as active
        self.set_account_syncing(account_id, true).await;

        let sync_result = match provider.full_sync().await {
            Ok(status) => {
                info!("Sync completed for account: {}", account_id);
                status
            },
            Err(e) => {
                error!("Sync failed for account {}: {}", account_id, e);
                SyncStatus {
                    operation_id: uuid::Uuid::new_v4().to_string(),
                    account_id: account_id.to_string(),
                    sync_type: "full".to_string(),
                    progress: 0,
                    status: format!("Error: {}", e),
                    started_at: Utc::now(),
                    completed_at: Some(Utc::now()),
                    events_processed: 0,
                    error_count: 1,
                    last_error: Some(e.to_string()),
                    error_message: Some(e.to_string()),
                    calendars_synced: 0,
                    events_synced: 0,
                }
            }
        };

        // Mark sync as complete
        self.set_account_syncing(account_id, false).await;

        // Convert SyncStatus to CalendarSyncStatus
        Ok(CalendarSyncStatus {
            account_id: sync_result.account_id,
            last_sync_at: Some(sync_result.started_at),
            last_sync: Some(sync_result.started_at),
            is_syncing: false,
            error: sync_result.error_message.clone(),
            error_message: sync_result.error_message,
            status: sync_result.status,
            total_calendars: sync_result.calendars_synced,
            total_events: sync_result.events_synced,
        })
    }

    /// Schedule automatic sync for an account
    pub async fn schedule_account_sync(&self, account_id: &str, incremental: bool) -> CalendarResult<()> {
        let account = self.database.get_calendar_account(account_id).await?;
        
        let sync_type = if incremental { "incremental" } else { "full" };
        debug!("Scheduling {} sync for account: {} in {} minutes", 
            sync_type, account_id, account.sync_interval_minutes);

        // Store sync schedule in state
        let next_sync_time = Utc::now() + chrono::Duration::minutes(account.sync_interval_minutes as i64);
        self.state.last_sync_times.insert(account_id.to_string(), next_sync_time);

        Ok(())
    }

    // === Privacy Sync Operations ===

    /// Create privacy sync rule
    pub async fn create_privacy_sync_rule(&self, rule: &CalendarPrivacySync) -> CalendarResult<String> {
        info!("Creating privacy sync rule: {}", rule.name);

        // Validate rule
        self.validate_privacy_sync_rule(rule).await?;

        // Store in database (implementation would save to privacy_sync_rules table)
        let rule_id = Uuid::new_v4().to_string();

        // Add to runtime state
        let mut privacy_rules = self.state.privacy_sync_rules.write().await;
        privacy_rules.insert(rule_id.clone(), rule.clone());

        info!("Privacy sync rule created: {}", rule_id);
        Ok(rule_id)
    }

    /// Execute privacy sync for all rules
    pub async fn execute_privacy_sync(&self) -> CalendarResult<Vec<PrivacySyncResult>> {
        info!("Executing privacy sync for all rules");
        self.privacy_sync.sync_all_rules().await
    }

    /// Execute privacy sync for a specific rule
    pub async fn execute_privacy_sync_rule(&self, rule_id: &str) -> CalendarResult<PrivacySyncResult> {
        info!("Executing privacy sync for rule: {}", rule_id);
        
        // Get rule from state
        let privacy_rules = self.state.privacy_sync_rules.read().await;
        let rule_config = privacy_rules.get(rule_id).ok_or_else(|| {
            CalendarError::NotFoundError {
                resource_type: "privacy_sync_rule".to_string(),
                resource_id: rule_id.to_string(),
                provider: CalendarProvider::Google, // Not provider-specific
                account_id: "system".to_string(),
            }
        })?.clone();

        // Create privacy sync rule with state
        let rule = PrivacySyncRule {
            config: rule_config.clone(),
            state: PrivacySyncState {
                status: PrivacySyncStatus::Idle,
                last_sync_attempt: None,
                last_successful_sync: None,
                retry_count: 0,
                last_error: None,
                event_mappings: HashMap::new(),
                stats: PrivacySyncStats {
                    events_processed: 0,
                    events_created: 0,
                    events_updated: 0,
                    events_deleted: 0,
                    conflicts_detected: 0,
                    error_count: 0,
                    sync_duration_ms: 0,
                    events_synced: 0,
                    conflicts_resolved: 0,
                    last_full_sync: None,
                },
                last_sync_time: None,
            },
        };

        // Execute sync for this rule
        let result = self.privacy_sync.sync_rule(rule).await;
        if result.success {
            tracing::info!("Privacy sync completed for calendar {}", rule_config.source_calendar_id);
        } else {
            let error_msg = result.error.as_ref().map(|s| s.as_str()).unwrap_or("Unknown sync error");
            tracing::error!("Privacy sync failed: {}", error_msg);
        }
        Ok(result)
    }

    // === Search Operations ===

    /// Search calendar events
    pub async fn search_events(&self, query: &str, limit: Option<usize>) -> CalendarResult<Vec<CalendarEvent>> {
        self.search_engine.search_events(query, limit).await
    }

    /// Search calendars
    pub async fn search_calendars(&self, query: &str) -> CalendarResult<Vec<Calendar>> {
        self.search_engine.search_calendars(query).await
    }

    // === Metrics and Monitoring ===

    /// Get calendar metrics
    pub async fn get_metrics(&self) -> CalendarResult<CalendarMetrics> {
        // Collect metrics from all components
        let mut metrics = CalendarMetrics::default();

        // Get account metrics
        // (Implementation would aggregate data from database and state)

        Ok(metrics)
    }

    /// Get sync status for all accounts
    pub async fn get_all_sync_status(&self) -> CalendarResult<HashMap<String, CalendarSyncStatus>> {
        let mut status_map = HashMap::new();

        // Get all active sync operations
        for sync_op in self.state.active_syncs.iter() {
            let account_id = sync_op.key().clone();
            let operation = sync_op.value();
            
            let status = CalendarSyncStatus {
                account_id: account_id.clone(),
                last_sync_at: Some(operation.started_at),
                last_sync: Some(operation.started_at),
                is_syncing: true,
                error: None,
                error_message: None,
                status: "syncing".to_string(),
                total_calendars: 0,
                total_events: 0,
            };
            
            status_map.insert(account_id, status);
        }

        Ok(status_map)
    }

    // === Helper Methods ===

    /// Get provider instance for an account
    async fn get_provider(&self, account_id: &str) -> CalendarResult<Box<dyn CalendarProviderTrait>> {
        let account_id = account_id.to_string();
        
        // Check if provider exists
        let mut providers = self.providers.lock().await;
        if !providers.contains_key(&account_id) {
            // Load provider from database
            let account = self.database.get_calendar_account(&account_id).await?;
            if !account.is_enabled {
                return Err(CalendarError::ValidationError {
                    message: "Account is disabled".to_string(),
                    provider: None,
                    account_id: Some(account_id.clone()),
                    field: Some("is_enabled".to_string()),
                    value: Some("false".to_string()),
                    constraint: Some("enabled".to_string()),
                });
            }
            
            let boxed_provider = CalendarProviderFactory::create_boxed_provider(&account)?;
            providers.insert(account_id.clone(), boxed_provider);
        }
        
        // Clone the provider - this is a temporary solution for compilation
        // In practice, we'd need to redesign this to avoid cloning trait objects
        let provider = providers.get(&account_id).unwrap();
        CalendarProviderFactory::create_boxed_provider(
            &self.database.get_calendar_account(&account_id).await?
        )
    }

    /// Get mutable access to provider instance for an account
    async fn with_provider<F, R>(&self, account_id: &str, f: F) -> CalendarResult<R>
    where
        F: FnOnce(&mut Box<dyn CalendarProviderTrait>) -> std::pin::Pin<Box<dyn std::future::Future<Output = CalendarResult<R>> + Send + '_>>,
    {
        let account_id = account_id.to_string();
        
        // Check if provider exists
        let mut providers = self.providers.lock().await;
        if !providers.contains_key(&account_id) {
            // Load provider from database
            let account = self.database.get_calendar_account(&account_id).await?;
            if !account.is_enabled {
                return Err(CalendarError::ValidationError {
                    message: "Account is disabled".to_string(),
                    provider: None,
                    account_id: Some(account_id.clone()),
                    field: Some("is_enabled".to_string()),
                    value: Some("false".to_string()),
                    constraint: Some("enabled".to_string()),
                });
            }
            
            let boxed_provider = CalendarProviderFactory::create_boxed_provider(&account)?;
            providers.insert(account_id.clone(), boxed_provider);
        }
        
        // Get mutable reference to provider
        let provider = providers.get_mut(&account_id).unwrap();
        f(provider).await
    }

    /// Reload provider instance for an account
    async fn reload_provider(&self, account: &CalendarAccount) -> CalendarResult<()> {
        let mut boxed_provider = CalendarProviderFactory::create_boxed_provider(account)?;
        boxed_provider.test_connection().await?;
        
        self.providers.lock().await.insert(account.id.to_string(), boxed_provider);
        Ok(())
    }

    /// Get sync lock for an account
    async fn get_sync_lock(&self, account_id: &str) -> Arc<Mutex<()>> {
        let mut locks = self.sync_locks.write().await;
        locks.entry(account_id.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    /// Check if account is currently syncing
    async fn is_account_syncing(&self, account_id: &str) -> bool {
        self.state.active_syncs.contains_key(account_id)
    }

    /// Set account syncing status
    async fn set_account_syncing(&self, account_id: &str, is_syncing: bool) {
        if is_syncing {
            self.state.active_syncs.insert(account_id.to_string(), crate::calendar::SyncOperation {
                account_id: account_id.to_string(),
                operation_type: "sync".to_string(),
                started_at: Utc::now(),
                progress: 0,
                status: "started".to_string(),
            });
        } else {
            self.state.active_syncs.remove(account_id);
        }
    }

    /// Start background sync scheduler
    async fn start_sync_scheduler(&self) -> CalendarResult<()> {
        debug!("Starting sync scheduler");
        
        // Implementation would start a background task that checks
        // for accounts due for sync and triggers them
        
        Ok(())
    }

    /// Start metrics collection
    async fn start_metrics_collection(&self) -> CalendarResult<()> {
        debug!("Starting metrics collection");
        
        // Implementation would start periodic metrics collection
        
        Ok(())
    }

    /// Trigger privacy sync when an event is created/updated
    async fn trigger_privacy_sync_for_event(&self, event: &CalendarEvent) -> CalendarResult<()> {
        // Check if this event's calendar is a source for any privacy sync rules
        // If so, trigger privacy sync for those rules
        
        debug!("Checking privacy sync triggers for event: {}", event.id);
        Ok(())
    }

    /// Cleanup privacy sync when an event is deleted
    async fn cleanup_privacy_sync_for_event(&self, event_id: &str) -> CalendarResult<()> {
        debug!("Cleaning up privacy sync for deleted event: {}", event_id);
        Ok(())
    }

    /// Validate privacy sync rule
    async fn validate_privacy_sync_rule(&self, rule: &CalendarPrivacySync) -> CalendarResult<()> {
        // Validate source and target calendars exist
        self.database.get_calendar(&rule.source_calendar_id).await?;
        self.database.get_calendar(&rule.target_calendar_id).await?;
        
        Ok(())
    }

    /// Cancel active sync for an account
    async fn cancel_account_sync(&self, account_id: &str) -> CalendarResult<()> {
        self.state.active_syncs.remove(account_id);
        debug!("Cancelled sync for account: {}", account_id);
        Ok(())
    }
}

impl Clone for CalendarEngine {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            database: Arc::clone(&self.database),
            state: Arc::clone(&self.state),
            privacy_sync: Arc::clone(&self.privacy_sync),
            webhook_manager: Arc::clone(&self.webhook_manager),
            search_engine: Arc::clone(&self.search_engine),
            providers: Arc::clone(&self.providers),
            sync_locks: Arc::clone(&self.sync_locks),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_calendar_engine_initialization() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let config = CalendarConfig {
            database_url: format!("sqlite:{}", db_path.display()),
            ..Default::default()
        };

        let engine = CalendarEngine::new(config).await.unwrap();
        
        // Test basic functionality
        let metrics = engine.get_metrics().await.unwrap();
        assert_eq!(metrics.total_events, 0);
    }

    #[tokio::test]
    async fn test_engine_lifecycle() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let config = CalendarConfig {
            database_url: format!("sqlite:{}", db_path.display()),
            ..Default::default()
        };

        let engine = CalendarEngine::new(config).await.unwrap();
        
        // Start and stop engine
        engine.start().await.unwrap();
        engine.stop().await.unwrap();
    }
}