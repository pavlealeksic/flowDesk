#!/usr/bin/env node

// Test script for Flow Desk Rust-TypeScript integration
const path = require('path');

async function runTests() {
  console.log('🧪 Testing Flow Desk Rust-TypeScript Integration');
  console.log('=' .repeat(50));

  // Test 1: Try to load the NAPI module
  console.log('\n1. Testing NAPI Module Loading...');
  let napiModule = null;
  try {
    const napiPath = path.join(__dirname, 'flow-desk-shared.node');
    napiModule = require(napiPath);
    console.log('✅ NAPI module loaded successfully!');
    
    // Test basic functions
    if (typeof napiModule.hello === 'function') {
      const result = napiModule.hello();
      console.log('✅ hello() function works:', result);
    }
    
    if (typeof napiModule.get_version === 'function') {
      const version = napiModule.get_version();
      console.log('✅ get_version() function works:', version);
    }
    
  } catch (error) {
    console.log('❌ NAPI module failed to load:', error.message);
  }

  // Test 2: Try to load the main index.js wrapper
  console.log('\n2. Testing Main Index Wrapper...');
  try {
    const mainModule = require('./index.js');
    console.log('✅ Main wrapper loaded successfully!');
    
    // Test basic functions
    if (typeof mainModule.hello === 'function') {
      const result = await mainModule.hello();
      console.log('✅ Wrapper hello() function works:', result);
    }
    
    // Test engine initialization
    if (typeof mainModule.initialize === 'function') {
      try {
        const initResult = await mainModule.initialize();
        console.log('✅ Engine initialization works:', initResult);
      } catch (initError) {
        console.log('⚠️  Engine initialization failed (expected for fallback):', initError.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Main wrapper failed to load:', error.message);
  }

  // Test 3: Check if Rust library built successfully  
  console.log('\n3. Testing Rust Library Build Status...');
  const fs = require('fs');
  const rustLibPath = path.join(__dirname, 'target/release/libflow_desk_shared.dylib');
  const rustLibPathAlt = path.join(__dirname, 'target/release/libflow_desk_shared.so');

  if (fs.existsSync(rustLibPath) || fs.existsSync(rustLibPathAlt)) {
    console.log('✅ Rust dynamic library found');
  } else {
    console.log('⚠️  Rust dynamic library not found (may need to build with FFI features)');
  }

  // Test 4: Environment info
  console.log('\n4. Environment Information...');
  console.log('Node.js version:', process.version);
  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);
  console.log('Working directory:', __dirname);

  console.log('\n' + '='.repeat(50));
  console.log('🎯 Integration Test Complete!');

  if (napiModule) {
    console.log('✅ Status: NAPI integration working');
    process.exit(0);
  } else {
    console.log('⚠️  Status: Fallback to FFI/mock implementations');
    console.log('💡 To fix NAPI: Check Node.js version and NAPI-RS configuration');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);