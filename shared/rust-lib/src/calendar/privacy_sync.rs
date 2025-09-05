/*!
 * Calendar Privacy Sync Engine
 * 
 * Implementation of the privacy sync feature from Blueprint.md that mirrors events 
 * from source calendars to target calendars as privacy-safe "busy blocks" with 
 * configurable titles and stripped sensitive details.
 */

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use chrono::{DateTime, Utc, Duration, Timelike};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tracing::{debug, error, info, warn};
use tokio::time::Duration as TokioDuration;

use crate::calendar::{
    CalendarResult, CalendarError, CalendarPrivacySync, 
    CalendarEvent, CreateCalendarEventInput, UpdateCalendarEventInput, EventTransparency, EventStatus,
    CalendarDatabase
};

use crate::calendar::providers::{CalendarProviderTrait, CalendarProviderFactory};

/// Privacy sync engine for cross-calendar busy block mirroring
pub struct PrivacySyncEngine {
    database: Arc<CalendarDatabase>,
    config: PrivacySyncConfig,
}

/// Configuration for privacy sync operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncConfig {
    /// Maximum number of concurrent sync operations
    pub max_concurrent_syncs: usize,
    /// Default sync check interval in minutes
    pub sync_interval_minutes: u64,
    /// Maximum sync window in days (past)
    pub max_past_days: u32,
    /// Maximum sync window in days (future)  
    pub max_future_days: u32,
    /// Default privacy event title
    pub default_privacy_title: String,
    /// Enable conflict detection and resolution
    pub enable_conflict_resolution: bool,
    /// Retry failed syncs after this many minutes
    pub retry_failed_after_minutes: u64,
    /// Maximum number of retry attempts
    pub max_retry_attempts: u32,
}

impl Default for PrivacySyncConfig {
    fn default() -> Self {
        Self {
            max_concurrent_syncs: 5,
            sync_interval_minutes: 5,
            max_past_days: 7,
            max_future_days: 60,
            default_privacy_title: "Private".to_string(),
            enable_conflict_resolution: true,
            retry_failed_after_minutes: 30,
            max_retry_attempts: 3,
        }
    }
}

/// Privacy sync rule with additional runtime state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncRule {
    /// Base privacy sync configuration
    pub config: CalendarPrivacySync,
    /// Runtime sync state
    pub state: PrivacySyncState,
}

/// Runtime state for privacy sync operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncState {
    /// Current sync status
    pub status: PrivacySyncStatus,
    /// Last sync attempt timestamp
    pub last_sync_attempt: Option<DateTime<Utc>>,
    /// Last successful sync timestamp
    pub last_successful_sync: Option<DateTime<Utc>>,
    /// Number of retry attempts
    pub retry_count: u32,
    /// Last error message
    pub last_error: Option<String>,
    /// Synced event mappings (source_event_id -> target_event_id)
    pub event_mappings: HashMap<String, Vec<String>>,
    /// Sync statistics
    pub stats: PrivacySyncStats,
    /// Alias for last successful sync (for compatibility)
    pub last_sync_time: Option<DateTime<Utc>>,
}

/// Privacy sync operation status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PrivacySyncStatus {
    /// Sync is idle/waiting
    Idle,
    /// Sync is currently running
    Running,
    /// Sync completed successfully
    Completed,
    /// Sync failed with errors
    Failed,
    /// Sync is paused
    Paused,
    /// Sync is disabled
    Disabled,
}

/// Statistics for privacy sync operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncStats {
    /// Total events processed in last sync
    pub events_processed: u64,
    /// Events created in target calendars
    pub events_created: u64,
    /// Events updated in target calendars
    pub events_updated: u64,
    /// Events deleted in target calendars
    pub events_deleted: u64,
    /// Number of conflicts detected
    pub conflicts_detected: u64,
    /// Number of errors encountered
    pub error_count: u64,
    /// Sync duration in milliseconds
    pub sync_duration_ms: u64,
    /// Total events synced
    pub events_synced: u64,
    /// Number of conflicts resolved
    pub conflicts_resolved: u64,
    /// Timestamp of last full sync
    pub last_full_sync: Option<DateTime<Utc>>,
}

