//! Database layer for mail storage using SQLx

use crate::mail::{error::MailResult, types::*};
use sqlx::{sqlite::SqlitePool, Row};
use uuid::Uuid;

/// Mail database for local caching and offline support
pub struct MailDatabase {
    pool: SqlitePool,
}

impl MailDatabase {
    /// Create new mail database
    pub async fn new(database_path: &str) -> MailResult<Self> {
        let database_url = format!("sqlite:{}", database_path);
        let pool = SqlitePool::connect(&database_url).await?;
        
        let db = Self { pool };
        db.run_migrations().await?;
        
        Ok(db)
    }

    /// Run database migrations
    async fn run_migrations(&self) -> MailResult<()> {
        // Account table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                provider TEXT NOT NULL,
                status TEXT NOT NULL,
                last_sync_at INTEGER,
                next_sync_at INTEGER,
                sync_interval_minutes INTEGER NOT NULL,
                is_enabled BOOLEAN NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                provider_config TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Messages table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                thread_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_html TEXT,
                body_text TEXT,
                snippet TEXT NOT NULL,
                message_from TEXT NOT NULL,
                message_to TEXT NOT NULL,
                message_cc TEXT NOT NULL,
                message_bcc TEXT NOT NULL,
                reply_to TEXT NOT NULL,
                date INTEGER NOT NULL,
                flags TEXT NOT NULL,
                labels TEXT NOT NULL,
                folder TEXT NOT NULL,
                importance TEXT NOT NULL,
                priority TEXT NOT NULL,
                size INTEGER NOT NULL,
                attachments TEXT NOT NULL,
                headers TEXT NOT NULL,
                message_id TEXT NOT NULL,
                in_reply_to TEXT,
                references TEXT NOT NULL,
                encryption TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Folders table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                folder_type TEXT NOT NULL,
                parent_id TEXT,
                path TEXT NOT NULL,
                attributes TEXT NOT NULL,
                message_count INTEGER NOT NULL,
                unread_count INTEGER NOT NULL,
                is_selectable BOOLEAN NOT NULL,
                sync_status TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Threads table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                message_ids TEXT NOT NULL,
                participants TEXT NOT NULL,
                labels TEXT NOT NULL,
                flags TEXT NOT NULL,
                last_message_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create indexes
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages (account_id)")
            .execute(&self.pool)
            .await?;
        
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON messages (provider_id)")
            .execute(&self.pool)
            .await?;
        
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id)")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // Account operations
    pub async fn store_account(&self, account: &MailAccount) -> MailResult<()> {
        let provider_config_json = serde_json::to_string(&account.provider_config)?;
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO accounts 
            (id, user_id, name, email, provider, status, last_sync_at, next_sync_at, 
             sync_interval_minutes, is_enabled, created_at, updated_at, provider_config)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(account.id.to_string())
        .bind(account.user_id.to_string())
        .bind(&account.name)
        .bind(&account.email)
        .bind(account.provider.as_str())
        .bind(format!("{:?}", account.status))
        .bind(account.last_sync_at.map(|dt| dt.timestamp()))
        .bind(account.next_sync_at.map(|dt| dt.timestamp()))
        .bind(account.sync_interval_minutes)
        .bind(account.is_enabled)
        .bind(account.created_at.timestamp())
        .bind(account.updated_at.timestamp())
        .bind(provider_config_json)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_account(&self, account_id: Uuid) -> MailResult<Option<MailAccount>> {
        let row = sqlx::query("SELECT * FROM accounts WHERE id = ?")
            .bind(account_id.to_string())
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            Ok(Some(self.row_to_account(row)?))
        } else {
            Ok(None)
        }
    }

    pub async fn list_accounts(&self) -> MailResult<Vec<MailAccount>> {
        let rows = sqlx::query("SELECT * FROM accounts ORDER BY created_at")
            .fetch_all(&self.pool)
            .await?;

        let mut accounts = Vec::new();
        for row in rows {
            accounts.push(self.row_to_account(row)?);
        }

        Ok(accounts)
    }

    pub async fn update_account(&self, account: &MailAccount) -> MailResult<()> {
        self.store_account(account).await
    }

