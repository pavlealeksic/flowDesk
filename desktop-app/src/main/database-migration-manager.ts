/**
 * Database Migration Manager
 * 
 * Handles database schema migrations, version tracking, and upgrades.
 */

import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import log from 'electron-log';

export interface Migration {
  version: number;
  description: string;
  up: string; // SQL script to apply migration
  down: string; // SQL script to rollback migration
  requiresBackup?: boolean;
}

export interface MigrationStatus {
  currentVersion: number;
  targetVersion: number;
  pendingMigrations: Migration[];
  appliedMigrations: number[];
}

/**
 * Database Migration Manager
 */
export class DatabaseMigrationManager {
  private mailDbPath: string;
  private calendarDbPath: string;
  private migrations: Migration[];

  constructor(mailDbPath: string, calendarDbPath: string) {
    this.mailDbPath = mailDbPath;
    this.calendarDbPath = calendarDbPath;
    this.migrations = this.defineMigrations();
  }

  /**
   * Define all database migrations
   */
  private defineMigrations(): Migration[] {
    return [
      {
        version: 2,
        description: 'Add email rules and filters tables',
        requiresBackup: true,
        up: `
          -- Email rules table
          CREATE TABLE IF NOT EXISTS email_rules (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            name TEXT NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 0,
            conditions TEXT NOT NULL, -- JSON array of conditions
            actions TEXT NOT NULL, -- JSON array of actions
            match_type TEXT NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
          );

          -- Email filters table  
          CREATE TABLE IF NOT EXISTS email_filters (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            name TEXT NOT NULL,
            filter_type TEXT NOT NULL CHECK (filter_type IN ('sender', 'subject', 'content', 'attachment')),
            pattern TEXT NOT NULL,
            is_regex BOOLEAN NOT NULL DEFAULT 0,
            action TEXT NOT NULL CHECK (action IN ('move', 'label', 'delete', 'mark_read', 'mark_important')),
            action_value TEXT,
            is_enabled BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
          );

          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_email_rules_account_priority ON email_rules (account_id, priority);
          CREATE INDEX IF NOT EXISTS idx_email_filters_account_type ON email_filters (account_id, filter_type);

          -- Update schema version
          UPDATE schema_version SET version = 2, applied_at = CURRENT_TIMESTAMP;
        `,
        down: `
          DROP TABLE IF EXISTS email_filters;
          DROP TABLE IF EXISTS email_rules;
          UPDATE schema_version SET version = 1;
        `
      },
      {
        version: 3,
        description: 'Add email templates and scheduling tables',
        requiresBackup: true,
        up: `
          -- Email templates table
          CREATE TABLE IF NOT EXISTS email_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'general',
            subject TEXT NOT NULL,
            body_text TEXT,
            body_html TEXT,
            variables TEXT NOT NULL DEFAULT '[]', -- JSON array of variable names
            tags TEXT NOT NULL DEFAULT '[]',
            is_shared BOOLEAN NOT NULL DEFAULT 0,
            usage_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Scheduled emails table
          CREATE TABLE IF NOT EXISTS scheduled_emails (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            template_id TEXT,
            to_addresses TEXT NOT NULL, -- JSON array
            cc_addresses TEXT NOT NULL DEFAULT '[]',
            bcc_addresses TEXT NOT NULL DEFAULT '[]',
            subject TEXT NOT NULL,
            body_text TEXT,
            body_html TEXT,
            scheduled_at DATETIME NOT NULL,
            sent_at DATETIME,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
            error_message TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
            FOREIGN KEY (template_id) REFERENCES email_templates (id) ON DELETE SET NULL
          );

          -- Snoozed emails table
          CREATE TABLE IF NOT EXISTS snoozed_emails (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            snooze_until DATETIME NOT NULL,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
          );

          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates (category);
          CREATE INDEX IF NOT EXISTS idx_scheduled_emails_account_status ON scheduled_emails (account_id, status);
          CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON scheduled_emails (scheduled_at);
          CREATE INDEX IF NOT EXISTS idx_snoozed_emails_snooze_until ON snoozed_emails (snooze_until);

          -- Update schema version
          UPDATE schema_version SET version = 3, applied_at = CURRENT_TIMESTAMP;
        `,
        down: `
          DROP TABLE IF EXISTS snoozed_emails;
          DROP TABLE IF EXISTS scheduled_emails;
          DROP TABLE IF EXISTS email_templates;
          UPDATE schema_version SET version = 2;
        `
      },
      {
        version: 4,
        description: 'Add calendar privacy sync and webhook tables',
        requiresBackup: true,
        up: `
          -- Webhook subscriptions table
          CREATE TABLE IF NOT EXISTS webhook_subscriptions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'exchange', 'caldav', 'icloud', 'fastmail')),
            subscription_id TEXT NOT NULL,
            expiration DATETIME NOT NULL,
            webhook_url TEXT NOT NULL,
            resource_id TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES calendar_accounts (id) ON DELETE CASCADE,
            UNIQUE(account_id, subscription_id)
          );

          -- Sync operations log table
          CREATE TABLE IF NOT EXISTS sync_operations_log (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            calendar_id TEXT,
            operation_type TEXT NOT NULL, -- full_sync, incremental_sync, privacy_sync
            status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
            started_at DATETIME NOT NULL,
            completed_at DATETIME,
            duration_ms INTEGER,
            events_processed INTEGER DEFAULT 0,
            events_created INTEGER DEFAULT 0,
            events_updated INTEGER DEFAULT 0,
            events_deleted INTEGER DEFAULT 0,
            errors TEXT, -- JSON serialized array of errors
            sync_token TEXT,
            next_sync_token TEXT,
            FOREIGN KEY (account_id) REFERENCES calendar_accounts (id) ON DELETE CASCADE,
            FOREIGN KEY (calendar_id) REFERENCES calendars (id) ON DELETE CASCADE
          );

          -- Free/busy cache table
          CREATE TABLE IF NOT EXISTS freebusy_cache (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            email TEXT NOT NULL,
            time_min DATETIME NOT NULL,
            time_max DATETIME NOT NULL,
            busy_slots TEXT NOT NULL, -- JSON serialized array of FreeBusySlot
            cached_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (account_id) REFERENCES calendar_accounts (id) ON DELETE CASCADE,
            UNIQUE(account_id, email, time_min, time_max)
          );

          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_account_id ON webhook_subscriptions (account_id);
          CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_expiration ON webhook_subscriptions (expiration);
          CREATE INDEX IF NOT EXISTS idx_sync_operations_log_account_id ON sync_operations_log (account_id);
          CREATE INDEX IF NOT EXISTS idx_sync_operations_log_started_at ON sync_operations_log (started_at);
          CREATE INDEX IF NOT EXISTS idx_freebusy_cache_account_email ON freebusy_cache (account_id, email);
          CREATE INDEX IF NOT EXISTS idx_freebusy_cache_expires_at ON freebusy_cache (expires_at);

          -- Update schema version
          UPDATE schema_version SET version = 4, applied_at = CURRENT_TIMESTAMP;
        `,
        down: `
          DROP TABLE IF EXISTS freebusy_cache;
          DROP TABLE IF EXISTS sync_operations_log;
          DROP TABLE IF EXISTS webhook_subscriptions;
          UPDATE schema_version SET version = 3;
        `
      },
      {
        version: 5,
        description: 'Add search analytics and performance tracking',
        requiresBackup: false,
        up: `
          -- Search analytics table
          CREATE TABLE IF NOT EXISTS search_analytics (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            result_count INTEGER NOT NULL,
            execution_time_ms INTEGER NOT NULL,
            user_clicked BOOLEAN NOT NULL DEFAULT 0,
            clicked_result_id TEXT,
            search_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_agent TEXT,
            session_id TEXT
          );

          -- Search index statistics table
          CREATE TABLE IF NOT EXISTS search_index_stats (
            id TEXT PRIMARY KEY,
            total_documents INTEGER NOT NULL DEFAULT 0,
            total_size_bytes INTEGER NOT NULL DEFAULT 0,
            last_optimization DATETIME,
            last_commit DATETIME,
            segments_count INTEGER NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_search_analytics_timestamp ON search_analytics (search_timestamp);
          CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics (query);

          -- Initialize search index stats
          INSERT OR IGNORE INTO search_index_stats (id, updated_at) VALUES ('main', CURRENT_TIMESTAMP);

          -- Update schema version
          UPDATE schema_version SET version = 5, applied_at = CURRENT_TIMESTAMP;
        `,
        down: `
          DROP TABLE IF EXISTS search_index_stats;
          DROP TABLE IF EXISTS search_analytics;
          UPDATE schema_version SET version = 4;
        `
      }
    ];
  }

