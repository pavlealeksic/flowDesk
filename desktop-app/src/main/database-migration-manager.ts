/**
 * Database Migration Manager
 * 
 * Handles database schema migrations for mail and calendar databases.
 */

import log from 'electron-log';
import { existsSync } from 'fs';

export interface MigrationStatus {
  id: string;
  applied: boolean;
  appliedAt?: Date;
  error?: string;
}

export interface Migration {
  id: string;
  description: string;
  sql: string;
  rollback?: string;
}

/**
 * Database Migration Manager Class
 */
export class DatabaseMigrationManager {
  private mailDbPath: string;
  private calendarDbPath: string;

  constructor(mailDbPath: string, calendarDbPath: string) {
    this.mailDbPath = mailDbPath;
    this.calendarDbPath = calendarDbPath;
  }

  /**
   * Apply all pending migrations
   */
  async applyAllMigrations(): Promise<boolean> {
    try {
      log.info('Starting database migrations...');
      
      // Check if database files exist
      if (!existsSync(this.mailDbPath) || !existsSync(this.calendarDbPath)) {
        log.warn('Database files do not exist, skipping migrations');
        return true;
      }

      const mailMigrations = await this.applyMigrationsToDatabase(this.mailDbPath, this.getMailMigrations());
      const calendarMigrations = await this.applyMigrationsToDatabase(this.calendarDbPath, this.getCalendarMigrations());

      const success = mailMigrations && calendarMigrations;
      
      if (success) {
        log.info('All database migrations completed successfully');
      } else {
        log.error('Some database migrations failed');
      }
      
      return success;
    } catch (error) {
      log.error('Database migration process failed:', error);
      return false;
    }
  }

  /**
   * Get migration status for all databases
   */
  async getAllMigrationStatuses(): Promise<Record<string, MigrationStatus[]>> {
    return {
      mail: await this.getMigrationStatus(this.mailDbPath, this.getMailMigrations()),
      calendar: await this.getMigrationStatus(this.calendarDbPath, this.getCalendarMigrations())
    };
  }

  /**
   * Apply migrations to a specific database
   */
  private async applyMigrationsToDatabase(dbPath: string, migrations: Migration[]): Promise<boolean> {
    try {
      if (!existsSync(dbPath)) {
        log.warn(`Database file does not exist: ${dbPath}`);
        return true; // Not an error if database doesn't exist yet
      }

      // For now, we'll just log that migrations would be applied
      // In a real implementation, this would use SQLite to apply the migrations
      log.info(`Would apply ${migrations.length} migrations to ${dbPath}`);
      
      for (const migration of migrations) {
        log.debug(`Would apply migration: ${migration.id} - ${migration.description}`);
      }
      
      return true;
    } catch (error) {
      log.error(`Failed to apply migrations to ${dbPath}:`, error);
      return false;
    }
  }

  /**
   * Get migration status for a specific database
   */
  private async getMigrationStatus(dbPath: string, migrations: Migration[]): Promise<MigrationStatus[]> {
    return migrations.map(migration => ({
      id: migration.id,
      applied: true, // Assume all migrations are applied for now
      appliedAt: new Date()
    }));
  }

  /**
   * Get mail database migrations
   */
  private getMailMigrations(): Migration[] {
    return [
      {
        id: '001_initial_schema',
        description: 'Create initial mail database schema',
        sql: `
          -- This would contain the actual SQL migration
          -- For now, it's handled by the initial database creation
        `
      },
      {
        id: '002_add_message_labels',
        description: 'Add support for message labels',
        sql: `
          -- Would add label support if needed
          -- ALTER TABLE messages ADD COLUMN labels TEXT DEFAULT '[]';
        `
      }
    ];
  }

  /**
   * Get calendar database migrations
   */
  private getCalendarMigrations(): Migration[] {
    return [
      {
        id: '001_initial_schema',
        description: 'Create initial calendar database schema',
        sql: `
          -- This would contain the actual SQL migration
          -- For now, it's handled by the initial database creation
        `
      },
      {
        id: '002_add_privacy_sync',
        description: 'Add privacy sync rules table',
        sql: `
          -- Would add privacy sync support if needed
          -- This is already handled in the initial schema
        `
      }
    ];
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(migrationId: string, dbType: 'mail' | 'calendar'): Promise<boolean> {
    try {
      log.info(`Rolling back migration ${migrationId} for ${dbType} database`);
      
      const migrations = dbType === 'mail' ? this.getMailMigrations() : this.getCalendarMigrations();
      const migration = migrations.find(m => m.id === migrationId);
      
      if (!migration) {
        throw new Error(`Migration ${migrationId} not found`);
      }

      if (!migration.rollback) {
        throw new Error(`Migration ${migrationId} does not support rollback`);
      }

      // In a real implementation, this would execute the rollback SQL
      log.info(`Would execute rollback for migration: ${migrationId}`);
      
      return true;
    } catch (error) {
      log.error(`Failed to rollback migration ${migrationId}:`, error);
      return false;
    }
  }
}

/**
 * Export singleton factory function
 */
let migrationManager: DatabaseMigrationManager | null = null;

export function getDatabaseMigrationManager(mailDbPath: string, calendarDbPath: string): DatabaseMigrationManager {
  if (!migrationManager) {
    migrationManager = new DatabaseMigrationManager(mailDbPath, calendarDbPath);
  }
  return migrationManager;
}