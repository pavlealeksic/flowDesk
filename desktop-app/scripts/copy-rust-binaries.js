#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Script to copy the appropriate Rust CLI binary to the distribution folder
 * based on the current platform and architecture
 */

const RUST_LIB_PATH = path.join(__dirname, '../../shared/rust-lib');
const DIST_BINARIES_PATH = path.join(__dirname, '../dist/binaries');

// Platform and architecture mappings
const PLATFORM_MAP = {
  'darwin-x64': { target: 'x86_64-apple-darwin', ext: '' },
  'darwin-arm64': { target: 'aarch64-apple-darwin', ext: '' },
  'win32-x64': { target: 'x86_64-pc-windows-gnu', ext: '.exe' },
  'win32-ia32': { target: 'i686-pc-windows-gnu', ext: '.exe' },
  'linux-x64': { target: 'x86_64-unknown-linux-gnu', ext: '' },
  'linux-arm64': { target: 'aarch64-unknown-linux-gnu', ext: '' }
};

function getCurrentPlatformKey() {
  const platform = os.platform();
  const arch = os.arch();
  
  // Convert Node.js arch to our naming convention
  const archMap = {
    'x64': 'x64',
    'arm64': 'arm64',
    'ia32': 'ia32'
  };
  
  const mappedArch = archMap[arch] || arch;
  return `${platform}-${mappedArch}`;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyBinary(platformKey) {
  const config = PLATFORM_MAP[platformKey];
  if (!config) {
    console.error(`Unsupported platform: ${platformKey}`);
    process.exit(1);
  }

  const binaryName = `flow_desk_cli${config.ext}`;
  
  // Try multiple possible source locations
  const possibleSources = [
    path.join(RUST_LIB_PATH, 'target', 'release', binaryName),
    path.join(RUST_LIB_PATH, 'target', config.target, 'release', binaryName)
  ];

  let sourcePath = null;
  for (const source of possibleSources) {
    if (fs.existsSync(source)) {
      sourcePath = source;
      break;
    }
  }

  if (!sourcePath) {
    console.error(`Rust binary not found for platform ${platformKey}`);
    console.error(`Searched in: ${possibleSources.join(', ')}`);
    console.error('Make sure to run the Rust build process first.');
    process.exit(1);
  }

  // Create destination directory
  const destDir = path.join(DIST_BINARIES_PATH, platformKey);
  ensureDirectoryExists(destDir);
  
  const destPath = path.join(destDir, binaryName);
  
  try {
    fs.copyFileSync(sourcePath, destPath);
    
    // Set executable permissions on Unix-like systems
    if (process.platform !== 'win32') {
      fs.chmodSync(destPath, 0o755);
    }
    
    console.log(`✓ Copied ${binaryName} to ${destPath}`);
    console.log(`  Size: ${(fs.statSync(destPath).size / 1024 / 1024).toFixed(2)} MB`);
    
    return true;
  } catch (error) {
    console.error(`Failed to copy binary: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Copying Rust CLI binaries...');
  
  // Ensure destination directory exists
  ensureDirectoryExists(DIST_BINARIES_PATH);
  
  // Get current platform
  const currentPlatform = getCurrentPlatformKey();
  console.log(`Current platform: ${currentPlatform}`);
  
  // Copy binary for current platform
  if (copyBinary(currentPlatform)) {
    console.log('✅ Binary copy completed successfully');
  } else {
    console.error('❌ Binary copy failed');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { copyBinary, getCurrentPlatformKey };