  /**
   * Get current database version
   */
  async getCurrentVersion(dbPath: string): Promise<number> {
    try {
      const sqlite3 = require('sqlite3').verbose();
      
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: any) => {
          if (err) {
            reject(err);
            return;
          }

          db.get('SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1', (err: Error | null, row?: { version?: number }) => {
            db.close();
            if (err) {
              reject(err);
            } else {
              resolve(row?.version || 1);
            }
          });
        });
      });
    } catch {
      return 1; // Default to version 1 if table doesn't exist
    }
  }

  /**
   * Get migration status for a database
   */
  async getMigrationStatus(dbPath: string): Promise<MigrationStatus> {
    const currentVersion = await this.getCurrentVersion(dbPath);
    const targetVersion = Math.max(...this.migrations.map(m => m.version));
    const appliedMigrations: number[] = [];
    
    // Get all applied migrations
    try {
      const sqlite3 = require('sqlite3').verbose();
      
      const applied = await new Promise<number[]>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: any) => {
          if (err) {
            reject(err);
            return;
          }

          db.all('SELECT version FROM schema_version ORDER BY version', (err, rows) => {
            db.close();
            if (err) {
              reject(err);
            } else {
              resolve((rows as any[]).map(row => row.version));
            }
          });
        });
      });
      
      appliedMigrations.push(...applied);
    } catch {
      appliedMigrations.push(currentVersion);
    }

    const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);

    return {
      currentVersion,
      targetVersion,
      pendingMigrations,
      appliedMigrations
    };
  }

  /**
   * Apply all pending migrations to a database
   */
  async applyMigrations(dbPath: string, createBackup: boolean = true): Promise<boolean> {
    try {
      const status = await this.getMigrationStatus(dbPath);
      
      if (status.pendingMigrations.length === 0) {
        log.info(`No pending migrations for ${dbPath}`);
        return true;
      }

      log.info(`Applying ${status.pendingMigrations.length} migrations to ${dbPath}`);

      // Create backup if any migration requires it
      if (createBackup && status.pendingMigrations.some(m => m.requiresBackup)) {
        await this.createBackup(dbPath);
      }

      const sqlite3 = require('sqlite3').verbose();
      
      for (const migration of status.pendingMigrations) {
        log.info(`Applying migration ${migration.version}: ${migration.description}`);
        
        const success = await new Promise<boolean>((resolve) => {
          const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              log.error(`Failed to open database for migration: ${err.message}`);
              resolve(false);
              return;
            }

            // Begin transaction
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                log.error(`Failed to begin transaction: ${err.message}`);
                db.close();
                resolve(false);
                return;
              }

              // Execute migration
              db.exec(migration.up, (err) => {
                if (err) {
                  log.error(`Migration ${migration.version} failed: ${err.message}`);
                  // Rollback transaction
                  db.run('ROLLBACK', () => {
                    db.close();
                    resolve(false);
                  });
                } else {
                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    db.close();
                    if (err) {
                      log.error(`Failed to commit migration: ${err.message}`);
                      resolve(false);
                    } else {
                      log.info(`Migration ${migration.version} completed successfully`);
                      resolve(true);
                    }
                  });
                }
              });
            });
          });
        });

        if (!success) {
          log.error(`Migration ${migration.version} failed, stopping migration process`);
          return false;
        }
      }

      log.info(`All migrations applied successfully to ${dbPath}`);
      return true;
    } catch (error) {
      log.error(`Failed to apply migrations to ${dbPath}:`, error);
      return false;
    }
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(dbPath: string, targetVersion: number): Promise<boolean> {
    try {
      const currentVersion = await this.getCurrentVersion(dbPath);
      
      if (targetVersion >= currentVersion) {
        log.info(`Database is already at or below version ${targetVersion}`);
        return true;
      }

      // Create backup before rollback
      await this.createBackup(dbPath);

      // Find migrations to rollback (in reverse order)
      const migrationsToRollback = this.migrations
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version);

      if (migrationsToRollback.length === 0) {
        log.info(`No migrations to rollback from version ${currentVersion} to ${targetVersion}`);
        return true;
      }

      log.info(`Rolling back ${migrationsToRollback.length} migrations from version ${currentVersion} to ${targetVersion}`);

      const sqlite3 = require('sqlite3').verbose();
      
      for (const migration of migrationsToRollback) {
        log.info(`Rolling back migration ${migration.version}: ${migration.description}`);
        
        const success = await new Promise<boolean>((resolve) => {
          const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              log.error(`Failed to open database for rollback: ${err.message}`);
              resolve(false);
              return;
            }

            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                log.error(`Failed to begin transaction: ${err.message}`);
                db.close();
                resolve(false);
                return;
              }

              db.exec(migration.down, (err) => {
                if (err) {
                  log.error(`Rollback of migration ${migration.version} failed: ${err.message}`);
                  db.run('ROLLBACK', () => {
                    db.close();
                    resolve(false);
                  });
                } else {
                  db.run('COMMIT', (err) => {
                    db.close();
                    if (err) {
                      log.error(`Failed to commit rollback: ${err.message}`);
                      resolve(false);
                    } else {
                      log.info(`Migration ${migration.version} rolled back successfully`);
                      resolve(true);
                    }
                  });
                }
              });
            });
          });
        });

        if (!success) {
          log.error(`Rollback of migration ${migration.version} failed, stopping rollback process`);
          return false;
        }
      }

      log.info(`Successfully rolled back to version ${targetVersion}`);
      return true;
    } catch (error) {
      log.error(`Failed to rollback database to version ${targetVersion}:`, error);
      return false;
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(dbPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.backup.${timestamp}`;
    
    await fs.copyFile(dbPath, backupPath);
    log.info(`Created backup: ${backupPath}`);
    
    return backupPath;
  }

  /**
   * Apply migrations to all databases
   */
  async applyAllMigrations(): Promise<boolean> {
    try {
      log.info('Starting migration process for all databases');
      
      const databases = [
        { path: this.mailDbPath, name: 'mail' },
        { path: this.calendarDbPath, name: 'calendar' }
      ];

      for (const db of databases) {
        if (!existsSync(db.path)) {
          log.debug(`Database ${db.name} does not exist, skipping migrations`);
          continue;
        }

        const success = await this.applyMigrations(db.path);
        if (!success) {
          log.error(`Failed to apply migrations to ${db.name} database`);
          return false;
        }
      }

      log.info('All database migrations completed successfully');
      return true;
    } catch (error) {
      log.error('Failed to apply migrations to all databases:', error);
      return false;
    }
  }

  /**
   * Get migration status for all databases
   */
  async getAllMigrationStatuses(): Promise<Record<string, MigrationStatus>> {
    const databases = [
      { path: this.mailDbPath, name: 'mail' },
      { path: this.calendarDbPath, name: 'calendar' }
    ];

    const statuses: Record<string, MigrationStatus> = {};

    for (const db of databases) {
      if (existsSync(db.path)) {
        statuses[db.name] = await this.getMigrationStatus(db.path);
      } else {
        statuses[db.name] = {
          currentVersion: 0,
          targetVersion: Math.max(...this.migrations.map(m => m.version)),
          pendingMigrations: this.migrations,
          appliedMigrations: []
        };
      }
    }

    return statuses;
  }

  /**
   * Clean up old backups (keep only the 5 most recent)
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const databases = [this.mailDbPath, this.calendarDbPath];
      
      for (const dbPath of databases) {
        const dbDir = join(dbPath, '..');
        const dbName = dbPath.split('/').pop()?.split('.')[0] || '';
        
        try {
          const files = await fs.readdir(dbDir);
          const backups = files
            .filter(f => f.startsWith(`${dbName}.db.backup.`))
            .map(f => ({ name: f, path: join(dbDir, f) }))
            .sort((a, b) => b.name.localeCompare(a.name)) // Sort by timestamp descending
            .slice(5); // Keep only files beyond the first 5

          for (const backup of backups) {
            await fs.unlink(backup.path);
            log.debug(`Removed old backup: ${backup.name}`);
          }
        } catch (error) {
          log.warn(`Failed to clean up backups for ${dbName}:`, error);
        }
      }
    } catch (error) {
      log.warn('Failed to clean up old backups:', error);
    }
  }
}

/**
 * Export singleton instance
 */
let migrationManager: DatabaseMigrationManager | null = null;

export function getDatabaseMigrationManager(mailDbPath: string, calendarDbPath: string): DatabaseMigrationManager {
  if (!migrationManager) {
    migrationManager = new DatabaseMigrationManager(mailDbPath, calendarDbPath);
  }
  return migrationManager;
}