/*!
 * Calendar Engine Error Types
 * 
 * Comprehensive error handling for calendar operations including provider-specific
 * errors, authentication failures, rate limiting, and sync conflicts.
 */

use std::fmt;
use thiserror::Error;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::calendar::CalendarProvider;

/// Result type for calendar operations
pub type CalendarResult<T> = Result<T, CalendarError>;

/// Calendar engine error types
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum CalendarError {
    /// Authentication/authorization errors
    #[error("Authentication failed: {message}")]
    AuthenticationError {
        message: String,
        provider: CalendarProvider,
        account_id: String,
        needs_reauth: bool,
    },

    /// OAuth token errors
    #[error("Token error: {message}")]
    TokenError {
        message: String,
        provider: CalendarProvider,
        account_id: String,
        token_type: String, // access, refresh, etc.
        expired: bool,
    },

    /// API rate limiting errors
    #[error("Rate limit exceeded for {provider:?}: {message}")]
    RateLimitError {
        provider: CalendarProvider,
        account_id: String,
        message: String,
        retry_after: Option<DateTime<Utc>>,
        daily_limit_exceeded: bool,
    },

    /// API quota/permission errors
    #[error("API quota exceeded: {message}")]
    QuotaExceededError {
        provider: CalendarProvider,
        account_id: String,
        message: String,
        quota_type: String, // daily, hourly, per-user, etc.
        reset_time: Option<DateTime<Utc>>,
    },

    /// Calendar or event not found errors
    #[error("Resource not found: {resource_type} {resource_id}")]
    NotFoundError {
        resource_type: String, // calendar, event, account
        resource_id: String,
        provider: CalendarProvider,
        account_id: String,
    },

    /// Permission/access denied errors
    #[error("Permission denied: {message}")]
    PermissionDeniedError {
        message: String,
        provider: CalendarProvider,
        account_id: String,
        required_permission: String,
        resource_id: Option<String>,
    },

    /// Event conflict errors (overlapping events, etc.)
    #[error("Calendar conflict: {message}")]
    ConflictError {
        message: String,
        calendar_id: String,
        event_id: Option<String>,
        conflicting_event_id: Option<String>,
        conflict_type: ConflictType,
    },

    /// Recurring event errors
    #[error("Recurring event error: {message}")]
    RecurringEventError {
        message: String,
        event_id: String,
        recurrence_id: Option<String>,
        error_type: RecurringEventErrorType,
    },

    /// Sync operation errors
    #[error("Sync error: {message}")]
    SyncError {
        message: String,
        account_id: String,
        calendar_id: Option<String>,
        sync_type: String, // full, incremental, privacy
        operation: String,  // create, update, delete
        sync_token: Option<String>,
    },

    /// Database operation errors
    #[error("Database error: {message}")]
    DatabaseError {
        message: String,
        operation: String, // insert, update, delete, select
        table: Option<String>,
        constraint_violation: bool,
    },

    /// Network/connection errors
    #[error("Network error: {message}")]
    NetworkError {
        message: String,
        provider: CalendarProvider,
        account_id: String,
        status_code: Option<u16>,
        is_timeout: bool,
        is_connection_error: bool,
    },

    /// Data validation errors
    #[error("Validation error: {message}")]
    ValidationError {
        message: String,
        field: Option<String>,
        value: Option<String>,
        constraint: String, // required, format, range, etc.
    },

    /// Serialization/deserialization errors
    #[error("Serialization error: {message}")]
    SerializationError {
        message: String,
        data_type: String,
        operation: String, // serialize, deserialize
    },

    /// Privacy sync specific errors
    #[error("Privacy sync error: {message}")]
    PrivacySyncError {
        message: String,
        rule_id: String,
        source_calendar_id: String,
        target_calendar_id: String,
        event_id: Option<String>,
        operation: String,
    },

    /// Webhook errors
    #[error("Webhook error: {message}")]
    WebhookError {
        message: String,
        provider: CalendarProvider,
        account_id: String,
        webhook_url: Option<String>,
        subscription_id: Option<String>,
        error_type: WebhookErrorType,
    },

    /// Provider-specific errors
    #[error("Provider error: {message}")]
    ProviderError {
        message: String,
        provider: CalendarProvider,
        account_id: String,
        provider_error_code: Option<String>,
        provider_error_details: Option<serde_json::Value>,
    },

    /// Configuration errors
    #[error("Configuration error: {message}")]
    ConfigurationError {
        message: String,
        config_field: Option<String>,
        config_value: Option<String>,
    },

    /// Timezone/date handling errors
    #[error("Timezone error: {message}")]
    TimezoneError {
        message: String,
        timezone: Option<String>,
        date_time: Option<String>,
    },

    /// Generic internal errors
    #[error("Internal error: {message}")]
    InternalError {
        message: String,
        operation: Option<String>,
        context: Option<serde_json::Value>,
    },
}

