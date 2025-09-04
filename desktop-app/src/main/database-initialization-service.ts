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
import { getDatabaseMigrationManager } from './database-migration-manager';

// SQLite3 type definitions
interface SQLite3Database {
  exec(sql: string, callback?: (err: Error | null) => void): void;
  get(sql: string, callback?: (err: Error | null, row?: SQLiteRow) => void): void;
  close(callback?: (err: Error | null) => void): void;
}

interface SQLiteRow {
  [key: string]: string | number | null;
}

interface IntegrityCheckRow {
  integrity_check?: string;
  [key: string]: string | number | null | undefined;
}

interface VersionRow {
  version?: number;
  [key: string]: string | number | null | undefined;
}

interface SQLite3Module {
  Database: new (filename: string, mode?: number, callback?: (err: Error | null) => void) => SQLite3Database;
  OPEN_READONLY: number;
  verbose(): SQLite3Module;
}

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
    this.progressCallback = progressCallback || undefined;
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
    
    // Create empty database file first
    try {
      // Create an empty SQLite database - migrations will handle the schema
      const sqlite3 = await this.loadSQLite3();
      
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(this.config.mailDbPath, (err: Error | null) => {
          if (err) {
            reject(new Error(`Failed to create mail database: ${err.message}`));
          } else {
            // Just close it immediately - migrations will create the schema
            db.close((closeErr: any) => {
              if (closeErr) {
                reject(new Error(`Failed to close mail database: ${closeErr.message}`));
              } else {
                log.info('Mail database file created successfully');
                resolve();
              }
            });
          }
        });
      });
    } catch (error) {
      log.error('Failed to create mail database:', error);
      throw error;
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
    
    // Create empty database file first
    try {
      // Create an empty SQLite database - migrations will handle the schema
      const sqlite3 = await this.loadSQLite3();
      
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(this.config.calendarDbPath, (err: Error | null) => {
          if (err) {
            reject(new Error(`Failed to create calendar database: ${err.message}`));
          } else {
            // Just close it immediately - migrations will create the schema
            db.close((closeErr: any) => {
              if (closeErr) {
                reject(new Error(`Failed to close calendar database: ${closeErr.message}`));
              } else {
                log.info('Calendar database file created successfully');
                resolve();
              }
            });
          }
        });
      });
    } catch (error) {
      log.error('Failed to create calendar database:', error);
      throw error;
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
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    log.info('Running database migrations...');
    
    try {
      // Get the migration manager
      const migrationManager = getDatabaseMigrationManager(
        this.config.mailDbPath,
        this.config.calendarDbPath
      );
      
      // Apply all pending migrations
      const success = await migrationManager.applyAllMigrations();
      
      if (success) {
        log.info('Database migrations completed successfully');
      } else {
        throw new Error('Some database migrations failed');
      }
    } catch (error) {
      log.error('Database migration failed:', error);
      throw new Error(`Failed to run database migrations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(new Error(`Cannot open database ${dbPath}: ${err.message}`));
          return;
        }

        // Run PRAGMA integrity_check
        db.get('PRAGMA integrity_check', (err: Error | null, row?: IntegrityCheckRow) => {
          db.close();
          if (err) {
            reject(new Error(`Integrity check failed: ${err.message}`));
          } else if (row && row.integrity_check === 'ok') {
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
      this.progressCallback({ 
        stage, 
        progress, 
        message,
        ...(details && { details })
      });
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