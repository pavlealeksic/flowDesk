#!/usr/bin/env node
/**
 * Test script for Flow Desk Rust FFI integration
 * 
 * This script demonstrates that the Rust library can be called from Node.js
 * using FFI and that all major functions work correctly.
 */

const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');
const os = require('os');

// Define types for FFI
const charPtr = ref.refType('char');
const int = 'int';
const uint = 'uint';

// Determine library path based on platform
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

console.log('🔍 Looking for Rust library at:', getLibraryPath());

// Check if library exists
const fs = require('fs');
if (!fs.existsSync(getLibraryPath())) {
  console.error('❌ Rust library not found. Run `cargo build --release` first.');
  process.exit(1);
}

// Create FFI bindings
let lib;
try {
  lib = ffi.Library(getLibraryPath(), {
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
  console.log('✅ FFI library loaded successfully');
} catch (error) {
  console.error('❌ Failed to load FFI library:', error.message);
  process.exit(1);
}

// Helper function to convert Rust string to JavaScript string and free memory
function rustStringToJs(ptr) {
  if (!ptr || ptr.isNull()) {
    return '';
  }
  try {
    const str = ref.readCString(ptr, 0);
    lib.flow_desk_free_string(ptr);
    return str || '';
  } catch (error) {
    console.error('Error reading Rust string:', error);
    return '';
  }
}

// Helper function to create null-terminated string
function jsStringToRust(str) {
  return Buffer.from(str + '\\0', 'utf8');
}

// Test suite
async function runTests() {
  console.log('\\n🧪 Running Flow Desk Rust Integration Tests\\n');
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  function test(name, testFn) {
    testsTotal++;
    try {
      console.log(`🔧 Testing ${name}...`);
      testFn();
      console.log(`✅ ${name} passed`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ ${name} failed:`, error.message);
    }
    console.log();
  }
  
  // Test 1: Library initialization
  test('Library Initialization', () => {
    const result = lib.flow_desk_init();
    if (result !== 0) {
      throw new Error('Failed to initialize library');
    }
  });
  
  // Test 2: Version info
  test('Version Information', () => {
    const version = rustStringToJs(lib.flow_desk_version());
    if (!version || version.length === 0) {
      throw new Error('Failed to get version');
    }
    console.log(`   📦 Version: ${version}`);
  });
  
  // Test 3: Basic test function
  test('Basic Test Function', () => {
    const testResult = rustStringToJs(lib.flow_desk_test());
    if (!testResult || testResult.length === 0) {
      throw new Error('Test function returned empty result');
    }
    console.log(`   📝 Test message: ${testResult}`);
  });
  
  // Test 4: Crypto - Hash password
  test('Crypto - Hash Password', () => {
    const password = 'test_password_123';
    const hash = rustStringToJs(lib.flow_desk_hash_password(jsStringToRust(password)));
    if (!hash || hash.length === 0) {
      throw new Error('Failed to hash password');
    }
    console.log(`   🔐 Hash: ${hash.substring(0, 20)}...`);
  });
  
  // Test 5: Crypto - Encrypt/Decrypt
  test('Crypto - Encrypt/Decrypt Data', () => {
    const plaintext = 'Hello, Flow Desk!';
    const key = 'my_secret_key_12345678901234567890';
    
    const encrypted = rustStringToJs(lib.flow_desk_encrypt_data(jsStringToRust(plaintext), jsStringToRust(key)));
    if (!encrypted || encrypted.length === 0) {
      throw new Error('Failed to encrypt data');
    }
    console.log(`   🔒 Encrypted: ${encrypted.substring(0, 30)}...`);
    
    const decrypted = rustStringToJs(lib.flow_desk_decrypt_data(jsStringToRust(encrypted), jsStringToRust(key)));
    if (decrypted !== plaintext) {
      throw new Error(`Decryption failed. Expected: "${plaintext}", Got: "${decrypted}"`);
    }
    console.log(`   🔓 Decrypted: ${decrypted}`);
  });
  
  // Test 6: Search Engine
  test('Search Engine', () => {
    const searchHandle = lib.flow_desk_search_create();
    if (searchHandle === 0) {
      throw new Error('Failed to create search engine');
    }
    console.log(`   🔍 Search handle: ${searchHandle}`);
    
    // Add a document
    const addResult = lib.flow_desk_search_add_document(
      searchHandle,
      jsStringToRust('doc1'),
      jsStringToRust('Test Document'),
      jsStringToRust('This is a test document for searching.'),
      jsStringToRust('test')
    );
    if (addResult !== 0) {
      throw new Error('Failed to add document');
    }
    console.log('   📄 Document added successfully');
    
    // Search for the document
    const searchResults = rustStringToJs(lib.flow_desk_search_query(
      searchHandle,
      jsStringToRust('test'),
      10
    ));
    
    if (!searchResults) {
      throw new Error('Search returned empty results');
    }
    
    let results;
    try {
      results = JSON.parse(searchResults);
    } catch (e) {
      throw new Error('Failed to parse search results');
    }
    
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Search results should contain at least one result');
    }
    
    console.log(`   📊 Search results: ${results.length} found`);
    console.log(`   📝 First result: ${results[0].title}`);
    
    lib.flow_desk_search_destroy(searchHandle);
    console.log('   🗑️ Search engine destroyed');
  });
  
  // Test 7: Mail Engine
  test('Mail Engine', () => {
    const mailHandle = lib.flow_desk_mail_create_engine();
    if (mailHandle === 0) {
      throw new Error('Failed to create mail engine');
    }
    console.log(`   📧 Mail handle: ${mailHandle}`);
    
    // Add a mail account
    const addResult = lib.flow_desk_mail_add_account(
      mailHandle,
      jsStringToRust('account1'),
      jsStringToRust('test@example.com'),
      jsStringToRust('gmail'),
      jsStringToRust('Test User')
    );
    if (addResult !== 0) {
      throw new Error('Failed to add mail account');
    }
    console.log('   👤 Mail account added successfully');
    
    lib.flow_desk_mail_destroy_engine(mailHandle);
    console.log('   🗑️ Mail engine destroyed');
  });
  
  // Test 8: Calendar Engine
  test('Calendar Engine', () => {
    const calendarHandle = lib.flow_desk_calendar_create_engine();
    if (calendarHandle === 0) {
      throw new Error('Failed to create calendar engine');
    }
    console.log(`   📅 Calendar handle: ${calendarHandle}`);
    
    // Add a calendar account
    const addResult = lib.flow_desk_calendar_add_account(
      calendarHandle,
      jsStringToRust('account1'),
      jsStringToRust('test@example.com'),
      jsStringToRust('google'),
      jsStringToRust('Test User')
    );
    if (addResult !== 0) {
      throw new Error('Failed to add calendar account');
    }
    console.log('   👤 Calendar account added successfully');
    
    lib.flow_desk_calendar_destroy_engine(calendarHandle);
    console.log('   🗑️ Calendar engine destroyed');
  });
  
  // Print results
  console.log('\\n📊 Test Results:');
  console.log(`✅ Passed: ${testsPassed}/${testsTotal}`);
  console.log(`❌ Failed: ${testsTotal - testsPassed}/${testsTotal}`);
  
  if (testsPassed === testsTotal) {
    console.log('\\n🎉 All tests passed! The Rust integration is working correctly.\\n');
    return true;
  } else {
    console.log('\\n💥 Some tests failed. Please check the errors above.\\n');
    return false;
  }
}

// Performance test
async function runPerformanceTest() {
  console.log('⚡ Running Performance Test...\\n');
  
  // Test search performance
  const searchHandle = lib.flow_desk_search_create();
  
  const start = Date.now();
  
  // Add 100 documents
  for (let i = 0; i < 100; i++) {
    lib.flow_desk_search_add_document(
      searchHandle,
      jsStringToRust(`doc${i}`),
      jsStringToRust(`Document ${i}`),
      jsStringToRust(`This is test document number ${i} with some content to search.`),
      jsStringToRust('performance_test')
    );
  }
  
  const indexTime = Date.now() - start;
  console.log(`📝 Indexed 100 documents in ${indexTime}ms`);
  
  // Search performance
  const searchStart = Date.now();
  const searchResults = rustStringToJs(lib.flow_desk_search_query(
    searchHandle,
    jsStringToRust('document'),
    10
  ));
  const searchTime = Date.now() - searchStart;
  
  const results = JSON.parse(searchResults);
  console.log(`🔍 Search completed in ${searchTime}ms (found ${results.length} results)`);
  
  lib.flow_desk_search_destroy(searchHandle);
  
  if (searchTime > 300) {
    console.log('⚠️ Search took longer than 300ms requirement');
    return false;
  } else {
    console.log('✅ Search performance meets requirements (<300ms)\\n');
    return true;
  }
}

// Main execution
async function main() {
  console.log('🚀 Flow Desk Rust Integration Test Suite');
  console.log('==========================================\\n');
  
  const testsPass = await runTests();
  const perfPass = await runPerformanceTest();
  
  if (testsPass && perfPass) {
    console.log('🎉 SUCCESS: All tests passed! The Rust integration is fully functional.\\n');
    process.exit(0);
  } else {
    console.log('💥 FAILURE: Some tests failed. Please check the implementation.\\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});