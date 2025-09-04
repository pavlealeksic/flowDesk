use async_trait::async_trait;
use crate::mail::{OAuthTokens, MailMessage, MailFolder, MailFolderType, AuthManager, EmailMessage, EmailAddress, EmailFlags, MessageImportance, MessagePriority, FolderSyncStatus, MailAccount, NewMessage, MessageFlags, EmailAttachment, BulkEmailOperation, BulkOperationResult, EmailFilter, EmailThread};
use crate::mail::providers::traits::ImapProvider;
use crate::mail::providers::{MailProviderTrait, ProviderCapabilities, SyncResult};
use crate::mail::error::{MailResult, MailError};
use std::sync::Arc;
use tokio::sync::Mutex;
use reqwest::Client;
use uuid::Uuid;
use base64::prelude::*;
// chrono::Utc import removed - unused

pub struct GmailProvider {
    tokens: Arc<Mutex<OAuthTokens>>,
    auth_manager: Arc<AuthManager>,
    client: Client,
}

impl GmailProvider {
    pub fn new(config: crate::mail::types::ProviderAccountConfig) -> crate::mail::error::MailResult<Self> {
        
        // For now, we'll use default empty tokens - OAuth tokens should be managed separately
        let tokens = match config {
            crate::mail::types::ProviderAccountConfig::Gmail { 
                client_id, scopes, enable_push_notifications, history_id 
            } => {
                // OAuth tokens would be injected separately during authentication
                crate::mail::types::OAuthTokens {
                    access_token: String::new(),
                    refresh_token: None,
                    expires_at: None,
                    token_type: Some("Bearer".to_string()),
                    scope: Some(scopes.join(" ")),
                }
            }
            _ => return Err(MailError::invalid("Invalid provider config for Gmail")),
        };

        // Create a basic auth manager instance (would need proper dependency injection)
        let auth_manager = Arc::new(AuthManager::new());

        Ok(Self {
            tokens: Arc::new(Mutex::new(tokens)),
            auth_manager,
            client: Client::new(),
        })
    }

    pub async fn new_with_auth(
        tokens: OAuthTokens,
        auth_manager: Arc<AuthManager>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self {
            tokens: Arc::new(Mutex::new(tokens)),
            auth_manager,
            client: Client::new(),
        })
    }

    async fn ensure_valid_token(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut tokens = self.tokens.lock().await;
        
        if self.auth_manager.is_token_expired(&tokens) {
            if let Some(refresh_token) = &tokens.refresh_token {
                let new_tokens = self.auth_manager.refresh_access_token(
                    crate::mail::types::MailProvider::Gmail,
                    refresh_token,
                ).await?;
                *tokens = new_tokens;
            } else {
                return Err("No refresh token available".into());
            }
        }
        
        Ok(tokens.access_token.clone())
    }

    async fn gmail_api_request(&self, endpoint: &str) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let token = self.ensure_valid_token().await?;
        
        let response = self.client
            .get(&format!("https://gmail.googleapis.com/gmail/v1/users/me/{}", endpoint))
            .bearer_auth(token)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Gmail API error: {}", response.status()).into());
        }

        let json: serde_json::Value = response.json().await?;
        Ok(json)
    }
}

