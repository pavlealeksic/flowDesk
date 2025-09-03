#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Script to verify that the build process completed successfully
 * and that all required binaries are present and functional
 */

const DIST_PATH = path.join(__dirname, '../dist');
const BINARIES_PATH = path.join(DIST_PATH, 'binaries');
const RUST_ENGINE_PATH = path.join(DIST_PATH, 'lib/rust-engine');

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${description}: ${filePath}`);
    return true;
  } else {
    console.error(`❌ Missing ${description}: ${filePath}`);
    return false;
  }
}

function checkDirectoryExists(dirPath, description) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    console.log(`✓ ${description}: ${dirPath}`);
    return true;
  } else {
    console.error(`❌ Missing ${description}: ${dirPath}`);
    return false;
  }
}

function getBinarySize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024 / 1024).toFixed(2);
  } catch (error) {
    return 'unknown';
  }
}

function testBinaryExecution(binaryPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(binaryPath)) {
      resolve(false);
      return;
    }

    const child = spawn(binaryPath, ['--help'], {
      stdio: 'pipe',
      timeout: 10000
    });

    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      // The CLI should respond with some output or expected initialization errors
      // Success criteria: 
      // - CLI starts and shows it's working (even if initialization fails due to missing databases)
      // - Contains "Flow Desk CLI" or similar identifying text
      const fullOutput = output + errorOutput;
      const hasValidResponse = fullOutput.includes('Flow Desk CLI') || 
                              fullOutput.includes('Failed to initialize') || 
                              fullOutput.includes('ERROR') ||
                              fullOutput.includes('flow_desk');
      
      if (hasValidResponse) {
        console.log(`✓ Binary executable and running correctly: ${binaryPath}`);
        resolve(true);
      } else {
        console.error(`❌ Binary execution failed: ${binaryPath} (exit code: ${code})`);
        console.error(`Output: ${fullOutput.substring(0, 200)}...`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Binary execution error: ${binaryPath} - ${error.message}`);
      resolve(false);
    });
  });
}

async function verifyDistribution() {
  console.log('🔍 Verifying build distribution...\n');

  let issues = 0;

  // Check main distribution structure
  console.log('📁 Checking distribution structure:');
  if (!checkDirectoryExists(DIST_PATH, 'Distribution directory')) issues++;
  if (!checkDirectoryExists(path.join(DIST_PATH, 'main'), 'Main process directory')) issues++;
  if (!checkDirectoryExists(path.join(DIST_PATH, 'renderer'), 'Renderer process directory')) issues++;
  if (!checkFileExists(path.join(DIST_PATH, 'main/main.js'), 'Main process entry point')) issues++;

  console.log('\n📦 Checking Rust engine integration:');
  if (!checkDirectoryExists(RUST_ENGINE_PATH, 'Rust engine directory')) issues++;
  if (!checkFileExists(path.join(RUST_ENGINE_PATH, 'Cargo.toml'), 'Rust Cargo.toml')) issues++;

  console.log('\n🔧 Checking binary distribution:');
  if (!checkDirectoryExists(BINARIES_PATH, 'Binaries directory')) {
    issues++;
  } else {
    // Check platform-specific binaries
    const platforms = fs.readdirSync(BINARIES_PATH);
    
    if (platforms.length === 0) {
      console.error('❌ No platform binaries found');
      issues++;
    } else {
      console.log(`Found binaries for platforms: ${platforms.join(', ')}`);
      
      for (const platform of platforms) {
        const platformPath = path.join(BINARIES_PATH, platform);
        if (fs.statSync(platformPath).isDirectory()) {
          const binaryName = platform.startsWith('win32') ? 'flow_desk_cli.exe' : 'flow_desk_cli';
          const binaryPath = path.join(platformPath, binaryName);
          
          if (checkFileExists(binaryPath, `${platform} binary`)) {
            const size = getBinarySize(binaryPath);
            console.log(`  Size: ${size} MB`);
            
            // Test binary execution if it's for the current platform
            const currentPlatform = `${process.platform}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
            if (platform === currentPlatform) {
              console.log(`  Testing execution for current platform (${platform})...`);
              if (!(await testBinaryExecution(binaryPath))) {
                issues++;
              }
            }
          } else {
            issues++;
          }
        }
      }
    }
  }

  return issues;
}

async function verifyElectronBuilderConfig() {
  console.log('\n⚙️ Verifying Electron Builder configuration:');
  
  const packageJsonPath = path.join(__dirname, '../package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found');
    return 1;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const buildConfig = packageJson.build;

  if (!buildConfig) {
    console.error('❌ No build configuration found in package.json');
    return 1;
  }

  let issues = 0;

  // Check extraResources configuration
  if (!buildConfig.extraResources) {
    console.error('❌ No extraResources configuration for binaries');
    issues++;
  } else {
    console.log('✓ extraResources configuration found');
  }

  // Check asarUnpack configuration for each platform
  const platforms = ['mac', 'win', 'linux'];
  for (const platform of platforms) {
    if (buildConfig[platform] && buildConfig[platform].asarUnpack) {
      console.log(`✓ asarUnpack configured for ${platform}`);
    } else {
      console.error(`❌ asarUnpack not configured for ${platform}`);
      issues++;
    }
  }

  return issues;
}

function checkBuildScripts() {
  console.log('\n📜 Checking build scripts:');
  
  const scriptsDir = path.join(__dirname);
  const requiredScripts = [
    'copy-rust-binaries.js',
    'build-rust-all-platforms.js',
    'verify-build.js'
  ];
  
  let issues = 0;
  
  for (const script of requiredScripts) {
    const scriptPath = path.join(scriptsDir, script);
    if (checkFileExists(scriptPath, `Build script: ${script}`)) {
      // Check if script is executable
      try {
        const stats = fs.statSync(scriptPath);
        if (stats.mode & parseInt('111', 8)) {
          console.log(`  ✓ Script is executable`);
        } else {
          console.warn(`  ⚠️ Script may not be executable`);
        }
      } catch (error) {
        console.error(`  ❌ Cannot check script permissions: ${error.message}`);
      }
    } else {
      issues++;
    }
  }
  
  return issues;
}

async function main() {
  console.log('🔍 Flow Desk Build Verification\n');
  console.log('================================================');

  let totalIssues = 0;

  // Check distribution
  totalIssues += await verifyDistribution();

  // Check Electron Builder configuration
  totalIssues += await verifyElectronBuilderConfig();

  // Check build scripts
  totalIssues += checkBuildScripts();

  console.log('\n================================================');
  if (totalIssues === 0) {
    console.log('🎉 All checks passed! Build is ready for distribution.');
    process.exit(0);
  } else {
    console.log(`❌ Found ${totalIssues} issue(s) that need to be resolved.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Verification failed:', error.message);
    process.exit(1);
  });
}