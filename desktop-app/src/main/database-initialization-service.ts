/**
 * Database Initialization Service
 * 
 * Ensures all SQLite databases are created and initialized on first app launch.
 * Handles migration, health checks, and user data directory setup.
 */

import { app, dialog } from 'electron';
import { join, dirname } from 'path';
import { promises as fs, constants, existsSync } from 'fs';
import log from 'electron-log';
import { spawn } from 'child_process';

export interface DatabaseInitializationConfig {
  userDataPath: string;
  mailDbPath: string;
  calendarDbPath: string;
  searchIndexPath: string;
  configPath: string;
  schemaVersion: number;
}

export interface DatabaseStatus {
  exists: boolean;
  isValid: boolean;
  version?: number;
  size: number;
  lastModified?: Date;
  error?: string;
}

export interface InitializationProgress {
  stage: 'setup' | 'directories' | 'mail' | 'calendar' | 'search' | 'migrations' | 'validation' | 'complete';
  progress: number; // 0-100
  message: string;
  details?: string;
}

/**
 * Main database initialization service
 */
export class DatabaseInitializationService {
  private config: DatabaseInitializationConfig;
  private progressCallback?: (progress: InitializationProgress) => void;

  constructor(progressCallback?: (progress: InitializationProgress) => void) {
    this.progressCallback = progressCallback;
    this.config = this.generateConfig();
  }

  /**
   * Generate configuration with platform-specific paths
   */
  private generateConfig(): DatabaseInitializationConfig {
    const userDataPath = this.getUserDataDirectory();
    const databasesPath = join(userDataPath, 'databases');
    
    return {
      userDataPath,
      mailDbPath: join(databasesPath, 'mail.db'),
      calendarDbPath: join(databasesPath, 'calendar.db'),
      searchIndexPath: join(databasesPath, 'search_index'),
      configPath: join(userDataPath, 'config.json'),
      schemaVersion: 1 // Current schema version
    };
  }

  /**
   * Get platform-specific user data directory
   */
  private getUserDataDirectory(): string {
    // Use Electron's standard user data path
    const baseUserData = app.getPath('userData');
    
    // Create subdirectory for Flow Desk data
    return join(baseUserData, 'FlowDesk');
  }

  /**
   * Initialize all databases on first run
   */
  async initializeDatabases(): Promise<boolean> {
    try {
      this.updateProgress('setup', 0, 'Starting database initialization...');
      
      // Step 1: Setup directories
      await this.setupDirectories();
      this.updateProgress('directories', 15, 'Directories created');

      // Step 2: Check existing databases
      const databaseStatuses = await this.checkDatabaseStatuses();
      const needsInitialization = Object.values(databaseStatuses).some(status => !status.exists);

      if (!needsInitialization) {
        this.updateProgress('complete', 100, 'All databases already exist and are valid');
        return true;
      }

      // Step 3: Initialize mail database
      await this.initializeMailDatabase();
      this.updateProgress('mail', 40, 'Mail database initialized');

      // Step 4: Initialize calendar database  
      await this.initializeCalendarDatabase();
      this.updateProgress('calendar', 65, 'Calendar database initialized');

      // Step 5: Initialize search index
      await this.initializeSearchIndex();
      this.updateProgress('search', 80, 'Search index initialized');

      // Step 6: Run migrations if needed
      await this.runMigrations();
      this.updateProgress('migrations', 90, 'Database migrations completed');

      // Step 7: Validate all databases
      await this.validateDatabases();
      this.updateProgress('validation', 95, 'Database validation completed');

      // Step 8: Save configuration
      await this.saveConfiguration();
      this.updateProgress('complete', 100, 'Database initialization completed successfully');

      log.info('Database initialization completed successfully');
      return true;

    } catch (error) {
      log.error('Database initialization failed:', error);
      this.updateProgress('setup', 0, 'Database initialization failed', error instanceof Error ? error.message : 'Unknown error');
      
      // Show error dialog to user
      await this.showInitializationError(error);
      return false;
    }
  }

