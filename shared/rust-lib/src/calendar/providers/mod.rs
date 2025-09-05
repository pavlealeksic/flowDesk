/*!
 * Calendar Providers
 * 
 * Universal CalDAV provider supporting all CalDAV-compliant servers:
 * - Generic CalDAV servers
 * - Google Calendar (via CalDAV)
 * - iCloud Calendar
 * - Fastmail
 * - Nextcloud/ownCloud
 * - Other RFC 4791 compliant servers
 */

pub mod caldav;
pub mod traits;
pub mod detection;

// Re-export main provider types
pub use traits::*;
pub use caldav::CalDavProvider;
pub use detection::{ProviderDetector, DetectionResult, AutoDetectedConfig};

use std::sync::Arc;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::calendar::{
    CalendarResult, CalendarError, CalendarAccount, CreateCalendarEventInput, UpdateCalendarEventInput, CalendarProvider
};

// Note: SyncStatus, BatchOperationRequest, BatchOperationResult, WebhookNotification, and WebhookSubscription are defined later in this file

/// Provider factory for creating calendar provider instances
pub struct CalendarProviderFactory;

impl CalendarProviderFactory {
    /// Create a boxed provider instance for the given account
    pub fn create_boxed_provider(account: &CalendarAccount) -> CalendarResult<Box<dyn CalendarProviderTrait>> {
        match account.provider {
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => {
                let config = match &account.config {
                    crate::calendar::CalendarAccountConfig::CalDav(config) => config,
                    _ => return Err(CalendarError::ValidationError {
                        message: "Invalid config type for CalDAV provider".to_string(),
                        provider: Some(account.provider.clone()),
                        account_id: Some(account.id.to_string()),
                        field: Some("config".to_string()),
                        value: None,
                        constraint: Some("type_match".to_string()),
                    }),
                };
                
                // Extract credentials from account config - use basic auth for CalDAV
                let credentials = Some(crate::calendar::CalendarAccountCredentials {
                    access_token: String::new(),
                    refresh_token: None,
                    expires_at: None,
                    auth_type: Some("basic".to_string()),
                    username: Some(config.username.clone()),
                    password: Some(config.password.clone()),
                });
                
                Ok(Box::new(CalDavProvider::new(
                    account.id.to_string(),
                    config.clone(),
                    credentials,
                )?))
            },
            _ => Err(CalendarError::ValidationError {
                message: format!("Unsupported provider: {:?}", account.provider),
                provider: Some(account.provider.clone()),
                account_id: Some(account.id.to_string()),
                field: Some("provider".to_string()),
                value: Some(format!("{:?}", account.provider)),
                constraint: Some("supported_provider".to_string()),
            }),
        }
    }

    /// Create a provider instance for the given account
    pub fn create_provider(account: &CalendarAccount) -> CalendarResult<Arc<dyn CalendarProviderTrait>> {
        match account.provider {
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => {
                let config = match &account.config {
                    crate::calendar::CalendarAccountConfig::CalDav(config) => config,
                    _ => return Err(CalendarError::ValidationError {
                        message: "Invalid config type for CalDAV provider".to_string(),
                        provider: Some(account.provider.clone()),
                        account_id: Some(account.id.to_string()),
                        field: Some("config".to_string()),
                        value: None,
                        constraint: Some("type_match".to_string()),
                    }),
                };
                
                // Extract credentials from account config - use basic auth for CalDAV
                let credentials = Some(crate::calendar::CalendarAccountCredentials {
                    access_token: String::new(),
                    refresh_token: None,
                    expires_at: None,
                    auth_type: Some("basic".to_string()),
                    username: Some(config.username.clone()),
                    password: Some(config.password.clone()),
                });
                
                Ok(Arc::new(CalDavProvider::new(
                    account.id.to_string(),
                    config.clone(),
                    credentials,
                )?))
            },
            _ => Err(CalendarError::ValidationError {
                message: format!("Unsupported provider: {:?}", account.provider),
                provider: Some(account.provider.clone()),
                account_id: Some(account.id.to_string()),
                field: Some("provider".to_string()),
                value: Some(format!("{:?}", account.provider)),
                constraint: Some("supported_provider".to_string()),
            }),
        }
    }

    /// Get supported providers
    pub fn supported_providers() -> Vec<CalendarProvider> {
        vec![
            CalendarProvider::CalDav,
            CalendarProvider::ICloud,
            CalendarProvider::Fastmail,
        ]
    }

    /// Get provider capabilities
    pub fn get_provider_capabilities(provider: CalendarProvider) -> ProviderCapabilities {
        match provider {
            CalendarProvider::CalDav | CalendarProvider::CalDAV | CalendarProvider::ICloud | CalendarProvider::Fastmail => ProviderCapabilities {
                supports_webhooks: false,
                supports_push_notifications: false,
                supports_recurring_events: true,
                supports_attendees: true,
                supports_free_busy: true,
                supports_conferencing: false,
                supports_attachments: true,
                supports_reminders: true,
                supports_colors: true,
                supports_multiple_calendars: true,
                supports_calendar_sharing: false,
                max_event_duration_days: None,
                rate_limit_rpm: 60,
                batch_operations: false,
            },
            _ => ProviderCapabilities {
                supports_webhooks: false,
                supports_push_notifications: false,
                supports_recurring_events: false,
                supports_attendees: false,
                supports_free_busy: false,
                supports_conferencing: false,
                supports_attachments: false,
                supports_reminders: false,
                supports_colors: false,
                supports_multiple_calendars: false,
                supports_calendar_sharing: false,
                max_event_duration_days: None,
                rate_limit_rpm: 1,
                batch_operations: false,
            },
        }
    }
}

