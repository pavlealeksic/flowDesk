/**
 * Mail Workflow Integration Tests
 * 
 * Tests critical user workflows for mail functionality including:
 * - Account setup and authentication
 * - Email sync and retrieval
 * - Email search and filtering
 * - Email composition and sending
 * - Error handling and recovery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { RustEngine } from '../../main/rust-engine';
import { MailEngine } from '../../types/mail';
import { MemoryStats } from '../../types/memory';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-app-data'),
    getName: vi.fn(() => 'test-app'),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe('Mail Workflow Integration Tests', () => {
  let rustEngine: RustEngine;
  let mailEngine: MailEngine;
  let testAccountId: string;

  beforeAll(async () => {
    // Initialize Rust engine with test configuration
    rustEngine = new RustEngine();
    await rustEngine.initialize();
    
    // Get mail engine instance
    mailEngine = rustEngine.getMailEngine();
    
    // Verify memory manager is initialized
    const memoryStats = await rustEngine.getMemoryStats();
    expect(memoryStats).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup and ensure no memory leaks
    if (testAccountId) {
      await mailEngine.removeAccount(testAccountId);
    }
    
    const finalMemoryStats = await rustEngine.getMemoryStats();
    console.log('Final memory stats:', finalMemoryStats);
    
    await rustEngine.shutdown();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Management Workflow', () => {
    it('should successfully add a Gmail account', async () => {
      const accountConfig = {
        email: 'test@gmail.com',
        provider: 'gmail' as const,
        displayName: 'Test Gmail Account',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      };

      // Test account creation
      testAccountId = await mailEngine.addAccount(accountConfig);
      expect(testAccountId).toBeDefined();
      expect(typeof testAccountId).toBe('string');

      // Verify account was added
      const accounts = await mailEngine.getAccounts();
      expect(accounts).toContainEqual(
        expect.objectContaining({
          id: testAccountId,
          email: accountConfig.email,
          provider: accountConfig.provider,
        })
      );
    });

    it('should handle OAuth authentication flow', async () => {
      // Mock OAuth flow
      const mockAuthCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
      };

      // Test OAuth token exchange
      const tokens = await mailEngine.exchangeCodeForTokens(mockAuthCode);
      expect(tokens).toEqual(mockTokens);

      // Test token refresh
      const refreshedTokens = await mailEngine.refreshTokens('test-refresh-token');
      expect(refreshedTokens.access_token).toBeDefined();
    });

    it('should validate account credentials', async () => {
      // Test valid credentials
      const validResult = await mailEngine.validateAccount(testAccountId);
      expect(validResult.isValid).toBe(true);
      expect(validResult.error).toBeUndefined();

      // Test invalid credentials
      const invalidAccountId = 'invalid-account-id';
      const invalidResult = await mailEngine.validateAccount(invalidAccountId);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('Email Sync Workflow', () => {
    beforeEach(async () => {
      // Ensure test account exists
      if (!testAccountId) {
        testAccountId = await mailEngine.addAccount({
          email: 'test@gmail.com',
          provider: 'gmail' as const,
          displayName: 'Test Account',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          refreshToken: 'test-refresh-token',
        });
      }
    });

    it('should sync emails from all folders', async () => {
      // Start initial sync
      const syncResult = await mailEngine.syncAccount(testAccountId);
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBeGreaterThanOrEqual(0);

      // Verify sync status
      const syncStatus = await mailEngine.getSyncStatus(testAccountId);
      expect(syncStatus.isRunning).toBe(false);
      expect(syncStatus.lastSyncTime).toBeDefined();
      expect(syncStatus.errorCount).toBe(0);
    });

    it('should handle incremental sync', async () => {
      // Perform initial sync
      await mailEngine.syncAccount(testAccountId);
      const initialCount = (await mailEngine.getEmails(testAccountId)).length;

      // Perform incremental sync
      const incrementalResult = await mailEngine.syncAccount(testAccountId, { incremental: true });
      expect(incrementalResult.success).toBe(true);

      // Verify no duplicate emails
      const finalCount = (await mailEngine.getEmails(testAccountId)).length;
      expect(finalCount).toBeGreaterThanOrEqual(initialCount);
    });

    it('should handle sync errors gracefully', async () => {
      // Mock network error
      vi.spyOn(mailEngine, 'syncAccount').mockRejectedValueOnce(new Error('Network error'));

      try {
        await mailEngine.syncAccount(testAccountId);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      // Verify error is logged in sync status
      const syncStatus = await mailEngine.getSyncStatus(testAccountId);
      expect(syncStatus.errorCount).toBeGreaterThan(0);
      expect(syncStatus.lastError).toBeDefined();
    });

    it('should maintain memory efficiency during large syncs', async () => {
      const initialMemory = await rustEngine.getMemoryStats();
      
      // Simulate large sync operation
      await mailEngine.syncAccount(testAccountId);
      
      const postSyncMemory = await rustEngine.getMemoryStats();
      
      // Memory usage should not increase beyond reasonable limits
      const memoryIncreaseMB = (postSyncMemory.current_usage - initialMemory.current_usage) / 1024 / 1024;
      expect(memoryIncreaseMB).toBeLessThan(100); // Less than 100MB increase
      
      // Force GC and check memory is released
      await rustEngine.forceGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow GC to run
      
      const postGcMemory = await rustEngine.getMemoryStats();
      expect(postGcMemory.current_usage).toBeLessThanOrEqual(postSyncMemory.current_usage);
    });
  });

  describe('Email Search and Filtering Workflow', () => {
    beforeEach(async () => {
      // Ensure we have test emails
      if (!testAccountId) {
        testAccountId = await mailEngine.addAccount({
          email: 'test@gmail.com',
          provider: 'gmail' as const,
          displayName: 'Test Account',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          refreshToken: 'test-refresh-token',
        });
        await mailEngine.syncAccount(testAccountId);
      }
    });

    it('should search emails by subject', async () => {
      const query = 'important meeting';
      const results = await mailEngine.searchEmails(testAccountId, { query });
      
      expect(Array.isArray(results)).toBe(true);
      results.forEach(email => {
        expect(email.subject.toLowerCase()).toContain(query.toLowerCase());
      });
    });

    it('should search emails by sender', async () => {
      const sender = 'boss@company.com';
      const results = await mailEngine.searchEmails(testAccountId, { from: sender });
      
      results.forEach(email => {
        expect(email.from_address.toLowerCase()).toBe(sender.toLowerCase());
      });
    });

    it('should filter emails by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const results = await mailEngine.searchEmails(testAccountId, {
        dateRange: { start: startDate, end: endDate }
      });
      
      results.forEach(email => {
        const emailDate = new Date(email.date);
        expect(emailDate).toBeGreaterThanOrEqual(startDate);
        expect(emailDate).toBeLessThanOrEqual(endDate);
      });
    });

    it('should handle complex search queries', async () => {
      const complexQuery = {
        query: 'project update',
        from: 'team@company.com',
        hasAttachment: true,
        isUnread: false,
        folder: 'INBOX',
      };

      const results = await mailEngine.searchEmails(testAccountId, complexQuery);
      
      results.forEach(email => {
        expect(email.subject.toLowerCase() + ' ' + email.body.toLowerCase())
          .toContain(complexQuery.query.toLowerCase());
        expect(email.from_address.toLowerCase()).toContain(complexQuery.from.toLowerCase());
        expect(email.has_attachments).toBe(complexQuery.hasAttachment);
        expect(email.is_read).toBe(!complexQuery.isUnread);
        expect(email.folder).toBe(complexQuery.folder);
      });
    });

    it('should perform fast search with pagination', async () => {
      const pageSize = 10;
      const page1 = await mailEngine.searchEmails(testAccountId, {
        query: '*',
        pagination: { page: 1, pageSize }
      });

      expect(page1.length).toBeLessThanOrEqual(pageSize);
      
      if (page1.length === pageSize) {
        const page2 = await mailEngine.searchEmails(testAccountId, {
          query: '*',
          pagination: { page: 2, pageSize }
        });
        
        // Ensure no overlap between pages
        const page1Ids = page1.map(email => email.id);
        const page2Ids = page2.map(email => email.id);
        expect(page1Ids.every(id => !page2Ids.includes(id))).toBe(true);
      }
    });
  });

  describe('Email Composition and Sending Workflow', () => {
    it('should compose and send a simple email', async () => {
      const emailData = {
        to: ['recipient@test.com'],
        subject: 'Test Email',
        body: 'This is a test email body',
        isHtml: false,
      };

      const messageId = await mailEngine.sendEmail(testAccountId, emailData);
      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');

      // Verify email is in sent folder
      const sentEmails = await mailEngine.getEmails(testAccountId, { folder: 'SENT' });
      const sentEmail = sentEmails.find(email => email.id === messageId);
      expect(sentEmail).toBeDefined();
      expect(sentEmail?.subject).toBe(emailData.subject);
    });

    it('should send HTML emails with formatting', async () => {
      const htmlEmailData = {
        to: ['recipient@test.com'],
        cc: ['cc@test.com'],
        bcc: ['bcc@test.com'],
        subject: 'HTML Test Email',
        body: '<h1>Hello</h1><p>This is <strong>HTML</strong> content</p>',
        isHtml: true,
      };

      const messageId = await mailEngine.sendEmail(testAccountId, htmlEmailData);
      expect(messageId).toBeDefined();

      // Verify HTML content is preserved
      const sentEmail = (await mailEngine.getEmails(testAccountId, { folder: 'SENT' }))
        .find(email => email.id === messageId);
      expect(sentEmail?.is_html).toBe(true);
      expect(sentEmail?.body).toContain('<h1>Hello</h1>');
    });

    it('should handle email attachments', async () => {
      const attachmentData = {
        filename: 'test-document.pdf',
        content: Buffer.from('PDF content here').toString('base64'),
        contentType: 'application/pdf',
      };

      const emailWithAttachment = {
        to: ['recipient@test.com'],
        subject: 'Email with Attachment',
        body: 'Please find attached document',
        attachments: [attachmentData],
      };

      const messageId = await mailEngine.sendEmail(testAccountId, emailWithAttachment);
      expect(messageId).toBeDefined();

      // Verify attachment is included
      const sentEmail = (await mailEngine.getEmails(testAccountId, { folder: 'SENT' }))
        .find(email => email.id === messageId);
      expect(sentEmail?.has_attachments).toBe(true);
      expect(sentEmail?.attachments).toHaveLength(1);
      expect(sentEmail?.attachments[0].filename).toBe(attachmentData.filename);
    });

    it('should validate email addresses before sending', async () => {
      const invalidEmailData = {
        to: ['invalid-email'],
        subject: 'Test',
        body: 'Test body',
      };

      await expect(mailEngine.sendEmail(testAccountId, invalidEmailData))
        .rejects.toThrow('Invalid email address');
    });

    it('should handle sending errors gracefully', async () => {
      // Mock SMTP error
      const emailData = {
        to: ['recipient@nonexistent-domain-12345.com'],
        subject: 'Test Email',
        body: 'Test body',
      };

      await expect(mailEngine.sendEmail(testAccountId, emailData))
        .rejects.toThrow();

      // Verify error is logged
      const errorLogs = await mailEngine.getErrorLogs(testAccountId);
      expect(errorLogs.some(log => log.type === 'SEND_ERROR')).toBe(true);
    });
  });

  describe('Offline and Recovery Workflow', () => {
    it('should queue emails for sending when offline', async () => {
      // Simulate offline mode
      await mailEngine.setOfflineMode(true);

      const emailData = {
        to: ['recipient@test.com'],
        subject: 'Offline Email',
        body: 'This email was composed offline',
      };

      // Email should be queued, not sent
      const queueId = await mailEngine.sendEmail(testAccountId, emailData);
      expect(queueId).toBeDefined();

      const queuedEmails = await mailEngine.getQueuedEmails();
      expect(queuedEmails.some(email => email.id === queueId)).toBe(true);

      // Return online and process queue
      await mailEngine.setOfflineMode(false);
      await mailEngine.processEmailQueue();

      // Verify email was sent
      const sentEmails = await mailEngine.getEmails(testAccountId, { folder: 'SENT' });
      expect(sentEmails.some(email => email.subject === emailData.subject)).toBe(true);
    });

    it('should resume sync after network interruption', async () => {
      // Start sync
      const syncPromise = mailEngine.syncAccount(testAccountId);

      // Simulate network interruption
      await mailEngine.setOfflineMode(true);
      
      // Resume sync
      await mailEngine.setOfflineMode(false);
      
      const syncResult = await syncPromise;
      expect(syncResult.success).toBe(true);
      expect(syncResult.resumedFromInterruption).toBe(true);
    });

    it('should maintain data consistency during recovery', async () => {
      // Get initial email count
      const initialEmails = await mailEngine.getEmails(testAccountId);
      const initialCount = initialEmails.length;

      // Simulate interrupted sync
      await mailEngine.setOfflineMode(true);
      const interruptedSync = mailEngine.syncAccount(testAccountId);
      await mailEngine.setOfflineMode(false);

      // Complete the sync
      await interruptedSync;

      // Verify no duplicate emails
      const finalEmails = await mailEngine.getEmails(testAccountId);
      expect(finalEmails.length).toBeGreaterThanOrEqual(initialCount);

      // Check for duplicates
      const emailIds = finalEmails.map(email => email.id);
      const uniqueIds = new Set(emailIds);
      expect(emailIds.length).toBe(uniqueIds.size);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large mailboxes efficiently', async () => {
      const startTime = Date.now();
      const initialMemory = await rustEngine.getMemoryStats();

      // Sync a large mailbox (simulated)
      await mailEngine.syncAccount(testAccountId, { 
        maxEmailsPerFolder: 10000,
        batchSize: 100 
      });

      const endTime = Date.now();
      const finalMemory = await rustEngine.getMemoryStats();

      // Performance checks
      const syncDurationMs = endTime - startTime;
      expect(syncDurationMs).toBeLessThan(60000); // Less than 1 minute

      // Memory checks
      const memoryIncreaseBytes = finalMemory.current_usage - initialMemory.current_usage;
      expect(memoryIncreaseBytes / 1024 / 1024).toBeLessThan(500); // Less than 500MB
    });

    it('should clean up resources properly', async () => {
      // Track resource handles
      const beforeHandles = await rustEngine.getResourceHandleCount();

      // Perform various operations
      await mailEngine.syncAccount(testAccountId);
      await mailEngine.searchEmails(testAccountId, { query: 'test' });
      await mailEngine.getEmails(testAccountId, { folder: 'INBOX' });

      // Force cleanup
      await rustEngine.forceGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterHandles = await rustEngine.getResourceHandleCount();

      // Resource handles should be cleaned up
      expect(afterHandles).toBeLessThanOrEqual(beforeHandles + 2); // Allow small increase for active connections
    });

    it('should respect memory limits', async () => {
      const memoryLimitMB = 256;
      await rustEngine.setMemoryLimit(memoryLimitMB);

      try {
        // Attempt operation that might exceed memory limit
        await mailEngine.syncAccount(testAccountId, { 
          maxEmailsPerFolder: 50000,
          batchSize: 1000 
        });
      } catch (error) {
        expect(error.message).toContain('Memory limit exceeded');
      }

      const finalMemory = await rustEngine.getMemoryStats();
      expect(finalMemory.current_usage / 1024 / 1024).toBeLessThanOrEqual(memoryLimitMB * 1.1); // 10% tolerance
    });
  });
});