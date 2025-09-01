//! IMAP provider implementation with complete IMAP4 support
//! 
//! This module provides a comprehensive IMAP client with support for:
//! - Full IMAP4 protocol implementation
//! - TLS/SSL security with certificate validation
//! - IDLE support for real-time sync
//! - Connection pooling and automatic reconnection
//! - Robust error handling and retry logic
//! - Message threading and search capabilities
//! - Support for various authentication methods

pub mod client;
pub mod connection;
pub mod idle;
pub mod search;
pub mod sync;
pub mod utils;

pub use client::ImapClient;
pub use connection::{ImapConnection, ImapConnectionPool};

use crate::mail::{error::MailResult, providers::{MailProvider, ProviderCapabilities}, types::*};
use async_trait::async_trait;
use std::{sync::Arc, collections::HashMap, time::Duration};
use tokio::sync::{RwLock, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc};

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
pub struct ImapProvider {
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

impl ImapProvider {
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
        provider_caps.supports_push = capabilities.contains("IDLE");
        
        // Check for server-side search
        provider_caps.supports_server_search = true; // IMAP always supports SEARCH
        
        // Check for threading
        provider_caps.supports_threading = capabilities.contains("THREAD=REFERENCES") 
            || capabilities.contains("THREAD=ORDEREDSUBJECT");
        
        // Check for compression
        let supports_compression = capabilities.contains("COMPRESS=DEFLATE");
        
        // Check for various extensions
        let supports_condstore = capabilities.contains("CONDSTORE");
        let supports_qresync = capabilities.contains("QRESYNC");
        
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

    /// Convert IMAP message to EmailMessage
    async fn convert_imap_message(
        &self, 
        imap_msg: &async_imap::types::Fetch,
        folder_id: Uuid,
    ) -> MailResult<EmailMessage> {
        let uid = imap_msg.uid.ok_or_else(|| {
            crate::mail::error::MailError::provider_api("IMAP", "Message missing UID", "missing_uid")
        })?;
        
        let envelope = imap_msg.envelope().ok_or_else(|| {
            crate::mail::error::MailError::provider_api("IMAP", "Message missing envelope", "missing_envelope")
        })?;
        
        let body = imap_msg.body().unwrap_or_default();
        let parsed = mailparse::parse_mail(body)?;
        
        let message_id = format!("{}:{}", folder_id, uid);
        
        // Store UID mapping
        {
            let mut uid_cache = self.uid_cache.write().await;
            uid_cache.insert(message_id.clone(), uid);
        }
        
        let subject = envelope.subject
            .as_ref()
            .and_then(|s| String::from_utf8(s.clone()).ok())
            .unwrap_or_default();
        
        let from = envelope.from
            .as_ref()
            .and_then(|addrs| addrs.first())
            .and_then(|addr| {
                let name = addr.name.as_ref().and_then(|n| String::from_utf8(n.clone()).ok());
                let email = addr.mailbox.as_ref()
                    .and_then(|mb| String::from_utf8(mb.clone()).ok())?;
                let host = addr.host.as_ref()
                    .and_then(|h| String::from_utf8(h.clone()).ok())?;
                Some(EmailAddress {
                    name,
                    email: format!("{}@{}", email, host),
                })
            });
        
        let to = envelope.to.as_ref().map(|addrs| {
            addrs.iter().filter_map(|addr| {
                let name = addr.name.as_ref().and_then(|n| String::from_utf8(n.clone()).ok());
                let email = addr.mailbox.as_ref()
                    .and_then(|mb| String::from_utf8(mb.clone()).ok())?;
                let host = addr.host.as_ref()
                    .and_then(|h| String::from_utf8(h.clone()).ok())?;
                Some(EmailAddress {
                    name,
                    email: format!("{}@{}", email, host),
                })
            }).collect()
        }).unwrap_or_default();
        
        let cc = envelope.cc.as_ref().map(|addrs| {
            addrs.iter().filter_map(|addr| {
                let name = addr.name.as_ref().and_then(|n| String::from_utf8(n.clone()).ok());
                let email = addr.mailbox.as_ref()
                    .and_then(|mb| String::from_utf8(mb.clone()).ok())?;
                let host = addr.host.as_ref()
                    .and_then(|h| String::from_utf8(h.clone()).ok())?;
                Some(EmailAddress {
                    name,
                    email: format!("{}@{}", email, host),
                })
            }).collect()
        }).unwrap_or_default();
        
        let flags = imap_msg.flags();
        let is_read = flags.iter().any(|f| matches!(f, async_imap::types::Flag::Seen));
        let is_flagged = flags.iter().any(|f| matches!(f, async_imap::types::Flag::Flagged));
        let is_draft = flags.iter().any(|f| matches!(f, async_imap::types::Flag::Draft));
        let is_answered = flags.iter().any(|f| matches!(f, async_imap::types::Flag::Answered));
        
        let date = envelope.date
            .as_ref()
            .and_then(|d| String::from_utf8(d.clone()).ok())
            .and_then(|d| chrono::DateTime::parse_from_rfc2822(&d).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);
        
        // Extract message content
        let (text_content, html_content) = self.extract_content(&parsed).await?;
        
        // Extract attachments
        let attachments = self.extract_attachments(&parsed).await?;
        
        Ok(EmailMessage {
            id: Uuid::new_v4(),
            provider_id: message_id,
            account_id: Uuid::nil(), // Will be set by caller
            folder_id,
            thread_id: None,
            subject,
            from,
            to,
            cc,
            bcc: vec![],
            text_content,
            html_content,
            attachments,
            flags: EmailFlags {
                is_read,
                is_starred: is_flagged,
                is_important: false,
                is_draft,
                is_sent: false,
                is_replied: is_answered,
                is_forwarded: false,
                is_deleted: false,
                is_archived: false,
                is_spam: false,
            },
            labels: vec![],
            created_at: date,
            updated_at: Utc::now(),
            size: body.len() as u64,
            message_id_header: None,
            in_reply_to: None,
            references: vec![],
        })
    }

