"use strict";
/**
 * Email Scheduler Service
 *
 * Manages scheduled emails, snoozing, and automated email delivery.
 * Uses SQLite database for persistence and integrates with system timer.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailScheduler = void 0;
const electron_1 = require("electron");
const path_1 = require("path");
const electron_log_1 = __importDefault(require("electron-log"));
class EmailScheduler {
    constructor() {
        this.db = null;
        this.timers = new Map();
        this.isInitialized = false;
        const userDataPath = electron_1.app.getPath('userData');
        this.dbPath = (0, path_1.join)(userDataPath, 'email_scheduler.db');
    }
    /**
     * Initialize the email scheduler service
     */
    async initialize() {
        try {
            electron_log_1.default.info('Initializing Email Scheduler service...');
            // Initialize database
            await this.initializeDatabase();
            // Load and schedule existing emails
            await this.loadScheduledEmails();
            this.isInitialized = true;
            electron_log_1.default.info('Email Scheduler service initialized successfully');
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize Email Scheduler service:', error);
            return false;
        }
    }
    /**
     * Initialize SQLite database with required tables
     */
    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            try {
                const sqlite3 = require('sqlite3').verbose();
                this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                    if (err) {
                        electron_log_1.default.error('Failed to connect to email scheduler database:', err);
                        reject(err);
                        return;
                    }
                    // Create scheduled emails table
                    const createScheduledEmailsTable = `
            CREATE TABLE IF NOT EXISTS scheduled_emails (
              id TEXT PRIMARY KEY,
              to_addresses TEXT NOT NULL,
              cc_addresses TEXT,
              bcc_addresses TEXT,
              subject TEXT NOT NULL,
              body TEXT NOT NULL,
              scheduled_time INTEGER NOT NULL,
              scheduled_for INTEGER NOT NULL,
              account_id TEXT NOT NULL,
              attachments TEXT,
              status TEXT NOT NULL DEFAULT 'scheduled',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              attempts INTEGER DEFAULT 0,
              last_error TEXT
            )
          `;
                    // Create snoozed emails table
                    const createSnoozedEmailsTable = `
            CREATE TABLE IF NOT EXISTS snoozed_emails (
              id TEXT PRIMARY KEY,
              message_id TEXT NOT NULL,
              account_id TEXT NOT NULL,
              snooze_until INTEGER NOT NULL,
              reason TEXT NOT NULL,
              created_at INTEGER NOT NULL
            )
          `;
                    // Create indexes for performance
                    const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_emails(scheduled_time, status);
            CREATE INDEX IF NOT EXISTS idx_account_id ON scheduled_emails(account_id);
            CREATE INDEX IF NOT EXISTS idx_snooze_until ON snoozed_emails(snooze_until);
          `;
                    this.db.exec(createScheduledEmailsTable, (err) => {
                        if (err) {
                            reject(new Error(`Failed to create scheduled_emails table: ${err.message}`));
                            return;
                        }
                        this.db.exec(createSnoozedEmailsTable, (err) => {
                            if (err) {
                                reject(new Error(`Failed to create snoozed_emails table: ${err.message}`));
                                return;
                            }
                            this.db.exec(createIndexes, (err) => {
                                if (err) {
                                    electron_log_1.default.warn('Failed to create database indexes:', err);
                                }
                                resolve();
                            });
                        });
                    });
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Load existing scheduled emails and set up timers
     */
    async loadScheduledEmails() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT * FROM scheduled_emails 
        WHERE status = 'scheduled' AND scheduled_time > ?
        ORDER BY scheduled_time ASC
      `;
            this.db.all(sql, [Date.now()], (err, rows) => {
                if (err) {
                    reject(new Error(`Failed to load scheduled emails: ${err.message}`));
                    return;
                }
                if (!rows) {
                    resolve();
                    return;
                }
                rows.forEach(row => {
                    const scheduledEmail = this.mapRowToScheduledEmail(row);
                    this.scheduleEmailTimer(scheduledEmail);
                });
                electron_log_1.default.info(`Loaded ${rows.length} scheduled emails`);
                resolve();
            });
        });
    }
    /**
     * Schedule a new email
     */
    async scheduleEmail(emailData) {
        if (!this.isInitialized || !this.db) {
            electron_log_1.default.error('Email scheduler not initialized');
            return null;
        }
        try {
            const id = this.generateId();
            const now = Date.now();
            const scheduledEmail = {
                ...emailData,
                id,
                status: 'scheduled',
                createdAt: new Date(now),
                updatedAt: new Date(now),
                attempts: 0
            };
            await this.saveScheduledEmail(scheduledEmail);
            this.scheduleEmailTimer(scheduledEmail);
            electron_log_1.default.info(`Scheduled email with ID: ${id} for ${scheduledEmail.scheduledTime}`);
            return id;
        }
        catch (error) {
            electron_log_1.default.error('Failed to schedule email:', error);
            return null;
        }
    }
    /**
     * Cancel a scheduled email
     */
    async cancelScheduledEmail(emailId) {
        if (!this.isInitialized || !this.db) {
            return false;
        }
        try {
            // Clear timer if exists
            const timer = this.timers.get(emailId);
            if (timer) {
                clearTimeout(timer);
                this.timers.delete(emailId);
            }
            // Update database status
            return new Promise((resolve) => {
                const sql = 'UPDATE scheduled_emails SET status = ?, updated_at = ? WHERE id = ?';
                this.db.run(sql, ['cancelled', Date.now(), emailId], function (err) {
                    if (err) {
                        electron_log_1.default.error(`Failed to cancel scheduled email ${emailId}:`, err);
                        resolve(false);
                        return;
                    }
                    const success = this.changes > 0;
                    if (success) {
                        electron_log_1.default.info(`Cancelled scheduled email: ${emailId}`);
                    }
                    resolve(success);
                });
            });
        }
        catch (error) {
            electron_log_1.default.error('Failed to cancel scheduled email:', error);
            return false;
        }
    }
    /**
     * Get all scheduled emails
     */
    async getScheduledEmails() {
        if (!this.isInitialized || !this.db) {
            return [];
        }
        return new Promise((resolve) => {
            const sql = `
        SELECT * FROM scheduled_emails 
        WHERE status = 'scheduled'
        ORDER BY scheduled_time ASC
      `;
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    electron_log_1.default.error('Failed to get scheduled emails:', err);
                    resolve([]);
                    return;
                }
                if (!rows) {
                    resolve([]);
                    return;
                }
                const scheduledEmails = rows.map(row => this.mapRowToScheduledEmail(row));
                resolve(scheduledEmails);
            });
        });
    }
    /**
     * Snooze an email until a specific time
     */
    async snoozeEmail(messageId, accountId, snoozeUntil, reason) {
        if (!this.isInitialized || !this.db) {
            return null;
        }
        try {
            const id = this.generateId();
            const snoozedEmail = {
                id,
                messageId,
                accountId,
                snoozeUntil,
                reason,
                createdAt: new Date()
            };
            await this.saveSnoozedEmail(snoozedEmail);
            this.scheduleSnoozedEmailTimer(snoozedEmail);
            electron_log_1.default.info(`Snoozed email ${messageId} until ${snoozeUntil}`);
            return id;
        }
        catch (error) {
            electron_log_1.default.error('Failed to snooze email:', error);
            return null;
        }
    }
    /**
     * Get all snoozed emails
     */
    async getSnoozedEmails() {
        if (!this.isInitialized || !this.db) {
            return [];
        }
        return new Promise((resolve) => {
            const sql = `
        SELECT * FROM snoozed_emails 
        WHERE snooze_until > ?
        ORDER BY snooze_until ASC
      `;
            this.db.all(sql, [Date.now()], (err, rows) => {
                if (err) {
                    electron_log_1.default.error('Failed to get snoozed emails:', err);
                    resolve([]);
                    return;
                }
                if (!rows) {
                    resolve([]);
                    return;
                }
                const snoozedEmails = rows.map(row => this.mapRowToSnoozedEmail(row));
                resolve(snoozedEmails);
            });
        });
    }
    /**
     * Save scheduled email to database
     */
    async saveScheduledEmail(scheduledEmail) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO scheduled_emails (
          id, to_addresses, cc_addresses, bcc_addresses, subject, body,
          scheduled_time, scheduled_for, account_id, attachments,
          status, created_at, updated_at, attempts, last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            const params = [
                scheduledEmail.id,
                JSON.stringify(scheduledEmail.to),
                JSON.stringify(scheduledEmail.cc || []),
                JSON.stringify(scheduledEmail.bcc || []),
                scheduledEmail.subject,
                scheduledEmail.body,
                scheduledEmail.scheduledTime.getTime(),
                scheduledEmail.scheduledFor.getTime(),
                scheduledEmail.accountId,
                JSON.stringify(scheduledEmail.attachments || []),
                scheduledEmail.status,
                scheduledEmail.createdAt.getTime(),
                scheduledEmail.updatedAt.getTime(),
                scheduledEmail.attempts,
                scheduledEmail.lastError || null
            ];
            this.db.run(sql, params, (err) => {
                if (err) {
                    reject(new Error(`Failed to save scheduled email: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Save snoozed email to database
     */
    async saveSnoozedEmail(snoozedEmail) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO snoozed_emails (id, message_id, account_id, snooze_until, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
            const params = [
                snoozedEmail.id,
                snoozedEmail.messageId,
                snoozedEmail.accountId,
                snoozedEmail.snoozeUntil.getTime(),
                snoozedEmail.reason,
                snoozedEmail.createdAt.getTime()
            ];
            this.db.run(sql, params, (err) => {
                if (err) {
                    reject(new Error(`Failed to save snoozed email: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Schedule timer for email delivery
     */
    scheduleEmailTimer(scheduledEmail) {
        const delay = scheduledEmail.scheduledTime.getTime() - Date.now();
        if (delay <= 0) {
            // Email should be sent immediately
            this.processScheduledEmail(scheduledEmail);
            return;
        }
        const timer = setTimeout(() => {
            this.processScheduledEmail(scheduledEmail);
        }, delay);
        this.timers.set(scheduledEmail.id, timer);
    }
    /**
     * Schedule timer for snoozed email
     */
    scheduleSnoozedEmailTimer(snoozedEmail) {
        const delay = snoozedEmail.snoozeUntil.getTime() - Date.now();
        if (delay <= 0) {
            this.processSnoozedEmail(snoozedEmail);
            return;
        }
        const timer = setTimeout(() => {
            this.processSnoozedEmail(snoozedEmail);
        }, delay);
        this.timers.set(`snooze-${snoozedEmail.id}`, timer);
    }
    /**
     * Process scheduled email for sending
     */
    async processScheduledEmail(scheduledEmail) {
        try {
            electron_log_1.default.info(`Processing scheduled email: ${scheduledEmail.id}`);
            // TODO: Integrate with email sending service
            // For now, mark as sent (this would be replaced with actual email sending logic)
            await this.updateEmailStatus(scheduledEmail.id, 'sent');
            // Remove timer
            this.timers.delete(scheduledEmail.id);
            electron_log_1.default.info(`Scheduled email sent: ${scheduledEmail.id}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            electron_log_1.default.error(`Failed to process scheduled email ${scheduledEmail.id}:`, error);
            await this.updateEmailStatus(scheduledEmail.id, 'failed', errorMessage);
        }
    }
    /**
     * Process snoozed email (bring back to inbox)
     */
    async processSnoozedEmail(snoozedEmail) {
        try {
            electron_log_1.default.info(`Processing snoozed email: ${snoozedEmail.messageId}`);
            // TODO: Integrate with email service to bring email back to inbox
            // For now, just remove from snoozed table
            await this.removeSnoozedEmail(snoozedEmail.id);
            // Remove timer
            this.timers.delete(`snooze-${snoozedEmail.id}`);
            electron_log_1.default.info(`Snoozed email processed: ${snoozedEmail.messageId}`);
        }
        catch (error) {
            electron_log_1.default.error(`Failed to process snoozed email ${snoozedEmail.messageId}:`, error);
        }
    }
    /**
     * Update email status in database
     */
    async updateEmailStatus(emailId, status, error) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE scheduled_emails SET status = ?, updated_at = ?, last_error = ? WHERE id = ?';
            this.db.run(sql, [status, Date.now(), error || null, emailId], (err) => {
                if (err) {
                    reject(new Error(`Failed to update email status: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Remove snoozed email from database
     */
    async removeSnoozedEmail(snoozeId) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM snoozed_emails WHERE id = ?';
            this.db.run(sql, [snoozeId], (err) => {
                if (err) {
                    reject(new Error(`Failed to remove snoozed email: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Map database row to ScheduledEmail object
     */
    mapRowToScheduledEmail(row) {
        return {
            id: row.id,
            to: JSON.parse(row.to_addresses),
            cc: JSON.parse(row.cc_addresses),
            bcc: JSON.parse(row.bcc_addresses),
            subject: row.subject,
            body: row.body,
            scheduledTime: new Date(row.scheduled_time),
            scheduledFor: new Date(row.scheduled_for),
            accountId: row.account_id,
            attachments: JSON.parse(row.attachments || '[]'),
            status: row.status,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            attempts: row.attempts,
            lastError: row.last_error
        };
    }
    /**
     * Map database row to SnoozedEmail object
     */
    mapRowToSnoozedEmail(row) {
        return {
            id: row.id,
            messageId: row.message_id,
            accountId: row.account_id,
            snoozeUntil: new Date(row.snooze_until),
            reason: row.reason,
            createdAt: new Date(row.created_at)
        };
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Cleanup resources on shutdown
     */
    async shutdown() {
        electron_log_1.default.info('Shutting down Email Scheduler service...');
        // Clear all timers
        this.timers.forEach((timer, id) => {
            clearTimeout(timer);
        });
        this.timers.clear();
        // Close database connection
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        electron_log_1.default.error('Error closing email scheduler database:', err);
                    }
                    electron_log_1.default.info('Email Scheduler service shut down successfully');
                    resolve();
                });
            });
        }
        this.isInitialized = false;
    }
}
exports.EmailScheduler = EmailScheduler;
