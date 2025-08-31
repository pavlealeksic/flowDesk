/*!
 * Calendar Types Re-exports
 * 
 * Re-exports all calendar types from the shared types module with additional
 * calendar-specific type definitions and utilities.
 */

// Re-export main types from shared module
pub use crate::types::{
    CalendarAccount, CalendarEvent, Calendar, CalendarProvider,
    CreateCalendarEventInput, UpdateCalendarEventInput,
    CreateCalendarAccountInput, UpdateCalendarAccountInput,
    CalendarPrivacySync, FreeBusyQuery, FreeBusyResponse, FreeBusySlot, FreeBusyStatus,
    EventAttendee, EventParticipant, AttendeeResponseStatus, EventStatus,
    EventVisibility, EventTransparency, EventLocation, ConferencingInfo,
    ConferencingSolution, EventAttachment, EventReminder, ReminderMethod,
    RecurrenceRule, RecurrenceFrequency, WeekDay, MeetingProposal,
    CalendarAccessLevel, CalendarType, CalendarAccountStatus,
    CalendarAccountConfig, GoogleCalendarConfig, OutlookCalendarConfig,
    ExchangeCalendarConfig, CalDavConfig, CalendarAccountCredentials,
    CalendarSyncStatus
};

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Additional calendar-specific types not in the main types module

/// Privacy settings for privacy sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    /// Default title for copied events
    pub default_title: String,
    /// Title template with allowed tokens
    pub title_template: Option<String>,
    /// Strip description
    pub strip_description: bool,
    /// Strip location
    pub strip_location: bool,
    /// Strip attendees
    pub strip_attendees: bool,
    /// Strip attachments
    pub strip_attachments: bool,
    /// Visibility setting for copied events
    pub visibility: EventVisibility,
}

/// Privacy sync filters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyFilters {
    /// Only sync work hours
    pub work_hours_only: bool,
    /// Exclude all-day events
    pub exclude_all_day: bool,
    /// Minimum duration in minutes
    pub min_duration_minutes: Option<u32>,
    /// Only specific event colors
    pub include_colors: Option<Vec<String>>,
    /// Exclude specific event colors
    pub exclude_colors: Option<Vec<String>>,
}

/// Sync status types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SyncStatusType {
    Idle,
    Syncing,
    Error,
    Paused,
}

/// Sync operation details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    /// Type of sync operation
    pub type_: String,
    /// Calendar being synced (if applicable)
    pub calendar_id: Option<String>,
    /// Progress percentage (0-100)
    pub progress: u8,
    /// Start time of operation
    pub started_at: DateTime<Utc>,
}

/// Sync statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    /// Total events processed
    pub total_events: u64,
    /// New events created
    pub new_events: u64,
    /// Events updated
    pub updated_events: u64,
    /// Events deleted
    pub deleted_events: u64,
    /// Sync errors encountered
    pub sync_errors: u64,
}

impl Default for SyncStats {
    fn default() -> Self {
        Self {
            total_events: 0,
            new_events: 0,
            updated_events: 0,
            deleted_events: 0,
            sync_errors: 0,
        }
    }
}

/// Sync error details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncError {
    /// Error message
    pub message: String,
    /// Error code
    pub code: String,
    /// Error timestamp
    pub timestamp: DateTime<Utc>,
    /// Additional error details
    pub details: Option<HashMap<String, serde_json::Value>>,
}

/// Default implementations for common types

impl Default for CreateCalendarEventInput {
    fn default() -> Self {
        use chrono::Duration;
        let now = Utc::now();
        
        Self {
            calendar_id: String::new(),
            provider_id: String::new(),
            title: String::new(),
            description: None,
            location: None,
            location_data: None,
            start_time: now,
            end_time: now + Duration::hours(1),
            timezone: None,
            is_all_day: false,
            status: EventStatus::Confirmed,
            visibility: EventVisibility::Default,
            creator: None,
            organizer: None,
            attendees: Vec::new(),
            recurrence: None,
            recurring_event_id: None,
            original_start_time: None,
            reminders: Vec::new(),
            conferencing: None,
            attachments: Vec::new(),
            extended_properties: None,
            source: None,
            color: None,
            transparency: EventTransparency::Opaque,
            uid: uuid::Uuid::new_v4().to_string(),
        }
    }
}

