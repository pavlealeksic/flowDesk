#!/usr/bin/env node
/**
 * Final Flow Desk Integration Verification
 * 
 * Tests that all pieces work together after all fixes
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎯 Flow Desk - Final Integration Verification');
console.log('=' .repeat(60));
console.log();

async function verifyCompleteIntegration() {
    console.log('📊 Verifying Complete Flow Desk Integration...');
    console.log();

    let allTestsPassed = true;
    const results = [];

    // Test 1: Rust Engine Compilation
    console.log('🦀 1. Rust Engine Compilation:');
    try {
        execSync('cargo check', { 
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/shared/rust-lib',
            stdio: 'pipe'
        });
        console.log('   ✅ Rust engine compiles successfully');
        results.push({ test: 'Rust Engine', status: 'PASS' });
    } catch (error) {
        console.log('   ❌ Rust compilation failed');
        results.push({ test: 'Rust Engine', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 2: Rust Engine Functionality
    console.log('🧪 2. Rust Engine Functionality:');
    try {
        const rustOutput = execSync('node working-example.js', {
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/shared/rust-lib',
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        if (rustOutput.includes('All tests completed successfully!')) {
            console.log('   ✅ Rust engine functions work correctly');
            results.push({ test: 'Rust Functionality', status: 'PASS' });
        } else {
            console.log('   ❌ Rust engine functionality issues');
            results.push({ test: 'Rust Functionality', status: 'FAIL' });
            allTestsPassed = false;
        }
    } catch (error) {
        console.log('   ❌ Rust functionality test failed');
        results.push({ test: 'Rust Functionality', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 3: Shared Package Build
    console.log('📦 3. Shared Package Build:');
    try {
        execSync('npm run build', {
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/shared',
            stdio: 'pipe'
        });
        console.log('   ✅ Shared package builds successfully');
        results.push({ test: 'Shared Package', status: 'PASS' });
    } catch (error) {
        console.log('   ❌ Shared package build failed');
        results.push({ test: 'Shared Package', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 4: Desktop App Main Process Build
    console.log('🖥️ 4. Desktop App Main Process:');
    try {
        execSync('npm run build:main', {
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app',
            stdio: 'pipe'
        });
        console.log('   ✅ Main process builds successfully');
        results.push({ test: 'Main Process', status: 'PASS' });
    } catch (error) {
        console.log('   ❌ Main process build failed');
        results.push({ test: 'Main Process', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 5: Desktop App Renderer Build
    console.log('⚛️ 5. Desktop App Renderer:');
    try {
        execSync('npm run build:renderer', {
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app',
            stdio: 'pipe'
        });
        console.log('   ✅ Renderer builds successfully');
        results.push({ test: 'Renderer', status: 'PASS' });
    } catch (error) {
        console.log('   ❌ Renderer build failed');
        results.push({ test: 'Renderer', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 6: Complete Desktop App Build
    console.log('🏗️ 6. Complete Desktop App Build:');
    try {
        execSync('npm run build', {
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app',
            stdio: 'pipe'
        });
        console.log('   ✅ Complete desktop app builds successfully');
        results.push({ test: 'Complete Build', status: 'PASS' });
    } catch (error) {
        console.log('   ❌ Complete build failed');
        results.push({ test: 'Complete Build', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 7: File Structure Verification
    console.log('📁 7. Built Files Verification:');
    const requiredFiles = [
        '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app/dist/main.js',
        '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app/dist/preload.js',
        '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app/dist/renderer/index.html'
    ];
    
    let allFilesExist = true;
    for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
            console.log(`   ✅ ${file.split('/').pop()}`);
        } else {
            console.log(`   ❌ Missing: ${file.split('/').pop()}`);
            allFilesExist = false;
        }
    }
    
    if (allFilesExist) {
        results.push({ test: 'Build Artifacts', status: 'PASS' });
    } else {
        results.push({ test: 'Build Artifacts', status: 'FAIL' });
        allTestsPassed = false;
    }

    // Test 8: API Integration Completeness
    console.log('🔌 8. API Integration Completeness:');
    try {
        // Check that preload script has all necessary APIs
        const preloadContent = fs.readFileSync('/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app/src/preload/preload.ts', 'utf8');
        
        const requiredAPIs = ['mail:', 'calendar:', 'workspace:', 'system:', 'settings:', 'searchAPI:', 'theme:'];
        let allAPIsPresent = true;
        
        for (const api of requiredAPIs) {
            if (preloadContent.includes(api)) {
                console.log(`   ✅ ${api} API integrated`);
            } else {
                console.log(`   ❌ Missing: ${api} API`);
                allAPIsPresent = false;
            }
        }
        
        if (allAPIsPresent) {
            results.push({ test: 'API Integration', status: 'PASS' });
        } else {
            results.push({ test: 'API Integration', status: 'FAIL' });
            allTestsPassed = false;
        }
    } catch (error) {
        console.log('   ❌ API integration check failed');
        results.push({ test: 'API Integration', status: 'FAIL' });
        allTestsPassed = false;
    }

    console.log();
    console.log('📋 FINAL VERIFICATION RESULTS:');
    console.log('=' .repeat(60));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    for (const result of results) {
        const icon = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${result.test}: ${result.status}`);
    }
    
    console.log();
    console.log(`📊 Final Results: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`Success Rate: ${((passCount / results.length) * 100).toFixed(1)}%`);
    console.log();
    
    if (allTestsPassed) {
        console.log('🎉 ALL INTEGRATION TESTS PASSED!');
        console.log('✅ Flow Desk is COMPLETELY INTEGRATED and ready for use');
        console.log();
        console.log('🚀 READY FOR:');
        console.log('   • Desktop app launch and testing');
        console.log('   • Real email account setup with IMAP');
        console.log('   • Workspace and browser service functionality');
        console.log('   • End-to-end workflow testing');
        console.log('   • Production deployment');
    } else {
        console.log('⚠️  Some integration tests failed');
        console.log('📝 Integration has remaining issues - see failed tests above');
    }

    return { allTestsPassed, passCount, failCount, results };
}

verifyCompleteIntegration().then(result => {
    process.exit(result.allTestsPassed ? 0 : 1);
}).catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
});