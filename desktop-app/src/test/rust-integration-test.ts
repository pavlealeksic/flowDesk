/**
 * Comprehensive Rust Integration Test
 * 
 * Tests all Rust engine integrations to verify they work correctly
 * and replace JavaScript implementations successfully.
 */

import log from 'electron-log';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';
import { rustOAuthManager } from '../lib/rust-integration/rust-oauth-manager';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  duration: number;
}

class RustIntegrationTester {
  private results: TestResult[] = [];

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<void> {
    log.info('Starting comprehensive Rust integration tests...');
    
    // Initialize Rust engine first
    await this.runTest('Rust Engine Initialization', async () => {
      await rustEngineIntegration.initialize();
      const isInitialized = rustEngineIntegration.isInitialized();
      if (!isInitialized) {
        throw new Error('Rust engine not initialized');
      }
      return `Rust engine initialized successfully, version: ${rustEngineIntegration.getVersion()}`;
    });

    // Test mail engine integration
    await this.testMailEngine();

    // Test calendar engine integration  
    await this.testCalendarEngine();

    // Test search engine integration
    await this.testSearchEngine();

    // Test OAuth integration
    await this.testOAuthIntegration();

    // Test encryption integration
    await this.testEncryptionIntegration();

    // Print summary
    this.printTestSummary();
  }

  /**
   * Test mail engine functionality
   */
  private async testMailEngine(): Promise<void> {
    log.info('Testing mail engine integration...');

    // Test adding a mail account
    await this.runTest('Add Mail Account', async () => {
      const account = await rustEngineIntegration.addMailAccount({
        email: 'test@gmail.com',
        password: 'test-password',
        displayName: 'Test User'
      });
      
      if (!account.id || !account.email) {
        throw new Error('Invalid account returned');
      }
      
      return `Mail account added: ${account.email} (${account.provider})`;
    });

    // Test getting mail accounts
    await this.runTest('Get Mail Accounts', async () => {
      const accounts = await rustEngineIntegration.getMailAccounts();
      return `Retrieved ${accounts.length} mail accounts`;
    });

    // Test sync mail account (using first available account)
    await this.runTest('Sync Mail Account', async () => {
      const accounts = await rustEngineIntegration.getMailAccounts();
      if (accounts.length > 0) {
        const result = await rustEngineIntegration.syncMailAccount(accounts[0].id);
        return `Mail sync completed: ${result}`;
      }
      return 'No accounts to sync';
    });

    // Test get messages
    await this.runTest('Get Mail Messages', async () => {
      const accounts = await rustEngineIntegration.getMailAccounts();
      if (accounts.length > 0) {
        const messages = await rustEngineIntegration.getMailMessages(accounts[0].id);
        return `Retrieved ${messages.length} messages`;
      }
      return 'No accounts to get messages from';
    });

    // Test search messages
    await this.runTest('Search Mail Messages', async () => {
      const messages = await rustEngineIntegration.searchMailMessages('test query');
      return `Search returned ${messages.length} messages`;
    });
  }

  /**
   * Test calendar engine functionality
   */
  private async testCalendarEngine(): Promise<void> {
    log.info('Testing calendar engine integration...');

    // Test adding a calendar account
    await this.runTest('Add Calendar Account', async () => {
      const account = await rustEngineIntegration.addCalendarAccount({
        email: 'test@gmail.com',
        password: 'test-password'
      });
      
      if (!account.id || !account.email) {
        throw new Error('Invalid calendar account returned');
      }
      
      return `Calendar account added: ${account.email} (${account.provider})`;
    });

    // Test getting calendar accounts
    await this.runTest('Get Calendar Accounts', async () => {
      const accounts = await rustEngineIntegration.getCalendarAccounts();
      return `Retrieved ${accounts.length} calendar accounts`;
    });

    // Test sync calendar account
    await this.runTest('Sync Calendar Account', async () => {
      const accounts = await rustEngineIntegration.getCalendarAccounts();
      if (accounts.length > 0) {
        const result = await rustEngineIntegration.syncCalendarAccount(accounts[0].id);
        return `Calendar sync completed: ${result}`;
      }
      return 'No calendar accounts to sync';
    });

    // Test get events
    await this.runTest('Get Calendar Events', async () => {
      const accounts = await rustEngineIntegration.getCalendarAccounts();
      if (accounts.length > 0) {
        const events = await rustEngineIntegration.getCalendarEvents(
          accounts[0].id,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
        );
        return `Retrieved ${events.length} calendar events`;
      }
      return 'No calendar accounts to get events from';
    });

    // Test create event
    await this.runTest('Create Calendar Event', async () => {
      const eventId = await rustEngineIntegration.createCalendarEvent({
        calendarId: 'test-calendar-id',
        title: 'Test Event via Rust',
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        description: 'Test event created via Rust integration',
        location: 'Test Location'
      });
      
      return `Created calendar event: ${eventId}`;
    });
  }

