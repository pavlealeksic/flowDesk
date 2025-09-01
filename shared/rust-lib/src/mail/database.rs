use sqlx::{SqlitePool, Row};
use crate::mail::{MailAccount, MailMessage, MailFolder, MailAttachment};
use std::path::Path;

pub struct MailDatabase {
    pool: SqlitePool,
}

impl MailDatabase {
    pub async fn new(database_path: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Create directory if it doesn't exist
        if let Some(parent) = Path::new(database_path).parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let database_url = format!("sqlite:{}", database_path);
        let pool = SqlitePool::connect(&database_url).await?;
        
        let database = Self { pool };
        database.init_schema().await?;
        
        Ok(database)
    }

    async fn init_schema(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Accounts table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                provider TEXT NOT NULL,
                display_name TEXT NOT NULL,
                is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                imap_config TEXT,
                smtp_config TEXT,
                oauth_tokens TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        "#)
        .execute(&self.pool)
        .await?;

        // Messages table with all fields
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                folder TEXT NOT NULL,
                thread_id TEXT,
                subject TEXT NOT NULL,
                from_address TEXT NOT NULL,
                from_name TEXT NOT NULL,
                to_addresses TEXT NOT NULL,
                cc_addresses TEXT NOT NULL,
                bcc_addresses TEXT NOT NULL,
                reply_to TEXT,
                body_text TEXT,
                body_html TEXT,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                is_starred BOOLEAN NOT NULL DEFAULT FALSE,
                is_important BOOLEAN NOT NULL DEFAULT FALSE,
                has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
                received_at DATETIME NOT NULL,
                sent_at DATETIME,
                labels TEXT NOT NULL DEFAULT '[]',
                message_id TEXT,
                in_reply_to TEXT,
                references TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        "#)
        .execute(&self.pool)
        .await?;

        // Create performance indexes
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages (account_id, folder)")
            .execute(&self.pool).await?;
        
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages (received_at)")
            .execute(&self.pool).await?;
            
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id)")
            .execute(&self.pool).await?;

