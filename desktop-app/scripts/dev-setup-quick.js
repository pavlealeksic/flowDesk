#!/usr/bin/env node

/**
 * Quick Development Setup Script
 * 
 * Sets up development environment without rebuilding Rust binary
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const RUST_LIB_PATH = path.join(PROJECT_ROOT, '../shared/rust-lib');
const DIST_PATH = path.join(PROJECT_ROOT, 'dist');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');

function log(message) {
  console.log(`🚀 [Quick Setup] ${message}`);
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
  
  // Check if rust-engine source files exist, if not copy them
  if (!fs.existsSync(path.join(rustEngineSource, 'Cargo.toml'))) {
    // Clean and recreate rust-engine directory
    if (fs.existsSync(rustEngineSource)) {
      try {
        fs.rmSync(rustEngineSource, { recursive: true, force: true });
      } catch (error) {
        log(`Warning: Could not remove existing directory: ${error.message}`);
        // Try to move it instead
        const backupPath = rustEngineSource + '_backup_' + Date.now();
        fs.renameSync(rustEngineSource, backupPath);
        log(`Moved existing directory to: ${backupPath}`);
      }
    }
    
    ensureDirectoryExists(path.join(SRC_PATH, 'lib'));
    
    // Copy Rust source code
    execSync(`cp -r "${RUST_LIB_PATH}" "${rustEngineSource}"`, { stdio: 'inherit' });
    log('Copied Rust engine source code');
  } else {
    log('Rust engine source already exists, skipping copy');
  }
  
  // Also copy to dist for runtime
  const distRustEngine = path.join(DIST_PATH, 'lib/rust-engine');
  ensureDirectoryExists(path.join(DIST_PATH, 'lib'));
  
  if (!fs.existsSync(path.join(distRustEngine, 'Cargo.toml'))) {
    if (fs.existsSync(distRustEngine)) {
      try {
        fs.rmSync(distRustEngine, { recursive: true, force: true });
      } catch (error) {
        log(`Warning: Could not remove dist directory: ${error.message}`);
      }
    }
    
    execSync(`cp -r "${RUST_LIB_PATH}" "${distRustEngine}"`, { stdio: 'inherit' });
    log('Copied Rust engine to dist directory');
  } else {
    log('Rust engine dist already exists, skipping copy');
  }
}

function buildRustIfNeeded() {
  log('Checking if Rust binary needs building...');
  
  const rustBinaryPath = path.join(RUST_LIB_PATH, 'target/release/flow_desk_cli');
  const existingBinary = process.platform === 'win32' ? rustBinaryPath + '.exe' : rustBinaryPath;
  
  // Check if binary exists and is recent (less than 1 hour old)
  if (fs.existsSync(existingBinary)) {
    const binaryStats = fs.statSync(existingBinary);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    if (binaryStats.mtime.getTime() > oneHourAgo) {
      log('Rust binary is recent, skipping build');
      return true;
    }
  }
  
  log('Rust binary missing or old, building...');
  try {
    execSync('cargo build --release --bin flow_desk_cli', {
      cwd: RUST_LIB_PATH,
      stdio: 'inherit'
    });
    log('Rust binary built successfully');
    return true;
  } catch (error) {
    log(`Failed to build Rust binary: ${error.message}`);
    log('Continuing with existing binary if available...');
    return fs.existsSync(existingBinary);
  }
}

function copyRustBinary() {
  log('Copying Rust binaries and wrappers...');
  
  const { copyBinary, copyNapiBinary, copyRustWrapperFiles, getCurrentPlatformKey } = require('./copy-rust-binaries');
  
  ensureDirectoryExists(path.join(DIST_PATH, 'binaries'));
  ensureDirectoryExists(path.join(DIST_PATH, 'shared'));
  
  const currentPlatform = getCurrentPlatformKey();
  
  const cliBinarySuccess = copyBinary(currentPlatform);
  const napiBinarySuccess = copyNapiBinary(currentPlatform);
  const wrapperFilesSuccess = copyRustWrapperFiles();
  
  if (cliBinarySuccess) {
    log(`CLI binary copied for platform: ${currentPlatform}`);
  } else {
    log('Failed to copy CLI binary');
    return false;
  }
  
  if (napiBinarySuccess) {
    log(`NAPI binary copied for platform: ${currentPlatform}`);
  } else {
    log('NAPI binary not available for this platform (this is ok)');
  }
  
  if (wrapperFilesSuccess) {
    log('Rust wrapper files copied successfully');
  } else {
    log('Failed to copy wrapper files');
    return false;
  }
  
  return true;
}

function createModuleStubs() {
  log('Creating module stubs...');
  
  const { createModuleStub, createPackageJson } = require('./fix-module-paths');
  createModuleStub();
  createPackageJson();
  
  log('Module stubs created');
}

function main() {
  log('Starting quick development environment setup...');
  
  try {
    copyRustEngine();
    createModuleStubs();
    buildRustIfNeeded();
    copyRustBinary();
    
    log('✅ Quick development environment setup complete!');
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { copyRustEngine, copyRustBinary, createModuleStubs };