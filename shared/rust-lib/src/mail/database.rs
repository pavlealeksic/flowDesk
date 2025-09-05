use sqlx::{SqlitePool, Row, ConnectOptions};
use crate::mail::{MailMessage, MailFolder, types::EmailThread};
use crate::mail::types::{EmailAddress, EmailFlags, MessageImportance, MessagePriority, MailFolderType, FolderSyncStatus, MailAccount};
use std::{path::Path, collections::HashMap, str::FromStr};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Clone)]
pub struct MailDatabase {
    pool: SqlitePool,
}

impl MailDatabase {
    pub async fn new(database_path: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Create directory if it doesn't exist
        if let Some(parent) = Path::new(database_path).parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let database_url = format!("sqlite:{}?mode=rwc", database_path);
        let pool = SqlitePool::connect_with(
            sqlx::sqlite::SqliteConnectOptions::from_str(&database_url)?
                .create_if_missing(true)
                .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
                .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
                .pragma("cache_size", "-64000") // 64MB cache
                .pragma("temp_store", "memory")
                .pragma("mmap_size", "268435456") // 256MB mmap
        ).await?;
        
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
                provider_id TEXT NOT NULL,
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
                headers TEXT NOT NULL DEFAULT '{}',
                size INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        "#)
        .execute(&self.pool)
        .await?;

        // Folders table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                folder_type TEXT NOT NULL,
                parent_id TEXT,
                path TEXT NOT NULL,
                attributes TEXT NOT NULL DEFAULT '[]',
                message_count INTEGER NOT NULL DEFAULT 0,
                unread_count INTEGER NOT NULL DEFAULT 0,
                is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
                can_select BOOLEAN NOT NULL DEFAULT TRUE,
                last_sync_at DATETIME,
                is_being_synced BOOLEAN NOT NULL DEFAULT FALSE,
                sync_progress REAL,
                sync_error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id),
                FOREIGN KEY (parent_id) REFERENCES folders (id)
            )
        "#)
        .execute(&self.pool)
        .await?;

        // Threads table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                message_ids TEXT NOT NULL DEFAULT '[]',
                participants TEXT NOT NULL DEFAULT '[]',
                labels TEXT NOT NULL DEFAULT '[]',
                has_unread BOOLEAN NOT NULL DEFAULT FALSE,
                has_starred BOOLEAN NOT NULL DEFAULT FALSE,
                has_important BOOLEAN NOT NULL DEFAULT FALSE,
                has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
                last_message_at DATETIME NOT NULL,
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
            
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_folders_account_path ON folders (account_id, path)")
            .execute(&self.pool).await?;
            
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_threads_account_last_message ON threads (account_id, last_message_at)")
            .execute(&self.pool).await?;
            
        // Additional indexes for search performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages (subject)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_from_address ON messages (from_address)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages (is_read)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_is_starred ON messages (is_starred)")
            .execute(&self.pool).await?;

        Ok(())
    }

    pub async fn save_account(&self, account: &MailAccount) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Serialize the provider config
        let provider_config_json = serde_json::to_string(&account.provider_config)?;

        sqlx::query(r#"
            INSERT OR REPLACE INTO accounts (
                id, user_id, name, email, provider, status, 
                last_sync_at, next_sync_at, sync_interval_minutes, is_enabled,
                provider_config, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#)
        .bind(&account.id)
        .bind(&account.user_id)
        .bind(&account.name)
        .bind(&account.email)
        .bind(serde_json::to_string(&account.provider)?)
        .bind(serde_json::to_string(&account.status)?)
        .bind(&account.last_sync_at)
        .bind(&account.next_sync_at)
        .bind(&account.sync_interval_minutes)
        .bind(account.is_enabled)
        .bind(provider_config_json)
        .bind(&account.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_message(&self, message: &MailMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO messages (
                id, account_id, provider_id, folder, thread_id, subject, from_address, from_name,
                to_addresses, cc_addresses, bcc_addresses, reply_to, body_text, body_html,
                is_read, is_starred, is_important, has_attachments, received_at, sent_at,
                labels, message_id, in_reply_to, references, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#)
        .bind(message.id.to_string())
        .bind(message.account_id.to_string())
        .bind(&message.provider_id)
        .bind(&message.folder)
        .bind(&message.thread_id)
        .bind(&message.subject)
        .bind(&message.from.address)
        .bind(&message.from.name)
        .bind(serde_json::to_string(&message.to)?)
        .bind(serde_json::to_string(&message.cc)?)
        .bind(serde_json::to_string(&message.bcc)?)
        .bind(serde_json::to_string(&message.reply_to)?)
        .bind(&message.body_text)
        .bind(&message.body_html)
        .bind(message.flags.is_read)
        .bind(message.flags.is_starred)
        .bind(message.flags.is_important)
        .bind(message.flags.has_attachments)
        .bind(message.date)
        .bind(message.date) // Using date for both received_at and sent_at
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
                provider_id: row.get("provider_id"),
                thread_id: row.get("thread_id"),
                subject: row.get("subject"),
                body_html: row.get("body_html"),
                body_text: row.get("body_text"),
                snippet: row.get("snippet"),
                from: EmailAddress {
                    name: row.get("from_name"),
                    address: row.get::<String, _>("from_address").clone(),
                    email: row.get("from_address"),
                },
                to: serde_json::from_str(&row.get::<String, _>("to_addresses"))?,
                cc: serde_json::from_str(&row.get::<String, _>("cc_addresses"))?,
                bcc: serde_json::from_str(&row.get::<String, _>("bcc_addresses"))?,
                reply_to: serde_json::from_str(&row.get::<String, _>("reply_to")).unwrap_or_default(),
                date: row.get("received_at"),
                flags: EmailFlags {
                    is_read: row.get("is_read"),
                    is_starred: row.get("is_starred"),
                    is_trashed: false, // Default
                    is_spam: false, // Default
                    is_important: row.get("is_important"),
                    is_archived: false, // Default
                    is_draft: false, // Default
                    is_sent: false, // Default
                    has_attachments: row.get("has_attachments"),
                    is_replied: false, // Default
                    is_forwarded: false, // Default
                },
                labels: serde_json::from_str(&row.get::<String, _>("labels"))?,
                folder: row.get("folder"),
                folder_id: None, // Default
                importance: MessageImportance::Normal, // Default
                priority: MessagePriority::Normal, // Default
                size: row.get::<i64, _>("size"),
                attachments: vec![], // Would need separate query for attachments table
                headers: serde_json::from_str(&row.get::<String, _>("headers")).unwrap_or_default(),
                message_id: row.get("message_id"),
                message_id_header: row.get("message_id"),
                in_reply_to: row.get("in_reply_to"),
                references: serde_json::from_str(&row.get::<String, _>("references"))?,
                encryption: None, // Default
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
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
                id: uuid::Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default(),
                account_id: uuid::Uuid::parse_str(&row.get::<String, _>("account_id")).unwrap_or_default(),
                provider_id: row.get("provider_id"),
                thread_id: uuid::Uuid::parse_str(&row.get::<String, _>("thread_id")).unwrap_or_default(),
                subject: row.get("subject"),
                body_html: row.get("body_html"),
                body_text: row.get("body_text"),
                snippet: row.get::<String, _>("subject").chars().take(100).collect(),
                from: EmailAddress {
                    name: row.get("from_name"),
                    address: row.get::<String, _>("from_address").clone(),
                    email: row.get("from_address"),
                },
                to: serde_json::from_str(&row.get::<String, _>("to_addresses"))?,
                cc: serde_json::from_str(&row.get::<String, _>("cc_addresses"))?,
                bcc: serde_json::from_str(&row.get::<String, _>("bcc_addresses"))?,
                reply_to: vec![], // Would need to parse reply_to field
                date: row.get("received_at"),
                flags: EmailFlags {
                    is_read: row.get("is_read"),
                    is_starred: row.get("is_starred"),
                    is_trashed: false,
                    is_spam: false,
                    is_important: row.get("is_important"),
                    is_archived: false,
                    is_draft: false,
                    is_sent: false,
                    has_attachments: row.get("has_attachments"),
                    is_replied: false,
                    is_forwarded: false,
                },
                labels: serde_json::from_str(&row.get::<String, _>("labels"))?,
                folder: row.get("folder"),
                folder_id: None, // Default
                importance: MessageImportance::Normal,
                priority: MessagePriority::Normal,
                size: row.get::<i64, _>("size"),
                attachments: vec![], // Would need separate query for attachments table
                headers: serde_json::from_str(&row.get::<String, _>("headers")).unwrap_or_default(),
                message_id: row.get::<String, _>("message_id").clone(),
                message_id_header: row.get("message_id"),
                in_reply_to: row.get("in_reply_to"),
                references: serde_json::from_str(&row.get::<String, _>("references"))?,
                encryption: None,
                created_at: row.get("received_at"),
                updated_at: chrono::Utc::now(),
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

    pub async fn remove_account(&self, account_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query("DELETE FROM accounts WHERE id = ?")
            .bind(account_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list_accounts(&self) -> Result<Vec<MailAccount>, Box<dyn std::error::Error + Send + Sync>> {
        let rows = sqlx::query("SELECT * FROM accounts ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;
        
        let mut accounts = Vec::new();
        for row in rows {
            // Convert row to MailAccount - simplified for now
            let account = MailAccount {
                id: uuid::Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default(),
                user_id: uuid::Uuid::new_v4(),
                name: row.get("display_name"),
                email: row.get("email"),
                provider: serde_json::from_str(&row.get::<String, _>("provider")).unwrap_or(crate::mail::types::MailProvider::Gmail),
                status: crate::mail::types::MailAccountStatus::Active,
                last_sync_at: None,
                next_sync_at: None,
                sync_interval_minutes: 15,
                is_enabled: row.get("is_enabled"),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                provider_config: crate::mail::types::ProviderAccountConfig::Gmail {
                    client_id: "".to_string(),
                    scopes: vec![],
                    enable_push_notifications: false,
                    history_id: None,
                },
                config: crate::mail::types::ProviderAccountConfig::Gmail {
                    client_id: "".to_string(),
                    scopes: vec![],
                    enable_push_notifications: false,
                    history_id: None,
                },
                sync_status: None,
                display_name: row.get::<String, _>("display_name"),
                oauth_tokens: None,
                imap_config: None,
                smtp_config: None,
            };
            accounts.push(account);
        }
        Ok(accounts)
    }

    pub async fn get_account(&self, account_id: &str) -> Result<Option<MailAccount>, Box<dyn std::error::Error + Send + Sync>> {
        let row = sqlx::query("SELECT * FROM accounts WHERE id = ?")
            .bind(account_id)
            .fetch_optional(&self.pool)
            .await?;
            
        if let Some(row) = row {
            let account = MailAccount {
                id: uuid::Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default(),
                user_id: uuid::Uuid::new_v4(),
                name: row.get("display_name"),
                email: row.get("email"),
                provider: serde_json::from_str(&row.get::<String, _>("provider")).unwrap_or(crate::mail::types::MailProvider::Gmail),
                status: crate::mail::types::MailAccountStatus::Active,
                last_sync_at: None,
                next_sync_at: None,
                sync_interval_minutes: 15,
                is_enabled: row.get("is_enabled"),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                provider_config: crate::mail::types::ProviderAccountConfig::Gmail {
                    client_id: "".to_string(),
                    scopes: vec![],
                    enable_push_notifications: false,
                    history_id: None,
                },
                config: crate::mail::types::ProviderAccountConfig::Gmail {
                    client_id: "".to_string(),
                    scopes: vec![],
                    enable_push_notifications: false,
                    history_id: None,
                },
                sync_status: None,
                display_name: row.get::<String, _>("display_name"),
                oauth_tokens: None,
                imap_config: None,
                smtp_config: None,
            };
            Ok(Some(account))
        } else {
            Ok(None)
        }
    }

    pub async fn update_account(&self, account: &MailAccount) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(r#"
            UPDATE accounts SET 
                email = ?, display_name = ?, is_enabled = ?, 
                provider = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        "#)
        .bind(&account.email)
        .bind(&account.name)
        .bind(account.is_enabled)
        .bind(serde_json::to_string(&account.provider)?)
        .bind(account.id.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_message(&self, message: &MailMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // For now, just call save_message as update
        self.save_message(message).await
    }

    pub async fn get_message(&self, message_id: uuid::Uuid) -> Result<Option<MailMessage>, Box<dyn std::error::Error + Send + Sync>> {
        let row = sqlx::query("SELECT * FROM messages WHERE id = ?")
            .bind(message_id.to_string())
            .fetch_optional(&self.pool)
            .await?;
            
        if let Some(row) = row {
            let message = MailMessage {
                id: uuid::Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default(),
                account_id: uuid::Uuid::parse_str(&row.get::<String, _>("account_id")).unwrap_or_default(),
                provider_id: row.get("provider_id"),
                thread_id: uuid::Uuid::parse_str(&row.get::<String, _>("thread_id")).unwrap_or_default(),
                subject: row.get("subject"),
                body_html: row.get("body_html"),
                body_text: row.get("body_text"),
                snippet: row.get::<String, _>("subject").chars().take(100).collect(),
                from: EmailAddress {
                    name: row.get("from_name"),
                    address: row.get::<String, _>("from_address").clone(),
                    email: row.get("from_address"),
                },
                to: serde_json::from_str(&row.get::<String, _>("to_addresses"))?,
                cc: serde_json::from_str(&row.get::<String, _>("cc_addresses"))?,
                bcc: serde_json::from_str(&row.get::<String, _>("bcc_addresses"))?,
                reply_to: vec![],
                date: row.get("received_at"),
                flags: EmailFlags {
                    is_read: row.get("is_read"),
                    is_starred: row.get("is_starred"),
                    is_trashed: false,
                    is_spam: false,
                    is_important: row.get("is_important"),
                    is_archived: false,
                    is_draft: false,
                    is_sent: false,
                    has_attachments: row.get("has_attachments"),
                    is_replied: false,
                    is_forwarded: false,
                },
                labels: serde_json::from_str(&row.get::<String, _>("labels"))?,
                folder: row.get("folder"),
                folder_id: None, // Default
                importance: MessageImportance::Normal,
                priority: MessagePriority::Normal,
                size: row.get::<i64, _>("size"),
                attachments: vec![], // Would need separate query for attachments table
                headers: serde_json::from_str(&row.get::<String, _>("headers")).unwrap_or_default(),
                message_id: row.get::<String, _>("message_id").clone(),
                message_id_header: row.get("message_id"),
                in_reply_to: row.get("in_reply_to"),
                references: serde_json::from_str(&row.get::<String, _>("references"))?,
                encryption: None,
                created_at: row.get("received_at"),
                updated_at: chrono::Utc::now(),
            };
            Ok(Some(message))
        } else {
            Ok(None)
        }
    }

    pub async fn get_message_by_provider_id(&self, provider_id: &str) -> Result<Option<MailMessage>, Box<dyn std::error::Error + Send + Sync>> {
        let row = sqlx::query("SELECT * FROM messages WHERE provider_id = ?")
            .bind(provider_id)
            .fetch_optional(&self.pool)
            .await?;
            
        if let Some(row) = row {
            // Same conversion as get_message
            Ok(Some(MailMessage {
                id: uuid::Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default(),
                account_id: uuid::Uuid::parse_str(&row.get::<String, _>("account_id")).unwrap_or_default(),
                provider_id: row.get("provider_id"),
                thread_id: uuid::Uuid::parse_str(&row.get::<String, _>("thread_id")).unwrap_or_default(),
                subject: row.get("subject"),
                body_html: row.get("body_html"),
                body_text: row.get("body_text"),
                snippet: row.get::<String, _>("subject").chars().take(100).collect(),
                from: EmailAddress {
                    name: row.get("from_name"),
                    address: row.get::<String, _>("from_address").clone(),
                    email: row.get("from_address"),
                },
                to: serde_json::from_str(&row.get::<String, _>("to_addresses"))?,
                cc: serde_json::from_str(&row.get::<String, _>("cc_addresses"))?,
                bcc: serde_json::from_str(&row.get::<String, _>("bcc_addresses"))?,
                reply_to: vec![],
                date: row.get("received_at"),
                flags: EmailFlags {
                    is_read: row.get("is_read"),
                    is_starred: row.get("is_starred"),
                    is_trashed: false,
                    is_spam: false,
                    is_important: row.get("is_important"),
                    is_archived: false,
                    is_draft: false,
                    is_sent: false,
                    has_attachments: row.get("has_attachments"),
                    is_replied: false,
                    is_forwarded: false,
                },
                labels: serde_json::from_str(&row.get::<String, _>("labels"))?,
                folder: row.get("folder"),
                folder_id: None, // Default
                importance: MessageImportance::Normal,
                priority: MessagePriority::Normal,
                size: row.get::<i64, _>("size"),
                attachments: vec![], // Would need separate query for attachments table
                headers: serde_json::from_str(&row.get::<String, _>("headers")).unwrap_or_default(),
                message_id: row.get::<String, _>("message_id").clone(),
                message_id_header: row.get("message_id"),
                in_reply_to: row.get("in_reply_to"),
                references: serde_json::from_str(&row.get::<String, _>("references"))?,
                encryption: None,
                created_at: row.get("received_at"),
                updated_at: chrono::Utc::now(),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn store_folder(&self, folder: &MailFolder) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO folders (
                id, account_id, name, display_name, folder_type, parent_id, path,
                attributes, message_count, unread_count, is_selectable, can_select,
                last_sync_at, is_being_synced, sync_progress, sync_error, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#)
        .bind(folder.id.to_string())
        .bind(folder.account_id.to_string())
        .bind(&folder.name)
        .bind(&folder.display_name)
        .bind(serde_json::to_string(&folder.folder_type)?)
        .bind(folder.parent_id.map(|id| id.to_string()))
        .bind(&folder.path)
        .bind(serde_json::to_string(&folder.attributes)?)
        .bind(folder.message_count)
        .bind(folder.unread_count)
        .bind(folder.is_selectable)
        .bind(folder.can_select)
        .bind(folder.sync_status.last_sync_at)
        .bind(folder.sync_status.is_being_synced)
        .bind(folder.sync_status.sync_progress)
        .bind(folder.sync_status.sync_error.as_ref())
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    pub async fn update_folder(&self, folder: &MailFolder) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(r#"
            UPDATE folders SET
                name = ?, display_name = ?, folder_type = ?, parent_id = ?, path = ?,
                attributes = ?, message_count = ?, unread_count = ?, is_selectable = ?,
                can_select = ?, last_sync_at = ?, is_being_synced = ?, sync_progress = ?, sync_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        "#)
        .bind(&folder.name)
        .bind(&folder.display_name)
        .bind(serde_json::to_string(&folder.folder_type)?)
        .bind(folder.parent_id.map(|id| id.to_string()))
        .bind(&folder.path)
        .bind(serde_json::to_string(&folder.attributes)?)
        .bind(folder.message_count)
        .bind(folder.unread_count)
        .bind(folder.is_selectable)
        .bind(folder.can_select)
        .bind(folder.sync_status.last_sync_at)
        .bind(folder.sync_status.is_being_synced)
        .bind(folder.sync_status.sync_progress)
        .bind(folder.sync_status.sync_error.as_ref())
        .bind(folder.id.to_string())
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    pub async fn delete_folder(&self, folder_id: uuid::Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // First delete all messages in this folder
        sqlx::query("DELETE FROM messages WHERE folder IN (SELECT path FROM folders WHERE id = ?)")
            .bind(folder_id.to_string())
            .execute(&self.pool)
            .await?;
            
        // Then delete the folder itself
        sqlx::query("DELETE FROM folders WHERE id = ?")
            .bind(folder_id.to_string())
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }

    pub async fn get_folders(&self, account_id: &str) -> Result<Vec<MailFolder>, Box<dyn std::error::Error + Send + Sync>> {
        let rows = sqlx::query("SELECT * FROM folders WHERE account_id = ? ORDER BY name ASC")
            .bind(account_id)
            .fetch_all(&self.pool)
            .await?;
        
        let mut folders = Vec::new();
        for row in rows {
            let folder = MailFolder {
                id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default(),
                account_id: Uuid::parse_str(&row.get::<String, _>("account_id")).unwrap_or_default(),
                name: row.get("name"),
                display_name: row.get("display_name"),
                folder_type: serde_json::from_str(&row.get::<String, _>("folder_type")).unwrap_or(MailFolderType::Custom),
                parent_id: row.get::<Option<String>, _>("parent_id")
                    .and_then(|id| Uuid::parse_str(&id).ok()),
                path: row.get("path"),
                attributes: serde_json::from_str(&row.get::<String, _>("attributes")).unwrap_or_default(),
                message_count: row.get("message_count"),
                unread_count: row.get("unread_count"),
                is_selectable: row.get("is_selectable"),
                can_select: row.get("can_select"),
                sync_status: FolderSyncStatus {
                    last_sync_at: row.get("last_sync_at"),
                    is_being_synced: row.get("is_being_synced"),
                    sync_progress: row.get("sync_progress"),
                    sync_error: row.get("sync_error"),
                },
            };
            folders.push(folder);
        }
        
        Ok(folders)
    }

    pub async fn get_threads(&self, account_id: &str, folder: Option<&str>) -> Result<Vec<EmailThread>, Box<dyn std::error::Error + Send + Sync>> {
        let mut query_str = "SELECT * FROM threads WHERE account_id = ?".to_string();
        let mut params: Vec<String> = vec![account_id.to_string()];
        
        if let Some(folder_name) = folder {
            // Find threads that have messages in the specified folder
            query_str = r#"
                SELECT DISTINCT t.* FROM threads t
                JOIN messages m ON m.thread_id = t.id
                WHERE t.account_id = ? AND m.folder = ?
            "#.to_string();
            params.push(folder_name.to_string());
        }
        
        query_str.push_str(" ORDER BY last_message_at DESC LIMIT 100");
        
        let rows = if folder.is_some() {
            sqlx::query(&query_str)
                .bind(&params[0])
                .bind(&params[1])
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query(&query_str)
                .bind(&params[0])
                .fetch_all(&self.pool)
                .await?
        };
        
        let mut threads = Vec::new();
        for row in rows {
            let thread_id = Uuid::parse_str(&row.get::<String, _>("id")).unwrap_or_default();
            let message_ids: Vec<Uuid> = serde_json::from_str(&row.get::<String, _>("message_ids"))
                .unwrap_or_default();
            
            // Get actual messages for this thread
            let mut messages = Vec::new();
            for msg_id in &message_ids {
                if let Some(message) = self.get_message(*msg_id).await? {
                    // Convert MailMessage to EmailMessage - simplified mapping
                    let email_message = crate::mail::types::EmailMessage {
                        id: message.id,
                        account_id: message.account_id,
                        provider_id: message.provider_id,
                        thread_id: message.thread_id,
                        subject: message.subject,
                        body_html: message.body_html,
                        body_text: message.body_text,
                        snippet: message.snippet,
                        from: message.from,
                        to: message.to,
                        cc: message.cc,
                        bcc: message.bcc,
                        reply_to: message.reply_to,
                        date: message.date,
                        flags: message.flags,
                        labels: message.labels,
                        folder: message.folder,
                        folder_id: message.folder_id,
                        importance: message.importance,
                        priority: message.priority,
                        size: message.size,
                        attachments: message.attachments,
                        headers: message.headers,
                        message_id: message.message_id,
                        message_id_header: message.message_id_header,
                        in_reply_to: message.in_reply_to,
                        references: message.references,
                        encryption: message.encryption,
                        created_at: message.created_at,
                        updated_at: message.updated_at,
                    };
                    messages.push(email_message);
                }
            }
            
            let thread = EmailThread {
                id: thread_id,
                account_id: Uuid::parse_str(&row.get::<String, _>("account_id")).unwrap_or_default(),
                subject: row.get("subject"),
                message_ids,
                messages,
                participants: serde_json::from_str(&row.get::<String, _>("participants")).unwrap_or_default(),
                labels: serde_json::from_str(&row.get::<String, _>("labels")).unwrap_or_default(),
                flags: crate::mail::types::ThreadFlags {
                    has_unread: row.get("has_unread"),
                    has_starred: row.get("has_starred"),
                    has_important: row.get("has_important"),
                    has_attachments: row.get("has_attachments"),
                },
                last_message_at: row.get("last_message_at"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            threads.push(thread);
        }
        
        Ok(threads)
    }

    /// Store a thread in the database
    pub async fn store_thread(&self, thread: &EmailThread) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO threads (
                id, account_id, subject, message_ids, participants, labels,
                has_unread, has_starred, has_important, has_attachments,
                last_message_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#)
        .bind(thread.id.to_string())
        .bind(thread.account_id.to_string())
        .bind(&thread.subject)
        .bind(serde_json::to_string(&thread.message_ids)?)
        .bind(serde_json::to_string(&thread.participants)?)
        .bind(serde_json::to_string(&thread.labels)?)
        .bind(thread.flags.has_unread)
        .bind(thread.flags.has_starred)
        .bind(thread.flags.has_important)
        .bind(thread.flags.has_attachments)
        .bind(thread.last_message_at)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    /// Update thread flags when messages change
    pub async fn update_thread_flags(&self, thread_id: Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Calculate thread flags based on messages in the thread
        let row = sqlx::query(r#"
            SELECT 
                COUNT(CASE WHEN is_read = 0 THEN 1 END) > 0 as has_unread,
                COUNT(CASE WHEN is_starred = 1 THEN 1 END) > 0 as has_starred,
                COUNT(CASE WHEN is_important = 1 THEN 1 END) > 0 as has_important,
                COUNT(CASE WHEN has_attachments = 1 THEN 1 END) > 0 as has_attachments,
                MAX(received_at) as last_message_at
            FROM messages WHERE thread_id = ?
        "#)
        .bind(thread_id.to_string())
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some(row) = row {
            sqlx::query(r#"
                UPDATE threads SET
                    has_unread = ?, has_starred = ?, has_important = ?, has_attachments = ?,
                    last_message_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            "#)
            .bind(row.get::<bool, _>("has_unread"))
            .bind(row.get::<bool, _>("has_starred"))
            .bind(row.get::<bool, _>("has_important"))
            .bind(row.get::<bool, _>("has_attachments"))
            .bind(row.get::<DateTime<Utc>, _>("last_message_at"))
            .bind(thread_id.to_string())
            .execute(&self.pool)
            .await?;
        }
        
        Ok(())
    }
}