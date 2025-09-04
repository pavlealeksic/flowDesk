//! Mail provider implementations
//!
//! This module contains all mail provider implementations including Gmail, Outlook,
//! and generic IMAP/SMTP providers with real protocol implementations.

pub mod gmail;
pub mod graph;
pub mod imap; // Comprehensive IMAP implementation
pub mod imap_client; // Additional IMAP client
pub mod outlook;
pub mod smtp;
pub mod smtp_client; // Real SMTP implementation
pub mod traits;

// Re-export the real implementations
pub use gmail::GmailProvider;
pub use imap::{ImapClient, ImapProvider as ImapProviderStruct};
pub use imap_client::ImapClient as SimpleImapClient;
pub use smtp_client::SmtpClient as RealSmtpClient;
pub use traits::{ImapProvider as ImapProviderTrait, SmtpProvider};
pub use outlook::OutlookProvider;

// Types will be automatically available through direct definition

use crate::mail::{error::MailResult, types::*};
use async_trait::async_trait;
use std::sync::Arc;

/// Provider factory for creating mail provider instances
pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(
        provider_type: crate::mail::types::MailProvider,
        config: ProviderAccountConfig,
    ) -> MailResult<Arc<dyn MailProviderTrait>> {
        match provider_type {
            crate::mail::types::MailProvider::Gmail => {
                let provider = GmailProvider::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Outlook => {
                let provider = OutlookProvider::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Imap => {
                let provider = ImapProviderStruct::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Exchange => {
                // Exchange can use Graph API (same as Outlook)
                let provider = OutlookProvider::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Fastmail => {
                // Fastmail can use IMAP
                let provider = ImapProviderStruct::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Proton => {
                // ProtonMail needs special handling, for now use IMAP
                let provider = ImapProviderStruct::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Yahoo => {
                // Yahoo can use IMAP
                let provider = ImapProviderStruct::new(config)?;
                Ok(Arc::new(provider))
            }
            crate::mail::types::MailProvider::Aol => {
                // AOL can use IMAP
                let provider = ImapProviderStruct::new(config)?;
                Ok(Arc::new(provider))
            }
        }
    }
}

/// Sync result for provider operations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub messages_synced: usize,
    pub errors: Vec<String>,
    pub changes: Vec<SyncChange>,
}

/// Sync change events
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum SyncChange {
    MessageAdded(MailMessage),
    MessageUpdated(MailMessage),
    MessageDeleted(String),
    FolderAdded(MailFolder),
    FolderUpdated(MailFolder),
    FolderDeleted(String),
}

/// Provider capabilities flags
#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub supports_oauth: bool,
    pub supports_push: bool,
    pub supports_labels: bool,
    pub supports_threading: bool,
    pub supports_search: bool,
    pub max_attachment_size: u64,
}

impl Default for ProviderCapabilities {
    fn default() -> Self {
        Self {
            supports_oauth: false,
            supports_push: false,
            supports_labels: false,
            supports_threading: false,
            supports_search: true,
            max_attachment_size: 25 * 1024 * 1024, // 25MB default
        }
    }
}

/// Common trait for all mail providers
#[async_trait]
pub trait MailProviderTrait: Send + Sync {
    fn provider_name(&self) -> &'static str;
    fn capabilities(&self) -> ProviderCapabilities;
    async fn test_connection(&self) -> MailResult<bool>;
    async fn get_account_info(&self) -> MailResult<MailAccount>;
    async fn get_folders(&self) -> MailResult<Vec<MailFolder>>;
    async fn list_folders(&self) -> MailResult<Vec<MailFolder>> {
        self.get_folders().await
    }
    async fn create_folder(&self, name: &str, parent_id: Option<&str>) -> MailResult<MailFolder>;
    async fn delete_folder(&self, folder_id: &str) -> MailResult<()>;
    async fn rename_folder(&self, folder_id: &str, new_name: &str) -> MailResult<()>;
    async fn get_messages(&self, folder_id: &str, limit: Option<u32>) -> MailResult<Vec<MailMessage>>;
    async fn send_message(&self, message: &NewMessage) -> MailResult<String>;
    async fn update_message_flags(&self, message_id: &str, flags: MessageFlags) -> MailResult<()>;
    async fn delete_message(&self, message_id: &str) -> MailResult<()>;
    async fn search_messages(&self, query: &str) -> MailResult<Vec<MailMessage>>;
    async fn get_message_content(&self, message_id: &str) -> MailResult<String>;
    async fn download_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>>;
    async fn list_messages(&self, folder_id: &str, limit: Option<u32>) -> MailResult<Vec<MailMessage>> {
        self.get_messages(folder_id, limit).await
    }
    async fn get_message(&self, message_id: &str) -> MailResult<MailMessage>;
    async fn get_message_raw(&self, message_id: &str) -> MailResult<String>;
    async fn save_draft(&self, message: &NewMessage) -> MailResult<String>;
    async fn move_message(&self, message_id: &str, target_folder: &str) -> MailResult<()>;
    async fn copy_message(&self, message_id: &str, target_folder: &str) -> MailResult<()>;
    async fn add_label(&self, message_id: &str, label: &str) -> MailResult<()>;
    async fn remove_label(&self, message_id: &str, label: &str) -> MailResult<()>;
    async fn mark_read(&self, message_id: &str, is_read: bool) -> MailResult<()> {
        let flags = MessageFlags { is_seen: is_read, ..Default::default() };
        self.update_message_flags(message_id, flags).await
    }
    async fn mark_starred(&self, message_id: &str, is_starred: bool) -> MailResult<()> {
        let flags = MessageFlags { is_flagged: is_starred, ..Default::default() };
        self.update_message_flags(message_id, flags).await
    }
    async fn mark_important(&self, message_id: &str, is_important: bool) -> MailResult<()>;
    async fn add_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()>;
    async fn remove_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()>;
    async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult>;
    async fn get_thread(&self, thread_id: &str) -> MailResult<EmailThread>;
    async fn list_thread_messages(&self, thread_id: &str) -> MailResult<Vec<MailMessage>>;
    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
        self.download_attachment(message_id, attachment_id).await
    }
    async fn get_sync_changes(&self, since: Option<&str>) -> MailResult<SyncResult>;
    async fn get_full_sync_token(&self) -> MailResult<String>;
    async fn setup_push_notifications(&self, webhook_url: &str) -> MailResult<String>;
    async fn disable_push_notifications(&self, subscription_id: &str) -> MailResult<()>;
    async fn create_filter(&self, filter: &EmailFilter) -> MailResult<String>;
    async fn update_filter(&self, filter_id: &str, filter: &EmailFilter) -> MailResult<()>;
    async fn delete_filter(&self, filter_id: &str) -> MailResult<()>;
    async fn list_filters(&self) -> MailResult<Vec<EmailFilter>>;
}