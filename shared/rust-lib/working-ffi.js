const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');

// Path to the compiled Rust library
const libPath = path.join(__dirname, 'target', 'release', 'libflow_desk_shared.dylib');

console.log(`Loading Rust library from: ${libPath}`);

// Define the library interface
const lib = ffi.Library(libPath, {
  // Initialize functions
  'init_mail_engine': ['void', []],
  'init_calendar_engine': ['void', []], 
  'init_search_engine': ['void', []],
  
  // Mail functions
  'add_mail_account': ['string', ['string', 'string', 'string', 'string']],
  'get_mail_accounts': ['string', []],
  'sync_mail_account': ['string', ['string']],
  'get_mail_messages': ['string', ['string']],
  
  // Calendar functions  
  'add_calendar_account': ['string', ['string', 'string', 'string', 'string']],
  'get_calendar_accounts': ['string', []],
  'create_calendar_event': ['string', ['string', 'string', 'string', 'string']],
  
  // Search functions
  'index_document': ['void', ['string', 'string', 'string', 'string']],
  'search_documents': ['string', ['string', 'uint32']],
  
  // Crypto functions
  'generate_key_pair': ['string', []],
  'encrypt_string': ['string', ['string', 'string']],
  'decrypt_string': ['string', ['string', 'string']],
});

// Wrapper class for easier usage
class FlowDeskRustEngine {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    try {
      lib.init_mail_engine();
      lib.init_calendar_engine();
      lib.init_search_engine();
      this.initialized = true;
      return { status: 'success', message: 'All engines initialized' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Mail functions
  addMailAccount(id, email, provider, name) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.add_mail_account(id, email, provider, name);
    return JSON.parse(result);
  }

  getMailAccounts() {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.get_mail_accounts();
    return JSON.parse(result);
  }

  syncMailAccount(accountId) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.sync_mail_account(accountId);
    return JSON.parse(result);
  }

  getMailMessages(accountId) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.get_mail_messages(accountId);
    return JSON.parse(result);
  }

  // Calendar functions
  addCalendarAccount(id, email, provider, name) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.add_calendar_account(id, email, provider, name);
    return JSON.parse(result);
  }

  getCalendarAccounts() {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.get_calendar_accounts();
    return JSON.parse(result);
  }

  createCalendarEvent(calendarId, title, startTime, endTime) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.create_calendar_event(calendarId, title, startTime, endTime);
    return result;
  }

  // Search functions
  indexDocument(id, title, content, source) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const metadata = JSON.stringify({ type: 'document', source });
    lib.index_document(id, title, content, metadata);
    return { status: 'indexed', id };
  }

  searchDocuments(query, limit = 10) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.search_documents(query, limit);
    return JSON.parse(result);
  }

  // Crypto functions
  generateKeyPair() {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.generate_key_pair();
    return JSON.parse(result);
  }

  encryptString(data, key) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.encrypt_string(data, key);
    return result;
  }

  decryptString(encryptedData, key) {
    if (!this.initialized) throw new Error('Engine not initialized');
    const result = lib.decrypt_string(encryptedData, key);
    return result;
  }
}

module.exports = FlowDeskRustEngine;