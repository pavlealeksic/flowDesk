/*!
 * Calendar Configuration
 * 
 * Configuration management for calendar engine settings.
 */

use serde::{Deserialize, Serialize};
use crate::calendar::{CalendarConfig, PrivacySyncConfig, RateLimitConfig, WebhookConfig};

impl Default for CalendarConfig {
    fn default() -> Self {
        Self {
            database_url: "sqlite://calendar.db".to_string(),
            max_concurrent_syncs: 10,
            default_sync_interval_minutes: 15,
            webhook_config: None,
            rate_limits: RateLimitConfig::default(),
            privacy_sync: PrivacySyncConfig::default(),
            server_timezone: "UTC".to_string(),
            debug: false,
        }
    }
}

/// Load configuration from file or environment
pub fn load_config() -> CalendarConfig {
    // TODO: Load from config file or environment variables
    CalendarConfig::default()
}

/// Validate configuration settings
pub fn validate_config(config: &CalendarConfig) -> Result<(), String> {
    if config.max_concurrent_syncs == 0 {
        return Err("max_concurrent_syncs must be greater than 0".to_string());
    }

    if config.default_sync_interval_minutes == 0 {
        return Err("default_sync_interval_minutes must be greater than 0".to_string());
    }

    Ok(())
}