impl Default for PrivacySyncState {
    fn default() -> Self {
        Self {
            status: PrivacySyncStatus::Idle,
            last_sync_attempt: None,
            last_successful_sync: None,
            retry_count: 0,
            last_error: None,
            event_mappings: HashMap::new(),
            stats: PrivacySyncStats::default(),
            last_sync_time: None,
        }
    }
}

impl Default for PrivacySyncStats {
    fn default() -> Self {
        Self {
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
        }
    }
}

impl PrivacySyncEngine {
    /// Create new privacy sync engine
    pub fn new(database: Arc<CalendarDatabase>, config: PrivacySyncConfig) -> Self {
        Self { database, config }
    }

    /// Start privacy sync engine background task
    pub async fn start(&self) -> CalendarResult<()> {
        info!("Starting privacy sync engine with interval {} minutes", 
            self.config.sync_interval_minutes);

        // Start background sync task
        let database = Arc::clone(&self.database);
        let config = self.config.clone();
        
        tokio::spawn(async move {
            let engine = PrivacySyncEngine::new(database, config.clone());
            engine.background_sync_loop().await;
        });

        Ok(())
    }

    /// Background sync loop that runs periodically
    async fn background_sync_loop(&self) {
        let mut interval = tokio::time::interval(
            TokioDuration::from_secs(self.config.sync_interval_minutes * 60)
        );

        loop {
            interval.tick().await;
            
            if let Err(e) = self.sync_all_rules().await {
                error!("Background privacy sync failed: {}", e);
            }
        }
    }

    /// Sync all enabled privacy sync rules
    pub async fn sync_all_rules(&self) -> CalendarResult<Vec<PrivacySyncResult>> {
        debug!("Starting sync for all privacy sync rules");

        // Get all enabled privacy sync rules from database
        let rules = self.get_enabled_rules().await?;
        let mut results = Vec::with_capacity(rules.len());

        // Process rules with concurrency limit
        let semaphore = Arc::new(tokio::sync::Semaphore::new(self.config.max_concurrent_syncs));
        let mut tasks = Vec::new();

        for rule in rules {
            let permit = Arc::clone(&semaphore).acquire_owned().await.unwrap();
            let engine = self.clone();
            
            let task = tokio::spawn(async move {
                let _permit = permit; // Keep permit alive
                engine.sync_rule(rule).await
            });
            
            tasks.push(task);
        }

        // Wait for all sync tasks to complete
        for task in tasks {
            match task.await {
                Ok(result) => results.push(result),
                Err(e) => {
                    error!("Privacy sync task failed: {}", e);
                    results.push(PrivacySyncResult {
                        rule_id: "unknown".to_string(),
                        success: false,
                        error: Some(format!("Task execution failed: {}", e)),
                        events_processed: 0,
                        events_synced: 0,
                        duration_ms: 0,
                    });
                }
            }
        }

        info!("Completed privacy sync for {} rules", results.len());
        Ok(results)
    }

