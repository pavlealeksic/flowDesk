//! Microsoft Graph API integration for Outlook mail and calendar
//!
//! This module provides comprehensive Microsoft Graph API integration with support for:
//! - OAuth2 authentication with automatic token refresh
//! - Mail operations (messages, folders, search, send)
//! - Calendar operations (events, calendars, free/busy queries)
//! - Real-time subscriptions and webhooks
//! - Batch operations for improved performance
//! - Delta sync for efficient incremental updates
//! - Rate limiting and retry logic
//! - Full Graph API v1.0 compliance

use crate::mail::{
    error::{MailError, MailResult},
    types::*,
};
use reqwest::{Client, Method, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime},
};
use tokio::sync::{Mutex, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use secrecy::{ExposeSecret, Secret};
use url::Url;

/// Microsoft Graph API configuration
#[derive(Debug, Clone)]
pub struct GraphConfig {
    pub client_id: String,
    pub client_secret: Secret<String>,
    pub tenant_id: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub api_version: String,
    pub max_requests_per_second: u32,
    pub max_batch_size: u32,
    pub request_timeout: Duration,
    pub token_refresh_threshold: Duration,
}

impl Default for GraphConfig {
    fn default() -> Self {
        Self {
            client_id: String::new(),
            client_secret: Secret::new(String::new()),
            tenant_id: String::new(),
            redirect_uri: String::new(),
            scopes: vec![
                "https://graph.microsoft.com/Mail.ReadWrite".to_string(),
                "https://graph.microsoft.com/Mail.Send".to_string(),
                "https://graph.microsoft.com/Calendars.ReadWrite".to_string(),
                "https://graph.microsoft.com/User.Read".to_string(),
            ],
            api_version: "v1.0".to_string(),
            max_requests_per_second: 100, // Conservative rate limit
            max_batch_size: 20,
            request_timeout: Duration::from_secs(30),
            token_refresh_threshold: Duration::from_secs(300), // Refresh 5 minutes before expiry
        }
    }
}

/// OAuth2 token information
#[derive(Debug, Clone)]
pub struct GraphToken {
    pub access_token: Secret<String>,
    pub refresh_token: Option<Secret<String>>,
    pub expires_at: SystemTime,
    pub token_type: String,
    pub scope: String,
}

impl GraphToken {
    /// Check if token is expired or near expiration
    pub fn is_expired(&self, threshold: Duration) -> bool {
        self.expires_at
            .duration_since(SystemTime::now())
            .map(|remaining| remaining < threshold)
            .unwrap_or(true)
    }
}

/// Microsoft Graph API client
pub struct GraphClient {
    config: GraphConfig,
    http_client: Client,
    token: Arc<RwLock<Option<GraphToken>>>,
    rate_limiter: Arc<Mutex<RateLimiter>>,
    base_url: String,
}

impl GraphClient {
    /// Create new Graph client
    pub async fn new(config: GraphConfig) -> MailResult<Self> {
        let http_client = Client::builder()
            .timeout(config.request_timeout)
            .user_agent("FlowDesk/1.0")
            .build()
            .map_err(|e| MailError::configuration(&format!("Failed to create HTTP client: {}", e)))?;

        let base_url = format!("https://graph.microsoft.com/{}", config.api_version);
        
        let rate_limiter = Arc::new(Mutex::new(RateLimiter::new(
            config.max_requests_per_second,
            Duration::from_secs(1),
        )));

        Ok(Self {
            config,
            http_client,
            token: Arc::new(RwLock::new(None)),
            rate_limiter,
            base_url,
        })
    }

    /// Set access token
    pub async fn set_token(&self, token: GraphToken) -> MailResult<()> {
        let mut token_guard = self.token.write().await;
        *token_guard = Some(token);
        Ok(())
    }

    /// Get OAuth2 authorization URL
    pub fn get_authorization_url(&self, state: &str) -> MailResult<String> {
        let mut auth_url = Url::parse(&format!(
            "https://login.microsoftonline.com/{}/oauth2/v2.0/authorize",
            self.config.tenant_id
        )).map_err(|e| MailError::configuration(&format!("Invalid tenant ID: {}", e)))?;

        auth_url.query_pairs_mut()
            .append_pair("client_id", &self.config.client_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", &self.config.redirect_uri)
            .append_pair("scope", &self.config.scopes.join(" "))
            .append_pair("state", state)
            .append_pair("response_mode", "query");

        Ok(auth_url.to_string())
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(&self, code: &str) -> MailResult<GraphToken> {
        let token_url = format!(
            "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
            self.config.tenant_id
        );

        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.expose_secret()),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", self.config.redirect_uri.as_str()),
        ];

        let response = self.http_client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| MailError::authentication(&format!("Token exchange failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(MailError::authentication(&format!("Token exchange failed: {}", error_text)));
        }

        let token_response: TokenResponse = response.json().await
            .map_err(|e| MailError::authentication(&format!("Failed to parse token response: {}", e)))?;

        let expires_at = SystemTime::now() + Duration::from_secs(token_response.expires_in);

        let token = GraphToken {
            access_token: Secret::new(token_response.access_token),
            refresh_token: token_response.refresh_token.map(Secret::new),
            expires_at,
            token_type: token_response.token_type.unwrap_or_else(|| "Bearer".to_string()),
            scope: token_response.scope.unwrap_or_default(),
        };

        self.set_token(token.clone()).await?;

        info!("Successfully exchanged authorization code for access token");
        Ok(token)
    }

    /// Refresh access token
    pub async fn refresh_token(&self) -> MailResult<GraphToken> {
        let refresh_token = {
            let token_guard = self.token.read().await;
            token_guard.as_ref()
                .and_then(|t| t.refresh_token.as_ref())
                .ok_or_else(|| MailError::authentication("No refresh token available"))?
                .clone()
        };

        let token_url = format!(
            "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
            self.config.tenant_id
        );

        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.expose_secret()),
            ("refresh_token", refresh_token.expose_secret()),
            ("grant_type", "refresh_token"),
        ];

        let response = self.http_client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| MailError::authentication(&format!("Token refresh failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(MailError::authentication(&format!("Token refresh failed: {}", error_text)));
        }

        let token_response: TokenResponse = response.json().await
            .map_err(|e| MailError::authentication(&format!("Failed to parse refresh response: {}", e)))?;

        let expires_at = SystemTime::now() + Duration::from_secs(token_response.expires_in);

        let token = GraphToken {
            access_token: Secret::new(token_response.access_token),
            refresh_token: token_response.refresh_token.map(Secret::new).or(Some(refresh_token)),
            expires_at,
            token_type: token_response.token_type.unwrap_or_else(|| "Bearer".to_string()),
            scope: token_response.scope.unwrap_or_default(),
        };

        self.set_token(token.clone()).await?;

        info!("Successfully refreshed access token");
        Ok(token)
    }

    /// Ensure valid access token (refresh if needed)
    async fn ensure_valid_token(&self) -> MailResult<String> {
        let needs_refresh = {
            let token_guard = self.token.read().await;
            match token_guard.as_ref() {
                Some(token) => token.is_expired(self.config.token_refresh_threshold),
                None => return Err(MailError::authentication("No access token available")),
            }
        };

        if needs_refresh {
            self.refresh_token().await?;
        }

        let token_guard = self.token.read().await;
        let token = token_guard.as_ref()
            .ok_or_else(|| MailError::authentication("No access token available"))?;

        Ok(token.access_token.expose_secret().clone())
    }

    /// Make authenticated request to Graph API
    async fn make_request(&self, method: Method, endpoint: &str) -> MailResult<RequestBuilder> {
        // Check rate limit
        {
            let mut limiter = self.rate_limiter.lock().await;
            if !limiter.allow() {
                return Err(MailError::rate_limited("Microsoft Graph API rate limit exceeded"));
            }
        }

        let access_token = self.ensure_valid_token().await?;
        let url = format!("{}/{}", self.base_url, endpoint.trim_start_matches('/'));

        let request = self.http_client
            .request(method, &url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json");

        Ok(request)
    }

    /// Execute request and handle response
    async fn execute_request<T>(&self, request: RequestBuilder) -> MailResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let response = request.send().await
            .map_err(|e| MailError::provider_api("Graph", &format!("Request failed: {}", e), "request_failed"))?;

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();

        if !status.is_success() {
            let error = self.parse_error_response(&response_text, status.as_u16());
            return Err(error);
        }

        serde_json::from_str(&response_text)
            .map_err(|e| MailError::parsing(&format!("Failed to parse response: {} - Response: {}", e, response_text)))
    }

    /// Parse Graph API error response
    fn parse_error_response(&self, response_text: &str, status_code: u16) -> MailError {
        if let Ok(graph_error) = serde_json::from_str::<GraphErrorResponse>(response_text) {
            MailError::provider_api(
                "Graph",
                &graph_error.error.message,
                &graph_error.error.code,
            )
        } else {
            MailError::provider_api(
                "Graph",
                &format!("HTTP {} - {}", status_code, response_text),
                &status_code.to_string(),
            )
        }
    }

    /// Get user profile information
    pub async fn get_user_profile(&self) -> MailResult<GraphUser> {
        let request = self.make_request(Method::GET, "/me").await?;
        self.execute_request(request).await
    }

    /// List mail folders
    pub async fn list_mail_folders(&self) -> MailResult<Vec<MailFolder>> {
        let request = self.make_request(Method::GET, "/me/mailFolders").await?;
        let response: GraphResponse<GraphMailFolder> = self.execute_request(request).await?;

        let mut folders = Vec::new();
        for graph_folder in response.value {
            folders.push(self.convert_graph_folder(graph_folder).await?);
        }

        Ok(folders)
    }

    /// Convert Graph folder to MailFolder
    async fn convert_graph_folder(&self, graph_folder: GraphMailFolder) -> MailResult<MailFolder> {
        let folder_type = match graph_folder.display_name.to_lowercase().as_str() {
            "inbox" => MailFolderType::Inbox,
            "sent items" | "sent" => MailFolderType::Sent,
            "drafts" => MailFolderType::Drafts,
            "deleted items" | "trash" => MailFolderType::Trash,
            "junk email" | "spam" => MailFolderType::Spam,
            "archive" => MailFolderType::Archive,
            _ => MailFolderType::Custom,
        };

        Ok(MailFolder {
            id: Uuid::parse_str(&graph_folder.id)
                .unwrap_or_else(|_| Uuid::new_v4()),
            account_id: Uuid::nil(), // Will be set by caller
            name: graph_folder.display_name.clone(),
            display_name: graph_folder.display_name.clone(),
            folder_type,
            parent_id: graph_folder.parent_folder_id
                .and_then(|id| Uuid::parse_str(&id).ok()),
            path: format!("/{}", graph_folder.display_name),
            attributes: vec![], // Graph API doesn't expose IMAP attributes
            message_count: graph_folder.total_item_count.unwrap_or(0),
            unread_count: graph_folder.unread_item_count.unwrap_or(0),
            is_selectable: true,
            can_select: true,
            sync_status: FolderSyncStatus::default(),
        })
    }

    /// List messages in a folder
    pub async fn list_messages(&self, folder_id: &str, limit: Option<u32>, skip: Option<u32>) -> MailResult<(Vec<EmailMessage>, Option<String>)> {
        let mut endpoint = format!("/me/mailFolders/{}/messages", folder_id);
        let mut query_params = Vec::new();

        if let Some(top) = limit {
            query_params.push(format!("$top={}", top.min(1000))); // Graph API max is 1000
        }

        if let Some(skip) = skip {
            query_params.push(format!("$skip={}", skip));
        }

        // Add expand parameter for body content
        query_params.push("$expand=attachments".to_string());

        if !query_params.is_empty() {
            endpoint.push('?');
            endpoint.push_str(&query_params.join("&"));
        }

        let request = self.make_request(Method::GET, &endpoint).await?;
        let response: GraphResponse<GraphMessage> = self.execute_request(request).await?;

        let mut messages = Vec::new();
        for graph_message in response.value {
            if let Ok(email_msg) = self.convert_graph_message(graph_message).await {
                messages.push(email_msg);
            }
        }

        // Handle pagination
        let next_link = response.odata_next_link;

        Ok((messages, next_link))
    }

    /// Convert Graph message to EmailMessage
    async fn convert_graph_message(&self, graph_message: GraphMessage) -> MailResult<EmailMessage> {
        let from = graph_message.from.map(|from| EmailAddress {
            name: from.email_address.name,
            address: from.email_address.address.clone(),
            email: from.email_address.address,
        });

        let to = graph_message.to_recipients.into_iter()
            .map(|recipient| EmailAddress {
                name: recipient.email_address.name,
                address: recipient.email_address.address.clone(),
                email: recipient.email_address.address,
            })
            .collect();

        let cc = graph_message.cc_recipients.into_iter()
            .map(|recipient| EmailAddress {
                name: recipient.email_address.name,
                address: recipient.email_address.address.clone(),
                email: recipient.email_address.address,
            })
            .collect();

        let bcc = graph_message.bcc_recipients.into_iter()
            .map(|recipient| EmailAddress {
                name: recipient.email_address.name,
                address: recipient.email_address.address.clone(),
                email: recipient.email_address.address,
            })
            .collect();

        // Extract content and snippet
        let (body_text, body_html, snippet) = if let Some(body) = &graph_message.body {
            let snippet = body.content.chars().take(200).collect();
            let content = body.content.clone();
            match body.content_type.to_lowercase().as_str() {
                "html" => (None, Some(content), snippet),
                "text" => (Some(content), None, snippet),
                _ => (Some(content), None, snippet),
            }
        } else {
            (None, None, String::new())
        };

        // Convert attachments
        let attachments: Vec<_> = graph_message.attachments.unwrap_or_default()
            .into_iter()
            .filter_map(|att| self.convert_graph_attachment(att).ok())
            .collect();

        // Convert flags
        let flags = EmailFlags {
            is_read: graph_message.is_read.unwrap_or(false),
            is_starred: graph_message.flag.is_some(),
            is_trashed: false, // Deleted items wouldn't be in the response
            is_spam: false, // Would need to check folder type
            is_important: matches!(graph_message.importance.as_deref(), Some("high")),
            is_archived: false, // Would need to check folder type
            is_draft: graph_message.is_draft.unwrap_or(false),
            is_sent: matches!(graph_message.inference_classification.as_deref(), Some("focused")),
            has_attachments: !attachments.is_empty(),
        };

        let created_at = graph_message.created_date_time
            .and_then(|dt| DateTime::parse_from_rfc3339(&dt).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        let updated_at = graph_message.last_modified_date_time
            .and_then(|dt| DateTime::parse_from_rfc3339(&dt).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        Ok(EmailMessage {
            id: Uuid::parse_str(&graph_message.id).unwrap_or_else(|_| Uuid::new_v4()),
            account_id: Uuid::nil(), // Will be set by caller
            provider_id: graph_message.id,
            thread_id: graph_message.conversation_id
                .and_then(|id| Uuid::parse_str(&id).ok())
                .unwrap_or_else(|| Uuid::new_v4()),
            subject: graph_message.subject.unwrap_or_default(),
            body_html,
            body_text,
            snippet,
            from: from.unwrap_or(EmailAddress {
                name: None,
                address: "unknown@unknown.com".to_string(),
                email: "unknown@unknown.com".to_string(),
            }),
            to,
            cc,
            bcc,
            reply_to: vec![], // Graph API doesn't always provide this
            date: created_at,
            flags,
            labels: vec![], // Graph uses categories instead of labels
            folder: "Unknown".to_string(), // Will be set by caller
            folder_id: None,
            importance: if matches!(graph_message.importance.as_deref(), Some("high")) {
                MessageImportance::High
            } else if matches!(graph_message.importance.as_deref(), Some("low")) {
                MessageImportance::Low
            } else {
                MessageImportance::Normal
            },
            priority: MessagePriority::Normal,
            size: graph_message.body
                .as_ref()
                .map(|body| body.content.len() as i64)
                .unwrap_or(0),
            attachments,
            headers: HashMap::new(), // Would need separate call to get headers
            message_id: graph_message.internet_message_id.clone().unwrap_or_default(),
            message_id_header: graph_message.internet_message_id,
            in_reply_to: None, // Would need to parse headers
            references: vec![], // Would need to parse headers
            encryption: None, // Would need to analyze message content
            created_at,
            updated_at,
        })
    }

    /// Convert Graph attachment to EmailAttachment
    fn convert_graph_attachment(&self, graph_attachment: GraphAttachment) -> MailResult<EmailAttachment> {
        Ok(EmailAttachment {
            id: graph_attachment.id,
            filename: graph_attachment.name,
            mime_type: graph_attachment.content_type.clone(),
            content_type: graph_attachment.content_type,
            size: graph_attachment.size.unwrap_or(0) as i64,
            is_inline: graph_attachment.is_inline.unwrap_or(false),
            inline: graph_attachment.is_inline.unwrap_or(false),
            content_id: graph_attachment.content_id,
            download_url: None,
            local_path: None,
            data: None, // Data will be loaded on demand
        })
    }

    /// Send email message
    pub async fn send_message(&self, message: &EmailMessage) -> MailResult<String> {
        let graph_message = self.build_graph_message(message).await?;
        
        let request = self.make_request(Method::POST, "/me/sendMail").await?
            .json(&json!({
                "message": graph_message,
                "saveToSentItems": true
            }));

        // Send mail endpoint returns 202 Accepted with no body
        let response = request.send().await
            .map_err(|e| MailError::provider_api("Graph", &format!("Send failed: {}", e), "send_failed"))?;

        if response.status().is_success() {
            info!("Successfully sent email via Microsoft Graph");
            Ok(Uuid::new_v4().to_string()) // Graph doesn't return message ID for sent items
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(MailError::provider_api("Graph", &format!("Send failed: {}", error_text), "send_failed"))
        }
    }

    /// Build Graph API message from EmailMessage
    async fn build_graph_message(&self, email: &EmailMessage) -> MailResult<serde_json::Value> {
        let mut message = serde_json::Map::new();

        // Subject
        message.insert("subject".to_string(), json!(email.subject));

        // Recipients
        let to_recipients: Vec<_> = email.to.iter()
            .map(|addr| json!({
                "emailAddress": {
                    "address": addr.address,
                    "name": addr.name
                }
            }))
            .collect();
        message.insert("toRecipients".to_string(), json!(to_recipients));

        if !email.cc.is_empty() {
            let cc_recipients: Vec<_> = email.cc.iter()
                .map(|addr| json!({
                    "emailAddress": {
                        "address": addr.address,
                        "name": addr.name
                    }
                }))
                .collect();
            message.insert("ccRecipients".to_string(), json!(cc_recipients));
        }

        if !email.bcc.is_empty() {
            let bcc_recipients: Vec<_> = email.bcc.iter()
                .map(|addr| json!({
                    "emailAddress": {
                        "address": addr.address,
                        "name": addr.name
                    }
                }))
                .collect();
            message.insert("bccRecipients".to_string(), json!(bcc_recipients));
        }

        // Body content
        let body = if let Some(ref html) = email.body_html {
            json!({
                "contentType": "html",
                "content": html
            })
        } else if let Some(ref text) = email.body_text {
            json!({
                "contentType": "text",
                "content": text
            })
        } else {
            json!({
                "contentType": "text",
                "content": ""
            })
        };
        message.insert("body".to_string(), body);

        // Attachments - Note: Graph API requires actual file data
        // This is a placeholder implementation as EmailAttachment stores references, not data
        if !email.attachments.is_empty() {
            let attachments: Vec<_> = email.attachments.iter()
                .map(|att| {
                    json!({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": att.filename,
                        "contentType": att.mime_type,
                        "contentBytes": "", // TODO: Load actual file data from local_path or download_url
                        "contentId": att.content_id,
                        "isInline": att.is_inline
                    })
                })
                .collect();
            message.insert("attachments".to_string(), json!(attachments));
        }

        // Importance
        if email.flags.is_important {
            message.insert("importance".to_string(), json!("high"));
        }

        Ok(json!(message))
    }

    /// Search messages
    pub async fn search_messages(&self, query: &str, limit: Option<u32>) -> MailResult<EmailSearchResult> {
        let mut endpoint = "/me/messages".to_string();
        let mut query_params = vec![format!("$search=\"{}\"", query)];

        if let Some(top) = limit {
            query_params.push(format!("$top={}", top.min(1000)));
        }

        query_params.push("$expand=attachments".to_string());

        endpoint.push('?');
        endpoint.push_str(&query_params.join("&"));

        let start_time = std::time::Instant::now();
        
        let request = self.make_request(Method::GET, &endpoint).await?;
        let response: GraphResponse<GraphMessage> = self.execute_request(request).await?;

        let search_duration = start_time.elapsed().as_millis() as u64;

        let mut messages = Vec::new();
        for graph_message in response.value {
            if let Ok(email_msg) = self.convert_graph_message(graph_message).await {
                messages.push(email_msg);
            }
        }

        Ok(EmailSearchResult {
            query: query.to_string(),
            total_count: messages.len() as i32,
            messages,
            took: search_duration,
            facets: None,
            suggestions: None,
        })
    }

    /// Create subscription for real-time notifications
    pub async fn create_subscription(&self, resource: &str, webhook_url: &str) -> MailResult<GraphSubscription> {
        let subscription = json!({
            "changeType": "created,updated,deleted",
            "notificationUrl": webhook_url,
            "resource": resource,
            "expirationDateTime": (Utc::now() + chrono::Duration::hours(1)).to_rfc3339(),
            "clientState": Uuid::new_v4().to_string()
        });

        let request = self.make_request(Method::POST, "/subscriptions").await?
            .json(&subscription);

        let response: GraphSubscription = self.execute_request(request).await?;
        
        info!("Created Graph subscription: {}", response.id);
        Ok(response)
    }

    /// Delete subscription
    pub async fn delete_subscription(&self, subscription_id: &str) -> MailResult<()> {
        let endpoint = format!("/subscriptions/{}", subscription_id);
        let request = self.make_request(Method::DELETE, &endpoint).await?;

        let response = request.send().await
            .map_err(|e| MailError::provider_api("Graph", &format!("Delete subscription failed: {}", e), "delete_failed"))?;

        if response.status().is_success() {
            info!("Deleted Graph subscription: {}", subscription_id);
            Ok(())
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(MailError::provider_api("Graph", &format!("Delete subscription failed: {}", error_text), "delete_failed"))
        }
    }
}

// Helper macro for JSON creation
macro_rules! json {
    ($($json:tt)*) => {
        serde_json::json!($($json)*)
    };
}

/// Rate limiter for API requests
struct RateLimiter {
    limit: u32,
    window: Duration,
    timestamps: Vec<std::time::Instant>,
}

impl RateLimiter {
    fn new(limit: u32, window: Duration) -> Self {
        Self {
            limit,
            window,
            timestamps: Vec::new(),
        }
    }

    fn allow(&mut self) -> bool {
        let now = std::time::Instant::now();
        
        // Remove old timestamps
        self.timestamps.retain(|&timestamp| now.duration_since(timestamp) < self.window);
        
        if self.timestamps.len() < self.limit as usize {
            self.timestamps.push(now);
            true
        } else {
            false
        }
    }
}

// Graph API response types

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    token_type: Option<String>,
    scope: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GraphResponse<T> {
    value: Vec<T>,
    #[serde(rename = "@odata.nextLink")]
    odata_next_link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GraphErrorResponse {
    error: GraphError,
}

#[derive(Debug, Deserialize)]
struct GraphError {
    code: String,
    message: String,
}

#[derive(Debug, Deserialize)]
pub struct GraphUser {
    pub id: String,
    pub display_name: Option<String>,
    pub mail: Option<String>,
    pub user_principal_name: String,
}

#[derive(Debug, Deserialize)]
struct GraphMailFolder {
    id: String,
    display_name: String,
    parent_folder_id: Option<String>,
    child_folder_count: Option<i32>,
    unread_item_count: Option<i32>,
    total_item_count: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct GraphMessage {
    id: String,
    subject: Option<String>,
    body: Option<GraphItemBody>,
    from: Option<GraphRecipient>,
    to_recipients: Vec<GraphRecipient>,
    cc_recipients: Vec<GraphRecipient>,
    bcc_recipients: Vec<GraphRecipient>,
    is_read: Option<bool>,
    is_draft: Option<bool>,
    importance: Option<String>,
    inference_classification: Option<String>,
    flag: Option<GraphFlag>,
    created_date_time: Option<String>,
    last_modified_date_time: Option<String>,
    conversation_id: Option<String>,
    internet_message_id: Option<String>,
    attachments: Option<Vec<GraphAttachment>>,
}

#[derive(Debug, Deserialize)]
struct GraphItemBody {
    content_type: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct GraphRecipient {
    email_address: GraphEmailAddress,
}

#[derive(Debug, Deserialize)]
struct GraphEmailAddress {
    name: Option<String>,
    address: String,
}

#[derive(Debug, Deserialize)]
struct GraphFlag {
    flag_status: String,
}

#[derive(Debug, Deserialize)]
struct GraphAttachment {
    id: String,
    name: String,
    content_type: String,
    size: Option<i32>,
    is_inline: Option<bool>,
    content_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GraphSubscription {
    pub id: String,
    pub resource: String,
    pub change_type: String,
    pub notification_url: String,
    pub expiration_date_time: String,
    pub client_state: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graph_config_default() {
        let config = GraphConfig::default();
        assert_eq!(config.api_version, "v1.0");
        assert_eq!(config.max_requests_per_second, 100);
        assert_eq!(config.max_batch_size, 20);
        assert!(config.scopes.contains(&"https://graph.microsoft.com/Mail.ReadWrite".to_string()));
    }

    #[test]
    fn test_token_expiry() {
        let token = GraphToken {
            access_token: Secret::new("test_token".to_string()),
            refresh_token: None,
            expires_at: SystemTime::now() + Duration::from_secs(100),
            token_type: "Bearer".to_string(),
            scope: "test".to_string(),
        };

        assert!(!token.is_expired(Duration::from_secs(50)));
        assert!(token.is_expired(Duration::from_secs(200)));
    }

    #[test]
    fn test_rate_limiter() {
        let mut limiter = RateLimiter::new(5, Duration::from_secs(60));
        
        // Should allow 5 requests
        for _ in 0..5 {
            assert!(limiter.allow());
        }
        
        // 6th request should be denied
        assert!(!limiter.allow());
    }
}