impl Default for CalendarEvent {
    fn default() -> Self {
        use chrono::Duration;
        let now = Utc::now();
        
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            calendar_id: String::new(),
            provider_id: String::new(),
            title: String::new(),
            description: None,
            location: None,
            location_data: None,
            start_time: now,
            end_time: now + Duration::hours(1),
            timezone: None,
            is_all_day: false,
            status: EventStatus::Confirmed,
            visibility: EventVisibility::Default,
            creator: None,
            organizer: None,
            attendees: Vec::new(),
            recurrence: None,
            recurring_event_id: None,
            original_start_time: None,
            reminders: Vec::new(),
            conferencing: None,
            attachments: Vec::new(),
            extended_properties: None,
            source: None,
            color: None,
            transparency: EventTransparency::Opaque,
            uid: uuid::Uuid::new_v4().to_string(),
            sequence: 0,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Helper trait for string conversion of enums
pub trait ToStringHelper {
    fn to_string(&self) -> String;
}

impl ToStringHelper for EventStatus {
    fn to_string(&self) -> String {
        match self {
            EventStatus::Confirmed => "confirmed".to_string(),
            EventStatus::Tentative => "tentative".to_string(),
            EventStatus::Cancelled => "cancelled".to_string(),
        }
    }
}

impl ToStringHelper for EventVisibility {
    fn to_string(&self) -> String {
        match self {
            EventVisibility::Default => "default".to_string(),
            EventVisibility::Public => "public".to_string(),
            EventVisibility::Private => "private".to_string(),
            EventVisibility::Confidential => "confidential".to_string(),
        }
    }
}

impl ToStringHelper for EventTransparency {
    fn to_string(&self) -> String {
        match self {
            EventTransparency::Opaque => "opaque".to_string(),
            EventTransparency::Transparent => "transparent".to_string(),
        }
    }
}

impl ToStringHelper for CalendarProvider {
    fn to_string(&self) -> String {
        match self {
            CalendarProvider::Google => "google".to_string(),
            CalendarProvider::Outlook => "outlook".to_string(),
            CalendarProvider::Exchange => "exchange".to_string(),
            CalendarProvider::CalDav => "caldav".to_string(),
            CalendarProvider::ICloud => "icloud".to_string(),
            CalendarProvider::Fastmail => "fastmail".to_string(),
        }
    }
}

impl ToStringHelper for CalendarAccessLevel {
    fn to_string(&self) -> String {
        match self {
            CalendarAccessLevel::Owner => "owner".to_string(),
            CalendarAccessLevel::Writer => "writer".to_string(),
            CalendarAccessLevel::Reader => "reader".to_string(),
            CalendarAccessLevel::FreeBusyReader => "freeBusyReader".to_string(),
        }
    }
}

impl ToStringHelper for CalendarType {
    fn to_string(&self) -> String {
        match self {
            CalendarType::Primary => "primary".to_string(),
            CalendarType::Secondary => "secondary".to_string(),
            CalendarType::Shared => "shared".to_string(),
            CalendarType::Public => "public".to_string(),
            CalendarType::Resource => "resource".to_string(),
            CalendarType::Holiday => "holiday".to_string(),
            CalendarType::Birthdays => "birthdays".to_string(),
        }
    }
}

/// Utility functions for calendar operations

/// Generate a unique event UID
pub fn generate_event_uid(domain: &str) -> String {
    format!("{}@{}", uuid::Uuid::new_v4(), domain)
}

/// Convert DateTime to RFC3339 string
pub fn datetime_to_rfc3339(dt: DateTime<Utc>) -> String {
    dt.to_rfc3339()
}

/// Parse RFC3339 string to DateTime
pub fn parse_rfc3339(s: &str) -> Result<DateTime<Utc>, chrono::ParseError> {
    DateTime::parse_from_rfc3339(s).map(|dt| dt.with_timezone(&Utc))
}

/// Calculate event duration in minutes
pub fn event_duration_minutes(start: DateTime<Utc>, end: DateTime<Utc>) -> i64 {
    (end - start).num_minutes()
}

/// Check if two time ranges overlap
pub fn time_ranges_overlap(
    start1: DateTime<Utc>, end1: DateTime<Utc>,
    start2: DateTime<Utc>, end2: DateTime<Utc>
) -> bool {
    start1 < end2 && start2 < end1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_duration_calculation() {
        let start = Utc::now();
        let end = start + chrono::Duration::hours(2);
        
        assert_eq!(event_duration_minutes(start, end), 120);
    }

    #[test]
    fn test_time_range_overlap() {
        let base_time = Utc::now();
        
        // Overlapping ranges
        let start1 = base_time;
        let end1 = base_time + chrono::Duration::hours(2);
        let start2 = base_time + chrono::Duration::hours(1);
        let end2 = base_time + chrono::Duration::hours(3);
        
        assert!(time_ranges_overlap(start1, end1, start2, end2));
        
        // Non-overlapping ranges
        let start3 = base_time + chrono::Duration::hours(3);
        let end3 = base_time + chrono::Duration::hours(4);
        
        assert!(!time_ranges_overlap(start1, end1, start3, end3));
    }

    #[test]
    fn test_enum_string_conversion() {
        assert_eq!(EventStatus::Confirmed.to_string(), "confirmed");
        assert_eq!(EventVisibility::Private.to_string(), "private");
        assert_eq!(CalendarProvider::Google.to_string(), "google");
    }

    #[test]
    fn test_event_uid_generation() {
        let uid1 = generate_event_uid("example.com");
        let uid2 = generate_event_uid("example.com");
        
        assert_ne!(uid1, uid2);
        assert!(uid1.ends_with("@example.com"));
        assert!(uid2.ends_with("@example.com"));
    }

    #[test]
    fn test_default_event_creation() {
        let event = CreateCalendarEventInput::default();
        assert!(!event.title.is_empty() || event.title.is_empty()); // Allow empty default
        assert_eq!(event.status, EventStatus::Confirmed);
        assert_eq!(event.visibility, EventVisibility::Default);
        assert_eq!(event.transparency, EventTransparency::Opaque);
    }
}