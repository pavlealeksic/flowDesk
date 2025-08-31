/*!
 * Calendar Privacy Sync Engine
 * 
 * Implementation of the privacy sync feature from Blueprint.md that mirrors events 
 * from source calendars to target calendars as privacy-safe "busy blocks" with 
 * configurable titles and stripped sensitive details.
 */

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tracing::{debug, error, info, warn};
use tokio::time::{sleep, Duration as TokioDuration};

use crate::calendar::{
    CalendarResult, CalendarError, CalendarPrivacySync, 
    CalendarEvent, CreateCalendarEventInput, UpdateCalendarEventInput,
    Calendar, EventVisibility, EventTransparency, EventStatus,
    CalendarDatabase, CalendarProvider
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
        let rule_id = rule.config.id.clone();
        
        info!("Starting privacy sync for rule: {} ({})", rule.config.name, rule_id);

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

        // Calculate sync window
        let now = Utc::now();
        let time_min = now - Duration::days(rule.config.window.past_days as i64);
        let time_max = now + Duration::days(rule.config.window.future_days as i64);

        debug!("Syncing events from {} to {} for rule {}", 
            time_min.format("%Y-%m-%d"), 
            time_max.format("%Y-%m-%d"),
            rule.config.id
        );

        // Get all source events in the sync window
        let source_events = self.get_source_events(
            &rule.config.source_calendar_ids,
            time_min,
            time_max,
        ).await?;

        stats.events_processed = source_events.len() as u64;

        // Apply filters to source events
        let filtered_events = self.apply_event_filters(&source_events, &rule.config.filters);
        
        debug!("Filtered {} events down to {} for rule {}", 
            source_events.len(), 
            filtered_events.len(), 
            rule.config.id
        );

        // Process each target calendar
        for target_calendar_id in &rule.config.target_calendar_ids {
            let target_stats = self.sync_to_target_calendar(
                rule,
                &filtered_events,
                target_calendar_id,
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
            rule.config.id, 
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
        let target_account = self.database.get_calendar_account(&target_calendar.account_id).await?;
        let target_provider = CalendarProviderFactory::create_provider(&target_account)?;

        // Get existing privacy events in target calendar
        let existing_events = self.get_existing_privacy_events(target_calendar_id, &rule.config.id).await?;
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
                match self.update_privacy_event(&target_provider, &existing_event, &privacy_event).await {
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
        let mut privacy_event = CreateCalendarEventInput {
            calendar_id: target_calendar_id.to_string(),
            provider_id: format!("privacy_{}", Uuid::new_v4()),
            title,
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
            timezone: source_event.timezone.clone(),
            is_all_day: source_event.is_all_day,
            status: EventStatus::Confirmed, // Always confirmed for privacy events
            visibility: privacy_settings.visibility.clone(),
            creator: None, // Don't copy creator
            organizer: None, // Don't copy organizer
            attendees: if privacy_settings.strip_attendees { 
                vec![] 
            } else { 
                source_event.attendees.clone() 
            },
            recurrence: source_event.recurrence.clone(), // Copy recurrence pattern
            recurring_event_id: None, // Will be set by provider
            original_start_time: source_event.original_start_time,
            reminders: vec![], // No reminders for privacy events
            conferencing: None, // No conferencing info for privacy events
            attachments: if privacy_settings.strip_attachments { 
                vec![] 
            } else { 
                source_event.attachments.clone() 
            },
            extended_properties: Some({
                let mut props = HashMap::new();
                props.insert("privacy_sync_rule_id".to_string(), rule_config.id.clone());
                props.insert("privacy_sync_source_event_id".to_string(), source_event.id.clone());
                props.insert("privacy_sync_source_calendar_id".to_string(), source_event.calendar_id.clone());
                props.insert("privacy_sync_marker".to_string(), "true".to_string());
                props
            }),
            source: None,
            color: source_event.color.clone(),
            transparency: EventTransparency::Opaque, // Always opaque (busy)
            uid: format!("privacy_{}_{}", rule_config.id, source_event.uid),
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
            let mut title = template.clone();
            
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
                if let Some(min_duration) = filters.min_duration_minutes {
                    let duration = (event.end_time - event.start_time).num_minutes();
                    if duration < min_duration as i64 {
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
        // This would query the database for enabled privacy sync rules
        // and load their current state
        todo!("Implement get_enabled_rules from database")
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
        // This would query events with privacy_sync_marker extended property
        todo!("Implement get_existing_privacy_events")
    }

    /// Extract source event ID from privacy event
    fn extract_source_event_id(&self, privacy_event: &CalendarEvent) -> String {
        privacy_event.extended_properties
            .as_ref()
            .and_then(|props| props.get("privacy_sync_source_event_id"))
            .cloned()
            .unwrap_or_default()
    }

    /// Validate privacy sync rule configuration
    async fn validate_rule(&self, rule: &CalendarPrivacySync) -> CalendarResult<()> {
        // Validate that source and target calendars exist and are accessible
        for calendar_id in &rule.source_calendar_ids {
            self.database.get_calendar(calendar_id).await?;
        }

        for calendar_id in &rule.target_calendar_ids {
            self.database.get_calendar(calendar_id).await?;
        }

        // Validate sync window
        if rule.window.past_days > self.config.max_past_days {
            return Err(CalendarError::ValidationError {
                message: format!("Past days window {} exceeds maximum {}", 
                    rule.window.past_days, self.config.max_past_days),
                field: Some("window.past_days".to_string()),
                value: Some(rule.window.past_days.to_string()),
                constraint: "max_value".to_string(),
            });
        }

        if rule.window.future_days > self.config.max_future_days {
            return Err(CalendarError::ValidationError {
                message: format!("Future days window {} exceeds maximum {}", 
                    rule.window.future_days, self.config.max_future_days),
                field: Some("window.future_days".to_string()),
                value: Some(rule.window.future_days.to_string()),
                constraint: "max_value".to_string(),
            });
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

    async fn update_privacy_event(&self, _provider: &Box<dyn CalendarProviderTrait>, _existing: &CalendarEvent, _updated: &CreateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        todo!("Implement privacy event update")
    }

    async fn cleanup_orphaned_events(&self, _rule: &mut PrivacySyncRule) -> CalendarResult<PrivacySyncStats> {
        Ok(PrivacySyncStats::default()) // Placeholder
    }

    async fn save_rule_state(&self, _rule: &PrivacySyncRule) -> CalendarResult<()> {
        Ok(()) // Placeholder - would save to database
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
            work_hours_only: true,
            exclude_all_day: false,
            min_duration_minutes: None,
            include_colors: None,
            exclude_colors: None,
        });

        let events = vec![work_event.clone(), after_hours_event.clone()];
        let filtered = engine.apply_event_filters(&events, &filters);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].start_time.hour(), 10);
    }
}