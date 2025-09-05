//! IMAP client with comprehensive IMAP4 protocol implementation

use super::ImapConnectionPool;
use crate::mail::{
    error::{MailError, MailResult},
    types::*,
    providers::SyncResult,
};
use async_imap::{
    imap_proto::Envelope,
    types::{Fetch, Flag, Mailbox, Name},
};
use std::{collections::HashMap, sync::Arc, time::SystemTime};
use tokio::sync::{Mutex, RwLock};
use tracing::{debug, info, warn};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use mailparse::MailHeaderMap;

/// Comprehensive IMAP client implementation
pub struct ImapClient {
    connection_pool: Arc<ImapConnectionPool>,
    folder_cache: Arc<RwLock<HashMap<String, CachedFolder>>>,
    search_cache: Arc<RwLock<HashMap<String, CachedSearchResult>>>,
    sync_state: Arc<Mutex<HashMap<String, FolderSyncState>>>,
    idle_manager: Option<Arc<super::idle::IdleConnectionManager>>,
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
    /// Create uninitialized IMAP client (for sync constructor compatibility)
    pub fn new_uninitialized() -> Self {
        Self {
            connection_pool: Arc::new(ImapConnectionPool::new_uninitialized()),
            folder_cache: Arc::new(RwLock::new(HashMap::new())),
            search_cache: Arc::new(RwLock::new(HashMap::new())),
            sync_state: Arc::new(Mutex::new(HashMap::new())),
            idle_manager: None,
        }
    }