#[async_trait]
impl ImapProvider for GmailProvider {
    async fn connect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Test connection by making a simple API call
        self.gmail_api_request("labels").await?;
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Gmail API is stateless, no need to disconnect
        Ok(())
    }

    async fn fetch_messages(&self, folder: &str, limit: u32) -> Result<Vec<MailMessage>, Box<dyn std::error::Error + Send + Sync>> {
        let label_id = match folder {
            "INBOX" => "INBOX",
            "SENT" => "SENT",
            "DRAFT" => "DRAFT",
            "TRASH" => "TRASH",
            "SPAM" => "SPAM",
            _ => folder,
        };

        let endpoint = format!("messages?labelIds={}&maxResults={}", label_id, limit);
        let response = self.gmail_api_request(&endpoint).await?;

        let mut messages = Vec::new();
        
        if let Some(message_list) = response["messages"].as_array() {
            for msg_ref in message_list.iter().take(limit as usize) {
                if let Some(msg_id) = msg_ref["id"].as_str() {
                    let msg_detail = self.gmail_api_request(&format!("messages/{}", msg_id)).await?;
                    
                    if let Ok(message) = self.parse_gmail_message(&msg_detail, folder) {
                        messages.push(message);
                    }
                }
            }
        }

        Ok(messages)
    }

    async fn get_folders(&self) -> Result<Vec<MailFolder>, Box<dyn std::error::Error + Send + Sync>> {
        let response = self.gmail_api_request("labels").await?;
        let mut folders = Vec::new();

        if let Some(labels) = response["labels"].as_array() {
            for label in labels {
                if let (Some(id), Some(name)) = (label["id"].as_str(), label["name"].as_str()) {
                    let folder_type = match id {
                        "INBOX" => MailFolderType::Inbox,
                        "SENT" => MailFolderType::Sent,
                        "DRAFT" => MailFolderType::Drafts,
                        "TRASH" => MailFolderType::Trash,
                        "SPAM" => MailFolderType::Spam,
                        _ => MailFolderType::Custom,
                    };

                    let message_count = label["messagesTotal"].as_u64().unwrap_or(0) as u32;
                    let unread_count = label["messagesUnread"].as_u64().unwrap_or(0) as u32;

                    folders.push(MailFolder {
                        id: Uuid::new_v4(),
                        account_id: Uuid::nil(), // Will be set by caller
                        name: name.to_string(),
                        display_name: name.to_string(),
                        folder_type,
                        parent_id: None,
                        path: id.to_string(),
                        attributes: vec![],
                        message_count: message_count as i32,
                        unread_count: unread_count as i32,
                        is_selectable: true,
                        can_select: true,
                        sync_status: FolderSyncStatus::default(),
                    });
                }
            }
        }

        Ok(folders)
    }

    async fn mark_message_read(&self, message_id: &str, is_read: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let token = self.ensure_valid_token().await?;
        
        let labels = if is_read { 
            serde_json::json!({ "removeLabelIds": ["UNREAD"] })
        } else {
            serde_json::json!({ "addLabelIds": ["UNREAD"] })
        };

        self.client
            .post(&format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}/modify", message_id))
            .bearer_auth(token)
            .json(&labels)
            .send()
            .await?;

        Ok(())
    }

    async fn star_message(&self, message_id: &str, is_starred: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let token = self.ensure_valid_token().await?;
        
        let labels = if is_starred { 
            serde_json::json!({ "addLabelIds": ["STARRED"] })
        } else {
            serde_json::json!({ "removeLabelIds": ["STARRED"] })
        };

        self.client
            .post(&format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}/modify", message_id))
            .bearer_auth(token)
            .json(&labels)
            .send()
            .await?;

        Ok(())
    }

    async fn delete_message(&self, message_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let token = self.ensure_valid_token().await?;

        self.client
            .delete(&format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}", message_id))
            .bearer_auth(token)
            .send()
            .await?;

        Ok(())
    }

    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
        let endpoint = format!("messages/{}/attachments/{}", message_id, attachment_id);
        let response = self.gmail_api_request(&endpoint).await?;

        if let Some(data) = response["data"].as_str() {
            let decoded = base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, data)?;
            Ok(decoded)
        } else {
            Err("Attachment data not found".into())
        }
    }

    async fn send_message(&self, message: &MailMessage) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let token = self.ensure_valid_token().await?;

        // Create RFC 2822 message
        let email_content = format!(
            "To: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
            message.to.iter().map(|addr| &addr.address).cloned().collect::<Vec<_>>().join(", "),
            message.subject,
            message.body_text.as_deref().unwrap_or("")
        );

        let encoded_message = base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, &email_content);
        let send_request = serde_json::json!({ "raw": encoded_message });

        let response = self.client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(token)
            .json(&send_request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to send message: {}", response.status()).into());
        }

        let result: serde_json::Value = response.json().await?;
        Ok(result["id"].as_str().unwrap_or("unknown").to_string())
    }
}

