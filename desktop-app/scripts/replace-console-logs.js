#!/usr/bin/env node

/**
 * Replace Console Logs Script for Flow Desk
 * 
 * This script systematically replaces all console.log, console.error, console.warn, etc.
 * statements with proper logging using the Flow Desk logging system.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const BACKUP_DIR = path.join(__dirname, '..', 'console-logs-backup');

// File patterns to process
const FILE_PATTERNS = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'src/**/*.js',
  'src/**/*.jsx'
];

// Patterns to exclude
const EXCLUDE_PATTERNS = [
  'src/main/logging/**',
  'src/renderer/logging/**',
  'src/preload/PreloadLogger.ts',
  'scripts/**',
  'dist/**',
  'node_modules/**',
  '**/*.test.*',
  '**/*.spec.*'
];

// Replacement patterns for different file types
const REPLACEMENTS = {
  // Main process files
  main: {
    import: "import { createLogger } from '../shared/logging/LoggerFactory';",
    loggerInit: "const logger = createLogger('ComponentName');",
    patterns: [
      {
        regex: /console\.error\(([^)]+)\)/g,
        replacement: "logger.error('Console error', undefined, { originalArgs: [$1], method: 'console.error' })"
      },
      {
        regex: /console\.warn\(([^)]+)\)/g,
        replacement: "logger.warn('Console warning', undefined, { originalArgs: [$1], method: 'console.warn' })"
      },
      {
        regex: /console\.info\(([^)]+)\)/g,
        replacement: "logger.info('Console info', undefined, { originalArgs: [$1], method: 'console.info' })"
      },
      {
        regex: /console\.log\(([^)]+)\)/g,
        replacement: "logger.debug('Console log', undefined, { originalArgs: [$1], method: 'console.log' })"
      },
      {
        regex: /console\.debug\(([^)]+)\)/g,
        replacement: "logger.debug('Console debug', undefined, { originalArgs: [$1], method: 'console.debug' })"
      },
      {
        regex: /console\.trace\(([^)]+)\)/g,
        replacement: "logger.trace('Console trace', undefined, { originalArgs: [$1], method: 'console.trace' })"
      }
    ]
  },
  
  // Renderer process files
  renderer: {
    import: "import { useLogger } from '../logging/RendererLoggingService';",
    hookUsage: "const logger = useLogger('ComponentName');",
    patterns: [
      {
        regex: /console\.error\(([^)]+)\)/g,
        replacement: "logger.error('Console error', undefined, { originalArgs: [$1], method: 'console.error' })"
      },
      {
        regex: /console\.warn\(([^)]+)\)/g,
        replacement: "logger.warn('Console warning', undefined, { originalArgs: [$1], method: 'console.warn' })"
      },
      {
        regex: /console\.info\(([^)]+)\)/g,
        replacement: "logger.info('Console info', undefined, { originalArgs: [$1], method: 'console.info' })"
      },
      {
        regex: /console\.log\(([^)]+)\)/g,
        replacement: "logger.debug('Console log', undefined, { originalArgs: [$1], method: 'console.log' })"
      },
      {
        regex: /console\.debug\(([^)]+)\)/g,
        replacement: "logger.debug('Console debug', undefined, { originalArgs: [$1], method: 'console.debug' })"
      },
      {
        regex: /console\.trace\(([^)]+)\)/g,
        replacement: "logger.trace('Console trace', undefined, { originalArgs: [$1], method: 'console.trace' })"
      }
    ]
  },
  
  // Preload process files
  preload: {
    import: "import { createLogger } from '../shared/logging/LoggerFactory';",
    loggerInit: "const logger = createLogger('ComponentName');",
    patterns: [
      {
        regex: /console\.error\(([^)]+)\)/g,
        replacement: "logger.error('Console error', undefined, { originalArgs: [$1], method: 'console.error' })"
      },
      {
        regex: /console\.warn\(([^)]+)\)/g,
        replacement: "logger.warn('Console warning', undefined, { originalArgs: [$1], method: 'console.warn' })"
      },
      {
        regex: /console\.info\(([^)]+)\)/g,
        replacement: "logger.info('Console info', undefined, { originalArgs: [$1], method: 'console.info' })"
      },
      {
        regex: /console\.log\(([^)]+)\)/g,
        replacement: "logger.debug('Console log', undefined, { originalArgs: [$1], method: 'console.log' })"
      },
      {
        regex: /console\.debug\(([^)]+)\)/g,
        replacement: "logger.debug('Console debug', undefined, { originalArgs: [$1], method: 'console.debug' })"
      },
      {
        regex: /console\.trace\(([^)]+)\)/g,
        replacement: "logger.trace('Console trace', undefined, { originalArgs: [$1], method: 'console.trace' })"
      }
    ]
  }
};

