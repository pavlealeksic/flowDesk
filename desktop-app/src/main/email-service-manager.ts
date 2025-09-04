/**
 * Email Service Manager
 * 
 * Central management for the pure Rust email service.
 * Replaces all JavaScript-based email implementations.
 * Now directly integrates with the production email engine via NAPI.
 */

import log from 'electron-log';
import { rustEmailBridge, type NapiEmailCredentials, type NapiAccountSetupResult, type NapiSyncResult, type NapiFolder, type NapiNewMessage, type NapiMailMessage, type NapiServerConfig } from './rust-email-bridge';
import { EventEmitter } from 'events';

// Type aliases for cleaner public API
export type EmailCredentials = NapiEmailCredentials;
export type AccountSetupResult = NapiAccountSetupResult;
export type SyncResult = NapiSyncResult;
export type Folder = NapiFolder;
export type NewMessage = NapiNewMessage;
export type MailMessage = NapiMailMessage;
export type ServerConfig = NapiServerConfig;

/**
 * Singleton email service manager using pure Rust backend
 */
class EmailServiceManager extends EventEmitter {
  private static instance: EmailServiceManager | null = null;
  private initialized = false;

  private constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EmailServiceManager {
    if (!EmailServiceManager.instance) {
      EmailServiceManager.instance = new EmailServiceManager();
    }
    return EmailServiceManager.instance;
  }

  /**
   * Initialize the email service
   */
  async initialize(appName: string = 'Flow Desk'): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      log.info('Initializing email service manager...');
      
      // Initialize the Rust email bridge
      await rustEmailBridge.initialize();
      
      // Initialize the production email engine
      const result = await rustEmailBridge.initProductionEmailEngine(appName);
      log.info('Rust email engine initialized:', result);
      
      this.initialized = true;
      
      log.info('Email service manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      log.error('Failed to initialize email service manager:', error);
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
      const result = await rustEmailBridge.setupEmailAccount(userId, credentials);
      log.info('Account setup completed:', result.accountId);
      this.emit('accountSetup', result);
      return result;
    } catch (error) {
      log.error('Account setup failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Test account connections
   */
  async testConnections(accountId: string): Promise<boolean> {
    this.ensureInitialized();
    return rustEmailBridge.testAccountConnections(accountId);
  }

  /**
   * Sync emails for an account
   */
  async syncAccount(accountId: string): Promise<SyncResult> {
    this.ensureInitialized();
    
    try {
      log.info('Email sync started:', accountId);
      this.emit('syncStarted', accountId);
      
      const result = await rustEmailBridge.syncEmailAccount(accountId);
      
      log.info('Email sync completed:', {
        accountId: result.accountId,
        messagesSynced: result.messagesSynced,
        duration: result.syncDurationMs,
      });
      
      this.emit('syncCompleted', result);
      return result;
    } catch (error) {
      log.error('Email sync failed:', error);
      this.emit('syncError', accountId, error);
      throw error;
    }
  }

  /**
   * Get folders for an account
   */
  async getFolders(accountId: string): Promise<Folder[]> {
    this.ensureInitialized();
    return rustEmailBridge.getEmailFolders(accountId);
  }

  /**
   * Send an email
   */
  async sendMessage(accountId: string, message: NewMessage): Promise<void> {
    this.ensureInitialized();
    
    try {
      await rustEmailBridge.sendEmailMessage(accountId, message);
      log.info('Email sent successfully:', { accountId, to: message.to });
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
    return rustEmailBridge.getFolderMessages(accountId, folderName, limit);
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
    await rustEmailBridge.markEmailMessageRead(accountId, folderName, messageUid, isRead);
    this.emit('messageUpdated', accountId, messageUid, { isRead });
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
    await rustEmailBridge.deleteEmailMessage(accountId, folderName, messageUid);
    this.emit('messageDeleted', accountId, messageUid);
  }

  /**
   * Close connections for an account
   */
  async closeConnections(accountId: string): Promise<void> {
    this.ensureInitialized();
    await rustEmailBridge.closeEmailAccountConnections(accountId);
    this.emit('connectionsClosedNew', accountId);
  }

  /**
   * Get health status for all accounts
   */
  async getHealthStatus(): Promise<Record<string, { imap: boolean; smtp: boolean }>> {
    this.ensureInitialized();
    return rustEmailBridge.getEmailAccountsHealth();
  }

  /**
   * Auto-detect server configuration from email address
   */
  detectServerConfig(email: string): ServerConfig | null {
    this.ensureInitialized();
    return rustEmailBridge.detectEmailServerConfig(email);
  }

  /**
   * Get all predefined server configurations
   */
  getPredefinedConfigs(): Record<string, ServerConfig> {
    this.ensureInitialized();
    return rustEmailBridge.getPredefinedServerConfigs();
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup and destroy the service
   */
  async destroy(): Promise<void> {
    try {
      if (rustEmailBridge.isInitialized()) {
        await rustEmailBridge.destroy();
      }
    } catch (error) {
      log.warn('Error during Rust bridge cleanup:', error);
    }
    
    this.removeAllListeners();
    this.initialized = false;
    log.info('Email service manager destroyed');
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Email service manager not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const emailServiceManager = EmailServiceManager.getInstance();

// Export types for convenience (already defined as type aliases above)

export default emailServiceManager;