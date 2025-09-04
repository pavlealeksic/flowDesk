/*!
 * Calendar Types Re-exports
 * 
 * Re-exports all calendar types from the shared types module with additional
 * calendar-specific type definitions and utilities.
 */

// Calendar core types - defined locally for now
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Calendar account representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub provider: CalendarProvider,
    pub status: CalendarAccountStatus,
    pub config: CalendarAccountConfig,
    pub credentials: HashMap<String, serde_json::Value>,
    pub default_calendar_id: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub next_sync_at: Option<DateTime<Utc>>,
    pub sync_interval_minutes: u32,
    pub is_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Calendar provider types
#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum CalendarProvider {
    Google,
    Outlook,
    Exchange,
    CalDAV,
    CalDav,
    ICloud,
    Fastmail,
}

impl std::fmt::Display for CalendarProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarProvider::Google => write!(f, "Google"),
            CalendarProvider::Outlook => write!(f, "Outlook"),
            CalendarProvider::Exchange => write!(f, "Exchange"),
            CalendarProvider::CalDAV => write!(f, "CalDAV"),
            CalendarProvider::CalDav => write!(f, "CalDAV"),
            CalendarProvider::ICloud => write!(f, "iCloud"),
            CalendarProvider::Fastmail => write!(f, "Fastmail"),
        }
    }
}

/// Calendar account status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAccountStatus {
    Active,
    Error,
    Disabled,
    AuthError,
    QuotaExceeded,
    Suspended,
}

impl std::fmt::Display for CalendarAccountStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarAccountStatus::Active => write!(f, "Active"),
            CalendarAccountStatus::Error => write!(f, "Error"),
            CalendarAccountStatus::Disabled => write!(f, "Disabled"),
            CalendarAccountStatus::AuthError => write!(f, "AuthError"),
            CalendarAccountStatus::QuotaExceeded => write!(f, "QuotaExceeded"),
            CalendarAccountStatus::Suspended => write!(f, "Suspended"),
        }
    }
}

/// Calendar account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAccountConfig {
    Google(GoogleCalendarConfig),
    Outlook(OutlookCalendarConfig),
    Exchange(ExchangeCalendarConfig),
    CalDAV(CalDavConfig),
    CalDav(CalDavConfig),
}

/// Google calendar configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleCalendarConfig {
    pub client_id: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub oauth_tokens: Option<CalendarAccountCredentials>,
}

/// Outlook calendar configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlookCalendarConfig {
    pub client_id: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub oauth_tokens: Option<CalendarAccountCredentials>,
}

/// Exchange calendar configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeCalendarConfig {
    pub server_url: String,
    pub username: String,
    pub password: String,
}

/// CalDAV configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalDavConfig {
    pub server_url: String,
    pub host: String,
    pub username: String,
    pub password: String,
    pub accept_invalid_certs: bool,
    pub oauth_tokens: Option<CalendarAccountCredentials>,
}

/// Calendar representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calendar {
    pub id: String,
    pub account_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub is_primary: bool,
    pub access_level: CalendarAccessLevel,
    pub description: Option<String>,
    pub timezone: String,
    pub type_: CalendarType,
    pub provider_id: String,
    pub is_visible: bool,
    pub is_selected: bool,
    pub can_sync: bool,
    pub sync_status: Option<CalendarSyncStatus>,
    pub location_data: Option<serde_json::Value>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub is_being_synced: bool,
    pub sync_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Calendar access levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAccessLevel {
    Owner,
    Read,
    Write,
    Reader,
    Writer,
    FreeBusyReader,
}

impl std::fmt::Display for CalendarAccessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarAccessLevel::Owner => write!(f, "Owner"),
            CalendarAccessLevel::Read => write!(f, "Read"),
            CalendarAccessLevel::Write => write!(f, "Write"),
            CalendarAccessLevel::Reader => write!(f, "Reader"),
            CalendarAccessLevel::Writer => write!(f, "Writer"),
            CalendarAccessLevel::FreeBusyReader => write!(f, "FreeBusyReader"),
        }
    }
}

