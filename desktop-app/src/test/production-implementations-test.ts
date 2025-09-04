/**
 * Production Implementations Integration Test
 * 
 * Tests the real implementations of email cache, search engine, and plugin APIs
 * to ensure they work correctly in production.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmailCache } from '../main/email-cache';
import { LocalSearchEngine } from '../main/search/SearchEngine';
import { PluginAPIProvider } from '../main/plugin-runtime/api/PluginAPIProvider';
import { PluginEventBus } from '../main/plugin-runtime/events/PluginEventBus';
import { PluginStorageManager } from '../main/plugin-runtime/storage/PluginStorageManager';
import { PluginSecurityManager } from '../main/plugin-runtime/security/PluginSecurityManager';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Production Implementations Integration Test', () => {
  let testDir: string;
  let emailCache: EmailCache;
  let searchEngine: LocalSearchEngine;
  let apiProvider: PluginAPIProvider;
  let eventBus: PluginEventBus;
  let storageManager: PluginStorageManager;
  let securityManager: PluginSecurityManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `flow-desk-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock Electron app.getPath for tests
    const mockApp = {
      getPath: (name: string) => {
        switch (name) {
          case 'userData': return testDir;
          case 'cache': return join(testDir, 'cache');
          default: return testDir;
        }
      },
      getName: () => 'FlowDeskTest',
      getVersion: () => '1.0.0'
    };

    // Replace app import globally for tests
    jest.doMock('electron', () => ({ app: mockApp }), { virtual: true });

    // Initialize services
    emailCache = new EmailCache();
    searchEngine = new LocalSearchEngine();
    
    eventBus = new PluginEventBus();
    storageManager = new PluginStorageManager(testDir);
    securityManager = new PluginSecurityManager(storageManager);
    
    apiProvider = new PluginAPIProvider(
      eventBus,
      storageManager,
      securityManager
    );
  });

  afterEach(async () => {
    // Cleanup
    try {
      await emailCache.close();
      await searchEngine.close();
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Email Cache Service', () => {
    it('should initialize and store/retrieve messages', async () => {
      await emailCache.initialize();

      const testMessage = {
        id: 'test-msg-1',
        messageId: 'msg-123',
        accountId: 'account-1',
        folderId: 'INBOX',
        subject: 'Test Email',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        date: new Date(),
        bodyText: 'This is a test email',
        flags: [],
        size: 1024,
        isRead: false,
        isImportant: false,
        isDraft: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert message
      await emailCache.insertMessage('account-1', 'INBOX', testMessage);

      // Retrieve messages
      const messages = await emailCache.getMessages('account-1', 'INBOX');
      
      expect(messages).toHaveLength(1);
      expect(messages[0].subject).toBe('Test Email');
      expect(messages[0].from).toBe('sender@example.com');
    });

    it('should search messages by content', async () => {
      await emailCache.initialize();

      const testMessages = [
        {
          messageId: 'msg-1',
          subject: 'Important Project Update',
          from: 'manager@company.com',
          to: ['team@company.com'],
          bodyText: 'The project deadline has been moved to next week.',
          date: new Date(),
          flags: [],
          size: 512,
          isRead: false,
          isImportant: true,
          isDraft: false,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          messageId: 'msg-2',
          subject: 'Meeting Notes',
          from: 'colleague@company.com',
          to: ['team@company.com'],
          bodyText: 'Here are the notes from our project meeting.',
          date: new Date(),
          flags: [],
          size: 256,
          isRead: true,
          isImportant: false,
          isDraft: false,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const msg of testMessages) {
        await emailCache.insertMessage('account-1', 'INBOX', msg);
      }

      // Search for messages containing "project"
      const searchResults = await emailCache.searchMessages('project', 'account-1');
      
      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].subject).toContain('Project');
    });

    it('should provide cache statistics', async () => {
      await emailCache.initialize();

      // Add some test data
      await emailCache.insertMessage('account-1', 'INBOX', {
        messageId: 'msg-1',
        subject: 'Test',
        from: 'test@example.com',
        to: ['user@example.com'],
        date: new Date(),
        flags: [],
        size: 100,
        isRead: false,
        isImportant: false,
        isDraft: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const stats = await emailCache.getStats();
      
      expect(stats.totalMessages).toBe(1);
      expect(stats.totalAccounts).toBe(1);
      expect(stats.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Search Engine', () => {
    it('should initialize and index documents', async () => {
      await searchEngine.initialize();

      const testDoc = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'This is a test document about machine learning and artificial intelligence.',
        source: 'test',
        metadata: { author: 'Test User' },
        tags: ['ai', 'ml', 'test'],
        category: 'research',
        importance: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await searchEngine.addDocument(testDoc);
      
      expect(searchEngine.getDocumentCount()).toBe(1);
    });

    it('should search documents with relevance scoring', async () => {
      await searchEngine.initialize();

      const testDocs = [
        {
          id: 'doc-1',
          title: 'Machine Learning Basics',
          content: 'Introduction to machine learning algorithms and techniques.',
          source: 'education',
          metadata: {},
          tags: ['ml', 'ai', 'beginner'],
          category: 'tutorial',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'doc-2',
          title: 'Advanced AI Concepts',
          content: 'Deep dive into artificial intelligence and neural networks.',
          source: 'education',
          metadata: {},
          tags: ['ai', 'neural', 'advanced'],
          category: 'tutorial',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const doc of testDocs) {
        await searchEngine.addDocument(doc);
      }

      // Search for "machine learning"
      const results = await searchEngine.search('machine learning');
      
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Machine Learning Basics'); // Should rank higher
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should provide search suggestions', async () => {
      await searchEngine.initialize();

      await searchEngine.addDocument({
        id: 'doc-1',
        title: 'Artificial Intelligence Guide',
        content: 'Complete guide to AI development',
        source: 'guide',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const suggestions = await searchEngine.getSuggestions('artif');
      
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should track search analytics', async () => {
      await searchEngine.initialize();

      await searchEngine.addDocument({
        id: 'doc-1',
        title: 'Test Document',
        content: 'Test content',
        source: 'test',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Perform some searches
      await searchEngine.search('test');
      await searchEngine.search('document');
      await searchEngine.search('nonexistent');

      const analytics = searchEngine.getAnalytics();
      
      expect(analytics.totalQueries).toBe(3);
      expect(analytics.averageResultCount).toBeGreaterThan(0);
      expect(analytics.noResultsQueries).toContain('nonexistent');
    });
  });

  describe('Plugin API Provider', () => {
    it('should create secure API instances for plugins', async () => {
      const mockInstallation = {
        id: 'install-1',
        pluginId: 'test-plugin',
        version: '1.0.0',
        enabled: true,
        permissions: ['network', 'search:query'],
        scopes: ['mail:read']
      };

      const mockManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        main: 'index.js',
        permissions: ['network']
      };

      const api = apiProvider.createAPI(mockInstallation, mockManifest);
      
      expect(api).toBeDefined();
      expect(api.version).toBe('1.0.0');
      expect(api.plugin).toBe(mockManifest);
      expect(api.platform.type).toBe('desktop');
    });

    it('should integrate with search engine for plugin searches', async () => {
      await searchEngine.initialize();
      
      // Add a test document
      await searchEngine.addDocument({
        id: 'plugin-doc-1',
        title: 'Plugin Documentation',
        content: 'How to develop plugins for Flow Desk',
        source: 'plugin:test-plugin',
        metadata: { pluginId: 'test-plugin' },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const mockInstallation = {
        id: 'install-1',
        pluginId: 'test-plugin',
        version: '1.0.0',
        enabled: true,
        permissions: ['search:query'],
        scopes: []
      };

      const mockManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        main: 'index.js',
        permissions: ['search:query']
      };

      const api = apiProvider.createAPI(mockInstallation, mockManifest);
      
      const searchResults = await api.search.search('plugin');
      
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);
    });
  });

  describe('Integration Test', () => {
    it('should work together: plugin indexing content and searching it', async () => {
      await searchEngine.initialize();

      const mockInstallation = {
        id: 'install-1',
        pluginId: 'content-plugin',
        version: '1.0.0',
        enabled: true,
        permissions: ['search:index', 'search:query'],
        scopes: []
      };

      const mockManifest = {
        id: 'content-plugin',
        name: 'Content Plugin',
        version: '1.0.0',
        description: 'Indexes content',
        main: 'index.js',
        permissions: ['search:index', 'search:query']
      };

      const api = apiProvider.createAPI(mockInstallation, mockManifest);
      
      // Plugin indexes some content
      await api.search.index({
        id: 'content-1',
        title: 'Plugin Generated Content',
        content: 'This content was generated by a plugin for testing purposes.',
        metadata: { source: 'plugin' },
        tags: ['plugin', 'generated'],
        category: 'content',
        createdAt: new Date()
      });

      // Plugin searches for the content
      const results = await api.search.search('plugin generated');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Plugin Generated Content');
      expect(results[0].source).toBe('plugin:content-plugin');
    });

    it('should handle email cache integration with plugin data API', async () => {
      await emailCache.initialize();

      // Add test email
      await emailCache.insertMessage('account-1', 'INBOX', {
        messageId: 'msg-1',
        subject: 'Plugin Integration Test',
        from: 'test@example.com',
        to: ['user@example.com'],
        bodyText: 'This email tests plugin integration',
        date: new Date(),
        flags: [],
        size: 200,
        isRead: false,
        isImportant: false,
        isDraft: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const mockInstallation = {
        id: 'install-1',
        pluginId: 'email-plugin',
        version: '1.0.0',
        enabled: true,
        permissions: [],
        scopes: ['mail:read']
      };

      const mockManifest = {
        id: 'email-plugin',
        name: 'Email Plugin',
        version: '1.0.0',
        description: 'Accesses emails',
        main: 'index.js',
        permissions: []
      };

      const api = apiProvider.createAPI(mockInstallation, mockManifest);
      
      // Plugin retrieves emails
      const messages = await api.data.mail.getMessages('account-1', { folderId: 'INBOX' });
      
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].subject).toBe('Plugin Integration Test');

      // Plugin searches emails
      const searchResults = await api.data.mail.searchMessages('integration');
      
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });
});