    pub async fn remove_account(&self, account_id: Uuid) -> MailResult<()> {
        // Remove related data first
        sqlx::query("DELETE FROM messages WHERE account_id = ?")
            .bind(account_id.to_string())
            .execute(&self.pool)
            .await?;

        sqlx::query("DELETE FROM folders WHERE account_id = ?")
            .bind(account_id.to_string())
            .execute(&self.pool)
            .await?;

        sqlx::query("DELETE FROM threads WHERE account_id = ?")
            .bind(account_id.to_string())
            .execute(&self.pool)
            .await?;

        // Remove account
        sqlx::query("DELETE FROM accounts WHERE id = ?")
            .bind(account_id.to_string())
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // Message operations (simplified implementations)
    pub async fn store_message(&self, message: &EmailMessage) -> MailResult<()> {
        // Implementation would serialize message fields and store in database
        // For brevity, returning a placeholder
        Ok(())
    }

    pub async fn get_message(&self, message_id: Uuid) -> MailResult<Option<EmailMessage>> {
        // Implementation would deserialize message from database
        Ok(None)
    }

    pub async fn get_message_by_provider_id(&self, provider_id: &str) -> MailResult<Option<EmailMessage>> {
        // Implementation would query by provider_id
        Ok(None)
    }

    pub async fn update_message(&self, message: &EmailMessage) -> MailResult<()> {
        self.store_message(message).await
    }

    pub async fn delete_message(&self, message_id: Uuid) -> MailResult<()> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(message_id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_messages(
        &self,
        account_id: Uuid,
        folder_id: Option<Uuid>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> MailResult<Vec<EmailMessage>> {
        // Implementation would build query with filters and return messages
        Ok(vec![])
    }

    // Folder operations (simplified)
    pub async fn store_folder(&self, folder: &MailFolder) -> MailResult<()> {
        // Implementation would serialize folder and store
        Ok(())
    }

    pub async fn update_folder(&self, folder: &MailFolder) -> MailResult<()> {
        self.store_folder(folder).await
    }

    pub async fn delete_folder(&self, folder_id: Uuid) -> MailResult<()> {
        sqlx::query("DELETE FROM folders WHERE id = ?")
            .bind(folder_id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_folders(&self, account_id: Uuid) -> MailResult<Vec<MailFolder>> {
        // Implementation would deserialize folders from database
        Ok(vec![])
    }

    // Thread operations (simplified)
    pub async fn get_threads(
        &self,
        account_id: Uuid,
        folder_id: Option<Uuid>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> MailResult<Vec<EmailThread>> {
        // Implementation would query threads with filters
        Ok(vec![])
    }

    // Search operations
    pub async fn search_messages(&self, query: &str, limit: Option<u32>) -> MailResult<EmailSearchResult> {
        // Implementation would use FTS or LIKE queries
        Ok(EmailSearchResult {
            query: query.to_string(),
            total_count: 0,
            messages: vec![],
            took: 0,
            facets: None,
            suggestions: None,
        })
    }

    // Helper methods
    fn row_to_account(&self, row: sqlx::sqlite::SqliteRow) -> MailResult<MailAccount> {
        let provider_config_json: String = row.try_get("provider_config")?;
        let provider_config: ProviderAccountConfig = serde_json::from_str(&provider_config_json)?;

        let provider = match row.try_get::<String, _>("provider")?.as_str() {
            "gmail" => MailProvider::Gmail,
            "outlook" => MailProvider::Outlook,
            "exchange" => MailProvider::Exchange,
            "imap" => MailProvider::Imap,
            "fastmail" => MailProvider::Fastmail,
            "proton" => MailProvider::Proton,
            "yahoo" => MailProvider::Yahoo,
            "aol" => MailProvider::Aol,
            _ => return Err(crate::mail::error::MailError::other("Unknown provider")),
        };

        let status = match row.try_get::<String, _>("status")?.as_str() {
            "Active" => MailAccountStatus::Active,
            "AuthError" => MailAccountStatus::AuthError,
            "QuotaExceeded" => MailAccountStatus::QuotaExceeded,
            "Suspended" => MailAccountStatus::Suspended,
            "Disabled" => MailAccountStatus::Disabled,
            "Error" => MailAccountStatus::Error,
            _ => MailAccountStatus::Error,
        };

        Ok(MailAccount {
            id: Uuid::parse_str(&row.try_get::<String, _>("id")?)?,
            user_id: Uuid::parse_str(&row.try_get::<String, _>("user_id")?)?,
            name: row.try_get("name")?,
            email: row.try_get("email")?,
            provider,
            status,
            last_sync_at: row.try_get::<Option<i64>, _>("last_sync_at")?
                .map(|ts| chrono::Utc.timestamp_opt(ts, 0).unwrap()),
            next_sync_at: row.try_get::<Option<i64>, _>("next_sync_at")?
                .map(|ts| chrono::Utc.timestamp_opt(ts, 0).unwrap()),
            sync_interval_minutes: row.try_get("sync_interval_minutes")?,
            is_enabled: row.try_get("is_enabled")?,
            created_at: chrono::Utc.timestamp_opt(row.try_get::<i64, _>("created_at")?, 0).unwrap(),
            updated_at: chrono::Utc.timestamp_opt(row.try_get::<i64, _>("updated_at")?, 0).unwrap(),
            provider_config,
        })
    }
}