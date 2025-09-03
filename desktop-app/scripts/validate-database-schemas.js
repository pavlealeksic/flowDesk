#!/usr/bin/env node

/**
 * Database Schema Validation Script
 * 
 * Validates that the database schemas are syntactically correct and functional.
 * This script can be run as part of CI/CD to ensure database changes don't break.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  switch(level) {
    case 'success':
      console.log(`${colors.green}✓${colors.reset} ${message}`);
      break;
    case 'error':
      console.log(`${colors.red}✗${colors.reset} ${message}`);
      break;
    case 'info':
      console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
      break;
    case 'warn':
      console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
      break;
    default:
      console.log(`  ${message}`);
  }
}

/**
 * Complete Mail Database Schema (matches database-initialization-service.ts)
 */
const MAIL_SCHEMA = `
  -- Enable foreign key support
  PRAGMA foreign_keys = ON;
  
  -- Mail accounts table
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    provider TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    imap_config TEXT,
    smtp_config TEXT,
    oauth_tokens TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Mail messages table
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    thread_id TEXT,
    subject TEXT NOT NULL,
    from_address TEXT NOT NULL,
    from_name TEXT NOT NULL,
    to_addresses TEXT NOT NULL,
    cc_addresses TEXT NOT NULL,
    bcc_addresses TEXT NOT NULL,
    reply_to TEXT,
    body_text TEXT,
    body_html TEXT,
    is_read BOOLEAN NOT NULL DEFAULT 0,
    is_starred BOOLEAN NOT NULL DEFAULT 0,
    is_important BOOLEAN NOT NULL DEFAULT 0,
    has_attachments BOOLEAN NOT NULL DEFAULT 0,
    received_at DATETIME NOT NULL,
    sent_at DATETIME,
    labels TEXT NOT NULL DEFAULT '[]',
    message_id TEXT,
    in_reply_to TEXT,
    message_references TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  -- Mail folders table
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    folder_type TEXT NOT NULL,
    parent_id TEXT,
    path TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT '[]',
    message_count INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0,
    is_selectable BOOLEAN NOT NULL DEFAULT 1,
    can_select BOOLEAN NOT NULL DEFAULT 1,
    last_sync_at DATETIME,
    is_being_synced BOOLEAN NOT NULL DEFAULT 0,
    sync_progress REAL,
    sync_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  -- Mail threads table
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message_ids TEXT NOT NULL DEFAULT '[]',
    participants TEXT NOT NULL DEFAULT '[]',
    labels TEXT NOT NULL DEFAULT '[]',
    has_unread BOOLEAN NOT NULL DEFAULT 0,
    has_starred BOOLEAN NOT NULL DEFAULT 0,
    has_important BOOLEAN NOT NULL DEFAULT 0,
    has_attachments BOOLEAN NOT NULL DEFAULT 0,
    last_message_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  -- Create performance indexes
  CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages (account_id, folder);
  CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages (received_at);
  CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id);
  CREATE INDEX IF NOT EXISTS idx_folders_account_path ON folders (account_id, path);
  CREATE INDEX IF NOT EXISTS idx_threads_account_last_message ON threads (account_id, last_message_at);

  -- Schema version tracking
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR REPLACE INTO schema_version (version) VALUES (1);
`;

/**
 * Complete Calendar Database Schema (matches database-initialization-service.ts)
 */
