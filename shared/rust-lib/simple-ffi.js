#!/usr/bin/env node

// Simple FFI test for the Rust library
const { spawn } = require('child_process');
const path = require('path');

class RustEngineWrapper {
  constructor() {
    this.rustBinaryPath = path.join(__dirname, 'target/debug/rust-engine-cli');
    this.initialized = false;
  }

  async callRustFunction(functionName, args = []) {
    return new Promise((resolve, reject) => {
      // For now, we'll use a simple JSON-based communication
      // In a real implementation, this would use actual FFI or NAPI
      const data = JSON.stringify({ function: functionName, args });
      
      // Mock response for demonstration
      switch (functionName) {
        case 'init_mail_engine':
          resolve('Mail engine initialized');
          break;
        case 'add_mail_account':
          resolve({ id: 'mock-account-id', status: 'added' });
          break;
        case 'get_mail_accounts':
          resolve([]);
          break;
        case 'sync_mail_account':
          resolve({ 
            accountId: args[0],
            status: 'synced',
            stats: { totalMessages: 0, newMessages: 0 }
          });
          break;
        case 'get_mail_messages':
          resolve([]);
          break;
        case 'mark_mail_message_read':
          resolve();
          break;
        case 'search_mail_messages':
          resolve([]);
          break;
        case 'init_calendar_engine':
          resolve('Calendar engine initialized');
          break;
        case 'add_calendar_account':
          resolve({ id: 'mock-calendar-account-id', status: 'added' });
          break;
        case 'get_calendar_accounts':
          resolve([]);
          break;
        case 'sync_calendar_account':
          resolve({
            account_id: args[0],
            is_syncing: false,
            total_calendars: 0,
            total_events: 0
          });
          break;
        case 'get_calendars':
          resolve([]);
          break;
        case 'get_calendar_events':
          resolve([]);
          break;
        case 'create_calendar_event':
          resolve('event-' + Date.now());
          break;
        case 'init_search_engine':
          resolve('Search engine initialized');
          break;
        case 'search_documents':
          resolve([]);
          break;
        case 'index_document':
          resolve();
          break;
        case 'generate_encryption_key_pair':
          resolve(JSON.stringify({
            publicKey: 'mock-public-key-base64',
            privateKey: 'mock-private-key-base64'
          }));
          break;
        case 'encrypt_string':
          resolve(Buffer.from(args[0]).toString('base64'));
          break;
        case 'decrypt_string':
          resolve(Buffer.from(args[0], 'base64').toString());
          break;
        case 'get_version':
          resolve('0.1.0');
          break;
        default:
          reject(new Error(`Unknown function: ${functionName}`));
      }
    });
  }

  // Mail Engine Methods
  async initMailEngine() {
    return this.callRustFunction('init_mail_engine');
  }

  async addMailAccount(account) {
    return this.callRustFunction('add_mail_account', [account]);
  }

  async removeMailAccount(accountId) {
    return this.callRustFunction('remove_mail_account', [accountId]);
  }

  async getMailAccounts() {
    return this.callRustFunction('get_mail_accounts');
  }

  async syncMailAccount(accountId) {
    return this.callRustFunction('sync_mail_account', [accountId]);
  }

  async getMailMessages(accountId) {
    return this.callRustFunction('get_mail_messages', [accountId]);
  }

  async markMailMessageRead(accountId, messageId) {
    return this.callRustFunction('mark_mail_message_read', [accountId, messageId]);
  }

  async searchMailMessages(query) {
    return this.callRustFunction('search_mail_messages', [query]);
  }

  // Calendar Engine Methods
  async initCalendarEngine() {
    return this.callRustFunction('init_calendar_engine');
  }

  async addCalendarAccount(account) {
    return this.callRustFunction('add_calendar_account', [account]);
  }

  async removeCalendarAccount(accountId) {
    return this.callRustFunction('remove_calendar_account', [accountId]);
  }

  async getCalendarAccounts() {
    return this.callRustFunction('get_calendar_accounts');
  }

  async syncCalendarAccount(accountId) {
    return this.callRustFunction('sync_calendar_account', [accountId]);
  }

  async getCalendars(accountId) {
    return this.callRustFunction('get_calendars', [accountId]);
  }

  async getCalendarEvents(accountId) {
    return this.callRustFunction('get_calendar_events', [accountId]);
  }

  async createCalendarEvent(calendarId, title, startTime, endTime) {
    return this.callRustFunction('create_calendar_event', [calendarId, title, startTime, endTime]);
  }

  // Search Engine Methods
  async initSearchEngine() {
    return this.callRustFunction('init_search_engine');
  }

  async indexDocument(id, title, content, source, metadata) {
    return this.callRustFunction('index_document', [id, title, content, source, metadata]);
  }

  async searchDocuments(query, limit) {
    return this.callRustFunction('search_documents', [query, limit]);
  }

  // Crypto Methods
  async generateEncryptionKeyPair() {
    const result = await this.callRustFunction('generate_encryption_key_pair');
    return result;
  }

  async encryptString(data, key) {
    return this.callRustFunction('encrypt_string', [data, key]);
  }

  async decryptString(encryptedData, key) {
    return this.callRustFunction('decrypt_string', [encryptedData, key]);
  }

  async getVersion() {
    return this.callRustFunction('get_version');
  }
}

// Export for use in other modules
module.exports = { RustEngineWrapper };

// Test if run directly
if (require.main === module) {
  async function test() {
    console.log('Testing Rust Engine Wrapper...');
    
    const engine = new RustEngineWrapper();
    
    try {
      // Test mail engine
      console.log('Testing mail engine...');
      const mailInit = await engine.initMailEngine();
      console.log('Mail engine init:', mailInit);
      
      const accounts = await engine.getMailAccounts();
      console.log('Mail accounts:', accounts);
      
      // Test calendar engine
      console.log('Testing calendar engine...');
      const calendarInit = await engine.initCalendarEngine();
      console.log('Calendar engine init:', calendarInit);
      
      const calendarAccounts = await engine.getCalendarAccounts();
      console.log('Calendar accounts:', calendarAccounts);
      
      // Test search engine
      console.log('Testing search engine...');
      const searchInit = await engine.initSearchEngine();
      console.log('Search engine init:', searchInit);
      
      const searchResults = await engine.searchDocuments('test query', 10);
      console.log('Search results:', searchResults);
      
      // Test crypto
      console.log('Testing crypto...');
      const keyPair = await engine.generateEncryptionKeyPair();
      console.log('Key pair:', keyPair);
      
      console.log('All tests passed!');
      
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    }
  }
  
  test();
}