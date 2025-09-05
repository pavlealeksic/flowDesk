"use strict";
/**
 * Pure Rust Email Service Integration
 *
 * This service provides a TypeScript interface to the Rust email engine.
 * All email operations (IMAP, SMTP, parsing) are handled by Rust.
 * No JavaScript email dependencies are used.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RustEmailService = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const events_1 = require("events");
const rust_email_bridge_1 = require("./rust-email-bridge");
/**
 * Production Email Service using Pure Rust Engine
 *
 * This service interfaces with the Rust email engine for all operations:
 * - Account setup with IMAP/SMTP configuration detection
 * - Email synchronization with local storage
 * - Message operations (send, read, delete, mark as read)
 * - Connection management and health monitoring
 */
class RustEmailService extends events_1.EventEmitter {
    constructor(appName = 'Flow Desk') {
        super();
        this.initialized = false;
        this.appName = appName;
    }
    /**
     * Initialize the Rust email engine
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Initialize the Rust email bridge first
            await rust_email_bridge_1.rustEmailBridge.initialize();
            // Initialize the production email engine
            const result = await rust_email_bridge_1.rustEmailBridge.initProductionEmailEngine(this.appName);
            electron_log_1.default.info('Email service initialized:', result);
            this.initialized = true;
            this.emit('initialized');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize email service:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Setup a new email account
     */
    async setupAccount(userId, credentials) {
        this.ensureInitialized();
        try {
            electron_log_1.default.info(`Setting up email account: ${credentials.email}`);
            const result = await rust_email_bridge_1.rustEmailBridge.setupEmailAccount(userId, credentials);
            if (result.success) {
                electron_log_1.default.info(`Account setup successful: ${result.accountId}`);
                this.emit('accountSetup', result);
            }
            else {
                electron_log_1.default.error(`Account setup failed: ${result.errorMessage}`);
                this.emit('accountSetupError', result.errorMessage);
            }
            return result;
        }
        catch (error) {
            electron_log_1.default.error('Account setup error:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Test IMAP and SMTP connections for an account
     */
    async testConnections(accountId) {
        this.ensureInitialized();
        try {
            const isHealthy = await rust_email_bridge_1.rustEmailBridge.testAccountConnections(accountId);
            electron_log_1.default.info(`Connection test for ${accountId}: ${isHealthy ? 'SUCCESS' : 'FAILED'}`);
            return isHealthy;
        }
        catch (error) {
            electron_log_1.default.error(`Connection test failed for account ${accountId}:`, error);
            return false;
        }
    }
    /**
     * Sync emails for an account
     */
    async syncAccount(accountId) {
        this.ensureInitialized();
        try {
            electron_log_1.default.info(`Starting sync for account: ${accountId}`);
            this.emit('syncStarted', accountId);
            const result = await rust_email_bridge_1.rustEmailBridge.syncEmailAccount(accountId);
            electron_log_1.default.info(`Sync completed for ${accountId}:`, {
                messagesSynced: result.messagesSynced,
                messagesNew: result.messagesNew,
                foldersSynced: result.foldersSynced,
                duration: result.syncDurationMs,
                errors: result.errors.length,
            });
            this.emit('syncCompleted', result);
            return result;
        }
        catch (error) {
            electron_log_1.default.error(`Sync failed for account ${accountId}:`, error);
            this.emit('syncError', accountId, error);
            throw error;
        }
    }
    /**
     * Get folders for an account
     */
    async getFolders(accountId) {
        this.ensureInitialized();
        try {
            const folders = await rust_email_bridge_1.rustEmailBridge.getEmailFolders(accountId);
            electron_log_1.default.info(`Retrieved ${folders.length} folders for account ${accountId}`);
            return folders;
        }
        catch (error) {
            electron_log_1.default.error(`Failed to get folders for account ${accountId}:`, error);
            throw error;
        }
    }
    /**
     * Send an email
     */
    async sendMessage(accountId, message) {
        this.ensureInitialized();
        try {
            electron_log_1.default.info(`Sending email from account ${accountId} to:`, message.to);
            await rust_email_bridge_1.rustEmailBridge.sendEmailMessage(accountId, message);
            electron_log_1.default.info('Email sent successfully');
            this.emit('messageSent', accountId, message);
        }
        catch (error) {
            electron_log_1.default.error('Failed to send email:', error);
            this.emit('sendError', error);
            throw error;
        }
    }
    /**
     * Get messages from a folder
     */
    async getMessages(accountId, folderName, limit) {
        this.ensureInitialized();
        try {
            const messages = await rust_email_bridge_1.rustEmailBridge.getFolderMessages(accountId, folderName, limit);
            electron_log_1.default.info(`Retrieved ${messages.length} messages from ${folderName}`);
            return messages;
        }
        catch (error) {
            electron_log_1.default.error(`Failed to get messages from ${folderName}:`, error);
            throw error;
        }
    }
    /**
     * Mark a message as read or unread
     */
    async markMessageRead(accountId, folderName, messageUid, isRead) {
        this.ensureInitialized();
        try {
            await rust_email_bridge_1.rustEmailBridge.markEmailMessageRead(accountId, folderName, messageUid, isRead);
            electron_log_1.default.debug(`Message ${messageUid} marked as ${isRead ? 'read' : 'unread'}`);
            this.emit('messageUpdated', accountId, messageUid, { isRead });
        }
        catch (error) {
            electron_log_1.default.error(`Failed to mark message ${messageUid} as read:`, error);
            throw error;
        }
    }
    /**
     * Delete a message
     */
    async deleteMessage(accountId, folderName, messageUid) {
        this.ensureInitialized();
        try {
            await rust_email_bridge_1.rustEmailBridge.deleteEmailMessage(accountId, folderName, messageUid);
            electron_log_1.default.info(`Message ${messageUid} deleted from ${folderName}`);
            this.emit('messageDeleted', accountId, messageUid);
        }
        catch (error) {
            electron_log_1.default.error(`Failed to delete message ${messageUid}:`, error);
            throw error;
        }
    }
    /**
     * Close connections for an account
     */
    async closeConnections(accountId) {
        try {
            await rust_email_bridge_1.rustEmailBridge.closeEmailAccountConnections(accountId);
            electron_log_1.default.info(`Connections closed for account ${accountId}`);
            this.emit('connectionsClosedNew', accountId);
        }
        catch (error) {
            electron_log_1.default.error(`Failed to close connections for account ${accountId}:`, error);
            throw error;
        }
    }
    /**
     * Get health status for all accounts
     */
    async getHealthStatus() {
        this.ensureInitialized();
        try {
            return await rust_email_bridge_1.rustEmailBridge.getEmailAccountsHealth();
        }
        catch (error) {
            electron_log_1.default.error('Failed to get health status:', error);
            return {};
        }
    }
    /**
     * Auto-detect server configuration from email address
     */
    detectServerConfig(email) {
        try {
            return rust_email_bridge_1.rustEmailBridge.detectEmailServerConfig(email);
        }
        catch (error) {
            electron_log_1.default.error(`Failed to detect server config for ${email}:`, error);
            return null;
        }
    }
    /**
     * Get all predefined server configurations
     */
    getPredefinedConfigs() {
        try {
            return rust_email_bridge_1.rustEmailBridge.getPredefinedServerConfigs();
        }
        catch (error) {
            electron_log_1.default.error('Failed to get predefined server configs:', error);
            return {};
        }
    }
    /**
     * Cleanup resources
     */
    async destroy() {
        try {
            // Clean up the Rust bridge if needed
            if (rust_email_bridge_1.rustEmailBridge.isInitialized()) {
                await rust_email_bridge_1.rustEmailBridge.destroy();
            }
        }
        catch (error) {
            electron_log_1.default.warn('Error during Rust bridge cleanup:', error);
        }
        this.removeAllListeners();
        this.initialized = false;
        electron_log_1.default.info('Rust email service destroyed');
    }
    /**
     * Ensure the service is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Email service not initialized. Call initialize() first.');
        }
    }
}
exports.RustEmailService = RustEmailService;
exports.default = RustEmailService;
