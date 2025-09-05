#!/usr/bin/env node

/**
 * Development Setup Script
 * 
 * Ensures all necessary files are in the right place for development:
 * 1. Builds Rust CLI binary if needed
 * 2. Copies Rust engine source
 * 3. Copies Rust binary to correct location
 * 4. Ensures all module paths work correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const RUST_LIB_PATH = path.join(PROJECT_ROOT, '../shared/rust-lib');
const DIST_PATH = path.join(PROJECT_ROOT, 'dist');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');

function log(message) {
  console.log(`🔧 [Dev Setup] ${message}`);
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${path.relative(PROJECT_ROOT, dirPath)}`);
  }
}

function copyRustEngine() {
  log('Setting up Rust engine integration...');
  
  const rustEngineSource = path.join(SRC_PATH, 'lib/rust-engine');
  
  // Clean and recreate rust-engine directory
  if (fs.existsSync(rustEngineSource)) {
    fs.rmSync(rustEngineSource, { recursive: true, force: true });
  }
  
  ensureDirectoryExists(path.join(SRC_PATH, 'lib'));
  
  // Copy Rust source code
  execSync(`cp -r "${RUST_LIB_PATH}" "${rustEngineSource}"`, { stdio: 'inherit' });
  log('Copied Rust engine source code');
  
  // Also copy to dist for runtime
  const distRustEngine = path.join(DIST_PATH, 'lib/rust-engine');
  ensureDirectoryExists(path.join(DIST_PATH, 'lib'));
  
  if (fs.existsSync(distRustEngine)) {
    fs.rmSync(distRustEngine, { recursive: true, force: true });
  }
  
  execSync(`cp -r "${RUST_LIB_PATH}" "${distRustEngine}"`, { stdio: 'inherit' });
  log('Copied Rust engine to dist directory');
}

function buildRustBinary() {
  log('Building Rust CLI binary...');
  
  const rustBinaryPath = path.join(RUST_LIB_PATH, 'target/release/flow_desk_cli');
  
  // Check if binary exists and is recent
  if (fs.existsSync(rustBinaryPath)) {
    const binaryStats = fs.statSync(rustBinaryPath);
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    if (binaryStats.mtime.getTime() > tenMinutesAgo) {
      log('Rust binary is recent, skipping build');
      return true;
    }
  }
  
  try {
    log('Building Rust binary (release mode)...');
    execSync('cargo build --release --bin flow_desk_cli', {
      cwd: RUST_LIB_PATH,
      stdio: 'inherit'
    });
    log('Rust binary built successfully');
    return true;
  } catch (error) {
    log(`Failed to build Rust binary: ${error.message}`);
    return false;
  }
}

function copyRustBinary() {
  log('Copying Rust binary...');
  
  const { copyBinary, getCurrentPlatformKey } = require('./copy-rust-binaries');
  
  ensureDirectoryExists(path.join(DIST_PATH, 'binaries'));
  
  const currentPlatform = getCurrentPlatformKey();
  
  if (copyBinary(currentPlatform)) {
    log(`Binary copied for platform: ${currentPlatform}`);
    return true;
  } else {
    log('Failed to copy binary');
    return false;
  }
}

function setupSymlinks() {
  log('Setting up development symlinks...');
  
  // Create symlink from dist to actual binary location for development
  const distBinaryPath = path.join(DIST_PATH, 'binaries');
  const currentPlatform = require('./copy-rust-binaries').getCurrentPlatformKey();
  const binaryPath = path.join(distBinaryPath, currentPlatform, 'flow_desk_cli');
  
  if (fs.existsSync(binaryPath)) {
    // Create a more accessible path for development
    const devBinaryPath = path.join(DIST_PATH, 'flow_desk_cli');
    
    if (fs.existsSync(devBinaryPath)) {
      fs.unlinkSync(devBinaryPath);
    }
    
    try {
      fs.symlinkSync(binaryPath, devBinaryPath);
      log('Created development binary symlink');
    } catch (error) {
      // If symlink fails, just copy the file
      fs.copyFileSync(binaryPath, devBinaryPath);
      log('Copied development binary (symlink failed)');
    }
  }
}

function verifySetup() {
  log('Verifying development setup...');
  
  const checks = [
    {
      name: 'Rust engine source',
      path: path.join(SRC_PATH, 'lib/rust-engine/Cargo.toml')
    },
    {
      name: 'Rust engine in dist',
      path: path.join(DIST_PATH, 'lib/rust-engine/Cargo.toml')
    },
    {
      name: 'Rust integration module',
      path: path.join(SRC_PATH, 'lib/rust-integration/rust-engine-integration.ts')
    }
  ];
  
  let allValid = true;
  
  for (const check of checks) {
    const exists = fs.existsSync(check.path);
    if (exists) {
      log(`✓ ${check.name}: OK`);
    } else {
      log(`✗ ${check.name}: MISSING`);
      allValid = false;
    }
  }
  
  // Check for binary
  const currentPlatform = require('./copy-rust-binaries').getCurrentPlatformKey();
  const binaryPath = path.join(DIST_PATH, 'binaries', currentPlatform, 'flow_desk_cli');
  
  if (fs.existsSync(binaryPath)) {
    const stats = fs.statSync(binaryPath);
    log(`✓ Rust binary: OK (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    log('✗ Rust binary: MISSING');
    allValid = false;
  }
  
  return allValid;
}

async function main() {
  log('Starting development environment setup...');
  
  try {
    // Step 1: Copy Rust engine source
    copyRustEngine();
    
    // Step 2: Fix module paths and create stubs
    const { createModuleStub, createPackageJson } = require('./fix-module-paths');
    createModuleStub();
    createPackageJson();
    
    // Step 3: Build Rust binary if needed
    const rustBuilt = buildRustBinary();
    
    if (!rustBuilt) {
      log('⚠️  Rust binary build failed, but continuing with existing binary if available');
    }
    
    // Step 4: Copy binary to distribution
    copyRustBinary();
    
    // Step 5: Setup development symlinks
    setupSymlinks();
    
    // Step 6: Verify everything is ready
    const isValid = verifySetup();
    
    if (isValid) {
      log('✅ Development environment setup complete!');
    } else {
      log('❌ Development environment setup incomplete - some files are missing');
      process.exit(1);
    }
    
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  copyRustEngine, 
  buildRustBinary, 
  copyRustBinary, 
  setupSymlinks, 
  verifySetup 
};