impl GmailProvider {
    fn parse_gmail_message_full(&self, msg_data: &serde_json::Value, folder: &str) -> Result<MailMessage, Box<dyn std::error::Error + Send + Sync>> {
        let id = Uuid::new_v4();
        let thread_id = Uuid::new_v4();
        
        let payload = &msg_data["payload"];
        let empty_headers = vec![];
        let headers = payload["headers"].as_array().unwrap_or(&empty_headers);
        
        let mut subject = String::new();
        let mut from_address = String::new();
        let mut from_name = String::new();
        let mut to_addresses = Vec::new();
        let mut cc_addresses = Vec::new();
        let mut bcc_addresses = Vec::new();
        let mut reply_to_addresses = Vec::new();
        let mut message_id_header = String::new();
        let mut in_reply_to = None;
        let mut references = Vec::new();
        
        // Parse headers
        for header in headers {
            if let (Some(name), Some(value)) = (header["name"].as_str(), header["value"].as_str()) {
                match name.to_lowercase().as_str() {
                    "subject" => subject = value.to_string(),
                    "from" => {
                        if let Some(parsed) = self.parse_email_address(value) {
                            from_address = parsed.address.clone();
                            from_name = parsed.name.unwrap_or(parsed.address.clone());
                        }
                    },
                    "to" => to_addresses = self.parse_email_addresses(value),
                    "cc" => cc_addresses = self.parse_email_addresses(value),
                    "bcc" => bcc_addresses = self.parse_email_addresses(value),
                    "reply-to" => reply_to_addresses = self.parse_email_addresses(value),
                    "message-id" => message_id_header = value.to_string(),
                    "in-reply-to" => in_reply_to = Some(value.to_string()),
                    "references" => references = value.split_whitespace().map(|s| s.to_string()).collect(),
                    _ => {}
                }
            }
        }
        
        // Extract message body content
        let (body_text, body_html) = self.extract_message_body(payload)?;
        
        // Extract attachments
        let attachments = self.extract_attachments(payload, msg_data["id"].as_str().unwrap_or(""));
        
        let label_ids: Vec<String> = msg_data["labelIds"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.to_string())
            .collect();
            
        let is_read = !label_ids.contains(&"UNREAD".to_string());
        let is_starred = label_ids.contains(&"STARRED".to_string());
        let is_important = label_ids.contains(&"IMPORTANT".to_string());
        let is_draft = label_ids.contains(&"DRAFT".to_string());
        let is_sent = folder == "SENT" || label_ids.contains(&"SENT".to_string());
        
        let received_at = msg_data["internalDate"]
            .as_str()
            .and_then(|s| s.parse::<i64>().ok())
            .map(|ts| chrono::DateTime::from_timestamp_millis(ts).unwrap_or_default())
            .unwrap_or_else(chrono::Utc::now);

        // Calculate message size
        let size = msg_data["sizeEstimate"].as_i64().unwrap_or(0);

        Ok(EmailMessage {
            id,
            account_id: Uuid::nil(), // Will be filled by caller
            provider_id: msg_data["id"].as_str().unwrap_or("").to_string(),
            thread_id,
            subject,
            body_html,
            body_text,
            snippet: msg_data["snippet"].as_str().unwrap_or("").to_string(),
            from: EmailAddress {
                email: from_address.clone(),
                address: from_address,
                name: if from_name.is_empty() { None } else { Some(from_name) },
            },
            to: to_addresses,
            cc: cc_addresses,
            bcc: bcc_addresses,
            reply_to: reply_to_addresses,
            date: received_at,
            flags: EmailFlags {
                is_read,
                is_starred,
                is_trashed: label_ids.contains(&"TRASH".to_string()),
                is_spam: label_ids.contains(&"SPAM".to_string()),
                is_important,
                is_archived: !label_ids.contains(&"INBOX".to_string()) && !is_sent && !is_draft,
                is_draft,
                is_sent,
                has_attachments: !attachments.is_empty(),
            },
            labels: label_ids,
            folder: folder.to_string(),
            folder_id: None,
            importance: if is_important { MessageImportance::High } else { MessageImportance::Normal },
            priority: MessagePriority::Normal,
            size,
            attachments,
            headers: headers.iter()
                .filter_map(|h| {
                    if let (Some(name), Some(value)) = (h["name"].as_str(), h["value"].as_str()) {
                        Some((name.to_string(), value.to_string()))
                    } else {
                        None
                    }
                })
                .collect(),
            message_id: msg_data["id"].as_str().unwrap_or("").to_string(),
            message_id_header: if message_id_header.is_empty() { None } else { Some(message_id_header) },
            in_reply_to,
            references,
            encryption: None, // TODO: Implement encryption detection
            created_at: received_at,
            updated_at: received_at,
        })
    }

