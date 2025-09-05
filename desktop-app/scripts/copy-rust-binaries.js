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
const DIST_SHARED_PATH = path.join(__dirname, '../dist/shared/rust-lib');

// Platform and architecture mappings
const PLATFORM_MAP = {
  'darwin-x64': { target: 'x86_64-apple-darwin', ext: '', napiSuffix: 'darwin-x64' },
  'darwin-arm64': { target: 'aarch64-apple-darwin', ext: '', napiSuffix: 'darwin-arm64' },
  'win32-x64': { target: 'x86_64-pc-windows-gnu', ext: '.exe', napiSuffix: 'win32-x64' },
  'win32-ia32': { target: 'i686-pc-windows-gnu', ext: '.exe', napiSuffix: 'win32-ia32' },
  'linux-x64': { target: 'x86_64-unknown-linux-gnu', ext: '', napiSuffix: 'linux-x64' },
  'linux-arm64': { target: 'aarch64-unknown-linux-gnu', ext: '', napiSuffix: 'linux-arm64' }
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

function copyNapiBinary(platformKey) {
  const config = PLATFORM_MAP[platformKey];
  if (!config) {
    console.error(`Unsupported platform: ${platformKey}`);
    return false;
  }

  const napiName = `flow-desk-shared.${config.napiSuffix}.node`;
  const sourcePath = path.join(RUST_LIB_PATH, napiName);
  
  if (!fs.existsSync(sourcePath)) {
    console.warn(`NAPI binary not found at: ${sourcePath}`);
    console.warn('This is expected if NAPI bindings are not built for this platform.');
    return false;
  }

  // Create destination directory
  ensureDirectoryExists(DIST_SHARED_PATH);
  
  const destPath = path.join(DIST_SHARED_PATH, napiName);
  
  try {
    fs.copyFileSync(sourcePath, destPath);
    
    console.log(`✓ Copied NAPI binary ${napiName} to ${destPath}`);
    console.log(`  Size: ${(fs.statSync(destPath).size / 1024 / 1024).toFixed(2)} MB`);
    
    return true;
  } catch (error) {
    console.error(`Failed to copy NAPI binary: ${error.message}`);
    return false;
  }
}

function copyRustWrapperFiles() {
  console.log('🔧 Copying Rust wrapper files...');
  
  // Create destination directory
  ensureDirectoryExists(DIST_SHARED_PATH);
  
  // Files to copy from shared/rust-lib to dist/shared/rust-lib
  const filesToCopy = [
    'index.js',
    'index.d.ts',
    'package.json'
  ];
  
  let success = true;
  
  for (const fileName of filesToCopy) {
    const sourcePath = path.join(RUST_LIB_PATH, fileName);
    const destPath = path.join(DIST_SHARED_PATH, fileName);
    
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: ${fileName} not found at ${sourcePath}`);
      continue;
    }
    
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✓ Copied ${fileName} to ${path.relative(__dirname, destPath)}`);
    } catch (error) {
      console.error(`Failed to copy ${fileName}: ${error.message}`);
      success = false;
    }
  }
  
  return success;
}

function main() {
  console.log('🔧 Copying Rust binaries and wrappers...');
  
  // Ensure destination directories exist
  ensureDirectoryExists(DIST_BINARIES_PATH);
  ensureDirectoryExists(DIST_SHARED_PATH);
  
  // Get current platform
  const currentPlatform = getCurrentPlatformKey();
  console.log(`Current platform: ${currentPlatform}`);
  
  // Copy CLI binary for current platform
  const cliBinarySuccess = copyBinary(currentPlatform);
  
  // Copy NAPI binary for current platform
  const napiBinarySuccess = copyNapiBinary(currentPlatform);
  
  // Copy Rust wrapper files (index.js, package.json, etc.)
  const wrapperFilesSuccess = copyRustWrapperFiles();
  
  if (cliBinarySuccess) {
    console.log('✅ CLI binary copy completed successfully');
  } else {
    console.error('❌ CLI binary copy failed');
    process.exit(1);
  }
  
  if (napiBinarySuccess) {
    console.log('✅ NAPI binary copy completed successfully');
  } else {
    console.log('ℹ️  NAPI binary copy skipped (not available for this platform)');
  }
  
  if (wrapperFilesSuccess) {
    console.log('✅ Wrapper files copy completed successfully');
  } else {
    console.error('❌ Wrapper files copy failed');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { copyBinary, copyNapiBinary, copyRustWrapperFiles, getCurrentPlatformKey };