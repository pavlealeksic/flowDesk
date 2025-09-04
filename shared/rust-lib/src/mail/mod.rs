//! Flow Desk Mail Engine
//!
//! A comprehensive mail engine with support for multiple providers including:
//! - Gmail API with OAuth2 authentication
//! - Microsoft Graph API for Outlook integration
//! - Generic IMAP/SMTP support with IDLE push notifications
//! - Real-time synchronization and offline caching
//! - Advanced filtering, threading, and search capabilities

use std::sync::Arc;

pub mod account_manager;
pub mod auth;
pub mod config;
pub mod database;
pub mod engine;
pub mod error;
pub mod notifications;
pub mod production_account_manager;
pub mod production_engine;
pub mod providers;
pub mod scheduler;
pub mod server_configs;
pub mod sync;
pub mod template_engine;
pub mod threading;
pub mod types;
pub mod utils;

// NAPI bindings for Node.js integration
#[cfg(feature = "napi")]
pub mod napi;

// Re-export core types for convenience
pub use auth::{AuthManager, OAuth2Provider};
pub use config::MailEngineConfig;
pub use database::MailDatabase;
pub use engine::MailEngine;
pub use error::{MailError, MailResult};
pub use notifications::{EmailNotificationSystem, NotificationConfig, NotificationListener, UINotification};
pub use production_account_manager::{ProductionAccountManager, EmailCredentials, AccountSetupResult, ValidationResult};
pub use production_engine::{ProductionEmailEngine, SyncResult as ProductionSyncResult, ConnectionStatus};
pub use providers::{
    gmail::GmailProvider, imap::ImapProvider, outlook::OutlookProvider, MailProviderTrait,
    ProviderCapabilities,
};
pub use sync::{SyncEngine, SyncProgress, SyncResult};
pub use threading::ThreadingEngine;
pub use types::*;

/// Mail engine instance type for shared usage across threads
pub type SharedMailEngine = Arc<MailEngine>;

/// Initialize the mail engine with the provided configuration
pub async fn init_mail_engine(config: MailEngineConfig) -> MailResult<MailEngine> {
    tracing::info!("Initializing Flow Desk Mail Engine");

    let database = MailDatabase::new(&config.database_path).await?;
    let auth_manager = AuthManager::new();
    let sync_engine = SyncEngine::new(Arc::new(database.clone()));
    let threading_engine = ThreadingEngine::new();

    let engine = MailEngine::new(
        config,
        database,
        auth_manager,
        sync_engine,
        threading_engine,
    )
    .await?;

    tracing::info!("Mail engine initialized successfully");
    Ok(engine)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mail::config::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_mail_engine_initialization() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_mail.db");

        let config = MailEngineConfig {
            database_path: db_path.to_string_lossy().to_string(),
            auth_config: AuthConfig {
                google_client_id: "test_id".to_string(),
                google_client_secret: "test_secret".to_string(),
                microsoft_client_id: "test_id".to_string(),
                microsoft_client_secret: "test_secret".to_string(),
                redirect_uri: "http://localhost:8080/callback".to_string(),
            },
            sync_config: SyncConfig {
                sync_interval_seconds: 300,
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
        };

        let engine = init_mail_engine(config).await;
        assert!(engine.is_ok());
    }
}