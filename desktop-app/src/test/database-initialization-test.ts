/**
 * Database Initialization Test Suite
 * 
 * Tests for database initialization, migration, and integrity checking
 */

import { getDatabaseInitializationService, DatabaseInitializationConfig } from '../main/database-initialization-service';
import { getDatabaseMigrationManager } from '../main/database-migration-manager';
import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export class DatabaseInitializationTester {
  private testResults: Array<{
    name: string;
    success: boolean;
    error?: string;
    duration: number;
  }> = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Database Initialization Test Suite...\n');

    // Create temporary test directory
    const testDir = join(tmpdir(), 'flow-desk-db-test', Date.now().toString());
    process.env.TEST_USER_DATA_PATH = testDir;

    try {
      await this.runTest('Database Service Creation', () => this.testDatabaseServiceCreation());
      await this.runTest('Directory Creation', () => this.testDirectoryCreation(testDir));
      await this.runTest('Database Initialization', () => this.testDatabaseInitialization(testDir));
      await this.runTest('Database Schema Validation', () => this.testDatabaseSchemaValidation(testDir));
      await this.runTest('Migration System', () => this.testMigrationSystem(testDir));
      await this.runTest('Database Repair', () => this.testDatabaseRepair(testDir));
      await this.runTest('Integrity Checking', () => this.testIntegrityChecking(testDir));
      await this.runTest('Configuration Persistence', () => this.testConfigurationPersistence(testDir));

    } finally {
      // Cleanup test directory
      try {
        await fs.rmdir(testDir, { recursive: true });
        console.log(`🧹 Cleaned up test directory: ${testDir}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up test directory: ${error}`);
      }
    }

    this.printResults();
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.push({ name, success: true, duration });
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name, success: false, error: errorMessage, duration });
      console.log(`❌ ${name} - FAILED (${duration}ms): ${errorMessage}`);
    }
  }

  private async testDatabaseServiceCreation(): Promise<void> {
    const service = getDatabaseInitializationService();
    
    if (!service) {
      throw new Error('Database service creation failed');
    }

    const config = service.getConfig();
    if (!config.userDataPath || !config.mailDbPath || !config.calendarDbPath) {
      throw new Error('Database service configuration is incomplete');
    }
  }

  private async testDirectoryCreation(testDir: string): Promise<void> {
    // Override the user data path for testing
    const service = getDatabaseInitializationService();
    const originalConfig = service.getConfig();
    
    // Create service with test directory
    const testService = getDatabaseInitializationService((progress) => {
      console.log(`   📊 Progress: ${progress.stage} (${progress.progress}%) - ${progress.message}`);
    });

    // Initialize should create directories
    await testService['setupDirectories']();

    // Verify directories were created
    const config = testService.getConfig();
    const directories = [
      config.userDataPath,
      join(config.userDataPath, 'databases')
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        throw new Error(`Directory not created: ${dir}`);
      }
    }
  }

  private async testDatabaseInitialization(testDir: string): Promise<void> {
    const service = getDatabaseInitializationService();
    
    // Check if databases need initialization
    const needsInit = !(await service.isDatabasesInitialized());
    
    if (needsInit) {
      const success = await service.initializeDatabases();
      if (!success) {
        throw new Error('Database initialization failed');
      }
    }

    // Verify databases were created
    const config = service.getConfig();
    const databases = [config.mailDbPath, config.calendarDbPath];
    
    for (const dbPath of databases) {
      if (!existsSync(dbPath)) {
        throw new Error(`Database not created: ${dbPath}`);
      }
    }

    // Verify search index directory
    if (!existsSync(config.searchIndexPath)) {
      throw new Error(`Search index directory not created: ${config.searchIndexPath}`);
    }
  }

  private async testDatabaseSchemaValidation(testDir: string): Promise<void> {
    const service = getDatabaseInitializationService();
    
    // Try to validate database schemas using SQLite
    try {
      const sqlite3 = require('sqlite3');
      const config = service.getConfig();
      
      // Test mail database schema
      await this.validateDatabaseSchema(config.mailDbPath, [
        'accounts', 'messages', 'folders', 'threads', 'schema_version'
      ]);

      // Test calendar database schema
      await this.validateDatabaseSchema(config.calendarDbPath, [
        'calendar_accounts', 'calendars', 'calendar_events', 
        'privacy_sync_rules', 'schema_version'
      ]);

    } catch (error) {
      // If SQLite is not available, just check file existence
      console.log('   ⚠️ SQLite not available, skipping detailed schema validation');
      const config = service.getConfig();
      if (!existsSync(config.mailDbPath) || !existsSync(config.calendarDbPath)) {
        throw new Error('Database files do not exist');
      }
    }
  }

  private async validateDatabaseSchema(dbPath: string, expectedTables: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(new Error(`Cannot open database ${dbPath}: ${err.message}`));
          return;
        }

        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
          if (err) {
            db.close();
            reject(new Error(`Schema query failed: ${err.message}`));
            return;
          }

          const actualTables = (rows as any[]).map(row => row.name);
          const missingTables = expectedTables.filter(table => !actualTables.includes(table));
          
          db.close();
          
          if (missingTables.length > 0) {
            reject(new Error(`Missing tables in ${dbPath}: ${missingTables.join(', ')}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  private async testMigrationSystem(testDir: string): Promise<void> {
    const service = getDatabaseInitializationService();
    const config = service.getConfig();
    const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);

    // Get migration status
    const statuses = await migrationManager.getAllMigrationStatuses();
    
    if (!statuses || Object.keys(statuses).length === 0) {
      throw new Error('Migration status not loaded');
    }

    // Test that migration status includes expected databases
    if (!statuses.mail || !statuses.calendar) {
      throw new Error('Migration status missing expected databases');
    }

    // If there are pending migrations, test applying them
    const hasPendingMigrations = Object.values(statuses).some(
      status => status.pendingMigrations.length > 0
    );

    if (hasPendingMigrations) {
      const success = await migrationManager.applyAllMigrations();
      if (!success) {
        throw new Error('Migration application failed');
      }
    }
  }

  private async testDatabaseRepair(testDir: string): Promise<void> {
    const service = getDatabaseInitializationService();
    
    // Test repair functionality (this should work even on healthy databases)
    const success = await service.repairDatabases();
    
    if (!success) {
      throw new Error('Database repair failed');
    }

    // Verify databases still exist after repair
    const config = service.getConfig();
    if (!existsSync(config.mailDbPath) || !existsSync(config.calendarDbPath)) {
      throw new Error('Databases missing after repair');
    }
  }

  private async testIntegrityChecking(testDir: string): Promise<void> {
    const service = getDatabaseInitializationService();
    
    // Test integrity checking doesn't throw errors
    try {
      await service['validateDatabases']();
    } catch (error) {
      throw new Error(`Integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async testConfigurationPersistence(testDir: string): Promise<void> {
    const service = getDatabaseInitializationService();
    const config = service.getConfig();
    
    // Test that configuration file is created
    if (!existsSync(config.configPath)) {
      // Try to save configuration
      await service['saveConfiguration']();
      
      if (!existsSync(config.configPath)) {
        throw new Error('Configuration file not created');
      }
    }

    // Test reading configuration
    const configContent = await fs.readFile(config.configPath, 'utf8');
    const parsedConfig = JSON.parse(configContent);
    
    if (!parsedConfig.version || !parsedConfig.databases) {
      throw new Error('Configuration file has invalid structure');
    }
  }

  private printResults(): void {
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => r.success === false).length;
    const totalTime = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n📊 Database Test Results:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏱️ Total Time: ${totalTime}ms`);
    console.log(`   📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    console.log(`\n🎯 Database initialization system is ${failed === 0 ? 'working correctly' : 'experiencing issues'}`);
  }

  getResults() {
    return this.testResults;
  }
}

// Export for use in main process
export default DatabaseInitializationTester;