const CALENDAR_SCHEMA = `
  -- Enable foreign key support
  PRAGMA foreign_keys = ON;
  
  -- Calendar accounts table
  CREATE TABLE IF NOT EXISTS calendar_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'exchange', 'caldav', 'icloud', 'fastmail')),
    config TEXT NOT NULL,
    credentials TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'auth_error', 'quota_exceeded', 'suspended', 'disabled', 'error')),
    default_calendar_id TEXT,
    last_sync_at DATETIME,
    next_sync_at DATETIME,
    sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email, provider)
  );

  -- Calendars table
  CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3174ad',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    is_primary BOOLEAN NOT NULL DEFAULT 0,
    access_level TEXT NOT NULL DEFAULT 'reader' CHECK (access_level IN ('owner', 'writer', 'reader', 'freeBusyReader')),
    is_visible BOOLEAN NOT NULL DEFAULT 1,
    can_sync BOOLEAN NOT NULL DEFAULT 1,
    calendar_type TEXT NOT NULL DEFAULT 'secondary' CHECK (calendar_type IN ('primary', 'secondary', 'shared', 'public', 'resource', 'holiday', 'birthdays')),
    is_selected BOOLEAN NOT NULL DEFAULT 1,
    last_sync_at DATETIME,
    is_being_synced BOOLEAN NOT NULL DEFAULT 0,
    sync_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES calendar_accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, provider_id)
  );

  -- Calendar events table
  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    calendar_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    location_data TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    timezone TEXT,
    is_all_day BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    visibility TEXT NOT NULL DEFAULT 'default' CHECK (visibility IN ('default', 'public', 'private', 'confidential')),
    creator TEXT,
    organizer TEXT,
    attendees TEXT NOT NULL DEFAULT '[]',
    recurrence TEXT,
    recurring_event_id TEXT,
    original_start_time DATETIME,
    reminders TEXT NOT NULL DEFAULT '[]',
    conferencing TEXT,
    attachments TEXT NOT NULL DEFAULT '[]',
    extended_properties TEXT,
    source TEXT,
    color TEXT,
    transparency TEXT NOT NULL DEFAULT 'opaque' CHECK (transparency IN ('opaque', 'transparent')),
    uid TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0,
    sync_hash TEXT,
    privacy_sync_marker TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
    FOREIGN KEY (recurring_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
    UNIQUE(calendar_id, provider_id)
  );

  -- Privacy sync rules table
  CREATE TABLE IF NOT EXISTS privacy_sync_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    source_calendar_ids TEXT NOT NULL,
    target_calendar_ids TEXT NOT NULL,
    privacy_settings TEXT NOT NULL,
    filters TEXT,
    sync_window TEXT NOT NULL,
    is_bidirectional BOOLEAN NOT NULL DEFAULT 0,
    advanced_mode BOOLEAN NOT NULL DEFAULT 0,
    last_sync_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
  );

  -- Create performance indexes
  CREATE INDEX IF NOT EXISTS idx_calendar_accounts_user_id ON calendar_accounts (user_id);
  CREATE INDEX IF NOT EXISTS idx_calendar_accounts_status ON calendar_accounts (status);
  CREATE INDEX IF NOT EXISTS idx_calendar_accounts_next_sync_at ON calendar_accounts (next_sync_at);
  CREATE INDEX IF NOT EXISTS idx_calendars_account_id ON calendars (account_id);
  CREATE INDEX IF NOT EXISTS idx_calendars_is_selected ON calendars (is_selected);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events (calendar_id);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events (start_time);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events (end_time);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range ON calendar_events (start_time, end_time);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_uid ON calendar_events (uid);
  CREATE INDEX IF NOT EXISTS idx_privacy_sync_rules_user_id ON privacy_sync_rules (user_id);
  CREATE INDEX IF NOT EXISTS idx_privacy_sync_rules_is_enabled ON privacy_sync_rules (is_enabled);

  -- Schema version tracking
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR REPLACE INTO schema_version (version) VALUES (1);
`;

/**
 * Validate a database schema
 */
