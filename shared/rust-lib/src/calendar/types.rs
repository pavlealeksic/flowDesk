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
    pub provider: CalendarProvider,
    pub status: CalendarAccountStatus,
    pub config: CalendarAccountConfig,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Calendar provider types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarProvider {
    Google,
    Outlook,
    Exchange,
    CalDAV,
    ICloud,
}

/// Calendar account status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAccountStatus {
    Active,
    Error,
    Disabled,
}

/// Calendar account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAccountConfig {
    Google(GoogleCalendarConfig),
    Outlook(OutlookCalendarConfig),
    Exchange(ExchangeCalendarConfig),
    CalDAV(CalDavConfig),
}

/// Google calendar configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleCalendarConfig {
    pub client_id: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
}

/// Outlook calendar configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlookCalendarConfig {
    pub client_id: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
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
    pub username: String,
    pub password: String,
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
}

/// Calendar access levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAccessLevel {
    Owner,
    Read,
    Write,
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
}

/// Event attendee
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventAttendee {
    pub email: String,
    pub name: Option<String>,
    pub response_status: AttendeeResponseStatus,
}

/// Attendee response status
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Event visibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventVisibility {
    Default,
    Public,
    Private,
    Confidential,
}

/// Sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSyncStatus {
    pub last_sync_at: Option<DateTime<Utc>>,
    pub is_syncing: bool,
    pub error: Option<String>,
}

/// Privacy sync for calendar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarPrivacySync {
    pub enabled: bool,
    pub source_calendar_id: String,
    pub target_calendar_id: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCalendarEventInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCalendarAccountInput {
    pub name: String,
    pub provider: CalendarProvider,
    pub config: CalendarAccountConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCalendarAccountInput {
    pub name: Option<String>,
    pub config: Option<CalendarAccountConfig>,
}

/// Calendar type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarType {
    Primary,
    Secondary,
    Shared,
}

/// Calendar account credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarAccountCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Free/busy query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeBusyQuery {
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub calendar_ids: Vec<String>,
}

/// Free/busy response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeBusyResponse {
    pub calendar_id: String,
    pub busy_slots: Vec<FreeBusySlot>,
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

/// Event participant (alias for attendee)
pub type EventParticipant = EventAttendee;

/// Event location details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventLocation {
    pub name: String,
    pub address: Option<String>,
    pub coordinates: Option<(f64, f64)>,
}

/// Conferencing solution details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConferencingSolution {
    pub platform: String,
    pub url: String,
    pub access_code: Option<String>,
    pub phone_numbers: Vec<String>,
}

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

