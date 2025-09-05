use async_trait::async_trait;
use lettre::{
    SmtpTransport, Transport, Message,
    transport::smtp::{
        authentication::Credentials,
        client::{Tls, TlsParameters}
    },
    message::{header::ContentType, MultiPart, SinglePart, Mailbox}
};
use crate::mail::{SmtpConfig, MailMessage};
use crate::mail::providers::traits::SmtpProvider;
use std::sync::Arc;

pub struct SmtpClient {
    config: SmtpConfig,
    transport: Arc<SmtpTransport>,
}

impl SmtpClient {
    pub async fn new(config: SmtpConfig) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let mut transport_builder = SmtpTransport::relay(&config.server)?;
        
        if config.use_tls {
            let tls_parameters = TlsParameters::new(config.server.clone())?;
            transport_builder = transport_builder.tls(Tls::Required(tls_parameters));
        }
        
        if let Some(password) = &config.password {
            let credentials = Credentials::new(config.username.clone(), password.clone());
            transport_builder = transport_builder.credentials(credentials);
        }
        
        let transport = transport_builder
            .port(config.port)
            .build();

        Ok(Self {
            config,
            transport: Arc::new(transport),
        })
    }
}

#[async_trait]
impl SmtpProvider for SmtpClient {
    async fn send_message(&self, message: &MailMessage) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let from_address: Mailbox = message.from.address.parse()?;
        
        let mut email_builder = Message::builder()
            .from(from_address)
            .subject(&message.subject);

        // Add recipients
        for to_addr in &message.to {
            let addr: Mailbox = to_addr.address.parse()?;
            email_builder = email_builder.to(addr);
        }
        
        for cc_addr in &message.cc {
            let addr: Mailbox = cc_addr.address.parse()?;
            email_builder = email_builder.cc(addr);
        }

        // Build message body
        let email = if message.attachments.is_empty() {
            // Simple message without attachments
            if let Some(html_body) = &message.body_html {
                if let Some(text_body) = &message.body_text {
                    // Both HTML and text
                    email_builder.multipart(
                        MultiPart::alternative()
                            .singlepart(
                                SinglePart::builder()
                                    .header(ContentType::TEXT_PLAIN)
                                    .body(text_body.clone())
                            )
                            .singlepart(
                                SinglePart::builder()
                                    .header(ContentType::TEXT_HTML)
                                    .body(html_body.clone())
                            )
                    )?
                } else {
                    // HTML only
                    email_builder.header(ContentType::TEXT_HTML).body(html_body.clone())?
                }
            } else if let Some(text_body) = &message.body_text {
                // Text only
                email_builder.body(text_body.clone())?
            } else {
                return Err("No message body provided".into());
            }
        } else {
            // Message with attachments
            let multipart = if let Some(html_body) = &message.body_html {
                if let Some(text_body) = &message.body_text {
                    let alternative = MultiPart::alternative()
                        .singlepart(SinglePart::plain(text_body.clone()))
                        .singlepart(SinglePart::html(html_body.clone()));
                    MultiPart::mixed().multipart(alternative)
                } else {
                    MultiPart::mixed().singlepart(SinglePart::html(html_body.clone()))
                }
            } else if let Some(text_body) = &message.body_text {
                MultiPart::mixed().singlepart(SinglePart::plain(text_body.clone()))
            } else {
                // Empty message case - add an empty text part
                MultiPart::mixed().singlepart(SinglePart::plain("".to_string()))
            };
            
            // Add attachments (placeholder - would need actual file content)
            let multipart = message.attachments.iter().fold(multipart, |mp, attachment| {
                let content_type: ContentType = attachment.content_type.parse()
                    .unwrap_or(ContentType::parse("application/octet-stream").unwrap());
                
                // Create attachment using base64 encoded content
                let attachment_part = SinglePart::builder()
                    .header(content_type)
                    .header(lettre::message::header::ContentDisposition::attachment(&attachment.filename))
                    .body(vec![]); // Would need actual attachment content here
                    
                mp.singlepart(attachment_part)
            });
            
            email_builder.multipart(multipart)?
        };

        // Send the email
        match self.transport.send(&email) {
            Ok(response) => Ok(format!("Message sent successfully: {:?}", response)),
            Err(e) => Err(Box::new(e)),
        }
    }

    async fn verify_connection(&self) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        // Test connection by attempting to authenticate
        match self.transport.test_connection() {
            Ok(is_connected) => Ok(is_connected),
            Err(e) => Err(Box::new(e)),
        }
    }
}