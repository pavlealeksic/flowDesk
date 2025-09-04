/*!
 * Calendar Engine for Flow Desk
 * 
 * A comprehensive calendar system with support for multiple providers (Google Calendar,
 * Microsoft Graph, CalDAV), recurring events, free/busy queries, real-time sync, and
 * privacy-focused cross-calendar busy block mirroring.
 */

pub mod auth;
pub mod config;
pub mod database;
pub mod engine;
pub mod error;
pub mod napi;
pub mod privacy_sync;
pub mod providers;
pub mod recurring;
pub mod search;
pub mod sync;
pub mod types;
pub mod utils;
pub mod webhook;

#[cfg(test)]
pub mod integration_test;

// Re-export main types and engine
pub use engine::CalendarEngine;
pub use error::{CalendarError, CalendarResult};
pub use types::{
    CalendarAccount, CalendarEvent, Calendar, 
    CalendarProvider, CreateCalendarEventInput, 
    UpdateCalendarEventInput, CreateCalendarAccountInput,
    UpdateCalendarAccountInput, CalendarPrivacySync,
    FreeBusySlot, CalendarSyncStatus, EventAttendee, 
    RecurrenceRule, ConferencingInfo, EventAttachment, 
    EventReminder, AttendeeResponseStatus, EventStatus,
    EventVisibility, CalendarAccessLevel, CalendarType,
    CalendarAccountStatus, CalendarAccountConfig,
    GoogleCalendarConfig, OutlookCalendarConfig,
    ExchangeCalendarConfig, CalDavConfig,
    CalendarAccountCredentials, RecurrenceFrequency,
    ReminderMethod, FreeBusyStatus,
    FreeBusyQuery, FreeBusyResponse, MeetingProposal, CalendarDatabase,
    EventTransparency, EventParticipant, EventLocation, ConferencingSolution,
    SyncStatusType, SyncStats, SyncError, PrivacySettings, PrivacyFilters
};

// Provider-specific re-exports
pub use providers::{
    CalendarProviderTrait, GoogleCalendarProvider, 
    OutlookCalendarProvider, CalDavProvider
};

// Privacy sync re-exports
pub use privacy_sync::{PrivacySyncEngine, PrivacySyncRule};

// Webhook handling re-exports
pub use webhook::{WebhookManager, CalendarWebhook, WebhookType};

use std::sync::Arc;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use dashmap::DashMap;

/// Calendar engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarConfig {
    /// Database connection string
    pub database_url: String,
    /// Maximum concurrent sync operations
    pub max_concurrent_syncs: usize,
    /// Default sync interval in minutes
    pub default_sync_interval_minutes: u64,
    /// Webhook server configuration
    pub webhook_config: Option<WebhookConfig>,
    /// Rate limiting configuration
    pub rate_limits: RateLimitConfig,
    /// Privacy sync configuration
    pub privacy_sync: PrivacySyncConfig,
    /// Timezone for server operations
    pub server_timezone: String,
    /// Enable debug logging
    pub debug: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    /// Webhook server host
    pub host: String,
    /// Webhook server port
    pub port: u16,
    /// Base webhook URL path
    pub base_path: String,
    /// Webhook secret for signature verification
    pub secret: String,
    /// SSL/TLS configuration
    pub tls: Option<TlsConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    /// Path to certificate file
    pub cert_path: String,
    /// Path to private key file
    pub key_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Google Calendar API rate limit (requests per minute)
    pub google_calendar_rpm: u32,
    /// Microsoft Graph API rate limit (requests per minute)  
    pub microsoft_graph_rpm: u32,
    /// CalDAV server rate limit (requests per minute)
    pub caldav_rpm: u32,
    /// Burst capacity for rate limiting
    pub burst_capacity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncConfig {
    /// Default privacy event title
    pub default_privacy_title: String,
    /// Maximum sync window in days (past)
    pub max_past_days: u32,
    /// Maximum sync window in days (future)
    pub max_future_days: u32,
    /// Enable advanced mode by default
    pub enable_advanced_mode: bool,
    /// Sync check interval in minutes
    pub sync_interval_minutes: u64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            google_calendar_rpm: 300,     // Google's default limit
            microsoft_graph_rpm: 600,     // Microsoft's default limit
            caldav_rpm: 60,               // Conservative default
            burst_capacity: 10,
        }
    }
}