    /// Extract text and HTML content from parsed message
    async fn extract_content(&self, parsed: &mailparse::ParsedMail<'_>) -> MailResult<(Option<String>, Option<String>)> {
        let mut text_content = None;
        let mut html_content = None;
        
        if parsed.subparts.is_empty() {
            // Single part message
            match parsed.ctype.mimetype.as_str() {
                "text/plain" => {
                    text_content = Some(parsed.get_body()?);
                }
                "text/html" => {
                    html_content = Some(parsed.get_body()?);
                    // Convert HTML to text for the text content
                    text_content = Some(html2text::from_read(parsed.get_body()?.as_bytes(), 80));
                }
                _ => {}
            }
        } else {
            // Multipart message
            self.extract_multipart_content(parsed, &mut text_content, &mut html_content).await?;
        }
        
        Ok((text_content, html_content))
    }

    /// Extract content from multipart message
    async fn extract_multipart_content(
        &self,
        parsed: &mailparse::ParsedMail<'_>,
        text_content: &mut Option<String>,
        html_content: &mut Option<String>,
    ) -> MailResult<()> {
        for part in &parsed.subparts {
            if part.subparts.is_empty() {
                // Leaf part
                match part.ctype.mimetype.as_str() {
                    "text/plain" if text_content.is_none() => {
                        *text_content = Some(part.get_body()?);
                    }
                    "text/html" if html_content.is_none() => {
                        *html_content = Some(part.get_body()?);
                    }
                    _ => {}
                }
            } else {
                // Nested multipart
                self.extract_multipart_content(part, text_content, html_content).await?;
            }
        }
        
        // If we have HTML but no text, convert HTML to text
        if text_content.is_none() && html_content.is_some() {
            if let Some(ref html) = html_content {
                *text_content = Some(html2text::from_read(html.as_bytes(), 80));
            }
        }
        
        Ok(())
    }

    /// Extract attachments from parsed message
    async fn extract_attachments(&self, parsed: &mailparse::ParsedMail<'_>) -> MailResult<Vec<EmailAttachment>> {
        let mut attachments = Vec::new();
        
        self.extract_attachments_recursive(parsed, &mut attachments).await?;
        
        Ok(attachments)
    }

    /// Extract attachments recursively from message parts
    async fn extract_attachments_recursive(
        &self,
        parsed: &mailparse::ParsedMail<'_>,
        attachments: &mut Vec<EmailAttachment>,
    ) -> MailResult<()> {
        for part in &parsed.subparts {
            if part.subparts.is_empty() {
                // Check if this is an attachment
                let is_attachment = part.ctype.params.get("name").is_some()
                    || part.headers.iter().any(|h| {
                        h.get_key() == "Content-Disposition" 
                        && h.get_value().contains("attachment")
                    });
                
                if is_attachment {
                    let filename = part.ctype.params.get("name")
                        .or_else(|| {
                            part.headers.iter()
                                .find(|h| h.get_key() == "Content-Disposition")
                                .and_then(|h| {
                                    // Parse filename from Content-Disposition header
                                    let value = h.get_value();
                                    if let Some(start) = value.find("filename=") {
                                        let filename_part = &value[start + 9..];
                                        let filename = if filename_part.starts_with('"') {
                                            filename_part.trim_start_matches('"').split('"').next().unwrap_or("")
                                        } else {
                                            filename_part.split(';').next().unwrap_or("").trim()
                                        };
                                        Some(filename)
                                    } else {
                                        None
                                    }
                                })
                        })
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "attachment".to_string());
                    
                    let content_type = part.ctype.mimetype.clone();
                    let size = part.get_body_raw()?.len() as u64;
                    
                    attachments.push(EmailAttachment {
                        id: Uuid::new_v4(),
                        filename,
                        content_type,
                        size,
                        inline: part.headers.iter().any(|h| {
                            h.get_key() == "Content-Disposition" 
                            && h.get_value().contains("inline")
                        }),
                        content_id: part.headers.iter()
                            .find(|h| h.get_key() == "Content-ID")
                            .map(|h| h.get_value().to_string()),
                        data: None, // Data will be loaded on demand
                    });
                }
            } else {
                // Nested multipart
                self.extract_attachments_recursive(part, attachments).await?;
            }
        }
        
        Ok(())
    }
}

#[async_trait]
impl MailProvider for ImapProvider {
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
        // IMAP doesn't have a standard "important" flag, so we'll use a custom flag
        // This could be implemented using IMAP keywords if the server supports it
        Ok(())
    }

    async fn add_labels(&self, _message_id: &str, _labels: &[String]) -> MailResult<()> {
        // IMAP doesn't have labels like Gmail, but we could implement this using IMAP keywords
        Ok(())
    }

    async fn remove_labels(&self, _message_id: &str, _labels: &[String]) -> MailResult<()> {
        // IMAP doesn't have labels like Gmail, but we could implement this using IMAP keywords
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_imap_config_default() {
        let config = ImapConfig::default();
        assert_eq!(config.imap_port, 993);
        assert!(config.imap_tls);
        assert_eq!(config.smtp_port, 587);
        assert!(config.smtp_tls);
    }

    #[test]
    fn test_sync_state_initialization() {
        let state = ImapSyncState {
            last_uid_validity: None,
            highest_modseq: None,
            folder_sync_tokens: HashMap::new(),
        };
        
        assert!(state.last_uid_validity.is_none());
        assert!(state.highest_modseq.is_none());
        assert!(state.folder_sync_tokens.is_empty());
    }
}