/*!
 * Database Migration System
 * 
 * Handles database schema migrations for all Flow Desk databases
 */

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use sqlx::{SqlitePool, Row};
use std::collections::HashMap;

/// Migration definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub id: String,
    pub description: String,
    pub version: u32,
    pub sql: String,
    pub rollback: Option<String>,
    pub database: String, // "mail", "calendar", etc.
}

/// Migration status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub id: String,
    pub applied: bool,
    pub applied_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Migration manager for Flow Desk databases
pub struct MigrationManager {
    pub mail_pool: Option<SqlitePool>,
    pub calendar_pool: Option<SqlitePool>,
}

impl MigrationManager {
    /// Create new migration manager
    pub fn new() -> Self {
        Self {
            mail_pool: None,
            calendar_pool: None,
        }
    }

    /// Connect to databases
    pub async fn connect(&mut self, mail_db_path: &str, calendar_db_path: &str) -> Result<(), sqlx::Error> {
        // Connect to mail database
        let mail_url = format!("sqlite:{}", mail_db_path);
        self.mail_pool = Some(SqlitePool::connect(&mail_url).await?);

        // Connect to calendar database
        let calendar_url = format!("sqlite:{}", calendar_db_path);
        self.calendar_pool = Some(SqlitePool::connect(&calendar_url).await?);

        Ok(())
    }

