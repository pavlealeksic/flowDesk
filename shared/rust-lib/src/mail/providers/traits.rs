use async_trait::async_trait;
use crate::mail::{MailMessage, MailFolder, MailAttachment};

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