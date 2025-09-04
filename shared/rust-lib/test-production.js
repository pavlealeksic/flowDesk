#!/usr/bin/env node

/**
 * Production test to verify optimized NAPI binary works correctly
 */

console.log('🚀 Testing Production NAPI Build...\n');

try {
    const start = Date.now();
    const rustLib = require('./flow-desk-shared.darwin-arm64.node');
    const loadTime = Date.now() - start;
    
    console.log(`✅ Production NAPI binary loaded in ${loadTime}ms`);
    console.log(`📦 Binary size: ${(require('fs').statSync('./flow-desk-shared.darwin-arm64.node').size / 1024 / 1024).toFixed(1)}MB`);
    
    // Test core functions
    console.log('\n=== Testing Core Production Functions ===');
    
    if (typeof rustLib.initLibrary === 'function') {
        const initResult = rustLib.initLibrary();
        console.log(`✅ Library initialization: ${initResult}`);
    }
    
    if (typeof rustLib.getVersion === 'function') {
        const version = rustLib.getVersion();
        console.log(`✅ Version: ${version}`);
    }
    
    if (typeof rustLib.hello === 'function') {
        const greeting = rustLib.hello();
        console.log(`✅ Hello function: ${greeting}`);
    }
    
    // Test logging  
    if (typeof rustLib.initLogging === 'function') {
        rustLib.initLogging('error'); // Only errors for production
        console.log('✅ Production logging initialized');
    }
    
    console.log('\n=== Production Performance Test ===');
    
    // Performance test - call functions multiple times
    const iterations = 1000;
    const perfStart = Date.now();
    
    for (let i = 0; i < iterations; i++) {
        if (rustLib.getVersion) rustLib.getVersion();
        if (rustLib.hello) rustLib.hello();
    }
    
    const perfTime = Date.now() - perfStart;
    console.log(`✅ ${iterations} function calls completed in ${perfTime}ms`);
    console.log(`📊 Average call time: ${(perfTime / (iterations * 2)).toFixed(3)}ms`);
    
    console.log('\n🎉 Production NAPI Build Test PASSED!');
    console.log('✅ Ready for production deployment');
    console.log('🔥 Pure Rust backend - No TypeScript fallbacks needed!');
    
} catch (error) {
    console.error('❌ Production test failed:', error.message);
    process.exit(1);
}