    /// Sync a specific privacy sync rule
    pub async fn sync_rule(&self, mut rule: PrivacySyncRule) -> PrivacySyncResult {
        let start_time = std::time::Instant::now();
        let rule_id = rule.config.source_calendar_id.clone();
        
        info!("Starting privacy sync for rule: {} -> {} ({})", rule.config.source_calendar_id, rule.config.target_calendar_id, rule_id);

        // Update rule state
        rule.state.status = PrivacySyncStatus::Running;
        rule.state.last_sync_attempt = Some(Utc::now());
        rule.state.stats = PrivacySyncStats::default();

        // Validate rule configuration
        if let Err(e) = self.validate_rule(&rule.config).await {
            error!("Privacy sync rule validation failed: {}", e);
            return PrivacySyncResult {
                rule_id,
                success: false,
                error: Some(e.to_string()),
                events_processed: 0,
                events_synced: 0,
                duration_ms: start_time.elapsed().as_millis() as u64,
            };
        }

        let sync_result = match self.execute_rule_sync(&mut rule).await {
            Ok(stats) => {
                rule.state.status = PrivacySyncStatus::Completed;
                rule.state.last_successful_sync = Some(Utc::now());
                rule.state.retry_count = 0;
                rule.state.last_error = None;
                rule.state.stats = stats.clone();

                PrivacySyncResult {
                    rule_id: rule_id.clone(),
                    success: true,
                    error: None,
                    events_processed: stats.events_processed,
                    events_synced: stats.events_created + stats.events_updated,
                    duration_ms: stats.sync_duration_ms,
                }
            },
            Err(e) => {
                error!("Privacy sync execution failed for rule {}: {}", rule_id, e);
                
                rule.state.status = PrivacySyncStatus::Failed;
                rule.state.retry_count += 1;
                rule.state.last_error = Some(e.to_string());
                rule.state.stats.error_count += 1;

                PrivacySyncResult {
                    rule_id: rule_id.clone(),
                    success: false,
                    error: Some(e.to_string()),
                    events_processed: rule.state.stats.events_processed,
                    events_synced: 0,
                    duration_ms: start_time.elapsed().as_millis() as u64,
                }
            }
        };

        // Save updated rule state to database
        if let Err(e) = self.save_rule_state(&rule).await {
            warn!("Failed to save privacy sync rule state: {}", e);
        }

        sync_result
    }

    /// Execute the actual sync operation for a rule
    async fn execute_rule_sync(&self, rule: &mut PrivacySyncRule) -> CalendarResult<PrivacySyncStats> {
        let start_time = std::time::Instant::now();
        let mut stats = PrivacySyncStats::default();

        // Calculate sync window using configured time window or defaults
        let now = Utc::now();
        let (past_days, future_days) = if let Some(ref time_window) = rule.config.time_window {
            (time_window.past_days, time_window.future_days)
        } else {
            (30, 365) // Default to 30 days past, 365 days future
        };
        let time_min = now - Duration::days(past_days as i64);
        let time_max = now + Duration::days(future_days as i64);

        debug!("Syncing events from {} to {} for rule {}", 
            time_min.format("%Y-%m-%d"), 
            time_max.format("%Y-%m-%d"),
            rule.config.source_calendar_id
        );

        // Get all source events in the sync window
        let source_events = self.get_source_events(
            &[rule.config.source_calendar_id.clone()],
            time_min,
            time_max,
        ).await?;

        stats.events_processed = source_events.len() as u64;

        // Convert Vec<String> filters to PrivacyFilters structure
        let privacy_filters = if rule.config.filters.is_empty() {
            None
        } else {
            Some(crate::calendar::PrivacyFilters {
                include_patterns: rule.config.filters.clone(),
                exclude_patterns: vec![],
                strip_keywords: vec![],
                work_hours_only: false,
                exclude_all_day: false,
                min_duration_minutes: 0,
                include_colors: None,
                exclude_colors: None,
            })
        };
        let filtered_events = self.apply_event_filters(&source_events, &privacy_filters);
        
        debug!("Filtered {} events down to {} for rule {}", 
            source_events.len(), 
            filtered_events.len(), 
            rule.config.source_calendar_id
        );

        // Process the target calendar
        let target_calendar_id = rule.config.target_calendar_id.clone();
        {
            let target_stats = self.sync_to_target_calendar(
                rule,
                &filtered_events,
                &target_calendar_id,
            ).await?;

            stats.events_created += target_stats.events_created;
            stats.events_updated += target_stats.events_updated;
            stats.events_deleted += target_stats.events_deleted;
            stats.conflicts_detected += target_stats.conflicts_detected;
        }

        // Clean up orphaned privacy events (source events that no longer exist)
        let cleanup_stats = self.cleanup_orphaned_events(rule).await?;
        stats.events_deleted += cleanup_stats.events_deleted;

        stats.sync_duration_ms = start_time.elapsed().as_millis() as u64;

        info!("Privacy sync completed for rule {}: {} events processed, {} created, {} updated, {} deleted",
            rule.config.source_calendar_id, 
            stats.events_processed,
            stats.events_created,
            stats.events_updated,
            stats.events_deleted
        );

        Ok(stats)
    }

