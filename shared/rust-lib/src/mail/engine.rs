//! Main mail engine implementation

use crate::mail::{
    auth::{AuthManager, AuthorizationUrl, AuthCredentials},
    config::MailEngineConfig,
    database::MailDatabase,
    error::{MailError, MailResult},
    providers::{MailProvider as ProviderTrait, ProviderFactory, SyncResult},
    sync::SyncEngine,
    threading::ThreadingEngine,
    types::*,
};

use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;

/// Main mail engine that coordinates all mail operations
pub struct MailEngine {
    config: MailEngineConfig,
    database: MailDatabase,
    auth_manager: AuthManager,
    sync_engine: SyncEngine,
    threading_engine: ThreadingEngine,
    /// Active provider instances keyed by account ID
    providers: Arc<RwLock<HashMap<Uuid, Box<dyn ProviderTrait>>>>,
    /// Shutdown signal
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl MailEngine {
    /// Create new mail engine instance
    pub async fn new(
        config: MailEngineConfig,
        database: MailDatabase,
        auth_manager: AuthManager,
        sync_engine: SyncEngine,
        threading_engine: ThreadingEngine,
    ) -> MailResult<Self> {
        Ok(Self {
            config,
            database,
            auth_manager,
            sync_engine,
            threading_engine,
            providers: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx: None,
        })
    }

    /// Add a mail account
    pub async fn add_account(&self, mut account: MailAccount) -> MailResult<Uuid> {
        // Generate new account ID if not provided
        if account.id == Uuid::nil() {
            account.id = Uuid::new_v4();
        }

        // Store account in database
        self.database.store_account(&account).await?;

        // If OAuth provider, ensure we have valid credentials
        if account.provider.supports_oauth() {
            let credentials = self.auth_manager.get_credentials(account.id).await?;
            if credentials.is_none() {
                tracing::info!("Account {} requires OAuth authentication", account.id);
                return Ok(account.id);
            }
        }

        // Initialize provider
        self.initialize_provider(&account).await?;

        tracing::info!("Successfully added account {} ({})", account.id, account.email);
        Ok(account.id)
    }

    /// Remove a mail account
    pub async fn remove_account(&self, account_id: Uuid) -> MailResult<()> {
        // Stop sync for this account
        self.sync_engine.stop_account_sync(account_id).await;

        // Remove provider
        {
            let mut providers = self.providers.write().await;
            providers.remove(&account_id);
        }

        // Revoke authentication credentials
        if let Err(e) = self.auth_manager.revoke_credentials(account_id).await {
            tracing::warn!("Failed to revoke credentials for account {}: {}", account_id, e);
        }

        // Remove from database
        self.database.remove_account(account_id).await?;

        tracing::info!("Removed account {}", account_id);
        Ok(())
    }

    /// List all accounts
    pub async fn list_accounts(&self) -> MailResult<Vec<MailAccount>> {
        self.database.list_accounts().await
    }

    /// Get account by ID
    pub async fn get_account(&self, account_id: Uuid) -> MailResult<Option<MailAccount>> {
        self.database.get_account(account_id).await
    }

    /// Update account configuration
    pub async fn update_account(&self, account: &MailAccount) -> MailResult<()> {
        self.database.update_account(account).await?;

        // Re-initialize provider if configuration changed
        self.initialize_provider(account).await?;

        Ok(())
    }

    /// Get OAuth authorization URL
    pub async fn get_authorization_url(&self, provider: MailProvider) -> MailResult<AuthorizationUrl> {
        self.auth_manager.get_authorization_url(provider).await
    }

    /// Handle OAuth callback
    pub async fn handle_oauth_callback(
        &self,
        code: &str,
        state: &str,
        account_id: Uuid,
    ) -> MailResult<AuthCredentials> {
        let credentials = self
            .auth_manager
            .handle_callback(code, state, account_id)
            .await?;

        // Initialize provider now that we have credentials
        if let Some(account) = self.get_account(account_id).await? {
            self.initialize_provider(&account).await?;
        }

        Ok(credentials)
    }

    /// Start background synchronization
    pub async fn start_sync(&self) -> MailResult<()> {
        let accounts = self.list_accounts().await?;
        for account in accounts {
            if account.is_enabled && account.status == MailAccountStatus::Active {
                self.sync_engine.start_account_sync(account.id).await?;
            }
        }
        Ok(())
    }

    /// Stop background synchronization
    pub async fn stop_sync(&self) -> MailResult<()> {
        self.sync_engine.stop_all_syncs().await;
        Ok(())
    }

    /// Sync specific account
    pub async fn sync_account(&self, account_id: Uuid) -> MailResult<SyncResult> {
        let account = self
            .get_account(account_id)
            .await?
            .ok_or_else(|| MailError::not_found("Account", &account_id.to_string()))?;

        let provider = self.get_provider(account_id).await?;
        
        // Perform full sync
        let sync_result = provider.get_sync_changes(None).await?;
        
        // Process sync changes
        for change in &sync_result.changes {
            match change {
                crate::mail::providers::SyncChange::MessageAdded(message) => {
                    self.database.store_message(message).await?;
                    
                    // Update threading
                    self.threading_engine
                        .add_message_to_thread(message)
                        .await?;
                }
                crate::mail::providers::SyncChange::MessageUpdated(message) => {
                    self.database.update_message(message).await?;
                }
                crate::mail::providers::SyncChange::MessageDeleted(message_id) => {
                    if let Ok(Some(message)) = self.database.get_message_by_provider_id(message_id).await {
                        self.database.delete_message(message.id).await?;
                        
                        // Update threading
                        self.threading_engine
                            .remove_message_from_thread(&message)
                            .await?;
                    }
                }
                crate::mail::providers::SyncChange::FolderAdded(folder) => {
                    self.database.store_folder(folder).await?;
                }
                crate::mail::providers::SyncChange::FolderUpdated(folder) => {
                    self.database.update_folder(folder).await?;
                }
                crate::mail::providers::SyncChange::FolderDeleted(folder_id) => {
                    self.database.delete_folder(*folder_id).await?;
                }
            }
        }

        // Update last sync time
        let mut updated_account = account;
        updated_account.last_sync_at = Some(chrono::Utc::now());
        self.database.update_account(&updated_account).await?;

        Ok(sync_result)
    }

    /// Get messages for an account
    pub async fn get_messages(
        &self,
        account_id: Uuid,
        folder_id: Option<Uuid>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> MailResult<Vec<EmailMessage>> {
        self.database
            .get_messages(account_id, folder_id, limit, offset)
            .await
    }

    /// Get message by ID
    pub async fn get_message(&self, message_id: Uuid) -> MailResult<Option<EmailMessage>> {
        self.database.get_message(message_id).await
    }

    /// Send email
    pub async fn send_email(&self, account_id: Uuid, message: &EmailMessage) -> MailResult<String> {
        let provider = self.get_provider(account_id).await?;
        let message_id = provider.send_message(message).await?;

        // Store sent message in database
        let mut sent_message = message.clone();
        sent_message.flags.is_sent = true;
        sent_message.created_at = chrono::Utc::now();
        sent_message.updated_at = chrono::Utc::now();
        self.database.store_message(&sent_message).await?;

        Ok(message_id)
    }

    /// Search messages across accounts
    pub async fn search_messages(
        &self,
        account_id: Option<Uuid>,
        query: &str,
        limit: Option<u32>,
    ) -> MailResult<EmailSearchResult> {
        if let Some(account_id) = account_id {
            // Search in specific account using provider
            let provider = self.get_provider(account_id).await?;
            provider.search_messages(query, limit).await
        } else {
            // Search across all accounts using local database
            self.database.search_messages(query, limit).await
        }
    }

    /// Mark message as read/unread
    pub async fn mark_message_read(
        &self,
        account_id: Uuid,
        message_id: Uuid,
        read: bool,
    ) -> MailResult<()> {
        let message = self
            .get_message(message_id)
            .await?
            .ok_or_else(|| MailError::not_found("Message", &message_id.to_string()))?;

        let provider = self.get_provider(account_id).await?;
        provider.mark_read(&message.provider_id, read).await?;

        // Update local database
        let mut updated_message = message;
        updated_message.flags.is_read = read;
        updated_message.updated_at = chrono::Utc::now();
        self.database.update_message(&updated_message).await?;

        Ok(())
    }

    /// Get folders for an account
    pub async fn get_folders(&self, account_id: Uuid) -> MailResult<Vec<MailFolder>> {
        self.database.get_folders(account_id).await
    }

    /// Get threads for an account
    pub async fn get_threads(
        &self,
        account_id: Uuid,
        folder_id: Option<Uuid>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> MailResult<Vec<EmailThread>> {
        self.database
            .get_threads(account_id, folder_id, limit, offset)
            .await
    }

    /// Get sync status for all accounts
    pub async fn get_sync_status(&self) -> MailResult<Vec<MailSyncStatus>> {
        let accounts = self.list_accounts().await?;
        let mut statuses = Vec::new();

        for account in accounts {
            let status = self.sync_engine.get_account_status(account.id).await;
            statuses.push(status);
        }

        Ok(statuses)
    }

    /// Shutdown the mail engine
    pub async fn shutdown(&self) -> MailResult<()> {
        // Stop all syncs
        self.stop_sync().await?;

        // Clear providers
        {
            let mut providers = self.providers.write().await;
            providers.clear();
        }

        // Signal shutdown if sender exists
        if let Some(tx) = &self.shutdown_tx {
            let _ = tx.send(());
        }

        tracing::info!("Mail engine shutdown completed");
        Ok(())
    }

    /// Initialize provider for an account
    async fn initialize_provider(&self, account: &MailAccount) -> MailResult<()> {
        let access_token = if account.provider.supports_oauth() {
            Some(self.auth_manager.get_valid_token(account.id).await?)
        } else {
            None
        };

        let provider = ProviderFactory::create_provider(account, access_token).await?;

        // Test connection
        if !provider.test_connection().await? {
            return Err(MailError::provider_api(
                account.provider.as_str(),
                "Provider connection test failed",
                "connection_failed",
            ));
        }

        // Store provider
        {
            let mut providers = self.providers.write().await;
            providers.insert(account.id, provider);
        }

        tracing::info!("Initialized provider for account {} ({})", account.id, account.provider.as_str());
        Ok(())
    }

    /// Get provider for account
    async fn get_provider(&self, account_id: Uuid) -> MailResult<&dyn ProviderTrait> {
        let providers = self.providers.read().await;
        providers
            .get(&account_id)
            .map(|p| p.as_ref())
            .ok_or_else(|| {
                MailError::not_found("Provider for account", &account_id.to_string())
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mail::{config::*, types::*};
    use tempfile::tempdir;

    async fn create_test_engine() -> MailResult<MailEngine> {
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

        crate::mail::init_mail_engine(config).await
    }

    #[tokio::test]
    async fn test_engine_creation() {
        let engine = create_test_engine().await;
        assert!(engine.is_ok());
    }

    #[tokio::test]
    async fn test_add_account() {
        let engine = create_test_engine().await.unwrap();

        let account = MailAccount {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            name: "Test Account".to_string(),
            email: "test@example.com".to_string(),
            provider: MailProvider::Gmail,
            status: MailAccountStatus::Active,
            last_sync_at: None,
            next_sync_at: None,
            sync_interval_minutes: 15,
            is_enabled: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            provider_config: ProviderAccountConfig::Gmail {
                client_id: "test_client_id".to_string(),
                scopes: vec!["test_scope".to_string()],
                enable_push_notifications: true,
                history_id: None,
            },
        };

        let result = engine.add_account(account).await;
        assert!(result.is_ok());
    }
}