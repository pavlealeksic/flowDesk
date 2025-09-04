#!/usr/bin/env node

/**
 * Desktop App Simulation Test
 * 
 * This simulates how the Electron desktop app would use the Rust engines
 * in a real-world scenario with proper error handling and async operations.
 */

const EventEmitter = require('events');

// Simulate the mail service from the desktop app
class MailEngineService extends EventEmitter {
  constructor(encryptionKey) {
    super();
    this.encryptionKey = encryptionKey;
    this.rustEngine = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('📧 Initializing Mail Engine Service...');
      
      // In the real app, this would import from the rust library
      const rustLib = require('./index.js');
      this.rustEngine = rustLib;
      
      await this.rustEngine.initialize();
      await this.rustEngine.initMailEngine();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('✅ Mail Engine Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Mail Engine Service:', error);
      throw error;
    }
  }

  async addAccount(accountData) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log('📧 Adding mail account:', accountData.email);
      
      const result = await this.rustEngine.addMailAccount({
        id: `mail-${Date.now()}`,
        email: accountData.email,
        provider: accountData.provider,
        display_name: accountData.displayName,
        is_enabled: true
      });

      this.emit('account-added', result);
      console.log('✅ Mail account added successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to add mail account:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async syncAccount(accountId) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log('📧 Syncing mail account:', accountId);
      
      this.emit('sync-started', { accountId });
      
      const syncResult = await this.rustEngine.syncMailAccount(accountId);
      
      this.emit('sync-completed', { accountId, syncResult });
      console.log('✅ Mail account synced successfully');
      return syncResult;
    } catch (error) {
      console.error('❌ Failed to sync mail account:', error);
      this.emit('sync-error', { accountId, error });
      throw error;
    }
  }

  async getMessages(accountId) {
    if (!this.isInitialized) await this.initialize();

    try {
      const messages = await this.rustEngine.getMailMessages(accountId);
      console.log(`📧 Retrieved ${messages.length} messages for account ${accountId}`);
      return messages;
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      throw error;
    }
  }
}

// Simulate the calendar service
class CalendarEngineService extends EventEmitter {
  constructor(encryptionKey) {
    super();
    this.encryptionKey = encryptionKey;
    this.rustEngine = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('📅 Initializing Calendar Engine Service...');
      
      const rustLib = require('./index.js');
      this.rustEngine = rustLib;
      
      await this.rustEngine.initCalendarEngine();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('✅ Calendar Engine Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Calendar Engine Service:', error);
      throw error;
    }
  }

  async createEvent(calendarId, eventData) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log('📅 Creating calendar event:', eventData.title);
      
      const eventId = await this.rustEngine.createCalendarEvent(
        calendarId,
        eventData.title,
        Math.floor(eventData.startTime.getTime() / 1000),
        Math.floor(eventData.endTime.getTime() / 1000)
      );

      this.emit('event-created', { eventId, calendarId });
      console.log('✅ Calendar event created successfully:', eventId);
      return eventId;
    } catch (error) {
      console.error('❌ Failed to create calendar event:', error);
      this.emit('error', error);
      throw error;
    }
  }
}

// Simulate the search service
class SearchEngineService extends EventEmitter {
  constructor() {
    super();
    this.rustEngine = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔍 Initializing Search Engine Service...');
      
      const rustLib = require('./index.js');
      this.rustEngine = rustLib;
      
      await this.rustEngine.initSearchEngine();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('✅ Search Engine Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Search Engine Service:', error);
      throw error;
    }
  }

  async indexDocument(doc) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log('🔍 Indexing document:', doc.title);
      
      await this.rustEngine.indexDocument(
        doc.id,
        doc.title,
        doc.content,
        doc.source,
        JSON.stringify(doc.metadata || {})
      );

      this.emit('document-indexed', doc);
      console.log('✅ Document indexed successfully');
    } catch (error) {
      console.error('❌ Failed to index document:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async search(query, limit = 20) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log('🔍 Searching for:', query);
      
      const results = await this.rustEngine.searchDocuments(query, limit);
      
      this.emit('search-completed', { query, results });
      console.log(`✅ Search completed: ${results.length} results found`);
      return results;
    } catch (error) {
      console.error('❌ Search failed:', error);
      this.emit('error', error);
      throw error;
    }
  }
}

