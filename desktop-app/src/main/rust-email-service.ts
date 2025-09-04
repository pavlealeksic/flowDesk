/**
 * Pure Rust Email Service Integration
 * 
 * This service provides a TypeScript interface to the Rust email engine.
 * All email operations (IMAP, SMTP, parsing) are handled by Rust.
 * No JavaScript email dependencies are used.
 */

import log from 'electron-log';
import { EventEmitter } from 'events';
import { 
  rustEmailBridge,
  type NapiEmailCredentials,
  type NapiAccountSetupResult,
  type NapiSyncResult,
  type NapiFolder,
  type NapiNewMessage,
  type NapiMailMessage,
  type NapiServerConfig
} from './rust-email-bridge';

// Type aliases for cleaner public API (matches existing interface)
export type EmailCredentials = NapiEmailCredentials;
export type AccountSetupResult = NapiAccountSetupResult;
export type SyncResult = NapiSyncResult;
export type Folder = NapiFolder;
export type NewMessage = NapiNewMessage;
export type MailMessage = NapiMailMessage;
export type ServerConfig = NapiServerConfig;

/**
 * Production Email Service using Pure Rust Engine
 * 
 * This service interfaces with the Rust email engine for all operations:
 * - Account setup with IMAP/SMTP configuration detection
 * - Email synchronization with local storage
 * - Message operations (send, read, delete, mark as read)
 * - Connection management and health monitoring
 */
export class RustEmailService extends EventEmitter {
  private initialized = false;
  private appName: string;

  constructor(appName: string = 'Flow Desk') {
    super();
    this.appName = appName;
  }

  /**
   * Initialize the Rust email engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize the Rust email bridge first
      await rustEmailBridge.initialize();
      
      // Initialize the production email engine
      const result = await rustEmailBridge.initProductionEmailEngine(this.appName);
      log.info('Email service initialized:', result);
      
      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      log.error('Failed to initialize email service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup a new email account
   */
  async setupAccount(userId: string, credentials: EmailCredentials): Promise<AccountSetupResult> {
    this.ensureInitialized();

    try {
      log.info(`Setting up email account: ${credentials.email}`);
      const result = await rustEmailBridge.setupEmailAccount(userId, credentials);
      
      if (result.success) {
        log.info(`Account setup successful: ${result.accountId}`);
        this.emit('accountSetup', result);
      } else {
        log.error(`Account setup failed: ${result.errorMessage}`);
        this.emit('accountSetupError', result.errorMessage);
      }

      return result;
    } catch (error) {
      log.error('Account setup error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Test IMAP and SMTP connections for an account
   */
  async testConnections(accountId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const isHealthy = await rustEmailBridge.testAccountConnections(accountId);
      log.info(`Connection test for ${accountId}: ${isHealthy ? 'SUCCESS' : 'FAILED'}`);
      return isHealthy;
    } catch (error) {
      log.error(`Connection test failed for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Sync emails for an account
   */
  async syncAccount(accountId: string): Promise<SyncResult> {
    this.ensureInitialized();

    try {
      log.info(`Starting sync for account: ${accountId}`);
      this.emit('syncStarted', accountId);

      const result = await rustEmailBridge.syncEmailAccount(accountId);

      log.info(`Sync completed for ${accountId}:`, {
        messagesSynced: result.messagesSynced,
        messagesNew: result.messagesNew,
        foldersSynced: result.foldersSynced,
        duration: result.syncDurationMs,
        errors: result.errors.length,
      });

      this.emit('syncCompleted', result);
      return result;
    } catch (error) {
      log.error(`Sync failed for account ${accountId}:`, error);
      this.emit('syncError', accountId, error);
      throw error;
    }
  }

  /**
   * Get folders for an account
   */
  async getFolders(accountId: string): Promise<Folder[]> {
    this.ensureInitialized();

    try {
      const folders = await rustEmailBridge.getEmailFolders(accountId);
      log.info(`Retrieved ${folders.length} folders for account ${accountId}`);
      return folders;
    } catch (error) {
      log.error(`Failed to get folders for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Send an email
   */
  async sendMessage(accountId: string, message: NewMessage): Promise<void> {
    this.ensureInitialized();

    try {
      log.info(`Sending email from account ${accountId} to:`, message.to);
      await rustEmailBridge.sendEmailMessage(accountId, message);
      log.info('Email sent successfully');
      this.emit('messageSent', accountId, message);
    } catch (error) {
      log.error('Failed to send email:', error);
      this.emit('sendError', error);
      throw error;
    }
  }

  /**
   * Get messages from a folder
   */
  async getMessages(
    accountId: string,
    folderName: string,
    limit?: number
  ): Promise<MailMessage[]> {
    this.ensureInitialized();

    try {
      const messages = await rustEmailBridge.getFolderMessages(accountId, folderName, limit);
      log.info(`Retrieved ${messages.length} messages from ${folderName}`);
      return messages;
    } catch (error) {
      log.error(`Failed to get messages from ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * Mark a message as read or unread
   */
  async markMessageRead(
    accountId: string,
    folderName: string,
    messageUid: number,
    isRead: boolean
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await rustEmailBridge.markEmailMessageRead(accountId, folderName, messageUid, isRead);
      log.debug(`Message ${messageUid} marked as ${isRead ? 'read' : 'unread'}`);
      this.emit('messageUpdated', accountId, messageUid, { isRead });
    } catch (error) {
      log.error(`Failed to mark message ${messageUid} as read:`, error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    accountId: string,
    folderName: string,
    messageUid: number
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await rustEmailBridge.deleteEmailMessage(accountId, folderName, messageUid);
      log.info(`Message ${messageUid} deleted from ${folderName}`);
      this.emit('messageDeleted', accountId, messageUid);
    } catch (error) {
      log.error(`Failed to delete message ${messageUid}:`, error);
      throw error;
    }
  }

  /**
   * Close connections for an account
   */
  async closeConnections(accountId: string): Promise<void> {
    try {
      await rustEmailBridge.closeEmailAccountConnections(accountId);
      log.info(`Connections closed for account ${accountId}`);
      this.emit('connectionsClosedNew', accountId);
    } catch (error) {
      log.error(`Failed to close connections for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get health status for all accounts
   */
  async getHealthStatus(): Promise<Record<string, { imap: boolean; smtp: boolean }>> {
    this.ensureInitialized();

    try {
      return await rustEmailBridge.getEmailAccountsHealth();
    } catch (error) {
      log.error('Failed to get health status:', error);
      return {};
    }
  }

  /**
   * Auto-detect server configuration from email address
   */
  detectServerConfig(email: string): ServerConfig | null {
    try {
      return rustEmailBridge.detectEmailServerConfig(email);
    } catch (error) {
      log.error(`Failed to detect server config for ${email}:`, error);
      return null;
    }
  }

  /**
   * Get all predefined server configurations
   */
  getPredefinedConfigs(): Record<string, ServerConfig> {
    try {
      return rustEmailBridge.getPredefinedServerConfigs();
    } catch (error) {
      log.error('Failed to get predefined server configs:', error);
      return {};
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      // Clean up the Rust bridge if needed
      if (rustEmailBridge.isInitialized()) {
        await rustEmailBridge.destroy();
      }
    } catch (error) {
      log.warn('Error during Rust bridge cleanup:', error);
    }
    
    this.removeAllListeners();
    this.initialized = false;
    log.info('Rust email service destroyed');
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Email service not initialized. Call initialize() first.');
    }
  }
}

export default RustEmailService;