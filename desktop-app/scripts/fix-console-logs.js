#!/usr/bin/env node

/**
 * Automatic Console Statement Replacement Script
 * 
 * Replaces console.log/warn/error with proper logging in production code
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let totalFixed = 0;
let filesProcessed = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Check if this is a main process file or renderer file
  const isMainProcess = filePath.includes('/main/') || filePath.includes('\\main\\');
  const isRenderer = filePath.includes('/renderer/') || filePath.includes('\\renderer\\');
  
  // Skip if file already has proper logging
  const hasElectronLog = content.includes('import log from \'electron-log\'') || 
                        content.includes('import log from "electron-log"');
  
  const hasLogStub = content.includes('const log = {');
  
  if (isMainProcess && !hasElectronLog) {
    // Add electron-log import for main process files
    const importMatch = content.match(/^import .* from ['"].*['"];/m);
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
      content = content.slice(0, lastImportIndex) + 
                '\nimport log from \'electron-log\';' + 
                content.slice(lastImportIndex);
    } else {
      // Add at the beginning if no imports found
      content = 'import log from \'electron-log\';\n\n' + content;
    }
    
    // Replace console statements in main process
    content = content.replace(/console\.log\(/g, 'log.info(');
    content = content.replace(/console\.warn\(/g, 'log.warn(');
    content = content.replace(/console\.error\(/g, 'log.error(');
    content = content.replace(/console\.debug\(/g, 'log.debug(');
    content = content.replace(/console\.info\(/g, 'log.info(');
    
  } else if (isRenderer && !hasLogStub) {
    // Add logging stub for renderer process files
    const logStub = `
// Logging stub for renderer process
const log = {
  error: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[${path.basename(filePath, path.extname(filePath))}]', message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[${path.basename(filePath, path.extname(filePath))}]', message, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[${path.basename(filePath, path.extname(filePath))}]', message, ...args);
    }
  },
  debug: () => {}, // No-op
};
`;
    
    // Find a good place to insert the logging stub
    const importMatch = content.match(/^import .* from ['"].*['"];/m);
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
      content = content.slice(0, lastImportIndex) + logStub + content.slice(lastImportIndex);
    } else {
      content = logStub + '\n' + content;
    }
    
    // Replace console statements in renderer
    content = content.replace(/console\.log\(/g, 'log.info(');
    content = content.replace(/console\.warn\(/g, 'log.warn(');
    content = content.replace(/console\.error\(/g, 'log.error(');
    content = content.replace(/console\.debug\(/g, 'log.debug(');
    content = content.replace(/console\.info\(/g, 'log.info(');
  } else if (!isMainProcess && !isRenderer) {
    // For other files (lib, shared, etc.), wrap in environment checks
    content = content.replace(
      /console\.log\((.*?)\);/g,
      'if (process.env.NODE_ENV === \'development\') { console.log($1); }'
    );
    content = content.replace(
      /console\.warn\((.*?)\);/g,
      'if (process.env.NODE_ENV === \'development\') { console.warn($1); }'
    );
    content = content.replace(
      /console\.error\((.*?)\);/g,
      'if (process.env.NODE_ENV !== \'production\') { console.error($1); }'
    );
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixed++;
    console.log(`${colors.green}✓${colors.reset} Fixed: ${filePath.replace(process.cwd(), '.')}`);
    return true;
  }
  
  return false;
}

function processDirectory(dirPath, extensions = ['.ts', '.tsx']) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip certain directories
      if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
        processDirectory(fullPath, extensions);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(fullPath);
      if (extensions.includes(ext)) {
        // Skip test files and type definitions
        if (!fullPath.includes('.test.') && 
            !fullPath.includes('.spec.') && 
            !fullPath.includes('.d.ts')) {
          filesProcessed++;
          fixFile(fullPath);
        }
      }
    }
  }
}

// Main execution
console.log('🔧 Fixing Console Statements in Production Code\n');

const srcDir = path.join(__dirname, '..', 'src');
processDirectory(srcDir);

console.log('\n' + '='.repeat(50));
console.log(`${colors.green}✓ Processed ${filesProcessed} files${colors.reset}`);
console.log(`${colors.green}✓ Fixed ${totalFixed} files${colors.reset}`);
console.log('\nConsole statements have been replaced with proper logging.');
console.log('Please review the changes and test thoroughly.\n');