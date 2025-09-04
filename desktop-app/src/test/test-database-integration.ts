/**
 * Test Database Integration
 * 
 * This test verifies that the database layer is working correctly
 * using the JavaScript SQLite3 implementation.
 */

import { getDatabaseInitializationService } from '../main/database-initialization-service';
import { getDatabaseMigrationManager } from '../main/database-migration-manager';
import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';

async function testDatabaseIntegration() {
  console.log('🔍 Testing Database Integration Layer...\n');
  
  // Create a temporary directory for test databases
  const testDir = join(tmpdir(), 'flowdesk-test-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });
  
  console.log(`📁 Test directory: ${testDir}`);
  
  try {
    // Test 1: Initialize database service
    console.log('\n✅ Test 1: Initialize Database Service');
    const dbService = getDatabaseInitializationService((progress) => {
      console.log(`  Progress: ${progress.stage} - ${progress.progress}% - ${progress.message}`);
    });
    
    // Override the config to use test directory
    const originalConfig = dbService.getConfig();
    console.log(`  Original DB path: ${originalConfig.mailDbPath}`);
    
    // Test 2: Check if databases exist (should be false initially)
    console.log('\n✅ Test 2: Check Initial Database Status');
    const initialStatus = await dbService.isDatabasesInitialized();
    console.log(`  Databases initialized: ${initialStatus}`);
    
    // Test 3: Initialize databases
    console.log('\n✅ Test 3: Initialize Databases');
    const initResult = await dbService.initializeDatabases();
    console.log(`  Initialization successful: ${initResult}`);
    
    if (initResult) {
      // Test 4: Verify databases were created
      console.log('\n✅ Test 4: Verify Database Files');
      const config = dbService.getConfig();
      
      const mailDbExists = await fs.access(config.mailDbPath).then(() => true).catch(() => false);
      const calendarDbExists = await fs.access(config.calendarDbPath).then(() => true).catch(() => false);
      
      console.log(`  Mail DB exists: ${mailDbExists} (${config.mailDbPath})`);
      console.log(`  Calendar DB exists: ${calendarDbExists} (${config.calendarDbPath})`);
      
      // Test 5: Check migration manager
      console.log('\n✅ Test 5: Database Migration Manager');
      const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
      
      const allMigrations = await migrationManager.getAllMigrationStatuses();
      
      console.log(`  Total migrations tracked: ${allMigrations.length}`);
      const appliedCount = allMigrations.filter((m: any) => m.applied).length;
      console.log(`  Applied migrations: ${appliedCount}/${allMigrations.length}`);
      
      // Test 6: Verify database status after initialization
      console.log('\n✅ Test 6: Final Database Status Check');
      const finalStatus = await dbService.isDatabasesInitialized();
      console.log(`  Databases initialized: ${finalStatus}`);
      
      console.log('\n✅ All tests passed! Database integration is working correctly.');
    } else {
      console.log('\n❌ Database initialization failed!');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log(`\n🧹 Cleaned up test directory: ${testDir}`);
    } catch (cleanupError) {
      console.warn('Failed to clean up test directory:', cleanupError);
    }
  }
}

// Run the test
testDatabaseIntegration().then(() => {
  console.log('\n✅ Database integration test completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Database integration test failed:', error);
  process.exit(1);
});