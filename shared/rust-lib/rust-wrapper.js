/**
 * Flow Desk Rust Library - JavaScript Entry Point
 * 
 * This module provides access to the compiled Rust library functions.
 * It supports both FFI and NAPI approaches, with fallback to mock implementations.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Determine library path based on platform
 */
function getLibraryPath() {
  const platform = os.platform();
  const libDir = path.join(__dirname, 'target', 'release');
  
  let libName;
  if (platform === 'win32') {
    libName = 'flow_desk_shared.dll';
  } else if (platform === 'darwin') {
    libName = 'libflow_desk_shared.dylib';
  } else {
    libName = 'libflow_desk_shared.so';
  }
  
  return path.join(libDir, libName);
}

/**
 * Check if Rust library is available
 */
function isRustLibraryAvailable() {
  const libPath = getLibraryPath();
  return fs.existsSync(libPath);
}

/**
 * Load FFI bindings if available
 */
let ffiBindings = null;
function loadFFIBindings() {
  if (ffiBindings) return ffiBindings;
  
  try {
    // Try to load FFI if available
    const ffi = require('ffi-napi');
    const ref = require('ref-napi');
    
    const charPtr = ref.refType('char');
    const int = 'int';
    const uint = 'uint';
    
    ffiBindings = ffi.Library(getLibraryPath(), {
      // Library management
      'flow_desk_init': [int, []],
      'flow_desk_version': [charPtr, []],
      'flow_desk_test': [charPtr, []],
      'flow_desk_free_string': ['void', [charPtr]],
      
      // Crypto functions
      'flow_desk_encrypt_data': [charPtr, [charPtr, charPtr]],
      'flow_desk_decrypt_data': [charPtr, [charPtr, charPtr]],
      'flow_desk_hash_password': [charPtr, [charPtr]],
      
      // Search functions
      'flow_desk_search_create': [uint, []],
      'flow_desk_search_destroy': ['void', [uint]],
      'flow_desk_search_add_document': [int, [uint, charPtr, charPtr, charPtr, charPtr]],
      'flow_desk_search_query': [charPtr, [uint, charPtr, int]],
      
      // Mail functions
      'flow_desk_mail_create_engine': [uint, []],
      'flow_desk_mail_destroy_engine': ['void', [uint]],
      'flow_desk_mail_add_account': [int, [uint, charPtr, charPtr, charPtr, charPtr]],
      
      // Calendar functions
      'flow_desk_calendar_create_engine': [uint, []],
      'flow_desk_calendar_destroy_engine': ['void', [uint]],
      'flow_desk_calendar_add_account': [int, [uint, charPtr, charPtr, charPtr, charPtr]],
    });
    
    return ffiBindings;
  } catch (error) {
    console.warn('FFI bindings not available:', error.message);
    return null;
  }
}

/**
 * Load NAPI bindings if available
 */
let napiBindings = null;
function loadNAPIBindings() {
  if (napiBindings) return napiBindings;
  
  try {
    // Try to load NAPI bindings
    napiBindings = require('./index.node');
    return napiBindings;
  } catch (error) {
    console.warn('NAPI bindings not available:', error.message);
    return null;
  }
}

/**
 * Crypto utilities using Node.js crypto module as fallback
 */
const crypto = require('crypto');

/**
 * Main FlowDeskRust class with multiple integration approaches
 */
class FlowDeskRust {
  constructor() {
    this.version = '0.1.0';
    this.initialized = false;
    this.useRust = isRustLibraryAvailable();
    this.ffi = null;
    this.napi = null;
    
    if (this.useRust) {
      this.ffi = loadFFIBindings();
      this.napi = loadNAPIBindings();
    }
  }

  /**
   * Initialize the library
   */
  init() {
    if (this.initialized) return;
    
    if (this.ffi) {
      const result = this.ffi.flow_desk_init();
      if (result !== 0) {
        throw new Error('Failed to initialize Rust library via FFI');
      }
      console.log('✅ Initialized Rust library via FFI');
    } else if (this.napi) {
      // NAPI initialization would go here
      console.log('✅ Initialized Rust library via NAPI');
    } else {
      console.log('⚠️ Using JavaScript fallback implementation');
    }
    
    this.initialized = true;
  }

  /**
   * Get library version
   */
  getVersion() {
    if (this.ffi) {
      const ptr = this.ffi.flow_desk_version();
      const version = this._rustStringToJs(ptr);
      return version;
    }
    return this.version;
  }