// Main simulation function
async function runDesktopAppSimulation() {
  console.log('🖥️  Flow Desk Desktop App Simulation');
  console.log('====================================\n');

  try {
    // Initialize services (like the desktop app would)
    const encryptionKey = 'test-encryption-key-123';
    const mailService = new MailEngineService(encryptionKey);
    const calendarService = new CalendarEngineService(encryptionKey);
    const searchService = new SearchEngineService();

    // Set up event listeners
    mailService.on('initialized', () => console.log('📧 Mail service ready'));
    mailService.on('account-added', (result) => console.log('📧 Account added event:', result.id));
    mailService.on('sync-started', ({ accountId }) => console.log('📧 Sync started for:', accountId));
    mailService.on('sync-completed', ({ accountId }) => console.log('📧 Sync completed for:', accountId));

    calendarService.on('initialized', () => console.log('📅 Calendar service ready'));
    calendarService.on('event-created', ({ eventId }) => console.log('📅 Event created:', eventId));

    searchService.on('initialized', () => console.log('🔍 Search service ready'));
    searchService.on('document-indexed', (doc) => console.log('🔍 Indexed:', doc.title));

    // Simulate typical user workflows
    console.log('1. User opens the desktop app and services initialize...\n');
    
    // Initialize all services
    await Promise.all([
      mailService.initialize(),
      calendarService.initialize(),
      searchService.initialize()
    ]);

    console.log('\n2. User adds a mail account...\n');
    const mailAccount = await mailService.addAccount({
      email: 'user@company.com',
      provider: 'gmail',
      displayName: 'Work Email'
    });

    console.log('\n3. User syncs their mail...\n');
    await mailService.syncAccount(mailAccount.id);

    console.log('\n4. User checks for messages...\n');
    const messages = await mailService.getMessages(mailAccount.id);

    console.log('\n5. User creates a calendar event...\n');
    const eventId = await calendarService.createEvent('primary', {
      title: 'Important Meeting',
      startTime: new Date(Date.now() + 3600000), // 1 hour from now
      endTime: new Date(Date.now() + 7200000)    // 2 hours from now
    });

    console.log('\n6. User indexes some documents for search...\n');
    await searchService.indexDocument({
      id: 'doc-1',
      title: 'Project Proposal',
      content: 'This is a project proposal for the new feature implementation',
      source: 'documents',
      metadata: { type: 'proposal', department: 'engineering' }
    });

    await searchService.indexDocument({
      id: 'doc-2',
      title: 'Meeting Notes',
      content: 'Notes from the weekly team meeting about project status',
      source: 'documents',
      metadata: { type: 'meeting', department: 'engineering' }
    });

    console.log('\n7. User searches for documents...\n');
    const searchResults = await searchService.search('project');

    // Simulate concurrent operations
    console.log('\n8. Testing concurrent operations...\n');
    const concurrentOps = [
      mailService.getMessages(mailAccount.id),
      searchService.search('meeting'),
      calendarService.createEvent('work', {
        title: 'Follow-up Call',
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        endTime: new Date(Date.now() + 90000000)    // Tomorrow + 1 hour
      })
    ];

    const results = await Promise.all(concurrentOps);
    console.log('✅ Concurrent operations completed successfully');

    console.log('\n🎉 Desktop App Simulation Completed Successfully!');
    console.log('\n✅ All major workflows tested:');
    console.log('  - Service initialization ✅');
    console.log('  - Mail account management ✅');
    console.log('  - Mail synchronization ✅');
    console.log('  - Calendar event creation ✅');
    console.log('  - Document indexing ✅');
    console.log('  - Search functionality ✅');
    console.log('  - Concurrent operations ✅');
    console.log('  - Event-driven architecture ✅');
    
    console.log('\n🚀 The desktop app can successfully use the Rust engines!');

  } catch (error) {
    console.error('❌ Desktop app simulation failed:', error);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  MailEngineService,
  CalendarEngineService,
  SearchEngineService,
  runDesktopAppSimulation
};

// Run if executed directly
if (require.main === module) {
  runDesktopAppSimulation();
}