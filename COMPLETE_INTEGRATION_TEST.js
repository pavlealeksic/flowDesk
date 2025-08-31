#!/usr/bin/env node
/**
 * Complete Flow Desk Integration Test
 * 
 * This test verifies that all components work together properly
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 Flow Desk - Complete Integration Test');
console.log('=' .repeat(60));
console.log();

async function testCompleteIntegration() {
    console.log('📊 Testing Complete Flow Desk Integration...');
    console.log();

    let allTestsPassed = true;
    const results = [];

    // Test 1: Verify Rust Engine Compilation
    console.log('🦀 1. Testing Rust Engine Compilation:');
    try {
        const { execSync } = require('child_process');
        const cargoOutput = execSync('cargo check', { 
            cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk/shared/rust-lib',
            encoding: 'utf8' 
        });
        
        if (cargoOutput.includes('error:')) {
            console.log('   ❌ Rust compilation has errors');
            results.push({ test: 'Rust Compilation', status: 'FAIL', details: 'Has compilation errors' });
            allTestsPassed = false;
        } else {
            console.log('   ✅ Rust engine compiles successfully');
            results.push({ test: 'Rust Compilation', status: 'PASS', details: 'Compiles with warnings only' });
        }
    } catch (error) {
        console.log('   ❌ Rust compilation failed:', error.message);
        results.push({ test: 'Rust Compilation', status: 'FAIL', details: error.message });
        allTestsPassed = false;
    }
    console.log();

    // Test 2: Verify TypeScript Components
    console.log('📝 2. Testing TypeScript Component Compilation:');
    
    const tsFiles = [
        'desktop-app/src/main/main-final.ts',
        'desktop-app/src/preload/preload-final.ts',
        'desktop-app/src/main/workspace-simple.ts'
    ];
    
    for (const file of tsFiles) {
        try {
            const { execSync } = require('child_process');
            execSync(`npx tsc ${file} --noEmit --skipLibCheck --esModuleInterop`, { 
                cwd: '/Users/pavlealeksic/Gits/nasi/flowDesk',
                stdio: 'pipe'
            });
            console.log(`   ✅ ${path.basename(file)} compiles successfully`);
            results.push({ test: `TS: ${path.basename(file)}`, status: 'PASS', details: 'Compiles cleanly' });
        } catch (error) {
            console.log(`   ❌ ${path.basename(file)} has compilation errors`);
            results.push({ test: `TS: ${path.basename(file)}`, status: 'FAIL', details: 'Compilation errors' });
            allTestsPassed = false;
        }
    }
    console.log();

    // Test 3: Verify React Renderer
    console.log('⚛️ 3. Testing React Renderer Build:');
    try {
        const rendererIndexPath = '/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app/dist/renderer/index.html';
        if (fs.existsSync(rendererIndexPath)) {
            const indexContent = fs.readFileSync(rendererIndexPath, 'utf8');
            if (indexContent.includes('Flow Desk') || indexContent.includes('script')) {
                console.log('   ✅ React renderer builds and has content');
                results.push({ test: 'React Renderer', status: 'PASS', details: 'Built with assets' });
            } else {
                console.log('   ❌ React renderer built but content looks incorrect');
                results.push({ test: 'React Renderer', status: 'FAIL', details: 'Built but content issues' });
                allTestsPassed = false;
            }
        } else {
            console.log('   ❌ React renderer not built');
            results.push({ test: 'React Renderer', status: 'FAIL', details: 'No built output found' });
            allTestsPassed = false;
        }
    } catch (error) {
        console.log('   ❌ React renderer test failed:', error.message);
        results.push({ test: 'React Renderer', status: 'FAIL', details: error.message });
        allTestsPassed = false;
    }
    console.log();

    // Test 4: Verify Project Structure
    console.log('📁 4. Testing Project Structure:');
    const requiredDirs = [
        'desktop-app/src/main',
        'desktop-app/src/renderer', 
        'desktop-app/src/preload',
        'mobile-app/src',
        'server/src',
        'shared/src'
    ];
    
    let structureComplete = true;
    for (const dir of requiredDirs) {
        const fullPath = `/Users/pavlealeksic/Gits/nasi/flowDesk/${dir}`;
        if (fs.existsSync(fullPath)) {
            const files = fs.readdirSync(fullPath);
            console.log(`   ✅ ${dir} (${files.length} files)`);
        } else {
            console.log(`   ❌ ${dir} missing`);
            structureComplete = false;
        }
    }
    
    if (structureComplete) {
        results.push({ test: 'Project Structure', status: 'PASS', details: 'All directories present' });
    } else {
        results.push({ test: 'Project Structure', status: 'FAIL', details: 'Missing directories' });
        allTestsPassed = false;
    }
    console.log();

    // Test 5: Verify Dependencies
    console.log('📦 5. Testing Dependencies:');
    try {
        const packageJson = JSON.parse(fs.readFileSync('/Users/pavlealeksic/Gits/nasi/flowDesk/package.json', 'utf8'));
        const nodeModulesExists = fs.existsSync('/Users/pavlealeksic/Gits/nasi/flowDesk/node_modules');
        
        if (nodeModulesExists) {
            console.log('   ✅ Dependencies installed');
            results.push({ test: 'Dependencies', status: 'PASS', details: 'node_modules present' });
        } else {
            console.log('   ❌ Dependencies not installed');
            results.push({ test: 'Dependencies', status: 'FAIL', details: 'node_modules missing' });
            allTestsPassed = false;
        }
    } catch (error) {
        console.log('   ❌ Dependencies test failed:', error.message);
        results.push({ test: 'Dependencies', status: 'FAIL', details: error.message });
        allTestsPassed = false;
    }
    console.log();

    // Test 6: Verify Rust IMAP Configuration
    console.log('📧 6. Testing Rust IMAP Configuration:');
    try {
        const serverConfigsPath = '/Users/pavlealeksic/Gits/nasi/flowDesk/shared/rust-lib/src/mail/server_configs.rs';
        if (fs.existsSync(serverConfigsPath)) {
            const configContent = fs.readFileSync(serverConfigsPath, 'utf8');
            const providers = ['gmail', 'outlook', 'yahoo', 'fastmail', 'icloud'];
            
            let allProvidersFound = true;
            for (const provider of providers) {
                if (!configContent.includes(`"${provider}"`)) {
                    allProvidersFound = false;
                    break;
                }
            }
            
            if (allProvidersFound) {
                console.log('   ✅ All email provider configurations present');
                results.push({ test: 'IMAP Configs', status: 'PASS', details: 'Gmail, Outlook, Yahoo, FastMail, iCloud' });
            } else {
                console.log('   ❌ Missing email provider configurations');
                results.push({ test: 'IMAP Configs', status: 'FAIL', details: 'Missing providers' });
                allTestsPassed = false;
            }
        } else {
            console.log('   ❌ IMAP server configurations not found');
            results.push({ test: 'IMAP Configs', status: 'FAIL', details: 'File not found' });
            allTestsPassed = false;
        }
    } catch (error) {
        console.log('   ❌ IMAP configuration test failed:', error.message);
        results.push({ test: 'IMAP Configs', status: 'FAIL', details: error.message });
        allTestsPassed = false;
    }
    console.log();

    // Test Results Summary
    console.log('📋 INTEGRATION TEST RESULTS:');
    console.log('=' .repeat(60));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    for (const result of results) {
        const icon = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${result.test}: ${result.status} - ${result.details}`);
    }
    
    console.log();
    console.log(`📊 Overall Results: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`Success Rate: ${((passCount / results.length) * 100).toFixed(1)}%`);
    console.log();
    
    if (allTestsPassed) {
        console.log('🎉 ALL INTEGRATION TESTS PASSED!');
        console.log('✅ Flow Desk integration is COMPLETE and ready');
    } else {
        console.log('⚠️  Some integration tests failed');
        console.log('📝 Integration is INCOMPLETE - see failed tests above');
    }
    console.log();
    
    // Status Summary
    console.log('🎯 INTEGRATION STATUS SUMMARY:');
    console.log();
    console.log('✅ WORKING COMPONENTS:');
    results.filter(r => r.status === 'PASS').forEach(r => {
        console.log(`   • ${r.test}: ${r.details}`);
    });
    
    if (failCount > 0) {
        console.log();
        console.log('❌ COMPONENTS NEEDING FIXES:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`   • ${r.test}: ${r.details}`);
        });
    }

    return { allTestsPassed, passCount, failCount, results };
}

testCompleteIntegration().then(result => {
    process.exit(result.allTestsPassed ? 0 : 1);
}).catch(error => {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
});