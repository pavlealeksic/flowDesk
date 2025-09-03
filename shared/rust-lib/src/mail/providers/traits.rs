use async_trait::async_trait;
use crate::mail::{MailMessage, MailFolder, MailAttachment, EmailMessage, MailResult};

#[async_trait]
pub trait ImapProvider {
    async fn connect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn disconnect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn fetch_messages(&self, folder: &str, limit: u32) -> Result<Vec<MailMessage>, Box<dyn std::error::Error + Send + Sync>>;
    async fn get_folders(&self) -> Result<Vec<MailFolder>, Box<dyn std::error::Error + Send + Sync>>;
    async fn mark_message_read(&self, message_id: &str, is_read: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn star_message(&self, message_id: &str, is_starred: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn delete_message(&self, message_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>>;
    async fn send_message(&self, message: &MailMessage) -> Result<String, Box<dyn std::error::Error + Send + Sync>>;
}

#[async_trait]
pub trait SmtpProvider {
    async fn send_message(&self, message: &MailMessage) -> Result<String, Box<dyn std::error::Error + Send + Sync>>;
    async fn verify_connection(&self) -> Result<bool, Box<dyn std::error::Error + Send + Sync>>;
}

/// Main mail provider trait that all mail providers must implement
#[async_trait]
pub trait MailProviderTrait: Send + Sync {
    /// Connect to the mail provider
    async fn connect(&mut self) -> MailResult<()>;
    
    /// Disconnect from the mail provider
    async fn disconnect(&mut self) -> MailResult<()>;
    
    /// Fetch messages from a folder
    async fn fetch_messages(&self, folder: &str, limit: u32) -> MailResult<Vec<EmailMessage>>;
    
    /// Get all folders
    async fn get_folders(&self) -> MailResult<Vec<MailFolder>>;
    
    /// Send a message
    async fn send_message(&self, message: &EmailMessage) -> MailResult<String>;
    
    /// Mark message as read/unread
    async fn mark_message_read(&self, message_id: &str, is_read: bool) -> MailResult<()>;
    
    /// Star/unstar message
    async fn star_message(&self, message_id: &str, is_starred: bool) -> MailResult<()>;
    
    /// Delete message
    async fn delete_message(&self, message_id: &str) -> MailResult<()>;
    
    /// Search messages
    async fn search_messages(&self, query: &str) -> MailResult<Vec<EmailMessage>>;
    
    /// Get message by ID
    async fn get_message(&self, message_id: &str) -> MailResult<Option<EmailMessage>>;
    
    /// Sync messages (incremental)
    async fn sync_messages(&self, folder: &str, since: Option<chrono::DateTime<chrono::Utc>>) -> MailResult<Vec<EmailMessage>>;
}