impl Default for PrivacySyncConfig {
    fn default() -> Self {
        Self {
            default_privacy_title: "Private".to_string(),
            max_past_days: 7,
            max_future_days: 60,
            enable_advanced_mode: false,
            sync_interval_minutes: 5,
        }
    }
}

/// Global calendar state management
pub struct CalendarState {
    /// Active sync operations
    pub active_syncs: Arc<DashMap<String, SyncOperation>>,
    /// Webhook subscriptions by account ID
    pub webhook_subscriptions: Arc<DashMap<String, WebhookSubscription>>,
    /// Privacy sync rules by ID
    pub privacy_sync_rules: Arc<RwLock<DashMap<String, CalendarPrivacySync>>>,
    /// Last sync timestamps by account ID
    pub last_sync_times: Arc<DashMap<String, DateTime<Utc>>>,
    /// Error counts for rate limiting
    pub error_counts: Arc<DashMap<String, u32>>,
}

#[derive(Debug, Clone)]
pub struct SyncOperation {
    pub account_id: String,
    pub operation_type: String,
    pub started_at: DateTime<Utc>,
    pub progress: u8, // 0-100
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookSubscription {
    pub account_id: String,
    pub provider: CalendarProvider,
    pub subscription_id: String,
    pub expiration: DateTime<Utc>,
    pub webhook_url: String,
    pub resource_id: Option<String>,
}

impl Default for CalendarState {
    fn default() -> Self {
        Self {
            active_syncs: Arc::new(DashMap::new()),
            webhook_subscriptions: Arc::new(DashMap::new()),
            privacy_sync_rules: Arc::new(RwLock::new(DashMap::new())),
            last_sync_times: Arc::new(DashMap::new()),
            error_counts: Arc::new(DashMap::new()),
        }
    }
}

/// Calendar metrics for monitoring and analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarMetrics {
    /// Total events across all accounts
    pub total_events: u64,
    /// Events by provider
    pub events_by_provider: std::collections::HashMap<CalendarProvider, u64>,
    /// Active accounts by provider
    pub active_accounts_by_provider: std::collections::HashMap<CalendarProvider, u64>,
    /// Sync operations in last 24 hours
    pub sync_operations_24h: u64,
    /// Privacy sync operations in last 24 hours
    pub privacy_sync_operations_24h: u64,
    /// Average sync duration in milliseconds
    pub avg_sync_duration_ms: u64,
    /// Error rate (errors per 100 operations)
    pub error_rate_percent: f32,
    /// Webhook deliveries in last 24 hours
    pub webhook_deliveries_24h: u64,
}

impl Default for CalendarMetrics {
    fn default() -> Self {
        Self {
            total_events: 0,
            events_by_provider: std::collections::HashMap::new(),
            active_accounts_by_provider: std::collections::HashMap::new(),
            sync_operations_24h: 0,
            privacy_sync_operations_24h: 0,
            avg_sync_duration_ms: 0,
            error_rate_percent: 0.0,
            webhook_deliveries_24h: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calendar_config_default() {
        let config = CalendarConfig::default();
        assert_eq!(config.database_url, "sqlite://calendar.db");
        assert_eq!(config.max_concurrent_syncs, 10);
        assert_eq!(config.default_sync_interval_minutes, 15);
    }

    #[test]
    fn test_rate_limit_config_default() {
        let config = RateLimitConfig::default();
        assert_eq!(config.google_calendar_rpm, 300);
        assert_eq!(config.microsoft_graph_rpm, 600);
        assert_eq!(config.caldav_rpm, 60);
    }

    #[test]
    fn test_privacy_sync_config_default() {
        let config = PrivacySyncConfig::default();
        assert_eq!(config.default_privacy_title, "Private");
        assert_eq!(config.max_past_days, 7);
        assert_eq!(config.max_future_days, 60);
        assert!(!config.enable_advanced_mode);
    }

    #[test]
    fn test_calendar_state_initialization() {
        let state = CalendarState::default();
        assert_eq!(state.active_syncs.len(), 0);
        assert_eq!(state.webhook_subscriptions.len(), 0);
        assert_eq!(state.last_sync_times.len(), 0);
    }
}