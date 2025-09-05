#!/usr/bin/env node

/**
 * Minimal Development Setup Script
 * 
 * Fast startup for development - uses existing binaries and minimal copying
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_PATH = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  console.log(`⚡ [Fast Setup] ${message}`);
}

function ensureDistStructure() {
  const requiredDirs = [
    path.join(DIST_PATH, 'binaries'),
    path.join(DIST_PATH, 'shared'),
    path.join(DIST_PATH, 'lib')
  ];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created directory: ${path.relative(PROJECT_ROOT, dir)}`);
    }
  }
}

function copyPrebuiltFiles() {
  log('Copying prebuilt Rust files...');
  
  const RUST_LIB_PATH = path.join(PROJECT_ROOT, '../shared/rust-lib');
  const { copyBinary, copyNapiBinary, copyRustWrapperFiles, getCurrentPlatformKey } = require('./copy-rust-binaries');
  
  // Just copy the compiled files, don't rebuild anything
  const currentPlatform = getCurrentPlatformKey();
  
  const success1 = copyBinary(currentPlatform);
  const success2 = copyNapiBinary(currentPlatform);  
  const success3 = copyRustWrapperFiles();
  
  if (success1 && success3) {
    log('✅ Prebuilt Rust files copied successfully');
    return true;
  } else {
    log('⚠️ Some files missing - you may need to run: npm run build:rust');
    return false;
  }
}

function main() {
  log('Starting fast development setup...');
  
  try {
    ensureDistStructure();
    copyPrebuiltFiles();
    
    log('✅ Fast development setup complete!');
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ensureDistStructure, copyPrebuiltFiles };