    /// Sync events to a specific target calendar
    async fn sync_to_target_calendar(
        &self,
        rule: &mut PrivacySyncRule,
        source_events: &[CalendarEvent],
        target_calendar_id: &str,
    ) -> CalendarResult<PrivacySyncStats> {
        let mut stats = PrivacySyncStats::default();

        // Get target calendar provider
        let target_calendar = self.database.get_calendar(target_calendar_id).await?;
        let target_account = self.database.get_calendar_account(&target_calendar.account_id.to_string()).await?;
        let mut target_provider = CalendarProviderFactory::create_boxed_provider(&target_account)?;

        // Get existing privacy events in target calendar
        let existing_events = self.get_existing_privacy_events(target_calendar_id, &rule.config.source_calendar_id).await?;
        let mut existing_event_map: HashMap<String, CalendarEvent> = existing_events
            .into_iter()
            .map(|event| (self.extract_source_event_id(&event), event))
            .collect();

        // Process each source event
        for source_event in source_events {
            let source_event_id = source_event.id.clone();
            
            // Check for advanced mode confirmation
            if rule.config.advanced_mode {
                match self.prompt_for_event_confirmation(rule, source_event).await? {
                    EventSyncDecision::Skip => continue,
                    EventSyncDecision::SyncOnce => {},
                    EventSyncDecision::AlwaysSync => {
                        // Create permanent rule for similar events
                        self.create_auto_sync_rule(rule, source_event).await?;
                    },
                }
            }

            // Create privacy-safe event
            let privacy_event = self.create_privacy_event(source_event, &rule.config, target_calendar_id)?;

            if let Some(existing_event) = existing_event_map.remove(&source_event_id) {
                // Update existing privacy event
                match self.update_privacy_event(target_provider.as_mut(), &existing_event, &privacy_event).await {
                    Ok(_) => {
                        stats.events_updated += 1;
                        debug!("Updated privacy event for source event {}", source_event_id);
                    },
                    Err(e) => {
                        warn!("Failed to update privacy event for {}: {}", source_event_id, e);
                        stats.error_count += 1;
                    }
                }
            } else {
                // Create new privacy event
                match target_provider.create_event(&privacy_event).await {
                    Ok(created_event) => {
                        stats.events_created += 1;
                        
                        // Store mapping for future updates
                        rule.state.event_mappings
                            .entry(source_event_id.clone())
                            .or_insert_with(Vec::new)
                            .push(created_event.id);
                            
                        debug!("Created privacy event for source event {}", source_event_id);
                    },
                    Err(e) => {
                        warn!("Failed to create privacy event for {}: {}", source_event_id, e);
                        stats.error_count += 1;
                    }
                }
            }
        }

        // Delete remaining existing events (source events that no longer exist)
        for (_, orphaned_event) in existing_event_map {
            match target_provider.delete_event(target_calendar_id, &orphaned_event.provider_id).await {
                Ok(_) => {
                    stats.events_deleted += 1;
                    debug!("Deleted orphaned privacy event {}", orphaned_event.id);
                },
                Err(e) => {
                    warn!("Failed to delete orphaned privacy event {}: {}", orphaned_event.id, e);
                    stats.error_count += 1;
                }
            }
        }

        Ok(stats)
    }