/// Calendar event representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub calendar_id: String,
    pub account_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: bool,
    pub location: Option<String>,
    pub attendees: Vec<EventAttendee>,
    pub status: EventStatus,
    pub visibility: EventVisibility,
    pub provider_id: String,
    pub location_data: Option<serde_json::Value>,
    pub timezone: String,
    pub is_all_day: bool,
    pub color: Option<String>,
    pub uid: Option<String>,
    pub extended_properties: Option<serde_json::Value>,
    pub attachments: Vec<EventAttachment>,
    pub recurrence: Option<EventRecurrence>,
    pub recurring_event_id: Option<String>,
    pub original_start_time: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Default for CalendarEvent {
    fn default() -> Self {
        Self {
            id: "".to_string(),
            calendar_id: "".to_string(),
            account_id: Uuid::new_v4(),
            title: "".to_string(),
            description: None,
            start_time: Utc::now(),
            end_time: Utc::now(),
            all_day: false,
            location: None,
            attendees: vec![],
            status: EventStatus::Confirmed,
            visibility: EventVisibility::Default,
            provider_id: "".to_string(),
            location_data: None,
            timezone: "UTC".to_string(),
            is_all_day: false,
            color: None,
            uid: None,
            extended_properties: None,
            attachments: vec![],
            recurrence: None,
            recurring_event_id: None,
            original_start_time: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

/// Event attendee
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventAttendee {
    pub email: String,
    pub name: Option<String>,
    pub response_status: AttendeeResponseStatus,
    pub display_name: Option<String>,
    pub self_: bool,
    pub optional: bool,
    pub is_resource: bool,
    pub comment: Option<String>,
    pub additional_emails: Vec<String>,
}

/// Attendee response status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AttendeeResponseStatus {
    Accepted,
    Declined,
    Tentative,
    NeedsAction,
}

/// Event status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventStatus {
    Confirmed,
    Tentative,
    Cancelled,
}

impl std::fmt::Display for EventStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventStatus::Confirmed => write!(f, "Confirmed"),
            EventStatus::Tentative => write!(f, "Tentative"),
            EventStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

/// Event visibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventVisibility {
    Default,
    Public,
    Private,
    Confidential,
}

impl std::fmt::Display for EventVisibility {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventVisibility::Default => write!(f, "Default"),
            EventVisibility::Public => write!(f, "Public"),
            EventVisibility::Private => write!(f, "Private"),
            EventVisibility::Confidential => write!(f, "Confidential"),
        }
    }
}

/// Sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSyncStatus {
    pub account_id: String,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_sync: Option<DateTime<Utc>>,
    pub is_syncing: bool,
    pub error: Option<String>,
    pub error_message: Option<String>,
    pub status: String,
    pub total_calendars: u32,
    pub total_events: u32,
}

/// Privacy sync for calendar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarPrivacySync {
    pub id: Uuid,
    pub enabled: bool,
    pub is_active: bool,
    pub source_calendar_id: String,  // Primary source calendar
    pub source_calendar_ids: Vec<String>,  // Additional source calendars
    pub target_calendar_id: String,
    pub name: String,
    pub filters: Vec<String>,
    pub advanced_mode: bool,
    pub privacy_settings: PrivacySettings,
    pub time_window: Option<PrivacySyncTimeWindow>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

/// Time window for privacy sync operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncTimeWindow {
    pub past_days: u32,
    pub future_days: u32,
}

/// Free/busy slot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeBusySlot {
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub status: FreeBusyStatus,
}

/// Free/busy status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FreeBusyStatus {
    Free,
    Busy,
    Tentative,
}

/// Conferencing info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConferencingInfo {
    pub platform: String,
    pub url: Option<String>,
    pub phone: Option<String>,
    pub access_code: Option<String>,
}

/// Event attachment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventAttachment {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub url: Option<String>,
}

/// Event reminder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventReminder {
    pub minutes_before: i32,
    pub method: ReminderMethod,
}

/// Reminder method
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReminderMethod {
    Email,
    Popup,
    SMS,
}

/// Recurrence rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurrenceRule {
    pub frequency: RecurrenceFrequency,
    pub interval: i32,
    pub count: Option<i32>,
    pub until: Option<DateTime<Utc>>,
    pub by_day: Option<Vec<u8>>,
    pub by_month: Option<Vec<u8>>,
    pub by_month_day: Option<Vec<i8>>,
}

/// Recurrence frequency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecurrenceFrequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

/// Input types for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCalendarEventInput {
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: bool,
    pub location: Option<String>,
    pub calendar_id: String,
    pub provider_id: Option<String>,
    pub location_data: Option<serde_json::Value>,
    pub timezone: Option<String>,
    pub is_all_day: bool,
    pub status: Option<EventStatus>,
    pub visibility: Option<EventVisibility>,
    pub attendees: Option<Vec<EventAttendee>>,
    pub reminders: Option<Vec<EventReminder>>,
    pub recurrence: Option<RecurrenceRule>,
    pub uid: Option<String>,
    pub transparency: Option<EventTransparency>,
    pub source: Option<String>,
    pub recurring_event_id: Option<String>,
    pub original_start_time: Option<DateTime<Utc>>,
    pub color: Option<String>,
    pub creator: Option<EventAttendee>,
    pub organizer: Option<EventAttendee>,
    pub conferencing: Option<ConferencingSolution>,
    pub attachments: Option<Vec<EventAttachment>>,
    pub extended_properties: Option<serde_json::Value>,
}

