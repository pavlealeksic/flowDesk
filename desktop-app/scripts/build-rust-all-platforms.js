#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Script to build Rust CLI binary for all target platforms
 * This is used for CI/CD and cross-platform distribution builds
 */

const RUST_LIB_PATH = path.join(__dirname, '../../shared/rust-lib');
const DIST_BINARIES_PATH = path.join(__dirname, '../dist/binaries');

// Platform and architecture mappings with Rust target triples
const RUST_TARGETS = {
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-gnu',
  'win32-ia32': 'i686-pc-windows-gnu',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu'
};

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function runCommand(command, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function installRustTarget(target) {
  console.log(`📦 Installing Rust target: ${target}`);
  try {
    await runCommand('rustup', ['target', 'add', target], RUST_LIB_PATH);
    console.log(`✓ Target ${target} installed`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to install target ${target}:`, error.message);
    return false;
  }
}

async function buildForTarget(platformKey, target) {
  console.log(`🔨 Building for ${platformKey} (${target})`);
  
  try {
    await runCommand('cargo', [
      'build',
      '--release',
      '--bin',
      'flow_desk_cli',
      '--target',
      target
    ], RUST_LIB_PATH);
    
    console.log(`✓ Built for ${platformKey}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to build for ${platformKey}:`, error.message);
    return false;
  }
}

function copyBinaryToDistribution(platformKey, target) {
  const isWindows = platformKey.startsWith('win32');
  const binaryName = isWindows ? 'flow_desk_cli.exe' : 'flow_desk_cli';
  
  const sourcePath = path.join(RUST_LIB_PATH, 'target', target, 'release', binaryName);
  const destDir = path.join(DIST_BINARIES_PATH, platformKey);
  const destPath = path.join(destDir, binaryName);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Binary not found at ${sourcePath}`);
    return false;
  }
  
  ensureDirectoryExists(destDir);
  
  try {
    fs.copyFileSync(sourcePath, destPath);
    
    // Set executable permissions on Unix-like systems
    if (!isWindows) {
      fs.chmodSync(destPath, 0o755);
    }
    
    const sizeInMB = (fs.statSync(destPath).size / 1024 / 1024).toFixed(2);
    console.log(`✓ Copied ${binaryName} to ${destPath} (${sizeInMB} MB)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to copy binary: ${error.message}`);
    return false;
  }
}

async function checkRustInstallation() {
  try {
    await runCommand('rustup', ['--version'], process.cwd());
    await runCommand('cargo', ['--version'], process.cwd());
    return true;
  } catch (error) {
    console.error('❌ Rust toolchain not found. Please install Rust from https://rustup.rs/');
    return false;
  }
}

function filterTargetsForCurrentOS() {
  const currentOS = os.platform();
  
  // On macOS, we can build for macOS targets (potentially cross-compile with proper setup)
  // On Linux, we can build for Linux targets and potentially Windows with mingw
  // On Windows, we can build for Windows targets
  
  const availableTargets = {};
  
  switch (currentOS) {
    case 'darwin':
      availableTargets['darwin-x64'] = RUST_TARGETS['darwin-x64'];
      availableTargets['darwin-arm64'] = RUST_TARGETS['darwin-arm64'];
      break;
    case 'linux':
      availableTargets['linux-x64'] = RUST_TARGETS['linux-x64'];
      availableTargets['linux-arm64'] = RUST_TARGETS['linux-arm64'];
      // Optionally add Windows cross-compilation if mingw is available
      break;
    case 'win32':
      availableTargets['win32-x64'] = RUST_TARGETS['win32-x64'];
      availableTargets['win32-ia32'] = RUST_TARGETS['win32-ia32'];
      break;
  }
  
  return availableTargets;
}

async function main() {
  console.log('🚀 Building Rust CLI binaries for all platforms...');
  
  // Check if Rust is installed
  if (!(await checkRustInstallation())) {
    process.exit(1);
  }
  
  // Check if we're in the right directory
  if (!fs.existsSync(path.join(RUST_LIB_PATH, 'Cargo.toml'))) {
    console.error(`❌ Cargo.toml not found in ${RUST_LIB_PATH}`);
    process.exit(1);
  }
  
  // Ensure distribution directory exists
  ensureDirectoryExists(DIST_BINARIES_PATH);
  
  // Get targets to build for current OS
  const targetsTouild = filterTargetsForCurrentOS();
  
  if (Object.keys(targetsTouild).length === 0) {
    console.log('ℹ️ No targets available for current platform');
    return;
  }
  
  console.log(`Building for targets: ${Object.keys(targetsTouild).join(', ')}`);
  
  let successCount = 0;
  let totalCount = Object.keys(targetsTouild).length;
  
  for (const [platformKey, target] of Object.entries(targetsTouild)) {
    console.log(`\n--- Building ${platformKey} ---`);
    
    // Install the target if needed
    const targetInstalled = await installRustTarget(target);
    if (!targetInstalled) {
      console.error(`Skipping ${platformKey} due to target installation failure`);
      continue;
    }
    
    // Build for the target
    const buildSuccess = await buildForTarget(platformKey, target);
    if (!buildSuccess) {
      console.error(`Skipping ${platformKey} due to build failure`);
      continue;
    }
    
    // Copy binary to distribution folder
    const copySuccess = copyBinaryToDistribution(platformKey, target);
    if (copySuccess) {
      successCount++;
    }
  }
  
  console.log(`\n✨ Build Summary:`);
  console.log(`  ✅ Successful: ${successCount}/${totalCount}`);
  console.log(`  ❌ Failed: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('🎉 All builds completed successfully!');
  } else if (successCount > 0) {
    console.log('⚠️ Some builds completed with warnings');
    process.exit(1);
  } else {
    console.log('💥 All builds failed');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Build script failed:', error.message);
    process.exit(1);
  });
}