  /**
   * Test function
   */
  test() {
    if (this.ffi) {
      const ptr = this.ffi.flow_desk_test();
      return this._rustStringToJs(ptr);
    }
    return 'Flow Desk JavaScript fallback is working!';
  }

  /**
   * Hash password
   */
  hashPassword(password) {
    if (!password) throw new Error('Password required');
    
    if (this.ffi) {
      const passwordPtr = this._jsStringToRust(password);
      const hashPtr = this.ffi.flow_desk_hash_password(passwordPtr);
      return this._rustStringToJs(hashPtr);
    }
    
    // Fallback: use Node.js crypto
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Encrypt data
   */
  encryptData(data, key) {
    if (!data || !key) throw new Error('Data and key required');
    
    if (this.ffi) {
      const dataPtr = this._jsStringToRust(data);
      const keyPtr = this._jsStringToRust(key);
      const encryptedPtr = this.ffi.flow_desk_encrypt_data(dataPtr, keyPtr);
      return this._rustStringToJs(encryptedPtr);
    }
    
    // Fallback: use Node.js crypto
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  /**
   * Decrypt data
   */
  decryptData(encryptedData, key) {
    if (!encryptedData || !key) throw new Error('Encrypted data and key required');
    
    if (this.ffi) {
      const encryptedPtr = this._jsStringToRust(encryptedData);
      const keyPtr = this._jsStringToRust(key);
      const decryptedPtr = this.ffi.flow_desk_decrypt_data(encryptedPtr, keyPtr);
      return this._rustStringToJs(decryptedPtr);
    }
    
    // Fallback: use Node.js crypto
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  // Helper methods for FFI
  _rustStringToJs(ptr) {
    if (!ptr || ptr.isNull()) return '';
    
    try {
      const ref = require('ref-napi');
      const str = ref.readCString(ptr, 0);
      this.ffi.flow_desk_free_string(ptr);
      return str || '';
    } catch (error) {
      return '';
    }
  }

  _jsStringToRust(str) {
    return Buffer.from(str + '\0', 'utf8');
  }
}

/**
 * Search Engine class
 */
class RustSearchEngine {
  constructor() {
    this.handle = null;
    this.documents = new Map(); // Fallback storage
    this.flowDesk = new FlowDeskRust();
    this.flowDesk.init();
    
    if (this.flowDesk.ffi) {
      this.handle = this.flowDesk.ffi.flow_desk_search_create();
      if (this.handle === 0) {
        throw new Error('Failed to create search engine');
      }
    }
  }

  /**
   * Add document to search index
   */
  addDocument(id, title, content, source = 'default') {
    if (!id || !title || !content) {
      throw new Error('ID, title, and content are required');
    }

    if (this.flowDesk.ffi && this.handle) {
      const idPtr = this.flowDesk._jsStringToRust(id);
      const titlePtr = this.flowDesk._jsStringToRust(title);
      const contentPtr = this.flowDesk._jsStringToRust(content);
      const sourcePtr = this.flowDesk._jsStringToRust(source);
      
      const result = this.flowDesk.ffi.flow_desk_search_add_document(
        this.handle, idPtr, titlePtr, contentPtr, sourcePtr
      );
      return result === 0;
    }
    
    // Fallback: store in memory
    this.documents.set(id, {
      id,
      title,
      content,
      source,
      indexed_at: new Date()
    });
    return true;
  }

  /**
   * Search documents
   */
  search(query, limit = 10) {
    if (!query) return [];

    if (this.flowDesk.ffi && this.handle) {
      const queryPtr = this.flowDesk._jsStringToRust(query);
      const resultPtr = this.flowDesk.ffi.flow_desk_search_query(this.handle, queryPtr, limit);
      
      const jsonStr = this.flowDesk._rustStringToJs(resultPtr);
      if (jsonStr) {
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error('Failed to parse search results:', e);
          return [];
        }
      }
      return [];
    }
    
    // Fallback: simple text search
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const doc of this.documents.values()) {
      if (doc.title.toLowerCase().includes(queryLower) || 
          doc.content.toLowerCase().includes(queryLower)) {
        results.push({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          source: doc.source,
          score: 0.8,
          metadata: '{}'
        });
      }
    }
    
    return results.slice(0, limit);
  }

  /**
   * Destroy search engine
   */
  destroy() {
    if (this.flowDesk.ffi && this.handle) {
      this.flowDesk.ffi.flow_desk_search_destroy(this.handle);
      this.handle = null;
    }
    this.documents.clear();
  }
}

/**
 * Mail Engine class
 */
class RustMailEngine {
  constructor() {
    this.handle = null;
    this.accounts = new Map(); // Fallback storage
    this.flowDesk = new FlowDeskRust();
    this.flowDesk.init();
    
    if (this.flowDesk.ffi) {
      this.handle = this.flowDesk.ffi.flow_desk_mail_create_engine();
      if (this.handle === 0) {
        throw new Error('Failed to create mail engine');
      }
    }
  }