impl Default for CreateCalendarEventInput {
    fn default() -> Self {
        Self {
            title: "".to_string(),
            description: None,
            start_time: Utc::now(),
            end_time: Utc::now(),
            all_day: false,
            location: None,
            calendar_id: "".to_string(),
            provider_id: None,
            location_data: None,
            timezone: None,
            is_all_day: false,
            status: None,
            visibility: None,
            attendees: None,
            reminders: None,
            recurrence: None,
            uid: None,
            transparency: None,
            source: None,
            recurring_event_id: None,
            original_start_time: None,
            color: None,
            creator: None,
            organizer: None,
            conferencing: None,
            attachments: None,
            extended_properties: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCalendarEventInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub location: Option<String>,
    pub status: Option<EventStatus>,
    pub visibility: Option<EventVisibility>,
    pub attendees: Option<Vec<EventAttendee>>,
    pub recurrence: Option<RecurrenceRule>,
    pub reminders: Option<Vec<EventReminder>>,
    pub transparency: Option<EventTransparency>,
    pub extended_properties: Option<serde_json::Value>,
    pub color: Option<String>,
    pub all_day: Option<bool>,
    pub timezone: Option<String>,
    pub conferencing: Option<ConferencingSolution>,
    pub attachments: Option<Vec<EventAttachment>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCalendarAccountInput {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub provider: CalendarProvider,
    pub status: CalendarAccountStatus,
    pub config: CalendarAccountConfig,
    pub credentials: Option<CalendarCredentials>,
    pub default_calendar_id: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub next_sync_at: Option<DateTime<Utc>>,
    pub sync_interval_minutes: i32,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCalendarAccountInput {
    pub name: Option<String>,
    pub config: Option<CalendarAccountConfig>,
    pub default_calendar_id: Option<String>,
    pub sync_interval_minutes: Option<i32>,
    pub is_enabled: Option<bool>,
}

/// Calendar type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarType {
    Primary,
    Secondary,
    Shared,
    Public,
    Resource,
    Holiday,
    Birthdays,
}

impl std::fmt::Display for CalendarType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalendarType::Primary => write!(f, "Primary"),
            CalendarType::Secondary => write!(f, "Secondary"),
            CalendarType::Shared => write!(f, "Shared"),
            CalendarType::Public => write!(f, "Public"),
            CalendarType::Resource => write!(f, "Resource"),
            CalendarType::Holiday => write!(f, "Holiday"),
            CalendarType::Birthdays => write!(f, "Birthdays"),
        }
    }
}

/// Calendar account credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarAccountCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub auth_type: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// Free/busy query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeBusyQuery {
    pub time_min: DateTime<Utc>,
    pub time_max: DateTime<Utc>,
    pub emails: Vec<String>,
    pub timezone: Option<String>,
}

/// Free/busy response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeBusyResponse {
    pub time_min: DateTime<Utc>,
    pub time_max: DateTime<Utc>,
    pub free_busy: std::collections::HashMap<String, Vec<FreeBusySlot>>,
    pub errors: Option<Vec<String>>,
}

/// Meeting proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingProposal {
    pub title: String,
    pub duration_minutes: i32,
    pub attendees: Vec<String>,
    pub suggested_times: Vec<DateTime<Utc>>,
}

/// Calendar database type alias
pub type CalendarDatabase = crate::calendar::database::CalendarDatabase;

/// Event transparency (for free/busy)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventTransparency {
    Opaque,
    Transparent,
}

impl std::fmt::Display for EventTransparency {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventTransparency::Opaque => write!(f, "Opaque"),
            EventTransparency::Transparent => write!(f, "Transparent"),
        }
    }
}

// Duplicate EventAttachment removed - already defined above

/// Event recurrence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventRecurrence {
    pub rule: String,
    pub exceptions: Vec<DateTime<Utc>>,
}

/// Conferencing solution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConferencingSolution {
    pub solution_type: ConferencingType,
    pub url: Option<String>,
    pub conference_id: Option<String>,
    pub entry_points: Vec<ConferenceEntryPoint>,
}

/// Conferencing type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConferencingType {
    Meet,
    Zoom,
    Teams,
    Custom,
}

/// Conference entry point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConferenceEntryPoint {
    pub entry_point_type: String,
    pub uri: String,
    pub label: Option<String>,
    pub pin: Option<String>,
}

/// Calendar credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub client_id: String,
    pub client_secret: String,
}

/// Event participant (alias for attendee)
pub type EventParticipant = EventAttendee;

/// Event location details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventLocation {
    pub name: String,
    pub address: Option<String>,
    pub coordinates: Option<(f64, f64)>,
}

// Duplicate ConferencingSolution removed - already defined above

/// Sync status type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStatusType {
    Idle,
    Syncing,
    Error,
    Completed,
}

/// Sync statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub events_synced: usize,
    pub calendars_synced: usize,
    pub last_sync_duration: Option<std::time::Duration>,
}


/// Sync error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncError {
    pub message: String,
    pub code: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// Privacy settings for calendar sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    pub strip_sensitive_info: bool,
    pub default_title: String,
    pub show_busy_only: bool,
    pub strip_description: bool,
    pub strip_location: bool,
    pub strip_attendees: bool,
    pub strip_attachments: bool,
    pub visibility: Option<EventVisibility>,
    pub title_template: Option<String>,
}

/// Privacy filters for calendar sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyFilters {
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub strip_keywords: Vec<String>,
    pub work_hours_only: bool,
    pub exclude_all_day: bool,
    pub min_duration_minutes: u32,
    pub include_colors: Option<Vec<String>>,
    pub exclude_colors: Option<Vec<String>>,
}
