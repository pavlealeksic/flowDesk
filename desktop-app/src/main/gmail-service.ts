/**
 * Real Gmail API Service Implementation
 * 
 * This service provides real Gmail API integration using the googleapis library.
 * It handles OAuth2 authentication, message operations, and real-time synchronization.
 */

/// <reference path="../types/@types/electron-store/index.d.ts" />

import { google } from 'googleapis';
import type { Auth } from 'googleapis';
import { shell } from 'electron';
import log from 'electron-log';
import { createTypedStore, TypedStore } from '../types/store';

// Define proper types for stored data
interface StoredGmailAccounts {
  accounts: Record<string, StoredAccount>;
  settings: {
    syncInterval: number;
    autoSync: boolean;
  };
}
import { v4 as uuidv4 } from 'uuid';
import * as open from 'open';
import * as CryptoJS from 'crypto-js';
import { OAuthCallbackServer } from './oauth-server';
import type { gmail_v1 } from 'googleapis';

// Import shared types
import type {
  MailAccount,
  EmailMessage,
  MailFolder,
  MailSyncStatus,
  EmailAddress,
  CreateMailAccountInput,
  UpdateMailAccountInput,
  BulkEmailOperation,
  BulkEmailOperationResult
} from '@flow-desk/shared';

// Gmail API configuration
const GMAIL_CONFIG = {
  clientId: process.env.GMAIL_CLIENT_ID || '1234567890-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com',
  clientSecret: process.env.GMAIL_CLIENT_SECRET || 'GOCSPX-abcdefghijklmnopqrstuvwxyz012345',
  redirectUri: 'http://localhost:8080/oauth/callback',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
};

// Rate limiting configuration
const RATE_LIMITS = {
  requestsPerSecond: 10,
  requestsPerDay: 1000000000, // 1 billion requests per day (Gmail API quota)
  batchSize: 100
};

// Secure storage for credentials
interface StoredCredentials {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expiry_date?: number;
  scope?: string;
}

interface StoredAccount {
  id: string;
  email: string;
  displayName: string;
  credentials: StoredCredentials;
  historyId?: string;
  lastSyncAt?: string;
  isEnabled: boolean;
}

// Gmail API types for proper typing
interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  sizeEstimate?: number;
  payload?: {
    mimeType?: string;
    headers?: GmailMessageHeader[];
    body?: {
      data?: string;
    };
    parts?: GmailMessagePart[];
  };
}

/**
 * Gmail API Service Class
 * Handles all Gmail operations with proper error handling and rate limiting
 */
export class GmailService {
  private oauth2Client: Auth.OAuth2Client;
  private store: TypedStore<StoredGmailAccounts>;
  private encryptionKey: string;
  private rateLimitQueue: Map<string, number[]> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private oauthServer: OAuthCallbackServer;
  private pendingOAuthPromise: { resolve: (account: MailAccount) => void; reject: (error: Error) => void } | null = null;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
    
    // Initialize OAuth callback server
    this.oauthServer = new OAuthCallbackServer();
    
    // Initialize OAuth2 client with dynamic redirect URI
    this.oauth2Client = new google.auth.OAuth2(
      GMAIL_CONFIG.clientId,
      GMAIL_CONFIG.clientSecret,
      this.oauthServer.getCallbackUrl()
);

    // Initialize secure store for credentials
    this.store = createTypedStore<StoredGmailAccounts>({
      name: 'gmail-credentials',
      encryptionKey: encryptionKey,
      fileExtension: 'json',
      defaults: {
        accounts: {},
        settings: {
          syncInterval: 300000, // 5 minutes
          autoSync: true
        }
      }
    });

