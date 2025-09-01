/**
 * Mail Sync Manager
 * 
 * Handles automatic mail checking, new mail notifications, and background sync
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { DesktopNotificationManager } from './notification-manager';

interface MailAccount {
  id: string;
  name: string;
  email: string;
  provider: string;
  isEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncTime?: Date;
}

interface NewMailNotification {
  accountId: string;
  accountName: string;
  messageCount: number;
  messages: Array<{
    id: string;
    subject: string;
    from: string;
    snippet: string;
  }>;
}

export class MailSyncManager extends EventEmitter {
  private accounts: Map<string, MailAccount> = new Map();
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();
  private notificationManager: DesktopNotificationManager | null = null;
  private isActive = false;
  private rustEngine: any;

  constructor(notificationManager?: DesktopNotificationManager) {
    super();
    this.notificationManager = notificationManager || null;
    this.rustEngine = require('../lib/rust-engine');
  }

  async initialize(): Promise<void> {
    try {
      await this.rustEngine.initialize();
      this.isActive = true;
      log.info('Mail sync manager initialized');
    } catch (error) {
      log.error('Failed to initialize mail sync manager:', error);
    }
  }

  /**
   * Add account to sync monitoring
   */
  addAccount(account: MailAccount): void {
    this.accounts.set(account.id, account);
    
    if (account.isEnabled) {
      this.startSyncForAccount(account);
    }
    
    log.info(`Added mail account for sync: ${account.email}`);
  }

  /**
   * Remove account from sync monitoring
   */
  removeAccount(accountId: string): void {
    const timer = this.syncTimers.get(accountId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(accountId);
    }
    
    this.accounts.delete(accountId);
    log.info(`Removed mail account from sync: ${accountId}`);
  }

  /**
   * Update account sync settings
   */
  updateAccount(accountId: string, updates: Partial<MailAccount>): void {
    const account = this.accounts.get(accountId);
    if (!account) return;

    const updatedAccount = { ...account, ...updates };
    this.accounts.set(accountId, updatedAccount);

    // Restart sync if interval changed
    if (updates.syncIntervalMinutes !== undefined || updates.isEnabled !== undefined) {
      this.stopSyncForAccount(accountId);
      if (updatedAccount.isEnabled) {
        this.startSyncForAccount(updatedAccount);
      }
    }
  }

  /**
   * Start sync timer for specific account
   */
  private startSyncForAccount(account: MailAccount): void {
    if (!this.isActive) return;

    const intervalMs = (account.syncIntervalMinutes || 15) * 60 * 1000; // Convert to milliseconds
    
    const timer = setInterval(async () => {
      await this.syncAccount(account.id);
    }, intervalMs);

    this.syncTimers.set(account.id, timer);
    
    // Also sync immediately
    setTimeout(() => this.syncAccount(account.id), 1000);
    
    log.info(`Started sync for ${account.email} every ${account.syncIntervalMinutes} minutes`);
  }

  /**
   * Stop sync timer for specific account
   */
  private stopSyncForAccount(accountId: string): void {
    const timer = this.syncTimers.get(accountId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(accountId);
    }
  }

  /**
   * Sync specific account and check for new mail
   */
  private async syncAccount(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account || !account.isEnabled) return;

    try {
      log.info(`Syncing mail for ${account.email}`);
      
      // Get message count before sync
      const messagesBefore = await this.getMessageCount(accountId);
      
      // Perform sync using Rust engine
      const syncResult = await this.rustEngine.syncMailAccount(accountId);
      
      // Get message count after sync
      const messagesAfter = await this.getMessageCount(accountId);
      
      // Check for new messages
      const newMessageCount = messagesAfter - messagesBefore;
      
      if (newMessageCount > 0) {
        await this.handleNewMail(accountId, newMessageCount);
      }
      
      // Update last sync time
      account.lastSyncTime = new Date();
      this.accounts.set(accountId, account);
      
      this.emit('sync-completed', { accountId, newMessages: newMessageCount });
      
    } catch (error) {
      log.error(`Failed to sync ${account.email}:`, error);
      this.emit('sync-error', { accountId, error: error instanceof Error ? error.message : 'Sync failed' });
    }
  }

  /**
   * Get current message count for account
   */
  private async getMessageCount(accountId: string): Promise<number> {
    try {
      const messages = await this.rustEngine.getMailMessages(accountId, 'inbox');
      return Array.isArray(messages) ? messages.length : 0;
    } catch (error) {
      log.warn(`Failed to get message count for ${accountId}:`, error);
      return 0;
    }
  }

  /**
   * Handle new mail detection and notifications
   */
  private async handleNewMail(accountId: string, count: number): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    try {
      // Get the latest messages for notification preview
      const messages = await this.rustEngine.getMailMessages(accountId, 'inbox', { limit: Math.min(count, 5) });
      
      if (this.notificationManager) {
        if (count === 1 && messages.length > 0) {
          // Single message notification with preview
          const message = messages[0];
          await this.notificationManager.sendNotification({
            id: `new-mail-${accountId}-${Date.now()}`,
            title: `New Email from ${message.from?.name || message.from?.address || 'Unknown'}`,
            body: `${message.subject || '(No subject)'}\n${message.snippet || ''}`,
            icon: this.getProviderIcon(account.provider),
            source: 'mail',
            importance: 'normal',
            category: 'email',
            timestamp: Date.now(),
            data: {
              accountId,
              messageId: message.id,
              action: 'view-message'
            }
          });
        } else {
          // Multiple messages notification
          await this.notificationManager.sendNotification({
            id: `new-mail-${accountId}-${Date.now()}`,
            title: `${count} New Emails`,
            body: `You have ${count} new messages in ${account.name || account.email}`,
            icon: this.getProviderIcon(account.provider),
            source: 'mail',
            importance: 'normal',
            category: 'email-batch',
            timestamp: Date.now(),
            data: {
              accountId,
              messageCount: count,
              action: 'view-inbox'
            }
          });
        }
      }
      
      log.info(`Sent notification for ${count} new messages in ${account.email}`);
      
    } catch (error) {
      log.error(`Failed to handle new mail notification for ${account.email}:`, error);
    }
  }

  /**
   * Get provider-specific icon for notifications
   */
  private getProviderIcon(provider: string): string | undefined {
    const iconMap: Record<string, string> = {
      gmail: '📧',
      outlook: '📮', 
      yahoo: '📬',
      fastmail: '⚡',
      imap: '📫'
    };
    return iconMap[provider.toLowerCase()];
  }

  /**
   * Start sync for all enabled accounts
   */
  async startSync(): Promise<void> {
    if (!this.isActive) {
      log.warn('Cannot start sync - manager not initialized');
      return;
    }

    for (const account of this.accounts.values()) {
      if (account.isEnabled) {
        this.startSyncForAccount(account);
      }
    }
    
    log.info(`Started mail sync for ${this.accounts.size} accounts`);
  }

  /**
   * Stop all sync timers
   */
  stopSync(): void {
    for (const [accountId, timer] of this.syncTimers) {
      clearInterval(timer);
    }
    this.syncTimers.clear();
    log.info('Stopped all mail sync timers');
  }

  /**
   * Manually sync all accounts
   */
  async syncAll(): Promise<void> {
    const promises = Array.from(this.accounts.keys()).map(accountId => 
      this.syncAccount(accountId)
    );
    
    await Promise.allSettled(promises);
    log.info('Manual sync completed for all accounts');
  }

  /**
   * Get sync status for all accounts
   */
  getSyncStatus(): Record<string, { lastSync?: Date; isEnabled: boolean; intervalMinutes: number }> {
    const status: Record<string, { lastSync?: Date; isEnabled: boolean; intervalMinutes: number }> = {};
    
    for (const [id, account] of this.accounts) {
      status[id] = {
        lastSync: account.lastSyncTime,
        isEnabled: account.isEnabled,
        intervalMinutes: account.syncIntervalMinutes || 15
      };
    }
    
    return status;
  }

  /**
   * Cleanup on app exit
   */
  async cleanup(): Promise<void> {
    this.stopSync();
    this.isActive = false;
    log.info('Mail sync manager cleaned up');
  }
}