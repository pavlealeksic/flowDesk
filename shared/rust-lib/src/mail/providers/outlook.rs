//! Microsoft Graph/Outlook provider implementation

use crate::mail::{error::{MailResult, MailError}, providers::{MailProviderTrait, ProviderCapabilities, SyncResult, SyncChange}, types::*};
use async_trait::async_trait;
use std::collections::HashMap;
use uuid::Uuid;
use reqwest::{Client, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE}};
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use base64::{Engine, engine::general_purpose};

pub struct OutlookProvider {
    access_token: Arc<Mutex<String>>,
    client: Client,
    base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphMessage {
    id: String,
    #[serde(rename = "createdDateTime")]
    created_date_time: String,
    #[serde(rename = "lastModifiedDateTime")]
    last_modified_date_time: String,
    #[serde(rename = "receivedDateTime")]
    received_date_time: String,
    #[serde(rename = "sentDateTime")]
    sent_date_time: Option<String>,
    #[serde(rename = "hasAttachments")]
    has_attachments: bool,
    #[serde(rename = "internetMessageId")]
    internet_message_id: Option<String>,
    subject: Option<String>,
    #[serde(rename = "bodyPreview")]
    body_preview: Option<String>,
    importance: String,
    #[serde(rename = "parentFolderId")]
    parent_folder_id: String,
    #[serde(rename = "conversationId")]
    conversation_id: String,
    #[serde(rename = "isDeliveryReceiptRequested")]
    is_delivery_receipt_requested: bool,
    #[serde(rename = "isReadReceiptRequested")]
    is_read_receipt_requested: bool,
    #[serde(rename = "isRead")]
    is_read: bool,
    #[serde(rename = "isDraft")]
    is_draft: bool,
    from: Option<GraphRecipient>,
    sender: Option<GraphRecipient>,
    #[serde(rename = "toRecipients")]
    to_recipients: Vec<GraphRecipient>,
    #[serde(rename = "ccRecipients")]
    cc_recipients: Vec<GraphRecipient>,
    #[serde(rename = "bccRecipients")]
    bcc_recipients: Vec<GraphRecipient>,
    #[serde(rename = "replyTo")]
    reply_to: Vec<GraphRecipient>,
    body: GraphBody,
    attachments: Option<Vec<GraphAttachment>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphRecipient {
    #[serde(rename = "emailAddress")]
    email_address: GraphEmailAddress,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphEmailAddress {
    name: Option<String>,
    address: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphBody {
    #[serde(rename = "contentType")]
    content_type: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphAttachment {
    id: String,
    name: Option<String>,
    #[serde(rename = "contentType")]
    content_type: Option<String>,
    size: Option<i32>,
    #[serde(rename = "isInline")]
    is_inline: Option<bool>,
    #[serde(rename = "lastModifiedDateTime")]
    last_modified_date_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphFolder {
    id: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "parentFolderId")]
    parent_folder_id: Option<String>,
    #[serde(rename = "childFolderCount")]
    child_folder_count: i32,
    #[serde(rename = "unreadItemCount")]
    unread_item_count: i32,
    #[serde(rename = "totalItemCount")]
    total_item_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphUser {
    id: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "userPrincipalName")]
    user_principal_name: String,
    mail: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GraphResponse<T> {
    value: Vec<T>,
    #[serde(rename = "@odata.nextLink")]
    next_link: Option<String>,
    #[serde(rename = "@odata.deltaLink")]
    delta_link: Option<String>,
}

impl OutlookProvider {
    pub fn new(config: ProviderAccountConfig) -> MailResult<Self> {
        // Extract access token from config  
        let access_token = match config {
            ProviderAccountConfig::Outlook { 
                client_id, tenant_id, scopes, enable_webhooks, delta_token 
            } => {
                // OAuth tokens would be injected separately during authentication
                String::new() // Placeholder - tokens managed separately
            }
            _ => return Err(MailError::invalid("Invalid provider config for Outlook")),
        };

        Ok(Self { 
            access_token: Arc::new(Mutex::new(access_token)),
            client: Client::new(),
            base_url: "https://graph.microsoft.com/v1.0".to_string(),
        })
    }

    pub async fn new_with_token(access_token: String) -> MailResult<Self> {
        Ok(Self { 
            access_token: Arc::new(Mutex::new(access_token)),
            client: Client::new(),
            base_url: "https://graph.microsoft.com/v1.0".to_string(),
        })
    }

    async fn get_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        let token = self.access_token.lock().await;
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", *token)).unwrap());
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers
    }

    async fn make_graph_request<T>(&self, endpoint: &str) -> MailResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}/{}", self.base_url, endpoint);
        let headers = self.get_headers().await;
        
        let response = self.client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Graph API error: {}", response.status()),
            });
        }

        let json = response
            .json::<T>()
            .await?;

        Ok(json)
    }

    async fn make_graph_post<T, B>(&self, endpoint: &str, body: &B) -> MailResult<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}/{}", self.base_url, endpoint);
        let headers = self.get_headers().await;
        
        let response = self.client
            .post(&url)
            .headers(headers)
            .json(body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Graph API error: {}", response.status()),
            });
        }

        let json = response
            .json::<T>()
            .await?;

        Ok(json)
    }

    fn convert_graph_message_to_mail_message(&self, graph_msg: &GraphMessage) -> MailMessage {
        let from_address = graph_msg.from.as_ref()
            .map(|f| f.email_address.address.clone())
            .unwrap_or_default();
        let from = crate::mail::types::EmailAddress {
            address: from_address.clone(),
            email: from_address,
            name: graph_msg.from.as_ref()
                .and_then(|f| f.email_address.name.clone()),
        };

        MailMessage {
            id: Uuid::new_v4(), // Convert string ID to UUID
            account_id: Uuid::new_v4(), // Would be set from context
            provider_id: graph_msg.id.clone(),
            thread_id: Uuid::new_v4(), // Convert conversation ID
            subject: graph_msg.subject.clone().unwrap_or_default(),
            body_html: None, // Would need to fetch body separately
            body_text: None,
            snippet: graph_msg.body_preview.clone().unwrap_or_default(),
            from,
            to: graph_msg.to_recipients.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            cc: graph_msg.cc_recipients.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            bcc: graph_msg.bcc_recipients.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            reply_to: vec![],
            date: chrono::Utc::now(), // Would parse the date string properly
            flags: EmailFlags {
                is_read: graph_msg.is_read,
                is_starred: false, // Would need to check importance
                is_trashed: false,
                is_spam: false,
                is_important: false,
                is_archived: false,
                is_draft: graph_msg.is_draft,
                is_sent: false,
                has_attachments: graph_msg.has_attachments,
            },
            labels: vec![], // Outlook uses categories, not labels
            folder: graph_msg.parent_folder_id.clone(),
            folder_id: Some(Uuid::new_v4()),
            importance: match graph_msg.importance.as_str() {
                "high" => MessageImportance::High,
                "low" => MessageImportance::Low,
                _ => MessageImportance::Normal,
            },
            priority: MessagePriority::Normal,
            size: 0, // Graph API doesn't provide message size directly
            attachments: vec![], // Would need to fetch attachments separately
            headers: std::collections::HashMap::new(),
            message_id: graph_msg.internet_message_id.clone().unwrap_or_default(),
            message_id_header: graph_msg.internet_message_id.clone(),
            in_reply_to: None,
            references: vec![],
            encryption: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn convert_graph_folder_to_mail_folder(&self, graph_folder: &GraphFolder) -> MailFolder {
        MailFolder {
            id: Uuid::new_v4(), // Generate new UUID as Graph ID is string
            account_id: Uuid::new_v4(), // Would be set from context
            name: graph_folder.display_name.clone(),
            display_name: graph_folder.display_name.clone(),
            folder_type: MailFolderType::Custom, // Would need to map standard folders
            parent_id: None, // Would need to convert string ID to UUID
            path: format!("/{}", graph_folder.display_name),
            attributes: vec![], // Convert to Vec<String>
            message_count: graph_folder.total_item_count,
            unread_count: graph_folder.unread_item_count,
            is_selectable: true,
            can_select: true,
            sync_status: FolderSyncStatus::default(),
        }
    }
}

#[async_trait]
impl MailProviderTrait for OutlookProvider {
    fn provider_name(&self) -> &'static str {
        "outlook"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::default()
    }

    async fn test_connection(&self) -> MailResult<bool> {
        match self.make_graph_request::<GraphUser>("me").await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn get_account_info(&self) -> MailResult<MailAccount> {
        let user: GraphUser = self.make_graph_request("me").await?;
        
        Ok(MailAccount {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            name: user.display_name.clone().unwrap_or("Outlook Account".to_string()),
            email: user.mail.unwrap_or(user.user_principal_name),
            provider: crate::mail::types::MailProvider::Outlook,
            provider_config: crate::mail::types::ProviderAccountConfig::Outlook {
                client_id: String::new(),
                scopes: vec!["https://graph.microsoft.com/Mail.ReadWrite".to_string()],
                tenant_id: Some(String::new()),
                enable_webhooks: false,
                delta_token: None,
            },
            config: crate::mail::types::ProviderAccountConfig::Outlook {
                client_id: String::new(),
                scopes: vec!["https://graph.microsoft.com/Mail.ReadWrite".to_string()],
                tenant_id: Some(String::new()),
                enable_webhooks: false,
                delta_token: None,
            },
            status: crate::mail::types::MailAccountStatus::Active,
            last_sync_at: None,
            next_sync_at: None,
            sync_interval_minutes: 15,
            is_enabled: true,
            sync_status: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            display_name: user.display_name.clone().unwrap_or("Outlook Account".to_string()),
            oauth_tokens: None,
            imap_config: None,
            smtp_config: None,
        })
    }

    async fn get_folders(&self) -> MailResult<Vec<MailFolder>> {
        let response: GraphResponse<GraphFolder> = self.make_graph_request("me/mailFolders").await?;
        Ok(response.value.iter().map(|f| self.convert_graph_folder_to_mail_folder(f)).collect())
    }

    async fn list_folders(&self) -> MailResult<Vec<MailFolder>> {
        self.get_folders().await
    }

    async fn create_folder(&self, name: &str, parent_id: Option<&str>) -> MailResult<MailFolder> {
        let parent_path = parent_id.unwrap_or("me/mailFolders");
        let endpoint = format!("{}/childFolders", parent_path);
        
        let body = serde_json::json!({
            "displayName": name
        });
        
        let graph_folder: GraphFolder = self.make_graph_post(&endpoint, &body).await?;
        Ok(self.convert_graph_folder_to_mail_folder(&graph_folder))
    }

    async fn delete_folder(&self, folder_id: &str) -> MailResult<()> {
        let endpoint = format!("me/mailFolders/{}", folder_id);
        let headers = self.get_headers().await;
        
        let response = self.client
            .delete(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to delete folder: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn rename_folder(&self, folder_id: &str, new_name: &str) -> MailResult<()> {
        let endpoint = format!("me/mailFolders/{}", folder_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "displayName": new_name
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to rename folder: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn get_messages(&self, folder_id: &str, limit: Option<u32>) -> MailResult<Vec<MailMessage>> {
        let mut endpoint = format!("me/mailFolders/{}/messages", folder_id);
        if let Some(limit) = limit {
            endpoint.push_str(&format!("?$top={}", limit));
        }
        
        let response: GraphResponse<GraphMessage> = self.make_graph_request(&endpoint).await?;
        Ok(response.value.iter().map(|m| self.convert_graph_message_to_mail_message(m)).collect())
    }

    async fn list_messages(&self, folder_id: &str, limit: Option<u32>) -> MailResult<Vec<MailMessage>> {
        self.get_messages(folder_id, limit).await
    }

    async fn get_message(&self, message_id: &str) -> MailResult<EmailMessage> {
        let endpoint = format!("me/messages/{}?$expand=attachments", message_id);
        let graph_msg: GraphMessage = self.make_graph_request(&endpoint).await?;
        
        let from_address = graph_msg.from.as_ref()
            .map(|f| f.email_address.address.clone())
            .unwrap_or_default();
        
        let from = crate::mail::types::EmailAddress {
            address: from_address.clone(),
            email: from_address,
            name: graph_msg.from.as_ref()
                .and_then(|f| f.email_address.name.clone()),
        };

        Ok(EmailMessage {
            id: Uuid::new_v4(), // Convert string to UUID
            account_id: Uuid::new_v4(),
            provider_id: graph_msg.id,
            thread_id: Uuid::new_v4(),
            subject: graph_msg.subject.unwrap_or_default(),
            body_html: None,
            body_text: None,
            snippet: graph_msg.body_preview.unwrap_or_default(),
            from,
            to: graph_msg.to_recipients.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            cc: graph_msg.cc_recipients.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            bcc: graph_msg.bcc_recipients.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            reply_to: graph_msg.reply_to.iter()
                .map(|r| crate::mail::types::EmailAddress {
                    address: r.email_address.address.clone(),
                    email: r.email_address.address.clone(),
                    name: r.email_address.name.clone(),
                })
                .collect(),
            date: chrono::Utc::now(), // Parse properly from received_date_time
            attachments: graph_msg.attachments.unwrap_or_default().iter().map(|a| {
                crate::mail::types::EmailAttachment {
                    id: a.id.clone(),
                    filename: a.name.clone().unwrap_or("unknown".to_string()),
                    mime_type: a.content_type.clone().unwrap_or("application/octet-stream".to_string()),
                    content_type: a.content_type.clone().unwrap_or("application/octet-stream".to_string()),
                    size: a.size.unwrap_or(0) as i64,
                    content_id: None,
                    is_inline: a.is_inline.unwrap_or(false),
                    inline: a.is_inline.unwrap_or(false),
                    download_url: None,
                    local_path: None,
                    data: None,
                }
            }).collect(),
            flags: EmailFlags {
                is_read: graph_msg.is_read,
                is_starred: false,
                is_trashed: false,
                is_spam: false,
                is_important: false,
                is_archived: false,
                is_draft: graph_msg.is_draft,
                is_sent: false,
                has_attachments: graph_msg.has_attachments,
            },
            labels: vec![],
            folder: graph_msg.parent_folder_id.clone(),
            folder_id: Some(Uuid::new_v4()),
            importance: match graph_msg.importance.as_str() {
                "high" => MessageImportance::High,
                "low" => MessageImportance::Low,
                _ => MessageImportance::Normal,
            },
            priority: MessagePriority::Normal,
            size: 0, // Graph API doesn't provide message size directly
            headers: std::collections::HashMap::new(),
            message_id: graph_msg.internet_message_id.clone().unwrap_or_default(),
            message_id_header: graph_msg.internet_message_id.clone(),
            in_reply_to: None, // Graph API doesn't provide in_reply_to directly
            references: Vec::new(), // Graph API doesn't provide references directly
            encryption: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn get_message_raw(&self, _message_id: &str) -> MailResult<String> {
        Err(MailError::NotSupported { 
            feature: "Raw message access".to_string(), 
            provider: "Outlook".to_string() 
        })
    }

    async fn send_message(&self, message: &NewMessage) -> MailResult<String> {
        let body = serde_json::json!({
            "message": {
                "subject": message.subject,
                "body": {
                    "contentType": if message.body_html.is_some() { "html" } else { "text" },
                    "content": message.body_html.as_deref().unwrap_or_else(|| message.body_text.as_deref().unwrap_or(""))
                },
                "toRecipients": message.to.iter().map(|to| {
                    serde_json::json!({
                        "emailAddress": {
                            "address": to
                        }
                    })
                }).collect::<Vec<_>>(),
                "ccRecipients": message.cc.iter().map(|cc| {
                    serde_json::json!({
                        "emailAddress": {
                            "address": cc
                        }
                    })
                }).collect::<Vec<_>>(),
                "bccRecipients": message.bcc.iter().map(|bcc| {
                    serde_json::json!({
                        "emailAddress": {
                            "address": bcc
                        }
                    })
                }).collect::<Vec<_>>()
            }
        });
        
        let _response: serde_json::Value = self.make_graph_post("me/sendMail", &body).await?;
        Ok(Uuid::new_v4().to_string()) // Graph API doesn't return message ID for sent messages
    }

    async fn save_draft(&self, message: &NewMessage) -> MailResult<String> {
        let body = serde_json::json!({
            "subject": message.subject,
            "body": {
                "contentType": if message.body_html.is_some() { "html" } else { "text" },
                "content": message.body_html.as_deref().unwrap_or(message.body_text.as_deref().unwrap_or(""))
            },
            "toRecipients": message.to.iter().map(|to| {
                serde_json::json!({
                    "emailAddress": {
                        "address": to
                    }
                })
            }).collect::<Vec<_>>(),
            "ccRecipients": message.cc.iter().map(|cc| {
                serde_json::json!({
                    "emailAddress": {
                        "address": cc
                    }
                })
            }).collect::<Vec<_>>(),
            "bccRecipients": message.bcc.iter().map(|bcc| {
                serde_json::json!({
                    "emailAddress": {
                        "address": bcc
                    }
                })
            }).collect::<Vec<_>>()
        });
        
        let draft: GraphMessage = self.make_graph_post("me/messages", &body).await?;
        Ok(draft.id)
    }

    async fn delete_message(&self, message_id: &str) -> MailResult<()> {
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let response = self.client
            .delete(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to delete message: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn update_message_flags(&self, message_id: &str, flags: MessageFlags) -> MailResult<()> {
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "isRead": flags.is_seen,
            "flag": {
                "flagStatus": if flags.is_flagged { "flagged" } else { "notFlagged" }
            }
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to update message flags: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn get_message_content(&self, message_id: &str) -> MailResult<String> {
        let endpoint = format!("me/messages/{}", message_id);
        let graph_msg: GraphMessage = self.make_graph_request(&endpoint).await?;
        Ok(graph_msg.body.content)
    }

    async fn add_label(&self, message_id: &str, label: &str) -> MailResult<()> {
        // Outlook uses categories instead of labels
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "categories": [label]
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to add category: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn remove_label(&self, message_id: &str, _label: &str) -> MailResult<()> {
        // Remove all categories for simplicity
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "categories": []
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to remove categories: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn move_message(&self, message_id: &str, target_folder: &str) -> MailResult<()> {
        let endpoint = format!("me/messages/{}/move", message_id);
        let body = serde_json::json!({
            "destinationId": target_folder
        });
        
        let _response: serde_json::Value = self.make_graph_post(&endpoint, &body).await?;
        Ok(())
    }

    async fn copy_message(&self, message_id: &str, target_folder: &str) -> MailResult<()> {
        let endpoint = format!("me/messages/{}/copy", message_id);
        let body = serde_json::json!({
            "destinationId": target_folder
        });
        
        let _response: serde_json::Value = self.make_graph_post(&endpoint, &body).await?;
        Ok(())
    }

    async fn mark_read(&self, message_id: &str, read: bool) -> MailResult<()> {
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "isRead": read
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to mark message as read: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn mark_starred(&self, message_id: &str, starred: bool) -> MailResult<()> {
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "flag": {
                "flagStatus": if starred { "flagged" } else { "notFlagged" }
            }
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to mark message as starred: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn mark_important(&self, message_id: &str, important: bool) -> MailResult<()> {
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "importance": if important { "high" } else { "normal" }
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to mark message as important: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn add_labels(&self, message_id: &str, labels: &[String]) -> MailResult<()> {
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "categories": labels
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to add categories: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn remove_labels(&self, message_id: &str, _labels: &[String]) -> MailResult<()> {
        // For simplicity, remove all categories
        let endpoint = format!("me/messages/{}", message_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "categories": []
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to remove categories: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn bulk_operation(&self, operation: &BulkEmailOperation) -> MailResult<BulkOperationResult> {
        let mut successful_ids = Vec::new();
        let mut failed_operations = Vec::new();
        
        for message_id in &operation.message_ids {
            let message_id_str = &message_id.to_string();
            let result = match &operation.operation_type {
                BulkOperationType::MarkRead => self.mark_read(message_id_str, true).await,
                BulkOperationType::MarkUnread => self.mark_read(message_id_str, false).await,
                BulkOperationType::Archive => {
                    // Move to Archive folder - would need to get archive folder ID
                    self.move_message(message_id_str, "archive").await
                },
                BulkOperationType::Delete => self.delete_message(message_id_str).await,
                BulkOperationType::Star => self.mark_starred(message_id_str, true).await,
                BulkOperationType::Unstar => self.mark_starred(message_id_str, false).await,
                BulkOperationType::Spam => {
                    // Move to Spam folder - would need to get spam folder ID
                    self.move_message(message_id_str, "spam").await
                },
                BulkOperationType::Move => {
                    // Move to custom folder - would need folder ID from operation
                    self.move_message(message_id_str, "custom").await
                },
                BulkOperationType::AddLabel => {
                    // Outlook doesn't have labels like Gmail - could use categories
                    Ok(()) // Placeholder
                },
                BulkOperationType::RemoveLabel => {
                    // Outlook doesn't have labels like Gmail
                    Ok(()) // Placeholder
                },
            };
            
            match result {
                Ok(_) => successful_ids.push(message_id.clone()),
                Err(e) => failed_operations.push(BulkOperationError {
                    message_id: message_id.clone(),
                    error: e.to_string(),
                }),
            }
        }
        
        Ok(BulkOperationResult {
            successful: successful_ids.len() as i32,
            failed: failed_operations.len() as i32,
            errors: failed_operations,
        })
    }

    async fn search_messages(&self, query: &str) -> MailResult<Vec<MailMessage>> {
        let endpoint = format!("me/messages?$search=\"{}\"", urlencoding::encode(query));
        let response: GraphResponse<GraphMessage> = self.make_graph_request(&endpoint).await?;
        Ok(response.value.iter().map(|m| self.convert_graph_message_to_mail_message(m)).collect())
    }

    async fn get_thread(&self, thread_id: &str) -> MailResult<EmailThread> {
        // In Graph API, conversation ID is the thread ID
        let endpoint = format!("me/messages?$filter=conversationId eq '{}'", thread_id);
        let response: GraphResponse<GraphMessage> = self.make_graph_request(&endpoint).await?;
        
        let messages: Vec<EmailMessage> = response.value.iter().map(|graph_msg| {
            let from_address = graph_msg.from.as_ref()
                .map(|f| f.email_address.address.clone())
                .unwrap_or_default();
            
            let from = crate::mail::types::EmailAddress {
                address: from_address.clone(),
                email: from_address,
                name: graph_msg.from.as_ref()
                    .and_then(|f| f.email_address.name.clone()),
            };

            EmailMessage {
                id: Uuid::new_v4(),
                account_id: Uuid::new_v4(),
                provider_id: graph_msg.id.clone(),
                thread_id: Uuid::new_v4(),
                subject: graph_msg.subject.clone().unwrap_or_default(),
                body_html: if graph_msg.body.content_type == "html" { Some(graph_msg.body.content.clone()) } else { None },
                body_text: if graph_msg.body.content_type == "text" { Some(graph_msg.body.content.clone()) } else { None },
                snippet: graph_msg.body_preview.clone().unwrap_or_default(),
                from,
                to: graph_msg.to_recipients.iter()
                    .map(|r| crate::mail::types::EmailAddress {
                        address: r.email_address.address.clone(),
                        email: r.email_address.address.clone(),
                        name: r.email_address.name.clone(),
                    })
                    .collect(),
                cc: graph_msg.cc_recipients.iter()
                    .map(|r| crate::mail::types::EmailAddress {
                        address: r.email_address.address.clone(),
                        email: r.email_address.address.clone(),
                        name: r.email_address.name.clone(),
                    })
                    .collect(),
                bcc: graph_msg.bcc_recipients.iter()
                    .map(|r| crate::mail::types::EmailAddress {
                        address: r.email_address.address.clone(),
                        email: r.email_address.address.clone(),
                        name: r.email_address.name.clone(),
                    })
                    .collect(),
                reply_to: graph_msg.reply_to.iter()
                    .map(|r| crate::mail::types::EmailAddress {
                        address: r.email_address.address.clone(),
                        email: r.email_address.address.clone(),
                        name: r.email_address.name.clone(),
                    })
                    .collect(),
                date: chrono::Utc::now(),
                flags: EmailFlags {
                    is_read: graph_msg.is_read,
                    is_starred: false,
                    is_trashed: false,
                    is_spam: false,
                    is_important: false,
                    is_archived: false,
                    is_draft: graph_msg.is_draft,
                    is_sent: false,
                    has_attachments: graph_msg.has_attachments,
                },
                labels: vec![],
                folder: graph_msg.parent_folder_id.clone(),
                folder_id: Some(Uuid::new_v4()),
                importance: match graph_msg.importance.as_str() {
                    "high" => MessageImportance::High,
                    "low" => MessageImportance::Low,
                    _ => MessageImportance::Normal,
                },
                priority: MessagePriority::Normal,
                size: 0,
                attachments: vec![], // Would need separate call to get attachments
                headers: std::collections::HashMap::new(),
                message_id: graph_msg.internet_message_id.clone().unwrap_or_default(),
                message_id_header: graph_msg.internet_message_id.clone(),
                in_reply_to: None,
                references: vec![],
                encryption: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            }
        }).collect();
        
        let subject = messages.first()
            .map(|m| m.subject.clone())
            .unwrap_or_default();
        
        Ok(EmailThread {
            id: Uuid::new_v4(),
            account_id: Uuid::new_v4(),
            subject,
            message_ids: messages.iter().map(|m| m.id).collect(),
            messages: messages.clone(),
            participants: vec![], // Would need to extract from messages
            labels: vec![],
            flags: ThreadFlags {
                has_unread: messages.iter().any(|m| !m.flags.is_read),
                has_starred: messages.iter().any(|m| m.flags.is_starred),
                has_important: messages.iter().any(|m| m.flags.is_important),
                has_attachments: messages.iter().any(|m| m.flags.has_attachments),
            },
            last_message_at: messages.last()
                .map(|m| m.date)
                .unwrap_or_else(|| chrono::Utc::now()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    async fn list_thread_messages(&self, thread_id: &str) -> MailResult<Vec<EmailMessage>> {
        let thread = self.get_thread(thread_id).await?;
        Ok(thread.messages)
    }

    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
        let endpoint = format!("me/messages/{}/attachments/{}", message_id, attachment_id);
        let headers = self.get_headers().await;
        
        let response = self.client
            .get(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to get attachment: {}", response.status()),
            });
        }
        
        let attachment_data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| MailError::Http(e))?;
        
        if let Some(content_bytes) = attachment_data.get("contentBytes").and_then(|v| v.as_str()) {
            general_purpose::STANDARD.decode(content_bytes)
                .map_err(|e| MailError::EmailParsing(format!("Failed to decode attachment: {}", e)))
        } else {
            Err(MailError::EmailParsing("No contentBytes found in attachment".to_string()))
        }
    }

    async fn download_attachment(&self, message_id: &str, attachment_id: &str) -> MailResult<Vec<u8>> {
        self.get_attachment(message_id, attachment_id).await
    }

    async fn get_sync_changes(&self, since: Option<&str>) -> MailResult<SyncResult> {
        let endpoint = if let Some(delta_token) = since {
            format!("me/messages/delta?$deltatoken={}", delta_token)
        } else {
            "me/messages/delta".to_string()
        };
        
        let response: GraphResponse<GraphMessage> = self.make_graph_request(&endpoint).await?;
        
        let changes: Vec<SyncChange> = response.value.iter().map(|graph_msg| {
            let mail_msg = self.convert_graph_message_to_mail_message(graph_msg);
            SyncChange::MessageUpdated(mail_msg)
        }).collect();
        
        Ok(SyncResult {
            success: true,
            messages_synced: response.value.len(),
            errors: vec![],
            changes,
        })
    }

    async fn get_full_sync_token(&self) -> MailResult<String> {
        let response: GraphResponse<GraphMessage> = self.make_graph_request("me/messages/delta").await?;
        Ok(response.delta_link.unwrap_or_default())
    }

    async fn setup_push_notifications(&self, webhook_url: &str) -> MailResult<String> {
        let body = serde_json::json!({
            "changeType": "created,updated,deleted",
            "notificationUrl": webhook_url,
            "resource": "me/messages",
            "expirationDateTime": (chrono::Utc::now() + chrono::Duration::days(3)).to_rfc3339(),
            "clientState": Uuid::new_v4().to_string()
        });
        
        let subscription: serde_json::Value = self.make_graph_post("subscriptions", &body).await?;
        
        if let Some(id) = subscription.get("id").and_then(|v| v.as_str()) {
            Ok(id.to_string())
        } else {
            Err(MailError::ParseError("No subscription ID returned".to_string()))
        }
    }

    async fn disable_push_notifications(&self, subscription_id: &str) -> MailResult<()> {
        let endpoint = format!("subscriptions/{}", subscription_id);
        let headers = self.get_headers().await;
        
        let response = self.client
            .delete(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to disable push notifications: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn create_filter(&self, filter: &EmailFilter) -> MailResult<String> {
        // Outlook uses Inbox Rules instead of filters
        let body = serde_json::json!({
            "displayName": filter.name,
            "sequence": 1,
            "isEnabled": true,
            "conditions": {
                "subjectContains": if !filter.subject_keywords.is_empty() { 
                    Some(&filter.subject_keywords) 
                } else { None },
                "fromAddresses": if !filter.from_addresses.is_empty() { 
                    Some(filter.from_addresses.iter().map(|addr| serde_json::json!({
                        "emailAddress": { "address": addr }
                    })).collect::<Vec<_>>())
                } else { None }
            },
            "actions": {
                "moveToFolder": filter.target_folder_id.as_ref().map(|folder_id| folder_id),
                "markImportance": if filter.mark_as_important.unwrap_or(false) { 
                    Some("high") 
                } else { None }
            }
        });
        
        let rule: serde_json::Value = self.make_graph_post("me/mailFolders/inbox/messageRules", &body).await?;
        
        if let Some(id) = rule.get("id").and_then(|v| v.as_str()) {
            Ok(id.to_string())
        } else {
            Err(MailError::ParseError("No rule ID returned".to_string()))
        }
    }

    async fn update_filter(&self, filter_id: &str, filter: &EmailFilter) -> MailResult<()> {
        let endpoint = format!("me/mailFolders/inbox/messageRules/{}", filter_id);
        let headers = self.get_headers().await;
        
        let body = serde_json::json!({
            "displayName": filter.name,
            "isEnabled": filter.is_enabled,
            "conditions": {
                "subjectContains": if !filter.subject_keywords.is_empty() { 
                    Some(&filter.subject_keywords) 
                } else { None },
                "fromAddresses": if !filter.from_addresses.is_empty() { 
                    Some(filter.from_addresses.iter().map(|addr| serde_json::json!({
                        "emailAddress": { "address": addr }
                    })).collect::<Vec<_>>())
                } else { None }
            },
            "actions": {
                "moveToFolder": filter.target_folder_id.as_ref().map(|folder_id| folder_id),
                "markImportance": if filter.mark_as_important.unwrap_or(false) { 
                    Some("high") 
                } else { None }
            }
        });
        
        let response = self.client
            .patch(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to update filter: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn delete_filter(&self, filter_id: &str) -> MailResult<()> {
        let endpoint = format!("me/mailFolders/inbox/messageRules/{}", filter_id);
        let headers = self.get_headers().await;
        
        let response = self.client
            .delete(&format!("{}/{}", self.base_url, endpoint))
            .headers(headers)
            .send()
            .await
            .map_err(|e| MailError::Network { message: e.to_string() })?;

        if !response.status().is_success() {
            return Err(MailError::ProviderApi {
                provider: "Outlook".to_string(),
                code: response.status().as_str().to_string(),
                message: format!("Failed to delete filter: {}", response.status()),
            });
        }

        Ok(())
    }

    async fn list_filters(&self) -> MailResult<Vec<EmailFilter>> {
        let response: GraphResponse<serde_json::Value> = self.make_graph_request("me/mailFolders/inbox/messageRules").await?;
        
        let filters: Vec<EmailFilter> = response.value.iter().filter_map(|rule| {
            let name = rule.get("displayName")?.as_str()?.to_string();
            let id = rule.get("id")?.as_str()?.to_string();
            let is_enabled = rule.get("isEnabled")?.as_bool();
            
            let conditions = rule.get("conditions")?;
            let subject_keywords = conditions.get("subjectContains")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            
            let from_addresses = conditions.get("fromAddresses")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| {
                    v.get("emailAddress")?.get("address")?.as_str().map(String::from)
                }).collect())
                .unwrap_or_default();
            
            let actions = rule.get("actions")?;
            let target_folder_id = actions.get("moveToFolder")
                .and_then(|v| v.as_str())
                .map(String::from);
            
            let mark_as_important = actions.get("markImportance")
                .and_then(|v| v.as_str())
                .map(|importance| importance == "high");
            
            Some(EmailFilter {
                id: Uuid::new_v4(),
                account_id: Some(Uuid::new_v4()),
                user_id: Uuid::new_v4(),
                name,
                description: None,
                is_enabled: is_enabled.unwrap_or(true),
                conditions: vec![],
                actions: vec![],
                priority: 0,
                stop_processing: false,
                subject_keywords,
                from_addresses,
                to_addresses: vec![],
                has_attachment: None,
                body_keywords: vec![],
                target_folder_id: target_folder_id.map(|_| Uuid::new_v4()),
                mark_as_read: None,
                mark_as_important,
                apply_label: None,
                forward_to: None,
                delete_message: None,
                mark_as_spam: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
        }).collect();
        
        Ok(filters)
    }
}