    /// Get all mail database migrations
    pub fn get_mail_migrations() -> Vec<Migration> {
        vec![
            Migration {
                id: "001_initial_mail_schema".to_string(),
                description: "Create initial mail database schema".to_string(),
                version: 1,
                database: "mail".to_string(),
                sql: r#"
                    -- Mail accounts table
                    CREATE TABLE IF NOT EXISTS accounts (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        status TEXT NOT NULL,
                        is_enabled BOOLEAN NOT NULL DEFAULT 1,
                        provider_config TEXT NOT NULL,
                        last_sync_at DATETIME,
                        next_sync_at DATETIME,
                        sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    -- Mail messages table
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
                        is_read BOOLEAN NOT NULL DEFAULT 0,
                        is_starred BOOLEAN NOT NULL DEFAULT 0,
                        is_important BOOLEAN NOT NULL DEFAULT 0,
                        has_attachments BOOLEAN NOT NULL DEFAULT 0,
                        received_at DATETIME NOT NULL,
                        sent_at DATETIME,
                        labels TEXT NOT NULL DEFAULT '[]',
                        message_id TEXT,
                        in_reply_to TEXT,
                        references TEXT NOT NULL DEFAULT '[]',
                        headers TEXT NOT NULL DEFAULT '{}',
                        size INTEGER NOT NULL DEFAULT 0,
                        snippet TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
                    );

                    -- Mail folders table
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
                        is_selectable BOOLEAN NOT NULL DEFAULT 1,
                        can_select BOOLEAN NOT NULL DEFAULT 1,
                        last_sync_at DATETIME,
                        is_being_synced BOOLEAN NOT NULL DEFAULT 0,
                        sync_progress REAL,
                        sync_error TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
                    );

                    -- Mail threads table
                    CREATE TABLE IF NOT EXISTS threads (
                        id TEXT PRIMARY KEY,
                        account_id TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        message_ids TEXT NOT NULL DEFAULT '[]',
                        participants TEXT NOT NULL DEFAULT '[]',
                        labels TEXT NOT NULL DEFAULT '[]',
                        has_unread BOOLEAN NOT NULL DEFAULT 0,
                        has_starred BOOLEAN NOT NULL DEFAULT 0,
                        has_important BOOLEAN NOT NULL DEFAULT 0,
                        has_attachments BOOLEAN NOT NULL DEFAULT 0,
                        last_message_at DATETIME NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
                    );

                    -- Create indexes
                    CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages (account_id, folder);
                    CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages (received_at);
                    CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id);
                    CREATE INDEX IF NOT EXISTS idx_folders_account_path ON folders (account_id, path);
                    CREATE INDEX IF NOT EXISTS idx_threads_account_last_message ON threads (account_id, last_message_at);
                    CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages (subject);
                    CREATE INDEX IF NOT EXISTS idx_messages_from_address ON messages (from_address);
                    CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages (is_read);
                    CREATE INDEX IF NOT EXISTS idx_messages_is_starred ON messages (is_starred);
                "#.to_string(),
                rollback: Some(r#"
                    DROP INDEX IF EXISTS idx_messages_is_starred;
                    DROP INDEX IF EXISTS idx_messages_is_read;
                    DROP INDEX IF EXISTS idx_messages_from_address;
                    DROP INDEX IF EXISTS idx_messages_subject;
                    DROP INDEX IF EXISTS idx_threads_account_last_message;
                    DROP INDEX IF EXISTS idx_folders_account_path;
                    DROP INDEX IF EXISTS idx_messages_thread_id;
                    DROP INDEX IF EXISTS idx_messages_received_at;
                    DROP INDEX IF EXISTS idx_messages_account_folder;
                    DROP TABLE IF EXISTS threads;
                    DROP TABLE IF EXISTS messages;
                    DROP TABLE IF EXISTS folders;
                    DROP TABLE IF EXISTS accounts;
                "#.to_string()),
            },
            Migration {
                id: "002_add_attachments_table".to_string(),
                description: "Add attachment tracking table".to_string(),
                version: 2,
                database: "mail".to_string(),
                sql: r#"
                    CREATE TABLE IF NOT EXISTS attachments (
                        id TEXT PRIMARY KEY,
                        message_id TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        content_type TEXT,
                        size INTEGER,
                        content_id TEXT,
                        is_inline BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);
                    CREATE INDEX IF NOT EXISTS idx_attachments_content_type ON attachments (content_type);
                "#.to_string(),
                rollback: Some(r#"
                    DROP INDEX IF EXISTS idx_attachments_content_type;
                    DROP INDEX IF EXISTS idx_attachments_message_id;
                    DROP TABLE IF EXISTS attachments;
                "#.to_string()),
            },
            Migration {
                id: "003_add_message_headers_size".to_string(),
                description: "Add headers and size fields to messages table".to_string(),
                version: 3,
                database: "mail".to_string(),
                sql: r#"
                    -- Add missing columns to messages table if they don't exist
                    ALTER TABLE messages ADD COLUMN headers TEXT NOT NULL DEFAULT '{}';
                    ALTER TABLE messages ADD COLUMN size INTEGER NOT NULL DEFAULT 0;
                    
                    -- Add additional indexes for performance
                    CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages (subject);
                    CREATE INDEX IF NOT EXISTS idx_messages_from_address ON messages (from_address);
                    CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages (is_read);
                    CREATE INDEX IF NOT EXISTS idx_messages_is_starred ON messages (is_starred);
                "#.to_string(),
                rollback: Some(r#"
                    DROP INDEX IF EXISTS idx_messages_is_starred;
                    DROP INDEX IF EXISTS idx_messages_is_read;
                    DROP INDEX IF EXISTS idx_messages_from_address;
                    DROP INDEX IF EXISTS idx_messages_subject;
                    -- Note: SQLite doesn't support DROP COLUMN, so we can't remove the added columns
                "#.to_string()),
            },
        ]
    }

    /// Get all calendar database migrations
    pub fn get_calendar_migrations() -> Vec<Migration> {
        vec![
            Migration {
                id: "001_initial_calendar_schema".to_string(),
                description: "Create initial calendar database schema".to_string(),
                version: 1,
                database: "calendar".to_string(),
                sql: r#"
                    -- Calendar accounts table
                    CREATE TABLE IF NOT EXISTS calendar_accounts (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL,
                        provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'exchange', 'caldav', 'icloud', 'fastmail')),
                        config TEXT NOT NULL,
                        credentials TEXT,
                        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'auth_error', 'quota_exceeded', 'suspended', 'disabled', 'error')),
                        default_calendar_id TEXT,
                        last_sync_at DATETIME,
                        next_sync_at DATETIME,
                        sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
                        is_enabled BOOLEAN NOT NULL DEFAULT 1,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, email, provider)
                    );

                    -- Calendars table
                    CREATE TABLE IF NOT EXISTS calendars (
                        id TEXT PRIMARY KEY,
                        account_id TEXT NOT NULL,
                        provider_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        color TEXT NOT NULL DEFAULT '#3174ad',
                        timezone TEXT NOT NULL DEFAULT 'UTC',
                        is_primary BOOLEAN NOT NULL DEFAULT 0,
                        access_level TEXT NOT NULL DEFAULT 'reader' CHECK (access_level IN ('owner', 'writer', 'reader', 'freeBusyReader')),
                        is_visible BOOLEAN NOT NULL DEFAULT 1,
                        can_sync BOOLEAN NOT NULL DEFAULT 1,
                        calendar_type TEXT NOT NULL DEFAULT 'secondary' CHECK (calendar_type IN ('primary', 'secondary', 'shared', 'public', 'resource', 'holiday', 'birthdays')),
                        is_selected BOOLEAN NOT NULL DEFAULT 1,
                        last_sync_at DATETIME,
                        is_being_synced BOOLEAN NOT NULL DEFAULT 0,
                        sync_error TEXT,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (account_id) REFERENCES calendar_accounts(id) ON DELETE CASCADE,
                        UNIQUE(account_id, provider_id)
                    );

                    -- Calendar events table
                    CREATE TABLE IF NOT EXISTS calendar_events (
                        id TEXT PRIMARY KEY,
                        calendar_id TEXT NOT NULL,
                        provider_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        description TEXT,
                        location TEXT,
                        location_data TEXT,
                        start_time DATETIME NOT NULL,
                        end_time DATETIME NOT NULL,
                        timezone TEXT,
                        is_all_day BOOLEAN NOT NULL DEFAULT 0,
                        status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
                        visibility TEXT NOT NULL DEFAULT 'default' CHECK (visibility IN ('default', 'public', 'private', 'confidential')),
                        creator TEXT,
                        organizer TEXT,
                        attendees TEXT NOT NULL DEFAULT '[]',
                        recurrence TEXT,
                        recurring_event_id TEXT,
                        original_start_time DATETIME,
                        reminders TEXT NOT NULL DEFAULT '[]',
                        conferencing TEXT,
                        attachments TEXT NOT NULL DEFAULT '[]',
                        extended_properties TEXT,
                        source TEXT,
                        color TEXT,
                        transparency TEXT NOT NULL DEFAULT 'opaque' CHECK (transparency IN ('opaque', 'transparent')),
                        uid TEXT NOT NULL,
                        sequence INTEGER NOT NULL DEFAULT 0,
                        sync_hash TEXT,
                        privacy_sync_marker TEXT,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
                        FOREIGN KEY (recurring_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
                        UNIQUE(calendar_id, provider_id)
                    );

                    -- Privacy sync rules table
                    CREATE TABLE IF NOT EXISTS privacy_sync_rules (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        is_enabled BOOLEAN NOT NULL DEFAULT 1,
                        source_calendar_ids TEXT NOT NULL,
                        target_calendar_ids TEXT NOT NULL,
                        privacy_settings TEXT NOT NULL,
                        filters TEXT,
                        sync_window TEXT NOT NULL,
                        is_bidirectional BOOLEAN NOT NULL DEFAULT 0,
                        advanced_mode BOOLEAN NOT NULL DEFAULT 0,
                        last_sync_at DATETIME,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, name)
                    );

                    -- Create indexes
                    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_user_id ON calendar_accounts (user_id);
                    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_status ON calendar_accounts (status);
                    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_next_sync_at ON calendar_accounts (next_sync_at);
                    CREATE INDEX IF NOT EXISTS idx_calendars_account_id ON calendars (account_id);
                    CREATE INDEX IF NOT EXISTS idx_calendars_is_selected ON calendars (is_selected);
                    CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events (calendar_id);
                    CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events (start_time);
                    CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events (end_time);
                    CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range ON calendar_events (start_time, end_time);
                    CREATE INDEX IF NOT EXISTS idx_calendar_events_uid ON calendar_events (uid);
                    CREATE INDEX IF NOT EXISTS idx_privacy_sync_rules_user_id ON privacy_sync_rules (user_id);
                    CREATE INDEX IF NOT EXISTS idx_privacy_sync_rules_is_enabled ON privacy_sync_rules (is_enabled);
                "#.to_string(),
                rollback: Some(r#"
                    DROP INDEX IF EXISTS idx_privacy_sync_rules_is_enabled;
                    DROP INDEX IF EXISTS idx_privacy_sync_rules_user_id;
                    DROP INDEX IF EXISTS idx_calendar_events_uid;
                    DROP INDEX IF EXISTS idx_calendar_events_time_range;
                    DROP INDEX IF EXISTS idx_calendar_events_end_time;
                    DROP INDEX IF EXISTS idx_calendar_events_start_time;
                    DROP INDEX IF EXISTS idx_calendar_events_calendar_id;
                    DROP INDEX IF EXISTS idx_calendars_is_selected;
                    DROP INDEX IF EXISTS idx_calendars_account_id;
                    DROP INDEX IF EXISTS idx_calendar_accounts_next_sync_at;
                    DROP INDEX IF EXISTS idx_calendar_accounts_status;
                    DROP INDEX IF EXISTS idx_calendar_accounts_user_id;
                    DROP TABLE IF EXISTS privacy_sync_rules;
                    DROP TABLE IF EXISTS calendar_events;
                    DROP TABLE IF EXISTS calendars;
                    DROP TABLE IF EXISTS calendar_accounts;
                "#.to_string()),
            },
        ]
    }

    /// Apply all migrations to a database
    pub async fn apply_migrations(&mut self, database: &str) -> Result<Vec<MigrationStatus>, sqlx::Error> {
        let pool = match database {
            "mail" => self.mail_pool.as_ref().ok_or_else(|| sqlx::Error::Configuration("Mail database not connected".into()))?,
            "calendar" => self.calendar_pool.as_ref().ok_or_else(|| sqlx::Error::Configuration("Calendar database not connected".into()))?,
            _ => return Err(sqlx::Error::Configuration(format!("Unknown database: {}", database).into())),
        };

        // Ensure migration tracking table exists
        self.ensure_migration_table(pool).await?;

        let migrations = match database {
            "mail" => Self::get_mail_migrations(),
            "calendar" => Self::get_calendar_migrations(),
            _ => return Ok(Vec::new()),
        };

        let mut statuses = Vec::new();

        for migration in migrations {
            let status = self.apply_migration(pool, &migration).await?;
            statuses.push(status);
        }

        Ok(statuses)
    }

    /// Ensure migration tracking table exists
    async fn ensure_migration_table(&self, pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS migrations (
                migration_id TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        "#)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Apply a single migration
    async fn apply_migration(&self, pool: &SqlitePool, migration: &Migration) -> Result<MigrationStatus, sqlx::Error> {
        // Check if migration is already applied
        let existing = sqlx::query("SELECT migration_id FROM migrations WHERE migration_id = ?")
            .bind(&migration.id)
            .fetch_optional(pool)
            .await?;

        if existing.is_some() {
            return Ok(MigrationStatus {
                id: migration.id.clone(),
                applied: true,
                applied_at: None, // Would need to fetch from DB
                error: None,
            });
        }

        // Apply migration in a transaction
        let mut tx = pool.begin().await?;

        // Execute migration SQL
        let statements = migration.sql.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.starts_with("--"));

        for statement in statements {
            if !statement.is_empty() {
                sqlx::query(statement).execute(&mut *tx).await?;
            }
        }

        // Record migration as applied
        sqlx::query("INSERT INTO migrations (migration_id, description) VALUES (?, ?)")
            .bind(&migration.id)
            .bind(&migration.description)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(MigrationStatus {
            id: migration.id.clone(),
            applied: true,
            applied_at: Some(Utc::now()),
            error: None,
        })
    }

    /// Get migration status for a database
    pub async fn get_migration_status(&self, database: &str) -> Result<Vec<MigrationStatus>, sqlx::Error> {
        let pool = match database {
            "mail" => self.mail_pool.as_ref().ok_or_else(|| sqlx::Error::Configuration("Mail database not connected".into()))?,
            "calendar" => self.calendar_pool.as_ref().ok_or_else(|| sqlx::Error::Configuration("Calendar database not connected".into()))?,
            _ => return Err(sqlx::Error::Configuration(format!("Unknown database: {}", database).into())),
        };

        let migrations = match database {
            "mail" => Self::get_mail_migrations(),
            "calendar" => Self::get_calendar_migrations(),
            _ => return Ok(Vec::new()),
        };

        let applied_rows = sqlx::query("SELECT migration_id, applied_at FROM migrations")
            .fetch_all(pool)
            .await?;

        let applied_map: HashMap<String, DateTime<Utc>> = applied_rows
            .into_iter()
            .map(|row| {
                let id: String = row.get("migration_id");
                let applied_at: DateTime<Utc> = row.get("applied_at");
                (id, applied_at)
            })
            .collect();

        let mut statuses = Vec::new();
        for migration in migrations {
            let applied_at = applied_map.get(&migration.id).copied();
            statuses.push(MigrationStatus {
                id: migration.id,
                applied: applied_at.is_some(),
                applied_at,
                error: None,
            });
        }

        Ok(statuses)
    }

    /// Close database connections
    pub async fn close(&mut self) {
        if let Some(pool) = self.mail_pool.take() {
            pool.close().await;
        }
        if let Some(pool) = self.calendar_pool.take() {
            pool.close().await;
        }
    }
}