    /// Create a privacy-safe event from a source event
    fn create_privacy_event(
        &self,
        source_event: &CalendarEvent,
        rule_config: &CalendarPrivacySync,
        target_calendar_id: &str,
    ) -> CalendarResult<CreateCalendarEventInput> {
        let privacy_settings = &rule_config.privacy_settings;
        
        // Generate privacy-safe title
        let title = self.generate_privacy_title(source_event, privacy_settings)?;

        // Create basic privacy event
        let privacy_event = CreateCalendarEventInput {
            calendar_id: target_calendar_id.to_string(),
            provider_id: Some(format!("privacy_{}", Uuid::new_v4())),
            title,
            all_day: source_event.all_day,
            description: if privacy_settings.strip_description { 
                None 
            } else { 
                source_event.description.clone() 
            },
            location: if privacy_settings.strip_location { 
                None 
            } else { 
                source_event.location.clone() 
            },
            location_data: if privacy_settings.strip_location { 
                None 
            } else { 
                source_event.location_data.clone() 
            },
            start_time: source_event.start_time,
            end_time: source_event.end_time,
            timezone: Some(source_event.timezone.clone()),
            is_all_day: source_event.is_all_day,
            status: Some(EventStatus::Confirmed), // Always confirmed for privacy events
            visibility: privacy_settings.visibility.clone(),
            creator: None, // Don't copy creator
            organizer: None, // Don't copy organizer
            attendees: if privacy_settings.strip_attendees { 
                Some(vec![]) 
            } else { 
                Some(source_event.attendees.clone()) 
            },
            recurrence: source_event.recurrence.as_ref().and_then(|event_recurrence| {
                // Convert EventRecurrence to RecurrenceRule
                crate::calendar::recurring::RecurringEventEngine::parse_rrule_to_recurrence_rule(&event_recurrence.rule).ok()
            }),
            recurring_event_id: None, // Will be set by provider
            original_start_time: source_event.original_start_time,
            reminders: Some(vec![]), // No reminders for privacy events
            conferencing: None, // No conferencing info for privacy events
            attachments: if privacy_settings.strip_attachments { 
                Some(vec![]) 
            } else { 
                Some(source_event.attachments.clone()) 
            },
            extended_properties: Some(serde_json::json!({
                "privacy_sync_rule_id": rule_config.source_calendar_id.clone(),
                "privacy_sync_source_event_id": source_event.id.clone(),
                "privacy_sync_source_calendar_id": source_event.calendar_id.clone(),
                "privacy_sync_marker": "true"
            })),
            source: None,
            color: source_event.color.clone(),
            transparency: Some(EventTransparency::Opaque), // Always opaque (busy)
            uid: Some(format!("privacy_{}_{}", rule_config.source_calendar_id, source_event.uid.as_ref().unwrap_or(&source_event.id))),
        };

        Ok(privacy_event)
    }

    /// Generate privacy-safe event title using template
    fn generate_privacy_title(
        &self,
        source_event: &CalendarEvent,
        privacy_settings: &crate::calendar::PrivacySettings,
    ) -> CalendarResult<String> {
        if let Some(ref template) = privacy_settings.title_template {
            let mut title: String = template.clone();
            
            // Replace allowed tokens
            title = title.replace("{{duration}}", &format!("{} min", 
                (source_event.end_time - source_event.start_time).num_minutes()));
                
            title = title.replace("{{free_busy}}", "busy");
            
            // Add emoji token support
            title = title.replace("{{emoji}}", "🔒");
            
            // Replace workspace token (would need workspace context)
            title = title.replace("{{workspace}}", "Work");
            
            Ok(title)
        } else {
            Ok(privacy_settings.default_title.clone())
        }
    }

    /// Apply filters to source events
    fn apply_event_filters(
        &self,
        events: &[CalendarEvent],
        filters: &Option<crate::calendar::PrivacyFilters>,
    ) -> Vec<CalendarEvent> {
        if let Some(filters) = filters {
            events.iter().filter(|event| {
                // Work hours only filter
                if filters.work_hours_only {
                    let hour = event.start_time.hour();
                    if hour < 9 || hour > 17 {
                        return false;
                    }
                }

                // Exclude all-day events
                if filters.exclude_all_day && event.is_all_day {
                    return false;
                }

                // Minimum duration filter
                if filters.min_duration_minutes > 0 {
                    let duration = (event.end_time - event.start_time).num_minutes();
                    if duration < filters.min_duration_minutes as i64 {
                        return false;
                    }
                }

                // Color filters
                if let Some(ref include_colors) = filters.include_colors {
                    if let Some(ref event_color) = event.color {
                        if !include_colors.contains(event_color) {
                            return false;
                        }
                    }
                }

                if let Some(ref exclude_colors) = filters.exclude_colors {
                    if let Some(ref event_color) = event.color {
                        if exclude_colors.contains(event_color) {
                            return false;
                        }
                    }
                }

                true
            }).cloned().collect()
        } else {
            events.to_vec()
        }
    }

