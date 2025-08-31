//! Common types and data structures for Flow Desk

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// User identification and profile information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
}

/// Email message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Email {
    pub id: Uuid,
    pub user_id: Uuid,
    pub subject: String,
    pub body: String,
    pub from_address: String,
    pub to_addresses: Vec<String>,
    pub cc_addresses: Vec<String>,
    pub bcc_addresses: Vec<String>,
    pub received_at: DateTime<Utc>,
    pub is_read: bool,
    pub is_starred: bool,
    pub folder: String,
}

/// Calendar event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub location: Option<String>,
    pub attendees: Vec<String>,
    pub is_all_day: bool,
    pub recurrence_rule: Option<String>,
    pub reminder_minutes: Option<i32>,
}

/// Plugin information and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
    pub id: Uuid,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub license: String,
    pub tags: Vec<String>,
    pub permissions: Vec<Permission>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub download_count: i64,
    pub is_verified: bool,
}

/// Plugin permission types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Permission {
    ReadEmails,
    WriteEmails,
    ReadCalendar,
    WriteCalendar,
    ReadContacts,
    WriteContacts,
    NetworkAccess,
    FileSystemRead,
    FileSystemWrite,
    Notifications,
    SystemIntegration,
}

/// API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub timestamp: DateTime<Utc>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: Utc::now(),
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
            timestamp: Utc::now(),
        }
    }
}

/// Configuration settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: Theme,
    pub notifications_enabled: bool,
    pub sync_interval_minutes: i32,
    pub privacy_mode: bool,
    pub plugin_auto_update: bool,
    pub language: String,
    pub timezone: String,
}

/// Theme configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Theme {
    Light,
    Dark,
    Auto,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: Theme::Auto,
            notifications_enabled: true,
            sync_interval_minutes: 15,
            privacy_mode: false,
            plugin_auto_update: true,
            language: "en".to_string(),
            timezone: "UTC".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_response_success() {
        let response = ApiResponse::success("test data".to_string());
        assert!(response.success);
        assert_eq!(response.data, Some("test data".to_string()));
        assert!(response.error.is_none());
    }

    #[test]
    fn test_api_response_error() {
        let response: ApiResponse<String> = ApiResponse::error("test error".to_string());
        assert!(!response.success);
        assert!(response.data.is_none());
        assert_eq!(response.error, Some("test error".to_string()));
    }

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert_eq!(config.theme, Theme::Auto);
        assert!(config.notifications_enabled);
        assert_eq!(config.sync_interval_minutes, 15);
    }
}
