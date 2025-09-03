//! Configuration structures for the mail engine

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Main configuration for the mail engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailEngineConfig {
    /// Path to the SQLite database file
    pub database_path: String,
    /// Authentication configuration
    pub auth_config: AuthConfig,
    /// Synchronization configuration
    pub sync_config: SyncConfig,
    /// Rate limiting configuration
    pub rate_limiting: RateLimitConfig,
}

/// OAuth2 and authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Google OAuth2 client ID
    pub google_client_id: String,
    /// Google OAuth2 client secret (encrypted)
    pub google_client_secret: String,
    /// Microsoft OAuth2 client ID
    pub microsoft_client_id: String,
    /// Microsoft OAuth2 client secret (encrypted)
    pub microsoft_client_secret: String,
    /// OAuth2 redirect URI
    pub redirect_uri: String,
}

/// Synchronization engine configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncConfig {
    /// Default sync interval in seconds
    pub sync_interval_seconds: u64,
    /// Maximum number of concurrent sync operations
    pub max_concurrent_syncs: usize,
    /// Batch size for message fetching
    pub batch_size: usize,
    /// Number of retry attempts for failed operations
    pub retry_attempts: usize,
    /// Whether to enable push notifications
    pub enable_push_notifications: bool,
}

/// Rate limiting configuration for different providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Gmail API requests per second
    pub gmail_requests_per_second: u32,
    /// Microsoft Graph requests per second
    pub outlook_requests_per_second: u32,
    /// Maximum concurrent IMAP connections
    pub imap_concurrent_connections: usize,
}

/// Provider-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "provider", content = "config")]
pub enum ProviderConfig {
    Gmail(GmailConfig),
    Outlook(OutlookConfig),
    Imap(ImapConfig),
}

/// Gmail-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmailConfig {
    /// Gmail API scopes to request
    pub scopes: Vec<String>,
    /// Enable Gmail push notifications via Pub/Sub
    pub enable_push: bool,
    /// Pub/Sub topic name for push notifications
    pub push_topic: Option<String>,
    /// History ID for incremental sync
    pub history_id: Option<String>,
}

impl Default for GmailConfig {
    fn default() -> Self {
        Self {
            scopes: vec![
                "https://www.googleapis.com/auth/gmail.readonly".to_string(),
                "https://www.googleapis.com/auth/gmail.send".to_string(),
                "https://www.googleapis.com/auth/gmail.modify".to_string(),
                "https://www.googleapis.com/auth/gmail.compose".to_string(),
            ],
            enable_push: true,
            push_topic: None,
            history_id: None,
        }
    }
}

/// Microsoft Graph/Outlook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlookConfig {
    /// Microsoft Graph API scopes to request
    pub scopes: Vec<String>,
    /// Tenant ID for enterprise accounts
    pub tenant_id: Option<String>,
    /// Enable webhook notifications
    pub enable_webhooks: bool,
    /// Delta token for incremental sync
    pub delta_token: Option<String>,
}

impl Default for OutlookConfig {
    fn default() -> Self {
        Self {
            scopes: vec![
                "https://graph.microsoft.com/Mail.ReadWrite".to_string(),
                "https://graph.microsoft.com/Mail.Send".to_string(),
                "https://graph.microsoft.com/MailboxSettings.ReadWrite".to_string(),
            ],
            tenant_id: None,
            enable_webhooks: true,
            delta_token: None,
        }
    }
}

/// IMAP/SMTP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapConfig {
    /// IMAP server hostname
    pub imap_host: String,
    /// IMAP server port
    pub imap_port: u16,
    /// Use TLS for IMAP connection
    pub imap_tls: bool,
    /// IMAP username
    pub imap_username: String,
    /// IMAP password (encrypted)
    pub imap_password: String,
    /// SMTP server hostname
    pub smtp_host: String,
    /// SMTP server port
    pub smtp_port: u16,
    /// Use TLS for SMTP connection
    pub smtp_tls: bool,
    /// SMTP username
    pub smtp_username: String,
    /// SMTP password (encrypted)
    pub smtp_password: String,
    /// Enable IMAP IDLE for push notifications
    pub enable_idle: bool,
    /// Custom folder mappings (IMAP folder name -> standard name)
    pub folder_mappings: std::collections::HashMap<String, String>,
}

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// SQLite database file path
    pub path: String,
    /// Maximum number of database connections in pool
    pub max_connections: u32,
    /// Connection timeout in seconds
    pub connect_timeout_seconds: u64,
    /// Enable WAL mode for better concurrency
    pub enable_wal: bool,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: "mail.db".to_string(),
            max_connections: 10,
            connect_timeout_seconds: 30,
            enable_wal: true,
        }
    }
}