  /**
   * Test search engine functionality
   */
  private async testSearchEngine(): Promise<void> {
    log.info('Testing search engine integration...');

    // Test index document
    await this.runTest('Index Document', async () => {
      const success = await rustEngineIntegration.indexDocument({
        id: 'test-doc-1',
        title: 'Test Document via Rust',
        content: 'This is a test document indexed via the Rust search engine integration.',
        source: 'test',
        metadata: { type: 'test', category: 'integration' }
      });
      
      if (!success) {
        throw new Error('Document indexing failed');
      }
      
      return 'Document indexed successfully';
    });

    // Test search documents
    await this.runTest('Search Documents', async () => {
      const results = await rustEngineIntegration.searchDocuments('test', 10);
      return `Search returned ${results.length} results`;
    });

    // Index multiple documents for better search testing
    await this.runTest('Index Multiple Documents', async () => {
      const docs = [
        {
          id: 'doc-1',
          title: 'Email about meeting',
          content: 'Please join our team meeting tomorrow at 3 PM',
          source: 'email',
          metadata: { from: 'john@example.com' }
        },
        {
          id: 'doc-2', 
          title: 'Calendar event: Project Review',
          content: 'Quarterly project review meeting with stakeholders',
          source: 'calendar',
          metadata: { location: 'Conference Room A' }
        },
        {
          id: 'doc-3',
          title: 'Search functionality implementation',
          content: 'Implementing advanced search with Rust Tantivy engine',
          source: 'document',
          metadata: { tags: ['rust', 'search', 'implementation'] }
        }
      ];

      let indexed = 0;
      for (const doc of docs) {
        const success = await rustEngineIntegration.indexDocument(doc);
        if (success) indexed++;
      }

      return `Indexed ${indexed} of ${docs.length} documents`;
    });

    // Test comprehensive search
    await this.runTest('Comprehensive Search Test', async () => {
      const searchTerms = ['meeting', 'project', 'rust', 'implementation'];
      let totalResults = 0;
      
      for (const term of searchTerms) {
        const results = await rustEngineIntegration.searchDocuments(term, 20);
        totalResults += results.length;
      }
      
      return `Comprehensive search completed, total results: ${totalResults}`;
    });
  }

  /**
   * Test OAuth integration
   */
  private async testOAuthIntegration(): Promise<void> {
    log.info('Testing OAuth integration...');

    // Test OAuth URL generation
    await this.runTest('Generate OAuth URL', async () => {
      const { authUrl, state } = await rustEngineIntegration.startOAuthFlow('gmail');
      
      if (!authUrl || !authUrl.startsWith('https://')) {
        throw new Error('Invalid OAuth URL generated');
      }
      
      if (!state || state.length < 8) {
        throw new Error('Invalid state parameter generated');
      }
      
      return `OAuth URL generated successfully for Gmail (state: ${state.substring(0, 8)}...)`;
    });

    // Test OAuth credentials encryption
    await this.runTest('OAuth Credentials Encryption', async () => {
      const testCredentials = {
        accessToken: 'test-access-token-12345',
        refreshToken: 'test-refresh-token-67890',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        scope: 'email calendar',
        tokenType: 'Bearer'
      };
      
      const encrypted = rustOAuthManager.encryptCredentials(testCredentials);
      const decrypted = rustOAuthManager.decryptCredentials(encrypted);
      
      if (!decrypted || decrypted.accessToken !== testCredentials.accessToken) {
        throw new Error('Credential encryption/decryption failed');
      }
      
      return 'OAuth credentials encrypted and decrypted successfully';
    });

    // Test needs refresh check
    await this.runTest('OAuth Refresh Check', async () => {
      const expiredCredentials = {
        accessToken: 'test-token',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        tokenType: 'Bearer'
      };
      
      const needsRefresh = rustOAuthManager.needsRefresh(expiredCredentials);
      
      if (!needsRefresh) {
        throw new Error('Should detect expired credentials');
      }
      
      return 'OAuth refresh detection working correctly';
    });
  }