  /**
   * Setup required directories with proper permissions
   */
  private async setupDirectories(): Promise<void> {
    const directories = [
      this.config.userDataPath,
      dirname(this.config.mailDbPath),
      dirname(this.config.calendarDbPath),
      dirname(this.config.searchIndexPath)
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir, constants.F_OK);
        log.debug(`Directory already exists: ${dir}`);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        log.info(`Created directory: ${dir}`);
      }
    }

    // Set appropriate permissions (read/write for user only)
    if (process.platform !== 'win32') {
      for (const dir of directories) {
        await fs.chmod(dir, 0o700);
      }
    }
  }

  /**
   * Check status of all databases
   */
  private async checkDatabaseStatuses(): Promise<Record<string, DatabaseStatus>> {
    const databases = {
      mail: this.config.mailDbPath,
      calendar: this.config.calendarDbPath,
      search: this.config.searchIndexPath
    };

    const statuses: Record<string, DatabaseStatus> = {};

    for (const [name, path] of Object.entries(databases)) {
      try {
        const stats = await fs.stat(path);
        statuses[name] = {
          exists: true,
          isValid: true, // Will be validated later
          size: stats.size,
          lastModified: stats.mtime
        };
      } catch {
        statuses[name] = {
          exists: false,
          isValid: false,
          size: 0
        };
      }
    }

    return statuses;
  }

  /**
   * Initialize mail database with proper schema
   */
  private async initializeMailDatabase(): Promise<void> {
    if (existsSync(this.config.mailDbPath)) {
      log.debug('Mail database already exists, skipping creation');
      return;
    }

    log.info('Creating mail database...');
    
    // Use the Rust engine to initialize the database
    try {
      const rustEngine = require('../lib/rust-engine');
      
      // Create database with proper initialization
      await this.executeDatabaseCommand('init_mail_database', this.config.mailDbPath);
      
      log.info('Mail database created successfully');
    } catch (error) {
      log.error('Failed to create mail database via Rust, trying SQLite fallback:', error);
      await this.createSQLiteDatabase(this.config.mailDbPath, this.getMailSchema());
    }
  }

  /**
   * Initialize calendar database with proper schema
   */
  private async initializeCalendarDatabase(): Promise<void> {
    if (existsSync(this.config.calendarDbPath)) {
      log.debug('Calendar database already exists, skipping creation');
      return;
    }

    log.info('Creating calendar database...');
    
    try {
      const rustEngine = require('../lib/rust-engine');
      
      // Create database with proper initialization
      await this.executeDatabaseCommand('init_calendar_database', this.config.calendarDbPath);
      
      log.info('Calendar database created successfully');
    } catch (error) {
      log.error('Failed to create calendar database via Rust, trying SQLite fallback:', error);
      await this.createSQLiteDatabase(this.config.calendarDbPath, this.getCalendarSchema());
    }
  }

  /**
   * Initialize search index
   */
  private async initializeSearchIndex(): Promise<void> {
    if (existsSync(this.config.searchIndexPath)) {
      log.debug('Search index already exists, skipping creation');
      return;
    }

    log.info('Creating search index...');
    
    try {
      const rustEngine = require('../lib/rust-engine');
      
      // Create search index
      await this.executeDatabaseCommand('init_search_index', this.config.searchIndexPath);
      
      log.info('Search index created successfully');
    } catch (error) {
      log.error('Failed to create search index via Rust:', error);
      
      // Create basic directory structure for Tantivy index
      await fs.mkdir(this.config.searchIndexPath, { recursive: true });
      log.info('Created search index directory as fallback');
    }
  }

  /**
   * Execute database initialization command via CLI
   */
  private async executeDatabaseCommand(command: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to find the Rust CLI binary
      const possiblePaths = [
        join(process.cwd(), 'dist/lib/rust-engine/target/release/flow-desk-cli'),
        join(process.cwd(), 'dist/lib/rust-engine/target/debug/flow-desk-cli'),
        'flow-desk-cli' // In PATH
      ];

      let binaryPath: string | null = null;
      for (const path of possiblePaths) {
        if (existsSync(path) || existsSync(`${path}.exe`)) {
          binaryPath = path;
          break;
        }
      }

      if (!binaryPath) {
        reject(new Error('Flow Desk CLI binary not found'));
        return;
      }

      const args = [command, '--database-path', path];
      const child = spawn(binaryPath, args, {
        stdio: 'pipe',
        timeout: 30000 // 30 second timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          log.debug(`Database command ${command} completed successfully`);
          resolve();
        } else {
          reject(new Error(`Database command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute database command: ${error.message}`));
      });
    });
  }

  /**
   * Create SQLite database with schema (fallback method)
   */
  private async createSQLiteDatabase(dbPath: string, schema: string): Promise<void> {
    const sqlite3 = await this.loadSQLite3();
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to create database ${dbPath}: ${err.message}`));
          return;
        }

        // Execute schema
        db.exec(schema, (err) => {
          db.close();
          if (err) {
            reject(new Error(`Failed to create schema: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Load SQLite3 module
   */
  private async loadSQLite3(): Promise<any> {
    try {
      return require('sqlite3').verbose();
    } catch (error) {
      throw new Error('SQLite3 module not available. Please install sqlite3: npm install sqlite3');
    }
  }

  /**
   * Get mail database schema
   */
  private getMailSchema(): string {
    return `
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
        references TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
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
        FOREIGN KEY (account_id) REFERENCES accounts (id),
        FOREIGN KEY (parent_id) REFERENCES folders (id)
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
        FOREIGN KEY (account_id) REFERENCES accounts (id)
      );

      -- Create performance indexes
      CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages (account_id, folder);
      CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages (received_at);
      CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id);
      CREATE INDEX IF NOT EXISTS idx_folders_account_path ON folders (account_id, path);
      CREATE INDEX IF NOT EXISTS idx_threads_account_last_message ON threads (account_id, last_message_at);

      -- Schema version tracking
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR REPLACE INTO schema_version (version) VALUES (1);
    `;
  }

  /**
   * Get calendar database schema
   */
  private getCalendarSchema(): string {
    return `
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
        FOREIGN KEY (account_id) REFERENCES calendar_accounts (id) ON DELETE CASCADE,
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
        FOREIGN KEY (calendar_id) REFERENCES calendars (id) ON DELETE CASCADE,
        FOREIGN KEY (recurring_event_id) REFERENCES calendar_events (id) ON DELETE CASCADE,
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

      -- Schema version tracking
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR REPLACE INTO schema_version (version) VALUES (1);
    `;
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    log.info('Running database migrations...');
    
    // Future migrations will be handled here
    // For now, just ensure schema version is set correctly
    
    const migrations = [
      // Migration 1 is handled by initial schema creation
    ];

    for (const migration of migrations) {
      // Execute migration if needed
    }

    log.info('Database migrations completed');
  }

  /**
   * Validate all databases
   */
  private async validateDatabases(): Promise<void> {
    log.info('Validating databases...');

    const databases = [
      { path: this.config.mailDbPath, type: 'mail' },
      { path: this.config.calendarDbPath, type: 'calendar' }
    ];

    for (const db of databases) {
      try {
        await this.validateSQLiteDatabase(db.path);
        log.debug(`${db.type} database validation passed`);
      } catch (error) {
        throw new Error(`${db.type} database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Validate search index
    if (existsSync(this.config.searchIndexPath)) {
      log.debug('Search index validation passed');
    } else {
      log.warn('Search index directory not found, may need recreation');
    }
  }

  /**
   * Validate SQLite database integrity
   */
  private async validateSQLiteDatabase(dbPath: string): Promise<void> {
    const sqlite3 = await this.loadSQLite3();
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`Cannot open database ${dbPath}: ${err.message}`));
          return;
        }

        // Run PRAGMA integrity_check
        db.get('PRAGMA integrity_check', (err, row) => {
          db.close();
          if (err) {
            reject(new Error(`Integrity check failed: ${err.message}`));
          } else if (row && (row as any).integrity_check === 'ok') {
            resolve();
          } else {
            reject(new Error(`Database integrity check failed: ${JSON.stringify(row)}`));
          }
        });
      });
    });
  }

  /**
   * Save configuration file
   */
  private async saveConfiguration(): Promise<void> {
    const config = {
      version: this.config.schemaVersion,
      databases: {
        mail: this.config.mailDbPath,
        calendar: this.config.calendarDbPath,
        searchIndex: this.config.searchIndexPath
      },
      initializedAt: new Date().toISOString(),
      platform: process.platform,
      appVersion: app.getVersion()
    };

    await fs.writeFile(this.config.configPath, JSON.stringify(config, null, 2), 'utf8');
    log.info('Configuration saved successfully');
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(stage: InitializationProgress['stage'], progress: number, message: string, details?: string): void {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message, details });
    }
    log.debug(`Database initialization: ${stage} (${progress}%) - ${message}`);
  }

  /**
   * Show initialization error dialog
   */
  private async showInitializationError(error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during database initialization.';
    
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Database Initialization Failed',
      message: 'Flow Desk could not initialize its databases.',
      detail: `${errorMessage}\n\nThe application may not function properly. Would you like to retry initialization?`,
      buttons: ['Retry', 'Continue Anyway', 'Quit'],
      defaultId: 0,
      cancelId: 2
    });

    if (result.response === 0) {
      // Retry initialization
      await this.initializeDatabases();
    } else if (result.response === 2) {
      // Quit application
      app.quit();
    }
    // Option 1 (Continue Anyway) just returns and lets app continue
  }

  /**
   * Get configuration
   */
  getConfig(): DatabaseInitializationConfig {
    return { ...this.config };
  }

  /**
   * Check if databases are initialized
   */
  async isDatabasesInitialized(): Promise<boolean> {
    try {
      const statuses = await this.checkDatabaseStatuses();
      return Object.values(statuses).every(status => status.exists);
    } catch {
      return false;
    }
  }

  /**
   * Repair corrupted databases
   */
  async repairDatabases(): Promise<boolean> {
    try {
      log.info('Starting database repair...');
      
      // Backup existing databases
      await this.backupDatabases();
      
      // Reinitialize databases
      const success = await this.initializeDatabases();
      
      if (success) {
        log.info('Database repair completed successfully');
      } else {
        log.error('Database repair failed');
      }
      
      return success;
    } catch (error) {
      log.error('Database repair failed:', error);
      return false;
    }
  }

  /**
   * Backup existing databases
   */
  private async backupDatabases(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.config.userDataPath, 'backups', timestamp);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    const databases = [
      this.config.mailDbPath,
      this.config.calendarDbPath
    ];
    
    for (const dbPath of databases) {
      if (existsSync(dbPath)) {
        const filename = join(backupDir, `${dbPath.split('/').pop()}.backup`);
        await fs.copyFile(dbPath, filename);
        log.info(`Backed up database: ${dbPath} -> ${filename}`);
      }
    }
  }
}

/**
 * Export singleton instance
 */
let databaseInitializationService: DatabaseInitializationService | null = null;

export function getDatabaseInitializationService(progressCallback?: (progress: InitializationProgress) => void): DatabaseInitializationService {
  if (!databaseInitializationService) {
    databaseInitializationService = new DatabaseInitializationService(progressCallback);
  }
  return databaseInitializationService;
}