//! Utility functions for Flow Desk

use chrono::{DateTime, Utc};
use anyhow::{Result, anyhow};

/// Validate email address format
pub fn validate_email(email: &str) -> bool {
    // Basic email validation - in production, use a more robust solution
    let parts: Vec<&str> = email.split('@').collect();
    parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() && parts[1].contains('.')
}

/// Format a date for display
pub fn format_date_display(date: &DateTime<Utc>) -> String {
    date.format("%Y-%m-%d %H:%M:%S UTC").to_string()
}

/// Parse ISO 8601 date string
pub fn parse_iso_date(date_str: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(date_str)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| anyhow!("Failed to parse date '{}': {}", date_str, e))
}

/// Get current timestamp
pub fn current_timestamp() -> DateTime<Utc> {
    Utc::now()
}

/// Calculate days between two dates
pub fn days_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> i64 {
    (end.date_naive() - start.date_naive()).num_days()
}

/// Truncate string to specified length with ellipsis
pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else if max_len <= 3 {
        "...".to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}

/// Extract domain from email address
pub fn extract_email_domain(email: &str) -> Option<String> {
    email.split('@').nth(1).map(|s| s.to_lowercase())
}

/// Sanitize string for safe display
pub fn sanitize_string(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || ".-_@".contains(*c))
        .collect()
}

/// Generate a slug from a string
pub fn generate_slug(input: &str) -> String {
    input
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_email() {
        assert!(validate_email("user@example.com"));
        assert!(validate_email("test.email+tag@domain.co.uk"));
        assert!(!validate_email("invalid-email"));
        assert!(!validate_email("@domain.com"));
        assert!(!validate_email("user@"));
        assert!(!validate_email(""));
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("Hello, World!", 20), "Hello, World!");
        assert_eq!(truncate_string("Hello, World!", 10), "Hello, ...");
        assert_eq!(truncate_string("Hello, World!", 3), "...");
        assert_eq!(truncate_string("Hi", 10), "Hi");
    }

    #[test]
    fn test_extract_email_domain() {
        assert_eq!(extract_email_domain("user@example.com"), Some("example.com".to_string()));
        assert_eq!(extract_email_domain("test@DOMAIN.COM"), Some("domain.com".to_string()));
        assert_eq!(extract_email_domain("invalid-email"), None);
    }

    #[test]
    fn test_generate_slug() {
        assert_eq!(generate_slug("Hello World"), "hello-world");
        assert_eq!(generate_slug("My Great Plugin!"), "my-great-plugin");
        assert_eq!(generate_slug("test---slug"), "test-slug");
    }

    #[test]
    fn test_parse_iso_date() {
        let result = parse_iso_date("2023-01-01T12:00:00Z");
        assert!(result.is_ok());
        
        let invalid_result = parse_iso_date("invalid-date");
        assert!(invalid_result.is_err());
    }
}
