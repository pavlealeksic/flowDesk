//! Updated IMAP provider implementation with modular architecture

pub use self::imap_mod::*;

mod imap_mod {
    //! IMAP provider implementation with comprehensive IMAP4 support
    
    pub mod client;
    pub mod connection;
    pub mod idle;
    pub mod search;
    pub mod sync;
    pub mod utils;
    
    pub use client::ImapClient;
    pub use connection::{ImapConnection, ImapConnectionPool};
    
    use crate::mail::{error::MailResult, providers::*, types::*};
    use async_trait::async_trait;
    use std::{sync::Arc, collections::HashMap, time::Duration};
    use tokio::sync::{RwLock, Mutex};
    use uuid::Uuid;
    
    /// IMAP provider configuration
    #[derive(Debug, Clone)]
    pub struct ImapConfig {
        pub imap_host: String,
        pub imap_port: u16,
        pub imap_tls: bool,
        pub smtp_host: String,
        pub smtp_port: u16,
        pub smtp_tls: bool,
        pub username: String,
        pub password: secrecy::Secret<String>,
        pub connection_timeout: Duration,
        pub idle_timeout: Duration,
        pub max_connections: usize,
        pub enable_idle: bool,
        pub enable_compression: bool,
        pub enable_oauth2: bool,
        pub oauth2_mechanism: Option<String>,
    }

    impl Default for ImapConfig {
        fn default() -> Self {
            Self {
                imap_host: String::new(),
                imap_port: 993,
                imap_tls: true,
                smtp_host: String::new(),
                smtp_port: 587,
                smtp_tls: true,
                username: String::new(),
                password: secrecy::Secret::new(String::new()),
                connection_timeout: Duration::from_secs(30),
                idle_timeout: Duration::from_secs(1800), // 30 minutes
                max_connections: 5,
                enable_idle: true,
                enable_compression: false,
                enable_oauth2: false,
                oauth2_mechanism: None,
            }
        }
    }

    /// IMAP provider with full protocol support
    pub struct ImapProviderNew {
        config: ImapConfig,
        connection_pool: Arc<ImapConnectionPool>,
        client: Arc<ImapClient>,
        folder_cache: Arc<RwLock<HashMap<Uuid, String>>>, // folder_id -> folder_name
        uid_cache: Arc<RwLock<HashMap<String, u32>>>, // message_id -> uid
        sync_state: Arc<Mutex<ImapSyncState>>,
        capabilities: ProviderCapabilities,
    }

    #[derive(Debug, Clone)]
    struct ImapSyncState {
        last_uid_validity: Option<u32>,
        highest_modseq: Option<u64>,
        folder_sync_tokens: HashMap<String, String>,
    }

    impl ImapProviderNew {
        /// Create new IMAP provider instance
        pub async fn new(config: ImapConfig) -> MailResult<Self> {
            let connection_pool = Arc::new(ImapConnectionPool::new(config.clone()).await?);
            let client = Arc::new(ImapClient::new(connection_pool.clone()).await?);
            
            // Test initial connection
            let _conn = connection_pool.get_connection().await?;
            
            let capabilities = Self::detect_capabilities(&client).await?;
            
            Ok(Self {
                config,
                connection_pool,
                client,
                folder_cache: Arc::new(RwLock::new(HashMap::new())),
                uid_cache: Arc::new(RwLock::new(HashMap::new())),
                sync_state: Arc::new(Mutex::new(ImapSyncState {
                    last_uid_validity: None,
                    highest_modseq: None,
                    folder_sync_tokens: HashMap::new(),
                })),
                capabilities,
            })
        }

        /// Create IMAP provider from separate host configurations
        pub async fn from_hosts(
            imap_host: String,
            imap_port: u16,
            imap_tls: bool,
            smtp_host: String,
            smtp_port: u16,
            smtp_tls: bool,
            username: String,
            password: String,
        ) -> MailResult<Self> {
            let config = ImapConfig {
                imap_host,
                imap_port,
                imap_tls,
                smtp_host,
                smtp_port,
                smtp_tls,
                username,
                password: secrecy::Secret::new(password),
                ..Default::default()
            };
            
            Self::new(config).await
        }