/// Types of calendar conflicts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictType {
    /// Event time overlaps with another event
    TimeOverlap,
    /// Event already exists (duplicate)
    DuplicateEvent,
    /// Calendar resource conflict (room booked, etc.)
    ResourceConflict,
    /// Attendee availability conflict
    AttendeeConflict,
    /// Sync conflict (local vs remote changes)
    SyncConflict,
}

/// Types of recurring event errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecurringEventErrorType {
    /// Invalid recurrence rule (RRULE)
    InvalidRecurrenceRule,
    /// Exception instance not found
    ExceptionNotFound,
    /// Cannot modify master event
    CannotModifyMaster,
    /// Recurrence expansion error
    ExpansionError,
    /// Too many instances generated
    TooManyInstances,
}

/// Types of webhook errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookErrorType {
    /// Subscription creation failed
    SubscriptionFailed,
    /// Subscription renewal failed
    RenewalFailed,
    /// Webhook delivery failed
    DeliveryFailed,
    /// Invalid webhook payload
    InvalidPayload,
    /// Webhook signature verification failed
    SignatureVerificationFailed,
    /// Subscription expired
    SubscriptionExpired,
}

impl CalendarError {
    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            CalendarError::NetworkError { is_timeout, is_connection_error, .. } => {
                *is_timeout || *is_connection_error
            },
            CalendarError::RateLimitError { .. } => true,
            CalendarError::QuotaExceededError { .. } => false, // Usually not retryable immediately
            CalendarError::DatabaseError { constraint_violation, .. } => !constraint_violation,
            CalendarError::WebhookError { error_type, .. } => {
                matches!(error_type, 
                    WebhookErrorType::DeliveryFailed | 
                    WebhookErrorType::RenewalFailed
                )
            },
            CalendarError::SyncError { .. } => true,
            CalendarError::ProviderError { .. } => true, // Provider might be temporarily down
            _ => false,
        }
    }

    /// Check if error requires user intervention (re-authentication, etc.)
    pub fn requires_user_intervention(&self) -> bool {
        match self {
            CalendarError::AuthenticationError { needs_reauth, .. } => *needs_reauth,
            CalendarError::TokenError { expired, .. } => *expired,
            CalendarError::PermissionDeniedError { .. } => true,
            CalendarError::ConfigurationError { .. } => true,
            _ => false,
        }
    }

    /// Get suggested retry delay in seconds
    pub fn retry_delay_seconds(&self) -> Option<u64> {
        match self {
            CalendarError::RateLimitError { retry_after, .. } => {
                retry_after.map(|time| {
                    let now = Utc::now();
                    if time > now {
                        (time - now).num_seconds() as u64
                    } else {
                        60 // Default 1 minute
                    }
                })
            },
            CalendarError::NetworkError { .. } => Some(5),
            CalendarError::DatabaseError { .. } => Some(1),
            CalendarError::SyncError { .. } => Some(30),
            CalendarError::ProviderError { .. } => Some(10),
            _ => None,
        }
    }

    /// Get error severity level
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            CalendarError::AuthenticationError { .. } => ErrorSeverity::High,
            CalendarError::TokenError { .. } => ErrorSeverity::High,
            CalendarError::PermissionDeniedError { .. } => ErrorSeverity::High,
            CalendarError::QuotaExceededError { .. } => ErrorSeverity::Medium,
            CalendarError::ConflictError { .. } => ErrorSeverity::Medium,
            CalendarError::ValidationError { .. } => ErrorSeverity::Medium,
            CalendarError::RateLimitError { .. } => ErrorSeverity::Low,
            CalendarError::NetworkError { .. } => ErrorSeverity::Low,
            CalendarError::NotFoundError { .. } => ErrorSeverity::Low,
            _ => ErrorSeverity::Medium,
        }
    }

    /// Create authentication error
    pub fn auth_error(
        message: impl Into<String>, 
        provider: CalendarProvider, 
        account_id: impl Into<String>
    ) -> Self {
        Self::AuthenticationError {
            message: message.into(),
            provider,
            account_id: account_id.into(),
            needs_reauth: true,
        }
    }

    /// Create rate limit error
    pub fn rate_limit_error(
        provider: CalendarProvider,
        account_id: impl Into<String>,
        retry_after: Option<DateTime<Utc>>,
    ) -> Self {
        Self::RateLimitError {
            provider,
            account_id: account_id.into(),
            message: "API rate limit exceeded".to_string(),
            retry_after,
            daily_limit_exceeded: false,
        }
    }

    /// Create not found error
    pub fn not_found_error(
        resource_type: impl Into<String>,
        resource_id: impl Into<String>,
        provider: CalendarProvider,
        account_id: impl Into<String>,
    ) -> Self {
        Self::NotFoundError {
            resource_type: resource_type.into(),
            resource_id: resource_id.into(),
            provider,
            account_id: account_id.into(),
        }
    }
}