    log.info('Gmail service initialized');
  }

  /**
   * Start OAuth2 flow and return promise that resolves with account
   */
  async startOAuthFlow(): Promise<MailAccount> {
    try {
      // Start OAuth server if not running
      if (!this.oauthServer.isRunning()) {
        await this.oauthServer.start((data) => {
          this.handleOAuthServerCallback(data);
        });
      }

      // Generate auth URL
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GMAIL_CONFIG.scopes,
        prompt: 'consent', // Force consent to get refresh token
        state: uuidv4() // CSRF protection
      });

      log.info('Generated Gmail OAuth URL');

      // Open browser
      await this.openAuthBrowser(authUrl);

      // Return promise that will be resolved by callback
      return new Promise((resolve, reject) => {
        this.pendingOAuthPromise = { resolve, reject };
        
        // Set timeout to prevent hanging
        setTimeout(() => {
          if (this.pendingOAuthPromise) {
            this.pendingOAuthPromise.reject(new Error('OAuth timeout - user did not complete authentication'));
            this.pendingOAuthPromise = null;
          }
        }, 300000); // 5 minute timeout
      });
    } catch (error) {
      await this.oauthServer.stop();
      throw error;
    }
  }

  /**
   * Handle OAuth server callback
   */
  private async handleOAuthServerCallback(data: { code?: string; state?: string; error?: string; error_description?: string }): Promise<void> {
    try {
      // Stop OAuth server
      await this.oauthServer.stop();

      if (!this.pendingOAuthPromise) {
        log.warn('Received OAuth callback but no pending promise');
        return;
      }

      if (data.error) {
        this.pendingOAuthPromise.reject(new Error(`OAuth error: ${data.error} - ${data.error_description || 'Unknown error'}`));
        this.pendingOAuthPromise = null;
        return;
      }

      if (!data.code) {
        this.pendingOAuthPromise.reject(new Error('No authorization code received'));
        this.pendingOAuthPromise = null;
        return;
      }

      // Handle the OAuth callback
      const account = await this.handleOAuthCallback(data.code);
      this.pendingOAuthPromise.resolve(account);
      this.pendingOAuthPromise = null;
    } catch (error) {
      if (this.pendingOAuthPromise) {
        this.pendingOAuthPromise.reject(error instanceof Error ? error : new Error('Unknown OAuth error'));
        this.pendingOAuthPromise = null;
      }
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  async getAuthUrl(): Promise<string> {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_CONFIG.scopes,
      prompt: 'consent', // Force consent to get refresh token
      state: uuidv4() // CSRF protection
    });

    log.info('Generated Gmail OAuth URL');
    return authUrl;
  }

  /**
   * Handle OAuth2 callback and store credentials
   */
  async handleOAuthCallback(code: string, accountId?: string): Promise<MailAccount> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Invalid tokens received from OAuth callback');
      }

      // Set credentials
      this.oauth2Client.setCredentials(tokens);

      // Get user info using Gmail profile API (simpler than oauth2 userinfo)
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const profileResponse = await gmail.users.getProfile({ userId: 'me' });
      
      const email = profileResponse.data.emailAddress;
      const displayName = email || 'Unknown User';

      if (!email) {
        throw new Error('Unable to retrieve user email from Google');
      }

      // Create account
      const account: MailAccount = {
        id: accountId || uuidv4(),
        userId: 'default', // TODO: Get from user context
        name: displayName,
        email: email,
        provider: 'gmail',
        config: {
          provider: 'gmail',
          clientId: GMAIL_CONFIG.clientId,
          scopes: GMAIL_CONFIG.scopes,
          enablePushNotifications: false
        },
        status: 'active',
        syncIntervalMinutes: 5,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store encrypted credentials
      const credentials: StoredCredentials = {
        access_token: this.encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? this.encrypt(tokens.refresh_token) : undefined,
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || Date.now() + (3600 * 1000),
        scope: tokens.scope || GMAIL_CONFIG.scopes.join(' ')
      };

      const storedAccount: StoredAccount = {
        id: account.id,
        email: account.email,
        displayName: account.name,
        credentials,
        isEnabled: account.isEnabled
      };

      this.store.set(`accounts.${account.id}`, storedAccount);
      
      log.info('Gmail account added successfully:', email);
      
      // Start periodic sync
      this.startPeriodicSync(account.id);
      
      return account;
    } catch (error) {
      log.error('Failed to handle OAuth callback:', error);
      throw error;
    }
  }

  /**
   * List stored Gmail accounts
   */
  async listAccounts(): Promise<MailAccount[]> {
    const accounts = this.store.get('accounts', {} as Record<string, StoredAccount>);
    
    return Object.values(accounts).map((stored: StoredAccount) => ({
      id: stored.id,
      userId: 'default',
      name: stored.displayName,
      email: stored.email,
      provider: 'gmail' as const,
      config: {
        provider: 'gmail' as const,
        clientId: GMAIL_CONFIG.clientId,
        scopes: GMAIL_CONFIG.scopes,
        enablePushNotifications: false
      },
      status: 'active' as const,
      lastSyncAt: stored.lastSyncAt ? new Date(stored.lastSyncAt) : undefined,
      syncIntervalMinutes: 5,
      isEnabled: stored.isEnabled,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Remove a Gmail account
   */
  async removeAccount(accountId: string): Promise<boolean> {
    try {
      // Stop sync
      this.stopPeriodicSync(accountId);
      
      // Remove from store
      this.store.delete(`accounts.${accountId}`);
      
      log.info('Gmail account removed:', accountId);
      return true;
    } catch (error) {
      log.error('Failed to remove Gmail account:', error);
      return false;
    }
  }

  /**
   * Get authenticated Gmail client for account
   */
  private async getGmailClient(accountId: string) {
    const storedAccount = this.store.get(`accounts.${accountId}`) as StoredAccount | undefined;
    if (!storedAccount) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Decrypt credentials
    const accessToken = this.decrypt(storedAccount.credentials.access_token);
    const refreshToken = storedAccount.credentials.refresh_token ? this.decrypt(storedAccount.credentials.refresh_token) : '';

    // Create OAuth client for this account
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CONFIG.clientId,
      GMAIL_CONFIG.clientSecret,
      GMAIL_CONFIG.redirectUri
);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: storedAccount.credentials.expiry_date
    });

    // Auto-refresh tokens
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        storedAccount.credentials.access_token = this.encrypt(tokens.access_token);
      }
      if (tokens.refresh_token) {
        storedAccount.credentials.refresh_token = this.encrypt(tokens.refresh_token);
      }
      storedAccount.credentials.expiry_date = tokens.expiry_date || Date.now() + (3600 * 1000);
      
      this.store.set(`accounts.${accountId}`, storedAccount);
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Fetch messages from Gmail
   */
  async getMessages(accountId: string, options?: {
    limit?: number;
    pageToken?: string;
    query?: string;
    labelIds?: string[];
  }): Promise<EmailMessage[]> {
    try {
      await this.checkRateLimit(accountId);
      
      const gmail = await this.getGmailClient(accountId);
      
      // List messages
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: options?.limit || 50,
        pageToken: options?.pageToken,
        q: options?.query,
        labelIds: options?.labelIds
      });

      if (!listResponse.data.messages) {
        return [];
      }

      // Fetch message details in batch
      const messages: EmailMessage[] = [];
      const batchRequests = listResponse.data.messages.slice(0, Math.min(RATE_LIMITS.batchSize, options?.limit || 50));

      for (const message of batchRequests) {
        if (!message.id) continue;

        await this.checkRateLimit(accountId);
        
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const emailMessage = this.convertGmailMessage(accountId, messageResponse.data as GmailMessage);
        if (emailMessage) {
          messages.push(emailMessage);
        }
      }

      return messages;
    } catch (error) {
      log.error('Failed to fetch Gmail messages:', error);
      throw error;
    }
  }

  /**
   * Send email message
   */
  async sendMessage(accountId: string, message: Partial<EmailMessage>): Promise<string> {
    try {
      await this.checkRateLimit(accountId);
      
      const gmail = await this.getGmailClient(accountId);
      
      // Construct RFC 2822 message
      const emailContent = this.constructEmailMessage(message);
      const encodedMessage = Buffer.from(emailContent).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      log.info('Gmail message sent:', response.data.id);
      return response.data.id || uuidv4();
    } catch (error) {
      log.error('Failed to send Gmail message:', error);
      throw error;
    }
  }

  /**
   * Mark message as read/unread
   */
  async markMessageRead(accountId: string, messageId: string, read: boolean): Promise<void> {
    try {
      await this.checkRateLimit(accountId);
      
      const gmail = await this.getGmailClient(accountId);
      
      if (read) {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });
      } else {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds: ['UNREAD']
          }
        });
      }

      log.info(`Gmail message marked ${read ? 'read' : 'unread'}:`, messageId);
    } catch (error) {
      log.error('Failed to mark Gmail message read/unread:', error);
      throw error;
    }
  }

  /**
   * Search messages
   */
  async searchMessages(accountId: string, query: string, options?: {
    limit?: number;
  }): Promise<EmailMessage[]> {
    return this.getMessages(accountId, {
      query,
      limit: options?.limit
    });
  }

  /**
   * Get Gmail labels (folders)
   */
  async getFolders(accountId: string): Promise<MailFolder[]> {
    try {
      await this.checkRateLimit(accountId);
      
      const gmail = await this.getGmailClient(accountId);
      
      const response = await gmail.users.labels.list({
        userId: 'me'
      });

      if (!response.data.labels) {
        return [];
      }

      return response.data.labels.map(label => ({
        id: label.id || '',
        accountId,
        name: label.name || '',
        displayName: label.name || '',
        type: this.mapGmailLabelType(label.name || ''),
        path: label.name || '',
        attributes: label.type === 'system' ? ['system'] : ['user'],
        messageCount: label.messagesTotal || 0,
        unreadCount: label.messagesUnread || 0,
        isSelectable: true,
        syncStatus: {
          isBeingSynced: false
        }
      }));
    } catch (error) {
      log.error('Failed to fetch Gmail folders:', error);
      throw error;
    }
  }

  /**
   * Sync account with Gmail
   */
  async syncAccount(accountId: string): Promise<MailSyncStatus> {
    try {
      const storedAccount = this.store.get(`accounts.${accountId}`) as StoredAccount | undefined;
      if (!storedAccount) {
        throw new Error(`Account not found: ${accountId}`);
      }

      await this.checkRateLimit(accountId);
      
      const gmail = await this.getGmailClient(accountId);
      
      // Get current history ID for incremental sync
      const profileResponse = await gmail.users.getProfile({
        userId: 'me'
      });

      const currentHistoryId = profileResponse.data.historyId;
      const lastHistoryId = storedAccount.historyId;

      let newMessages = 0;
      let updatedMessages = 0;
      let syncErrors = 0;

      if (lastHistoryId && currentHistoryId && lastHistoryId !== currentHistoryId) {
        // Incremental sync using history API
        try {
          const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastHistoryId
          });

          if (historyResponse.data.history) {
            for (const historyRecord of historyResponse.data.history) {
              if (historyRecord.messagesAdded) {
                newMessages += historyRecord.messagesAdded.length;
              }
              if (historyRecord.messagesDeleted) {
                updatedMessages += historyRecord.messagesDeleted.length;
              }
              if (historyRecord.labelsAdded || historyRecord.labelsRemoved) {
                updatedMessages += (historyRecord.labelsAdded?.length || 0) + 
                                 (historyRecord.labelsRemoved?.length || 0);
              }
            }
          }
        } catch (error) {
          log.error('History sync failed, falling back to full sync:', error);
          syncErrors++;
        }
      }

      // Update stored history ID
      if (currentHistoryId) {
        storedAccount.historyId = currentHistoryId;
      }
      storedAccount.lastSyncAt = new Date().toISOString();
      this.store.set(`accounts.${accountId}`, storedAccount);

      return {
        accountId,
        status: 'idle',
        lastSyncAt: new Date(),
        stats: {
          totalMessages: parseInt(profileResponse.data.messagesTotal?.toString() || '0'),
          newMessages,
          updatedMessages,
          deletedMessages: 0,
          syncErrors
        }
      };
    } catch (error) {
      log.error('Failed to sync Gmail account:', error);
      return {
        accountId,
        status: 'error',
        stats: {
          totalMessages: 0,
          newMessages: 0,
          updatedMessages: 0,
          deletedMessages: 0,
          syncErrors: 1
        },
        lastError: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'SYNC_FAILED',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Perform bulk operations on messages
   */
  async performBulkOperation(accountId: string, operation: BulkEmailOperation): Promise<BulkEmailOperationResult> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    for (const messageId of operation.messageIds) {
      try {
        await this.checkRateLimit(accountId);

        switch (operation.type) {
          case 'mark_read':
            await this.markMessageRead(accountId, messageId, true);
            break;
          case 'mark_unread':
            await this.markMessageRead(accountId, messageId, false);
            break;
          case 'delete':
            await this.deleteMessage(accountId, messageId);
            break;
          // Add other operations as needed
          default:
            throw new Error(`Unsupported operation: ${operation.type}`);
        }
        successful++;
      } catch (error) {
        failed++;
        errors.push({
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Open system browser for OAuth
   */
  async openAuthBrowser(authUrl: string): Promise<void> {
    await open.default(authUrl);
  }

  /**
   * Start periodic sync for account
   */
  private startPeriodicSync(accountId: string): void {
    // Clear existing interval
    this.stopPeriodicSync(accountId);

    // Start new interval (5 minutes)
    const interval = setInterval(async () => {
      try {
        await this.syncAccount(accountId);
      } catch (error) {
        log.error(`Periodic sync failed for account ${accountId}:`, error);
      }
    }, 5 * 60 * 1000);

    this.syncIntervals.set(accountId, interval);
  }

  /**
   * Stop periodic sync for account
   */
  private stopPeriodicSync(accountId: string): void {
    const interval = this.syncIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(accountId);
    }
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(accountId: string): Promise<void> {
    const now = Date.now();
    const requests = this.rateLimitQueue.get(accountId) || [];
    
    // Clean old requests (older than 1 second)
    const validRequests = requests.filter(time => now - time < 1000);
    
    if (validRequests.length >= RATE_LIMITS.requestsPerSecond) {
      // Wait until we can make another request
      const oldestRequest = Math.min(...validRequests);
      const waitTime = 1000 - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    validRequests.push(now);
    this.rateLimitQueue.set(accountId, validRequests);
  }

  /**
   * Convert Gmail API message to EmailMessage
   */
  private convertGmailMessage(accountId: string, gmailMessage: GmailMessage): EmailMessage | null {
    try {
      if (!gmailMessage.id || !gmailMessage.payload) {
        return null;
      }

      const headers = gmailMessage.payload.headers || [];
      const getHeader = (name: string) => headers.find((h: GmailMessageHeader) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || '(no subject)';
      const fromHeader = getHeader('From');
      const toHeader = getHeader('To');
      const ccHeader = getHeader('Cc');
      const dateHeader = getHeader('Date');
      const messageIdHeader = getHeader('Message-ID');

      // Parse email addresses
      const parseEmailAddresses = (addressString: string): EmailAddress[] => {
        if (!addressString) return [];
        
        // Simple email parsing - in production, use a proper email parser
        return addressString.split(',').map(addr => {
          const match = addr.trim().match(/^(.+?)\s*<(.+)>$/) || [null, '', addr.trim()];
          return {
            name: match[1]?.trim() || '',
            address: match[2]?.trim() || addr.trim()
          };
        });
      };

      // Extract message body
      let bodyText = '';
      let bodyHtml = '';
      
      const extractBody = (part: GmailMessagePart): void => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };

      if (gmailMessage.payload.parts) {
        gmailMessage.payload.parts.forEach(extractBody);
      } else if (gmailMessage.payload.body?.data) {
        if (gmailMessage.payload.mimeType === 'text/plain') {
          bodyText = Buffer.from(gmailMessage.payload.body.data, 'base64').toString('utf-8');
        } else if (gmailMessage.payload.mimeType === 'text/html') {
          bodyHtml = Buffer.from(gmailMessage.payload.body.data, 'base64').toString('utf-8');
        }
      }

      return {
        id: uuidv4(),
        accountId,
        providerId: gmailMessage.id,
        threadId: gmailMessage.threadId || gmailMessage.id,
        subject,
        bodyText,
        bodyHtml,
        snippet: gmailMessage.snippet || bodyText.substring(0, 200) || 'No content',
        from: parseEmailAddresses(fromHeader)[0] || { address: '', name: '' },
        to: parseEmailAddresses(toHeader),
        cc: parseEmailAddresses(ccHeader),
        bcc: [],
        replyTo: [],
        date: dateHeader ? new Date(dateHeader) : new Date(),
        flags: {
          isRead: !(gmailMessage.labelIds || []).includes('UNREAD'),
          isStarred: (gmailMessage.labelIds || []).includes('STARRED'),
          isTrashed: (gmailMessage.labelIds || []).includes('TRASH'),
          isSpam: (gmailMessage.labelIds || []).includes('SPAM'),
          isImportant: (gmailMessage.labelIds || []).includes('IMPORTANT'),
          isArchived: !(gmailMessage.labelIds || []).includes('INBOX'),
          isDraft: (gmailMessage.labelIds || []).includes('DRAFT'),
          isSent: (gmailMessage.labelIds || []).includes('SENT'),
          hasAttachments: false // TODO: Check for attachments
        },
        labels: gmailMessage.labelIds || [],
        folder: (gmailMessage.labelIds || []).includes('INBOX') ? 'INBOX' : 'UNKNOWN',
        importance: 'normal',
        priority: 'normal',
        size: gmailMessage.sizeEstimate || 0,
        attachments: [], // TODO: Extract attachments
        headers: headers.reduce((acc: Record<string, string>, header: GmailMessageHeader) => {
          acc[header.name] = header.value;
          return acc;
        }, {}),
        messageId: messageIdHeader,
        references: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      log.error('Failed to convert Gmail message:', error);
      return null;
    }
  }

  /**
   * Construct RFC 2822 email message
   */
  private constructEmailMessage(message: Partial<EmailMessage>): string {
    const lines: string[] = [];
    
    if (message.to && message.to.length > 0) {
      lines.push(`To: ${message.to.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ')}`);
    }
    
    if (message.cc && message.cc.length > 0) {
      lines.push(`Cc: ${message.cc.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ')}`);
    }
    
    if (message.subject) {
      lines.push(`Subject: ${message.subject}`);
    }
    
    lines.push('MIME-Version: 1.0');
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    
    const body = message.bodyHtml || message.bodyText || '';
    const encodedBody = Buffer.from(body).toString('base64');
    
    // Split base64 into 76-character lines
    const base64Lines = encodedBody.match(/.{1,76}/g) || [];
    lines.push(...base64Lines);
    
    return lines.join('\r\n');
  }

  /**
   * Delete message
   */
  private async deleteMessage(accountId: string, messageId: string): Promise<void> {
    const gmail = await this.getGmailClient(accountId);
    await gmail.users.messages.delete({
      userId: 'me',
      id: messageId
    });
  }

  /**
   * Map Gmail label to folder type
   */
  private mapGmailLabelType(labelName: string): 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'custom' | 'system' {
    switch (labelName.toUpperCase()) {
      case 'INBOX': return 'inbox';
      case 'SENT': return 'sent';
      case 'DRAFTS': return 'drafts';
      case 'TRASH': return 'trash';
      case 'SPAM': return 'spam';
      default: return labelName.startsWith('CATEGORY_') ? 'system' : 'custom';
    }
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(cipherText: string): string {
    const bytes = CryptoJS.AES.decrypt(cipherText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // New advanced features methods

  /**
   * Mark message as starred/unstarred
   */
  async markMessageStarred(accountId: string, messageId: string, starred: boolean): Promise<void> {
    const gmail = await this.getGmailClient(accountId);
    
    const modifyRequest: gmail_v1.Params$Resource$Users$Messages$Modify = {
      userId: 'me',
      id: messageId,
      requestBody: starred ? {
        addLabelIds: ['STARRED']
      } : {
        removeLabelIds: ['STARRED']
      }
    };

    await gmail.users.messages.modify(modifyRequest);
    log.info(`Message ${messageId} ${starred ? 'starred' : 'unstarred'}`);
  }

  /**
   * Get unified messages from all accounts
   */
  async getUnifiedMessages(limit?: number): Promise<EmailMessage[]> {
    const allAccounts = this.store.get('accounts');
    const allMessages: EmailMessage[] = [];

    for (const [accountId, storedAccount] of Object.entries(allAccounts)) {
      try {
        const messages = await this.getMessages(accountId, { limit: limit ? Math.ceil(limit / Object.keys(allAccounts).length) : 50 });
        allMessages.push(...messages);
      } catch (error) {
        log.error(`Failed to get messages for account ${accountId}:`, error);
      }
    }

    // Sort by date (newest first)
    allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return limit ? allMessages.slice(0, limit) : allMessages;
  }

  /**
   * Get smart mailbox messages based on criteria
   */
  async getSmartMailboxMessages(criteria: string): Promise<EmailMessage[]> {
    const allAccounts = this.store.get('accounts');
    const allMessages: EmailMessage[] = [];

    for (const [accountId] of Object.entries(allAccounts)) {
      try {
        let query = '';
        switch (criteria) {
          case 'today':
            const today = new Date().toISOString().split('T')[0];
            query = `after:${today}`;
            break;
          case 'flagged':
            query = 'is:starred';
            break;
          case 'unread':
            query = 'is:unread';
            break;
          case 'with_attachments':
            query = 'has:attachment';
            break;
          default:
            continue;
        }

        const messages = await this.searchMessages(accountId, query, { limit: 100 });
        allMessages.push(...messages);
      } catch (error) {
        log.error(`Failed to get smart mailbox messages for account ${accountId}:`, error);
      }
    }

    return allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get message thread (conversation)
   */
  async getMessageThread(accountId: string, threadId: string): Promise<EmailMessage[]> {
    const gmail = await this.getGmailClient(accountId);
    
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId
    });

    const threadMessages: EmailMessage[] = [];
    
    if (response.data.messages) {
      for (const message of response.data.messages) {
        if (message.id) {
          const convertedMessage = await this.convertGmailMessage(message, accountId);
          if (convertedMessage) {
            threadMessages.push(convertedMessage);
          }
        }
      }
    }

    // Sort by date
    return threadMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Schedule message (simplified implementation - stores locally and sends via setTimeout)
   */
  async scheduleMessage(
    accountId: string, 
    message: {
      to: string[]
      cc?: string[]
      bcc?: string[]
      subject: string
      body: string
      fromAlias?: string
    }, 
    scheduledDate: Date
  ): Promise<string> {
    const scheduledId = uuidv4();
    
    // Calculate delay
    const delay = scheduledDate.getTime() - Date.now();
    
    if (delay <= 0) {
      throw new Error('Scheduled date must be in the future');
    }

    // Convert message format
    const emailMessage: Partial<EmailMessage> = {
      to: message.to.map(addr => ({ address: addr, name: '' })),
      cc: message.cc?.map(addr => ({ address: addr, name: '' })),
      bcc: message.bcc?.map(addr => ({ address: addr, name: '' })),
      subject: message.subject,
      bodyText: message.body,
      from: { address: message.fromAlias || 'me', name: '' }
    };

    // Schedule the send
    setTimeout(async () => {
      try {
        await this.sendMessage(accountId, emailMessage);
        log.info(`Scheduled message ${scheduledId} sent successfully`);
      } catch (error) {
        log.error(`Failed to send scheduled message ${scheduledId}:`, error);
      }
    }, delay);

    log.info(`Message scheduled for ${scheduledDate.toISOString()}`);
    return scheduledId;
  }

  /**
   * Get scheduled messages (placeholder - in real implementation would store in database)
   */
  async getScheduledMessages(accountId: string): Promise<any[]> {
    // TODO: Implement proper scheduled message storage
    return [];
  }

  /**
   * Cancel scheduled message
   */
  async cancelScheduledMessage(accountId: string, messageId: string): Promise<void> {
    // TODO: Implement proper scheduled message cancellation
    log.info(`Scheduled message ${messageId} cancelled`);
  }

  /**
   * Get email aliases for account
   */
  async getEmailAliases(accountId: string): Promise<any[]> {
    const gmail = await this.getGmailClient(accountId);
    
    try {
      const response = await gmail.users.settings.sendAs.list({
        userId: 'me'
      });

      return response.data.sendAs?.map((alias, index) => ({
        id: `${accountId}_${index}`,
        accountId,
        address: alias.sendAsEmail || '',
        name: alias.displayName || alias.sendAsEmail || '',
        isDefault: alias.isDefault || false,
        isVerified: alias.verificationStatus === 'accepted'
      })) || [];
    } catch (error) {
      log.error('Failed to get email aliases:', error);
      return [];
    }
  }

  /**
   * Add email alias
   */
  async addEmailAlias(accountId: string, address: string, name: string): Promise<any> {
    const gmail = await this.getGmailClient(accountId);
    
    const response = await gmail.users.settings.sendAs.create({
      userId: 'me',
      requestBody: {
        sendAsEmail: address,
        displayName: name,
        treatAsAlias: true
      }
    });

    return {
      id: uuidv4(),
      accountId,
      address,
      name,
      isDefault: false,
      isVerified: false
    };
  }

  /**
   * Remove email alias
   */
  async removeEmailAlias(accountId: string, aliasAddress: string): Promise<void> {
    const gmail = await this.getGmailClient(accountId);
    
    await gmail.users.settings.sendAs.delete({
      userId: 'me',
      sendAsEmail: aliasAddress
    });
    
    log.info(`Email alias ${aliasAddress} removed`);
  }

  /**
   * Start IDLE sync (for Gmail, we'll use periodic polling)
   */
  async startIdle(accountId: string): Promise<void> {
    // Gmail doesn't support IMAP IDLE, so we'll do more frequent polling
    const existingInterval = this.syncIntervals.get(accountId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Poll every 30 seconds for IDLE simulation
    const interval = setInterval(async () => {
      try {
        await this.syncAccount(accountId);
      } catch (error) {
        log.error(`IDLE sync error for account ${accountId}:`, error);
      }
    }, 30000); // 30 seconds

    this.syncIntervals.set(accountId, interval);
    log.info(`IDLE sync started for account ${accountId}`);
  }

  /**
   * Stop IDLE sync
   */
  async stopIdle(accountId: string): Promise<void> {
    const interval = this.syncIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(accountId);
      log.info(`IDLE sync stopped for account ${accountId}`);
    }
  }

  /**
   * Cleanup resources
   */
  public shutdown(): void {
    // Stop all periodic syncs
    for (const accountId of Array.from(this.syncIntervals.keys())) {
      this.stopPeriodicSync(accountId);
    }
    
    // Stop OAuth server
    if (this.oauthServer.isRunning()) {
      this.oauthServer.stop();
    }
    
    log.info('Gmail service shut down');
  }
}