/// Provider capabilities information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// Supports webhook subscriptions
    pub supports_webhooks: bool,
    /// Supports push notifications
    pub supports_push_notifications: bool,
    /// Supports recurring events
    pub supports_recurring_events: bool,
    /// Supports event attendees
    pub supports_attendees: bool,
    /// Supports free/busy queries
    pub supports_free_busy: bool,
    /// Supports video conferencing integration
    pub supports_conferencing: bool,
    /// Supports file attachments
    pub supports_attachments: bool,
    /// Supports event reminders
    pub supports_reminders: bool,
    /// Supports calendar/event colors
    pub supports_colors: bool,
    /// Supports multiple calendars per account
    pub supports_multiple_calendars: bool,
    /// Supports calendar sharing
    pub supports_calendar_sharing: bool,
    /// Maximum event duration in days
    pub max_event_duration_days: Option<u32>,
    /// Rate limit in requests per minute
    pub rate_limit_rpm: u32,
    /// Supports batch operations
    pub batch_operations: bool,
}

/// Sync operation status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// Sync operation ID
    pub operation_id: String,
    /// Account being synced
    pub account_id: String,
    /// Sync type (full, incremental, etc.)
    pub sync_type: String,
    /// Current progress (0-100)
    pub progress: u8,
    /// Status message
    pub status: String,
    /// Started timestamp
    pub started_at: DateTime<Utc>,
    /// Completed timestamp
    pub completed_at: Option<DateTime<Utc>>,
    /// Number of events processed
    pub events_processed: u64,
    /// Number of errors encountered
    pub error_count: u64,
    /// Last error message
    pub last_error: Option<String>,
    /// Error message (alternative field name)
    pub error_message: Option<String>,
    /// Number of calendars synced
    pub calendars_synced: u32,
    /// Number of events synced
    pub events_synced: u32,
}

/// Batch operation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOperationRequest {
    /// Operation type
    pub operation_type: String,
    /// Operations to perform
    pub operations: Vec<BatchOperation>,
}

/// Individual batch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum BatchOperation {
    /// Create event
    CreateEvent(CreateCalendarEventInput),
    /// Update event
    UpdateEvent {
        event_id: String,
        updates: UpdateCalendarEventInput,
    },
    /// Delete event
    DeleteEvent {
        event_id: String,
    },
}

/// Batch operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOperationResult {
    /// Operation that was performed
    pub operation: BatchOperation,
    /// Whether the operation succeeded
    pub success: bool,
    /// Result data (event ID for create, etc.)
    pub result: Option<serde_json::Value>,
    /// Error message if failed
    pub error: Option<String>,
}

/// Webhook notification payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookNotification {
    /// Notification ID
    pub id: String,
    /// Account that triggered the notification
    pub account_id: String,
    /// Provider that sent the notification
    pub provider: CalendarProvider,
    /// Notification type
    pub notification_type: WebhookNotificationType,
    /// Resource that changed
    pub resource_id: String,
    /// Resource type (calendar, event, etc.)
    pub resource_type: String,
    /// Change type
    pub change_type: WebhookChangeType,
    /// Timestamp of the change
    pub timestamp: DateTime<Utc>,
    /// Additional notification data
    pub data: Option<serde_json::Value>,
}

/// Types of webhook notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookNotificationType {
    /// Calendar was created/updated/deleted
    CalendarChanged,
    /// Event was created/updated/deleted
    EventChanged,
    /// Sync token expired
    SyncTokenExpired,
    /// Account needs reauthorization
    AuthorizationExpired,
    /// Resource moved or renamed
    ResourceMoved,
}

/// Types of changes in webhook notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookChangeType {
    /// Resource was created
    Created,
    /// Resource was updated
    Updated,
    /// Resource was deleted
    Deleted,
    /// Resource was moved
    Moved,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_capabilities() {
        let caldav_caps = CalendarProviderFactory::get_provider_capabilities(CalendarProvider::CalDav);
        assert!(!caldav_caps.supports_webhooks);
        assert!(caldav_caps.supports_attendees);
        assert!(caldav_caps.supports_recurring_events);
        assert_eq!(caldav_caps.rate_limit_rpm, 60);

        let icloud_caps = CalendarProviderFactory::get_provider_capabilities(CalendarProvider::ICloud);
        assert!(!icloud_caps.supports_webhooks);
        assert!(icloud_caps.supports_recurring_events);
        assert_eq!(icloud_caps.rate_limit_rpm, 60);
    }

    #[test]
    fn test_supported_providers() {
        let providers = CalendarProviderFactory::supported_providers();
        assert!(providers.contains(&CalendarProvider::CalDav));
        assert!(providers.contains(&CalendarProvider::ICloud));
        assert!(providers.contains(&CalendarProvider::Fastmail));
    }

    #[test]
    fn test_batch_operation_serialization() {
        let create_op = BatchOperation::CreateEvent(CreateCalendarEventInput {
            // This would be populated with test data
            ..Default::default()
        });

        let json = serde_json::to_string(&create_op).unwrap();
        let deserialized: BatchOperation = serde_json::from_str(&json).unwrap();
        
        match deserialized {
            BatchOperation::CreateEvent(_) => {}, // Expected
            _ => {
                assert!(false, "Unexpected operation type after deserialization - expected CreateEvent");
            }
        }
    }
}