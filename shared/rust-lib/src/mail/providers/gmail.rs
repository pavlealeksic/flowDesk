//! Gmail API provider implementation

use crate::mail::{
    error::{MailError, MailResult},
    providers::{MailProvider, ProviderCapabilities, SyncChange, SyncResult},
    types::*,
    utils::*,
};
use async_trait::async_trait;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{DateTime, TimeZone, Utc};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

/// Gmail API endpoint URLs
const GMAIL_API_BASE: &str = "https://gmail.googleapis.com/gmail/v1";

/// Gmail API provider
pub struct GmailProvider {
    client: Client,
    access_token: String,
    user_email: Option<String>,
}

/// Gmail message representation
#[derive(Debug, Deserialize)]
struct GmailMessage {
    id: String,
    #[serde(rename = "threadId")]
    thread_id: String,
    #[serde(rename = "labelIds")]
    label_ids: Option<Vec<String>>,
    snippet: String,
    #[serde(rename = "historyId")]
    history_id: Option<String>,
    #[serde(rename = "internalDate")]
    internal_date: Option<String>,
    payload: Option<GmailMessagePayload>,
    #[serde(rename = "sizeEstimate")]
    size_estimate: Option<i64>,
    raw: Option<String>,
}

/// Gmail message payload
#[derive(Debug, Deserialize)]
struct GmailMessagePayload {
    #[serde(rename = "partId")]
    part_id: Option<String>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    filename: Option<String>,
    headers: Option<Vec<GmailHeader>>,
    body: Option<GmailMessageBody>,
    parts: Option<Vec<GmailMessagePayload>>,
}

/// Gmail message header
#[derive(Debug, Deserialize)]
struct GmailHeader {
    name: String,
    value: String,
}

/// Gmail message body
#[derive(Debug, Deserialize)]
struct GmailMessageBody {
    #[serde(rename = "attachmentId")]
    attachment_id: Option<String>,
    size: Option<i64>,
    data: Option<String>,
}

/// Gmail thread representation
#[derive(Debug, Deserialize)]
struct GmailThread {
    id: String,
    #[serde(rename = "historyId")]
    history_id: Option<String>,
    messages: Option<Vec<GmailMessage>>,
}

/// Gmail label representation
#[derive(Debug, Deserialize)]
struct GmailLabel {
    id: String,
    name: String,
    #[serde(rename = "messageListVisibility")]
    message_list_visibility: Option<String>,
    #[serde(rename = "labelListVisibility")]
    label_list_visibility: Option<String>,
    #[serde(rename = "type")]
    label_type: Option<String>,
    #[serde(rename = "messagesTotal")]
    messages_total: Option<i32>,
    #[serde(rename = "messagesUnread")]
    messages_unread: Option<i32>,
    #[serde(rename = "threadsTotal")]
    threads_total: Option<i32>,
    #[serde(rename = "threadsUnread")]
    threads_unread: Option<i32>,
}

/// Gmail API list response
#[derive(Debug, Deserialize)]
struct GmailListResponse<T> {
    #[serde(flatten)]
    items: HashMap<String, Vec<T>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
    #[serde(rename = "resultSizeEstimate")]
    result_size_estimate: Option<i64>,
}

/// Gmail history response
#[derive(Debug, Deserialize)]
struct GmailHistoryResponse {
    history: Option<Vec<GmailHistoryRecord>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
    #[serde(rename = "historyId")]
    history_id: Option<String>,
}

/// Gmail history record
#[derive(Debug, Deserialize)]
struct GmailHistoryRecord {
    id: String,
    #[serde(rename = "messagesAdded")]
    messages_added: Option<Vec<GmailHistoryMessage>>,
    #[serde(rename = "messagesDeleted")]
    messages_deleted: Option<Vec<GmailHistoryMessage>>,
    #[serde(rename = "labelsAdded")]
    labels_added: Option<Vec<GmailHistoryLabelChange>>,
    #[serde(rename = "labelsRemoved")]
    labels_removed: Option<Vec<GmailHistoryLabelChange>>,
}

