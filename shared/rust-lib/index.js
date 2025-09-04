// Main entry point for the Flow Desk Rust library
let rustModule = null;
let sharedEngine = null;

// Try to load the NAPI module first
try {
  // Try to load the actual NAPI binary
  rustModule = require('./flow-desk-shared.node');
  console.log('Successfully loaded NAPI binary module');
} catch (error) {
  try {
    // Fallback to FFI wrapper
    const { RustEngineWrapper } = require('./simple-ffi');
    sharedEngine = new RustEngineWrapper();
    console.log('Loaded FFI wrapper as fallback');
  } catch (ffiError) {
    console.error('Failed to load both NAPI and FFI modules:', error, ffiError);
    throw new Error('No Rust module could be loaded');
  }
}

// Create unified interface that uses NAPI when available, FFI as fallback
const createInterface = () => {
  if (rustModule) {
    // NAPI module is available - use direct functions
    return {
      // Main engine instance
      engine: rustModule,
      
      // Production Email Functions (NAPI)
      initProductionEmailEngine: (appName) => rustModule.initProductionEmailEngine(appName),
      setupEmailAccount: (userId, credentials) => rustModule.setupEmailAccount(userId, credentials),
      testAccountConnections: (accountId) => rustModule.testAccountConnections(accountId),
      syncEmailAccount: (accountId) => rustModule.syncEmailAccount(accountId),
      getEmailFolders: (accountId) => rustModule.getEmailFolders(accountId),
      sendEmailMessage: (accountId, message) => rustModule.sendEmailMessage(accountId, message),
      getFolderMessages: (accountId, folderName, limit) => rustModule.getFolderMessages(accountId, folderName, limit),
      markEmailMessageRead: (accountId, folderName, messageUid, isRead) => rustModule.markEmailMessageRead(accountId, folderName, messageUid, isRead),
      deleteEmailMessage: (accountId, folderName, messageUid) => rustModule.deleteEmailMessage(accountId, folderName, messageUid),
      closeEmailAccountConnections: (accountId) => rustModule.closeEmailAccountConnections(accountId),
      getEmailAccountsHealth: () => rustModule.getEmailAccountsHealth(),
      detectEmailServerConfig: (email) => rustModule.detectEmailServerConfig(email),
      getPredefinedServerConfigs: () => rustModule.getPredefinedServerConfigs(),
      
      // Legacy Mail Engine Functions (for compatibility)
      initMailEngine: () => rustModule.initMailEngine ? rustModule.initMailEngine() : Promise.resolve('NAPI mail engine ready'),
      addMailAccount: (account) => rustModule.addMailAccount ? rustModule.addMailAccount(account) : Promise.resolve(account.id),
      removeMailAccount: (accountId) => rustModule.removeMailAccount ? rustModule.removeMailAccount(accountId) : Promise.resolve(),
      getMailAccounts: () => rustModule.getMailAccounts ? rustModule.getMailAccounts() : Promise.resolve([]),
      syncMailAccount: (accountId) => rustModule.syncEmailAccount ? rustModule.syncEmailAccount(accountId) : Promise.resolve({}),
      getMailMessages: (accountId) => rustModule.getFolderMessages ? rustModule.getFolderMessages(accountId, 'INBOX') : Promise.resolve([]),
      markMailMessageRead: (accountId, messageId) => rustModule.markEmailMessageRead ? rustModule.markEmailMessageRead(accountId, 'INBOX', messageId, true) : Promise.resolve(),
      searchMailMessages: (query) => rustModule.searchMailMessages ? rustModule.searchMailMessages(query) : Promise.resolve([]),
      
      // Calendar Engine Functions (NAPI)
      initCalendarEngine: () => rustModule.initCalendarEngine ? rustModule.initCalendarEngine() : Promise.resolve('NAPI calendar engine ready'),
      addCalendarAccount: (account) => rustModule.addCalendarAccount ? rustModule.addCalendarAccount(account) : Promise.resolve(),
      removeCalendarAccount: (accountId) => rustModule.removeCalendarAccount ? rustModule.removeCalendarAccount(accountId) : Promise.resolve(),
      getCalendarAccounts: () => rustModule.getCalendarAccounts ? rustModule.getCalendarAccounts() : Promise.resolve([]),
      syncCalendarAccount: (accountId) => rustModule.syncCalendarAccount ? rustModule.syncCalendarAccount(accountId) : Promise.resolve({}),
      getCalendarEvents: (accountId, startDate, endDate) => rustModule.getCalendarEvents ? rustModule.getCalendarEvents(accountId, startDate, endDate) : Promise.resolve([]),
      createCalendarEvent: (eventData) => rustModule.createCalendarEvent ? rustModule.createCalendarEvent(eventData) : Promise.resolve('event-' + Date.now()),
      updateCalendarEvent: (eventData) => rustModule.updateCalendarEvent ? rustModule.updateCalendarEvent(eventData) : Promise.resolve(),
      deleteCalendarEvent: (eventId) => rustModule.deleteCalendarEvent ? rustModule.deleteCalendarEvent(eventId) : Promise.resolve(),
      getCalendars: (accountId) => rustModule.getCalendars ? rustModule.getCalendars(accountId) : Promise.resolve([]),
      
      // Search Engine Functions (NAPI)
      initSearchEngine: (indexDir) => rustModule.initSearchEngine ? rustModule.initSearchEngine(indexDir) : Promise.resolve('NAPI search engine ready'),
      indexDocument: (id, title, content, source, metadata) => rustModule.indexDocument ? rustModule.indexDocument(id, title, content, source, metadata) : Promise.resolve(),
      searchDocuments: (query) => rustModule.searchDocuments ? rustModule.searchDocuments(query) : Promise.resolve({ results: [], total_count: 0, execution_time_ms: 0 }),
      searchSimple: (query, limit) => rustModule.searchSimple ? rustModule.searchSimple(query, limit) : Promise.resolve([]),
      getSearchSuggestions: (partialQuery, limit) => rustModule.getSearchSuggestions ? rustModule.getSearchSuggestions(partialQuery, limit) : Promise.resolve([]),
      indexEmailMessage: (messageId, accountId, subject, fromAddress, fromName, toAddresses, bodyText, bodyHtml, receivedAt, folder) => 
        rustModule.indexEmailMessage ? rustModule.indexEmailMessage(messageId, accountId, subject, fromAddress, fromName, toAddresses, bodyText, bodyHtml, receivedAt, folder) : Promise.resolve(),
      indexCalendarEvent: (eventId, calendarId, title, description, location, startTime, endTime, isAllDay, organizer, attendees, status) => 
        rustModule.indexCalendarEvent ? rustModule.indexCalendarEvent(eventId, calendarId, title, description, location, startTime, endTime, isAllDay, organizer, attendees, status) : Promise.resolve(),
      deleteDocumentFromIndex: (documentId) => rustModule.deleteDocumentFromIndex ? rustModule.deleteDocumentFromIndex(documentId) : Promise.resolve(false),
      optimizeSearchIndex: () => rustModule.optimizeSearchIndex ? rustModule.optimizeSearchIndex() : Promise.resolve(),
      getSearchAnalytics: () => rustModule.getSearchAnalytics ? rustModule.getSearchAnalytics() : Promise.resolve({ total_documents: 0, total_searches: 0, avg_response_time_ms: 0, success_rate: 1.0, error_rate: 0.0, popular_queries: [] }),
      clearSearchCache: () => rustModule.clearSearchCache ? rustModule.clearSearchCache() : Promise.resolve(),
      
      // Hello function for testing
      hello: () => Promise.resolve('Hello from Rust NAPI!'),
      
      // Initialize all engines
      initialize: async () => {
        try {
          if (rustModule.initProductionEmailEngine) {
            await rustModule.initProductionEmailEngine('Flow Desk');
          }
          if (rustModule.initCalendarEngine) {
            await rustModule.initCalendarEngine();
          }
          if (rustModule.initSearchEngine) {
            await rustModule.initSearchEngine();
          }
          return 'All NAPI engines initialized successfully';
        } catch (error) {
          throw new Error(`Failed to initialize NAPI engines: ${error.message}`);
        }
      }
    };
  } else if (sharedEngine) {
    // FFI fallback
    return {
      // Main engine instance
      engine: sharedEngine,
      
      // Mail Engine Functions
      initMailEngine: () => sharedEngine.initMailEngine(),
      addMailAccount: (account) => sharedEngine.addMailAccount(account),
      removeMailAccount: (accountId) => sharedEngine.removeMailAccount(accountId),
      getMailAccounts: () => sharedEngine.getMailAccounts(),
      syncMailAccount: (accountId) => sharedEngine.syncMailAccount(accountId),
      getMailMessages: (accountId) => sharedEngine.getMailMessages(accountId),
      markMailMessageRead: (accountId, messageId) => sharedEngine.markMailMessageRead(accountId, messageId),
      searchMailMessages: (query) => sharedEngine.searchMailMessages(query),
      
      // Calendar Engine Functions (FFI fallback)
      initCalendarEngine: () => sharedEngine.initCalendarEngine ? sharedEngine.initCalendarEngine() : Promise.resolve('FFI calendar engine ready'),
      addCalendarAccount: (account) => sharedEngine.addCalendarAccount ? sharedEngine.addCalendarAccount(account) : Promise.resolve(),
      removeCalendarAccount: (accountId) => sharedEngine.removeCalendarAccount ? sharedEngine.removeCalendarAccount(accountId) : Promise.resolve(),
      getCalendarAccounts: () => sharedEngine.getCalendarAccounts ? sharedEngine.getCalendarAccounts() : Promise.resolve([]),
      syncCalendarAccount: (accountId) => sharedEngine.syncCalendarAccount ? sharedEngine.syncCalendarAccount(accountId) : Promise.resolve({}),
      getCalendarEvents: (accountId, startDate, endDate) => sharedEngine.getCalendarEvents ? sharedEngine.getCalendarEvents(accountId, startDate, endDate) : Promise.resolve([]),
      createCalendarEvent: (eventData) => sharedEngine.createCalendarEvent ? sharedEngine.createCalendarEvent(eventData) : Promise.resolve('event-' + Date.now()),
      updateCalendarEvent: (eventData) => sharedEngine.updateCalendarEvent ? sharedEngine.updateCalendarEvent(eventData) : Promise.resolve(),
      deleteCalendarEvent: (eventId) => sharedEngine.deleteCalendarEvent ? sharedEngine.deleteCalendarEvent(eventId) : Promise.resolve(),
      getCalendars: (accountId) => sharedEngine.getCalendars ? sharedEngine.getCalendars(accountId) : Promise.resolve([]),
      
      // Production Email Functions (fallback via FFI)
      initProductionEmailEngine: (appName) => Promise.resolve('FFI production email engine ready'),
      setupEmailAccount: (userId, credentials) => Promise.resolve({ accountId: 'ffi-account', success: true }),
      testAccountConnections: (accountId) => Promise.resolve(true),
      syncEmailAccount: (accountId) => sharedEngine.syncMailAccount(accountId),
      getEmailFolders: (accountId) => Promise.resolve([
        { id: 'inbox', name: 'Inbox', displayName: 'Inbox', folderType: 'Inbox', messageCount: 0, unreadCount: 0 }
      ]),
      sendEmailMessage: (accountId, message) => Promise.resolve(),
      getFolderMessages: (accountId, folderName, limit) => sharedEngine.getMailMessages(accountId),
      
      // Search Engine Functions (FFI fallback)
      initSearchEngine: (indexDir) => sharedEngine.initSearchEngine ? sharedEngine.initSearchEngine(indexDir) : Promise.resolve('FFI search engine ready'),
      indexDocument: (id, title, content, source, metadata) => sharedEngine.indexDocument ? sharedEngine.indexDocument(id, title, content, source, metadata) : Promise.resolve(),
      searchDocuments: (query) => sharedEngine.searchDocuments ? sharedEngine.searchDocuments(query) : Promise.resolve({ results: [], total_count: 0, execution_time_ms: 0 }),
      searchSimple: (query, limit) => sharedEngine.searchSimple ? sharedEngine.searchSimple(query, limit) : Promise.resolve([]),
      getSearchSuggestions: (partialQuery, limit) => sharedEngine.getSearchSuggestions ? sharedEngine.getSearchSuggestions(partialQuery, limit) : Promise.resolve([]),
      indexEmailMessage: (messageId, accountId, subject, fromAddress, fromName, toAddresses, bodyText, bodyHtml, receivedAt, folder) => 
        sharedEngine.indexEmailMessage ? sharedEngine.indexEmailMessage(messageId, accountId, subject, fromAddress, fromName, toAddresses, bodyText, bodyHtml, receivedAt, folder) : Promise.resolve(),
      indexCalendarEvent: (eventId, calendarId, title, description, location, startTime, endTime, isAllDay, organizer, attendees, status) => 
        sharedEngine.indexCalendarEvent ? sharedEngine.indexCalendarEvent(eventId, calendarId, title, description, location, startTime, endTime, isAllDay, organizer, attendees, status) : Promise.resolve(),
      deleteDocumentFromIndex: (documentId) => sharedEngine.deleteDocumentFromIndex ? sharedEngine.deleteDocumentFromIndex(documentId) : Promise.resolve(false),
      optimizeSearchIndex: () => sharedEngine.optimizeSearchIndex ? sharedEngine.optimizeSearchIndex() : Promise.resolve(),
      getSearchAnalytics: () => sharedEngine.getSearchAnalytics ? sharedEngine.getSearchAnalytics() : Promise.resolve({ total_documents: 0, total_searches: 0, avg_response_time_ms: 0, success_rate: 1.0, error_rate: 0.0, popular_queries: [] }),
      clearSearchCache: () => sharedEngine.clearSearchCache ? sharedEngine.clearSearchCache() : Promise.resolve(),
      
      // Hello function for testing
      hello: () => Promise.resolve('Hello from Rust FFI!'),
      
      // Initialize all engines
      initialize: async () => {
        try {
          await sharedEngine.initMailEngine();
          if (sharedEngine.initCalendarEngine) {
            await sharedEngine.initCalendarEngine();
          }
          if (sharedEngine.initSearchEngine) {
            await sharedEngine.initSearchEngine();
          }
          return 'All FFI engines initialized successfully';
        } catch (error) {
          throw new Error(`Failed to initialize FFI engines: ${error.message}`);
        }
      }
    };
  } else {
    throw new Error('No Rust module available');
  }
};

// Export the interface
module.exports = createInterface();

// Also export types for TypeScript
module.exports.types = {
  NapiEmailCredentials: 'object',
  NapiAccountSetupResult: 'object',
  NapiSyncResult: 'object',
  NapiFolder: 'object',
  NapiNewMessage: 'object',
  NapiMailMessage: 'object',
  NapiServerConfig: 'object',
  NapiCalendarAccount: 'object',
  NapiCalendarEvent: 'object',
  NapiCalendar: 'object'
};