/**
 * Determine file type and return appropriate replacement config
 */
function getReplacementConfig(filePath) {
  if (filePath.includes('/main/')) return 'main';
  if (filePath.includes('/renderer/')) return 'renderer';
  if (filePath.includes('/preload/')) return 'preload';
  return 'renderer'; // Default fallback
}

/**
 * Check if file has console statements
 */
function hasConsoleStatements(content) {
  return /console\.(log|error|warn|info|debug|trace)/.test(content);
}

/**
 * Add import statement if not present
 */
function addImportIfNeeded(content, filePath, config) {
  const configType = getReplacementConfig(filePath);
  const replacement = REPLACEMENTS[configType];
  
  if (!replacement.import) return content;
  
  // Check if import already exists
  if (content.includes(replacement.import.split("'")[1])) {
    return content;
  }
  
  // Find the right place to add import
  const lines = content.split('\n');
  let insertIndex = 0;
  
  // Find last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('const ') && lines[i].includes(' = require(')) {
      insertIndex = i + 1;
    }
  }
  
  lines.splice(insertIndex, 0, replacement.import);
  return lines.join('\n');
}

/**
 * Replace console statements in file content
 */
function replaceConsoleStatements(content, filePath) {
  const configType = getReplacementConfig(filePath);
  const replacement = REPLACEMENTS[configType];
  
  let modifiedContent = content;
  
  // Apply all replacement patterns
  for (const pattern of replacement.patterns) {
    modifiedContent = modifiedContent.replace(pattern.regex, pattern.replacement);
  }
  
  // Add import if we made changes and file has console statements
  if (modifiedContent !== content) {
    modifiedContent = addImportIfNeeded(modifiedContent, filePath, replacement);
  }
  
  return modifiedContent;
}

/**
 * Create backup of original file
 */
function createBackup(filePath, content) {
  const relativePath = path.relative(SRC_DIR, filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  fs.writeFileSync(backupPath, content, 'utf8');
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    console.log(`Processing: ${path.relative(process.cwd(), filePath)}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!hasConsoleStatements(content)) {
      console.log(`  No console statements found`);
      return { processed: false, hasConsole: false };
    }
    
    // Create backup
    createBackup(filePath, content);
    
    // Replace console statements
    const modifiedContent = replaceConsoleStatements(content, filePath);
    
    if (modifiedContent !== content) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      console.log(`  ✅ Replaced console statements`);
      return { processed: true, hasConsole: true };
    } else {
      console.log(`  ⚠️  Had console statements but no replacements made`);
      return { processed: false, hasConsole: true };
    }
    
  } catch (error) {
    console.error(`  ❌ Error processing file: ${error.message}`);
    return { processed: false, hasConsole: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting console.log replacement process...\n');
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}\n`);
  }
  
  // Get all files to process
  const files = [];
  for (const pattern of FILE_PATTERNS) {
    const matchedFiles = glob.sync(pattern, { 
      ignore: EXCLUDE_PATTERNS,
      cwd: path.join(__dirname, '..'),
      absolute: true
    });
    files.push(...matchedFiles);
  }
  
  console.log(`📝 Found ${files.length} files to process\n`);
  
  // Process each file
  const stats = {
    total: files.length,
    processed: 0,
    hasConsole: 0,
    errors: 0
  };
  
  for (const file of files) {
    const result = processFile(file);
    
    if (result.processed) stats.processed++;
    if (result.hasConsole) stats.hasConsole++;
    if (result.error) stats.errors++;
  }
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log(`  Total files scanned: ${stats.total}`);
  console.log(`  Files with console statements: ${stats.hasConsole}`);
  console.log(`  Files successfully processed: ${stats.processed}`);
  console.log(`  Errors: ${stats.errors}`);
  
  if (stats.processed > 0) {
    console.log(`\n✅ Successfully replaced console statements in ${stats.processed} files`);
    console.log(`📁 Original files backed up to: ${BACKUP_DIR}`);
  }
  
  if (stats.errors > 0) {
    console.log(`\n⚠️  ${stats.errors} files had errors during processing`);
  }
  
  console.log('\n🎉 Console log replacement complete!');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { replaceConsoleStatements, processFile, main };