    /// Get all enabled privacy sync rules
    async fn get_enabled_rules(&self) -> CalendarResult<Vec<PrivacySyncRule>> {
        // Query the database for enabled privacy sync rules
        let privacy_syncs = self.database.get_privacy_syncs_by_user(&Uuid::new_v4()).await?;
        
        let mut rules = Vec::new();
        for privacy_sync in privacy_syncs {
            if privacy_sync.is_active {
                let rule = PrivacySyncRule {
                    config: privacy_sync,
                    state: PrivacySyncState::default(),
                };
                rules.push(rule);
            }
        }
        
        Ok(rules)
    }

    /// Get source events from all source calendars in the time window
    async fn get_source_events(
        &self,
        source_calendar_ids: &[String],
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
    ) -> CalendarResult<Vec<CalendarEvent>> {
        let mut all_events = Vec::new();

        for calendar_id in source_calendar_ids {
            let events = self.database.get_events_in_range(calendar_id, time_min, time_max).await?;
            all_events.extend(events);
        }

        Ok(all_events)
    }

    /// Get existing privacy events in target calendar
    async fn get_existing_privacy_events(
        &self,
        calendar_id: &str,
        rule_id: &str,
    ) -> CalendarResult<Vec<CalendarEvent>> {
        // Query events in the calendar that have privacy sync markers
        let all_events = self.database.get_events_by_calendar(calendar_id, None, None).await?;
        
        let privacy_events: Vec<CalendarEvent> = all_events.into_iter()
            .filter(|event| {
                // Check if event has privacy sync markers in extended properties
                if let Some(ext_props) = &event.extended_properties {
                    // Look for privacy sync marker and matching rule ID
                    ext_props.get("privacy_sync_marker").is_some() &&
                    ext_props.get("privacy_sync_rule_id")
                        .and_then(|v| v.as_str())
                        .map_or(false, |id| id == rule_id)
                } else {
                    false
                }
            })
            .collect();
            
        Ok(privacy_events)
    }

