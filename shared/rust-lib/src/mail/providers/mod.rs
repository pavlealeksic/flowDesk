//! Mail provider implementations

use crate::mail::{error::MailResult, types::*};
use async_trait::async_trait;
use std::collections::HashMap;

pub mod gmail;
pub mod outlook;
pub mod imap;

pub use gmail::GmailProvider;
pub use outlook::OutlookProvider;
pub use imap::ImapProvider;

/// Capabilities supported by a mail provider
#[derive(Debug, Clone, Default)]
pub struct ProviderCapabilities {
    /// Support for OAuth2 authentication
    pub supports_oauth: bool,
    /// Support for push notifications/webhooks
    pub supports_push: bool,
    /// Support for server-side search
    pub supports_server_search: bool,
    /// Support for labels (vs folders)
    pub supports_labels: bool,
    /// Support for message threading
    pub supports_threading: bool,
    /// Support for server-side filters
    pub supports_server_filters: bool,
    /// Support for read receipts
    pub supports_read_receipts: bool,
    /// Support for message encryption
    pub supports_encryption: bool,
    /// Support for large attachments
    pub supports_large_attachments: bool,
    /// Maximum attachment size in bytes
    pub max_attachment_size: Option<u64>,
    /// Rate limits (requests per second)
    pub rate_limits: HashMap<String, u32>,
}

/// Generic mail provider trait
#[async_trait]
pub trait MailProvider: Send + Sync {
    /// Get provider name
    fn provider_name(&self) -> &'static str;

    /// Get provider capabilities
    fn capabilities(&self) -> ProviderCapabilities;

    /// Test connection and authentication
    async fn test_connection(&self) -> MailResult<bool>;

    // Account management
    async fn get_account_info(&self) -> MailResult<serde_json::Value>;

    // Folder/Label operations
    async fn list_folders(&self) -> MailResult<Vec<MailFolder>>;
    async fn create_folder(&self, name: &str, parent_id: Option<uuid::Uuid>) -> MailResult<MailFolder>;
    async fn delete_folder(&self, folder_id: uuid::Uuid) -> MailResult<()>;
    async fn rename_folder(&self, folder_id: uuid::Uuid, new_name: &str) -> MailResult<()>;

    // Message operations
    async fn list_messages(
        &self,
        folder_id: uuid::Uuid,
        limit: Option<u32>,
        page_token: Option<String>,
    ) -> MailResult<(Vec<EmailMessage>, Option<String>)>;

    async fn get_message(&self, message_id: &str) -> MailResult<EmailMessage>;
    async fn get_message_raw(&self, message_id: &str) -> MailResult<Vec<u8>>;
    
    async fn send_message(&self, message: &EmailMessage) -> MailResult<String>;
    async fn save_draft(&self, message: &EmailMessage) -> MailResult<String>;
    
    async fn delete_message(&self, message_id: &str) -> MailResult<()>;
    async fn move_message(&self, message_id: &str, folder_id: uuid::Uuid) -> MailResult<()>;
    async fn copy_message(&self, message_id: &str, folder_id: uuid::Uuid) -> MailResult<String>;

    // Message flags and labels
    async fn mark_read(&self, message_id: &str, read: bool) -> MailResult<()>;
    async fn mark_starred(&self, message_id: &str, starred: bool) -> MailResult<()>;
    async fn mark_important(&self, message_id: &str, important: bool) -> MailResult<()>;
    
    async fn add_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()>;
    async fn remove_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()>;

    // Batch operations
    async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult>;

    // Search operations
    async fn search_messages(&self, query: &str, limit: Option<u32>) -> MailResult<EmailSearchResult>;

    // Thread operations
    async fn get_thread(&self, thread_id: &str) -> MailResult<EmailThread>;
    async fn list_thread_messages(&self, thread_id: &str) -> MailResult<Vec<EmailMessage>>;

    // Attachment operations
    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>>;
    async fn download_attachment(&self, message_id: &str, attachment_id: &str, path: &str) -> MailResult<()>;

    // Sync operations
    async fn get_sync_changes(&self, sync_token: Option<String>) -> MailResult<SyncResult>;
    async fn get_full_sync_token(&self) -> MailResult<String>;

    // Push notifications (if supported)
    async fn setup_push_notifications(&self, webhook_url: &str) -> MailResult<()>;
    async fn disable_push_notifications(&self) -> MailResult<()>;

    // Filter operations (if supported)
    async fn create_filter(&self, filter: &EmailFilter) -> MailResult<String>;
    async fn update_filter(&self, filter_id: &str, filter: &EmailFilter) -> MailResult<()>;
    async fn delete_filter(&self, filter_id: &str) -> MailResult<()>;
    async fn list_filters(&self) -> MailResult<Vec<EmailFilter>>;
}

/// Sync operation result
#[derive(Debug, Clone)]
pub struct SyncResult {
    pub sync_token: Option<String>,
    pub changes: Vec<SyncChange>,
    pub has_more: bool,
}

/// Individual sync change
#[derive(Debug, Clone)]
pub enum SyncChange {
    MessageAdded(EmailMessage),
    MessageUpdated(EmailMessage),
    MessageDeleted(String), // message_id
    FolderAdded(MailFolder),
    FolderUpdated(MailFolder),
    FolderDeleted(uuid::Uuid), // folder_id
}

