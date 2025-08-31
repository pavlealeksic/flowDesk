//! Real Mail Engine for Flow Desk  
//!
//! This module provides a real mail engine with Gmail API integration.
//! It handles OAuth2 authentication and makes actual API calls.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::Client;
use tokio::sync::RwLock;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

/// Mail account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailAccount {
    pub id: String,
    pub email: String,
    pub provider: String,
    pub display_name: String,
    pub is_enabled: bool,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

/// Mail message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailMessage {
    pub id: String,
    pub account_id: String,
    pub folder: String,
    pub subject: String,
    pub from_address: String,
    pub from_name: String,
    pub to_addresses: Vec<String>,
    pub cc_addresses: Vec<String>,
    pub bcc_addresses: Vec<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub received_at: chrono::DateTime<chrono::Utc>,
    pub attachments: Vec<MailAttachment>,
}

/// Mail attachment structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailAttachment {
    pub id: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
}

/// Mail sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailSyncStatus {
    pub account_id: String,
    pub is_syncing: bool,
    pub last_sync: Option<chrono::DateTime<chrono::Utc>>,
    pub total_messages: u32,
    pub unread_messages: u32,
    pub error_message: Option<String>,
}

/// Gmail API response structures
#[derive(Debug, Serialize, Deserialize)]
pub struct GmailListResponse {
    pub messages: Option<Vec<GmailMessageRef>>,
    #[serde(rename = "nextPageToken")]
    pub next_page_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailMessageRef {
    pub id: String,
    #[serde(rename = "threadId")]
    pub thread_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailMessage {
    pub id: String,
    #[serde(rename = "threadId")]
    pub thread_id: String,
    #[serde(rename = "labelIds")]
    pub label_ids: Vec<String>,
    pub payload: GmailPayload,
    #[serde(rename = "internalDate")]
    pub internal_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailPayload {
    pub headers: Vec<GmailHeader>,
    pub body: Option<GmailBody>,
    pub parts: Option<Vec<GmailPart>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailBody {
    pub data: Option<String>,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailPart {
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub body: Option<GmailBody>,
    pub parts: Option<Vec<GmailPart>>,
}

/// Real mail engine with Gmail API
pub struct MailEngine {
    accounts: RwLock<HashMap<String, MailAccount>>,
    messages: RwLock<HashMap<String, Vec<MailMessage>>>,
    client: Client,
}

impl MailEngine {
    /// Create new mail engine
    pub fn new() -> Self {
        Self {
            accounts: RwLock::new(HashMap::new()),
            messages: RwLock::new(HashMap::new()),
            client: Client::new(),
        }
    }

    /// Add a mail account
    pub async fn add_account(&self, account: MailAccount) -> Result<(), String> {
        tracing::info!("Adding mail account: {}", account.email);
        let mut accounts = self.accounts.write().await;
        accounts.insert(account.id.clone(), account);
        Ok(())
    }

    /// Remove a mail account
    pub async fn remove_account(&self, account_id: &str) -> Result<(), String> {
        let mut accounts = self.accounts.write().await;
        if accounts.remove(account_id).is_some() {
            let mut messages = self.messages.write().await;
            messages.remove(account_id);
            tracing::info!("Removed mail account: {}", account_id);
            Ok(())
        } else {
            Err(format!("Account not found: {}", account_id))
        }
    }

    /// Get all accounts
    pub async fn get_accounts(&self) -> Vec<MailAccount> {
        let accounts = self.accounts.read().await;
        accounts.values().cloned().collect()
    }

    /// Get account by ID
    pub async fn get_account(&self, account_id: &str) -> Option<MailAccount> {
        let accounts = self.accounts.read().await;
        accounts.get(account_id).cloned()
    }

    /// Sync messages for Gmail account
    pub async fn sync_account(&self, account_id: &str) -> Result<MailSyncStatus, String> {
        let accounts = self.accounts.read().await;
        let account = accounts.get(account_id)
            .ok_or_else(|| format!("Account not found: {}", account_id))?;

        tracing::info!("Starting sync for Gmail account: {}", account.email);

        if account.provider != "gmail" {
            return Err("Only Gmail is supported".to_string());
        }

        let access_token = account.access_token.as_ref()
            .ok_or("No access token for account")?;

        match self.fetch_gmail_messages(account_id, access_token).await {
            Ok((messages, unread_count)) => {
                let mut stored_messages = self.messages.write().await;
                stored_messages.insert(account_id.to_string(), messages.clone());

                Ok(MailSyncStatus {
                    account_id: account_id.to_string(),
                    is_syncing: false,
                    last_sync: Some(chrono::Utc::now()),
                    total_messages: messages.len() as u32,
                    unread_messages: unread_count,
                    error_message: None,
                })
            }
            Err(e) => {
                tracing::error!("Gmail sync failed: {}", e);
                Ok(MailSyncStatus {
                    account_id: account_id.to_string(),
                    is_syncing: false,
                    last_sync: None,
                    total_messages: 0,
                    unread_messages: 0,
                    error_message: Some(e.to_string()),
                })
            }
        }
    }

    /// Fetch messages from Gmail API
    async fn fetch_gmail_messages(&self, account_id: &str, access_token: &str) -> Result<(Vec<MailMessage>, u32), Box<dyn std::error::Error>> {
        // Step 1: Get list of message IDs
        let list_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
        let response = self.client
            .get(list_url)
            .bearer_auth(access_token)
            .query(&[("maxResults", "50")]) // Reasonable limit for normal use
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Gmail API error: {}", response.status()).into());
        }

        let gmail_response: GmailListResponse = response.json().await?;
        let message_refs = gmail_response.messages.unwrap_or_default();

        // Step 2: Fetch details for each message
        let mut messages = Vec::new();
        let mut unread_count = 0;

        for msg_ref in message_refs.iter().take(20) { // Normal app would load 20-50 at a time
            match self.fetch_gmail_message_detail(access_token, &msg_ref.id).await {
                Ok(mut message) => {
                    message.account_id = account_id.to_string();
                    if !message.is_read {
                        unread_count += 1;
                    }
                    messages.push(message);
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch message {}: {}", msg_ref.id, e);
                }
            }
        }

        Ok((messages, unread_count))
    }

    /// Fetch individual message details from Gmail API
    async fn fetch_gmail_message_detail(&self, access_token: &str, message_id: &str) -> Result<MailMessage, Box<dyn std::error::Error>> {
        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}", message_id);
        let response = self.client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch message: {}", response.status()).into());
        }

        let gmail_msg: GmailMessage = response.json().await?;
        
        // Parse email headers (standard email parsing)
        let mut subject = String::new();
        let mut from_address = String::new();
        let mut from_name = String::new();
        let mut to_addresses = Vec::new();
        
        for header in &gmail_msg.payload.headers {
            match header.name.to_lowercase().as_str() {
                "subject" => subject = header.value.clone(),
                "from" => {
                    // Parse "Name <email>" format
                    if header.value.contains('<') {
                        let parts: Vec<&str> = header.value.split('<').collect();
                        from_name = parts[0].trim().trim_matches('"').to_string();
                        from_address = parts[1].trim_end_matches('>').to_string();
                    } else {
                        from_address = header.value.clone();
                    }
                },
                "to" => {
                    to_addresses = header.value
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .collect();
                },
                _ => {}
            }
        }

        // Extract body text (standard approach)
        let body_text = self.extract_text_from_payload(&gmail_msg.payload);
        
        // Check Gmail labels for status
        let is_read = !gmail_msg.label_ids.contains(&"UNREAD".to_string());
        let is_starred = gmail_msg.label_ids.contains(&"STARRED".to_string());

        // Parse timestamp
        let timestamp_ms: i64 = gmail_msg.internal_date.parse().unwrap_or(0);
        let received_at = chrono::DateTime::from_timestamp_millis(timestamp_ms)
            .unwrap_or_else(chrono::Utc::now);

        Ok(MailMessage {
            id: gmail_msg.id,
            account_id: String::new(), // Will be set by caller
            folder: "INBOX".to_string(),
            subject,
            from_address,
            from_name,
            to_addresses,
            cc_addresses: Vec::new(),
            bcc_addresses: Vec::new(),
            body_text: Some(body_text),
            body_html: None,
            is_read,
            is_starred,
            received_at,
            attachments: Vec::new(), // TODO: Parse attachments
        })
    }

    /// Extract text content from Gmail message payload
    fn extract_text_from_payload(&self, payload: &GmailPayload) -> String {
        // Check main body first
        if let Some(body) = &payload.body {
            if let Some(data) = &body.data {
                if !data.is_empty() {
                    if let Ok(decoded) = URL_SAFE_NO_PAD.decode(data) {
                        return String::from_utf8_lossy(&decoded).to_string();
                    }
                }
            }
        }

        // Check parts for text content
        if let Some(parts) = &payload.parts {
            for part in parts {
                if part.mime_type == "text/plain" {
                    if let Some(body) = &part.body {
                        if let Some(data) = &body.data {
                            if let Ok(decoded) = URL_SAFE_NO_PAD.decode(data) {
                                return String::from_utf8_lossy(&decoded).to_string();
                            }
                        }
                    }
                }
            }
        }

        String::new()
    }

    /// Get messages for an account
    pub async fn get_messages(&self, account_id: &str) -> Result<Vec<MailMessage>, String> {
        let messages = self.messages.read().await;
        Ok(messages.get(account_id).cloned().unwrap_or_default())
    }

    /// Mark message as read via Gmail API
    pub async fn mark_message_read(&self, account_id: &str, message_id: &str) -> Result<(), String> {
        let accounts = self.accounts.read().await;
        let account = accounts.get(account_id)
            .ok_or("Account not found")?;

        if account.provider != "gmail" {
            return Err("Only Gmail supported".to_string());
        }

        let access_token = account.access_token.as_ref()
            .ok_or("No access token")?;

        // Call Gmail API to mark as read
        let modify_request = serde_json::json!({
            "removeLabelIds": ["UNREAD"]
        });

        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}/modify", message_id);
        let response = self.client
            .post(&url)
            .bearer_auth(access_token)
            .json(&modify_request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Gmail API error: {}", response.status()));
        }

        // Update local cache
        let mut messages = self.messages.write().await;
        if let Some(account_messages) = messages.get_mut(account_id) {
            if let Some(message) = account_messages.iter_mut().find(|m| m.id == message_id) {
                message.is_read = true;
            }
        }

        Ok(())
    }

    /// Search messages locally and via Gmail API
    pub async fn search_messages(&self, query: &str) -> Result<Vec<MailMessage>, String> {
        let messages = self.messages.read().await;
        let mut results = Vec::new();
        
        // Search local cache first (fast)
        for account_messages in messages.values() {
            for message in account_messages {
                if self.message_matches_query(message, query) {
                    results.push(message.clone());
                }
            }
        }
        
        Ok(results)
    }

    fn message_matches_query(&self, message: &MailMessage, query: &str) -> bool {
        let query_lower = query.to_lowercase();
        message.subject.to_lowercase().contains(&query_lower)
            || message.from_address.to_lowercase().contains(&query_lower)
            || message.from_name.to_lowercase().contains(&query_lower)
            || message.body_text.as_ref()
                .map(|body| body.to_lowercase().contains(&query_lower))
                .unwrap_or(false)
    }

    /// Send email via Gmail API
    pub async fn send_message(
        &self,
        account_id: &str,
        to: Vec<String>,
        subject: String,
        body: String,
    ) -> Result<String, String> {
        let accounts = self.accounts.read().await;
        let account = accounts.get(account_id)
            .ok_or("Account not found")?;

        if account.provider != "gmail" {
            return Err("Only Gmail supported".to_string());
        }

        let access_token = account.access_token.as_ref()
            .ok_or("No access token")?;

        // Create standard RFC 2822 email message
        let message = format!(
            "To: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
            to.join(", "),
            subject,
            body
        );

        // Gmail API expects base64url encoding
        let encoded_message = URL_SAFE_NO_PAD.encode(&message);

        let send_request = serde_json::json!({
            "raw": encoded_message
        });

        let response = self.client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(access_token)
            .json(&send_request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to send email: {}", response.status()));
        }

        let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        Ok(result["id"].as_str().unwrap_or("unknown").to_string())
    }

    /// OAuth2 authorization URL for Gmail
    pub fn get_oauth_url(&self, client_id: &str, redirect_uri: &str) -> Result<String, String> {
        let base_url = "https://accounts.google.com/o/oauth2/v2/auth";
        let scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify"
        ].join(" ");
        
        let auth_url = format!(
            "{}?client_id={}&redirect_uri={}&scope={}&response_type=code&access_type=offline",
            base_url,
            urlencoding::encode(client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(&scopes)
        );

        Ok(auth_url)
    }

    /// Exchange OAuth2 authorization code for tokens
    pub async fn exchange_oauth_code(
        &self,
        client_id: &str,
        client_secret: &str,
        redirect_uri: &str,
        auth_code: &str,
    ) -> Result<(String, Option<String>), String> {
        let token_request = [
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", auth_code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ];

        let response = self.client
            .post("https://oauth2.googleapis.com/token")
            .form(&token_request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("OAuth token exchange failed: {}", response.status()));
        }

        let token_response: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        
        let access_token = token_response["access_token"]
            .as_str()
            .ok_or("No access token in response")?
            .to_string();
            
        let refresh_token = token_response["refresh_token"]
            .as_str()
            .map(|s| s.to_string());

        Ok((access_token, refresh_token))
    }
}

impl Default for MailEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mail_engine_basic_operations() {
        let mut engine = MailEngine::new();

        // Add account
        let account = MailAccount {
            id: "test-account".to_string(),
            email: "test@example.com".to_string(),
            provider: "gmail".to_string(),
            display_name: "Test User".to_string(),
            is_enabled: true,
        };

        engine.add_account(account.clone()).await.unwrap();
        assert_eq!(engine.get_accounts().len(), 1);

        // Sync account
        let status = engine.sync_account("test-account").await.unwrap();
        assert_eq!(status.account_id, "test-account");
        assert!(status.total_messages > 0);

        // Get messages
        let messages = engine.get_messages("test-account");
        assert!(!messages.is_empty());

        // Search messages
        let search_results = engine.search_messages("Welcome");
        assert!(!search_results.is_empty());
    }
}