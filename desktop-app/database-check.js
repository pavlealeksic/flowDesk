/**
 * Quick Database System Verification
 * 
 * This script performs a deep verification of the database system
 */

const { getDatabaseInitializationService } = require('./dist/desktop-app/src/main/database-initialization-service');
const { getDatabaseMigrationManager } = require('./dist/desktop-app/src/main/database-migration-manager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function runDatabaseCheck() {
  console.log('🔍 Flow Desk Database System Deep Check\n');
  
  // Create test directory
  const testDir = path.join(os.tmpdir(), 'flowdesk-db-check-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });
  console.log(`📁 Test directory: ${testDir}\n`);
  
  let results = {
    tests: [],
    passed: 0,
    failed: 0,
    startTime: Date.now()
  };

  try {
    // Test 1: Service Creation
    await runTest('Service Creation', async () => {
      const service = getDatabaseInitializationService();
      if (!service) throw new Error('Service creation failed');
      
      const config = service.getConfig();
      console.log(`   📂 User Data Path: ${config.userDataPath}`);
      console.log(`   📊 Mail DB Path: ${config.mailDbPath}`);
      console.log(`   📅 Calendar DB Path: ${config.calendarDbPath}`);
      console.log(`   🔍 Search Index Path: ${config.searchIndexPath}`);
    });

    // Test 2: Database Initialization
    await runTest('Database Initialization', async () => {
      const service = getDatabaseInitializationService((progress) => {
        console.log(`   📈 ${progress.stage}: ${progress.progress}% - ${progress.message}`);
      });
      
      const success = await service.initializeDatabases();
      if (!success) throw new Error('Database initialization failed');
      
      const config = service.getConfig();
      
      // Check if files were created
      const mailExists = await fs.access(config.mailDbPath).then(() => true).catch(() => false);
      const calendarExists = await fs.access(config.calendarDbPath).then(() => true).catch(() => false);
      const searchExists = await fs.access(config.searchIndexPath).then(() => true).catch(() => false);
      
      console.log(`   📊 Mail DB exists: ${mailExists}`);
      console.log(`   📅 Calendar DB exists: ${calendarExists}`);
      console.log(`   🔍 Search Index exists: ${searchExists}`);
      
      if (!mailExists || !calendarExists) {
        throw new Error('Database files were not created');
      }
    });

    // Test 3: SQLite3 Operations
    await runTest('SQLite3 Operations', async () => {
      try {
        const sqlite3 = require('sqlite3');
        console.log('   ✅ SQLite3 module loaded successfully');
        
        const service = getDatabaseInitializationService();
        const config = service.getConfig();
        
        // Test database connections
        await testSQLiteDatabase(config.mailDbPath, 'Mail Database');
        await testSQLiteDatabase(config.calendarDbPath, 'Calendar Database');
        
      } catch (error) {
        throw new Error(`SQLite3 operations failed: ${error.message}`);
      }
    });

    // Test 4: Migration System
    await runTest('Migration System', async () => {
      const service = getDatabaseInitializationService();
      const config = service.getConfig();
      const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
      
      const statuses = await migrationManager.getAllMigrationStatuses();
      console.log(`   📋 Migration databases found: ${Object.keys(statuses).join(', ')}`);
      
      for (const [dbName, dbStatuses] of Object.entries(statuses)) {
        const appliedCount = dbStatuses.filter(s => s.applied).length;
        console.log(`   📊 ${dbName}: ${appliedCount}/${dbStatuses.length} migrations applied`);
        
        // Show any failed migrations
        const failed = dbStatuses.filter(s => s.error);
        if (failed.length > 0) {
          console.log(`   ❌ ${dbName} failed migrations: ${failed.map(f => f.id).join(', ')}`);
        }
      }
    });

    // Test 5: Database Health Check
    await runTest('Database Health Check', async () => {
      const service = getDatabaseInitializationService();
      const config = service.getConfig();
      
      // Test each database health
      await testDatabaseHealth(config.mailDbPath, 'Mail Database');
      await testDatabaseHealth(config.calendarDbPath, 'Calendar Database');
    });

    // Test 6: Data Persistence Test
    await runTest('Data Persistence Test', async () => {
      await testDataPersistence();
    });

  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log(`\n🧹 Cleaned up test directory`);
    } catch (error) {
      console.warn('⚠️ Failed to clean up test directory:', error.message);
    }
  }
  
  // Print summary
  console.log(`\n📊 Database Check Results:`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⏱️ Duration: ${Date.now() - results.startTime}ms`);
  console.log(`   📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.failed === 0) {
    console.log(`\n🎉 All database operations are working correctly!`);
  } else {
    console.log(`\n⚠️ Some database operations have issues.`);
  }
  
  async function runTest(name, testFn) {
    console.log(`\n🧪 ${name}:`);
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      results.tests.push({ name, success: true, duration });
      results.passed++;
      console.log(`   ✅ PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      results.tests.push({ name, success: false, error: error.message, duration });
      results.failed++;
      console.log(`   ❌ FAILED (${duration}ms): ${error.message}`);
    }
  }
}

async function testSQLiteDatabase(dbPath, name) {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Cannot open ${name}: ${err.message}`));
        return;
      }
      
      // Test basic operations
      db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", (err, row) => {
        if (err) {
          db.close();
          reject(new Error(`Query failed in ${name}: ${err.message}`));
          return;
        }
        
        console.log(`   📋 ${name} tables: ${row.count}`);
        
        // Test integrity
        db.get("PRAGMA integrity_check", (err, row) => {
          db.close();
          if (err) {
            reject(new Error(`Integrity check failed in ${name}: ${err.message}`));
          } else if (row.integrity_check === 'ok') {
            console.log(`   ✅ ${name} integrity: OK`);
            resolve();
          } else {
            reject(new Error(`Integrity check failed in ${name}: ${row.integrity_check}`));
          }
        });
      });
    });
  });
}

