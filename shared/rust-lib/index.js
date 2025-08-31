// Main entry point for the Flow Desk Rust library
const { RustEngineWrapper } = require('./simple-ffi');

// Create a shared instance
const sharedEngine = new RustEngineWrapper();

// Export the main interface
module.exports = {
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
  
  // Calendar Engine Functions
  initCalendarEngine: () => sharedEngine.initCalendarEngine(),
  addCalendarAccount: (account) => sharedEngine.addCalendarAccount(account),
  removeCalendarAccount: (accountId) => sharedEngine.removeCalendarAccount(accountId),
  getCalendarAccounts: () => sharedEngine.getCalendarAccounts(),
  syncCalendarAccount: (accountId) => sharedEngine.syncCalendarAccount(accountId),
  getCalendars: (accountId) => sharedEngine.getCalendars(accountId),
  getCalendarEvents: (accountId) => sharedEngine.getCalendarEvents(accountId),
  createCalendarEvent: (calendarId, title, startTime, endTime) => sharedEngine.createCalendarEvent(calendarId, title, startTime, endTime),
  
  // Search Engine Functions
  initSearchEngine: () => sharedEngine.initSearchEngine(),
  indexDocument: (id, title, content, source, metadata) => sharedEngine.indexDocument(id, title, content, source, metadata),
  searchDocuments: (query, limit) => sharedEngine.searchDocuments(query, limit),
  
  // Crypto Functions
  generateEncryptionKeyPair: () => sharedEngine.generateEncryptionKeyPair(),
  encryptString: (data, key) => sharedEngine.encryptString(data, key),
  decryptString: (encryptedData, key) => sharedEngine.decryptString(encryptedData, key),
  getVersion: () => sharedEngine.getVersion(),
  
  // Hello function for testing
  hello: () => Promise.resolve('Hello from Rust!'),
  
  // Initialize all engines
  initialize: async () => {
    try {
      await sharedEngine.initMailEngine();
      await sharedEngine.initCalendarEngine();
      await sharedEngine.initSearchEngine();
      return 'All engines initialized successfully';
    } catch (error) {
      throw new Error(`Failed to initialize engines: ${error.message}`);
    }
  }
};

// Also export types for TypeScript (these will be generated)
module.exports.types = {
  // Mail types
  NapiMailAccount: 'object',
  NapiMailMessage: 'object',
  NapiMailSyncStatus: 'object',
  
  // Calendar types
  NapiCalendarAccount: 'object',
  NapiCalendar: 'object',
  NapiCalendarEvent: 'object',
  NapiCalendarSyncStatus: 'object',
  
  // Search types
  NapiSearchResult: 'object'
};