        /// Detect server capabilities
        async fn detect_capabilities(client: &ImapClient) -> MailResult<ProviderCapabilities> {
            let capabilities = client.get_capabilities().await?;
            
            let mut provider_caps = ProviderCapabilities::default();
            
            // Check for IDLE support
            provider_caps.supports_push = capabilities.iter().any(|cap| cap.contains("IDLE"));
            
            // Check for server-side search
            provider_caps.supports_server_search = true; // IMAP always supports SEARCH
            
            // Check for threading
            provider_caps.supports_threading = capabilities.iter().any(|cap| 
                cap.contains("THREAD=REFERENCES") || cap.contains("THREAD=ORDEREDSUBJECT"));
            
            // Other capabilities
            let supports_compression = capabilities.iter().any(|cap| cap.contains("COMPRESS=DEFLATE"));
            let supports_condstore = capabilities.iter().any(|cap| cap.contains("CONDSTORE"));
            let supports_qresync = capabilities.iter().any(|cap| cap.contains("QRESYNC"));
            
            tracing::info!("IMAP capabilities detected: IDLE={}, THREAD={}, COMPRESS={}, CONDSTORE={}, QRESYNC={}", 
                provider_caps.supports_push, provider_caps.supports_threading, 
                supports_compression, supports_condstore, supports_qresync);
            
            Ok(provider_caps)
        }

        /// Get folder ID from cache or create mapping
        async fn get_folder_id(&self, folder_name: &str) -> MailResult<Uuid> {
            let cache = self.folder_cache.read().await;
            
            // Find existing mapping
            for (id, name) in cache.iter() {
                if name == folder_name {
                    return Ok(*id);
                }
            }
            
            drop(cache);
            
            // Create new mapping
            let folder_id = Uuid::new_v4();
            let mut cache = self.folder_cache.write().await;
            cache.insert(folder_id, folder_name.to_string());
            
            Ok(folder_id)
        }

        /// Get folder name from ID
        async fn get_folder_name(&self, folder_id: Uuid) -> MailResult<String> {
            let cache = self.folder_cache.read().await;
            cache.get(&folder_id)
                .cloned()
                .ok_or_else(|| crate::mail::error::MailError::not_found("Folder", &folder_id.to_string()))
        }
    }

    #[async_trait]
    impl MailProvider for ImapProviderNew {
        fn provider_name(&self) -> &'static str {
            "imap"
        }

        fn capabilities(&self) -> ProviderCapabilities {
            self.capabilities.clone()
        }

        async fn test_connection(&self) -> MailResult<bool> {
            match self.connection_pool.get_connection().await {
                Ok(_) => Ok(true),
                Err(e) => {
                    tracing::warn!("IMAP connection test failed: {}", e);
                    Ok(false)
                }
            }
        }

        async fn get_account_info(&self) -> MailResult<serde_json::Value> {
            let capabilities = self.client.get_capabilities().await?;
            let namespace = self.client.get_namespace().await.unwrap_or_default();
            
            Ok(serde_json::json!({
                "provider": "imap",
                "server": self.config.imap_host,
                "port": self.config.imap_port,
                "tls": self.config.imap_tls,
                "capabilities": capabilities,
                "namespace": namespace,
                "username": self.config.username
            }))
        }

        async fn list_folders(&self) -> MailResult<Vec<MailFolder>> {
            self.client.list_folders().await
        }

        async fn create_folder(&self, name: &str, parent_id: Option<Uuid>) -> MailResult<MailFolder> {
            let parent_name = if let Some(parent_id) = parent_id {
                Some(self.get_folder_name(parent_id).await?)
            } else {
                None
            };
            
            self.client.create_folder(name, parent_name.as_deref()).await
        }

        async fn delete_folder(&self, folder_id: Uuid) -> MailResult<()> {
            let folder_name = self.get_folder_name(folder_id).await?;
            self.client.delete_folder(&folder_name).await
        }

        async fn rename_folder(&self, folder_id: Uuid, new_name: &str) -> MailResult<()> {
            let folder_name = self.get_folder_name(folder_id).await?;
            self.client.rename_folder(&folder_name, new_name).await
        }

        async fn list_messages(&self, folder_id: Uuid, limit: Option<u32>, page_token: Option<String>) -> MailResult<(Vec<EmailMessage>, Option<String>)> {
            let folder_name = self.get_folder_name(folder_id).await?;
            self.client.list_messages(&folder_name, limit, page_token.as_deref(), folder_id).await
        }