  /**
   * Add mail account
   */
  addAccount(accountId, email, provider, displayName) {
    if (!accountId || !email || !provider || !displayName) {
      throw new Error('All account fields are required');
    }

    if (this.flowDesk.ffi && this.handle) {
      const accountIdPtr = this.flowDesk._jsStringToRust(accountId);
      const emailPtr = this.flowDesk._jsStringToRust(email);
      const providerPtr = this.flowDesk._jsStringToRust(provider);
      const displayNamePtr = this.flowDesk._jsStringToRust(displayName);
      
      const result = this.flowDesk.ffi.flow_desk_mail_add_account(
        this.handle, accountIdPtr, emailPtr, providerPtr, displayNamePtr
      );
      return result === 0;
    }
    
    // Fallback: store in memory
    this.accounts.set(accountId, {
      id: accountId,
      email,
      provider,
      displayName,
      isEnabled: true
    });
    return true;
  }

  /**
   * Get all accounts
   */
  getAccounts() {
    return Array.from(this.accounts.values());
  }

  /**
   * Destroy mail engine
   */
  destroy() {
    if (this.flowDesk.ffi && this.handle) {
      this.flowDesk.ffi.flow_desk_mail_destroy_engine(this.handle);
      this.handle = null;
    }
    this.accounts.clear();
  }
}

/**
 * Calendar Engine class
 */
class RustCalendarEngine {
  constructor() {
    this.handle = null;
    this.accounts = new Map(); // Fallback storage
    this.flowDesk = new FlowDeskRust();
    this.flowDesk.init();
    
    if (this.flowDesk.ffi) {
      this.handle = this.flowDesk.ffi.flow_desk_calendar_create_engine();
      if (this.handle === 0) {
        throw new Error('Failed to create calendar engine');
      }
    }
  }

  /**
   * Add calendar account
   */
  addAccount(accountId, email, provider, displayName) {
    if (!accountId || !email || !provider || !displayName) {
      throw new Error('All account fields are required');
    }

    if (this.flowDesk.ffi && this.handle) {
      const accountIdPtr = this.flowDesk._jsStringToRust(accountId);
      const emailPtr = this.flowDesk._jsStringToRust(email);
      const providerPtr = this.flowDesk._jsStringToRust(provider);
      const displayNamePtr = this.flowDesk._jsStringToRust(displayName);
      
      const result = this.flowDesk.ffi.flow_desk_calendar_add_account(
        this.handle, accountIdPtr, emailPtr, providerPtr, displayNamePtr
      );
      return result === 0;
    }
    
    // Fallback: store in memory
    this.accounts.set(accountId, {
      id: accountId,
      email,
      provider,
      displayName,
      isEnabled: true
    });
    return true;
  }

  /**
   * Get all accounts
   */
  getAccounts() {
    return Array.from(this.accounts.values());
  }

  /**
   * Destroy calendar engine
   */
  destroy() {
    if (this.flowDesk.ffi && this.handle) {
      this.flowDesk.ffi.flow_desk_calendar_destroy_engine(this.handle);
      this.handle = null;
    }
    this.accounts.clear();
  }
}

// Create default instance
const flowDeskRust = new FlowDeskRust();

// Export everything
module.exports = {
  FlowDeskRust,
  RustSearchEngine,
  RustMailEngine,
  RustCalendarEngine,
  default: flowDeskRust,
  
  // For CommonJS compatibility
  SearchEngine: RustSearchEngine,
  MailEngine: RustMailEngine,
  CalendarEngine: RustCalendarEngine,
  
  // Utility functions
  isRustLibraryAvailable,
  getLibraryPath
};