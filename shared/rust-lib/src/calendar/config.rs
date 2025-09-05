/*!
 * Calendar Configuration
 * 
 * Configuration management for calendar engine settings.
 */

use std::env;
use crate::calendar::{CalendarConfig, PrivacySyncConfig, RateLimitConfig};

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
    let mut config = CalendarConfig::default();
    
    // Load from environment variables with fallback to defaults
    if let Ok(database_url) = env::var("CALENDAR_DATABASE_URL") {
        config.database_url = database_url;
    }
    
    if let Ok(max_syncs) = env::var("CALENDAR_MAX_CONCURRENT_SYNCS") {
        if let Ok(value) = max_syncs.parse::<usize>() {
            config.max_concurrent_syncs = value;
        }
    }
    
    if let Ok(sync_interval) = env::var("CALENDAR_DEFAULT_SYNC_INTERVAL_MINUTES") {
        if let Ok(value) = sync_interval.parse::<u64>() {
            config.default_sync_interval_minutes = value;
        }
    }
    
    if let Ok(timezone) = env::var("CALENDAR_SERVER_TIMEZONE") {
        config.server_timezone = timezone;
    }
    
    if let Ok(debug) = env::var("CALENDAR_DEBUG") {
        config.debug = debug.to_lowercase() == "true" || debug == "1";
    }
    
    // Load privacy sync configuration from environment
    let mut privacy_sync = PrivacySyncConfig::default();
    if let Ok(default_title) = env::var("CALENDAR_PRIVACY_SYNC_DEFAULT_TITLE") {
        privacy_sync.default_privacy_title = default_title;
    }
    config.privacy_sync = privacy_sync;
    
    // Load rate limiting configuration from environment
    let mut rate_limits = RateLimitConfig::default();
    if let Ok(google_rpm) = env::var("CALENDAR_RATE_LIMIT_GOOGLE_RPM") {
        if let Ok(value) = google_rpm.parse::<u32>() {
            rate_limits.google_calendar_rpm = value;
        }
    }
    if let Ok(burst_capacity) = env::var("CALENDAR_RATE_LIMIT_BURST_CAPACITY") {
        if let Ok(value) = burst_capacity.parse::<u32>() {
            rate_limits.burst_capacity = value;
        }
    }
    config.rate_limits = rate_limits;
    
    config
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