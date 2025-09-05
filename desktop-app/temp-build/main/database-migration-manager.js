"use strict";
/**
 * Database Migration Manager
 *
 * Handles database schema migrations for mail and calendar databases.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseMigrationManager = void 0;
exports.getDatabaseMigrationManager = getDatabaseMigrationManager;
const electron_log_1 = __importDefault(require("electron-log"));
const fs_1 = require("fs");
/**
 * Database Migration Manager Class
 */
class DatabaseMigrationManager {
    constructor(mailDbPath, calendarDbPath) {
        this.mailDbPath = mailDbPath;
        this.calendarDbPath = calendarDbPath;
    }
    /**
     * Load SQLite3 module
     */
    async loadSQLite3() {
        if (this.sqlite3) {
            return this.sqlite3;
        }
        try {
            const sqlite3Module = require('sqlite3').verbose();
            if (!sqlite3Module) {
                throw new Error('Failed to load SQLite3 module');
            }
            this.sqlite3 = sqlite3Module;
            return sqlite3Module;
        }
        catch (error) {
            throw new Error('SQLite3 module not available. Please install sqlite3: npm install sqlite3');
        }
    }
    /**
     * Ensure schema_version table exists
     */
    async ensureSchemaVersionTable(db) {
        return new Promise((resolve, reject) => {
            const createTableSQL = `
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER NOT NULL PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
            db.exec(createTableSQL, (err) => {
                if (err) {
                    reject(new Error(`Failed to create schema_version table: ${err.message}`));
                }
                else {
                    electron_log_1.default.debug('Schema version table ensured');
                    resolve();
                }
            });
        });
    }
    /**
     * Ensure migrations table exists for tracking individual migrations
     */
    async ensureMigrationsTable(db) {
        return new Promise((resolve, reject) => {
            const createTableSQL = `
        CREATE TABLE IF NOT EXISTS migrations (
          migration_id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
            db.exec(createTableSQL, (err) => {
                if (err) {
                    reject(new Error(`Failed to create migrations table: ${err.message}`));
                }
                else {
                    electron_log_1.default.debug('Migrations table ensured');
                    resolve();
                }
            });
        });
    }
    /**
     * Get current schema version
     */
    async getCurrentSchemaVersion(db) {
        return new Promise((resolve, reject) => {
            db.get('SELECT MAX(version) as version FROM schema_version', (err, row) => {
                if (err) {
                    // If error is because table doesn't exist, return 0
                    if (err.message.includes('no such table')) {
                        resolve(0);
                    }
                    else {
                        reject(new Error(`Failed to get schema version: ${err.message}`));
                    }
                }
                else {
                    resolve(row?.version || 0);
                }
            });
        });
    }
    /**
     * Check if migration has been applied
     */
    async isMigrationApplied(db, migrationId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT migration_id FROM migrations WHERE migration_id = ?', [migrationId], (err, row) => {
                if (err) {
                    // If table doesn't exist, migration hasn't been applied
                    if (err.message.includes('no such table')) {
                        resolve(false);
                    }
                    else {
                        reject(new Error(`Failed to check migration status: ${err.message}`));
                    }
                }
                else {
                    resolve(!!row);
                }
            });
        });
    }
    /**
     * Record migration as applied
     */
    async recordMigration(db, migration) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO migrations (migration_id, description) VALUES (?, ?)', [migration.id, migration.description], (err) => {
                if (err) {
                    reject(new Error(`Failed to record migration ${migration.id}: ${err.message}`));
                }
                else {
                    electron_log_1.default.info(`Recorded migration: ${migration.id} - ${migration.description}`);
                    resolve();
                }
            });
        });
    }
    /**
     * Update schema version
     */
    async updateSchemaVersion(db, version) {
        return new Promise((resolve, reject) => {
            db.run('INSERT OR REPLACE INTO schema_version (version) VALUES (?)', [version], (err) => {
                if (err) {
                    reject(new Error(`Failed to update schema version: ${err.message}`));
                }
                else {
                    electron_log_1.default.info(`Updated schema version to: ${version}`);
                    resolve();
                }
            });
        });
    }
    /**
     * Execute migration SQL
     */
    async executeMigration(db, migration) {
        return new Promise((resolve, reject) => {
            // Process SQL - keep comments for documentation but ensure proper execution
            const sqlStatements = this.parseSQLStatements(migration.sql);
            if (sqlStatements.length === 0) {
                electron_log_1.default.debug(`Skipping empty migration: ${migration.id}`);
                resolve();
                return;
            }
            electron_log_1.default.debug(`Executing ${sqlStatements.length} SQL statements for migration ${migration.id}`);
            // Execute each statement separately for better error handling
            let statementIndex = 0;
            const executeNext = () => {
                if (statementIndex >= sqlStatements.length) {
                    electron_log_1.default.info(`Executed migration: ${migration.id} - ${migration.description}`);
                    resolve();
                    return;
                }
                const statement = sqlStatements[statementIndex];
                statementIndex++;
                db.exec(statement, (err) => {
                    if (err) {
                        electron_log_1.default.error(`Failed statement ${statementIndex}/${sqlStatements.length} in migration ${migration.id}:`, statement);
                        reject(new Error(`Failed to execute migration ${migration.id} (statement ${statementIndex}): ${err.message}`));
                    }
                    else {
                        executeNext();
                    }
                });
            };
            executeNext();
        });
    }
    /**
     * Parse SQL statements from migration SQL
     * Handles multi-statement SQL properly
     */
    parseSQLStatements(sql) {
        const statements = [];
        const lines = sql.split('\n');
        let currentStatement = '';
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('--')) {
                continue;
            }
            currentStatement += line + '\n';
            // Check if statement is complete (ends with semicolon)
            if (trimmedLine.endsWith(';')) {
                const finalStatement = currentStatement.trim();
                if (finalStatement.length > 0 && finalStatement !== ';') {
                    statements.push(finalStatement);
                }
                currentStatement = '';
            }
        }
        // Add any remaining statement
        const finalStatement = currentStatement.trim();
        if (finalStatement.length > 0 && finalStatement !== ';') {
            statements.push(finalStatement);
        }
        return statements;
    }
    /**
     * Apply all pending migrations
     */
    async applyAllMigrations() {
        try {
            electron_log_1.default.info('Starting database migrations...');
            // Check if database files exist
            if (!(0, fs_1.existsSync)(this.mailDbPath)) {
                electron_log_1.default.warn(`Mail database file does not exist: ${this.mailDbPath}`);
                return true;
            }
            if (!(0, fs_1.existsSync)(this.calendarDbPath)) {
                electron_log_1.default.warn(`Calendar database file does not exist: ${this.calendarDbPath}`);
                return true;
            }
            const mailMigrations = await this.applyMigrationsToDatabase(this.mailDbPath, this.getMailMigrations());
            const calendarMigrations = await this.applyMigrationsToDatabase(this.calendarDbPath, this.getCalendarMigrations());
            const success = mailMigrations && calendarMigrations;
            if (success) {
                electron_log_1.default.info('All database migrations completed successfully');
            }
            else {
                electron_log_1.default.error('Some database migrations failed');
            }
            return success;
        }
        catch (error) {
            electron_log_1.default.error('Database migration process failed:', error);
            return false;
        }
    }
    /**
     * Apply migrations to a specific database
     */
    async applyMigrationsToDatabase(dbPath, migrations) {
        if (!(0, fs_1.existsSync)(dbPath)) {
            electron_log_1.default.warn(`Database file does not exist: ${dbPath}`);
            return true;
        }
        const sqlite3 = await this.loadSQLite3();
        return new Promise((resolve) => {
            // Open with OPEN_READWRITE | OPEN_CREATE to ensure we can create tables
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
                if (err) {
                    electron_log_1.default.error(`Failed to open database ${dbPath}: ${err.message}`);
                    resolve(false);
                    return;
                }
                try {
                    // Enable foreign keys and WAL mode for better performance and safety
                    await this.configureDatabaseSettings(db);
                    // Use serialized mode for sequential execution
                    db.serialize(async () => {
                        try {
                            // Ensure migration tracking tables exist
                            await this.ensureSchemaVersionTable(db);
                            await this.ensureMigrationsTable(db);
                            // Get current schema version
                            const currentVersion = await this.getCurrentSchemaVersion(db);
                            electron_log_1.default.debug(`Current schema version for ${dbPath}: ${currentVersion}`);
                            // Apply pending migrations
                            let appliedCount = 0;
                            let newVersion = currentVersion;
                            for (const migration of migrations) {
                                const isApplied = await this.isMigrationApplied(db, migration.id);
                                if (!isApplied) {
                                    electron_log_1.default.info(`Applying migration: ${migration.id} - ${migration.description}`);
                                    // Begin transaction for this migration
                                    await this.beginTransaction(db);
                                    try {
                                        await this.executeMigration(db, migration);
                                        await this.recordMigration(db, migration);
                                        // Commit transaction
                                        await this.commitTransaction(db);
                                        appliedCount++;
                                        // Update version based on migration ID (extract version number)
                                        const versionMatch = migration.id.match(/^(\d+)/);
                                        if (versionMatch) {
                                            const migrationVersion = parseInt(versionMatch[1], 10);
                                            if (migrationVersion > newVersion) {
                                                newVersion = migrationVersion;
                                            }
                                        }
                                    }
                                    catch (error) {
                                        electron_log_1.default.error(`Migration ${migration.id} failed:`, error);
                                        // Rollback transaction
                                        await this.rollbackTransaction(db);
                                        db.close();
                                        resolve(false);
                                        return;
                                    }
                                }
                                else {
                                    electron_log_1.default.debug(`Migration already applied: ${migration.id}`);
                                }
                            }
                            // Update schema version if migrations were applied
                            if (appliedCount > 0 && newVersion > currentVersion) {
                                await this.updateSchemaVersion(db, newVersion);
                            }
                            electron_log_1.default.info(`Applied ${appliedCount} migration(s) to ${dbPath}`);
                            db.close((closeErr) => {
                                if (closeErr) {
                                    electron_log_1.default.error(`Error closing database: ${closeErr.message}`);
                                }
                                resolve(true);
                            });
                        }
                        catch (error) {
                            electron_log_1.default.error(`Failed to apply migrations to ${dbPath}:`, error);
                            db.close();
                            resolve(false);
                        }
                    });
                }
                catch (error) {
                    electron_log_1.default.error(`Failed to apply migrations to ${dbPath}:`, error);
                    db.close();
                    resolve(false);
                }
            });
        });
    }
    /**
     * Configure database settings for optimal performance and safety
     */
    async configureDatabaseSettings(db) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Enable foreign key constraints
                db.run('PRAGMA foreign_keys = ON', (err) => {
                    if (err)
                        electron_log_1.default.warn('Could not enable foreign keys:', err.message);
                });
                // Set journal mode to WAL for better concurrency
                db.run('PRAGMA journal_mode = WAL', (err) => {
                    if (err)
                        electron_log_1.default.warn('Could not set WAL mode:', err.message);
                });
                // Set synchronous mode to NORMAL for balance of safety and performance
                db.run('PRAGMA synchronous = NORMAL', (err) => {
                    if (err)
                        electron_log_1.default.warn('Could not set synchronous mode:', err.message);
                });
                // Set temp store to memory
                db.run('PRAGMA temp_store = MEMORY', (err) => {
                    if (err)
                        electron_log_1.default.warn('Could not set temp store:', err.message);
                });
                // Set busy timeout to 30 seconds
                db.run('PRAGMA busy_timeout = 30000', (err) => {
                    if (err)
                        electron_log_1.default.warn('Could not set busy timeout:', err.message);
                    resolve();
                });
            });
        });
    }
    /**
     * Begin transaction
     */
    async beginTransaction(db) {
        return new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    reject(new Error(`Failed to begin transaction: ${err.message}`));
                }
                else {
                    electron_log_1.default.debug('Transaction started');
                    resolve();
                }
            });
        });
    }
    /**
     * Commit transaction
     */
    async commitTransaction(db) {
        return new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) {
                    reject(new Error(`Failed to commit transaction: ${err.message}`));
                }
                else {
                    electron_log_1.default.debug('Transaction committed');
                    resolve();
                }
            });
        });
    }
    /**
     * Rollback transaction
     */
    async rollbackTransaction(db) {
        return new Promise((resolve, reject) => {
            db.run('ROLLBACK', (err) => {
                if (err) {
                    electron_log_1.default.error(`Failed to rollback transaction: ${err.message}`);
                    reject(new Error(`Failed to rollback transaction: ${err.message}`));
                }
                else {
                    electron_log_1.default.info('Transaction rolled back');
                    resolve();
                }
            });
        });
    }
    /**
     * Get migration status for all databases
     */
    async getAllMigrationStatuses() {
        return {
            mail: await this.getMigrationStatus(this.mailDbPath, this.getMailMigrations()),
            calendar: await this.getMigrationStatus(this.calendarDbPath, this.getCalendarMigrations())
        };
    }
    /**
     * Get migration status for a specific database
     */
    async getMigrationStatus(dbPath, migrations) {
        if (!(0, fs_1.existsSync)(dbPath)) {
            return migrations.map(migration => ({
                id: migration.id,
                applied: false,
                error: 'Database does not exist'
            }));
        }
        const sqlite3 = await this.loadSQLite3();
        return new Promise((resolve) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
                if (err) {
                    resolve(migrations.map(migration => ({
                        id: migration.id,
                        applied: false,
                        error: `Cannot open database: ${err.message}`
                    })));
                    return;
                }
                try {
                    // Ensure tables exist
                    await this.ensureSchemaVersionTable(db);
                    await this.ensureMigrationsTable(db);
                    // Get all applied migrations
                    const appliedMigrations = await new Promise((res, rej) => {
                        db.all('SELECT * FROM migrations', (err, rows) => {
                            if (err) {
                                if (err.message.includes('no such table')) {
                                    res([]);
                                }
                                else {
                                    rej(err);
                                }
                            }
                            else {
                                res(rows || []);
                            }
                        });
                    });
                    const appliedIds = new Set(appliedMigrations.map(m => m.migration_id));
                    const appliedDates = new Map(appliedMigrations.map(m => [m.migration_id, new Date(m.applied_at)]));
                    const statuses = migrations.map(migration => {
                        const appliedDate = appliedDates.get(migration.id);
                        return {
                            id: migration.id,
                            applied: appliedIds.has(migration.id),
                            ...(appliedDate && { appliedAt: appliedDate })
                        };
                    });
                    db.close();
                    resolve(statuses);
                }
                catch (error) {
                    db.close();
                    resolve(migrations.map(migration => ({
                        id: migration.id,
                        applied: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    })));
                }
            });
        });
    }
    /**
     * Get mail database migrations
     */
    getMailMigrations() {
        return [
            {
                id: '001_initial_schema',
                description: 'Create initial mail database schema',
                sql: `
          -- Mail accounts table
          CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            provider TEXT NOT NULL,
            display_name TEXT NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT 1,
            imap_config TEXT,
            smtp_config TEXT,
            oauth_tokens TEXT,
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
            message_references TEXT NOT NULL DEFAULT '[]',
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

          -- Create initial performance indexes
          CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages (account_id, folder);
          CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages (received_at);
          CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id);
          CREATE INDEX IF NOT EXISTS idx_folders_account_path ON folders (account_id, path);
          CREATE INDEX IF NOT EXISTS idx_threads_account_last_message ON threads (account_id, last_message_at);
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_threads_account_last_message;
          DROP INDEX IF EXISTS idx_folders_account_path;
          DROP INDEX IF EXISTS idx_messages_thread_id;
          DROP INDEX IF EXISTS idx_messages_received_at;
          DROP INDEX IF EXISTS idx_messages_account_folder;
          DROP TABLE IF EXISTS threads;
          DROP TABLE IF EXISTS messages;
          DROP TABLE IF EXISTS folders;
          DROP TABLE IF EXISTS accounts;
        `
            },
            {
                id: '002_add_message_indexes',
                description: 'Add additional indexes for message performance',
                sql: `
          -- Add index for message search
          CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages (subject);
          CREATE INDEX IF NOT EXISTS idx_messages_from_address ON messages (from_address);
          CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages (is_read);
          CREATE INDEX IF NOT EXISTS idx_messages_is_starred ON messages (is_starred);
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_messages_is_starred;
          DROP INDEX IF EXISTS idx_messages_is_read;
          DROP INDEX IF EXISTS idx_messages_from_address;
          DROP INDEX IF EXISTS idx_messages_subject;
        `
            },
            {
                id: '003_add_attachment_tracking',
                description: 'Add attachment tracking table',
                sql: `
          -- Create attachments table
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
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_attachments_content_type;
          DROP INDEX IF EXISTS idx_attachments_message_id;
          DROP TABLE IF EXISTS attachments;
        `
            },
            {
                id: '004_add_sync_state',
                description: 'Add sync state tracking for accounts',
                sql: `
          -- Create sync history table first (no ALTER dependencies)
          CREATE TABLE IF NOT EXISTS sync_history (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            sync_type TEXT NOT NULL,
            started_at DATETIME NOT NULL,
            completed_at DATETIME,
            success BOOLEAN,
            messages_synced INTEGER DEFAULT 0,
            folders_synced INTEGER DEFAULT 0,
            error_message TEXT,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
          );
          
          CREATE INDEX IF NOT EXISTS idx_sync_history_account_id ON sync_history (account_id);
          CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON sync_history (started_at);
          
          -- Create a new accounts table with additional columns
          CREATE TABLE IF NOT EXISTS accounts_new (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            provider TEXT NOT NULL,
            display_name TEXT NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT 1,
            imap_config TEXT,
            smtp_config TEXT,
            oauth_tokens TEXT,
            last_sync_at DATETIME,
            sync_state TEXT DEFAULT 'idle',
            sync_error TEXT,
            sync_token TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          -- Copy data from existing accounts table
          INSERT INTO accounts_new (id, email, provider, display_name, is_enabled, imap_config, smtp_config, oauth_tokens, created_at, updated_at)
          SELECT id, email, provider, display_name, is_enabled, imap_config, smtp_config, oauth_tokens, created_at, updated_at
          FROM accounts;
          
          -- Drop the old table
          DROP TABLE accounts;
          
          -- Rename new table to accounts
          ALTER TABLE accounts_new RENAME TO accounts;
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_sync_history_started_at;
          DROP INDEX IF EXISTS idx_sync_history_account_id;
          DROP TABLE IF EXISTS sync_history;
        `
            },
            {
                id: '005_add_snippets_and_templates',
                description: 'Add snippet and email template storage',
                sql: `
          -- Text snippets table
          CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            shortcut TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            category TEXT DEFAULT 'general',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          -- Email templates table  
          CREATE TABLE IF NOT EXISTS email_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL DEFAULT 'general',
            tags TEXT NOT NULL DEFAULT '[]',
            subject TEXT NOT NULL,
            body_html TEXT NOT NULL,
            body_text TEXT NOT NULL DEFAULT '',
            variables TEXT NOT NULL DEFAULT '[]',
            attachments TEXT NOT NULL DEFAULT '[]',
            sender TEXT,
            reply_to TEXT,
            priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
            tracking_options TEXT NOT NULL DEFAULT '{}',
            schedule_options TEXT NOT NULL DEFAULT '{}',
            is_default BOOLEAN NOT NULL DEFAULT 0,
            is_global BOOLEAN NOT NULL DEFAULT 0,
            usage_count INTEGER NOT NULL DEFAULT 0,
            last_used DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT
          );

          -- Template categories table
          CREATE TABLE IF NOT EXISTS template_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            icon TEXT,
            color TEXT,
            parent_id TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_system BOOLEAN NOT NULL DEFAULT 0,
            template_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES template_categories(id) ON DELETE CASCADE
          );

          -- Template usage analytics table
          CREATE TABLE IF NOT EXISTS template_usage (
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            template_type TEXT NOT NULL CHECK (template_type IN ('snippet', 'email')),
            used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            context TEXT,
            variables_used TEXT NOT NULL DEFAULT '{}',
            render_time INTEGER,
            errors TEXT
          );

          -- Create performance indexes
          CREATE INDEX IF NOT EXISTS idx_snippets_name ON snippets (name);
          CREATE INDEX IF NOT EXISTS idx_snippets_shortcut ON snippets (shortcut) WHERE shortcut IS NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_snippets_category ON snippets (category);
          CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON snippets (created_at);
          CREATE INDEX IF NOT EXISTS idx_snippets_updated_at ON snippets (updated_at);

          CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates (name);
          CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates (category);
          CREATE INDEX IF NOT EXISTS idx_email_templates_is_default ON email_templates (is_default);
          CREATE INDEX IF NOT EXISTS idx_email_templates_is_global ON email_templates (is_global);
          CREATE INDEX IF NOT EXISTS idx_email_templates_usage_count ON email_templates (usage_count);
          CREATE INDEX IF NOT EXISTS idx_email_templates_last_used ON email_templates (last_used);
          CREATE INDEX IF NOT EXISTS idx_email_templates_created_at ON email_templates (created_at);

          CREATE INDEX IF NOT EXISTS idx_template_categories_parent_id ON template_categories (parent_id);
          CREATE INDEX IF NOT EXISTS idx_template_categories_order_index ON template_categories (order_index);
          CREATE INDEX IF NOT EXISTS idx_template_categories_is_system ON template_categories (is_system);

          CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage (template_id);
          CREATE INDEX IF NOT EXISTS idx_template_usage_template_type ON template_usage (template_type);
          CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON template_usage (used_at);
          CREATE INDEX IF NOT EXISTS idx_template_usage_user_id ON template_usage (user_id) WHERE user_id IS NOT NULL;

          -- Insert default template categories
          INSERT OR IGNORE INTO template_categories (id, name, description, icon, color, order_index, is_system) VALUES
            ('general', 'General', 'General purpose templates', 'file-text', '#6c757d', 1, 1),
            ('business', 'Business', 'Professional business templates', 'briefcase', '#007bff', 2, 1),
            ('personal', 'Personal', 'Personal communication templates', 'user', '#28a745', 3, 1),
            ('support', 'Support', 'Customer support templates', 'help-circle', '#ffc107', 4, 1),
            ('marketing', 'Marketing', 'Marketing and promotional templates', 'megaphone', '#e83e8c', 5, 1),
            ('signatures', 'Signatures', 'Email signature templates', 'edit-3', '#17a2b8', 6, 1);

          -- Insert default snippets
          INSERT OR IGNORE INTO snippets (id, name, content, shortcut, tags, category) VALUES
            ('sig-default', 'Default Signature', 'Best regards,\n{{name}}\n{{title}}\n{{company}}', 'sig', '["signature", "default"]', 'signatures'),
            ('thanks-basic', 'Thank You', 'Thank you for your time and consideration.', 'ty', '["courtesy", "thanks"]', 'general'),
            ('meeting-request', 'Meeting Request', 'I would like to schedule a meeting to discuss {{topic}}. Are you available on {{date}} at {{time}}?', 'meet', '["meeting", "request"]', 'business'),
            ('follow-up', 'Follow Up', 'Following up on our conversation about {{topic}}. Please let me know if you need any additional information.', 'followup', '["follow-up", "business"]', 'business');

          -- Insert default email templates  
          INSERT OR IGNORE INTO email_templates (id, name, description, category, subject, body_html, body_text, variables, tags) VALUES
            ('welcome-email', 'Welcome Email', 'Standard welcome email template', 'business', 
             'Welcome to {{company_name}}!', 
             '<p>Dear {{recipient_name}},</p><p>Welcome to {{company_name}}! We''re excited to have you on board.</p><p>Best regards,<br>{{sender_name}}</p>',
             'Dear {{recipient_name}},\n\nWelcome to {{company_name}}! We''re excited to have you on board.\n\nBest regards,\n{{sender_name}}',
             '[{"key": "recipient_name", "label": "Recipient Name", "type": "text", "isRequired": true}, {"key": "company_name", "label": "Company Name", "type": "text", "isRequired": true}, {"key": "sender_name", "label": "Sender Name", "type": "text", "isRequired": true}]',
             '["welcome", "onboarding", "business"]'),
            ('meeting-invite', 'Meeting Invitation', 'Standard meeting invitation template', 'business',
             'Meeting Invitation: {{meeting_title}}',
             '<p>Hi {{recipient_name}},</p><p>You''re invited to a meeting:</p><p><strong>{{meeting_title}}</strong><br>Date: {{meeting_date}}<br>Time: {{meeting_time}}<br>Location: {{meeting_location}}</p><p>Agenda:<br>{{agenda}}</p><p>Best regards,<br>{{organizer_name}}</p>',
             'Hi {{recipient_name}},\n\nYou''re invited to a meeting:\n\n{{meeting_title}}\nDate: {{meeting_date}}\nTime: {{meeting_time}}\nLocation: {{meeting_location}}\n\nAgenda:\n{{agenda}}\n\nBest regards,\n{{organizer_name}}',
             '[{"key": "recipient_name", "label": "Recipient Name", "type": "text", "isRequired": true}, {"key": "meeting_title", "label": "Meeting Title", "type": "text", "isRequired": true}, {"key": "meeting_date", "label": "Meeting Date", "type": "date", "isRequired": true}, {"key": "meeting_time", "label": "Meeting Time", "type": "time", "isRequired": true}, {"key": "meeting_location", "label": "Location", "type": "text", "isRequired": false}, {"key": "agenda", "label": "Agenda", "type": "textarea", "isRequired": false}, {"key": "organizer_name", "label": "Organizer Name", "type": "text", "isRequired": true}]',
             '["meeting", "invitation", "business"]');
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_template_usage_user_id;
          DROP INDEX IF EXISTS idx_template_usage_used_at;
          DROP INDEX IF EXISTS idx_template_usage_template_type;
          DROP INDEX IF EXISTS idx_template_usage_template_id;
          DROP INDEX IF EXISTS idx_template_categories_is_system;
          DROP INDEX IF EXISTS idx_template_categories_order_index;
          DROP INDEX IF EXISTS idx_template_categories_parent_id;
          DROP INDEX IF EXISTS idx_email_templates_created_at;
          DROP INDEX IF EXISTS idx_email_templates_last_used;
          DROP INDEX IF EXISTS idx_email_templates_usage_count;
          DROP INDEX IF EXISTS idx_email_templates_is_global;
          DROP INDEX IF EXISTS idx_email_templates_is_default;
          DROP INDEX IF EXISTS idx_email_templates_category;
          DROP INDEX IF EXISTS idx_email_templates_name;
          DROP INDEX IF EXISTS idx_snippets_updated_at;
          DROP INDEX IF EXISTS idx_snippets_created_at;
          DROP INDEX IF EXISTS idx_snippets_category;
          DROP INDEX IF EXISTS idx_snippets_shortcut;
          DROP INDEX IF EXISTS idx_snippets_name;
          DROP TABLE IF EXISTS template_usage;
          DROP TABLE IF EXISTS template_categories;
          DROP TABLE IF EXISTS email_templates;
          DROP TABLE IF EXISTS snippets;
        `
            }
        ];
    }
    /**
     * Get calendar database migrations
     */
    getCalendarMigrations() {
        return [
            {
                id: '001_initial_schema',
                description: 'Create initial calendar database schema',
                sql: `
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

          -- Create performance indexes
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
        `,
                rollback: `
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
        `
            },
            {
                id: '002_add_event_categories',
                description: 'Add event categories support',
                sql: `
          -- Create event categories table
          CREATE TABLE IF NOT EXISTS event_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL,
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            is_system BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          -- Create junction table for many-to-many relationship
          CREATE TABLE IF NOT EXISTS event_category_mappings (
            event_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            PRIMARY KEY (event_id, category_id),
            FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES event_categories(id) ON DELETE CASCADE
          );
          
          CREATE INDEX IF NOT EXISTS idx_event_categories_name ON event_categories (name);
          CREATE INDEX IF NOT EXISTS idx_event_category_mappings_event_id ON event_category_mappings (event_id);
          CREATE INDEX IF NOT EXISTS idx_event_category_mappings_category_id ON event_category_mappings (category_id);
          
          -- Insert default categories
          INSERT OR IGNORE INTO event_categories (id, name, color, icon, sort_order, is_system) VALUES
            ('work', 'Work', '#4285f4', 'briefcase', 1, 1),
            ('personal', 'Personal', '#0f9d58', 'user', 2, 1),
            ('meeting', 'Meeting', '#f4b400', 'users', 3, 1),
            ('important', 'Important', '#db4437', 'star', 4, 1);
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_event_category_mappings_category_id;
          DROP INDEX IF EXISTS idx_event_category_mappings_event_id;
          DROP INDEX IF EXISTS idx_event_categories_name;
          DROP TABLE IF EXISTS event_category_mappings;
          DROP TABLE IF EXISTS event_categories;
        `
            },
            {
                id: '003_add_reminder_notifications',
                description: 'Add reminder notifications table',
                sql: `
          -- Create reminder notifications tracking
          CREATE TABLE IF NOT EXISTS reminder_notifications (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            reminder_minutes INTEGER NOT NULL,
            notification_time DATETIME NOT NULL,
            was_sent BOOLEAN DEFAULT 0,
            sent_at DATETIME,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
          );
          
          CREATE INDEX IF NOT EXISTS idx_reminder_notifications_event_id ON reminder_notifications (event_id);
          CREATE INDEX IF NOT EXISTS idx_reminder_notifications_time ON reminder_notifications (notification_time);
          CREATE INDEX IF NOT EXISTS idx_reminder_notifications_sent ON reminder_notifications (was_sent);
          CREATE INDEX IF NOT EXISTS idx_reminder_notifications_time_not_sent 
            ON reminder_notifications (notification_time) WHERE was_sent = 0;
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_reminder_notifications_time_not_sent;
          DROP INDEX IF EXISTS idx_reminder_notifications_sent;
          DROP INDEX IF EXISTS idx_reminder_notifications_time;
          DROP INDEX IF EXISTS idx_reminder_notifications_event_id;
          DROP TABLE IF EXISTS reminder_notifications;
        `
            },
            {
                id: '004_add_calendar_sharing',
                description: 'Add calendar sharing capabilities',
                sql: `
          -- Calendar share permissions
          CREATE TABLE IF NOT EXISTS calendar_shares (
            id TEXT PRIMARY KEY,
            calendar_id TEXT NOT NULL,
            shared_with_email TEXT NOT NULL,
            permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
            share_token TEXT UNIQUE,
            accepted BOOLEAN DEFAULT 0,
            accepted_at DATETIME,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
            UNIQUE(calendar_id, shared_with_email)
          );
          
          CREATE INDEX IF NOT EXISTS idx_calendar_shares_calendar_id ON calendar_shares (calendar_id);
          CREATE INDEX IF NOT EXISTS idx_calendar_shares_shared_with ON calendar_shares (shared_with_email);
          CREATE INDEX IF NOT EXISTS idx_calendar_shares_token ON calendar_shares (share_token);
        `,
                rollback: `
          DROP INDEX IF EXISTS idx_calendar_shares_token;
          DROP INDEX IF EXISTS idx_calendar_shares_shared_with;
          DROP INDEX IF EXISTS idx_calendar_shares_calendar_id;
          DROP TABLE IF EXISTS calendar_shares;
        `
            }
        ];
    }
    /**
     * Rollback a specific migration
     */
    async rollbackMigration(migrationId, dbType) {
        try {
            electron_log_1.default.info(`Rolling back migration ${migrationId} for ${dbType} database`);
            const dbPath = dbType === 'mail' ? this.mailDbPath : this.calendarDbPath;
            const migrations = dbType === 'mail' ? this.getMailMigrations() : this.getCalendarMigrations();
            const migration = migrations.find(m => m.id === migrationId);
            if (!migration) {
                throw new Error(`Migration ${migrationId} not found`);
            }
            if (!migration.rollback) {
                throw new Error(`Migration ${migrationId} does not support rollback`);
            }
            const sqlite3 = await this.loadSQLite3();
            return new Promise((resolve) => {
                const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
                    if (err) {
                        electron_log_1.default.error(`Failed to open database for rollback: ${err.message}`);
                        resolve(false);
                        return;
                    }
                    if (!migration.rollback) {
                        electron_log_1.default.warn(`No rollback SQL provided for migration ${migration.id}`);
                        resolve(false);
                        return;
                    }
                    db.exec(migration.rollback, (err) => {
                        if (err) {
                            electron_log_1.default.error(`Failed to execute rollback: ${err.message}`);
                            db.close();
                            resolve(false);
                        }
                        else {
                            // Remove migration record
                            db.run('DELETE FROM migrations WHERE migration_id = ?', [migrationId], (err) => {
                                db.close();
                                if (err) {
                                    electron_log_1.default.error(`Failed to remove migration record: ${err.message}`);
                                    resolve(false);
                                }
                                else {
                                    electron_log_1.default.info(`Successfully rolled back migration: ${migrationId}`);
                                    resolve(true);
                                }
                            });
                        }
                    });
                });
            });
        }
        catch (error) {
            electron_log_1.default.error(`Failed to rollback migration ${migrationId}:`, error);
            return false;
        }
    }
    /**
     * Check database health and integrity
     */
    async checkDatabaseHealth(dbType) {
        const dbPath = dbType === 'mail' ? this.mailDbPath : this.calendarDbPath;
        const issues = [];
        const recommendations = [];
        let healthy = true;
        if (!(0, fs_1.existsSync)(dbPath)) {
            return {
                healthy: false,
                issues: [`Database file does not exist: ${dbPath}`],
                recommendations: ['Run database initialization to create the database']
            };
        }
        const sqlite3 = await this.loadSQLite3();
        return new Promise((resolve) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, async (err) => {
                if (err) {
                    resolve({
                        healthy: false,
                        issues: [`Cannot open database: ${err.message}`],
                        recommendations: ['Check file permissions or recreate the database']
                    });
                    return;
                }
                try {
                    // Check integrity
                    const integrityResult = await new Promise((res) => {
                        db.get('PRAGMA integrity_check', (err, row) => {
                            res(err ? 'error' : (row?.integrity_check || 'error'));
                        });
                    });
                    if (integrityResult !== 'ok') {
                        healthy = false;
                        issues.push(`Database integrity check failed: ${integrityResult}`);
                        recommendations.push('Consider running database repair or restoring from backup');
                    }
                    // Check foreign key constraints
                    const fkResult = await new Promise((res) => {
                        db.get('PRAGMA foreign_key_check', (err, row) => {
                            res(err ? -1 : (row ? 1 : 0));
                        });
                    });
                    if (fkResult > 0) {
                        healthy = false;
                        issues.push('Foreign key constraint violations detected');
                        recommendations.push('Review and fix data integrity issues');
                    }
                    // Check WAL mode
                    const walResult = await new Promise((res) => {
                        db.get('PRAGMA journal_mode', (err, row) => {
                            res(err ? 'error' : (row?.journal_mode || 'delete'));
                        });
                    });
                    if (walResult !== 'wal') {
                        recommendations.push('Consider enabling WAL mode for better concurrency');
                    }
                    // Check table existence
                    const expectedTables = dbType === 'mail'
                        ? ['accounts', 'messages', 'folders', 'threads', 'attachments']
                        : ['calendar_accounts', 'calendars', 'calendar_events', 'privacy_sync_rules'];
                    for (const table of expectedTables) {
                        const tableExists = await new Promise((res) => {
                            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table], (err, row) => {
                                res(!err && !!row);
                            });
                        });
                        if (!tableExists) {
                            healthy = false;
                            issues.push(`Required table missing: ${table}`);
                        }
                    }
                    // Check migration status
                    const migrationCount = await new Promise((res) => {
                        db.get('SELECT COUNT(*) as count FROM migrations', (err, row) => {
                            res(err ? 0 : (row?.count || 0));
                        });
                    });
                    const expectedMigrations = dbType === 'mail'
                        ? this.getMailMigrations().length
                        : this.getCalendarMigrations().length;
                    if (migrationCount < expectedMigrations) {
                        recommendations.push(`${expectedMigrations - migrationCount} pending migrations available`);
                    }
                    db.close();
                    resolve({
                        healthy,
                        issues,
                        recommendations
                    });
                }
                catch (error) {
                    db.close();
                    resolve({
                        healthy: false,
                        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                        recommendations: ['Review database logs and consider repair']
                    });
                }
            });
        });
    }
    /**
     * Repair database issues
     */
    async repairDatabase(dbType) {
        const dbPath = dbType === 'mail' ? this.mailDbPath : this.calendarDbPath;
        try {
            electron_log_1.default.info(`Starting database repair for ${dbType} database`);
            const sqlite3 = await this.loadSQLite3();
            return new Promise((resolve) => {
                const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
                    if (err) {
                        electron_log_1.default.error(`Cannot open database for repair: ${err.message}`);
                        resolve(false);
                        return;
                    }
                    try {
                        // Run VACUUM to rebuild database
                        await new Promise((res, rej) => {
                            db.run('VACUUM', (err) => {
                                if (err) {
                                    electron_log_1.default.warn(`VACUUM failed: ${err.message}`);
                                    rej(err);
                                }
                                else {
                                    electron_log_1.default.info('Database vacuumed successfully');
                                    res();
                                }
                            });
                        });
                        // Reindex all tables
                        await new Promise((res, rej) => {
                            db.run('REINDEX', (err) => {
                                if (err) {
                                    electron_log_1.default.warn(`REINDEX failed: ${err.message}`);
                                    rej(err);
                                }
                                else {
                                    electron_log_1.default.info('Database reindexed successfully');
                                    res();
                                }
                            });
                        });
                        // Analyze for query optimization
                        await new Promise((res, rej) => {
                            db.run('ANALYZE', (err) => {
                                if (err) {
                                    electron_log_1.default.warn(`ANALYZE failed: ${err.message}`);
                                    rej(err);
                                }
                                else {
                                    electron_log_1.default.info('Database analyzed successfully');
                                    res();
                                }
                            });
                        });
                        db.close();
                        electron_log_1.default.info(`Database repair completed for ${dbType}`);
                        resolve(true);
                    }
                    catch (error) {
                        db.close();
                        electron_log_1.default.error(`Database repair failed: ${error}`);
                        resolve(false);
                    }
                });
            });
        }
        catch (error) {
            electron_log_1.default.error(`Failed to repair ${dbType} database:`, error);
            return false;
        }
    }
}
exports.DatabaseMigrationManager = DatabaseMigrationManager;
/**
 * Export singleton factory function
 */
let migrationManager = null;
function getDatabaseMigrationManager(mailDbPath, calendarDbPath) {
    if (!migrationManager) {
        migrationManager = new DatabaseMigrationManager(mailDbPath, calendarDbPath);
    }
    return migrationManager;
}
