use async_trait::async_trait;
use async_imap::{Session, Client};
use async_native_tls::TlsStream;
use tokio::net::TcpStream;
use crate::mail::{ImapConfig, MailMessage, MailFolder, FolderType};
use crate::mail::providers::traits::ImapProvider;
use std::sync::Arc;
use tokio::sync::Mutex;
use mailparse::parse_mail;

pub struct ImapClient {
    config: ImapConfig,
    session: Arc<Mutex<Option<Session<TlsStream<TcpStream>>>>>,
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
        let mut session_guard = self.session.lock().await;
        
        if session_guard.is_some() {
            return Ok(());
        }

        let tls = async_native_tls::TlsConnector::new();
        let client = async_imap::connect(
            (self.config.server.as_str(), self.config.port),
            &self.config.server,
            tls,
        ).await?;

        let session = client
            .login(&self.config.username, self.config.password.as_deref().unwrap_or(""))
            .await
            .map_err(|(e, _)| e)?;

        *session_guard = Some(session);
        Ok(())
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
            
            for message in messages.iter().take(limit as usize) {
                if let Some(body) = message.body() {
                    if let Ok(parsed) = parse_mail(body) {
                        let mail_message = self.parse_message_from_imap(message, &parsed).await?;
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
            
            for mailbox in mailboxes.iter() {
                let folder_type = match mailbox.name().to_lowercase().as_str() {
                    "inbox" => FolderType::Inbox,
                    "sent" => FolderType::Sent,
                    "drafts" => FolderType::Drafts,
                    "trash" => FolderType::Trash,
                    "spam" | "junk" => FolderType::Spam,
                    _ => FolderType::Custom(mailbox.name().to_string()),
                };
                
                folders.push(MailFolder {
                    id: mailbox.name().to_string(),
                    name: mailbox.name().to_string(),
                    path: mailbox.name().to_string(),
                    folder_type,
                    message_count: 0,
                    unread_count: 0,
                    can_select: !mailbox.attributes().contains(&async_imap::types::NameAttribute::NoSelect),
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
            session.store(message_id, &format!("+FLAGS ({})", flag)).await?;
        }
        
        Ok(())
    }

    async fn star_message(&self, message_id: &str, is_starred: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            let flag = if is_starred { "\\Flagged" } else { "-\\Flagged" };
            session.store(message_id, &format!("+FLAGS ({})", flag)).await?;
        }
        
        Ok(())
    }

    async fn delete_message(&self, message_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.ensure_connected().await?;
        let mut session_guard = self.session.lock().await;
        
        if let Some(session) = session_guard.as_mut() {
            session.store(message_id, "+FLAGS (\\Deleted)").await?;
            session.expunge().await?;
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
    async fn parse_message_from_imap(
        &self,
        imap_message: &async_imap::types::Fetch,
        parsed_mail: &mailparse::ParsedMail,
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
            id: uid.clone(),
            account_id: "".to_string(), // Will be set by caller
            folder: "INBOX".to_string(), // Will be set by caller
            thread_id: None,
            subject,
            from_address: from.clone(),
            from_name: from,
            to_addresses: vec![],
            cc_addresses: vec![],
            bcc_addresses: vec![],
            reply_to: None,
            body_text,
            body_html,
            is_read: imap_message.flags().iter().any(|f| f == &async_imap::types::Flag::Seen),
            is_starred: imap_message.flags().iter().any(|f| f == &async_imap::types::Flag::Flagged),
            is_important: false,
            has_attachments: false,
            received_at: chrono::Utc::now(),
            sent_at: None,
            attachments: vec![],
            labels: vec![],
            message_id: None,
            in_reply_to: None,
            references: vec![],
        })
    }
}