/// Gmail history message
#[derive(Debug, Deserialize)]
struct GmailHistoryMessage {
    message: GmailMessage,
}

/// Gmail history label change
#[derive(Debug, Deserialize)]
struct GmailHistoryLabelChange {
    message: GmailMessage,
    #[serde(rename = "labelIds")]
    label_ids: Vec<String>,
}

impl GmailProvider {
    /// Create new Gmail provider
    pub async fn new(access_token: String) -> MailResult<Self> {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&format!("Bearer {}", access_token))
                .map_err(|e| MailError::authentication(format!("Invalid access token: {}", e)))?,
        );
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );

        let client = Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| MailError::other(format!("Failed to create HTTP client: {}", e)))?;

        let provider = Self {
            client,
            access_token,
            user_email: None,
        };

        // Test connection and get user info
        provider.test_connection().await?;

        Ok(provider)
    }

    /// Get Gmail API URL
    fn api_url(&self, path: &str) -> String {
        format!("{}/users/me/{}", GMAIL_API_BASE, path)
    }

    /// Convert Gmail message to internal EmailMessage
    async fn convert_gmail_message(&self, gmail_msg: &GmailMessage) -> MailResult<EmailMessage> {
        let payload = gmail_msg
            .payload
            .as_ref()
            .ok_or_else(|| MailError::other("Message payload is missing"))?;

        // Parse headers
        let headers = self.parse_headers(&payload.headers.as_ref().unwrap_or(&vec![]));
        
        // Extract basic fields
        let subject = headers.get("subject").unwrap_or(&String::new()).clone();
        let from = parse_email_address(&headers.get("from").unwrap_or(&String::new()))?;
        let to = parse_email_addresses(&headers.get("to").unwrap_or(&String::new()))?;
        let cc = parse_email_addresses(&headers.get("cc").unwrap_or(&String::new()))?;
        let bcc = parse_email_addresses(&headers.get("bcc").unwrap_or(&String::new()))?;
        let reply_to = parse_email_addresses(&headers.get("reply-to").unwrap_or(&String::new()))?;

        // Parse date
        let date = self.parse_date(&headers.get("date").unwrap_or(&String::new()))?;

        // Extract message content
        let (body_html, body_text, attachments) = self.extract_message_content(payload)?;

        // Generate snippet
        let snippet = if gmail_msg.snippet.is_empty() {
            generate_snippet(&body_text.as_ref().unwrap_or(&String::new()), 200)
        } else {
            gmail_msg.snippet.clone()
        };

        // Parse labels and flags
        let labels = gmail_msg.label_ids.clone().unwrap_or_default();
        let flags = self.parse_gmail_labels(&labels);

        Ok(EmailMessage {
            id: Uuid::new_v4(),
            account_id: Uuid::new_v4(), // This should be set by the caller
            provider_id: gmail_msg.id.clone(),
            thread_id: Uuid::new_v4(), // This should be mapped from Gmail thread ID
            subject,
            body_html,
            body_text,
            snippet,
            from,
            to,
            cc,
            bcc,
            reply_to,
            date,
            flags,
            labels,
            folder: self.get_primary_folder(&labels),
            importance: extract_importance(&headers),
            priority: extract_priority(&headers),
            size: gmail_msg.size_estimate.unwrap_or(0),
            attachments,
            headers,
            message_id: headers.get("message-id").unwrap_or(&String::new()).clone(),
            in_reply_to: headers.get("in-reply-to").cloned(),
            references: extract_references(&headers),
            encryption: None, // Gmail doesn't expose encryption info via API
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Parse Gmail headers into HashMap
    fn parse_headers(&self, headers: &[GmailHeader]) -> HashMap<String, String> {
        headers
            .iter()
            .map(|h| (h.name.to_lowercase(), h.value.clone()))
            .collect()
    }

    /// Parse date from header string
    fn parse_date(&self, date_str: &str) -> MailResult<DateTime<Utc>> {
        if date_str.is_empty() {
            return Ok(Utc::now());
        }

        // Try parsing RFC 2822 format
        chrono::DateTime::parse_from_rfc2822(date_str)
            .map(|dt| dt.with_timezone(&Utc))
            .or_else(|_| {
                // Try parsing RFC 3339 format
                chrono::DateTime::parse_from_rfc3339(date_str)
                    .map(|dt| dt.with_timezone(&Utc))
            })
            .or_else(|_| {
                // Try parsing internal date format
                if let Ok(timestamp) = date_str.parse::<i64>() {
                    Ok(Utc.timestamp_millis_opt(timestamp).unwrap_or(Utc::now()))
                } else {
                    Ok(Utc::now())
                }
            })
            .map_err(|e| MailError::other(format!("Failed to parse date '{}': {}", date_str, e)))
    }

    /// Extract message content (HTML, text, and attachments)
    fn extract_message_content(
        &self,
        payload: &GmailMessagePayload,
    ) -> MailResult<(Option<String>, Option<String>, Vec<EmailAttachment>)> {
        let mut body_html = None;
        let mut body_text = None;
        let mut attachments = Vec::new();

        self.extract_parts(payload, &mut body_html, &mut body_text, &mut attachments)?;

        Ok((body_html, body_text, attachments))
    }

    /// Recursively extract parts from message payload
    fn extract_parts(
        &self,
        payload: &GmailMessagePayload,
        body_html: &mut Option<String>,
        body_text: &mut Option<String>,
        attachments: &mut Vec<EmailAttachment>,
    ) -> MailResult<()> {
        let mime_type = payload.mime_type.as_deref().unwrap_or("");

        match mime_type {
            "text/plain" => {
                if let Some(body) = &payload.body {
                    if let Some(data) = &body.data {
                        let text = self.decode_base64_data(data)?;
                        *body_text = Some(text);
                    }
                }
            }
            "text/html" => {
                if let Some(body) = &payload.body {
                    if let Some(data) = &body.data {
                        let html = self.decode_base64_data(data)?;
                        *body_html = Some(html);
                    }
                }
            }
            _ => {
                // Handle attachments
                if let Some(filename) = &payload.filename {
                    if !filename.is_empty() {
                        if let Some(body) = &payload.body {
                            let attachment = EmailAttachment {
                                id: body.attachment_id.clone().unwrap_or_default(),
                                filename: filename.clone(),
                                mime_type: mime_type.to_string(),
                                size: body.size.unwrap_or(0),
                                content_id: None,
                                is_inline: mime_type.starts_with("image/"),
                                download_url: None,
                                local_path: None,
                            };
                            attachments.push(attachment);
                        }
                    }
                }
            }
        }

        // Process nested parts
        if let Some(parts) = &payload.parts {
            for part in parts {
                self.extract_parts(part, body_html, body_text, attachments)?;
            }
        }

        Ok(())
    }

    /// Decode base64 URL-safe data
    fn decode_base64_data(&self, data: &str) -> MailResult<String> {
        URL_SAFE_NO_PAD
            .decode(data)
            .map_err(|e| MailError::other(format!("Failed to decode base64 data: {}", e)))
            .and_then(|bytes| {
                String::from_utf8(bytes)
                    .map_err(|e| MailError::other(format!("Invalid UTF-8 in decoded data: {}", e)))
            })
    }

    /// Parse Gmail labels into email flags
    fn parse_gmail_labels(&self, labels: &[String]) -> EmailFlags {
        let mut flags = EmailFlags::default();

        for label in labels {
            match label.as_str() {
                "UNREAD" => flags.is_read = false,
                "STARRED" => flags.is_starred = true,
                "TRASH" => flags.is_trashed = true,
                "SPAM" => flags.is_spam = true,
                "IMPORTANT" => flags.is_important = true,
                "SENT" => flags.is_sent = true,
                "DRAFT" => flags.is_draft = true,
                _ => {}
            }
        }

        // If not UNREAD, then it's read
        if !labels.contains(&"UNREAD".to_string()) {
            flags.is_read = true;
        }

        flags
    }

    /// Get primary folder name from labels
    fn get_primary_folder(&self, labels: &[String]) -> String {
        if labels.contains(&"INBOX".to_string()) {
            "INBOX".to_string()
        } else if labels.contains(&"SENT".to_string()) {
            "SENT".to_string()
        } else if labels.contains(&"DRAFT".to_string()) {
            "DRAFTS".to_string()
        } else if labels.contains(&"TRASH".to_string()) {
            "TRASH".to_string()
        } else if labels.contains(&"SPAM".to_string()) {
            "SPAM".to_string()
        } else {
            "ALL".to_string()
        }
    }

    /// Convert Gmail label to MailFolder
    fn convert_gmail_label(&self, label: &GmailLabel, account_id: Uuid) -> MailFolder {
        let folder_type = match label.id.as_str() {
            "INBOX" => MailFolderType::Inbox,
            "SENT" => MailFolderType::Sent,
            "DRAFT" => MailFolderType::Drafts,
            "TRASH" => MailFolderType::Trash,
            "SPAM" => MailFolderType::Spam,
            _ => {
                if label.label_type.as_deref() == Some("system") {
                    MailFolderType::System
                } else {
                    MailFolderType::Custom
                }
            }
        };

        MailFolder {
            id: Uuid::new_v4(), // This should be mapped consistently
            account_id,
            name: label.id.clone(),
            display_name: label.name.clone(),
            folder_type,
            parent_id: None,
            path: label.name.clone(),
            attributes: vec![],
            message_count: label.messages_total.unwrap_or(0),
            unread_count: label.messages_unread.unwrap_or(0),
            is_selectable: true,
            sync_status: FolderSyncStatus::default(),
        }
    }

    /// Build Gmail API search query
    fn build_search_query(&self, query: &str) -> String {
        // Gmail uses a special search syntax
        // For now, we'll pass through the query as-is
        // In a real implementation, you might want to translate
        // from a standard search format to Gmail's format
        query.to_string()
    }
}

#[async_trait]
impl MailProvider for GmailProvider {
    fn provider_name(&self) -> &'static str {
        "gmail"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
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
        }
    }

    async fn test_connection(&self) -> MailResult<bool> {
        let response = self
            .client
            .get(&self.api_url("profile"))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(true)
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Connection test failed",
                response.status().to_string(),
            ))
        }
    }

    async fn get_account_info(&self) -> MailResult<Value> {
        let response = self
            .client
            .get(&self.api_url("profile"))
            .send()
            .await?;

        if response.status().is_success() {
            let profile: Value = response.json().await?;
            Ok(profile)
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to get account info",
                response.status().to_string(),
            ))
        }
    }

    async fn list_folders(&self) -> MailResult<Vec<MailFolder>> {
        let response = self
            .client
            .get(&self.api_url("labels"))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to list labels",
                response.status().to_string(),
            ));
        }

        let labels_response: GmailListResponse<GmailLabel> = response.json().await?;
        let labels = labels_response
            .items
            .get("labels")
            .unwrap_or(&vec![]);

        let account_id = Uuid::new_v4(); // This should come from context
        let folders = labels
            .iter()
            .map(|label| self.convert_gmail_label(label, account_id))
            .collect();

        Ok(folders)
    }

    async fn create_folder(&self, name: &str, _parent_id: Option<Uuid>) -> MailResult<MailFolder> {
        let label_data = json!({
            "name": name,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show"
        });

        let response = self
            .client
            .post(&self.api_url("labels"))
            .json(&label_data)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to create label",
                response.status().to_string(),
            ));
        }

        let label: GmailLabel = response.json().await?;
        let account_id = Uuid::new_v4(); // This should come from context
        Ok(self.convert_gmail_label(&label, account_id))
    }

    async fn delete_folder(&self, _folder_id: Uuid) -> MailResult<()> {
        // Implementation would require mapping folder_id back to Gmail label ID
        Err(MailError::not_supported("Delete folder by UUID", "gmail"))
    }

    async fn rename_folder(&self, _folder_id: Uuid, _new_name: &str) -> MailResult<()> {
        // Implementation would require mapping folder_id back to Gmail label ID
        Err(MailError::not_supported("Rename folder by UUID", "gmail"))
    }

    async fn list_messages(
        &self,
        _folder_id: Uuid,
        limit: Option<u32>,
        page_token: Option<String>,
    ) -> MailResult<(Vec<EmailMessage>, Option<String>)> {
        let mut url = self.api_url("messages");
        let mut params = vec![];
        
        if let Some(limit) = limit {
            params.push(("maxResults", limit.to_string()));
        }
        
        if let Some(token) = page_token {
            params.push(("pageToken", token));
        }

        if !params.is_empty() {
            url.push('?');
            url.push_str(
                &params
                    .iter()
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect::<Vec<_>>()
                    .join("&"),
            );
        }

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to list messages",
                response.status().to_string(),
            ));
        }

        let messages_response: GmailListResponse<serde_json::Value> = response.json().await?;
        let message_refs = messages_response.items.get("messages").unwrap_or(&vec![]);

        // Fetch full message details
        let mut messages = Vec::new();
        for msg_ref in message_refs {
            if let Some(id) = msg_ref.get("id").and_then(|v| v.as_str()) {
                match self.get_message(id).await {
                    Ok(message) => messages.push(message),
                    Err(e) => {
                        tracing::warn!("Failed to fetch message {}: {}", id, e);
                        continue;
                    }
                }
            }
        }

        Ok((messages, messages_response.next_page_token))
    }

    async fn get_message(&self, message_id: &str) -> MailResult<EmailMessage> {
        let url = self.api_url(&format!("messages/{}", message_id));
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to get message",
                response.status().to_string(),
            ));
        }

        let gmail_message: GmailMessage = response.json().await?;
        self.convert_gmail_message(&gmail_message).await
    }

    async fn get_message_raw(&self, message_id: &str) -> MailResult<Vec<u8>> {
        let url = self.api_url(&format!("messages/{}", message_id));
        let response = self
            .client
            .get(&url)
            .query(&[("format", "raw")])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to get raw message",
                response.status().to_string(),
            ));
        }

        let raw_response: serde_json::Value = response.json().await?;
        let raw_data = raw_response["raw"]
            .as_str()
            .ok_or_else(|| MailError::other("Raw data not found in response"))?;

        URL_SAFE_NO_PAD
            .decode(raw_data)
            .map_err(|e| MailError::other(format!("Failed to decode raw message: {}", e)))
    }

    async fn send_message(&self, _message: &EmailMessage) -> MailResult<String> {
        // Implementation would construct a MIME message and send it via Gmail API
        Err(MailError::not_supported("Send message", "gmail"))
    }

    async fn save_draft(&self, _message: &EmailMessage) -> MailResult<String> {
        // Implementation would save message as draft via Gmail API
        Err(MailError::not_supported("Save draft", "gmail"))
    }

    async fn delete_message(&self, message_id: &str) -> MailResult<()> {
        let url = self.api_url(&format!("messages/{}/trash", message_id));
        let response = self.client.post(&url).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to delete message",
                response.status().to_string(),
            ))
        }
    }

    async fn move_message(&self, message_id: &str, _folder_id: Uuid) -> MailResult<()> {
        // Gmail uses labels instead of folders, so this would need label mapping
        Err(MailError::not_supported("Move message by folder UUID", "gmail"))
    }

    async fn copy_message(&self, _message_id: &str, _folder_id: Uuid) -> MailResult<String> {
        // Gmail doesn't have a direct copy operation
        Err(MailError::not_supported("Copy message", "gmail"))
    }

    async fn mark_read(&self, message_id: &str, read: bool) -> MailResult<()> {
        let url = self.api_url(&format!("messages/{}/modify", message_id));
        let modify_data = if read {
            json!({
                "removeLabelIds": ["UNREAD"]
            })
        } else {
            json!({
                "addLabelIds": ["UNREAD"]
            })
        };

        let response = self.client.post(&url).json(&modify_data).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to mark message read/unread",
                response.status().to_string(),
            ))
        }
    }

    async fn mark_starred(&self, message_id: &str, starred: bool) -> MailResult<()> {
        let url = self.api_url(&format!("messages/{}/modify", message_id));
        let modify_data = if starred {
            json!({
                "addLabelIds": ["STARRED"]
            })
        } else {
            json!({
                "removeLabelIds": ["STARRED"]
            })
        };

        let response = self.client.post(&url).json(&modify_data).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to star/unstar message",
                response.status().to_string(),
            ))
        }
    }

    async fn mark_important(&self, message_id: &str, important: bool) -> MailResult<()> {
        let url = self.api_url(&format!("messages/{}/modify", message_id));
        let modify_data = if important {
            json!({
                "addLabelIds": ["IMPORTANT"]
            })
        } else {
            json!({
                "removeLabelIds": ["IMPORTANT"]
            })
        };

        let response = self.client.post(&url).json(&modify_data).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to mark message important/unimportant",
                response.status().to_string(),
            ))
        }
    }

    async fn add_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()> {
        let url = self.api_url(&format!("messages/{}/modify", message_id));
        let modify_data = json!({
            "addLabelIds": labels
        });

        let response = self.client.post(&url).json(&modify_data).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to add labels to message",
                response.status().to_string(),
            ))
        }
    }

    async fn remove_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()> {
        let url = self.api_url(&format!("messages/{}/modify", message_id));
        let modify_data = json!({
            "removeLabelIds": labels
        });

        let response = self.client.post(&url).json(&modify_data).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(MailError::provider_api(
                "Gmail",
                "Failed to remove labels from message",
                response.status().to_string(),
            ))
        }
    }

    async fn bulk_operation(&self, _operation: &BulkEmailOperation) -> MailResult<BulkOperationResult> {
        // Implementation would use Gmail's batch API
        Err(MailError::not_supported("Bulk operations", "gmail"))
    }

    async fn search_messages(&self, query: &str, limit: Option<u32>) -> MailResult<EmailSearchResult> {
        let mut url = self.api_url("messages");
        let mut params = vec![("q", self.build_search_query(query))];
        
        if let Some(limit) = limit {
            params.push(("maxResults", limit.to_string()));
        }

        url.push('?');
        url.push_str(
            &params
                .iter()
                .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&"),
        );

        let start_time = std::time::Instant::now();
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Search failed",
                response.status().to_string(),
            ));
        }

        let search_response: GmailListResponse<serde_json::Value> = response.json().await?;
        let message_refs = search_response.items.get("messages").unwrap_or(&vec![]);

        // Fetch message details
        let mut messages = Vec::new();
        for msg_ref in message_refs {
            if let Some(id) = msg_ref.get("id").and_then(|v| v.as_str()) {
                match self.get_message(id).await {
                    Ok(message) => messages.push(message),
                    Err(e) => {
                        tracing::warn!("Failed to fetch search result message {}: {}", id, e);
                        continue;
                    }
                }
            }
        }

        Ok(EmailSearchResult {
            query: query.to_string(),
            total_count: search_response.result_size_estimate.unwrap_or(0) as i32,
            messages,
            took: start_time.elapsed().as_millis() as u64,
            facets: None, // Gmail doesn't provide faceted search results
            suggestions: None,
        })
    }

    async fn get_thread(&self, thread_id: &str) -> MailResult<EmailThread> {
        let url = self.api_url(&format!("threads/{}", thread_id));
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to get thread",
                response.status().to_string(),
            ));
        }

        let gmail_thread: GmailThread = response.json().await?;
        let messages = gmail_thread.messages.unwrap_or_default();

        if messages.is_empty() {
            return Err(MailError::not_found("Thread", thread_id));
        }

        // Convert first message to get thread details
        let first_message = self.convert_gmail_message(&messages[0]).await?;
        let mut participants = vec![first_message.from.clone()];
        participants.extend(first_message.to.clone());

        // Remove duplicates
        participants.sort_by(|a, b| a.address.cmp(&b.address));
        participants.dedup_by(|a, b| a.address == b.address);

        let thread_flags = ThreadFlags {
            has_unread: messages.iter().any(|m| {
                m.label_ids.as_ref().map_or(false, |labels| labels.contains(&"UNREAD".to_string()))
            }),
            has_starred: messages.iter().any(|m| {
                m.label_ids.as_ref().map_or(false, |labels| labels.contains(&"STARRED".to_string()))
            }),
            has_important: messages.iter().any(|m| {
                m.label_ids.as_ref().map_or(false, |labels| labels.contains(&"IMPORTANT".to_string()))
            }),
            has_attachments: messages.iter().any(|m| {
                m.payload.as_ref().map_or(false, |p| self.has_attachments(p))
            }),
        };

        let last_message_date = messages.iter()
            .filter_map(|m| m.internal_date.as_ref())
            .filter_map(|d| d.parse::<i64>().ok())
            .max()
            .map(|ts| Utc.timestamp_millis_opt(ts).unwrap_or(Utc::now()))
            .unwrap_or(Utc::now());

        Ok(EmailThread {
            id: Uuid::new_v4(),
            account_id: first_message.account_id,
            subject: first_message.subject,
            message_ids: vec![], // Would need to map Gmail message IDs to UUIDs
            participants,
            labels: first_message.labels,
            flags: thread_flags,
            last_message_at: last_message_date,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    async fn list_thread_messages(&self, thread_id: &str) -> MailResult<Vec<EmailMessage>> {
        let url = self.api_url(&format!("threads/{}", thread_id));
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to get thread messages",
                response.status().to_string(),
            ));
        }

        let gmail_thread: GmailThread = response.json().await?;
        let gmail_messages = gmail_thread.messages.unwrap_or_default();

        let mut messages = Vec::new();
        for gmail_msg in gmail_messages {
            match self.convert_gmail_message(&gmail_msg).await {
                Ok(message) => messages.push(message),
                Err(e) => {
                    tracing::warn!("Failed to convert thread message {}: {}", gmail_msg.id, e);
                    continue;
                }
            }
        }

        Ok(messages)
    }

    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
        let url = self.api_url(&format!(
            "messages/{}/attachments/{}",
            message_id, attachment_id
        ));
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to get attachment",
                response.status().to_string(),
            ));
        }

        let attachment_response: serde_json::Value = response.json().await?;
        let data = attachment_response["data"]
            .as_str()
            .ok_or_else(|| MailError::other("Attachment data not found"))?;

        URL_SAFE_NO_PAD
            .decode(data)
            .map_err(|e| MailError::other(format!("Failed to decode attachment: {}", e)))
    }

    async fn download_attachment(&self, message_id: &str, attachment_id: &str, path: &str) -> MailResult<()> {
        let data = self.get_attachment(message_id, attachment_id).await?;
        tokio::fs::write(path, data).await
            .map_err(|e| MailError::other(format!("Failed to save attachment: {}", e)))
    }

    async fn get_sync_changes(&self, history_id: Option<String>) -> MailResult<SyncResult> {
        let start_history_id = history_id.ok_or_else(|| {
            MailError::sync("History ID required for Gmail incremental sync")
        })?;

        let url = self.api_url(&format!("history?startHistoryId={}", start_history_id));
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(MailError::provider_api(
                "Gmail",
                "Failed to get history",
                response.status().to_string(),
            ));
        }

        let history_response: GmailHistoryResponse = response.json().await?;
        let mut changes = Vec::new();

        if let Some(history_records) = history_response.history {
            for record in history_records {
                // Process added messages
                if let Some(added) = record.messages_added {
                    for msg in added {
                        match self.convert_gmail_message(&msg.message).await {
                            Ok(message) => changes.push(SyncChange::MessageAdded(message)),
                            Err(e) => tracing::warn!("Failed to convert added message: {}", e),
                        }
                    }
                }

                // Process deleted messages
                if let Some(deleted) = record.messages_deleted {
                    for msg in deleted {
                        changes.push(SyncChange::MessageDeleted(msg.message.id));
                    }
                }

                // Process label changes (treated as message updates)
                if let Some(label_changes) = record.labels_added {
                    for change in label_changes {
                        match self.convert_gmail_message(&change.message).await {
                            Ok(message) => changes.push(SyncChange::MessageUpdated(message)),
                            Err(e) => tracing::warn!("Failed to convert updated message: {}", e),
                        }
                    }
                }
            }
        }

        Ok(SyncResult {
            sync_token: history_response.history_id,
            changes,
            has_more: history_response.next_page_token.is_some(),
        })
    }

    async fn get_full_sync_token(&self) -> MailResult<String> {
        // Get current history ID for full sync
        let profile = self.get_account_info().await?;
        let history_id = profile["historyId"]
            .as_str()
            .ok_or_else(|| MailError::sync("No history ID in profile"))?;
        Ok(history_id.to_string())
    }

    async fn setup_push_notifications(&self, _webhook_url: &str) -> MailResult<()> {
        // Implementation would set up Gmail push notifications via Pub/Sub
        Err(MailError::not_supported("Push notifications setup", "gmail"))
    }

    async fn disable_push_notifications(&self) -> MailResult<()> {
        // Implementation would disable Gmail push notifications
        Err(MailError::not_supported("Push notifications disable", "gmail"))
    }

    async fn create_filter(&self, _filter: &EmailFilter) -> MailResult<String> {
        // Implementation would create Gmail filter
        Err(MailError::not_supported("Create filter", "gmail"))
    }

    async fn update_filter(&self, _filter_id: &str, _filter: &EmailFilter) -> MailResult<()> {
        // Implementation would update Gmail filter
        Err(MailError::not_supported("Update filter", "gmail"))
    }

    async fn delete_filter(&self, _filter_id: &str) -> MailResult<()> {
        // Implementation would delete Gmail filter
        Err(MailError::not_supported("Delete filter", "gmail"))
    }

    async fn list_filters(&self) -> MailResult<Vec<EmailFilter>> {
        // Implementation would list Gmail filters
        Err(MailError::not_supported("List filters", "gmail"))
    }
}

