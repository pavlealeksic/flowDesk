/**
 * TypeScript FFI wrapper for Flow Desk Rust Library
 * 
 * This wrapper provides a clean TypeScript interface for calling Rust functions
 * via FFI using node-ffi-napi.
 */

import * as ffi from 'ffi-napi';
import * as ref from 'ref-napi';
import * as path from 'path';
import * as os from 'os';

// Define types for FFI
const charPtr = ref.refType('char');
const uintPtr = ref.refType('uint');
const int = 'int';
const uint = 'uint';
const voidPtr = 'pointer';

// Determine library path based on platform
function getLibraryPath(): string {
  const platform = os.platform();
  const arch = os.arch();
  const libDir = path.join(__dirname, '..', 'target', 'release');
  
  let libName: string;
  if (platform === 'win32') {
    libName = 'flow_desk_shared.dll';
  } else if (platform === 'darwin') {
    libName = 'libflow_desk_shared.dylib';
  } else {
    libName = 'libflow_desk_shared.so';
  }
  
  return path.join(libDir, libName);
}

// Create FFI bindings
const lib = ffi.Library(getLibraryPath(), {
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

// Helper function to convert Rust string to JavaScript string and free memory
function rustStringToJs(ptr: Buffer): string {
  if (ptr.isNull()) {
    return '';
  }
  const str = ref.readCString(ptr, 0);
  lib.flow_desk_free_string(ptr);
  return str || '';
}

// Helper function to create null-terminated string
function jsStringToRust(str: string): Buffer {
  return Buffer.from(str + '\0', 'utf8');
}

/**
 * Flow Desk TypeScript wrapper class
 */
export class FlowDeskRust {
  private initialized = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize the Rust library
   */
  init(): void {
    if (this.initialized) return;
    
    const result = lib.flow_desk_init();
    if (result !== 0) {
      throw new Error('Failed to initialize Flow Desk Rust library');
    }
    this.initialized = true;
  }

  /**
   * Get library version
   */
  getVersion(): string {
    return rustStringToJs(lib.flow_desk_version());
  }

  /**
   * Test function to verify library is working
   */
  test(): string {
    return rustStringToJs(lib.flow_desk_test());
  }

  // Crypto functions

  /**
   * Encrypt data using ChaCha20-Poly1305
   */
  encryptData(data: string, key: string): string {
    const dataPtr = jsStringToRust(data);
    const keyPtr = jsStringToRust(key);
    return rustStringToJs(lib.flow_desk_encrypt_data(dataPtr, keyPtr));
  }

  /**
   * Decrypt data using ChaCha20-Poly1305
   */
  decryptData(encryptedData: string, key: string): string {
    const encryptedPtr = jsStringToRust(encryptedData);
    const keyPtr = jsStringToRust(key);
    return rustStringToJs(lib.flow_desk_decrypt_data(encryptedPtr, keyPtr));
  }

  /**
   * Hash password using BLAKE3
   */
  hashPassword(password: string): string {
    const passwordPtr = jsStringToRust(password);
    return rustStringToJs(lib.flow_desk_hash_password(passwordPtr));
  }
}

/**
 * Search Engine wrapper
 */
export class SearchEngine {
  private handle: number;

  constructor() {
    this.handle = lib.flow_desk_search_create();
    if (this.handle === 0) {
      throw new Error('Failed to create search engine');
    }
  }

  /**
   * Add a document to the search index
   */
  addDocument(id: string, title: string, content: string, source: string = 'default'): boolean {
    const idPtr = jsStringToRust(id);
    const titlePtr = jsStringToRust(title);
    const contentPtr = jsStringToRust(content);
    const sourcePtr = jsStringToRust(source);
    
    const result = lib.flow_desk_search_add_document(this.handle, idPtr, titlePtr, contentPtr, sourcePtr);
    return result === 0;
  }

  /**
   * Search for documents
   */
  search(query: string, limit: number = 10): any[] {
    const queryPtr = jsStringToRust(query);
    const resultPtr = lib.flow_desk_search_query(this.handle, queryPtr, limit);
    
    const jsonStr = rustStringToJs(resultPtr);
    if (!jsonStr) {
      return [];
    }
    
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse search results:', e);
      return [];
    }
  }

  /**
   * Destroy the search engine
   */
  destroy(): void {
    if (this.handle !== 0) {
      lib.flow_desk_search_destroy(this.handle);
      this.handle = 0;
    }
  }
}

/**
 * Mail Engine wrapper
 */
export class MailEngine {
  private handle: number;

  constructor() {
    this.handle = lib.flow_desk_mail_create_engine();
    if (this.handle === 0) {
      throw new Error('Failed to create mail engine');
    }
  }

  /**
   * Add a mail account
   */
  addAccount(accountId: string, email: string, provider: string, displayName: string): boolean {
    const accountIdPtr = jsStringToRust(accountId);
    const emailPtr = jsStringToRust(email);
    const providerPtr = jsStringToRust(provider);
    const displayNamePtr = jsStringToRust(displayName);
    
    const result = lib.flow_desk_mail_add_account(this.handle, accountIdPtr, emailPtr, providerPtr, displayNamePtr);
    return result === 0;
  }

  /**
   * Destroy the mail engine
   */
  destroy(): void {
    if (this.handle !== 0) {
      lib.flow_desk_mail_destroy_engine(this.handle);
      this.handle = 0;
    }
  }
}

/**
 * Calendar Engine wrapper
 */
export class CalendarEngine {
  private handle: number;

  constructor() {
    this.handle = lib.flow_desk_calendar_create_engine();
    if (this.handle === 0) {
      throw new Error('Failed to create calendar engine');
    }
  }

  /**
   * Add a calendar account
   */
  addAccount(accountId: string, email: string, provider: string, displayName: string): boolean {
    const accountIdPtr = jsStringToRust(accountId);
    const emailPtr = jsStringToRust(email);
    const providerPtr = jsStringToRust(provider);
    const displayNamePtr = jsStringToRust(displayName);
    
    const result = lib.flow_desk_calendar_add_account(this.handle, accountIdPtr, emailPtr, providerPtr, displayNamePtr);
    return result === 0;
  }

  /**
   * Destroy the calendar engine
   */
  destroy(): void {
    if (this.handle !== 0) {
      lib.flow_desk_calendar_destroy_engine(this.handle);
      this.handle = 0;
    }
  }
}

// Default export
const flowDeskRust = new FlowDeskRust();
export default flowDeskRust;

// Export individual classes
export { FlowDeskRust, SearchEngine as RustSearchEngine, MailEngine as RustMailEngine, CalendarEngine as RustCalendarEngine };