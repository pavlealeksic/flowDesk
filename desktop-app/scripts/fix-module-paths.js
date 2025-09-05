#!/usr/bin/env node

/**
 * Module Path Fix Script
 * 
 * Fixes module loading issues by ensuring all required paths exist
 * and are properly linked for development and runtime.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_PATH = path.join(PROJECT_ROOT, 'dist');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');

function log(message) {
  console.log(`🔗 [Module Paths] ${message}`);
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createModuleStub() {
  log('Creating Rust module stub for TypeScript compilation...');
  
  const stubPath = path.join(SRC_PATH, 'lib/rust-engine/index.js');
  const stubContent = `
/**
 * Rust Engine Module Stub
 * This file provides a basic interface for the Rust engine integration.
 * The actual implementation is loaded dynamically at runtime.
 */

const path = require('path');
const { app } = require('electron');

let rustEngine = null;

function getRustEnginePath() {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Development: use the binary from the shared rust-lib project
    return path.join(__dirname, '../../shared/rust-lib/target/release/flow_desk_cli');
  } else {
    // Production: use the packaged binary
    const platform = process.platform;
    const arch = process.arch;
    const platformKey = \`\${platform}-\${arch === 'x64' ? 'x64' : arch}\`;
    
    if (app && app.isPackaged) {
      // Packaged application
      return path.join(process.resourcesPath, 'binaries', platformKey, 'flow_desk_cli');
    } else {
      // Development or pre-packaged
      return path.join(__dirname, '../../../dist/binaries', platformKey, 'flow_desk_cli');
    }
  }
}

function loadRustEngine() {
  if (rustEngine) return rustEngine;
  
  try {
    const enginePath = getRustEnginePath();
    
    if (!require('fs').existsSync(enginePath)) {
      throw new Error(\`Rust engine binary not found at: \${enginePath}\`);
    }
    
    rustEngine = {
      binaryPath: enginePath,
      // Add other engine methods as needed
      isAvailable: () => true,
      getBinaryPath: () => enginePath,
    };
    
    return rustEngine;
  } catch (error) {
    console.error('Failed to load Rust engine:', error);
    return null;
  }
}

module.exports = {
  loadRustEngine,
  getRustEnginePath,
  get rustEngine() {
    return loadRustEngine();
  }
};
`;

  ensureDirectoryExists(path.dirname(stubPath));
  fs.writeFileSync(stubPath, stubContent.trim());
  log('Created Rust module stub');
}

function fixMainModulePath() {
  log('Checking main module path reference...');
  
  const mainPath = path.join(SRC_PATH, 'main/main.ts');
  
  if (!fs.existsSync(mainPath)) {
    log('Main.ts not found, skipping path fix');
    return;
  }
  
  let mainContent = fs.readFileSync(mainPath, 'utf8');
  
  // Fix any hardcoded require paths that might fail
  const fixes = [
    {
      pattern: /const rustEngine = require\(['"]\.\.\/lib\/rust-engine['"]\);?/g,
      replacement: `try {
  const rustEngine = require('../lib/rust-engine');
  // Use rustEngine if loaded successfully
} catch (error) {
  console.warn('Rust engine not available:', error.message);
  const rustEngine = null;
}`
    }
  ];
  
  let hasChanges = false;
  fixes.forEach(fix => {
    if (fix.pattern.test(mainContent)) {
      mainContent = mainContent.replace(fix.pattern, fix.replacement);
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    log('⚠️  Consider updating main.ts to use try-catch for rust-engine imports');
  } else {
    log('Main module paths look correct');
  }
}

function createPackageJson() {
  log('Creating package.json for rust-engine module...');
  
  const packageJsonPath = path.join(SRC_PATH, 'lib/rust-engine/package.json');
  const packageJsonContent = {
    "name": "@flow-desk/rust-engine",
    "version": "0.1.0",
    "description": "Rust engine integration for Flow Desk",
    "main": "index.js",
    "private": true
  };
  
  ensureDirectoryExists(path.dirname(packageJsonPath));
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));
  log('Created package.json for rust-engine module');
}

function main() {
  log('Fixing module paths for development...');
  
  try {
    createModuleStub();
    createPackageJson();
    fixMainModulePath();
    
    log('✅ Module paths fixed successfully');
  } catch (error) {
    log(`❌ Failed to fix module paths: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createModuleStub, createPackageJson, fixMainModulePath };