    fn parse_gmail_message(&self, msg_data: &serde_json::Value, folder: &str) -> Result<EmailMessage, Box<dyn std::error::Error + Send + Sync>> {
        let id = Uuid::new_v4(); // Gmail message ID is provider-specific
        let thread_id = Uuid::new_v4(); // Will be mapped from Gmail thread ID
        
        let payload = &msg_data["payload"];
        let empty_headers = vec![];
        let headers = payload["headers"].as_array().unwrap_or(&empty_headers);
        
        let mut subject = String::new();
        let mut from_address = String::new();
        let mut from_name = String::new();
        let mut to_addresses = Vec::new();
        let mut cc_addresses = Vec::new();
        
        for header in headers {
            if let (Some(name), Some(value)) = (header["name"].as_str(), header["value"].as_str()) {
                match name.to_lowercase().as_str() {
                    "subject" => subject = value.to_string(),
                    "from" => {
                        from_address = value.to_string();
                        from_name = value.to_string(); // Would need better parsing for name extraction
                    },
                    "to" => to_addresses = vec![value.to_string()],
                    "cc" => cc_addresses = vec![value.to_string()],
                    _ => {}
                }
            }
        }
        
        let label_ids: Vec<String> = msg_data["labelIds"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.to_string())
            .collect();
            
        let is_read = !label_ids.contains(&"UNREAD".to_string());
        let is_starred = label_ids.contains(&"STARRED".to_string());
        let is_important = label_ids.contains(&"IMPORTANT".to_string());
        
        let received_at = msg_data["internalDate"]
            .as_str()
            .and_then(|s| s.parse::<i64>().ok())
            .map(|ts| chrono::DateTime::from_timestamp_millis(ts).unwrap_or_default())
            .unwrap_or_else(chrono::Utc::now);

        Ok(EmailMessage {
            id,
            account_id: Uuid::nil(), // Will be filled by caller
            provider_id: msg_data["id"].as_str().unwrap_or("").to_string(),
            thread_id,
            subject,
            body_html: None, // Would need to extract from payload
            body_text: None, // Would need to extract from payload
            snippet: msg_data["snippet"].as_str().unwrap_or("").to_string(),
            from: EmailAddress {
                email: from_address.clone(),
                address: from_address,
                name: Some(from_name),
            },
            to: to_addresses.into_iter().map(|email| EmailAddress { email: email.clone(), address: email, name: None }).collect(),
            cc: cc_addresses.into_iter().map(|email| EmailAddress { email: email.clone(), address: email, name: None }).collect(),
            bcc: vec![],
            reply_to: vec![],
            date: received_at,
            flags: EmailFlags {
                is_read,
                is_starred,
                is_trashed: false,
                is_spam: false,
                is_important: false,
                is_archived: false,
                is_draft: false,
                is_sent: false,
                has_attachments: payload["parts"].as_array()
                    .map(|parts| !parts.is_empty())
                    .unwrap_or(false),
            },
            labels: label_ids,
            folder: folder.to_string(),
            importance: if is_important { MessageImportance::High } else { MessageImportance::Normal },
            priority: MessagePriority::Normal,
            size: 0, // Would need to calculate
            headers: std::collections::HashMap::new(),
            message_id: msg_data["id"].as_str().unwrap_or("").to_string(),
            message_id_header: msg_data["id"].as_str().map(|s| s.to_string()),
            in_reply_to: None,
            references: vec![],
            encryption: None,
            attachments: vec![],
            folder_id: None,
            // has_attachments is stored in flags.has_attachments
            created_at: received_at,
            updated_at: received_at,
        })
    }
}