/// Encryption configuration for local data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionConfig {
    /// Key derivation function for password-based encryption
    pub kdf_iterations: u32,
    /// Salt for key derivation (base64 encoded)
    pub salt: String,
    /// Encryption algorithm identifier
    pub algorithm: String,
}

impl Default for EncryptionConfig {
    fn default() -> Self {
        Self {
            kdf_iterations: 100_000,
            salt: String::new(), // Generated at runtime
            algorithm: "AES-256-GCM".to_string(),
        }
    }
}

/// Logging configuration for mail operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Log level for mail operations
    pub level: String,
    /// Enable structured logging
    pub structured: bool,
    /// Log file path (optional)
    pub file_path: Option<String>,
    /// Maximum log file size in MB
    pub max_file_size_mb: u64,
    /// Number of log files to retain
    pub max_files: u32,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            structured: true,
            file_path: None,
            max_file_size_mb: 10,
            max_files: 5,
        }
    }
}

impl Default for MailEngineConfig {
    fn default() -> Self {
        Self {
            database_path: "flow_desk_mail.db".to_string(),
            auth_config: AuthConfig {
                google_client_id: String::new(),
                google_client_secret: String::new(),
                microsoft_client_id: String::new(),
                microsoft_client_secret: String::new(),
                redirect_uri: "http://localhost:8080/auth/callback".to_string(),
            },
            sync_config: SyncConfig {
                sync_interval_seconds: 300, // 5 minutes
                max_concurrent_syncs: 5,
                batch_size: 100,
                retry_attempts: 3,
                enable_push_notifications: true,
            },
            rate_limiting: RateLimitConfig {
                gmail_requests_per_second: 10,
                outlook_requests_per_second: 20,
                imap_concurrent_connections: 3,
            },
        }
    }
}

impl SyncConfig {
    /// Get sync interval as Duration
    pub fn sync_interval(&self) -> Duration {
        Duration::from_secs(self.sync_interval_seconds)
    }
}

impl RateLimitConfig {
    /// Get Gmail rate limit as requests per Duration
    pub fn gmail_rate_limit(&self) -> (u32, Duration) {
        (self.gmail_requests_per_second, Duration::from_secs(1))
    }

    /// Get Outlook rate limit as requests per Duration
    pub fn outlook_rate_limit(&self) -> (u32, Duration) {
        (self.outlook_requests_per_second, Duration::from_secs(1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = MailEngineConfig::default();
        assert_eq!(config.sync_config.sync_interval_seconds, 300);
        assert_eq!(config.sync_config.max_concurrent_syncs, 5);
        assert_eq!(config.rate_limiting.gmail_requests_per_second, 10);
    }

    #[test]
    fn test_sync_interval_duration() {
        let config = SyncConfig {
            sync_interval_seconds: 600,
            ..Default::default()
        };
        assert_eq!(config.sync_interval(), Duration::from_secs(600));
    }

    #[test]
    fn test_rate_limits() {
        let config = RateLimitConfig {
            gmail_requests_per_second: 15,
            outlook_requests_per_second: 25,
            imap_concurrent_connections: 5,
        };

        let (rate, duration) = config.gmail_rate_limit();
        assert_eq!(rate, 15);
        assert_eq!(duration, Duration::from_secs(1));

        let (rate, duration) = config.outlook_rate_limit();
        assert_eq!(rate, 25);
        assert_eq!(duration, Duration::from_secs(1));
    }

    #[test]
    fn test_gmail_config_default() {
        let config = GmailConfig::default();
        assert!(config.scopes.contains(&"https://www.googleapis.com/auth/gmail.readonly".to_string()));
        assert!(config.enable_push);
    }
}