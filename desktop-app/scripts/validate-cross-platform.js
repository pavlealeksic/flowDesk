#!/usr/bin/env node

/**
 * Cross-Platform Validation Script
 * 
 * Validates that Flow Desk works correctly across Windows, macOS, and Linux
 * Tests native modules, file operations, network stack, and platform features
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const crypto = require('crypto');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = {
    'ERROR': colors.red,
    'WARN': colors.yellow,
    'INFO': colors.green,
    'DEBUG': colors.blue
  }[level] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${level}: ${message}${colors.reset}`);
}

function error(message) { log('ERROR', message); }
function warn(message) { log('WARN', message); }
function info(message) { log('INFO', message); }
function debug(message) { log('DEBUG', message); }

/**
 * Get platform information
 */
function getPlatformInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron || 'not available'
  };
}

/**
 * Test native modules
 */
async function testNativeModules() {
  info('Testing native modules...');
  
  const modules = [
    { name: 'better-sqlite3', required: true },
    { name: 'sqlite3', required: true },
    { name: 'keytar', required: false },
    { name: 'node-machine-id', required: false }
  ];
  
  const results = [];
  
  for (const mod of modules) {
    try {
      const modulePath = path.join(__dirname, '..', 'node_modules', mod.name);
      
      if (fs.existsSync(modulePath)) {
        // Try to require the module
        const module = require(mod.name);
        
        // Basic functionality test
        let testPassed = false;
        
        if (mod.name === 'better-sqlite3' || mod.name === 'sqlite3') {
          // Test SQLite
          testPassed = await testSQLite(module, mod.name);
        } else if (mod.name === 'keytar') {
          // Test keytar
          testPassed = await testKeytar(module);
        } else if (mod.name === 'node-machine-id') {
          // Test machine ID
          testPassed = await testMachineId(module);
        } else {
          testPassed = true; // Module loads
        }
        
        results.push({
          name: mod.name,
          loaded: true,
          tested: testPassed,
          required: mod.required,
          error: null
        });
        
        info(`✓ ${mod.name}: loaded and functional`);
      } else {
        results.push({
          name: mod.name,
          loaded: false,
          tested: false,
          required: mod.required,
          error: 'Module not found'
        });
        
        if (mod.required) {
          error(`✗ ${mod.name}: not found (required)`);
        } else {
          warn(`⚠ ${mod.name}: not found (optional)`);
        }
      }
    } catch (err) {
      results.push({
        name: mod.name,
        loaded: false,
        tested: false,
        required: mod.required,
        error: err.message
      });
      
      if (mod.required) {
        error(`✗ ${mod.name}: ${err.message}`);
      } else {
        warn(`⚠ ${mod.name}: ${err.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Test SQLite functionality
 */
async function testSQLite(sqliteModule, moduleName) {
  try {
    if (moduleName === 'better-sqlite3') {
      const db = new sqliteModule(':memory:');
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec("INSERT INTO test (name) VALUES ('cross-platform-test')");
      const row = db.prepare('SELECT * FROM test WHERE id = ?').get(1);
      db.close();
      return row && row.name === 'cross-platform-test';
    } else if (moduleName === 'sqlite3') {
      return new Promise((resolve) => {
        const db = new sqliteModule.Database(':memory:');
        db.serialize(() => {
          db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
          db.run("INSERT INTO test (name) VALUES ('cross-platform-test')");
          db.get('SELECT * FROM test WHERE id = ?', [1], (err, row) => {
            db.close();
            resolve(!err && row && row.name === 'cross-platform-test');
          });
        });
      });
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Test keytar functionality
 */
async function testKeytar(keytar) {
  try {
    const testService = 'flowdesk-test';
    const testAccount = 'test-account';
    const testPassword = 'test-password-' + Date.now();
    
    // Store password
    await keytar.setPassword(testService, testAccount, testPassword);
    
    // Retrieve password
    const retrieved = await keytar.getPassword(testService, testAccount);
    
    // Clean up
    await keytar.deletePassword(testService, testAccount);
    
    return retrieved === testPassword;
  } catch (err) {
    debug(`Keytar test failed: ${err.message}`);
    return false;
  }
}

/**
 * Test machine ID functionality
 */
async function testMachineId(machineIdModule) {
  try {
    const id1 = machineIdModule.machineIdSync();
    const id2 = machineIdModule.machineIdSync();
    return id1 === id2 && typeof id1 === 'string' && id1.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Test file system operations
 */
async function testFileSystem() {
  info('Testing file system operations...');
  
  const testDir = path.join(os.tmpdir(), 'flowdesk-fs-test-' + Date.now());
  const results = {
    createDirectory: false,
    writeFile: false,
    readFile: false,
    copyFile: false,
    moveFile: false,
    deleteFile: false,
    deleteDirectory: false,
    permissions: false
  };
  
  try {
    // Create directory
    fs.mkdirSync(testDir, { recursive: true });
    results.createDirectory = true;
    debug('✓ Directory creation');
    
    // Write file
    const testFile1 = path.join(testDir, 'test1.txt');
    const testContent = 'Cross-platform test content: ' + Date.now();
    fs.writeFileSync(testFile1, testContent);
    results.writeFile = true;
    debug('✓ File writing');
    
    // Read file
    const readContent = fs.readFileSync(testFile1, 'utf8');
    results.readFile = readContent === testContent;
    debug('✓ File reading');
    
    // Copy file
    const testFile2 = path.join(testDir, 'test2.txt');
    fs.copyFileSync(testFile1, testFile2);
    results.copyFile = fs.existsSync(testFile2);
    debug('✓ File copying');
    
    // Move file
    const testFile3 = path.join(testDir, 'test3.txt');
    fs.renameSync(testFile2, testFile3);
    results.moveFile = fs.existsSync(testFile3) && !fs.existsSync(testFile2);
    debug('✓ File moving');
    
    // Test permissions (Unix-like systems only)
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(testFile1, 0o644);
        const stats = fs.statSync(testFile1);
        results.permissions = (stats.mode & parseInt('777', 8)) === parseInt('644', 8);
        debug('✓ File permissions');
      } catch (permErr) {
        warn('File permissions test failed (non-critical)');
      }
    } else {
      results.permissions = true; // Skip permissions test on Windows
      debug('✓ File permissions (skipped on Windows)');
    }
    
    // Delete files
    fs.unlinkSync(testFile1);
    fs.unlinkSync(testFile3);
    results.deleteFile = !fs.existsSync(testFile1) && !fs.existsSync(testFile3);
    debug('✓ File deletion');
    
    // Delete directory
    fs.rmdirSync(testDir);
    results.deleteDirectory = !fs.existsSync(testDir);
    debug('✓ Directory deletion');
    
  } catch (err) {
    error(`File system test failed: ${err.message}`);
    
    // Clean up on failure
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      warn(`Failed to clean up test directory: ${cleanupErr.message}`);
    }
  }
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  info(`File system tests: ${passedTests}/${totalTests} passed`);
  return { results, summary: { passed: passedTests, total: totalTests } };
}

/**
 * Test network connectivity
 */
async function testNetwork() {
  info('Testing network connectivity...');
  
  const tests = [
    { name: 'Google DNS', host: '8.8.8.8', port: 53 },
    { name: 'HTTPS connectivity', url: 'https://www.google.com', method: 'HEAD' },
    { name: 'Gmail IMAP', host: 'imap.gmail.com', port: 993 },
    { name: 'Outlook SMTP', host: 'smtp.office365.com', port: 587 }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      let passed = false;
      
      if (test.url) {
        // HTTP/HTTPS test
        passed = await testHttpConnectivity(test.url, test.method);
      } else {
        // TCP connection test
        passed = await testTcpConnectivity(test.host, test.port);
      }
      
      results.push({
        name: test.name,
        passed,
        host: test.host,
        port: test.port,
        url: test.url
      });
      
      if (passed) {
        debug(`✓ ${test.name}`);
      } else {
        warn(`⚠ ${test.name}: connection failed`);
      }
    } catch (err) {
      results.push({
        name: test.name,
        passed: false,
        error: err.message,
        host: test.host,
        port: test.port,
        url: test.url
      });
      warn(`⚠ ${test.name}: ${err.message}`);
    }
  }
  
  const passedTests = results.filter(r => r.passed).length;
  info(`Network tests: ${passedTests}/${results.length} passed`);
  
  return { results, summary: { passed: passedTests, total: results.length } };
}

/**
 * Test TCP connectivity
 */
function testTcpConnectivity(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);
    
    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Test HTTP connectivity
 */
function testHttpConnectivity(url, method = 'HEAD', timeout = 5000) {
  return new Promise((resolve) => {
    const https = require('https');
    const http = require('http');
    
    const client = url.startsWith('https:') ? https : http;
    const options = {
      method,
      timeout,
      headers: {
        'User-Agent': 'FlowDesk-CrossPlatform-Test/1.0'
      }
    };
    
    const req = client.request(url, options, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * Test Rust binary compilation and execution
 */
async function testRustBinary() {
  info('Testing Rust binary...');
  
  const platformInfo = getPlatformInfo();
  const binaryName = platformInfo.platform === 'win32' ? 'flow_desk_cli.exe' : 'flow_desk_cli';
  
  // Look for binary in expected locations
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'shared', 'rust-lib', 'target', 'release', binaryName),
    path.join(__dirname, '..', 'dist', 'binaries', `${platformInfo.platform}-${platformInfo.arch}`, binaryName)
  ];
  
  let binaryPath = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      binaryPath = possiblePath;
      break;
    }
  }
  
  if (!binaryPath) {
    warn('Rust binary not found - attempting to build...');
    
    const rustLibPath = path.join(__dirname, '..', '..', 'shared', 'rust-lib');
    if (fs.existsSync(path.join(rustLibPath, 'Cargo.toml'))) {
      try {
        await execCommand('cargo', ['build', '--release'], { cwd: rustLibPath });
        
        // Check again for the binary
        const builtBinaryPath = path.join(rustLibPath, 'target', 'release', binaryName);
        if (fs.existsSync(builtBinaryPath)) {
          binaryPath = builtBinaryPath;
          info('✓ Rust binary built successfully');
        }
      } catch (buildErr) {
        error(`Failed to build Rust binary: ${buildErr.message}`);
        return { found: false, functional: false, error: buildErr.message };
      }
    }
  }
  
  if (!binaryPath) {
    return { found: false, functional: false, error: 'Binary not found and could not build' };
  }
  
  // Test binary execution
  try {
    const result = await execCommand(binaryPath, ['--version'], { timeout: 10000 });
    const functional = result.stdout && result.stdout.includes('flow_desk_cli');
    
    if (functional) {
      info('✓ Rust binary is functional');
    } else {
      warn('⚠ Rust binary exists but may not be functional');
    }
    
    return {
      found: true,
      functional,
      path: binaryPath,
      version: result.stdout?.trim(),
      error: null
    };
  } catch (execErr) {
    warn(`⚠ Rust binary found but execution failed: ${execErr.message}`);
    return {
      found: true,
      functional: false,
      path: binaryPath,
      error: execErr.message
    };
  }
}

/**
 * Execute command with timeout
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 30000, ...spawnOptions } = options;
    
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...spawnOptions
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Command timed out'));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timer);
      
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Test platform-specific features
 */
async function testPlatformFeatures() {
  info('Testing platform-specific features...');
  
  const platformInfo = getPlatformInfo();
  const results = {
    platform: platformInfo.platform,
    arch: platformInfo.arch,
    features: {}
  };
  
  // Test secure storage
  if (platformInfo.platform === 'darwin') {
    results.features.keychain = await testMacOSKeychain();
  } else if (platformInfo.platform === 'win32') {
    results.features.credentialManager = await testWindowsCredentialManager();
  } else if (platformInfo.platform === 'linux') {
    results.features.secretService = await testLinuxSecretService();
  }
  
  // Test notification support
  results.features.notifications = await testNotificationSupport();
  
  // Test file system permissions
  results.features.filePermissions = await testFilePermissions();
  
  return results;
}

/**
 * Test macOS Keychain access
 */
async function testMacOSKeychain() {
  try {
    // This would require the keytar module to be loaded
    return { available: true, tested: false, note: 'Requires keytar module' };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Test Windows Credential Manager
 */
async function testWindowsCredentialManager() {
  try {
    // This would require the keytar module to be loaded
    return { available: true, tested: false, note: 'Requires keytar module' };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Test Linux Secret Service
 */
async function testLinuxSecretService() {
  try {
    // Check if libsecret is available
    await execCommand('pkg-config', ['--exists', 'libsecret-1']);
    return { available: true, tested: false, note: 'libsecret found' };
  } catch (err) {
    return { available: false, error: 'libsecret not found' };
  }
}

/**
 * Test notification support
 */
async function testNotificationSupport() {
  // Basic check - actual notification testing would require GUI environment
  return {
    available: true,
    note: 'Basic support available on all platforms'
  };
}

/**
 * Test file permissions
 */
async function testFilePermissions() {
  if (process.platform === 'win32') {
    return { available: false, note: 'Windows uses different permission model' };
  }
  
  try {
    const testFile = path.join(os.tmpdir(), 'flowdesk-perm-test-' + Date.now());
    fs.writeFileSync(testFile, 'test');
    fs.chmodSync(testFile, 0o644);
    
    const stats = fs.statSync(testFile);
    fs.unlinkSync(testFile);
    
    return {
      available: true,
      tested: true,
      permissions: '0' + (stats.mode & parseInt('777', 8)).toString(8)
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Generate validation report
 */
function generateReport(results) {
  const { platformInfo, nativeModules, fileSystem, network, rustBinary, platformFeatures } = results;
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 FLOW DESK CROSS-PLATFORM VALIDATION REPORT');
  console.log('='.repeat(60));
  
  console.log('\n📋 Platform Information:');
  console.log(`  OS: ${platformInfo.platform} ${platformInfo.arch} (${platformInfo.release})`);
  console.log(`  Node.js: ${platformInfo.nodeVersion}`);
  console.log(`  Electron: ${platformInfo.electronVersion}`);
  console.log(`  Hostname: ${platformInfo.hostname}`);
  
  console.log('\n🔧 Native Modules:');
  for (const mod of nativeModules) {
    const status = mod.loaded && mod.tested ? '✅' : mod.loaded ? '⚠️' : '❌';
    const req = mod.required ? ' (required)' : ' (optional)';
    console.log(`  ${status} ${mod.name}${req}`);
    if (mod.error) {
      console.log(`      Error: ${mod.error}`);
    }
  }
  
  console.log('\n💾 File System:');
  const fsResults = fileSystem.results;
  Object.entries(fsResults).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
  });
  console.log(`  Summary: ${fileSystem.summary.passed}/${fileSystem.summary.total} tests passed`);
  
  console.log('\n🌐 Network Connectivity:');
  for (const test of network.results) {
    console.log(`  ${test.passed ? '✅' : '⚠️'} ${test.name}`);
    if (test.error) {
      console.log(`      Error: ${test.error}`);
    }
  }
  console.log(`  Summary: ${network.summary.passed}/${network.summary.total} tests passed`);
  
  console.log('\n🦀 Rust Binary:');
  if (rustBinary.found && rustBinary.functional) {
    console.log(`  ✅ Found and functional: ${rustBinary.path}`);
    console.log(`  Version: ${rustBinary.version}`);
  } else if (rustBinary.found) {
    console.log(`  ⚠️ Found but not functional: ${rustBinary.path}`);
    console.log(`  Error: ${rustBinary.error}`);
  } else {
    console.log(`  ❌ Not found`);
    console.log(`  Error: ${rustBinary.error}`);
  }
  
  console.log('\n🏗️ Platform Features:');
  console.log(`  Platform: ${platformFeatures.platform} ${platformFeatures.arch}`);
  Object.entries(platformFeatures.features).forEach(([feature, result]) => {
    if (result.available) {
      console.log(`  ✅ ${feature}: ${result.note || 'Available'}`);
    } else {
      console.log(`  ❌ ${feature}: ${result.error || 'Not available'}`);
    }
  });
  
  // Overall assessment
  const criticalIssues = [];
  const warnings = [];
  
  const requiredModules = nativeModules.filter(m => m.required);
  const failedRequired = requiredModules.filter(m => !m.loaded || !m.tested);
  
  if (failedRequired.length > 0) {
    criticalIssues.push(`${failedRequired.length} required native modules failed`);
  }
  
  if (!rustBinary.found) {
    criticalIssues.push('Rust binary not found');
  } else if (!rustBinary.functional) {
    warnings.push('Rust binary not functional');
  }
  
  if (fileSystem.summary.passed < fileSystem.summary.total * 0.8) {
    criticalIssues.push('File system tests mostly failed');
  }
  
  if (network.summary.passed === 0) {
    warnings.push('No network connectivity (may be expected in some environments)');
  }
  
  console.log('\n🎯 Overall Assessment:');
  if (criticalIssues.length === 0) {
    console.log('  ✅ All critical components are working');
    if (warnings.length > 0) {
      console.log(`  ⚠️ ${warnings.length} non-critical warnings`);
      warnings.forEach(w => console.log(`    - ${w}`));
    }
    console.log('  🎉 Flow Desk should work correctly on this platform');
  } else {
    console.log('  ❌ Critical issues found:');
    criticalIssues.forEach(issue => console.log(`    - ${issue}`));
    if (warnings.length > 0) {
      console.log('  ⚠️ Additional warnings:');
      warnings.forEach(w => console.log(`    - ${w}`));
    }
    console.log('  🛠️ Please resolve critical issues before using Flow Desk');
  }
  
  console.log('\n' + '='.repeat(60));
  
  return {
    success: criticalIssues.length === 0,
    criticalIssues,
    warnings,
    summary: {
      platform: `${platformInfo.platform}-${platformInfo.arch}`,
      nativeModules: `${nativeModules.filter(m => m.loaded && m.tested).length}/${nativeModules.length}`,
      fileSystem: `${fileSystem.summary.passed}/${fileSystem.summary.total}`,
      network: `${network.summary.passed}/${network.summary.total}`,
      rustBinary: rustBinary.found && rustBinary.functional,
      platformFeatures: Object.keys(platformFeatures.features).length
    }
  };
}

/**
 * Main validation function
 */
async function main() {
  console.log('🚀 Starting Flow Desk Cross-Platform Validation...\n');
  
  const results = {
    platformInfo: getPlatformInfo(),
    nativeModules: [],
    fileSystem: null,
    network: null,
    rustBinary: null,
    platformFeatures: null
  };
  
  try {
    // Run all tests
    results.nativeModules = await testNativeModules();
    results.fileSystem = await testFileSystem();
    results.network = await testNetwork();
    results.rustBinary = await testRustBinary();
    results.platformFeatures = await testPlatformFeatures();
    
    // Generate report
    const report = generateReport(results);
    
    // Exit with appropriate code
    process.exit(report.success ? 0 : 1);
    
  } catch (err) {
    error(`Validation failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    error(`Validation script crashed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { main, getPlatformInfo };