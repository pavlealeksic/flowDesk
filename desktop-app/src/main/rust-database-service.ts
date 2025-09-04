/**
 * Rust Database Service - Pure Rust Backend Wrapper
 * 
 * This service uses the Rust SQLite backend through NAPI bindings.
 * All database operations are handled by the Rust backend for better performance and memory safety.
 */

import { app, dialog } from 'electron';
import { join } from 'path';
import log from 'electron-log';

// Import Rust database bindings
const {
  initFlowDeskDatabase,
  initializeAllDatabases,
  checkDatabaseHealth,
  repairDatabases,
  backupDatabases,
  runDatabaseMigrations,
  getDatabaseStats,
  getMigrationStatus
} = require('@flow-desk/shared');

export interface DatabaseConfig {
  userDataPath: string;
  mailDbPath: string;
  calendarDbPath: string;
  searchIndexPath: string;
  schemaVersion: number;
}

export interface DatabaseInitProgress {
  stage: 'setup' | 'directories' | 'mail' | 'calendar' | 'search' | 'migrations' | 'validation' | 'complete';
  progress: number; // 0-100
  message: string;
  details?: string;
}

export interface DatabaseHealth {
  healthy: boolean;
  issues: string[];
  recommendations: string[];
}

export interface MigrationStatus {
  id: string;
  applied: boolean;
  appliedAt?: number; // Unix timestamp
  error?: string;
}

/**
 * Main database initialization service using pure Rust backend
 */
export class RustDatabaseService {
  private config: DatabaseConfig;
  private progressCallback?: (progress: DatabaseInitProgress) => void;
  private initialized = false;

  constructor(progressCallback?: (progress: DatabaseInitProgress) => void) {
    this.progressCallback = progressCallback || undefined;
    this.config = this.generateConfig();
  }

  /**
   * Generate configuration with platform-specific paths
   */
  private generateConfig(): DatabaseConfig {
    const userDataPath = this.getUserDataDirectory();
    const databasesPath = join(userDataPath, 'databases');
    
    return {
      userDataPath,
      mailDbPath: join(databasesPath, 'mail.db'),
      calendarDbPath: join(databasesPath, 'calendar.db'),
      searchIndexPath: join(databasesPath, 'search_index'),
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
   * Initialize the Rust database backend
   */
  async initializeDatabaseBackend(): Promise<void> {
    if (this.initialized) {
      log.debug('Database backend already initialized');
      return;
    }

    try {
      const rustConfig = {
        mail_db_path: this.config.mailDbPath,
        calendar_db_path: this.config.calendarDbPath,
        search_index_path: this.config.searchIndexPath,
        user_data_path: this.config.userDataPath,
        schema_version: this.config.schemaVersion
      };

      const result = await initFlowDeskDatabase(rustConfig);
      log.info('Rust database backend initialized:', result);
      this.initialized = true;
    } catch (error) {
      log.error('Failed to initialize Rust database backend:', error);
      throw new Error(`Database backend initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize all databases on first run
   */
  async initializeDatabases(): Promise<boolean> {
    try {
      this.updateProgress('setup', 0, 'Starting database initialization...');
      
      // Initialize the Rust database backend first
      await this.initializeDatabaseBackend();

      // Initialize all databases through Rust backend
      const progressUpdates: DatabaseInitProgress[] = await initializeAllDatabases();
      
      // Report progress to callback
      for (const progress of progressUpdates) {
        this.updateProgress(
          progress.stage as any,
          progress.progress,
          progress.message,
          progress.details
        );
      }

      log.info('Database initialization completed successfully through Rust backend');
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
   * Check database health
   */
  async checkDatabaseHealth(): Promise<DatabaseHealth[]> {
    try {
      await this.initializeDatabaseBackend();
      const healthReports: DatabaseHealth[] = await checkDatabaseHealth();
      return healthReports;
    } catch (error) {
      log.error('Database health check failed:', error);
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Repair corrupted databases
   */
  async repairDatabases(): Promise<boolean> {
    try {
      log.info('Starting database repair through Rust backend...');
      
      await this.initializeDatabaseBackend();
      const repairResults: DatabaseHealth[] = await repairDatabases();
      
      // Check if all repairs were successful
      const success = repairResults.every(result => result.healthy);
      
      if (success) {
        log.info('Database repair completed successfully');
      } else {
        log.error('Database repair failed for some databases:', repairResults);
      }
      
      return success;
    } catch (error) {
      log.error('Database repair failed:', error);
      return false;
    }
  }

  /**
   * Backup all databases
   */
  async backupDatabases(backupDir?: string): Promise<string[]> {
    try {
      const backupDirectory = backupDir || join(this.config.userDataPath, 'backups');
      
      await this.initializeDatabaseBackend();
      const backupFiles: string[] = await backupDatabases(backupDirectory);
      
      log.info('Database backup completed:', backupFiles);
      return backupFiles;
    } catch (error) {
      log.error('Database backup failed:', error);
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    log.info('Running database migrations through Rust backend...');
    
    try {
      await this.initializeDatabaseBackend();
      
      // Run migrations for both databases
      const mailMigrations = await runDatabaseMigrations('mail');
      const calendarMigrations = await runDatabaseMigrations('calendar');
      
      // Check for any failed migrations
      const failedMigrations = [
        ...mailMigrations.filter((m: MigrationStatus) => m.error),
        ...calendarMigrations.filter((m: MigrationStatus) => m.error)
      ];
      
      if (failedMigrations.length > 0) {
        throw new Error(`Some migrations failed: ${JSON.stringify(failedMigrations)}`);
      }
      
      log.info('Database migrations completed successfully');
    } catch (error) {
      log.error('Database migration failed:', error);
      throw new Error(`Failed to run database migrations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get migration status for all databases
   */
  async getMigrationStatus(): Promise<{ mail: MigrationStatus[], calendar: MigrationStatus[] }> {
    try {
      await this.initializeDatabaseBackend();
      
      const mailStatus = await getMigrationStatus('mail');
      const calendarStatus = await getMigrationStatus('calendar');
      
      return {
        mail: mailStatus,
        calendar: calendarStatus
      };
    } catch (error) {
      log.error('Failed to get migration status:', error);
      throw new Error(`Failed to get migration status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{ mail: any, calendar: any }> {
    try {
      await this.initializeDatabaseBackend();
      
      const mailStatsJson = await getDatabaseStats('mail');
      const calendarStatsJson = await getDatabaseStats('calendar');
      
      return {
        mail: JSON.parse(mailStatsJson),
        calendar: JSON.parse(calendarStatsJson)
      };
    } catch (error) {
      log.error('Failed to get database stats:', error);
      throw new Error(`Failed to get database stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if databases are initialized
   */
  async isDatabasesInitialized(): Promise<boolean> {
    try {
      const healthReports = await this.checkDatabaseHealth();
      return healthReports.every(report => report.healthy);
    } catch {
      return false;
    }
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(
    stage: DatabaseInitProgress['stage'], 
    progress: number, 
    message: string, 
    details?: string
  ): void {
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
  getConfig(): DatabaseConfig {
    return { ...this.config };
  }
}

/**
 * Export singleton instance
 */
let rustDatabaseService: RustDatabaseService | null = null;

export function getRustDatabaseService(progressCallback?: (progress: DatabaseInitProgress) => void): RustDatabaseService {
  if (!rustDatabaseService) {
    rustDatabaseService = new RustDatabaseService(progressCallback);
  }
  return rustDatabaseService;
}