/**
 * Rust Database Migration Manager - Pure Rust Backend Wrapper
 * 
 * This service uses the Rust migration system through NAPI bindings.
 * All migration operations are handled by the Rust backend.
 */

import log from 'electron-log';

// Import Rust migration bindings
const {
  runDatabaseMigrations,
  getMigrationStatus
} = require('@flow-desk/shared');

export interface MigrationStatus {
  id: string;
  applied: boolean;
  appliedAt?: Date;
  error?: string;
}

/**
 * Database Migration Manager using Rust backend
 */
export class RustDatabaseMigrationManager {
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
      log.info('Starting database migrations through Rust backend...');
      
      // Run migrations for mail database
      const mailMigrations = await runDatabaseMigrations('mail');
      log.info(`Applied ${mailMigrations.length} mail migrations`);
      
      // Run migrations for calendar database
      const calendarMigrations = await runDatabaseMigrations('calendar');
      log.info(`Applied ${calendarMigrations.length} calendar migrations`);
      
      // Check for any failed migrations
      const failedMigrations = [
        ...mailMigrations.filter((m: any) => m.error),
        ...calendarMigrations.filter((m: any) => m.error)
      ];
      
      if (failedMigrations.length > 0) {
        log.error('Some migrations failed:', failedMigrations);
        return false;
      }
      
      log.info('All database migrations completed successfully');
      return true;
    } catch (error) {
      log.error('Database migration process failed:', error);
      return false;
    }
  }

  /**
   * Get migration status for all databases
   */
  async getAllMigrationStatuses(): Promise<Record<string, MigrationStatus[]>> {
    try {
      const mailStatuses = await getMigrationStatus('mail');
      const calendarStatuses = await getMigrationStatus('calendar');
      
      // Convert timestamps to Date objects
      const convertStatus = (statuses: any[]): MigrationStatus[] => {
        return statuses.map(status => ({
          ...status,
          appliedAt: status.applied_at ? new Date(status.applied_at * 1000) : undefined
        }));
      };
      
      return {
        mail: convertStatus(mailStatuses),
        calendar: convertStatus(calendarStatuses)
      };
    } catch (error) {
      log.error('Failed to get migration statuses:', error);
      return {
        mail: [],
        calendar: []
      };
    }
  }

  /**
   * Get migration status for a specific database
   */
  async getMigrationStatus(dbType: 'mail' | 'calendar'): Promise<MigrationStatus[]> {
    try {
      const statuses = await getMigrationStatus(dbType);
      
      // Convert timestamps to Date objects
      return statuses.map((status: any) => ({
        ...status,
        appliedAt: status.applied_at ? new Date(status.applied_at * 1000) : undefined
      }));
    } catch (error) {
      log.error(`Failed to get migration status for ${dbType}:`, error);
      return [];
    }
  }

  /**
   * Check database health and integrity
   */
  async checkDatabaseHealth(dbType: 'mail' | 'calendar'): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      // Import health check function
      const { checkDatabaseHealth } = require('@flow-desk/shared');
      
      const healthReports = await checkDatabaseHealth();
      
      // Find the report for the requested database type
      const report = healthReports.find((r: any) => 
        (dbType === 'mail' && r.healthy !== undefined) ||
        (dbType === 'calendar' && r.healthy !== undefined)
      );
      
      if (report) {
        return {
          healthy: report.healthy,
          issues: report.issues || [],
          recommendations: report.recommendations || []
        };
      }
      
      return {
        healthy: true,
        issues: [],
        recommendations: []
      };
    } catch (error) {
      log.error(`Failed to check ${dbType} database health:`, error);
      return {
        healthy: false,
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Check database logs and consider repair']
      };
    }
  }

  /**
   * Repair database issues
   */
  async repairDatabase(dbType: 'mail' | 'calendar'): Promise<boolean> {
    try {
      log.info(`Starting database repair for ${dbType} database through Rust backend`);
      
      // Import repair function
      const { repairDatabases } = require('@flow-desk/shared');
      
      const repairResults = await repairDatabases();
      
      // Check if repair was successful
      const success = repairResults.every((result: any) => result.healthy);
      
      if (success) {
        log.info(`Database repair completed for ${dbType}`);
      } else {
        log.error(`Database repair failed for ${dbType}:`, repairResults);
      }
      
      return success;
    } catch (error) {
      log.error(`Failed to repair ${dbType} database:`, error);
      return false;
    }
  }

  /**
   * Rollback a specific migration (if supported by Rust backend)
   */
  async rollbackMigration(migrationId: string, dbType: 'mail' | 'calendar'): Promise<boolean> {
    try {
      log.warn(`Migration rollback for ${migrationId} requested but not implemented in Rust backend`);
      log.warn('Rollback functionality needs to be implemented in the Rust migration system');
      return false;
    } catch (error) {
      log.error(`Failed to rollback migration ${migrationId}:`, error);
      return false;
    }
  }
}

/**
 * Export singleton factory function
 */
let rustMigrationManager: RustDatabaseMigrationManager | null = null;

export function getRustDatabaseMigrationManager(
  mailDbPath: string, 
  calendarDbPath: string
): RustDatabaseMigrationManager {
  if (!rustMigrationManager) {
    rustMigrationManager = new RustDatabaseMigrationManager(mailDbPath, calendarDbPath);
  }
  return rustMigrationManager;
}