async function testDatabaseHealth(dbPath, name) {
  const sqlite3 = require('sqlite3').verbose();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(new Error(`Cannot open ${name} for health check: ${err.message}`));
        return;
      }
      
      // Check if database is corrupt
      db.get("PRAGMA integrity_check", (err, row) => {
        if (err) {
          db.close();
          reject(new Error(`Health check query failed for ${name}: ${err.message}`));
          return;
        }
        
        const isHealthy = row.integrity_check === 'ok';
        console.log(`   🏥 ${name} health: ${isHealthy ? 'HEALTHY' : 'ISSUES DETECTED'}`);
        
        if (!isHealthy) {
          console.log(`   ⚠️ ${name} integrity issues: ${row.integrity_check}`);
        }
        
        db.close();
        resolve();
      });
    });
  });
}

async function testDataPersistence() {
  const sqlite3 = require('sqlite3').verbose();
  const service = getDatabaseInitializationService();
  const config = service.getConfig();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(config.mailDbPath, (err) => {
      if (err) {
        reject(new Error(`Cannot open database for persistence test: ${err.message}`));
        return;
      }
      
      // Insert test data
      const testId = 'test-' + Date.now();
      const testEmail = `test-${Date.now()}@example.com`;
      
      db.run(`
        INSERT OR IGNORE INTO accounts (id, email, provider, display_name, is_enabled) 
        VALUES (?, ?, 'gmail', 'Test Account', 1)
      `, [testId, testEmail], function(err) {
        if (err) {
          db.close();
          reject(new Error(`Failed to insert test data: ${err.message}`));
          return;
        }
        
        // Read back the data
        db.get("SELECT * FROM accounts WHERE id = ?", [testId], (err, row) => {
          if (err) {
            db.close();
            reject(new Error(`Failed to read test data: ${err.message}`));
            return;
          }
          
          if (!row) {
            db.close();
            reject(new Error('Test data was not persisted'));
            return;
          }
          
          console.log(`   💾 Data persistence test: PASSED`);
          console.log(`   📝 Test record: ${row.email} (${row.display_name})`);
          
          // Clean up test data
          db.run("DELETE FROM accounts WHERE id = ?", [testId], (err) => {
            db.close();
            if (err) {
              console.warn(`   ⚠️ Failed to clean up test data: ${err.message}`);
            } else {
              console.log(`   🧹 Test data cleaned up`);
            }
            resolve();
          });
        });
      });
    });
  });
}

// Run the check
runDatabaseCheck().catch(console.error);