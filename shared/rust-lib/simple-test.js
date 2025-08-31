#!/usr/bin/env node

// Simple test to check if NAPI module loads
try {
  console.log('Loading NAPI module...');
  
  // Try to load the native binding directly first
  const nativeBinding = require('./flow-desk-shared.darwin-arm64.node');
  console.log('✅ Native binding loaded successfully!');
  console.log('Available functions in native binding:', Object.keys(nativeBinding));
  
  // Try to load via index.js
  const bindings = require('./index.js');
  console.log('✅ Module loaded successfully via index.js!');
  
  // Test simple function
  if (typeof bindings.hello === 'function') {
    const result = bindings.hello();
    console.log('✅ Hello function result:', result);
  } else {
    console.log('❌ Hello function not found');
    console.log('Available functions:', Object.keys(bindings));
  }
  
} catch (error) {
  console.error('❌ Failed to load NAPI module:', error.message);
  console.error('Error code:', error.code);
  console.error('Stack:', error.stack);
}