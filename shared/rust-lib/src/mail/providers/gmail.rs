use async_trait::async_trait;
use crate::mail::{OAuthTokens, MailMessage, MailFolder, FolderType, AuthManager};
use crate::mail::providers::traits::ImapProvider;
use std::sync::Arc;
use tokio::sync::Mutex;
use reqwest::Client;

pub struct GmailProvider {
    tokens: Arc<Mutex<OAuthTokens>>,
    auth_manager: Arc<AuthManager>,
    client: Client,
}

impl GmailProvider {
    pub async fn new(
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
                    &crate::mail::MailProvider::Gmail,
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
                        "INBOX" => FolderType::Inbox,
                        "SENT" => FolderType::Sent,
                        "DRAFT" => FolderType::Drafts,
                        "TRASH" => FolderType::Trash,
                        "SPAM" => FolderType::Spam,
                        _ => FolderType::Custom(name.to_string()),
                    };

                    let message_count = label["messagesTotal"].as_u64().unwrap_or(0) as u32;
                    let unread_count = label["messagesUnread"].as_u64().unwrap_or(0) as u32;

                    folders.push(MailFolder {
                        id: id.to_string(),
                        name: name.to_string(),
                        path: id.to_string(),
                        folder_type,
                        message_count,
                        unread_count,
                        can_select: true,
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
            message.to_addresses.join(", "),
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
    fn parse_gmail_message(&self, msg_data: &serde_json::Value, folder: &str) -> Result<MailMessage, Box<dyn std::error::Error + Send + Sync>> {
        let id = msg_data["id"].as_str().unwrap_or("").to_string();
        let thread_id = msg_data["threadId"].as_str().map(|s| s.to_string());
        
        let payload = &msg_data["payload"];
        let headers = payload["headers"].as_array().unwrap_or(&vec![]);
        
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

        Ok(MailMessage {
            id,
            account_id: "".to_string(), // Will be filled by caller
            folder: folder.to_string(),
            thread_id,
            subject,
            from_address,
            from_name,
            to_addresses,
            cc_addresses,
            bcc_addresses: vec![],
            reply_to: None,
            body_text: None, // Would need to extract from payload
            body_html: None, // Would need to extract from payload
            is_read,
            is_starred,
            is_important,
            has_attachments: false, // Would need to check parts
            received_at,
            sent_at: None,
            attachments: vec![],
            labels: label_ids,
            message_id: None, // Would extract from headers
            in_reply_to: None, // Would extract from headers
            references: vec![], // Would extract from headers
        })
    }
}