/// Error severity levels for monitoring and alerting
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl fmt::Display for ErrorSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorSeverity::Low => write!(f, "low"),
            ErrorSeverity::Medium => write!(f, "medium"),
            ErrorSeverity::High => write!(f, "high"),
            ErrorSeverity::Critical => write!(f, "critical"),
        }
    }
}

/// Error context for debugging and logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorContext {
    pub timestamp: DateTime<Utc>,
    pub operation: String,
    pub account_id: Option<String>,
    pub calendar_id: Option<String>,
    pub event_id: Option<String>,
    pub user_id: Option<String>,
    pub request_id: Option<String>,
    pub stack_trace: Option<String>,
    pub additional_data: Option<serde_json::Value>,
}

impl ErrorContext {
    pub fn new(operation: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            operation: operation.into(),
            account_id: None,
            calendar_id: None,
            event_id: None,
            user_id: None,
            request_id: None,
            stack_trace: None,
            additional_data: None,
        }
    }

    pub fn with_account_id(mut self, account_id: impl Into<String>) -> Self {
        self.account_id = Some(account_id.into());
        self
    }

    pub fn with_calendar_id(mut self, calendar_id: impl Into<String>) -> Self {
        self.calendar_id = Some(calendar_id.into());
        self
    }

    pub fn with_event_id(mut self, event_id: impl Into<String>) -> Self {
        self.event_id = Some(event_id.into());
        self
    }

    pub fn with_user_id(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    pub fn with_additional_data(mut self, data: serde_json::Value) -> Self {
        self.additional_data = Some(data);
        self
    }
}

// Convert common error types to CalendarError
impl From<sqlx::Error> for CalendarError {
    fn from(error: sqlx::Error) -> Self {
        let constraint_violation = matches!(
            error, 
            sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() || db_err.is_foreign_key_violation()
        );
        
        CalendarError::DatabaseError {
            message: error.to_string(),
            operation: "unknown".to_string(),
            table: None,
            constraint_violation,
        }
    }
}

impl From<reqwest::Error> for CalendarError {
    fn from(error: reqwest::Error) -> Self {
        CalendarError::NetworkError {
            message: error.to_string(),
            provider: CalendarProvider::Google, // Default, should be set by caller
            account_id: "unknown".to_string(),
            status_code: error.status().map(|s| s.as_u16()),
            is_timeout: error.is_timeout(),
            is_connection_error: error.is_connect(),
        }
    }
}

impl From<serde_json::Error> for CalendarError {
    fn from(error: serde_json::Error) -> Self {
        CalendarError::SerializationError {
            message: error.to_string(),
            data_type: "json".to_string(),
            operation: "parse".to_string(),
        }
    }
}

impl From<chrono::ParseError> for CalendarError {
    fn from(error: chrono::ParseError) -> Self {
        CalendarError::TimezoneError {
            message: error.to_string(),
            timezone: None,
            date_time: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_retryable() {
        let rate_limit_error = CalendarError::rate_limit_error(
            CalendarProvider::Google,
            "test-account",
            None,
        );
        assert!(rate_limit_error.is_retryable());

        let auth_error = CalendarError::auth_error(
            "Invalid token",
            CalendarProvider::Google,
            "test-account",
        );
        assert!(!auth_error.is_retryable());
    }

    #[test]
    fn test_error_user_intervention() {
        let auth_error = CalendarError::auth_error(
            "Invalid token",
            CalendarProvider::Google,
            "test-account",
        );
        assert!(auth_error.requires_user_intervention());

        let network_error = CalendarError::NetworkError {
            message: "Connection failed".to_string(),
            provider: CalendarProvider::Google,
            account_id: "test-account".to_string(),
            status_code: Some(500),
            is_timeout: false,
            is_connection_error: true,
        };
        assert!(!network_error.requires_user_intervention());
    }

    #[test]
    fn test_error_severity() {
        let auth_error = CalendarError::auth_error(
            "Invalid token",
            CalendarProvider::Google,
            "test-account",
        );
        assert_eq!(auth_error.severity(), ErrorSeverity::High);

        let rate_limit_error = CalendarError::rate_limit_error(
            CalendarProvider::Google,
            "test-account",
            None,
        );
        assert_eq!(rate_limit_error.severity(), ErrorSeverity::Low);
    }

    #[test]
    fn test_error_context_creation() {
        let context = ErrorContext::new("test_operation")
            .with_account_id("test-account")
            .with_calendar_id("test-calendar")
            .with_event_id("test-event")
            .with_user_id("test-user");

        assert_eq!(context.operation, "test_operation");
        assert_eq!(context.account_id.as_ref().unwrap(), "test-account");
        assert_eq!(context.calendar_id.as_ref().unwrap(), "test-calendar");
        assert_eq!(context.event_id.as_ref().unwrap(), "test-event");
        assert_eq!(context.user_id.as_ref().unwrap(), "test-user");
    }
}