        Ok(())
    }

    pub async fn save_account(&self, account: &MailAccount) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let imap_config = account.imap_config.as_ref()
            .map(|c| serde_json::to_string(c))
            .transpose()?;
            
        let smtp_config = account.smtp_config.as_ref()
            .map(|c| serde_json::to_string(c))
            .transpose()?;
            
        let oauth_tokens = account.oauth_tokens.as_ref()
            .map(|t| serde_json::to_string(t))
            .transpose()?;

        sqlx::query(r#"
            INSERT OR REPLACE INTO accounts (
                id, email, provider, display_name, is_enabled, 
                imap_config, smtp_config, oauth_tokens, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#)
        .bind(&account.id)
        .bind(&account.email)
        .bind(serde_json::to_string(&account.provider)?)
        .bind(&account.display_name)
        .bind(account.is_enabled)
        .bind(imap_config)
        .bind(smtp_config)
        .bind(oauth_tokens)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_message(&self, message: &MailMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO messages (
                id, account_id, folder, thread_id, subject, from_address, from_name,
                to_addresses, cc_addresses, bcc_addresses, reply_to, body_text, body_html,
                is_read, is_starred, is_important, has_attachments, received_at, sent_at,
                labels, message_id, in_reply_to, references, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#)
        .bind(&message.id)
        .bind(&message.account_id)
        .bind(&message.folder)
        .bind(&message.thread_id)
        .bind(&message.subject)
        .bind(&message.from_address)
        .bind(&message.from_name)
        .bind(serde_json::to_string(&message.to_addresses)?)
        .bind(serde_json::to_string(&message.cc_addresses)?)
        .bind(serde_json::to_string(&message.bcc_addresses)?)
        .bind(&message.reply_to)
        .bind(&message.body_text)
        .bind(&message.body_html)
        .bind(message.is_read)
        .bind(message.is_starred)
        .bind(message.is_important)
        .bind(message.has_attachments)
        .bind(message.received_at)
        .bind(message.sent_at)
        .bind(serde_json::to_string(&message.labels)?)
        .bind(&message.message_id)
        .bind(&message.in_reply_to)
        .bind(serde_json::to_string(&message.references)?)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_messages(
        &self, 
        account_id: &str, 
        folder: &str, 
        limit: Option<u32>
    ) -> Result<Vec<MailMessage>, Box<dyn std::error::Error + Send + Sync>> {
        let limit = limit.unwrap_or(50) as i64;
        
        let rows = sqlx::query(r#"
            SELECT * FROM messages 
            WHERE account_id = ? AND folder = ? 
            ORDER BY received_at DESC 
            LIMIT ?
        "#)
        .bind(account_id)
        .bind(folder)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let mut messages = Vec::new();
        for row in rows {
            let message = MailMessage {
                id: row.get("id"),
                account_id: row.get("account_id"),
                folder: row.get("folder"),
                thread_id: row.get("thread_id"),
                subject: row.get("subject"),
                from_address: row.get("from_address"),
                from_name: row.get("from_name"),
                to_addresses: serde_json::from_str(&row.get::<String, _>("to_addresses"))?,
                cc_addresses: serde_json::from_str(&row.get::<String, _>("cc_addresses"))?,
                bcc_addresses: serde_json::from_str(&row.get::<String, _>("bcc_addresses"))?,
                reply_to: row.get("reply_to"),
                body_text: row.get("body_text"),
                body_html: row.get("body_html"),
                is_read: row.get("is_read"),
                is_starred: row.get("is_starred"),
                is_important: row.get("is_important"),
                has_attachments: row.get("has_attachments"),
                received_at: row.get("received_at"),
                sent_at: row.get("sent_at"),
                attachments: vec![], // Would need separate query
                labels: serde_json::from_str(&row.get::<String, _>("labels"))?,
                message_id: row.get("message_id"),
                in_reply_to: row.get("in_reply_to"),
                references: serde_json::from_str(&row.get::<String, _>("references"))?,
            };
            messages.push(message);
        }

        Ok(messages)
    }

    pub async fn search_messages(
        &self,
        account_id: Option<&str>,
        query: &str,
    ) -> Result<Vec<MailMessage>, Box<dyn std::error::Error + Send + Sync>> {
        let rows = if let Some(account_id) = account_id {
            sqlx::query(r#"
                SELECT * FROM messages 
                WHERE account_id = ? AND (
                    subject LIKE ? OR 
                    from_address LIKE ? OR 
                    from_name LIKE ? OR
                    body_text LIKE ?
                )
                ORDER BY received_at DESC 
                LIMIT 100
            "#)
            .bind(account_id)
            .bind(format!("%{}%", query))
            .bind(format!("%{}%", query))
            .bind(format!("%{}%", query))
            .bind(format!("%{}%", query))
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query(r#"
                SELECT * FROM messages 
                WHERE subject LIKE ? OR 
                      from_address LIKE ? OR 
                      from_name LIKE ? OR
                      body_text LIKE ?
                ORDER BY received_at DESC 
                LIMIT 100
            "#)
            .bind(format!("%{}%", query))
            .bind(format!("%{}%", query))
            .bind(format!("%{}%", query))
            .bind(format!("%{}%", query))
            .fetch_all(&self.pool)
            .await?
        };

        let mut messages = Vec::new();
        for row in rows {
            let message = MailMessage {
                id: row.get("id"),
                account_id: row.get("account_id"),
                folder: row.get("folder"),
                thread_id: row.get("thread_id"),
                subject: row.get("subject"),
                from_address: row.get("from_address"),
                from_name: row.get("from_name"),
                to_addresses: serde_json::from_str(&row.get::<String, _>("to_addresses"))?,
                cc_addresses: serde_json::from_str(&row.get::<String, _>("cc_addresses"))?,
                bcc_addresses: serde_json::from_str(&row.get::<String, _>("bcc_addresses"))?,
                reply_to: row.get("reply_to"),
                body_text: row.get("body_text"),
                body_html: row.get("body_html"),
                is_read: row.get("is_read"),
                is_starred: row.get("is_starred"),
                is_important: row.get("is_important"),
                has_attachments: row.get("has_attachments"),
                received_at: row.get("received_at"),
                sent_at: row.get("sent_at"),
                attachments: vec![],
                labels: serde_json::from_str(&row.get::<String, _>("labels"))?,
                message_id: row.get("message_id"),
                in_reply_to: row.get("in_reply_to"),
                references: serde_json::from_str(&row.get::<String, _>("references"))?,
            };
            messages.push(message);
        }

        Ok(messages)
    }

    pub async fn mark_message_read(&self, message_id: &str, is_read: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query("UPDATE messages SET is_read = ? WHERE id = ?")
            .bind(is_read)
            .bind(message_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn star_message(&self, message_id: &str, is_starred: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query("UPDATE messages SET is_starred = ? WHERE id = ?")
            .bind(is_starred)
            .bind(message_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(message_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}