// Implement MailProvider trait for GmailProvider  
#[async_trait]
impl MailProviderTrait for GmailProvider {
    fn provider_name(&self) -> &'static str {
        "gmail"
    }
    
    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::default() // Use default capabilities for now
    }
    
    async fn test_connection(&self) -> MailResult<bool> {
        match self.gmail_api_request("labels").await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    
    async fn get_account_info(&self) -> MailResult<MailAccount> {
        // TODO: Implement actual account info retrieval
        Ok(MailAccount {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            name: "Gmail Account".to_string(),
            email: "user@gmail.com".to_string(),
            provider: crate::mail::types::MailProvider::Gmail,
            status: crate::mail::types::MailAccountStatus::Active,
            last_sync_at: None,
            next_sync_at: None,
            sync_interval_minutes: 15,
            is_enabled: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            provider_config: crate::mail::types::ProviderAccountConfig::Gmail {
                client_id: String::new(),
                scopes: vec!["https://www.googleapis.com/auth/gmail.readonly".to_string()],
                enable_push_notifications: false,
                history_id: None,
            },
            config: crate::mail::types::ProviderAccountConfig::Gmail {
                client_id: String::new(),
                scopes: vec!["https://www.googleapis.com/auth/gmail.readonly".to_string()],
                enable_push_notifications: false,
                history_id: None,
            },
            sync_status: None,
            display_name: "Gmail Account".to_string(),
            oauth_tokens: None,
            imap_config: None,
            smtp_config: None,
        })
    }
    
    async fn get_folders(&self) -> MailResult<Vec<MailFolder>> {
        // Return standard Gmail labels
        Ok(vec![
            MailFolder {
                id: Uuid::new_v4(),
                account_id: Uuid::new_v4(),
                name: "Inbox".to_string(),
                display_name: "Inbox".to_string(),
                folder_type: MailFolderType::Inbox,
                parent_id: None,
                path: "/Inbox".to_string(),
                attributes: vec![],
                message_count: 0,
                unread_count: 0,
                is_selectable: true,
                can_select: true,
                sync_status: FolderSyncStatus {
                    last_sync_at: Some(chrono::Utc::now()),
                    is_being_synced: false,
                    sync_progress: Some(1.0),
                    sync_error: None,
                },
            },
        ])
    }
    
    async fn create_folder(&self, _name: &str, _parent_id: Option<&str>) -> MailResult<MailFolder> {
        Err(crate::mail::error::MailError::Api("Gmail does not support creating custom folders".to_string()))
    }
    
    async fn delete_folder(&self, _folder_id: &str) -> MailResult<()> {
        Err(crate::mail::error::MailError::Api("Gmail does not support deleting folders".to_string()))
    }
    
    async fn rename_folder(&self, _folder_id: &str, _new_name: &str) -> MailResult<()> {
        Err(crate::mail::error::MailError::Api("Gmail does not support renaming folders".to_string()))
    }
    
    async fn get_messages(&self, folder_id: &str, limit: Option<u32>) -> MailResult<Vec<MailMessage>> {
        let label_id = match folder_id {
            "INBOX" => "INBOX",
            "SENT" => "SENT", 
            "DRAFT" => "DRAFT",
            "TRASH" => "TRASH",
            "SPAM" => "SPAM",
            _ => folder_id,
        };

        let max_results = limit.unwrap_or(50);
        let endpoint = format!("messages?labelIds={}&maxResults={}", label_id, max_results);
        
        let response = self.gmail_api_request(&endpoint).await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to fetch messages: {}", e)))?;

        let mut messages = Vec::new();
        
        if let Some(message_list) = response["messages"].as_array() {
            for msg_ref in message_list.iter().take(max_results as usize) {
                if let Some(msg_id) = msg_ref["id"].as_str() {
                    match self.gmail_api_request(&format!("messages/{}", msg_id)).await {
                        Ok(msg_detail) => {
                            match self.parse_gmail_message_full(&msg_detail, folder_id) {
                                Ok(message) => messages.push(message),
                                Err(e) => {
                                    tracing::warn!("Failed to parse Gmail message {}: {}", msg_id, e);
                                    continue;
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to fetch Gmail message {}: {}", msg_id, e);
                            continue;
                        }
                    }
                }
            }
        }

        Ok(messages)
    }
    
    async fn send_message(&self, message: &NewMessage) -> MailResult<String> {
        let token = self.ensure_valid_token().await
            .map_err(|e| crate::mail::error::MailError::Authentication { 
                message: format!("Token validation failed: {}", e)
            })?;

        // Create RFC 2822 compliant email message
        let mut email_content = String::new();
        
        // Add recipients
        if !message.to.is_empty() {
            email_content.push_str(&format!("To: {}\r\n", message.to.join(", ")));
        }
        if !message.cc.is_empty() {
            email_content.push_str(&format!("Cc: {}\r\n", message.cc.join(", ")));
        }
        if !message.bcc.is_empty() {
            email_content.push_str(&format!("Bcc: {}\r\n", message.bcc.join(", ")));
        }
        
        // Add subject
        email_content.push_str(&format!("Subject: {}\r\n", message.subject));
        
        // Add MIME headers
        email_content.push_str("MIME-Version: 1.0\r\n");
        
        // Handle different content types
        if message.body_html.is_some() && message.body_text.is_some() {
            // Multipart alternative
            let boundary = format!("boundary_{}", uuid::Uuid::new_v4().simple());
            email_content.push_str(&format!("Content-Type: multipart/alternative; boundary={}\r\n\r\n", boundary));
            
            // Text part
            email_content.push_str(&format!("--{}\r\n", boundary));
            email_content.push_str("Content-Type: text/plain; charset=utf-8\r\n");
            email_content.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
            if let Some(ref text) = message.body_text {
                email_content.push_str(text);
            }
            email_content.push_str("\r\n\r\n");
            
            // HTML part
            email_content.push_str(&format!("--{}\r\n", boundary));
            email_content.push_str("Content-Type: text/html; charset=utf-8\r\n");
            email_content.push_str("Content-Transfer-Encoding: 8bit\r\n\r\n");
            if let Some(ref html) = message.body_html {
                email_content.push_str(html);
            }
            email_content.push_str("\r\n\r\n");
            
            email_content.push_str(&format!("--{}--\r\n", boundary));
        } else if let Some(ref html) = message.body_html {
            // HTML only
            email_content.push_str("Content-Type: text/html; charset=utf-8\r\n\r\n");
            email_content.push_str(html);
        } else if let Some(ref text) = message.body_text {
            // Text only
            email_content.push_str("Content-Type: text/plain; charset=utf-8\r\n\r\n");
            email_content.push_str(text);
        } else {
            // Empty body
            email_content.push_str("Content-Type: text/plain; charset=utf-8\r\n\r\n");
        }

        // Base64 encode the entire message for Gmail API
        let encoded_message = base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, email_content.as_bytes());
        let send_request = serde_json::json!({ "raw": encoded_message });

        // Send via Gmail API
        let response = self.client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(token)
            .json(&send_request)
            .send()
            .await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to send message: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(crate::mail::error::MailError::Api(format!("Gmail API error {}: {}", status, error_text)));
        }

        let result: serde_json::Value = response.json().await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to parse send response: {}", e)))?;
        
        let message_id = result["id"].as_str().unwrap_or("unknown").to_string();
        tracing::info!("Successfully sent message with ID: {}", message_id);
        
        Ok(message_id)
    }
    
    async fn update_message_flags(&self, _message_id: &str, _flags: MessageFlags) -> MailResult<()> {
        // TODO: Implement flag updates
        Ok(())
    }
    
    async fn delete_message(&self, _message_id: &str) -> MailResult<()> {
        // TODO: Implement message deletion
        Ok(())
    }
    
    async fn search_messages(&self, query: &str) -> MailResult<Vec<MailMessage>> {
        // Use Gmail's search syntax
        let search_endpoint = format!("messages?q={}", urlencoding::encode(query));
        
        let response = self.gmail_api_request(&search_endpoint).await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to search messages: {}", e)))?;

        let mut messages = Vec::new();
        
        if let Some(message_list) = response["messages"].as_array() {
            // Limit search results to avoid overwhelming the system
            for msg_ref in message_list.iter().take(100) {
                if let Some(msg_id) = msg_ref["id"].as_str() {
                    match self.gmail_api_request(&format!("messages/{}", msg_id)).await {
                        Ok(msg_detail) => {
                            match self.parse_gmail_message_full(&msg_detail, "SEARCH") {
                                Ok(message) => messages.push(message),
                                Err(e) => {
                                    tracing::warn!("Failed to parse search result message {}: {}", msg_id, e);
                                    continue;
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to fetch search result message {}: {}", msg_id, e);
                            continue;
                        }
                    }
                }
            }
        }

        tracing::info!("Search for '{}' returned {} messages", query, messages.len());
        Ok(messages)
    }
    
    async fn get_message_content(&self, message_id: &str) -> MailResult<String> {
        let msg_detail = self.gmail_api_request(&format!("messages/{}", message_id)).await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to fetch message: {}", e)))?;

        let payload = &msg_detail["payload"];
        let (body_text, body_html) = self.extract_message_body(payload)
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to extract message body: {}", e)))?;

        // Return HTML if available, otherwise text, otherwise empty string
        if let Some(html) = body_html {
            Ok(html)
        } else if let Some(text) = body_text {
            Ok(text)
        } else {
            // Try to get snippet if no body content
            Ok(msg_detail["snippet"].as_str().unwrap_or("").to_string())
        }
    }
    
    async fn download_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
        let endpoint = format!("messages/{}/attachments/{}", message_id, attachment_id);
        
        let response = self.gmail_api_request(&endpoint).await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to download attachment: {}", e)))?;

        if let Some(data) = response["data"].as_str() {
            let decoded = base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, data)
                .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to decode attachment data: {}", e)))?;
            
            tracing::info!("Successfully downloaded attachment {} from message {} ({} bytes)", attachment_id, message_id, decoded.len());
            Ok(decoded)
        } else {
            Err(crate::mail::error::MailError::Api("Attachment data not found in response".to_string()))
        }
    }
    
    async fn get_message(&self, _message_id: &str) -> MailResult<MailMessage> {
        // TODO: Implement single message retrieval
        Err(crate::mail::error::MailError::Api("Not implemented".to_string()))
    }
    
    async fn get_message_raw(&self, message_id: &str) -> MailResult<String> {
        let endpoint = format!("messages/{}?format=raw", message_id);
        
        let response = self.gmail_api_request(&endpoint).await
            .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to fetch raw message: {}", e)))?;

        if let Some(raw_data) = response["raw"].as_str() {
            let decoded = base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, raw_data)
                .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to decode raw message: {}", e)))?;
            
            let raw_message = String::from_utf8(decoded)
                .map_err(|e| crate::mail::error::MailError::Api(format!("Failed to convert raw message to string: {}", e)))?;
                
            tracing::debug!("Successfully retrieved raw message {} ({} bytes)", message_id, raw_message.len());
            Ok(raw_message)
        } else {
            Err(crate::mail::error::MailError::Api("Raw message data not found in response".to_string()))
        }
    }
    
    async fn save_draft(&self, _message: &NewMessage) -> MailResult<String> {
        // TODO: Implement draft saving
        Ok("draft_id".to_string())
    }
    
    async fn move_message(&self, _message_id: &str, _target_folder: &str) -> MailResult<()> {
        // TODO: Implement message moving
        Ok(())
    }
    
    async fn copy_message(&self, _message_id: &str, _target_folder: &str) -> MailResult<()> {
        // TODO: Implement message copying
        Ok(())
    }
    
    async fn add_label(&self, _message_id: &str, _label: &str) -> MailResult<()> {
        // TODO: Implement label adding
        Ok(())
    }
    
    async fn remove_label(&self, _message_id: &str, _label: &str) -> MailResult<()> {
        // TODO: Implement label removal
        Ok(())
    }

    async fn mark_important(&self, message_id: &str, is_important: bool) -> MailResult<()> {
        // TODO: Implement Gmail importance marking
        Ok(())
    }

    async fn add_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()> {
        // TODO: Implement adding multiple labels
        Ok(())
    }

    async fn remove_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()> {
        // TODO: Implement removing multiple labels
        Ok(())
    }

    async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult> {
        // TODO: Implement bulk operations
        Ok(BulkOperationResult {
            successful: 0,
            failed: 0,
            errors: vec![],
        })
    }

    async fn get_thread(&self, thread_id: &str) -> MailResult<EmailThread> {
        // TODO: Implement thread retrieval
        Err(MailError::not_supported("get_thread", "Not implemented for Gmail provider"))
    }

    async fn list_thread_messages(&self, thread_id: &str) -> MailResult<Vec<MailMessage>> {
        // TODO: Implement thread message listing
        Ok(vec![])
    }

    async fn get_sync_changes(&self, since: Option<&str>) -> MailResult<SyncResult> {
        // TODO: Implement sync changes retrieval
        Ok(SyncResult {
            success: true,
            messages_synced: 0,
            errors: vec![],
            changes: vec![],
        })
    }

    async fn get_full_sync_token(&self) -> MailResult<String> {
        // TODO: Implement full sync token retrieval
        Ok("dummy_token".to_string())
    }

    async fn setup_push_notifications(&self, webhook_url: &str) -> MailResult<String> {
        // TODO: Implement push notification setup
        Ok("dummy_subscription_id".to_string())
    }

    async fn disable_push_notifications(&self, subscription_id: &str) -> MailResult<()> {
        // TODO: Implement push notification disabling
        Ok(())
    }

    async fn create_filter(&self, filter: &EmailFilter) -> MailResult<String> {
        // TODO: Implement filter creation
        Ok("dummy_filter_id".to_string())
    }

    async fn update_filter(&self, filter_id: &str, filter: &EmailFilter) -> MailResult<()> {
        // TODO: Implement filter updating
        Ok(())
    }

    async fn delete_filter(&self, filter_id: &str) -> MailResult<()> {
        // TODO: Implement filter deletion
        Ok(())
    }

    async fn list_filters(&self) -> MailResult<Vec<EmailFilter>> {
        // TODO: Implement filter listing
        Ok(vec![])
    }
}

