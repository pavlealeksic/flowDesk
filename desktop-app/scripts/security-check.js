#!/usr/bin/env node

/**
 * Security Check Script for Production Builds
 * 
 * Verifies that the codebase is ready for production deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let hasErrors = false;
let hasWarnings = false;

function error(message) {
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
  hasErrors = true;
}

function warning(message) {
  console.warn(`${colors.yellow}⚠ ${message}${colors.reset}`);
  hasWarnings = true;
}

function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function info(message) {
  console.log(`  ${message}`);
}

// Check for console.log statements
function checkConsoleLogs() {
  console.log('\nChecking for console.log statements...');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const files = getAllFiles(srcDir, ['.ts', '.tsx']);
  
  let consoleCount = 0;
  const consoleFiles = [];
  
  for (const file of files) {
    // Skip test files and type definitions
    if (file.includes('.test.') || file.includes('.d.ts') || file.includes('node_modules')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for console statements not in comments
      if (line.match(/console\.(log|warn|error|info|debug)/)) {
        // Check if it's in a development-only block
        const prevLines = lines.slice(Math.max(0, index - 5), index).join('\n');
        if (!prevLines.includes('NODE_ENV') && 
            !prevLines.includes('isDev') && 
            !prevLines.includes('development')) {
          consoleCount++;
          if (!consoleFiles.includes(file)) {
            consoleFiles.push(file.replace(srcDir, '.'));
          }
        }
      }
    });
  }
  
  if (consoleCount > 0) {
    warning(`Found ${consoleCount} console statements in production code`);
    consoleFiles.forEach(file => info(file));
  } else {
    success('No console statements found in production code');
  }
}

// Check for hardcoded credentials
function checkHardcodedCredentials() {
  console.log('\nChecking for hardcoded credentials...');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const files = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
  
  const patterns = [
    /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
    /secret\s*[:=]\s*["'][^"']+["']/gi,
    /password\s*[:=]\s*["'][^"']+["']/gi,
    /token\s*[:=]\s*["'][^"']+["']/gi,
    /private[_-]?key\s*[:=]\s*["'][^"']+["']/gi
  ];
  
  const excludePatterns = [
    'process.env',
    'import.meta.env',
    'getenv',
    'config.',
    'settings.',
    ': string',
    '?:',
    'interface',
    'type ',
    'example',
    'placeholder'
  ];
  
  let credentialCount = 0;
  const credentialFiles = [];
  
  for (const file of files) {
    // Skip test files and node_modules
    if (file.includes('.test.') || file.includes('node_modules') || file.includes('.d.ts')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        const matches = line.match(pattern);
        if (matches) {
          // Check if it's a safe pattern
          let isSafe = false;
          for (const exclude of excludePatterns) {
            if (line.includes(exclude)) {
              isSafe = true;
              break;
            }
          }
          
          if (!isSafe) {
            credentialCount++;
            const relPath = file.replace(srcDir, '.');
            if (!credentialFiles.includes(relPath)) {
              credentialFiles.push(relPath);
            }
          }
        }
      }
    });
  }
  
  if (credentialCount > 0) {
    error(`Found ${credentialCount} potential hardcoded credentials`);
    credentialFiles.forEach(file => info(file));
  } else {
    success('No hardcoded credentials found');
  }
}

// Check for environment variables
function checkEnvironmentVariables() {
  console.log('\nChecking environment configuration...');
  
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envExamplePath)) {
    warning('No .env.example file found');
  } else {
    success('.env.example file exists');
    
    // Check for required variables
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    const requiredVars = [
      'NODE_ENV',
      'ENCRYPTION_KEY'
    ];
    
    for (const varName of requiredVars) {
      if (!envContent.includes(varName)) {
        warning(`Missing ${varName} in .env.example`);
      }
    }
  }
  
  // Check that .env is in gitignore
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.env')) {
      error('.env file is not in .gitignore');
    } else {
      success('.env file is properly gitignored');
    }
  }
}

// Check for proper error handling
function checkErrorHandling() {
  console.log('\nChecking error handling...');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const files = getAllFiles(srcDir, ['.ts', '.tsx']);
  
  let unhandledPromises = 0;
  let emptyCatchBlocks = 0;
  
  for (const file of files) {
    if (file.includes('.test.') || file.includes('node_modules')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for unhandled async/await
    const asyncMatches = content.match(/await\s+[^;]+(?!\.catch)/g) || [];
    unhandledPromises += asyncMatches.length;
    
    // Check for empty catch blocks
    const catchMatches = content.match(/catch\s*\([^)]*\)\s*{\s*}/g) || [];
    emptyCatchBlocks += catchMatches.length;
  }
  
  if (emptyCatchBlocks > 0) {
    warning(`Found ${emptyCatchBlocks} empty catch blocks`);
  }
  
  success('Error handling check completed');
}

// Check dependencies for known vulnerabilities
function checkDependencies() {
  console.log('\nChecking dependencies for vulnerabilities...');
  
  try {
    const output = execSync('npm audit --json', { encoding: 'utf8' });
    const audit = JSON.parse(output);
    
    if (audit.metadata.vulnerabilities.critical > 0) {
      error(`Found ${audit.metadata.vulnerabilities.critical} critical vulnerabilities`);
    } else if (audit.metadata.vulnerabilities.high > 0) {
      warning(`Found ${audit.metadata.vulnerabilities.high} high severity vulnerabilities`);
    } else if (audit.metadata.vulnerabilities.moderate > 0) {
      info(`Found ${audit.metadata.vulnerabilities.moderate} moderate severity vulnerabilities`);
    } else {
      success('No high or critical vulnerabilities found');
    }
  } catch (error) {
    warning('Could not run npm audit');
  }
}

// Helper function to recursively get all files
function getAllFiles(dirPath, extensions) {
  const files = [];
  
  function scanDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDir(dirPath);
  return files;
}

// Main execution
console.log('🔒 Running Security Check for Production Build\n');

checkConsoleLogs();
checkHardcodedCredentials();
checkEnvironmentVariables();
checkErrorHandling();
checkDependencies();

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.error(`\n${colors.red}Security check failed with errors.${colors.reset}`);
  console.error('Please fix the issues before deploying to production.\n');
  process.exit(1);
} else if (hasWarnings) {
  console.warn(`\n${colors.yellow}Security check completed with warnings.${colors.reset}`);
  console.warn('Review the warnings and ensure they are acceptable.\n');
} else {
  console.log(`\n${colors.green}Security check passed successfully!${colors.reset}`);
  console.log('The application is ready for production deployment.\n');
}

process.exit(0);