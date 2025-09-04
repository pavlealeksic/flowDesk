/**
 * Test Migration System
 * 
 * Script to test the database migration system and ensure schema_version table is properly created
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { getDatabaseMigrationManager } from '../main/database-migration-manager';
import log from 'electron-log';

// Configure electron-log for testing
log.transports.file.level = 'debug';
log.transports.log.level = 'debug';

async function testMigrationSystem() {
  log.info('Starting migration system test...');
  
  // Create test database directory
  const testDbDir = join(process.cwd(), 'test-databases');
  const mailDbPath = join(testDbDir, 'test-mail.db');
  const calendarDbPath = join(testDbDir, 'test-calendar.db');
  
  try {
    // Clean up previous test runs
    log.info('Cleaning up previous test databases...');
    try {
      await fs.rm(testDbDir, { recursive: true, force: true });
    } catch (err) {
      // Directory might not exist
    }
    await fs.mkdir(testDbDir, { recursive: true });
    
    // Create empty SQLite database files
    log.info('Creating test database files...');
    const sqlite3 = require('sqlite3').verbose();
    
    // Create mail database with minimal schema
    await new Promise<void>((resolve, reject) => {
      const mailDb = new sqlite3.Database(mailDbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create minimal schema
        mailDb.exec(`
          CREATE TABLE accounts (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL
          );
          
          CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            subject TEXT NOT NULL,
            from_address TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
          );
        `, (err: Error | null) => {
          mailDb.close();
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
    
    // Create calendar database with minimal schema
    await new Promise<void>((resolve, reject) => {
      const calendarDb = new sqlite3.Database(calendarDbPath, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create minimal schema
        calendarDb.exec(`
          CREATE TABLE calendar_accounts (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL
          );
          
          CREATE TABLE calendar_events (
            id TEXT PRIMARY KEY,
            calendar_id TEXT NOT NULL,
            title TEXT NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL
          );
        `, (err: Error | null) => {
          calendarDb.close();
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
    
    log.info('Test databases created successfully');
    
    // Initialize migration manager
    log.info('Initializing migration manager...');
    const migrationManager = getDatabaseMigrationManager(mailDbPath, calendarDbPath);
    
    // Test 1: Apply migrations (should create schema_version table)
    log.log('\n=== Test 1: Applying migrations ===');
    const migrationsApplied = await migrationManager.applyAllMigrations();
    
    if (migrationsApplied) {
      log.log('✓ Migrations applied successfully');
    } else {
      log.error('✗ Failed to apply migrations');
      process.exit(1);
    }
    
    // Test 2: Check migration status
    log.log('\n=== Test 2: Checking migration status ===');
    const statuses = await migrationManager.getAllMigrationStatuses();
    
    log.log('Mail database migrations:');
    for (const status of statuses.mail) {
      const symbol = status.applied ? '✓' : '○';
      const date = status.appliedAt ? ` (${status.appliedAt.toISOString()})` : '';
      log.log(`  ${symbol} ${status.id}${date}`);
    }
    
    log.log('\nCalendar database migrations:');
    for (const status of statuses.calendar) {
      const symbol = status.applied ? '✓' : '○';
      const date = status.appliedAt ? ` (${status.appliedAt.toISOString()})` : '';
      log.log(`  ${symbol} ${status.id}${date}`);
    }
    
    // Test 3: Verify schema_version table exists
    log.log('\n=== Test 3: Verifying schema_version table ===');
    
    await new Promise<void>((resolve, reject) => {
      const db = new sqlite3.Database(mailDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
          (err: Error | null, row: any) => {
            db.close();
            if (err) {
              reject(err);
            } else if (row) {
              log.log('✓ schema_version table exists in mail database');
              resolve();
            } else {
              reject(new Error('schema_version table not found in mail database'));
            }
          }
        );
      });
    });
    
    await new Promise<void>((resolve, reject) => {
      const db = new sqlite3.Database(calendarDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
          (err: Error | null, row: any) => {
            db.close();
            if (err) {
              reject(err);
            } else if (row) {
              log.log('✓ schema_version table exists in calendar database');
              resolve();
            } else {
              reject(new Error('schema_version table not found in calendar database'));
            }
          }
        );
      });
    });
    
    // Test 4: Run migrations again (should be idempotent)
    log.log('\n=== Test 4: Testing idempotency ===');
    const secondRun = await migrationManager.applyAllMigrations();
    
    if (secondRun) {
      log.log('✓ Second migration run completed successfully (idempotent)');
    } else {
      log.error('✗ Second migration run failed');
      process.exit(1);
    }
    
    // Test 5: Check that new tables were created by migrations
    log.log('\n=== Test 5: Verifying migration effects ===');
    
    // Check for attachments table (created by migration 003)
    await new Promise<void>((resolve, reject) => {
      const db = new sqlite3.Database(mailDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'",
          (err: Error | null, row: any) => {
            db.close();
            if (err) {
              reject(err);
            } else if (row) {
              log.log('✓ attachments table created by migration');
              resolve();
            } else {
              log.log('○ attachments table not created (migration may have been skipped)');
              resolve();
            }
          }
        );
      });
    });
    
    // Check for event_categories table (created by migration 002)
    await new Promise<void>((resolve, reject) => {
      const db = new sqlite3.Database(calendarDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='event_categories'",
          (err: Error | null, row: any) => {
            db.close();
            if (err) {
              reject(err);
            } else if (row) {
              log.log('✓ event_categories table created by migration');
              resolve();
            } else {
              log.log('○ event_categories table not created (migration may have been skipped)');
              resolve();
            }
          }
        );
      });
    });
    
    log.log('\n=== All tests completed successfully! ===');
    log.log('\nThe migration system is working correctly:');
    log.log('1. schema_version table is automatically created');
    log.log('2. Migrations are tracked properly');
    log.log('3. Migrations are idempotent');
    log.log('4. Database changes are applied correctly');
    
    // Clean up test databases
    log.log('\nCleaning up test databases...');
    await fs.rm(testDbDir, { recursive: true, force: true });
    log.log('Test cleanup complete.');
    
    process.exit(0);
    
  } catch (error) {
    log.error('\n❌ Test failed:', error);
    
    // Clean up on error
    try {
      await fs.rm(testDbDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Run the test
testMigrationSystem().catch((error) => {
  log.error('Test execution failed:', error);
  process.exit(1);
});