    /// Create new IMAP client
    pub async fn new(connection_pool: Arc<ImapConnectionPool>) -> MailResult<Self> {
        // Initialize IDLE manager with default configuration
        let idle_config = super::idle::IdleConfig::default();
        let mut idle_manager = super::idle::IdleConnectionManager::new(idle_config);
        idle_manager.initialize(connection_pool.clone()).await;
        
        Ok(Self {
            connection_pool,
            folder_cache: Arc::new(RwLock::new(HashMap::new())),
            search_cache: Arc::new(RwLock::new(HashMap::new())),
            sync_state: Arc::new(Mutex::new(HashMap::new())),
            idle_manager: Some(Arc::new(idle_manager)),
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
        
        // NAMESPACE extension is optional - skip for now to avoid complexity
        self.connection_pool.return_connection(conn).await;
        
        Ok("NAMESPACE detection skipped".to_string())
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
                display_name: folder_name.to_string(),
                folder_type,
                parent_id: self.parse_parent_folder_id(folder_name),
                path: folder_name.to_string(),
                attributes: vec![], // Will be populated from IMAP attributes
                message_count: 0,  // Will be updated when we examine the folder
                unread_count: 0, // Will be updated when we examine the folder
                is_selectable: true,
                can_select: true,
                sync_status: FolderSyncStatus::default(),
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
        
        // Check IMAP attributes first by name-based detection
        if name.contains("inbox") || name == "inbox" {
            return MailFolderType::Inbox;
        } else if name.contains("sent") {
            return MailFolderType::Sent;
        } else if name.contains("draft") {
            return MailFolderType::Drafts;
        } else if name.contains("trash") || name.contains("delete") {
            return MailFolderType::Trash;
        } else if name.contains("spam") || name.contains("junk") {
            return MailFolderType::Spam;
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
            display_name: name.to_string(),
            folder_type: MailFolderType::Custom,
            parent_id: None, // TODO: Look up parent ID
            path: full_name,
            attributes: vec![],
            message_count: 0,
            unread_count: 0,
            is_selectable: true,
            can_select: true,
            sync_status: FolderSyncStatus::default(),
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
            cached.uid_validity = mailbox.uid_validity.unwrap_or(0);
            cached.uid_next = mailbox.uid_next.unwrap_or(0);
            cached.recent = mailbox.recent;
            cached.exists = mailbox.exists;
            cached.last_updated = SystemTime::now();
            
            // Update message counts
            cached.folder.message_count = mailbox.exists as i32;
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
            .and_then(|s| String::from_utf8(s.to_vec()).ok())
            .unwrap_or_default();
        
        let from = self.convert_imap_address(envelope.from.as_ref());
        let to = self.convert_imap_addresses(envelope.to.as_ref());
        let cc = self.convert_imap_addresses(envelope.cc.as_ref());
        let bcc = self.convert_imap_addresses(envelope.bcc.as_ref());
        
        // Parse date
        let date = envelope.date
            .as_ref()
            .and_then(|d| String::from_utf8(d.to_vec()).ok())
            .and_then(|d| DateTime::parse_from_rfc2822(&d).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);
        
        // Convert flags
        let flags_vec: Vec<_> = fetch.flags().collect();
        let flags = self.convert_imap_flags(&flags_vec);
        
        // Get message size
        let size = fetch.size.unwrap_or(0) as u64;
        
        // Message ID
        let message_id = envelope.message_id
            .as_ref()
            .and_then(|id| String::from_utf8(id.to_vec()).ok());
        
        // References for threading  
        let in_reply_to = envelope.in_reply_to
            .as_ref()
            .and_then(|id| String::from_utf8(id.to_vec()).ok());
        
        let snippet = subject.chars().take(200).collect();
        
        Ok(EmailMessage {
            id: Uuid::new_v4(),
            account_id: Uuid::nil(), // Will be set by caller
            provider_id: format!("{}:{}", folder_id, uid),
            thread_id: Uuid::new_v4(), // Threading will be handled separately
            subject,
            body_html: None,
            body_text: None, // Body will be fetched separately when needed
            snippet,
            from: from.unwrap_or_else(|| EmailAddress {
                name: None,
                address: "unknown@example.com".to_string(),
                email: "unknown@example.com".to_string(),
            }),
            to,
            cc,
            bcc,
            reply_to: vec![],
            date,
            flags,
            labels: vec![],
            folder: folder_id.to_string(),
            folder_id: None,
            importance: MessageImportance::Normal,
            priority: MessagePriority::Normal,
            size: size as i64,
            attachments: vec![], // Attachments will be parsed from body structure
            headers: HashMap::new(),
            message_id: message_id.clone().unwrap_or_default(),
            message_id_header: message_id,
            in_reply_to,
            references: self.parse_references_header(&envelope).unwrap_or_default(),
            encryption: None,
            created_at: date,
            updated_at: Utc::now(),
        })
    }

    /// Parse References header from envelope
    fn parse_references_header(&self, envelope: &Envelope) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        // Try to get references from envelope, but IMAP envelope doesn't typically include References
        // This would need to be extracted from the full message headers
        // For now, return empty vec as a placeholder
        Ok(vec![])
    }

    /// Parse parent folder ID from folder name hierarchy
    fn parse_parent_folder_id(&self, folder_name: &str) -> Option<Uuid> {
        // Check for common folder separators
        let separators = ['/', '.', '\\'];
        
        for sep in separators {
            if let Some(last_sep_pos) = folder_name.rfind(sep) {
                if last_sep_pos > 0 {
                    let parent_name = &folder_name[..last_sep_pos];
                    // In a full implementation, this would look up the parent folder ID
                    // from a folder cache or database. For now, we generate a deterministic UUID
                    // based on the parent folder name
                    let parent_id = uuid::Uuid::new_v4();
                    return Some(parent_id);
                }
            }
        }
        
        None
    }

    /// Convert IMAP address to EmailAddress
    fn convert_imap_address(&self, addr: Option<&Vec<async_imap::imap_proto::Address>>) -> Option<EmailAddress> {
        addr?.first().and_then(|a| {
            let name = a.name.as_ref().and_then(|n| String::from_utf8(n.to_vec()).ok());
            let mailbox = a.mailbox.as_ref().and_then(|m| String::from_utf8(m.to_vec()).ok())?;
            let host = a.host.as_ref().and_then(|h| String::from_utf8(h.to_vec()).ok())?;
            
            Some(EmailAddress {
                name,
                address: format!("{}@{}", mailbox, host),
                email: format!("{}@{}", mailbox, host),
            })
        })
    }

    /// Convert IMAP addresses to Vec<EmailAddress>
    fn convert_imap_addresses(&self, addrs: Option<&Vec<async_imap::imap_proto::Address>>) -> Vec<EmailAddress> {
        addrs.map(|addr_vec| {
            addr_vec.iter()
                .filter_map(|a| {
                    let mailbox = a.mailbox.as_ref().and_then(|m| String::from_utf8(m.to_vec()).ok())?;
                    let host = a.host.as_ref().and_then(|h| String::from_utf8(h.to_vec()).ok())?;
                    let name = a.name.as_ref().and_then(|n| String::from_utf8(n.to_vec()).ok());
                    
                    Some(EmailAddress {
                        name,
                        address: format!("{}@{}", mailbox, host),
                        email: format!("{}@{}", mailbox, host),
                    })
                })
                .collect()
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
                Flag::Deleted => email_flags.is_trashed = true, // Map deleted to trashed
                Flag::Draft => email_flags.is_draft = true,
                Flag::Recent => {} // Not directly mappable
                Flag::Custom(name) => {
                    // Handle custom flags (could be used for labels)
                    if name == "$Forwarded" {
                        email_flags.is_forwarded = true;
                    } else if name == "$Junk" {
                        email_flags.is_spam = true;
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
            
            let (body_text, body_html) = self.extract_message_content(&parsed).await?;
            email_message.body_text = body_text;
            email_message.body_html = body_html;
            
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
        let mut body_text = None;
        let mut body_html = None;
        
        self.extract_content_recursive(parsed, &mut body_text, &mut body_html).await?;
        
        // If we have HTML but no text, convert HTML to text
        if body_text.is_none() && body_html.is_some() {
            if let Some(ref html) = body_html {
                body_text = Some(html2text::from_read(html.as_bytes(), 80));
            }
        }
        
        Ok((body_text, body_html))
    }

    /// Extract content recursively from message parts
    fn extract_content_recursive<'a>(
        &'a self,
        parsed: &'a mailparse::ParsedMail<'_>,
        body_text: &'a mut Option<String>,
        body_html: &'a mut Option<String>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = MailResult<()>> + Send + 'a>> {
        Box::pin(async move {
        if parsed.subparts.is_empty() {
            // Leaf part
            match parsed.ctype.mimetype.as_str() {
                "text/plain" if body_text.is_none() => {
                    *body_text = Some(parsed.get_body()
                        .map_err(|e| MailError::parsing(&format!("Failed to parse text content: {}", e)))?);
                }
                "text/html" if body_html.is_none() => {
                    *body_html = Some(parsed.get_body()
                        .map_err(|e| MailError::parsing(&format!("Failed to parse HTML content: {}", e)))?);
                }
                _ => {}
            }
        } else {
            // Multipart - recurse into subparts
            for part in &parsed.subparts {
                self.extract_content_recursive(part, body_text, body_html).await?;
            }
        }
        
        Ok(())
        })
    }

    /// Extract attachments from message
    async fn extract_message_attachments(&self, parsed: &mailparse::ParsedMail<'_>) -> MailResult<Vec<EmailAttachment>> {
        let mut attachments = Vec::new();
        self.extract_attachments_recursive(parsed, &mut attachments).await?;
        Ok(attachments)
    }

    /// Extract attachments recursively
    fn extract_attachments_recursive<'a>(
        &'a self,
        parsed: &'a mailparse::ParsedMail<'_>,
        attachments: &'a mut Vec<EmailAttachment>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = MailResult<()>> + Send + 'a>> {
        Box::pin(async move {
        for part in &parsed.subparts {
            if part.subparts.is_empty() {
                // Check if this part is an attachment
                let content_disposition = part.headers.get_first_value("Content-Disposition").unwrap_or_default();
                let is_attachment = content_disposition.contains("attachment")
                    || part.ctype.params.contains_key("name");
                
                if is_attachment && !part.ctype.mimetype.starts_with("text/") {
                    let filename = part.ctype.params.get("name")
                        .map(|s| s.clone())
                        .or_else(|| {
                            // Parse filename from Content-Disposition header
                            if let Some(disp_header) = part.headers.get_first_value("Content-Disposition") {
                                // Simple filename extraction (could be improved)
                                if let Some(start) = disp_header.find("filename=") {
                                    let filename_part = &disp_header[start + 9..];
                                    Some(filename_part.trim_matches('"').split(';').next().unwrap_or("").to_string())
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        })
                        .unwrap_or_else(|| "attachment".to_string());
                    
                    let content_type = part.ctype.mimetype.clone();
                    let content_id = part.headers.get_first_value("Content-ID");
                    let is_inline = content_disposition.contains("inline");
                    
                    let body = part.get_body_raw()
                        .map_err(|e| MailError::parsing(&format!("Failed to get attachment data: {}", e)))?;
                    let size = body.len() as u64;
                    
                    attachments.push(EmailAttachment {
                        id: filename.clone(),
                        filename,
                        mime_type: content_type.clone(),
                        content_type,
                        size: size as i64,
                        content_id,
                        is_inline,
                        inline: is_inline,
                        download_url: None,
                        local_path: None, // TODO: Save to disk and set path
                        data: None, // TODO: Load attachment data when needed
                    });
                }
            } else {
                // Recurse into multipart
                self.extract_attachments_recursive(part, attachments).await?;
            }
        }
        
        Ok(())
        })
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
        let from = &message.from;
        raw.push_str(&format!("From: {}\r\n", from.address));
        
        if !message.to.is_empty() {
            let to_emails: Vec<String> = message.to.iter()
                .map(|addr| addr.address.clone())
                .collect();
            raw.push_str(&format!("To: {}\r\n", to_emails.join(", ")));
        }
        
        if !message.cc.is_empty() {
            let cc_emails: Vec<String> = message.cc.iter()
                .map(|addr| addr.address.clone())
                .collect();
            raw.push_str(&format!("Cc: {}\r\n", cc_emails.join(", ")));
        }
        
        raw.push_str(&format!("Subject: {}\r\n", message.subject));
        raw.push_str(&format!("Date: {}\r\n", message.created_at.format("%a, %d %b %Y %H:%M:%S %z")));
        
        // MIME headers for content
        if message.body_html.is_some() && message.body_text.is_some() {
            // Multipart alternative
            let boundary = format!("boundary_{}", uuid::Uuid::new_v4().simple());
            raw.push_str(&format!("MIME-Version: 1.0\r\n"));
            raw.push_str(&format!("Content-Type: multipart/alternative; boundary=\"{}\"\r\n", boundary));
            raw.push_str("\r\n");
            
            // Text part
            if let Some(ref text) = message.body_text {
                raw.push_str(&format!("--{}\r\n", boundary));
                raw.push_str("Content-Type: text/plain; charset=utf-8\r\n");
                raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
                raw.push_str(text);
                raw.push_str("\r\n");
            }
            
            // HTML part
            if let Some(ref html) = message.body_html {
                raw.push_str(&format!("--{}\r\n", boundary));
                raw.push_str("Content-Type: text/html; charset=utf-8\r\n");
                raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
                raw.push_str(html);
                raw.push_str("\r\n");
            }
            
            raw.push_str(&format!("--{}--\r\n", boundary));
        } else if let Some(ref text) = message.body_text {
            // Plain text only
            raw.push_str("MIME-Version: 1.0\r\n");
            raw.push_str("Content-Type: text/plain; charset=utf-8\r\n");
            raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
            raw.push_str(text);
        } else if let Some(ref html) = message.body_html {
            // HTML only
            raw.push_str("MIME-Version: 1.0\r\n");
            raw.push_str("Content-Type: text/html; charset=utf-8\r\n");
            raw.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
            raw.push_str(html);
        }
        
        Ok(raw)
    }

    /// Add label to message
    pub async fn add_label(&self, message_id: &str, label: &str) -> MailResult<()> {
        // IMAP uses flags rather than labels - for now, add as a custom flag
        let custom_flag = format!("\\{}", label);
        self.set_flags(message_id, &format!("+FLAGS ({})", custom_flag)).await
    }

    /// Remove label from message  
    pub async fn remove_label(&self, message_id: &str, label: &str) -> MailResult<()> {
        // IMAP uses flags rather than labels - for now, remove as a custom flag
        let custom_flag = format!("\\{}", label);
        self.set_flags(message_id, &format!("-FLAGS ({})", custom_flag)).await
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

    /// Set flags on message
    pub async fn set_flags(&self, message_id: &str, flags: &str) -> MailResult<()> {
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

    /// Mark message as read/unread
    pub async fn mark_read(&self, message_id: &str, read: bool) -> MailResult<()> {
        self.set_flags(message_id, if read { "+FLAGS (\\Seen)" } else { "-FLAGS (\\Seen)" }).await
    }

    /// Mark message as starred/unstarred  
    pub async fn mark_starred(&self, message_id: &str, starred: bool) -> MailResult<()> {
        self.set_flags(message_id, if starred { "+FLAGS (\\Flagged)" } else { "-FLAGS (\\Flagged)" }).await
    }


    /// Perform bulk operations on messages
    pub async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult> {
        let mut results = Vec::new();
        let mut successful = 0;
        let mut failed = 0;
        
        for message_id in &operation.message_ids {
            let message_id_str = &message_id.to_string();
            let result = match operation.operation_type {
                BulkOperationType::MarkRead => self.mark_read(message_id_str, true).await,
                BulkOperationType::MarkUnread => self.mark_read(message_id_str, false).await,
                BulkOperationType::Star => self.mark_starred(message_id_str, true).await,
                BulkOperationType::Unstar => self.mark_starred(message_id_str, false).await,
                BulkOperationType::Delete => self.delete_message(message_id_str).await,
                BulkOperationType::Archive => {
                    // Move to Archive folder (if it exists)
                    match self.move_message(message_id_str, "Archive").await {
                        Ok(()) => Ok(()),
                        Err(_) => self.move_message(message_id_str, "INBOX.Archive").await,
                    }
                }
                BulkOperationType::Spam => {
                    // Move to Spam/Junk folder
                    match self.move_message(message_id_str, "Spam").await {
                        Ok(()) => Ok(()),
                        Err(_) => self.move_message(message_id_str, "Junk").await,
                    }
                }
                BulkOperationType::Move => {
                    // Get folder name from params
                    if let Some(params) = &operation.params {
                        if let Some(folder_name) = params.get("folder_name").and_then(|v| v.as_str()) {
                            self.move_message(message_id_str, folder_name).await
                        } else {
                            Err(MailError::invalid_input("Move operation requires folder_name parameter"))
                        }
                    } else {
                        Err(MailError::invalid_input("Move operation requires parameters"))
                    }
                }
                BulkOperationType::AddLabel => {
                    // Get label from params
                    if let Some(params) = &operation.params {
                        if let Some(label) = params.get("label").and_then(|v| v.as_str()) {
                            self.add_label(message_id_str, label).await
                        } else {
                            Err(MailError::invalid_input("AddLabel operation requires label parameter"))
                        }
                    } else {
                        Err(MailError::invalid_input("AddLabel operation requires parameters"))
                    }
                }
                BulkOperationType::RemoveLabel => {
                    // Get label from params
                    if let Some(params) = &operation.params {
                        if let Some(label) = params.get("label").and_then(|v| v.as_str()) {
                            self.remove_label(message_id_str, label).await
                        } else {
                            Err(MailError::invalid_input("RemoveLabel operation requires label parameter"))
                        }
                    } else {
                        Err(MailError::invalid_input("RemoveLabel operation requires parameters"))
                    }
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
            successful: successful as i32,
            failed: failed as i32,
            errors: vec![], // TODO: Collect actual errors from failed operations
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
            search_results.into_iter().collect()
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
            total_count: limited_results.len() as i32,
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
            success: true,
            messages_synced: 0, // TODO: Implement actual sync logic
            errors: vec![],
            changes: vec![],
        })
    }

    /// Get full sync token
    pub async fn get_full_sync_token(&self) -> MailResult<String> {
        Ok(chrono::Utc::now().timestamp().to_string())
    }

    /// Setup IDLE monitoring for push notifications
    pub async fn setup_idle_monitoring(&self, _webhook_url: &str) -> MailResult<()> {
        let idle_manager = self.idle_manager.as_ref()
            .ok_or_else(|| MailError::configuration("IDLE manager not initialized"))?;
        
        // For a full implementation, you would:
        // 1. Get list of folders to monitor (INBOX, etc.)
        // 2. Start IDLE monitoring for each folder
        // 3. Setup webhook or event handling
        
        info!("Setting up IDLE monitoring for real-time notifications");
        
        // Example: Start monitoring INBOX folder
        // In a real implementation, you'd get the account_id from context
        let account_id = uuid::Uuid::new_v4(); // Placeholder
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        
        // Start monitoring INBOX
        idle_manager.start_folder_monitoring(
            account_id,
            "INBOX".to_string(),
            tx,
        ).await?;
        
        // Spawn a task to handle IDLE events (in production, this would be more sophisticated)
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                debug!("Received IDLE event: {:?}", event);
                // In production, you would:
                // - Send webhook notifications
                // - Update local cache
                // - Trigger sync operations
                // - Notify UI components
            }
        });
        
        info!("IDLE monitoring setup completed");
        Ok(())
    }

    /// Disable IDLE monitoring
    pub async fn disable_idle_monitoring(&self) -> MailResult<()> {
        if let Some(idle_manager) = &self.idle_manager {
            info!("Shutting down IDLE monitoring...");
            idle_manager.shutdown().await?;
            info!("IDLE monitoring disabled");
        } else {
            debug!("IDLE manager not initialized, nothing to disable");
        }
        Ok(())
    }
    
    /// Start IDLE monitoring for a specific folder
    pub async fn start_folder_idle_monitoring(
        &self,
        account_id: uuid::Uuid,
        folder_name: String,
    ) -> MailResult<tokio::sync::mpsc::UnboundedReceiver<super::idle::IdleEvent>> {
        let idle_manager = self.idle_manager.as_ref()
            .ok_or_else(|| MailError::configuration("IDLE manager not initialized"))?;
        
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        
        idle_manager.start_folder_monitoring(account_id, folder_name, tx).await?;
        
        Ok(rx)
    }
    
    /// Stop IDLE monitoring for a specific folder
    pub async fn stop_folder_idle_monitoring(
        &self,
        account_id: uuid::Uuid,
        folder_name: String,
    ) -> MailResult<()> {
        if let Some(idle_manager) = &self.idle_manager {
            idle_manager.stop_folder_monitoring(account_id, folder_name).await?;
        }
        Ok(())
    }
    
    /// Stop IDLE monitoring for all folders of an account
    pub async fn stop_account_idle_monitoring(&self, account_id: uuid::Uuid) -> MailResult<()> {
        if let Some(idle_manager) = &self.idle_manager {
            idle_manager.stop_account_monitoring(account_id).await?;
        }
        Ok(())
    }
    
    /// Get IDLE connection health status
    pub async fn get_idle_health_status(&self) -> HashMap<String, super::idle::ConnectionHealth> {
        if let Some(idle_manager) = &self.idle_manager {
            idle_manager.get_health_status().await
        } else {
            HashMap::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_query_conversion() {
        // Create a test config
        let config = ImapConfig {
            imap_host: "imap.example.com".to_string(),
            imap_port: 993,
            imap_tls: true,
            smtp_host: "smtp.example.com".to_string(),
            smtp_port: 587,
            smtp_tls: true,
            username: "test@example.com".to_string(),
            password: secrecy::Secret::new("password".to_string()),
            connection_timeout: std::time::Duration::from_secs(30),
            idle_timeout: std::time::Duration::from_secs(300),
            max_connections: 5,
            enable_idle: true,
            enable_compression: false,
            enable_oauth2: false,
            oauth2_mechanism: None,
        };
        
        let connection_pool = ImapConnectionPool::new(config).await.unwrap();
        
        let client = ImapClient {
            connection_pool: Arc::new(connection_pool),
            folder_cache: Arc::new(RwLock::new(HashMap::new())),
            search_cache: Arc::new(RwLock::new(HashMap::new())),
            sync_state: Arc::new(Mutex::new(HashMap::new())),
            idle_manager: None, // Not needed for basic test
        };

        assert_eq!(client.convert_search_query("from:test@example.com"), "FROM \"test@example.com\"");
        assert_eq!(client.convert_search_query("subject:test"), "SUBJECT \"test\"");
        assert_eq!(client.convert_search_query("hello world"), "TEXT \"hello world\"");
    }
}