  /**
   * Test encryption functionality
   */
  private async testEncryptionIntegration(): Promise<void> {
    log.info('Testing encryption integration...');

    // Test key pair generation
    await this.runTest('Generate Encryption Key Pair', async () => {
      const keyPair = rustEngineIntegration.generateEncryptionKeyPair();
      
      if (!keyPair.publicKey || !keyPair.privateKey) {
        throw new Error('Invalid key pair generated');
      }
      
      if (keyPair.publicKey === keyPair.privateKey) {
        throw new Error('Public and private keys should be different');
      }
      
      return `Key pair generated successfully (public: ${keyPair.publicKey.substring(0, 20)}...)`;
    });

    // Test data encryption/decryption
    await this.runTest('Data Encryption/Decryption', async () => {
      const testData = 'This is sensitive data that needs to be encrypted using the Rust engine!';
      const keyPair = rustEngineIntegration.generateEncryptionKeyPair();
      
      const encrypted = rustEngineIntegration.encryptData(testData, keyPair.privateKey);
      const decrypted = rustEngineIntegration.decryptData(encrypted, keyPair.privateKey);
      
      if (decrypted !== testData) {
        throw new Error(`Decryption failed: expected "${testData}", got "${decrypted}"`);
      }
      
      if (encrypted === testData) {
        throw new Error('Data was not actually encrypted');
      }
      
      return 'Data encryption/decryption working correctly';
    });

    // Test large data encryption
    await this.runTest('Large Data Encryption', async () => {
      const largeData = 'Large data content: ' + 'x'.repeat(10000);
      const keyPair = rustEngineIntegration.generateEncryptionKeyPair();
      
      const start = Date.now();
      const encrypted = rustEngineIntegration.encryptData(largeData, keyPair.privateKey);
      const decrypted = rustEngineIntegration.decryptData(encrypted, keyPair.privateKey);
      const duration = Date.now() - start;
      
      if (decrypted !== largeData) {
        throw new Error('Large data encryption/decryption failed');
      }
      
      return `Large data (${largeData.length} bytes) encrypted/decrypted in ${duration}ms`;
    });
  }

  /**
   * Helper method to run individual tests
   */
  private async runTest(testName: string, testFn: () => Promise<string>): Promise<void> {
    const start = Date.now();
    
    try {
      const message = await testFn();
      const duration = Date.now() - start;
      
      this.results.push({
        testName,
        success: true,
        message,
        duration
      });
      
      log.info(`✅ ${testName}: ${message} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      this.results.push({
        testName,
        success: false,
        message,
        duration
      });
      
      log.error(`❌ ${testName}: ${message} (${duration}ms)`);
    }
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    log.info('\n=== RUST INTEGRATION TEST SUMMARY ===');
    log.info(`Total tests: ${totalTests}`);
    log.info(`Passed: ${passedTests}`);
    log.info(`Failed: ${failedTests}`);
    log.info(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    log.info(`Total duration: ${totalDuration}ms`);
    log.info(`Rust engine version: ${rustEngineIntegration.getVersion()}`);
    
    if (failedTests > 0) {
      log.info('\n=== FAILED TESTS ===');
      this.results
        .filter(r => !r.success)
        .forEach(r => log.error(`❌ ${r.testName}: ${r.message}`));
    }
    
    log.info('\n=== INTEGRATION STATUS ===');
    const criticalFeatures = [
      'Rust Engine Initialization',
      'Add Mail Account', 
      'Add Calendar Account',
      'Index Document',
      'Generate OAuth URL',
      'Data Encryption/Decryption'
    ];
    
    const criticalPassed = criticalFeatures.filter(feature =>
      this.results.some(r => r.testName === feature && r.success)
    ).length;
    
    if (criticalPassed === criticalFeatures.length) {
      log.info('🎉 ALL CRITICAL FEATURES WORKING - Rust integration is ready for production!');
    } else {
      log.warn(`⚠️  ${criticalPassed}/${criticalFeatures.length} critical features working - needs attention`);
    }
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return this.results;
  }
}

// Export for use in main process
export { RustIntegrationTester };
export default RustIntegrationTester;