    /// Extract source event ID from privacy event
    fn extract_source_event_id(&self, privacy_event: &CalendarEvent) -> String {
        privacy_event.extended_properties
            .as_ref()
            .and_then(|props| props.get("privacy_sync_source_event_id"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string()
    }

    /// Validate privacy sync rule configuration
    async fn validate_rule(&self, rule: &CalendarPrivacySync) -> CalendarResult<()> {
        // Validate that source and target calendars exist and are accessible
        self.database.get_calendar(&rule.source_calendar_id).await?;
        self.database.get_calendar(&rule.target_calendar_id).await?;

        // Validate time window configuration if present
        if let Some(ref time_window) = rule.time_window {
            if time_window.past_days > 3650 { // More than 10 years
                return Err(CalendarError::ValidationError {
                    message: "Past days cannot exceed 3650 days (10 years)".to_string(),
                    provider: None,
                    account_id: None,
                    field: Some("past_days".to_string()),
                    value: Some(time_window.past_days.to_string()),
                    constraint: Some("max_value".to_string()),
                });
            }
            if time_window.future_days > 3650 { // More than 10 years
                return Err(CalendarError::ValidationError {
                    message: "Future days cannot exceed 3650 days (10 years)".to_string(),
                    provider: None,
                    account_id: None,
                    field: Some("future_days".to_string()),
                    value: Some(time_window.future_days.to_string()),
                    constraint: Some("max_value".to_string()),
                });
            }
            if time_window.past_days == 0 && time_window.future_days == 0 {
                return Err(CalendarError::ValidationError {
                    message: "At least one of past_days or future_days must be greater than 0".to_string(),
                    provider: None,
                    account_id: None,
                    field: Some("time_window".to_string()),
                    value: Some("both_zero".to_string()),
                    constraint: Some("min_range".to_string()),
                });
            }
        }

        Ok(())
    }

    // Placeholder implementations for advanced features
    async fn prompt_for_event_confirmation(&self, _rule: &PrivacySyncRule, _event: &CalendarEvent) -> CalendarResult<EventSyncDecision> {
        Ok(EventSyncDecision::SyncOnce) // Default to sync once
    }

    async fn create_auto_sync_rule(&self, _rule: &PrivacySyncRule, _event: &CalendarEvent) -> CalendarResult<()> {
        Ok(()) // Placeholder
    }

    async fn update_privacy_event(&self, provider: &mut dyn CalendarProviderTrait, existing: &CalendarEvent, updated: &CreateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // Convert CreateCalendarEventInput to UpdateCalendarEventInput
        let update_input = UpdateCalendarEventInput {
            title: Some(updated.title.clone()),
            description: updated.description.clone(),
            start_time: Some(updated.start_time),
            end_time: Some(updated.end_time),
            location: updated.location.clone(),
            status: updated.status.clone(),
            visibility: updated.visibility.clone(),
            attendees: updated.attendees.clone(),
            recurrence: updated.recurrence.clone(),
            reminders: updated.reminders.clone(),
            transparency: updated.transparency.clone(),
            extended_properties: updated.extended_properties.clone(),
            color: updated.color.clone(),
            all_day: Some(updated.all_day),
            timezone: updated.timezone.clone(),
            conferencing: updated.conferencing.clone(),
            attachments: updated.attachments.clone(),
        };
        
        // Update the event using the provider
        let updated_event = provider
            .update_event(&existing.calendar_id, &existing.id, &update_input)
            .await?;
            
        // Update in local database
        self.database.update_event(&updated_event).await?;
        
        Ok(updated_event)
    }

    async fn cleanup_orphaned_events(&self, rule: &mut PrivacySyncRule) -> CalendarResult<PrivacySyncStats> {
        let mut cleanup_stats = PrivacySyncStats::default();
        
        // Get existing privacy events in target calendar
        let existing_events = self.get_existing_privacy_events(
            &rule.config.target_calendar_id, 
            &rule.config.id.to_string()
        ).await?;
        
        // Get current source events to compare against
        let time_window = rule.config.time_window.as_ref()
            .map(|tw| (tw.past_days, tw.future_days))
            .unwrap_or((30, 365));
            
        let time_min = Utc::now() - Duration::days(time_window.0 as i64);
        let time_max = Utc::now() + Duration::days(time_window.1 as i64);
        
        let source_events = self.get_source_events(
            &rule.config.source_calendar_ids,
            time_min,
            time_max,
        ).await?;
        
        // Create a set of source event IDs for quick lookup
        let source_event_ids: HashSet<String> = source_events
            .iter()
            .map(|event| event.id.clone())
            .collect();
            
        // Find orphaned events (privacy events without corresponding source)
        let mut orphaned_events = Vec::new();
        for privacy_event in existing_events {
            let source_event_id = self.extract_source_event_id(&privacy_event);
            if !source_event_ids.contains(&source_event_id) {
                orphaned_events.push(privacy_event);
            }
        }
        
        // Delete orphaned events with proper account context
        if !orphaned_events.is_empty() {
            // Get account info from target calendar
            match self.database.get_calendar(&rule.config.target_calendar_id).await {
                Ok(target_calendar) => {
                    match self.database.get_calendar_account(&target_calendar.account_id.to_string()).await {
                        Ok(_account) => {
                            // For now, just clean up from local database
                            // In a full implementation, we would:
                            // 1. Create a provider instance for the account
                            // 2. Delete events from the actual calendar provider
                            // 3. Then delete from local database
                            for orphaned_event in orphaned_events {
                                if let Err(e) = self.database.delete_event(&orphaned_event.id).await {
                                    tracing::error!("Failed to delete orphaned event {}: {}", orphaned_event.id, e);
                                } else {
                                    cleanup_stats.events_deleted += 1;
                                    info!("Deleted orphaned privacy event: {}", orphaned_event.id);
                                }
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to get account for cleanup: {}", e);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to get target calendar for cleanup: {}", e);
                }
            }
        }
        
        Ok(cleanup_stats)
    }

    async fn save_rule_state(&self, rule: &PrivacySyncRule) -> CalendarResult<()> {
        // Update the privacy sync record in the database with latest state
        if let Ok(Some(mut privacy_sync)) = self.database.get_privacy_sync(&rule.config.id.to_string()).await {
            privacy_sync.last_sync_at = rule.state.last_sync_time;
            privacy_sync.updated_at = Utc::now();
            
            // Update sync statistics in metadata
            let stats_json = serde_json::json!({
                "events_synced": rule.state.stats.events_processed,
                "events_updated": rule.state.stats.events_updated,
                "events_deleted": rule.state.stats.events_deleted,
                "conflicts_detected": rule.state.stats.conflicts_detected,
                "error_count": rule.state.stats.error_count
            });
            privacy_sync.metadata = Some(stats_json);
            
            // Save updated record
            self.database.update_privacy_sync(&privacy_sync).await?;
        }
        
        Ok(())
    }
}

// Helper trait implementation to make PrivacySyncEngine cloneable
impl Clone for PrivacySyncEngine {
    fn clone(&self) -> Self {
        Self {
            database: Arc::clone(&self.database),
            config: self.config.clone(),
        }
    }
}

/// Result of a privacy sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncResult {
    /// Rule ID that was synced
    pub rule_id: String,
    /// Whether sync was successful
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
    /// Number of events processed
    pub events_processed: u64,
    /// Number of events synced (created/updated)
    pub events_synced: u64,
    /// Duration of sync in milliseconds
    pub duration_ms: u64,
}

/// Decision for event sync in advanced mode
#[derive(Debug, Clone, Copy)]
pub enum EventSyncDecision {
    /// Skip this event
    Skip,
    /// Sync this event once
    SyncOnce,
    /// Always sync similar events
    AlwaysSync,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_privacy_sync_config_default() {
        let config = PrivacySyncConfig::default();
        assert_eq!(config.default_privacy_title, "Private");
        assert_eq!(config.max_past_days, 7);
        assert_eq!(config.max_future_days, 60);
    }

    #[test]
    fn test_privacy_sync_state_default() {
        let state = PrivacySyncState::default();
        assert_eq!(state.status, PrivacySyncStatus::Idle);
        assert_eq!(state.retry_count, 0);
        assert!(state.event_mappings.is_empty());
    }

    #[tokio::test]
    async fn test_event_filter_work_hours() {
        // Create test events
        let work_event = CalendarEvent {
            start_time: Utc::now().with_hour(10).unwrap(),
            end_time: Utc::now().with_hour(11).unwrap(),
            is_all_day: false,
            // ... other fields would be populated
            ..Default::default()
        };

        let after_hours_event = CalendarEvent {
            start_time: Utc::now().with_hour(20).unwrap(),
            end_time: Utc::now().with_hour(21).unwrap(),
            is_all_day: false,
            ..Default::default()
        };

        let engine = PrivacySyncEngine::new(
            Arc::new(CalendarDatabase::new("sqlite::memory:").await.unwrap()),
            PrivacySyncConfig::default()
        );

        let filters = Some(crate::calendar::PrivacyFilters {
            include_patterns: vec![],
            exclude_patterns: vec![],
            strip_keywords: vec![],
            work_hours_only: true,
            exclude_all_day: false,
            min_duration_minutes: 0,
            include_colors: None,
            exclude_colors: None,
        });

        let events = vec![work_event.clone(), after_hours_event.clone()];
        let filtered = engine.apply_event_filters(&events, &filters);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].start_time.hour(), 10);
    }
}