// Helper methods for Gmail provider (separate impl block)
impl GmailProvider {
    // Parse a single email address from header string like "John Doe <john@example.com>"
    fn parse_email_address(&self, address_str: &str) -> Option<EmailAddress> {
        let address_str = address_str.trim();
        
        if let Some(angle_start) = address_str.rfind('<') {
            if let Some(angle_end) = address_str.rfind('>') {
                if angle_start < angle_end {
                    let email = address_str[angle_start + 1..angle_end].trim().to_string();
                    let name = address_str[..angle_start].trim().trim_matches('"').to_string();
                    return Some(EmailAddress {
                        address: email.clone(),
                        email,
                        name: if name.is_empty() { None } else { Some(name) },
                    });
                }
            }
        }
        
        // If no angle brackets, assume it's just an email
        Some(EmailAddress {
            address: address_str.to_string(),
            email: address_str.to_string(),
            name: None,
        })
    }
    
    // Parse multiple email addresses from header string
    fn parse_email_addresses(&self, addresses_str: &str) -> Vec<EmailAddress> {
        addresses_str
            .split(',')
            .filter_map(|addr| self.parse_email_address(addr))
            .collect()
    }
    
    // Extract message body content from Gmail payload
    fn extract_message_body(&self, payload: &serde_json::Value) -> Result<(Option<String>, Option<String>), Box<dyn std::error::Error + Send + Sync>> {
        let mut body_text = None;
        let mut body_html = None;
        
        // Check if payload has a body directly
        if let Some(body_data) = payload["body"]["data"].as_str() {
            if let Some(mime_type) = payload["mimeType"].as_str() {
                let decoded = base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, body_data)?;
                let content = String::from_utf8_lossy(&decoded).to_string();
                
                match mime_type {
                    "text/plain" => body_text = Some(content),
                    "text/html" => body_html = Some(content),
                    _ => body_text = Some(content),
                }
            }
        }
        
