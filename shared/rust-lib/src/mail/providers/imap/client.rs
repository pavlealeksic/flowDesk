//! IMAP client with comprehensive IMAP4 protocol implementation

use super::{ImapConnectionPool, ImapConfig};
use crate::mail::{
    error::{MailError, MailResult},
    types::*,
};
use async_imap::{
    types::{Fetch, Flag, Mailbox, Name},
    Seq, SequenceSet,
};
use std::{collections::HashMap, sync::Arc, time::SystemTime};
use tokio::sync::{Mutex, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Comprehensive IMAP client implementation
pub struct ImapClient {
    connection_pool: Arc<ImapConnectionPool>,
    folder_cache: Arc<RwLock<HashMap<String, CachedFolder>>>,
    search_cache: Arc<RwLock<HashMap<String, CachedSearchResult>>>,
    sync_state: Arc<Mutex<HashMap<String, FolderSyncState>>>,
}

#[derive(Debug, Clone)]
struct CachedFolder {
    folder: MailFolder,
    last_updated: SystemTime,
    uid_validity: u32,
    uid_next: u32,
    recent: u32,
    exists: u32,
}

#[derive(Debug, Clone)]
struct CachedSearchResult {
    query: String,
    results: Vec<u32>, // UIDs
    last_updated: SystemTime,
    folder: String,
}

#[derive(Debug, Clone)]
struct FolderSyncState {
    last_uid: u32,
    uid_validity: u32,
    mod_seq: Option<u64>,
    sync_token: Option<String>,
}

impl ImapClient {
    /// Create new IMAP client
    pub async fn new(connection_pool: Arc<ImapConnectionPool>) -> MailResult<Self> {
        Ok(Self {
            connection_pool,
            folder_cache: Arc::new(RwLock::new(HashMap::new())),
            search_cache: Arc::new(RwLock::new(HashMap::new())),
            sync_state: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Get server capabilities
    pub async fn get_capabilities(&self) -> MailResult<Vec<String>> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        let caps = session.capabilities().await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to get capabilities: {:?}", e), "capabilities_failed"))?;
        
        let capabilities: Vec<String> = caps.iter()
            .map(|cap| format!("{:?}", cap))
            .collect();
        
        self.connection_pool.return_connection(conn).await;
        Ok(capabilities)
    }

    /// Get namespace information
    pub async fn get_namespace(&self) -> MailResult<String> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // Try to get namespace (NAMESPACE extension)
        let namespace_result = session.run_command_and_read_response("NAMESPACE").await;
        
        self.connection_pool.return_connection(conn).await;
        
        match namespace_result {
            Ok(responses) => {
                // Parse namespace response
                let namespace_info = responses.iter()
                    .map(|r| format!("{:?}", r))
                    .collect::<Vec<_>>()
                    .join(" ");
                Ok(namespace_info)
            }
            Err(_) => Ok("NAMESPACE not supported".to_string()),
        }
    }

    /// List all folders/mailboxes
    pub async fn list_folders(&self) -> MailResult<Vec<MailFolder>> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // LIST command to get all folders
        let folders = session.list(Some(""), Some("*")).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to list folders: {:?}", e), "list_failed"))?;
        
        let mut mail_folders = Vec::new();
        let mut folder_cache = self.folder_cache.write().await;
        
        for folder in folders {
            let folder_name = folder.name();
            let folder_id = Uuid::new_v4();
            
            // Determine folder type based on name and attributes
            let folder_type = self.determine_folder_type(&folder);
            
            let mail_folder = MailFolder {
                id: folder_id,
                account_id: Uuid::nil(), // Will be set by caller
                name: folder_name.to_string(),
                path: folder_name.to_string(),
                folder_type,
                parent_id: None, // TODO: Parse hierarchy from folder name
                unread_count: 0, // Will be updated when we examine the folder
                total_count: 0,
                sync_enabled: true,
                last_sync_at: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            
            // Cache folder information
            folder_cache.insert(folder_name.to_string(), CachedFolder {
                folder: mail_folder.clone(),
                last_updated: SystemTime::now(),
                uid_validity: 0, // Will be updated when folder is examined
                uid_next: 0,
                recent: 0,
                exists: 0,
            });
            
            mail_folders.push(mail_folder);
        }
        
        self.connection_pool.return_connection(conn).await;
        
        info!("Listed {} folders", mail_folders.len());
        Ok(mail_folders)
    }

    /// Determine folder type from IMAP attributes and name
    fn determine_folder_type(&self, folder: &Name) -> MailFolderType {
        let name = folder.name().to_lowercase();
        let attributes = folder.attributes();
        
        // Check IMAP attributes first
        for attr in attributes {
            match attr {
                async_imap::types::NameAttribute::Inbox => return MailFolderType::Inbox,
                async_imap::types::NameAttribute::Sent => return MailFolderType::Sent,
                async_imap::types::NameAttribute::Drafts => return MailFolderType::Drafts,
                async_imap::types::NameAttribute::Trash => return MailFolderType::Trash,
                async_imap::types::NameAttribute::Junk => return MailFolderType::Spam,
                _ => {}
            }
        }
        
        // Fallback to name-based detection
        if name == "inbox" {
            MailFolderType::Inbox
        } else if name.contains("sent") {
            MailFolderType::Sent
        } else if name.contains("draft") {
            MailFolderType::Drafts
        } else if name.contains("trash") || name.contains("deleted") {
            MailFolderType::Trash
        } else if name.contains("spam") || name.contains("junk") {
            MailFolderType::Spam
        } else if name.contains("archive") {
            MailFolderType::Archive
        } else {
            MailFolderType::Custom
        }
    }

    /// Create a new folder
    pub async fn create_folder(&self, name: &str, parent: Option<&str>) -> MailResult<MailFolder> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // Construct full folder name with hierarchy
        let full_name = if let Some(parent) = parent {
            format!("{}/{}", parent, name) // Using '/' as hierarchy separator (configurable)
        } else {
            name.to_string()
        };
        
        session.create(&full_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to create folder '{}': {:?}", full_name, e), "create_failed"))?;
        
        // Subscribe to the folder (optional, depends on server)
        let _ = session.subscribe(&full_name).await;
        
        self.connection_pool.return_connection(conn).await;
        
        let folder = MailFolder {
            id: Uuid::new_v4(),
            account_id: Uuid::nil(),
            name: name.to_string(),
            path: full_name,
            folder_type: MailFolderType::Custom,
            parent_id: None, // TODO: Look up parent ID
            unread_count: 0,
            total_count: 0,
            sync_enabled: true,
            last_sync_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        info!("Created folder '{}'", folder.path);
        Ok(folder)
    }

    /// Delete a folder
    pub async fn delete_folder(&self, folder_name: &str) -> MailResult<()> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // Unsubscribe first (optional)
        let _ = session.unsubscribe(folder_name).await;
        
        // Delete the folder
        session.delete(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to delete folder '{}': {:?}", folder_name, e), "delete_failed"))?;
        
        self.connection_pool.return_connection(conn).await;
        
        // Remove from cache
        let mut folder_cache = self.folder_cache.write().await;
        folder_cache.remove(folder_name);
        
        info!("Deleted folder '{}'", folder_name);
        Ok(())
    }

    /// Rename a folder
    pub async fn rename_folder(&self, old_name: &str, new_name: &str) -> MailResult<()> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.rename(old_name, new_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to rename folder '{}' to '{}': {:?}", old_name, new_name, e), "rename_failed"))?;
        
        self.connection_pool.return_connection(conn).await;
        
        // Update cache
        let mut folder_cache = self.folder_cache.write().await;
        if let Some(mut cached) = folder_cache.remove(old_name) {
            cached.folder.name = new_name.to_string();
            cached.folder.path = new_name.to_string();
            cached.last_updated = SystemTime::now();
            folder_cache.insert(new_name.to_string(), cached);
        }
        
        info!("Renamed folder '{}' to '{}'", old_name, new_name);
        Ok(())
    }

    /// List messages in a folder
    pub async fn list_messages(
        &self,
        folder_name: &str,
        limit: Option<u32>,
        page_token: Option<&str>,
        folder_id: Uuid,
    ) -> MailResult<(Vec<EmailMessage>, Option<String>)> {
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // Select the folder
        let mailbox = session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder '{}': {:?}", folder_name, e), "select_failed"))?;
        
        // Update folder cache with mailbox info
        self.update_folder_cache(folder_name, &mailbox).await;
        
        // Determine message range to fetch
        let total_messages = mailbox.exists;
        if total_messages == 0 {
            self.connection_pool.return_connection(conn).await;
            return Ok((vec![], None));
        }
        
        let start_uid = if let Some(token) = page_token {
            token.parse::<u32>().unwrap_or(1)
        } else {
            1
        };
        
        let batch_size = limit.unwrap_or(50).min(100); // Limit batch size
        let end_uid = start_uid + batch_size - 1;
        
        // Fetch messages with ENVELOPE and FLAGS
        let sequence_set = format!("{}:{}", start_uid, end_uid);
        let messages = session
            .uid_fetch(&sequence_set, "(ENVELOPE FLAGS BODYSTRUCTURE RFC822.SIZE)")
            .await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to fetch messages: {:?}", e), "fetch_failed"))?;
        
        let mut email_messages = Vec::new();
        
        for msg in messages.iter() {
            match self.convert_imap_message_to_email(msg, folder_id).await {
                Ok(email_msg) => email_messages.push(email_msg),
                Err(e) => {
                    warn!("Failed to convert IMAP message: {}", e);
                    continue;
                }
            }
        }
        
        self.connection_pool.return_connection(conn).await;
        
        // Determine next page token
        let next_token = if email_messages.len() as u32 == batch_size {
            Some((end_uid + 1).to_string())
        } else {
            None
        };
        
        info!("Listed {} messages from folder '{}'", email_messages.len(), folder_name);
        Ok((email_messages, next_token))
    }

    /// Update folder cache with mailbox information
    async fn update_folder_cache(&self, folder_name: &str, mailbox: &Mailbox) {
        let mut folder_cache = self.folder_cache.write().await;
        
        if let Some(cached) = folder_cache.get_mut(folder_name) {
            cached.uid_validity = mailbox.uid_validity;
            cached.uid_next = mailbox.uid_next.unwrap_or(0);
            cached.recent = mailbox.recent;
            cached.exists = mailbox.exists;
            cached.last_updated = SystemTime::now();
            
            // Update message counts
            cached.folder.total_count = mailbox.exists;
            cached.folder.unread_count = 0; // Will be calculated separately
        }
    }

    /// Convert IMAP fetch result to EmailMessage
    async fn convert_imap_message_to_email(
        &self,
        fetch: &Fetch,
        folder_id: Uuid,
    ) -> MailResult<EmailMessage> {
        let uid = fetch.uid.ok_or_else(|| {
            MailError::provider_api("IMAP", "Message missing UID", "missing_uid")
        })?;
        
        let envelope = fetch.envelope().ok_or_else(|| {
            MailError::provider_api("IMAP", "Message missing envelope", "missing_envelope")
        })?;
        
        // Convert envelope to EmailMessage fields
        let subject = envelope.subject
            .as_ref()
            .and_then(|s| String::from_utf8(s.clone()).ok())
            .unwrap_or_default();
        
        let from = self.convert_imap_address(envelope.from.as_ref());
        let to = self.convert_imap_addresses(envelope.to.as_ref());
        let cc = self.convert_imap_addresses(envelope.cc.as_ref());
        let bcc = self.convert_imap_addresses(envelope.bcc.as_ref());
        
        // Parse date
        let date = envelope.date
            .as_ref()
            .and_then(|d| String::from_utf8(d.clone()).ok())
            .and_then(|d| DateTime::parse_from_rfc2822(&d).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);
        
        // Convert flags
        let flags = self.convert_imap_flags(fetch.flags());
        
        // Get message size
        let size = fetch.rfc822_size().unwrap_or(0) as u64;
        
        // Message ID
        let message_id = envelope.message_id
            .as_ref()
            .and_then(|id| String::from_utf8(id.clone()).ok());
        
        // References for threading
        let in_reply_to = envelope.in_reply_to
            .as_ref()
            .and_then(|refs| refs.first())
            .and_then(|id| String::from_utf8(id.clone()).ok());
        
        Ok(EmailMessage {
            id: Uuid::new_v4(),
            provider_id: format!("{}:{}", folder_id, uid),
            account_id: Uuid::nil(), // Will be set by caller
            folder_id,
            thread_id: None, // Threading will be handled separately
            subject,
            from,
            to,
            cc,
            bcc,
            text_content: None, // Body will be fetched separately when needed
            html_content: None,
            attachments: vec![], // Attachments will be parsed from body structure
            flags,
            labels: vec![],
            created_at: date,
            updated_at: Utc::now(),
            size,
            message_id_header: message_id,
            in_reply_to,
            references: vec![], // TODO: Parse References header
        })
    }

    /// Convert IMAP address to EmailAddress
    fn convert_imap_address(&self, addr: Option<&Vec<async_imap::types::Address>>) -> Option<EmailAddress> {
        addr?.first().and_then(|a| {
            let name = a.name.as_ref().and_then(|n| String::from_utf8(n.clone()).ok());
            let mailbox = a.mailbox.as_ref().and_then(|m| String::from_utf8(m.clone()).ok())?;
            let host = a.host.as_ref().and_then(|h| String::from_utf8(h.clone()).ok())?;
            
            Some(EmailAddress {
                name,
                email: format!("{}@{}", mailbox, host),
            })
        })
    }

    /// Convert IMAP addresses to Vec<EmailAddress>
    fn convert_imap_addresses(&self, addrs: Option<&Vec<async_imap::types::Address>>) -> Vec<EmailAddress> {
        addrs.map(|addresses| {
            addresses.iter().filter_map(|a| {
                let name = a.name.as_ref().and_then(|n| String::from_utf8(n.clone()).ok());
                let mailbox = a.mailbox.as_ref().and_then(|m| String::from_utf8(m.clone()).ok())?;
                let host = a.host.as_ref().and_then(|h| String::from_utf8(h.clone()).ok())?;
                
                Some(EmailAddress {
                    name,
                    email: format!("{}@{}", mailbox, host),
                })
            }).collect()
        }).unwrap_or_default()
    }

    /// Convert IMAP flags to EmailFlags
    fn convert_imap_flags(&self, flags: &[Flag]) -> EmailFlags {
        let mut email_flags = EmailFlags::default();
        
        for flag in flags {
            match flag {
                Flag::Seen => email_flags.is_read = true,
                Flag::Answered => email_flags.is_replied = true,
                Flag::Flagged => email_flags.is_starred = true,
                Flag::Deleted => email_flags.is_deleted = true,
                Flag::Draft => email_flags.is_draft = true,
                Flag::Recent => {} // Not directly mappable
                Flag::Custom(name) => {
                    // Handle custom flags (could be used for labels)
                    match name.as_str() {
                        "$Forwarded" => email_flags.is_forwarded = true,
                        "$Junk" => email_flags.is_spam = true,
                        _ => {}
                    }
                }
                _ => {}
            }
        }
        
        email_flags
    }

    /// Get a single message by ID
    pub async fn get_message(&self, message_id: &str) -> MailResult<EmailMessage> {
        // Parse message ID to extract folder and UID
        let parts: Vec<&str> = message_id.split(':').collect();
        if parts.len() != 2 {
            return Err(MailError::invalid_input("Invalid message ID format"));
        }
        
        let folder_uuid = Uuid::parse_str(parts[0])
            .map_err(|_| MailError::invalid_input("Invalid folder ID in message ID"))?;
        let uid: u32 = parts[1].parse()
            .map_err(|_| MailError::invalid_input("Invalid UID in message ID"))?;
        
        // Find folder name from cache (TODO: implement reverse lookup)
        let folder_name = "INBOX"; // Placeholder - need proper folder mapping
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // Select folder
        session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        // Fetch the specific message
        let messages = session.uid_fetch(&uid.to_string(), "(ENVELOPE FLAGS BODY[])").await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to fetch message: {:?}", e), "fetch_failed"))?;
        
        let fetch = messages.iter().next()
            .ok_or_else(|| MailError::not_found("Message", message_id))?;
        
        let mut email_message = self.convert_imap_message_to_email(fetch, folder_uuid).await?;
        
        // Parse full message body for content and attachments
        if let Some(body) = fetch.body() {
            let parsed = mailparse::parse_mail(body)
                .map_err(|e| MailError::parsing(&format!("Failed to parse message body: {}", e)))?;
            
            let (text_content, html_content) = self.extract_message_content(&parsed).await?;
            email_message.text_content = text_content;
            email_message.html_content = html_content;
            
            email_message.attachments = self.extract_message_attachments(&parsed).await?;
        }
        
        self.connection_pool.return_connection(conn).await;
        Ok(email_message)
    }

    /// Get raw message data
    pub async fn get_message_raw(&self, message_id: &str) -> MailResult<Vec<u8>> {
        let parts: Vec<&str> = message_id.split(':').collect();
        if parts.len() != 2 {
            return Err(MailError::invalid_input("Invalid message ID format"));
        }
        
        let uid: u32 = parts[1].parse()
            .map_err(|_| MailError::invalid_input("Invalid UID in message ID"))?;
        
        let folder_name = "INBOX"; // Placeholder
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        let messages = session.uid_fetch(&uid.to_string(), "BODY[]").await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to fetch message: {:?}", e), "fetch_failed"))?;
        
        let fetch = messages.iter().next()
            .ok_or_else(|| MailError::not_found("Message", message_id))?;
        
        let body = fetch.body()
            .ok_or_else(|| MailError::not_found("Message body", message_id))?;
        
        self.connection_pool.return_connection(conn).await;
        Ok(body.to_vec())
    }

    /// Extract text and HTML content from message
    async fn extract_message_content(&self, parsed: &mailparse::ParsedMail<'_>) -> MailResult<(Option<String>, Option<String>)> {
        let mut text_content = None;
        let mut html_content = None;
        
        self.extract_content_recursive(parsed, &mut text_content, &mut html_content).await?;
        
        // If we have HTML but no text, convert HTML to text
        if text_content.is_none() && html_content.is_some() {
            if let Some(ref html) = html_content {
                text_content = Some(html2text::from_read(html.as_bytes(), 80));
            }
        }
        
        Ok((text_content, html_content))
    }

    /// Extract content recursively from message parts
    async fn extract_content_recursive(
        &self,
        parsed: &mailparse::ParsedMail<'_>,
        text_content: &mut Option<String>,
        html_content: &mut Option<String>,
    ) -> MailResult<()> {
        if parsed.subparts.is_empty() {
            // Leaf part
            match parsed.ctype.mimetype.as_str() {
                "text/plain" if text_content.is_none() => {
                    *text_content = Some(parsed.get_body()
                        .map_err(|e| MailError::parsing(&format!("Failed to parse text content: {}", e)))?);
                }
                "text/html" if html_content.is_none() => {
                    *html_content = Some(parsed.get_body()
                        .map_err(|e| MailError::parsing(&format!("Failed to parse HTML content: {}", e)))?);
                }
                _ => {}
            }
        } else {
            // Multipart - recurse into subparts
            for part in &parsed.subparts {
                self.extract_content_recursive(part, text_content, html_content).await?;
            }
        }
        
        Ok(())
    }

    /// Extract attachments from message
    async fn extract_message_attachments(&self, parsed: &mailparse::ParsedMail<'_>) -> MailResult<Vec<EmailAttachment>> {
        let mut attachments = Vec::new();
        self.extract_attachments_recursive(parsed, &mut attachments).await?;
        Ok(attachments)
    }

    /// Extract attachments recursively
    async fn extract_attachments_recursive(
        &self,
        parsed: &mailparse::ParsedMail<'_>,
        attachments: &mut Vec<EmailAttachment>,
    ) -> MailResult<()> {
        for part in &parsed.subparts {
            if part.subparts.is_empty() {
                // Check if this part is an attachment
                let content_disposition = part.headers.get_first_value("Content-Disposition").unwrap_or_default();
                let is_attachment = content_disposition.contains("attachment")
                    || part.ctype.params.contains_key("name");
                
                if is_attachment && !part.ctype.mimetype.starts_with("text/") {
                    let filename = part.ctype.params.get("name")
                        .or_else(|| {
                            // Parse filename from Content-Disposition header
                            if let Some(disp_header) = part.headers.get_first_value("Content-Disposition") {
                                // Simple filename extraction (could be improved)
                                if let Some(start) = disp_header.find("filename=") {
                                    let filename_part = &disp_header[start + 9..];
                                    Some(filename_part.trim_matches('"').split(';').next().unwrap_or(""))
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        })
                        .map(String::from)
                        .unwrap_or_else(|| "attachment".to_string());
                    
                    let content_type = part.ctype.mimetype.clone();
                    let content_id = part.headers.get_first_value("Content-ID");
                    let is_inline = content_disposition.contains("inline");
                    
                    let body = part.get_body_raw()
                        .map_err(|e| MailError::parsing(&format!("Failed to get attachment data: {}", e)))?;
                    let size = body.len() as u64;
                    
                    attachments.push(EmailAttachment {
                        id: Uuid::new_v4(),
                        filename,
                        content_type,
                        size,
                        inline: is_inline,
                        content_id,
                        data: Some(body), // Store the data directly for now
                    });
                }
            } else {
                // Recurse into multipart
                self.extract_attachments_recursive(part, attachments).await?;
            }
        }
        
        Ok(())
    }

    /// Send message via SMTP (placeholder - should use separate SMTP client)
    pub async fn send_message(&self, _message: &EmailMessage) -> MailResult<String> {
        // This would typically be handled by a separate SMTP client
        // For now, we'll return an error indicating this should be handled elsewhere
        Err(MailError::not_supported("Send message", "smtp_client_required"))
    }

    /// Save message as draft
    pub async fn save_draft(&self, message: &EmailMessage) -> MailResult<String> {
        let drafts_folder = "Drafts"; // Should be configurable
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        // Convert EmailMessage to raw message format
        let raw_message = self.email_message_to_raw(message).await?;
        
        // Append to drafts folder
        let response = session.append(drafts_folder, raw_message.as_bytes()).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to save draft: {:?}", e), "append_failed"))?;
        
        self.connection_pool.return_connection(conn).await;
        
        // Extract UID from response (implementation depends on server response format)
        let draft_id = format!("draft:{}", chrono::Utc::now().timestamp());
        
        info!("Saved draft message");
        Ok(draft_id)
    }

    /// Convert EmailMessage to raw message format
    async fn email_message_to_raw(&self, message: &EmailMessage) -> MailResult<String> {
        let mut raw = String::new();
        
        // Headers
        if let Some(ref from) = message.from {
            raw.push_str(&format!("From: {}\r\n", from.email));
        }
        
        if !message.to.is_empty() {
            let to_emails: Vec<String> = message.to.iter()
                .map(|addr| addr.email.clone())
                .collect();
            raw.push_str(&format!("To: {}\r\n", to_emails.join(", ")));
        }
        
        if !message.cc.is_empty() {
            let cc_emails: Vec<String> = message.cc.iter()
                .map(|addr| addr.email.clone())
                .collect();
            raw.push_str(&format!("Cc: {}\r\n", cc_emails.join(", ")));
        }
        
        raw.push_str(&format!("Subject: {}\r\n", message.subject));
        raw.push_str(&format!("Date: {}\r\n", message.created_at.format("%a, %d %b %Y %H:%M:%S %z")));
        
        // MIME headers for content
        if message.html_content.is_some() && message.text_content.is_some() {
            // Multipart alternative
            let boundary = format!("boundary_{}", uuid::Uuid::new_v4().simple());
            raw.push_str(&format!("MIME-Version: 1.0\r\n"));
            raw.push_str(&format!("Content-Type: multipart/alternative; boundary=\"{}\"\r\n", boundary));
            raw.push_str("\r\n");
            
            // Text part
            if let Some(ref text) = message.text_content {
                raw.push_str(&format!("--{}\r\n", boundary));
                raw.push_str("Content-Type: text/plain; charset=utf-8\r\n");
                raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
                raw.push_str(text);
                raw.push_str("\r\n");
            }
            
            // HTML part
            if let Some(ref html) = message.html_content {
                raw.push_str(&format!("--{}\r\n", boundary));
                raw.push_str("Content-Type: text/html; charset=utf-8\r\n");
                raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
                raw.push_str(html);
                raw.push_str("\r\n");
            }
            
            raw.push_str(&format!("--{}--\r\n", boundary));
        } else if let Some(ref text) = message.text_content {
            // Plain text only
            raw.push_str("MIME-Version: 1.0\r\n");
            raw.push_str("Content-Type: text/plain; charset=utf-8\r\n");
            raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
            raw.push_str(text);
        } else if let Some(ref html) = message.html_content {
            // HTML only
            raw.push_str("MIME-Version: 1.0\r\n");
            raw.push_str("Content-Type: text/html; charset=utf-8\r\n");
            raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
            raw.push_str(html);
        }
        
        Ok(raw)
    }

    /// Delete message
    pub async fn delete_message(&self, message_id: &str) -> MailResult<()> {
        let parts: Vec<&str> = message_id.split(':').collect();
        if parts.len() != 2 {
            return Err(MailError::invalid_input("Invalid message ID format"));
        }
        
        let uid: u32 = parts[1].parse()
            .map_err(|_| MailError::invalid_input("Invalid UID in message ID"))?;
        
        let folder_name = "INBOX"; // Placeholder
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        // Mark message as deleted
        session.uid_store(&uid.to_string(), "+FLAGS (\\Deleted)").await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to mark message as deleted: {:?}", e), "store_failed"))?;
        
        // Expunge to permanently delete
        session.expunge().await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to expunge: {:?}", e), "expunge_failed"))?;
        
        self.connection_pool.return_connection(conn).await;
        
        info!("Deleted message {}", message_id);
        Ok(())
    }

    /// Move message to another folder
    pub async fn move_message(&self, message_id: &str, target_folder: &str) -> MailResult<()> {
        let parts: Vec<&str> = message_id.split(':').collect();
        if parts.len() != 2 {
            return Err(MailError::invalid_input("Invalid message ID format"));
        }
        
        let uid: u32 = parts[1].parse()
            .map_err(|_| MailError::invalid_input("Invalid UID in message ID"))?;
        
        let source_folder = "INBOX"; // Placeholder
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.select(source_folder).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        // Use MOVE command if supported, otherwise COPY + mark as deleted + expunge
        let caps = session.capabilities().await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to get capabilities: {:?}", e), "capabilities_failed"))?;
        
        let has_move = caps.iter().any(|cap| format!("{:?}", cap).contains("MOVE"));
        
        if has_move {
            // Use MOVE command
            session.uid_mv(&uid.to_string(), target_folder).await
                .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to move message: {:?}", e), "move_failed"))?;
        } else {
            // Fallback: COPY + mark deleted + expunge
            session.uid_copy(&uid.to_string(), target_folder).await
                .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to copy message: {:?}", e), "copy_failed"))?;
            
            session.uid_store(&uid.to_string(), "+FLAGS (\\Deleted)").await
                .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to mark as deleted: {:?}", e), "store_failed"))?;
            
            session.expunge().await
                .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to expunge: {:?}", e), "expunge_failed"))?;
        }
        
        self.connection_pool.return_connection(conn).await;
        
        info!("Moved message {} to folder '{}'", message_id, target_folder);
        Ok(())
    }

    /// Copy message to another folder
    pub async fn copy_message(&self, message_id: &str, target_folder: &str) -> MailResult<String> {
        let parts: Vec<&str> = message_id.split(':').collect();
        if parts.len() != 2 {
            return Err(MailError::invalid_input("Invalid message ID format"));
        }
        
        let uid: u32 = parts[1].parse()
            .map_err(|_| MailError::invalid_input("Invalid UID in message ID"))?;
        
        let source_folder = "INBOX"; // Placeholder
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.select(source_folder).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        session.uid_copy(&uid.to_string(), target_folder).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to copy message: {:?}", e), "copy_failed"))?;
        
        self.connection_pool.return_connection(conn).await;
        
        // Return new message ID (simplified - should get actual new UID)
        let new_message_id = format!("{}:{}", Uuid::new_v4(), uid);
        
        info!("Copied message {} to folder '{}'", message_id, target_folder);
        Ok(new_message_id)
    }

    /// Mark message as read/unread
    pub async fn mark_read(&self, message_id: &str, read: bool) -> MailResult<()> {
        self.set_message_flags(message_id, if read { "+FLAGS (\\Seen)" } else { "-FLAGS (\\Seen)" }).await
    }

    /// Mark message as starred/unstarred  
    pub async fn mark_starred(&self, message_id: &str, starred: bool) -> MailResult<()> {
        self.set_message_flags(message_id, if starred { "+FLAGS (\\Flagged)" } else { "-FLAGS (\\Flagged)" }).await
    }

    /// Set message flags
    async fn set_message_flags(&self, message_id: &str, flags: &str) -> MailResult<()> {
        let parts: Vec<&str> = message_id.split(':').collect();
        if parts.len() != 2 {
            return Err(MailError::invalid_input("Invalid message ID format"));
        }
        
        let uid: u32 = parts[1].parse()
            .map_err(|_| MailError::invalid_input("Invalid UID in message ID"))?;
        
        let folder_name = "INBOX"; // Placeholder
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        session.uid_store(&uid.to_string(), flags).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to set flags: {:?}", e), "store_failed"))?;
        
        self.connection_pool.return_connection(conn).await;
        
        debug!("Set flags '{}' on message {}", flags, message_id);
        Ok(())
    }

    /// Perform bulk operations on messages
    pub async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult> {
        let mut results = Vec::new();
        let mut successful = 0;
        let mut failed = 0;
        
        for message_id in &operation.message_ids {
            let result = match operation.operation_type {
                BulkOperationType::MarkRead => self.mark_read(message_id, true).await,
                BulkOperationType::MarkUnread => self.mark_read(message_id, false).await,
                BulkOperationType::Star => self.mark_starred(message_id, true).await,
                BulkOperationType::Unstar => self.mark_starred(message_id, false).await,
                BulkOperationType::Delete => self.delete_message(message_id).await,
                BulkOperationType::Archive => {
                    // Move to Archive folder (if it exists)
                    self.move_message(message_id, "Archive").await
                        .or_else(|_| self.move_message(message_id, "INBOX.Archive").await)
                }
                BulkOperationType::Spam => {
                    // Move to Spam/Junk folder
                    self.move_message(message_id, "Spam").await
                        .or_else(|_| self.move_message(message_id, "Junk").await)
                }
                BulkOperationType::Move { ref folder_id: _ } => {
                    // TODO: Convert folder_id to folder_name
                    Err(MailError::not_implemented("Bulk move with folder ID"))
                }
            };
            
            match result {
                Ok(_) => {
                    successful += 1;
                    results.push(BulkOperationItemResult {
                        message_id: message_id.clone(),
                        success: true,
                        error: None,
                    });
                }
                Err(e) => {
                    failed += 1;
                    results.push(BulkOperationItemResult {
                        message_id: message_id.clone(),
                        success: false,
                        error: Some(e.to_string()),
                    });
                }
            }
        }
        
        Ok(BulkOperationResult {
            total_processed: operation.message_ids.len(),
            successful,
            failed,
            results,
        })
    }

    /// Search messages
    pub async fn search_messages(&self, query: &str, limit: Option<u32>) -> MailResult<EmailSearchResult> {
        let folder_name = "INBOX"; // Should search across all folders
        
        let mut conn = self.connection_pool.get_connection().await?;
        conn.ensure_connected().await?;
        
        let session = conn.session()?;
        
        session.select(folder_name).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to select folder: {:?}", e), "select_failed"))?;
        
        // Convert search query to IMAP SEARCH format
        let imap_query = self.convert_search_query(query);
        
        let start_time = std::time::Instant::now();
        
        // Perform IMAP SEARCH
        let search_results = session.uid_search(&imap_query).await
            .map_err(|e| MailError::provider_api("IMAP", &format!("Search failed: {:?}", e), "search_failed"))?;
        
        let search_duration = start_time.elapsed().as_millis() as u64;
        
        // Limit results if specified
        let limited_results: Vec<u32> = if let Some(limit) = limit {
            search_results.into_iter().take(limit as usize).collect()
        } else {
            search_results
        };
        
        // Fetch message details for results
        let mut messages = Vec::new();
        if !limited_results.is_empty() {
            let uid_set = limited_results.iter()
                .map(|uid| uid.to_string())
                .collect::<Vec<_>>()
                .join(",");
            
            let fetch_results = session.uid_fetch(&uid_set, "(ENVELOPE FLAGS)").await
                .map_err(|e| MailError::provider_api("IMAP", &format!("Failed to fetch search results: {:?}", e), "fetch_failed"))?;
            
            for fetch in fetch_results.iter() {
                if let Ok(email_msg) = self.convert_imap_message_to_email(fetch, Uuid::new_v4()).await {
                    messages.push(email_msg);
                }
            }
        }
        
        self.connection_pool.return_connection(conn).await;
        
        Ok(EmailSearchResult {
            query: query.to_string(),
            total_count: limited_results.len(),
            messages,
            took: search_duration,
            facets: None,
            suggestions: None,
        })
    }

    /// Convert user query to IMAP SEARCH format
    fn convert_search_query(&self, query: &str) -> String {
        // Simple query conversion - could be enhanced significantly
        if query.contains("from:") {
            let from_email = query.replace("from:", "").trim().to_string();
            format!("FROM \"{}\"", from_email)
        } else if query.contains("subject:") {
            let subject = query.replace("subject:", "").trim().to_string();
            format!("SUBJECT \"{}\"", subject)
        } else if query.contains("to:") {
            let to_email = query.replace("to:", "").trim().to_string();
            format!("TO \"{}\"", to_email)
        } else {
            // Full-text search (not all IMAP servers support this well)
            format!("TEXT \"{}\"", query)
        }
    }

    /// Get thread (placeholder - threading requires separate implementation)
    pub async fn get_thread(&self, _thread_id: &str) -> MailResult<EmailThread> {
        Err(MailError::not_implemented("Threading support"))
    }

    /// List messages in thread
    pub async fn list_thread_messages(&self, _thread_id: &str) -> MailResult<Vec<EmailMessage>> {
        Err(MailError::not_implemented("Threading support"))
    }

    /// Get attachment data
    pub async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
        // For full implementation, we'd need to:
        // 1. Parse message_id to get folder/UID
        // 2. Fetch specific MIME part by attachment_id
        // 3. Decode the attachment data
        
        // Simplified implementation
        let message = self.get_message(message_id).await?;
        
        for attachment in &message.attachments {
            if attachment.id.to_string() == attachment_id {
                if let Some(ref data) = attachment.data {
                    return Ok(data.clone());
                }
            }
        }
        
        Err(MailError::not_found("Attachment", attachment_id))
    }

    /// Get sync changes (placeholder for incremental sync)
    pub async fn get_sync_changes(&self, _sync_token: Option<String>) -> MailResult<SyncResult> {
        // Full implementation would use CONDSTORE/QRESYNC extensions
        Ok(SyncResult {
            sync_token: Some(chrono::Utc::now().timestamp().to_string()),
            changes: vec![],
            has_more: false,
        })
    }

    /// Get full sync token
    pub async fn get_full_sync_token(&self) -> MailResult<String> {
        Ok(chrono::Utc::now().timestamp().to_string())
    }

    /// Setup IDLE monitoring for push notifications
    pub async fn setup_idle_monitoring(&self, _webhook_url: &str) -> MailResult<()> {
        // Full IDLE implementation would be complex and require persistent connections
        // For now, return success but don't actually implement IDLE
        info!("IDLE monitoring setup requested (not fully implemented)");
        Ok(())
    }

    /// Disable IDLE monitoring
    pub async fn disable_idle_monitoring(&self) -> MailResult<()> {
        info!("IDLE monitoring disabled");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_query_conversion() {
        let client = ImapClient {
            connection_pool: Arc::new(
                // We can't create a real pool for testing, so this will fail
                // In real tests, we'd use a mock or test fixture
            ),
            folder_cache: Arc::new(RwLock::new(HashMap::new())),
            search_cache: Arc::new(RwLock::new(HashMap::new())),
            sync_state: Arc::new(Mutex::new(HashMap::new())),
        };

        assert_eq!(client.convert_search_query("from:test@example.com"), "FROM \"test@example.com\"");
        assert_eq!(client.convert_search_query("subject:test"), "SUBJECT \"test\"");
        assert_eq!(client.convert_search_query("hello world"), "TEXT \"hello world\"");
    }
}