async function validateSchema(dbName, schema) {
  return new Promise((resolve, reject) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowdesk-validate-'));
    const dbPath = path.join(tempDir, `${dbName}.db`);
    
    console.log(`\n${colors.bright}${colors.cyan}Validating ${dbName} Database${colors.reset}`);
    console.log('═'.repeat(40));
    
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        log('error', `Failed to create database: ${err.message}`);
        reject(err);
        return;
      }
      
      log('success', `Created ${dbName}.db`);
      
      // Execute schema
      db.exec(schema, (err) => {
        if (err) {
          log('error', `Schema creation failed: ${err.message}`);
          db.close();
          fs.rmSync(tempDir, { recursive: true, force: true });
          reject(err);
          return;
        }
        
        log('success', 'Schema created successfully');
        
        // Run validation checks
        const checks = [];
        
        // Check 1: Verify foreign keys are enabled
        checks.push(new Promise((res, rej) => {
          db.get('PRAGMA foreign_keys', (err, row) => {
            if (err) {
              log('error', `Foreign key check failed: ${err.message}`);
              rej(err);
            } else if (row.foreign_keys === 1) {
              log('success', 'Foreign keys enabled');
              res();
            } else {
              log('warn', 'Foreign keys not enabled');
              res();
            }
          });
        }));
        
        // Check 2: Verify tables exist
        checks.push(new Promise((res, rej) => {
          db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, rows) => {
            if (err) {
              log('error', `Table enumeration failed: ${err.message}`);
              rej(err);
            } else {
              log('success', `${rows.length} tables created`);
              rows.forEach(row => {
                log('', `  • ${row.name}`);
              });
              res();
            }
          });
        }));
        
        // Check 3: Verify indexes exist
        checks.push(new Promise((res, rej) => {
          db.all("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, rows) => {
            if (err) {
              log('error', `Index enumeration failed: ${err.message}`);
              rej(err);
            } else {
              log('success', `${rows.length} indexes created`);
              res();
            }
          });
        }));
        
        // Check 4: Run integrity check
        checks.push(new Promise((res, rej) => {
          db.get('PRAGMA integrity_check', (err, row) => {
            if (err) {
              log('error', `Integrity check failed: ${err.message}`);
              rej(err);
            } else if (row.integrity_check === 'ok') {
              log('success', 'Database integrity check passed');
              res();
            } else {
              log('error', `Integrity check failed: ${row.integrity_check}`);
              rej(new Error(row.integrity_check));
            }
          });
        }));
        
        // Check 5: Test sample operations
        checks.push(new Promise((res, rej) => {
          if (dbName === 'mail') {
            // Test mail database operations
            db.serialize(() => {
              // Insert test account
              db.run("INSERT INTO accounts (id, email, provider, display_name) VALUES ('test1', 'test@example.com', 'imap', 'Test User')", (err) => {
                if (err) {
                  log('error', `Failed to insert test account: ${err.message}`);
                  rej(err);
                  return;
                }
                
                // Insert test message
                db.run("INSERT INTO messages (id, account_id, provider_id, folder, subject, from_address, from_name, to_addresses, cc_addresses, bcc_addresses, received_at) VALUES ('msg1', 'test1', 'prov1', 'INBOX', 'Test', 'from@test.com', 'Sender', 'to@test.com', '', '', datetime('now'))", (err) => {
                  if (err) {
                    log('error', `Failed to insert test message: ${err.message}`);
                    rej(err);
                  } else {
                    log('success', 'Sample data operations successful');
                    res();
                  }
                });
              });
            });
          } else if (dbName === 'calendar') {
            // Test calendar database operations
            db.serialize(() => {
              // Insert test account
              db.run("INSERT INTO calendar_accounts (id, user_id, name, email, provider, config) VALUES ('cal1', 'user1', 'Test Calendar', 'test@example.com', 'google', '{}')", (err) => {
                if (err) {
                  log('error', `Failed to insert test calendar account: ${err.message}`);
                  rej(err);
                  return;
                }
                
                // Insert test calendar
                db.run("INSERT INTO calendars (id, account_id, provider_id, name) VALUES ('c1', 'cal1', 'prov1', 'My Calendar')", (err) => {
                  if (err) {
                    log('error', `Failed to insert test calendar: ${err.message}`);
                    rej(err);
                  } else {
                    log('success', 'Sample data operations successful');
                    res();
                  }
                });
              });
            });
          } else {
            res();
          }
        }));
        
        // Execute all checks
        Promise.all(checks)
          .then(() => {
            db.close(() => {
              log('success', `${dbName} database validation complete`);
              fs.rmSync(tempDir, { recursive: true, force: true });
              resolve();
            });
          })
          .catch((err) => {
            db.close(() => {
              fs.rmSync(tempDir, { recursive: true, force: true });
              reject(err);
            });
          });
      });
    });
  });
}

/**
 * Main validation function
 */
async function main() {
  console.log(`\n${colors.bright}${colors.blue}FlowDesk Database Schema Validator${colors.reset}`);
  console.log('━'.repeat(40));
  
  try {
    // Validate mail database
    await validateSchema('mail', MAIL_SCHEMA);
    
    // Validate calendar database
    await validateSchema('calendar', CALENDAR_SCHEMA);
    
    console.log(`\n${colors.bright}${colors.green}✅ All database schemas are valid!${colors.reset}\n`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}❌ Schema validation failed!${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
}

// Check for sqlite3 module
try {
  require('sqlite3');
  main();
} catch (error) {
  console.error(`${colors.red}Error: sqlite3 module is not installed.${colors.reset}`);
  console.error('Please run: npm install sqlite3');
  process.exit(1);
}