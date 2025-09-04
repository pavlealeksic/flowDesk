/**
 * Rust Database Test
 * 
 * Tests the Rust database backend integration through NAPI bindings
 */

import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import { getRustDatabaseService } from '../main/rust-database-service';
import { getRustDatabaseMigrationManager } from '../main/rust-migration-manager';

describe('Rust Database Backend', () => {
  let testDir: string;
  let databaseService: any;

  beforeAll(async () => {
    // Create temporary directory for test databases
    testDir = join(tmpdir(), 'flow-desk-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  beforeEach(() => {
    // Create new database service for each test
    databaseService = getRustDatabaseService();
    
    // Override config to use test directory
    (databaseService as any).config = {
      userDataPath: testDir,
      mailDbPath: join(testDir, 'mail.db'),
      calendarDbPath: join(testDir, 'calendar.db'),
      searchIndexPath: join(testDir, 'search_index'),
      schemaVersion: 1
    };
  });

  describe('Database Initialization', () => {
    it('should initialize database backend successfully', async () => {
      await expect(databaseService.initializeDatabaseBackend()).resolves.not.toThrow();
    }, 30000);

    it('should initialize all databases with progress tracking', async () => {
      const result = await databaseService.initializeDatabases();
      expect(result).toBe(true);
    }, 30000);

    it('should check database health after initialization', async () => {
      await databaseService.initializeDatabases();
      const healthReports = await databaseService.checkDatabaseHealth();
      
      expect(Array.isArray(healthReports)).toBe(true);
      healthReports.forEach((report: any) => {
        expect(typeof report.healthy).toBe('boolean');
        expect(Array.isArray(report.issues)).toBe(true);
        expect(Array.isArray(report.recommendations)).toBe(true);
      });
    }, 30000);
  });

  describe('Database Migrations', () => {
    it('should run database migrations successfully', async () => {
      await databaseService.initializeDatabases();
      await expect(databaseService.runMigrations()).resolves.not.toThrow();
    }, 30000);

    it('should get migration status for all databases', async () => {
      await databaseService.initializeDatabases();
      await databaseService.runMigrations();
      
      const migrationStatus = await databaseService.getMigrationStatus();
      
      expect(migrationStatus).toHaveProperty('mail');
      expect(migrationStatus).toHaveProperty('calendar');
      expect(Array.isArray(migrationStatus.mail)).toBe(true);
      expect(Array.isArray(migrationStatus.calendar)).toBe(true);
    }, 30000);
  });

  describe('Database Statistics', () => {
    it('should get database statistics', async () => {
      await databaseService.initializeDatabases();
      const stats = await databaseService.getDatabaseStats();
      
      expect(stats).toHaveProperty('mail');
      expect(stats).toHaveProperty('calendar');
      expect(typeof stats.mail.file_size_bytes).toBe('number');
      expect(typeof stats.calendar.file_size_bytes).toBe('number');
    }, 30000);
  });

  describe('Database Backup', () => {
    it('should backup databases successfully', async () => {
      await databaseService.initializeDatabases();
      const backupDir = join(testDir, 'backups');
      
      const backupFiles = await databaseService.backupDatabases(backupDir);
      
      expect(Array.isArray(backupFiles)).toBe(true);
      expect(backupFiles.length).toBeGreaterThan(0);
      
      // Verify backup files exist
      for (const file of backupFiles) {
        const exists = await fs.access(file).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    }, 30000);
  });

  describe('Database Repair', () => {
    it('should check if databases need repair', async () => {
      await databaseService.initializeDatabases();
      
      // This should succeed since we just initialized clean databases
      const result = await databaseService.repairDatabases();
      expect(typeof result).toBe('boolean');
    }, 30000);
  });

  describe('Migration Manager', () => {
    it('should create migration manager successfully', () => {
      const migrationManager = getRustDatabaseMigrationManager(
        join(testDir, 'mail.db'),
        join(testDir, 'calendar.db')
      );
      
      expect(migrationManager).toBeDefined();
    });

    it('should get migration statuses', async () => {
      const migrationManager = getRustDatabaseMigrationManager(
        join(testDir, 'mail.db'),
        join(testDir, 'calendar.db')
      );
      
      // Initialize databases first
      await databaseService.initializeDatabases();
      
      const mailStatus = await migrationManager.getMigrationStatus('mail');
      const calendarStatus = await migrationManager.getMigrationStatus('calendar');
      
      expect(Array.isArray(mailStatus)).toBe(true);
      expect(Array.isArray(calendarStatus)).toBe(true);
    }, 30000);
  });
});

describe('Database Error Handling', () => {
  it('should handle missing Rust library gracefully', async () => {
    // This test would verify error handling when Rust library is not available
    // For now, just ensure the service can be created
    const service = getRustDatabaseService();
    expect(service).toBeDefined();
  });

  it('should handle database connection errors', async () => {
    const service = getRustDatabaseService();
    
    // Override config with invalid paths
    (service as any).config = {
      userDataPath: '/invalid/path',
      mailDbPath: '/invalid/mail.db',
      calendarDbPath: '/invalid/calendar.db',
      searchIndexPath: '/invalid/search_index',
      schemaVersion: 1
    };

    // This should fail gracefully
    await expect(service.initializeDatabases()).resolves.toBe(false);
  });
});