        // Check parts for multipart messages
        if let Some(parts) = payload["parts"].as_array() {
            for part in parts {
                if let Some(mime_type) = part["mimeType"].as_str() {
                    if let Some(body_data) = part["body"]["data"].as_str() {
                        let decoded = base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, body_data)?;
                        let content = String::from_utf8_lossy(&decoded).to_string();
                        
                        match mime_type {
                            "text/plain" => body_text = Some(content),
                            "text/html" => body_html = Some(content),
                            _ => {}
                        }
                    }
                }
                
                // Recursively check nested parts
                if let Some(nested_parts) = part["parts"].as_array() {
                    for nested_part in nested_parts {
                        if let Some(mime_type) = nested_part["mimeType"].as_str() {
                            if let Some(body_data) = nested_part["body"]["data"].as_str() {
                                let decoded = base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, body_data)?;
                                let content = String::from_utf8_lossy(&decoded).to_string();
                                
                                match mime_type {
                                    "text/plain" if body_text.is_none() => body_text = Some(content),
                                    "text/html" if body_html.is_none() => body_html = Some(content),
                                    _ => {}
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok((body_text, body_html))
    }
    
    // Extract attachments from Gmail payload
    fn extract_attachments(&self, payload: &serde_json::Value, message_id: &str) -> Vec<EmailAttachment> {
        let mut attachments = Vec::new();
        
        if let Some(parts) = payload["parts"].as_array() {
            self.extract_attachments_from_parts(parts, message_id, &mut attachments);
        }
        
        attachments
    }
    
    // Recursively extract attachments from message parts
    fn extract_attachments_from_parts(&self, parts: &[serde_json::Value], message_id: &str, attachments: &mut Vec<EmailAttachment>) {
        for part in parts {
            if let Some(filename) = part["filename"].as_str() {
                if !filename.is_empty() {
                    let attachment_id = part["body"]["attachmentId"].as_str().unwrap_or("").to_string();
                    let mime_type = part["mimeType"].as_str().unwrap_or("application/octet-stream").to_string();
                    let size = part["body"]["size"].as_i64().unwrap_or(0);
                    let is_inline = part["headers"]
                        .as_array()
                        .and_then(|headers| {
                            headers.iter().find(|h| {
                                h["name"].as_str() == Some("Content-Disposition")
                            })
                        })
                        .and_then(|h| h["value"].as_str())
                        .map(|v| v.starts_with("inline"))
                        .unwrap_or(false);
                    
                    attachments.push(EmailAttachment {
                        id: attachment_id,
                        filename: filename.to_string(),
                        mime_type: mime_type.clone(),
                        content_type: mime_type,
                        size,
                        content_id: None,
                        is_inline,
                        inline: is_inline,
                        download_url: Some(format!("messages/{}/attachments/{}", message_id, part["body"]["attachmentId"].as_str().unwrap_or(""))),
                        local_path: None,
                        data: None,
                    });
                }
            }
            
            // Check nested parts
            if let Some(nested_parts) = part["parts"].as_array() {
                self.extract_attachments_from_parts(nested_parts, message_id, attachments);
            }
        }
    }
}