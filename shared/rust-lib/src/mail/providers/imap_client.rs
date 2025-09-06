use async_trait::async_trait;
use async_imap::Session;
use async_native_tls::TlsStream;
use tokio::net::TcpStream;
use tokio_util::compat::Compat;
use crate::mail::{ImapConfig, MailMessage, MailFolder, MailFolderType, EmailAddress, EmailFlags, MessageImportance, MessagePriority};
use crate::mail::providers::traits::ImapProvider;
use std::sync::Arc;
use std::collections::HashMap;
use uuid::Uuid;
use tokio::sync::Mutex;
use mailparse::{parse_mail, MailHeaderMap};

pub struct ImapClient {
    config: ImapConfig,
    session: Arc<Mutex<Option<Session<TlsStream<Compat<TcpStream>>>>>>,
}

impl ImapClient {
    pub async fn new(config: ImapConfig) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let client = Self {
            config,
            session: Arc::new(Mutex::new(None)),
        };
        
        Ok(client)
    }

    async fn ensure_connected(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let session_guard = self.session.lock().await;
        
        if session_guard.is_some() {
            return Ok(());
        }

        // Connect to IMAP server with TLS - use async_imap Client::secure_connect if available
        // For now, simplify by removing TLS and focus on getting compilation working
        // TODO: Implement proper TLS connection
        Err(anyhow::anyhow!("IMAP connection not implemented").into())
    }
}

#[async_trait]
impl ImapProvider for ImapClient {
    async fn connect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await
    }

    async fn disconnect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut session_guard = self.session.lock().await;
        if let Some(mut session) = session_guard.take() {
            session.logout().await?;
        }
        Ok(())
    }

    async fn fetch_messages(&self, folder: &str, limit: u32) -> Result<Vec<MailMessage>, Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            session.select(folder).await?;
            
            let messages = session
                .fetch("1:*", "(UID ENVELOPE BODY.PEEK[] FLAGS)")
                .await?;

            let mut parsed_messages = Vec::new();
            
            use futures::StreamExt;
            let messages: Vec<_> = messages.take(limit as usize).collect().await;
            for message in messages.into_iter() {
                let message = message?;
                if let Some(body) = message.body() {
                    if let Ok(parsed) = parse_mail(body) {
                        let mail_message = self.parse_message_from_imap(&message, &parsed).await?;
                        parsed_messages.push(mail_message);
                    }
                }
            }
            
            return Ok(parsed_messages);
        }
        
        Ok(vec![])
    }

    async fn get_folders(&self) -> Result<Vec<MailFolder>, Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            let mailboxes = session.list(None, Some("*")).await?;
            let mut folders = Vec::new();
            
            use futures::StreamExt;
            let mailboxes: Vec<_> = mailboxes.collect().await;
            for mailbox in mailboxes.into_iter() {
                let mailbox = mailbox?;
                let folder_type = match mailbox.name().to_lowercase().as_str() {
                    "inbox" => MailFolderType::Inbox,
                    "sent" => MailFolderType::Sent,
                    "drafts" => MailFolderType::Drafts,
                    "trash" => MailFolderType::Trash,
                    "spam" | "junk" => MailFolderType::Spam,
                    _ => MailFolderType::Custom,
                };
                
                folders.push(MailFolder {
                    id: Uuid::new_v4(),
                    account_id: Uuid::new_v4(), // Would be set by the calling code
                    name: mailbox.name().to_string(),
                    display_name: mailbox.name().to_string(),
                    folder_type,
                    parent_id: None,
                    path: mailbox.name().to_string(),
                    attributes: mailbox.attributes().iter().map(|attr| format!("{:?}", attr)).collect(),
                    message_count: 0,
                    unread_count: 0,
                    is_selectable: !mailbox.attributes().contains(&async_imap::types::NameAttribute::NoSelect),
                    can_select: !mailbox.attributes().contains(&async_imap::types::NameAttribute::NoSelect),
                    sync_status: crate::mail::types::FolderSyncStatus::default(),
                });
            }
            
            return Ok(folders);
        }
        
        Ok(vec![])
    }

    async fn mark_message_read(&self, message_id: &str, is_read: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            let flag = if is_read { "\\Seen" } else { "-\\Seen" };
            let _response = session.store(message_id, &format!("+FLAGS ({})", flag)).await?;
        }
        
        Ok(())
    }

    async fn star_message(&self, message_id: &str, is_starred: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            let flag = if is_starred { "\\Flagged" } else { "-\\Flagged" };
            let _response = session.store(message_id, &format!("+FLAGS ({})", flag)).await?;
        }
        
        Ok(())
    }

    async fn delete_message(&self, message_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            {
                let _response = session.store(message_id, "+FLAGS (\\Deleted)").await?;
            } // Drop the stream here
            let _expunge_response = session.expunge().await?;
        }
        
        Ok(())
    }

    async fn get_attachment(&self, message_id: &str, attachment_id: &str) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
        // Implementation for fetching specific attachment
        Ok(vec![])
    }

    async fn send_message(&self, _message: &MailMessage) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        Err("IMAP client cannot send messages. Use SMTP client instead.".into())
    }
}

impl ImapClient {
    async fn parse_message_from_imap<'a>(
        &self,
        imap_message: &'a async_imap::types::Fetch,
        parsed_mail: &'a mailparse::ParsedMail<'_>,
    ) -> Result<MailMessage, Box<dyn std::error::Error + Send + Sync>> {
        let uid = imap_message.uid.unwrap_or(0).to_string();
        
        let subject = parsed_mail
            .headers
            .get_first_value("Subject")
            .unwrap_or_default();
            
        let from = parsed_mail
            .headers
            .get_first_value("From")
            .unwrap_or_default();
            
        let body_text = if parsed_mail.ctype.mimetype == "text/plain" {
            Some(parsed_mail.get_body()?)
        } else {
            None
        };
        
        let body_html = if parsed_mail.ctype.mimetype == "text/html" {
            Some(parsed_mail.get_body()?)
        } else {
            None
        };

        Ok(MailMessage {
            id: Uuid::new_v4(),
            account_id: Uuid::nil(), // Will be set by caller
            provider_id: uid.clone(),
            thread_id: Uuid::new_v4(),
            subject: subject.clone(),
            body_html,
            body_text,
            snippet: subject.chars().take(200).collect(),
            from: EmailAddress {
                name: None,
                address: from.clone(),
                email: from,
            },
            to: vec![],
            cc: vec![],
            bcc: vec![],
            reply_to: vec![],
            date: chrono::Utc::now(),
            flags: EmailFlags {
                is_read: imap_message.flags().any(|f| f == async_imap::types::Flag::Seen),
                is_starred: imap_message.flags().any(|f| f == async_imap::types::Flag::Flagged),
                is_trashed: false,
                is_spam: false,
                is_important: false,
                is_archived: false,
                is_draft: imap_message.flags().any(|f| f == async_imap::types::Flag::Draft),
                is_sent: false,
                has_attachments: false,
                is_replied: false,
                is_forwarded: false,
            },
            labels: vec![],
            folder: "INBOX".to_string(), // Will be set by caller
            folder_id: None,
            importance: MessageImportance::Normal,
            priority: MessagePriority::Normal,
            size: 0, // TODO: Get actual size
            attachments: vec![],
            headers: HashMap::new(),
            message_id: uid.clone(),
            message_id_header: Some(uid.clone()),
            in_reply_to: None,
            references: vec![],
            encryption: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }
}