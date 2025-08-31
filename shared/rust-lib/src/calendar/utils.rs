/*!
 * Calendar Utilities
 * 
 * Common utility functions for calendar operations.
 */

use chrono::{DateTime, Utc, TimeZone};
use crate::calendar::{CalendarResult, CalendarError};

/// Convert RFC3339 string to UTC DateTime
pub fn parse_datetime(s: &str) -> CalendarResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| CalendarError::TimezoneError {
            message: format!("Failed to parse datetime: {}", e),
            timezone: None,
            date_time: Some(s.to_string()),
        })
}

/// Format DateTime as RFC3339 string
pub fn format_datetime(dt: DateTime<Utc>) -> String {
    dt.to_rfc3339()
}

/// Calculate hash of event data for change detection
pub fn calculate_event_hash(data: &str) -> String {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Generate unique ID
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Validate email address
pub fn is_valid_email(email: &str) -> bool {
    email.contains('@') && email.len() > 3
}

/// Extract domain from email
pub fn extract_email_domain(email: &str) -> Option<String> {
    email.split('@').nth(1).map(|s| s.to_string())
}