        async fn get_message(&self, message_id: &str) -> MailResult<EmailMessage> {
            self.client.get_message(message_id).await
        }

        async fn get_message_raw(&self, message_id: &str) -> MailResult<Vec<u8>> {
            self.client.get_message_raw(message_id).await
        }

        async fn send_message(&self, message: &EmailMessage) -> MailResult<String> {
            self.client.send_message(message).await
        }

        async fn save_draft(&self, message: &EmailMessage) -> MailResult<String> {
            self.client.save_draft(message).await
        }

        async fn delete_message(&self, message_id: &str) -> MailResult<()> {
            self.client.delete_message(message_id).await
        }

        async fn move_message(&self, message_id: &str, folder_id: Uuid) -> MailResult<()> {
            let folder_name = self.get_folder_name(folder_id).await?;
            self.client.move_message(message_id, &folder_name).await
        }

        async fn copy_message(&self, message_id: &str, folder_id: Uuid) -> MailResult<String> {
            let folder_name = self.get_folder_name(folder_id).await?;
            self.client.copy_message(message_id, &folder_name).await
        }

        async fn mark_read(&self, message_id: &str, read: bool) -> MailResult<()> {
            self.client.mark_read(message_id, read).await
        }

        async fn mark_starred(&self, message_id: &str, starred: bool) -> MailResult<()> {
            self.client.mark_starred(message_id, starred).await
        }

        async fn mark_important(&self, _message_id: &str, _important: bool) -> MailResult<()> {
            // IMAP doesn't have a standard "important" flag
            Ok(())
        }

        async fn add_labels(&self, _message_id: &str, _labels: &[String]) -> MailResult<()> {
            // IMAP doesn't have labels like Gmail, but could implement using IMAP keywords
            Ok(())
        }

        async fn remove_labels(&self, _message_id: &str, _labels: &[String]) -> MailResult<()> {
            // IMAP doesn't have labels like Gmail, but could implement using IMAP keywords
            Ok(())
        }

        async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult> {
            self.client.bulk_operation(operation).await
        }

        async fn search_messages(&self, query: &str, limit: Option<u32>) -> MailResult<EmailSearchResult> {
            self.client.search_messages(query, limit).await
        }

        async fn get_thread(&self, thread_id: &str) -> MailResult<EmailThread> {
            self.client.get_thread(thread_id).await
        }

        async fn list_thread_messages(&self, thread_id: &str) -> MailResult<Vec<EmailMessage>> {
            self.client.list_thread_messages(thread_id).await
        }

        async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
            self.client.get_attachment(message_id, attachment_id).await
        }

        async fn download_attachment(&self, message_id: &str, attachment_id: &str, path: &str) -> MailResult<()> {
            let data = self.get_attachment(message_id, attachment_id).await?;
            tokio::fs::write(path, data).await?;
            Ok(())
        }

        async fn get_sync_changes(&self, sync_token: Option<String>) -> MailResult<SyncResult> {
            self.client.get_sync_changes(sync_token).await
        }

        async fn get_full_sync_token(&self) -> MailResult<String> {
            self.client.get_full_sync_token().await
        }

        async fn setup_push_notifications(&self, webhook_url: &str) -> MailResult<()> {
            if self.capabilities.supports_push {
                self.client.setup_idle_monitoring(webhook_url).await
            } else {
                Err(crate::mail::error::MailError::not_supported("Push notifications", "idle"))
            }
        }

        async fn disable_push_notifications(&self) -> MailResult<()> {
            self.client.disable_idle_monitoring().await
        }

        async fn create_filter(&self, _filter: &EmailFilter) -> MailResult<String> {
            Err(crate::mail::error::MailError::not_supported("Server-side filters", "sieve"))
        }

        async fn update_filter(&self, _filter_id: &str, _filter: &EmailFilter) -> MailResult<()> {
            Err(crate::mail::error::MailError::not_supported("Server-side filters", "sieve"))
        }

        async fn delete_filter(&self, _filter_id: &str) -> MailResult<()> {
            Err(crate::mail::error::MailError::not_supported("Server-side filters", "sieve"))
        }

        async fn list_filters(&self) -> MailResult<Vec<EmailFilter>> {
            Ok(vec![]) // Return empty list for servers without Sieve support
        }
    }
}