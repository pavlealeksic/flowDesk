//! Main mail engine implementation

use crate::mail::{
    auth::{AuthManager, AuthorizationUrl, AuthCredentials},
    config::MailEngineConfig,
    database::MailDatabase,
    error::{MailError, MailResult},
    notifications::{EmailNotificationSystem, NotificationConfig, NotificationListener},
    providers::{MailProviderTrait, ProviderFactory, SyncResult},
    sync::SyncEngine,
    threading::ThreadingEngine,
    types::*,
};

use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;

/// Main mail engine that coordinates all mail operations
pub struct MailEngine {
    config: MailEngineConfig,
    database: MailDatabase,
    auth_manager: AuthManager,
    sync_engine: SyncEngine,
    threading_engine: Arc<tokio::sync::Mutex<ThreadingEngine>>,
    /// Active provider instances keyed by account ID
    providers: Arc<RwLock<HashMap<Uuid, Arc<dyn MailProviderTrait>>>>,
    /// Real-time notification system
    notification_system: Option<Arc<EmailNotificationSystem>>,
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
            threading_engine: Arc::new(tokio::sync::Mutex::new(threading_engine)),
            providers: Arc::new(RwLock::new(HashMap::new())),
            notification_system: None,
            shutdown_tx: None,
        })
    }

    /// Initialize real-time notifications
    pub async fn initialize_notifications(&mut self) -> MailResult<()> {
        if self.notification_system.is_some() {
            return Ok(()); // Already initialized
        }

        // Create notification configuration based on engine config
        let notification_config = NotificationConfig {
            enable_push_notifications: self.config.sync_config.enable_push_notifications,
            enable_background_sync: true,
            ..Default::default()
        };

        // Create and initialize notification system
        let mut notification_system = EmailNotificationSystem::new(notification_config).await?;
        
        // Initialize with database connection for notification storage
        notification_system.initialize_with_database(&self.database).await?;
        
        self.notification_system = Some(Arc::new(notification_system));
        
        tracing::info!("Real-time notification system initialized");
        Ok(())
    }

    /// Enable real-time notifications for an account
    pub async fn enable_account_notifications(&self, account_id: Uuid) -> MailResult<()> {
        let notification_system = self.notification_system.as_ref()
            .ok_or_else(|| MailError::configuration("Notification system not initialized"))?;

        // Get folders for the account
        let folders = self.get_folders(account_id).await?;
        let folder_names = folders.into_iter()
            .filter(|f| f.is_selectable)
            .map(|f| f.name)
            .collect::<Vec<_>>();

        // Start monitoring
        notification_system.start_account_monitoring(account_id, folder_names).await?;
        
        tracing::info!("Enabled real-time notifications for account {}", account_id);
        Ok(())
    }

    /// Disable real-time notifications for an account
    pub async fn disable_account_notifications(&self, account_id: Uuid) -> MailResult<()> {
        if let Some(notification_system) = &self.notification_system {
            notification_system.stop_account_monitoring(account_id).await?;
            tracing::info!("Disabled real-time notifications for account {}", account_id);
        }
        Ok(())
    }

    /// Add a UI notification listener
    pub async fn add_notification_listener(
        &self,
        listener_id: String,
        listener: NotificationListener,
    ) -> MailResult<()> {
        let notification_system = self.notification_system.as_ref()
            .ok_or_else(|| MailError::configuration("Notification system not initialized"))?;

        notification_system.add_listener(listener_id, listener).await
    }

    /// Remove a UI notification listener
    pub async fn remove_notification_listener(&self, listener_id: &str) -> MailResult<()> {
        if let Some(notification_system) = &self.notification_system {
            notification_system.remove_listener(listener_id).await?;
        }
        Ok(())
    }

    /// Get notification system health
    pub async fn get_notification_health(&self) -> MailResult<Option<crate::mail::notifications::NotificationHealth>> {
        if let Some(notification_system) = &self.notification_system {
            Ok(Some(notification_system.get_health().await))
        } else {
            Ok(None)
        }
    }

    /// Add a mail account
    pub async fn add_account(&self, mut account: MailAccount) -> MailResult<Uuid> {
        // Generate new account ID if not provided
        if account.id == Uuid::nil() {
            account.id = Uuid::new_v4();
        }

        // Store account in database
        self.database.save_account(&account).await?;

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
        self.sync_engine.stop_account_sync(&account_id.to_string());

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
        self.database.remove_account(&account_id.to_string()).await
            .map_err(|e| MailError::other(format!("Failed to remove account from database: {}", e)))?;

        tracing::info!("Removed account {}", account_id);
        Ok(())
    }

    /// List all accounts
    pub async fn list_accounts(&self) -> MailResult<Vec<MailAccount>> {
        self.database.list_accounts().await
            .map_err(|e| MailError::other(format!("Failed to list accounts: {}", e)))
    }

    /// Get account by ID
    pub async fn get_account(&self, account_id: Uuid) -> MailResult<Option<MailAccount>> {
        self.database.get_account(&account_id.to_string()).await
            .map_err(|e| MailError::other(format!("Failed to get account: {}", e)))
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
        let (client_id, redirect_uri) = match provider {
            MailProvider::Gmail => (
                self.config.auth_config.google_client_id.clone(),
                self.config.auth_config.redirect_uri.clone()
            ),
            MailProvider::Outlook => (
                self.config.auth_config.microsoft_client_id.clone(),
                self.config.auth_config.redirect_uri.clone()
            ),
            _ => return Err(MailError::not_supported("Provider", &format!("{:?}", provider))),
        };
        
        let url = self.auth_manager.get_authorization_url(provider, &client_id, &redirect_uri)
            .await
            .map_err(|e| MailError::authentication(&format!("Failed to generate authorization URL: {}", e)))?;
        
        Ok(AuthorizationUrl {
            url,
            state: String::new(), // This would normally be generated for CSRF protection
            pkce_verifier: None,
        })
    }

    /// Handle OAuth callback
    pub async fn handle_oauth_callback(
        &self,
        code: &str,
        state: &str,
        account_id: Uuid,
        provider: MailProvider,
        redirect_uri: &str,
    ) -> MailResult<AuthCredentials> {
        let tokens = self
            .auth_manager
            .handle_callback(code, state, provider, redirect_uri)
            .await
            .map_err(|e| MailError::authentication(&format!("OAuth callback failed: {}", e)))?;

        // Store the credentials in token storage first
        let scopes = match provider {
            MailProvider::Gmail => vec![
                "https://www.googleapis.com/auth/gmail.readonly".to_string(),
                "https://www.googleapis.com/auth/gmail.send".to_string(),
                "https://www.googleapis.com/auth/gmail.modify".to_string(),
            ],
            MailProvider::Outlook => vec![
                "https://graph.microsoft.com/Mail.Read".to_string(),
                "https://graph.microsoft.com/Mail.Send".to_string(),
                "https://graph.microsoft.com/Mail.ReadWrite".to_string(),
            ],
            _ => vec![],
        };

        if let Err(e) = self.auth_manager.store_credentials(
            account_id, 
            provider,
            &tokens,
            scopes,
        ).await {
            tracing::warn!("Failed to store credentials: {}", e);
        }

        // Convert OAuthTokens to AuthCredentials after storing
        let credentials = AuthCredentials {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: "Bearer".to_string(),
            expires_at: tokens.expires_at,
            scopes: vec![], // Would need to be populated from the original request
            provider,
            account_id,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

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
                self.sync_engine.start_account_sync(account.id.to_string()).await;
            }
        }
        Ok(())
    }

    /// Stop background synchronization
    pub async fn stop_sync(&self) -> MailResult<()> {
        self.sync_engine.stop_all_syncs();
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
                    self.database.save_message(message).await?;
                    
                    // Update threading
                    let mut threading_engine = self.threading_engine.lock().await;
                    threading_engine
                        .add_message_to_thread(message)
                        .await?;
                }
                crate::mail::providers::SyncChange::MessageUpdated(message) => {
                    self.database.update_message(message).await?;
                }
                crate::mail::providers::SyncChange::MessageDeleted(message_id) => {
                    if let Ok(Some(message)) = self.database.get_message_by_provider_id(message_id).await {
                        self.database.delete_message(&message.id.to_string()).await?;
                        
                        // Update threading
                        let mut threading_engine = self.threading_engine.lock().await;
                        threading_engine
                            .remove_message_from_thread(&message.id)
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
                    // Convert folder_id string to Uuid if possible
                    if let Ok(folder_uuid) = Uuid::parse_str(folder_id) {
                        self.database.delete_folder(folder_uuid).await?;
                    }
                }
            }
        }

        // Update last sync time
        let mut updated_account = account;
        updated_account.last_sync_at = Some(chrono::Utc::now());
        self.database.update_account(&updated_account).await?;

        // Return the sync result from the provider
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
        let account_id_str = account_id.to_string();
        let folder_str = folder_id.map(|id| id.to_string()).unwrap_or_else(|| "INBOX".to_string());
        
        // Convert MailMessage to EmailMessage
        let mail_messages = self.database
            .get_messages(&account_id_str, &folder_str, limit)
            .await
            .map_err(|e| MailError::database(&e.to_string()))?;

        // MailMessage is just a type alias for EmailMessage, so no conversion needed
        let email_messages: Vec<EmailMessage> = mail_messages;

        Ok(email_messages)
    }

    /// Get message by ID
    pub async fn get_message(&self, message_id: Uuid) -> MailResult<Option<EmailMessage>> {
        self.database.get_message(message_id).await
            .map_err(|e| MailError::database(&e.to_string()))
    }

    /// Send email
    pub async fn send_email(&self, account_id: Uuid, message: &EmailMessage) -> MailResult<String> {
        let provider = self.get_provider(account_id).await?;
        let new_message = NewMessage {
            to: message.to.iter().map(|addr| addr.address.clone()).collect(),
            cc: message.cc.iter().map(|addr| addr.address.clone()).collect(),
            bcc: message.bcc.iter().map(|addr| addr.address.clone()).collect(),
            subject: message.subject.clone(),
            body_text: message.body_text.clone(),
            body_html: message.body_html.clone(),
            attachments: vec![], // Would need to handle attachments properly
        };
        let message_id = provider.send_message(&new_message).await?;

        // Store sent message in database
        let mut sent_message = message.clone();
        sent_message.flags.is_sent = true;
        sent_message.created_at = chrono::Utc::now();
        sent_message.updated_at = chrono::Utc::now();
        self.database.save_message(&sent_message).await?;

        Ok(message_id)
    }

    /// Search messages across accounts
    pub async fn search_messages(
        &self,
        account_id: Option<Uuid>,
        query: &str,
        limit: Option<u32>,
    ) -> MailResult<EmailSearchResult> {
        let search_start = std::time::Instant::now();
        
        if let Some(account_id) = account_id {
            // Search in specific account using provider
            let provider = self.get_provider(account_id).await?;
            let messages = provider.search_messages(query).await?;
            Ok(EmailSearchResult {
                query: query.to_string(),
                total_count: messages.len() as i32,
                messages,
                took: search_start.elapsed().as_millis() as u64,
                facets: None,
                suggestions: None,
            })
        } else {
            // Search across all accounts using local database
            let messages = self.database.search_messages(None, query).await
                .map_err(|e| MailError::database(&e.to_string()))?;
            
            Ok(EmailSearchResult {
                query: query.to_string(),
                total_count: messages.len() as i32,
                messages,
                took: search_start.elapsed().as_millis() as u64,
                facets: None,
                suggestions: None,
            })
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
        self.database
            .get_folders(&account_id.to_string())
            .await
            .map_err(|e| MailError::database(&e.to_string()))
    }

    /// Get threads for an account
    pub async fn get_threads(
        &self,
        account_id: Uuid,
        folder_id: Option<Uuid>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> MailResult<Vec<EmailThread>> {
        // Database method handles limit properly, offset not needed for basic pagination
        let account_id_str = account_id.to_string();
        let folder_str = folder_id.map(|id| id.to_string());
        let folder_ref = folder_str.as_deref();
        
        self.database
            .get_threads(&account_id_str, folder_ref)
            .await
            .map_err(|e| MailError::database(&e.to_string()))
    }

    /// Get sync status for all accounts
    pub async fn get_sync_status(&self) -> MailResult<Vec<MailSyncStatus>> {
        let accounts = self.list_accounts().await?;
        let mut statuses = Vec::new();

        for account in accounts {
            let account_status = self.sync_engine.get_account_status(account.id).await
                .unwrap_or(MailAccountStatus::Error);
            
            // Convert MailAccountStatus to MailSyncStatus
            let sync_status = MailSyncStatus {
                account_id: account.id,
                status: match account_status {
                    MailAccountStatus::Active => SyncStatus::Syncing,
                    MailAccountStatus::Error => SyncStatus::Error,
                    _ => SyncStatus::Idle,
                },
                last_sync_at: account.last_sync_at,
                current_operation: self.sync_engine.get_current_operation().await.map(|op| SyncOperation {
                    operation_type: SyncOperationType::FullSync, // Default operation type
                    folder: None,
                    progress: 0.0,
                    started_at: Utc::now(),
                }),
                stats: SyncStats::default(),
                last_error: self.sync_engine.get_last_error().await.map(|err| SyncError {
                    message: err,
                    code: "SYNC_ERROR".to_string(),
                    timestamp: Utc::now(),
                    details: None,
                }),
            };
            statuses.push(sync_status);
        }

        Ok(statuses)
    }

    /// Shutdown the mail engine
    pub async fn shutdown(&self) -> MailResult<()> {
        // Stop all syncs
        self.stop_sync().await?;

        // Shutdown notification system
        if let Some(notification_system) = &self.notification_system {
            notification_system.shutdown().await?;
        }

        // Clear providers
        {
            let mut providers = self.providers.write().await;
            providers.clear();
        }

        // Signal shutdown to sync engine
        self.sync_engine.shutdown().await?;
        
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

        // Create provider config from account
        let provider_config = match &account.provider_config {
            crate::mail::types::ProviderAccountConfig::Gmail { client_id, scopes, enable_push_notifications, history_id } => {
                ProviderAccountConfig::Gmail {
                    client_id: client_id.clone(),
                    scopes: scopes.clone(),
                    enable_push_notifications: *enable_push_notifications,
                    history_id: history_id.clone(),
                }
            },
            crate::mail::types::ProviderAccountConfig::Outlook { client_id, tenant_id, scopes, enable_webhooks, delta_token } => {
                ProviderAccountConfig::Outlook {
                    client_id: client_id.clone(),
                    tenant_id: tenant_id.clone(),
                    scopes: scopes.clone(),
                    enable_webhooks: *enable_webhooks,
                    delta_token: delta_token.clone(),
                }
            },
            _ => {
                return Err(MailError::not_supported("Provider", &format!("{:?}", account.provider)));
            }
        };
        
        let provider = ProviderFactory::create_provider(account.provider.clone(), provider_config)?;

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
    async fn get_provider(&self, account_id: Uuid) -> MailResult<Arc<dyn MailProviderTrait>> {
        let providers = self.providers.read().await;
        providers
            .get(&account_id)
            .cloned()
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
            config: ProviderAccountConfig::Gmail {
                client_id: "test_client_id".to_string(),
                scopes: vec!["test_scope".to_string()],
                enable_push_notifications: true,
                history_id: None,
            },
            sync_status: None,
        };

        let result = engine.add_account(account).await;
        assert!(result.is_ok());
    }
}