impl GmailProvider {
    /// Check if payload has attachments
    fn has_attachments(&self, payload: &GmailMessagePayload) -> bool {
        if payload.filename.as_ref().map_or(false, |f| !f.is_empty()) {
            return true;
        }
        
        if let Some(parts) = &payload.parts {
            for part in parts {
                if self.has_attachments(part) {
                    return true;
                }
            }
        }
        
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_gmail_labels() {
        let provider = GmailProvider {
            client: Client::new(),
            access_token: "test".to_string(),
            user_email: None,
        };

        let labels = vec!["INBOX".to_string(), "UNREAD".to_string(), "STARRED".to_string()];
        let flags = provider.parse_gmail_labels(&labels);

        assert!(!flags.is_read); // UNREAD is present
        assert!(flags.is_starred);
        assert!(!flags.is_trashed);
    }

    #[test]
    fn test_get_primary_folder() {
        let provider = GmailProvider {
            client: Client::new(),
            access_token: "test".to_string(),
            user_email: None,
        };

        assert_eq!(provider.get_primary_folder(&vec!["INBOX".to_string()]), "INBOX");
        assert_eq!(provider.get_primary_folder(&vec!["SENT".to_string()]), "SENT");
        assert_eq!(provider.get_primary_folder(&vec!["CUSTOM".to_string()]), "ALL");
    }

    #[test]
    fn test_build_search_query() {
        let provider = GmailProvider {
            client: Client::new(),
            access_token: "test".to_string(),
            user_email: None,
        };

        let query = provider.build_search_query("from:test@example.com");
        assert_eq!(query, "from:test@example.com");
    }
}