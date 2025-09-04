/**
 * Email Engine
 * Handles email operations and account management using Pure Rust Email Service
 */

import { 
  RustEmailService, 
  type EmailCredentials,
  type AccountSetupResult,
  type SyncResult,
  type Folder,
  type MailMessage,
  type NewMessage,
  type ServerConfig
} from '../rust-email-service';
import log from 'electron-log';

// Type aliases for compatibility with existing API
export interface EmailAccount {
  id: string;
  email: string;
  displayName?: string;
  provider?: string;
}

export interface EmailMessage extends MailMessage {
  // EmailMessage extends MailMessage with same interface
  uid?: number; // Add UID field for IMAP operations
}

export interface SendEmailOptions extends NewMessage {
  // SendEmailOptions extends NewMessage with attachment support
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailEngine {
  private rustEmailService: RustEmailService;
  private accounts: Map<string, EmailAccount> = new Map();

  constructor() {
    this.rustEmailService = new RustEmailService('Flow Desk');
  }

  /**
   * Initialize the email engine
   */
  async initialize(): Promise<void> {
    await this.rustEmailService.initialize();
  }

  /**
   * Add a new email account
   */
  async addAccount(account: Omit<EmailAccount, 'id'>): Promise<EmailAccount> {
    try {
      const userId = 'default-user'; // TODO: Get from user context
      const credentials: EmailCredentials = {
        email: account.email,
        password: '', // This will need to be provided by the user
        displayName: account.displayName,
      };

      const result = await this.rustEmailService.setupAccount(userId, credentials);
      
      if (result.success) {
        const emailAccount: EmailAccount = {
          id: result.accountId,
          email: account.email,
          displayName: account.displayName,
          provider: account.provider,
        };
        
        this.accounts.set(result.accountId, emailAccount);
        return emailAccount;
      } else {
        throw new Error(result.errorMessage || 'Account setup failed');
      }
    } catch (error) {
      log.error('Failed to add account:', error);
      throw error;
    }
  }

  /**
   * Remove an email account
   */
  async removeAccount(accountId: string): Promise<void> {
    try {
      // Close connections for the account
      await this.rustEmailService.closeConnections(accountId);
      this.accounts.delete(accountId);
    } catch (error) {
      log.error(`Failed to remove account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific account
   */
  getAccount(accountId: string): EmailAccount | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Get all accounts
   */
  getAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get messages from a folder
   */
  async getMessages(accountId: string, folderName: string = 'INBOX'): Promise<EmailMessage[]> {
    try {
      const messages = await this.rustEmailService.getMessages(accountId, folderName);
      return messages.map((msg, index) => ({
        ...msg,
        uid: index + 1, // Simple UID assignment for compatibility
      }));
    } catch (error) {
      log.error(`Failed to get messages for account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Sync account emails
   */
  async syncAccount(accountId: string, folderName?: string): Promise<EmailMessage[]> {
    try {
      // Perform sync
      await this.rustEmailService.syncAccount(accountId);
      
      // Return messages from the synced folder
      return await this.getMessages(accountId, folderName || 'INBOX');
    } catch (error) {
      log.error(`Failed to sync account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(accountId: string, messageId: string): Promise<void> {
    try {
      const messageUid = parseInt(messageId);
      await this.rustEmailService.markMessageRead(accountId, 'INBOX', messageUid, true);
    } catch (error) {
      log.error(`Failed to mark message as read:`, error);
      throw error;
    }
  }

  /**
   * Mark message as unread
   */
  async markAsUnread(accountId: string, messageId: string): Promise<void> {
    try {
      const messageUid = parseInt(messageId);
      await this.rustEmailService.markMessageRead(accountId, 'INBOX', messageUid, false);
    } catch (error) {
      log.error(`Failed to mark message as unread:`, error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(accountId: string, messageId: string): Promise<void> {
    try {
      const messageUid = parseInt(messageId);
      await this.rustEmailService.deleteMessage(accountId, 'INBOX', messageUid);
    } catch (error) {
      log.error(`Failed to delete message:`, error);
      throw error;
    }
  }

  /**
   * Get folders for an account
   */
  async getFolders(accountId: string): Promise<Folder[]> {
    try {
      return await this.rustEmailService.getFolders(accountId);
    } catch (error) {
      log.error(`Failed to get folders for account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Search messages (basic implementation)
   */
  async searchMessages(accountId: string, query: string, folderName?: string): Promise<EmailMessage[]> {
    try {
      // Get all messages and filter locally (basic search)
      // TODO: Implement server-side search in Rust
      const messages = await this.getMessages(accountId, folderName || 'INBOX');
      
      const searchQuery = query.toLowerCase();
      return messages.filter(msg => 
        msg.subject.toLowerCase().includes(searchQuery) ||
        msg.fromAddress.toLowerCase().includes(searchQuery) ||
        msg.fromName.toLowerCase().includes(searchQuery) ||
        (msg.bodyText && msg.bodyText.toLowerCase().includes(searchQuery))
      );
    } catch (error) {
      log.error(`Failed to search messages:`, error);
      return [];
    }
  }

  /**
   * Send an email
   */
  async sendEmail(data: {
    accountId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      path?: string;
      content?: Buffer | string;
      contentType?: string;
    }>;
  }): Promise<{ messageId: string; timestamp: string }> {
    try {
      const message: NewMessage = {
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        bodyText: data.text || data.body,
        bodyHtml: data.html,
        // TODO: Add attachment support in Rust
      };

      await this.rustEmailService.sendMessage(data.accountId, message);
      
      return {
        messageId: `sent-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Reply to an email
   */
  async replyToEmail(data: {
    accountId: string;
    originalMessageId: string;
    body: string;
    text?: string;
    html?: string;
    replyAll: boolean;
  }): Promise<{ messageId: string }> {
    try {
      // Get original message to extract reply information
      const messages = await this.getMessages(data.accountId);
      const originalMessage = messages.find(m => m.id === data.originalMessageId);
      
      if (!originalMessage) {
        throw new Error('Original message not found');
      }

      // Construct reply recipients
      const to = [originalMessage.fromAddress];
      let cc: string[] | undefined;
      
      if (data.replyAll) {
        // Add all original recipients except the sender
        cc = originalMessage.toAddresses.filter(addr => addr !== originalMessage.fromAddress);
      }

      // Construct reply subject
      const subject = originalMessage.subject.startsWith('Re: ') 
        ? originalMessage.subject 
        : `Re: ${originalMessage.subject}`;

      const message: NewMessage = {
        to,
        cc: cc && cc.length > 0 ? cc : undefined,
        subject,
        bodyText: data.text || data.body,
        bodyHtml: data.html,
      };

      await this.rustEmailService.sendMessage(data.accountId, message);
      return { messageId: `reply-${Date.now()}` };
      
    } catch (error) {
      log.error('Failed to reply to email:', error);
      throw error;
    }
  }

  /**
   * Archive an email
   */
  async archiveEmail(accountId: string, emailId: string): Promise<void> {
    try {
      // For now, just mark as read (basic archiving implementation)
      log.info(`Archiving email ${emailId} for account ${accountId}`);
      await this.markAsRead(accountId, emailId);
      
    } catch (error) {
      log.error('Failed to archive email:', error);
      throw error;
    }
  }

  /**
   * Refresh account token (not needed for production email engine)
   */
  async refreshAccountToken(accountId: string, newAccessToken: string, newRefreshToken?: string): Promise<void> {
    // The production email engine uses direct credentials, not OAuth tokens
    log.info(`Token refresh not needed for production email engine: ${accountId}`);
  }

  /**
   * Test account connection
   */
  async testAccountConnection(accountId: string): Promise<{
    imap: boolean;
    smtp: boolean;
    errors: string[];
  }> {
    try {
      const isHealthy = await this.rustEmailService.testConnections(accountId);
      
      return {
        imap: isHealthy,
        smtp: isHealthy,
        errors: isHealthy ? [] : ['Connection test failed']
      };
    } catch (error) {
      log.error(`Failed to test connection for account ${accountId}:`, error);
      return {
        imap: false,
        smtp: false,
        errors: [error instanceof Error ? error.message : 'Connection test failed']
      };
    }
  }

  /**
   * Shutdown the email engine
   */
  async shutdown(): Promise<void> {
    try {
      await this.rustEmailService.destroy();
    } catch (error) {
      log.error('Error during email engine shutdown:', error);
    }
  }
}

export const emailEngine = new EmailEngine();