/// Provider factory for creating provider instances
pub struct ProviderFactory;

impl ProviderFactory {
    /// Create provider instance based on account configuration
    pub async fn create_provider(
        account: &MailAccount,
        access_token: Option<String>,
    ) -> MailResult<Box<dyn MailProvider>> {
        match account.provider {
            MailProvider::Gmail => {
                let token = access_token.ok_or_else(|| {
                    crate::mail::error::MailError::authentication("Gmail requires access token")
                })?;
                Ok(Box::new(GmailProvider::new(token).await?))
            }
            MailProvider::Outlook => {
                let token = access_token.ok_or_else(|| {
                    crate::mail::error::MailError::authentication("Outlook requires access token")
                })?;
                Ok(Box::new(OutlookProvider::new(token).await?))
            }
            MailProvider::Imap | MailProvider::Fastmail | MailProvider::Proton | 
            MailProvider::Yahoo | MailProvider::Aol => {
                if let ProviderAccountConfig::Imap {
                    imap_host,
                    imap_port,
                    imap_tls,
                    smtp_host,
                    smtp_port,
                    smtp_tls,
                    ..
                } = &account.provider_config {
                    Ok(Box::new(ImapProvider::new(
                        imap_host.clone(),
                        *imap_port,
                        *imap_tls,
                        smtp_host.clone(),
                        *smtp_port,
                        *smtp_tls,
                        account.email.clone(),
                    ).await?))
                } else {
                    Err(crate::mail::error::MailError::account_config(
                        "Invalid IMAP configuration"
                    ))
                }
            }
            MailProvider::Exchange => {
                Err(crate::mail::error::MailError::not_supported(
                    "Exchange Web Services",
                    "exchange"
                ))
            }
        }
    }

    /// Get default capabilities for a provider type
    pub fn get_default_capabilities(provider: crate::mail::types::MailProvider) -> ProviderCapabilities {
        match provider {
            crate::mail::types::MailProvider::Gmail => ProviderCapabilities {
                supports_oauth: true,
                supports_push: true,
                supports_server_search: true,
                supports_labels: true,
                supports_threading: true,
                supports_server_filters: true,
                supports_read_receipts: false,
                supports_encryption: false,
                supports_large_attachments: true,
                max_attachment_size: Some(25 * 1024 * 1024), // 25MB
                rate_limits: {
                    let mut limits = HashMap::new();
                    limits.insert("requests_per_second".to_string(), 10);
                    limits.insert("requests_per_day".to_string(), 1_000_000);
                    limits
                },
            },
            crate::mail::types::MailProvider::Outlook => ProviderCapabilities {
                supports_oauth: true,
                supports_push: true,
                supports_server_search: true,
                supports_labels: false,
                supports_threading: true,
                supports_server_filters: true,
                supports_read_receipts: true,
                supports_encryption: true,
                supports_large_attachments: true,
                max_attachment_size: Some(150 * 1024 * 1024), // 150MB
                rate_limits: {
                    let mut limits = HashMap::new();
                    limits.insert("requests_per_second".to_string(), 20);
                    limits.insert("requests_per_day".to_string(), 10_000);
                    limits
                },
            },
            crate::mail::types::MailProvider::Imap | crate::mail::types::MailProvider::Fastmail | 
            crate::mail::types::MailProvider::Proton | crate::mail::types::MailProvider::Yahoo | 
            crate::mail::types::MailProvider::Aol => ProviderCapabilities {
                supports_oauth: false,
                supports_push: false, // IDLE support varies
                supports_server_search: true,
                supports_labels: false,
                supports_threading: false,
                supports_server_filters: false,
                supports_read_receipts: false,
                supports_encryption: false,
                supports_large_attachments: true,
                max_attachment_size: None, // Provider dependent
                rate_limits: HashMap::new(),
            },
            crate::mail::types::MailProvider::Exchange => ProviderCapabilities {
                supports_oauth: true,
                supports_push: true,
                supports_server_search: true,
                supports_labels: false,
                supports_threading: true,
                supports_server_filters: true,
                supports_read_receipts: true,
                supports_encryption: true,
                supports_large_attachments: true,
                max_attachment_size: Some(100 * 1024 * 1024), // 100MB
                rate_limits: HashMap::new(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_capabilities() {
        let gmail_caps = ProviderFactory::get_default_capabilities(crate::mail::types::MailProvider::Gmail);
        assert!(gmail_caps.supports_oauth);
        assert!(gmail_caps.supports_labels);
        assert!(gmail_caps.supports_threading);

        let outlook_caps = ProviderFactory::get_default_capabilities(crate::mail::types::MailProvider::Outlook);
        assert!(outlook_caps.supports_oauth);
        assert!(!outlook_caps.supports_labels);
        assert!(outlook_caps.supports_threading);

        let imap_caps = ProviderFactory::get_default_capabilities(crate::mail::types::MailProvider::Imap);
        assert!(!imap_caps.supports_oauth);
        assert!(!imap_caps.supports_labels);
        assert!(!imap_caps.supports_threading);
    }
}