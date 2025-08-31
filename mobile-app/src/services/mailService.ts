/**
 * Mobile Mail Service - Native bridge to Rust mail engine
 * 
 * This service provides the mobile interface to the Rust mail engine,
 * handling mobile-specific concerns like offline support, background sync,
 * and mobile authentication flows.
 */

import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type {
  MailAccount,
  EmailMessage,
  MailFolder,
  MailSyncStatus,
  CreateMailAccountInput,
  UpdateMailAccountInput,
  BulkEmailOperation,
  BulkEmailOperationResult,
  EmailSearchResult,
} from '@flow-desk/shared';

// Native module interface (will be implemented via NAPI-RS bridge)
interface MailEngineNativeModule {
  initialize(config: string): Promise<boolean>;
  addAccount(accountData: string): Promise<string>;
  updateAccount(accountId: string, updates: string): Promise<string>;
  removeAccount(accountId: string): Promise<boolean>;
  listAccounts(): Promise<string>;
  syncAccount(accountId: string): Promise<string>;
  syncAllAccounts(): Promise<string>;
  getMessages(accountId: string, folderId?: string, options?: string): Promise<string>;
  sendMessage(accountId: string, message: string): Promise<string>;
  searchMessages(query: string, options?: string): Promise<string>;
  getFolders(accountId: string): Promise<string>;
  markMessageRead(accountId: string, messageId: string, read: boolean): Promise<boolean>;
  getAuthUrl(provider: string): Promise<string>;
  handleOAuthCallback(code: string, state: string, accountId: string): Promise<string>;
  performBulkOperation(operation: string): Promise<string>;
  getSyncStatus(): Promise<string>;
  startBackgroundSync(): Promise<boolean>;
  stopBackgroundSync(): Promise<boolean>;
}

// Offline queue item
interface OfflineQueueItem {
  id: string;
  type: 'send' | 'mark_read' | 'move' | 'delete' | 'star';
  accountId: string;
  data: any;
  timestamp: Date;
  attempts: number;
}

// Sync queue for background operations
interface SyncQueueItem {
  accountId: string;
  priority: 'high' | 'normal' | 'low';
  operation: 'full_sync' | 'incremental_sync' | 'folder_sync';
  folderId?: string;
  scheduledAt: Date;
}

export class MobileMailService {
  private static instance: MobileMailService | null = null;
  private nativeModule: MailEngineNativeModule | null = null;
  private database: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private isOnline = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private offlineQueue: OfflineQueueItem[] = [];
  private syncQueue: SyncQueueItem[] = [];

  private constructor() {
    this.setupNetworkListener();
    this.loadOfflineQueue();
  }

  static getInstance(): MobileMailService {
    if (!MobileMailService.instance) {
      MobileMailService.instance = new MobileMailService();
    }
    return MobileMailService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Initialize SQLite database for offline caching
      this.database = await SQLite.openDatabaseAsync('flowdesk_mail.db');
      await this.initializeDatabase();

      // Get native module (will be available after NAPI-RS bridge is built)
      this.nativeModule = NativeModules.FlowDeskMailEngine;
      
      if (!this.nativeModule) {
        console.warn('Native mail engine module not available, running in mock mode');
        // In development or if native module isn't available, use mock implementation
        this.nativeModule = this.createMockNativeModule();
      }

      // Initialize the Rust mail engine
      const config = {
        database_path: `${Platform.OS === 'ios' ? 'Documents' : 'files'}/flowdesk_mail.db`,
        auth_config: {
          google_client_id: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
          microsoft_client_id: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '',
          redirect_uri: 'flowdesk://oauth/callback',
        },
        sync_config: {
          sync_interval_seconds: 300, // 5 minutes
          max_concurrent_syncs: 3,
          batch_size: 50,
          retry_attempts: 3,
          enable_push_notifications: true,
        },
        rate_limiting: {
          gmail_requests_per_second: 5,
          outlook_requests_per_second: 10,
          imap_concurrent_connections: 2,
        },
        mobile_config: {
          background_sync_enabled: true,
          offline_mode_enabled: true,
          cache_attachments: true,
          max_cache_size_mb: 500,
        },
      };

      const initialized = await this.nativeModule.initialize(JSON.stringify(config));
      
      if (initialized) {
        this.isInitialized = true;
        this.startBackgroundSync();
        this.setupEventListeners();
        console.log('Mobile mail service initialized successfully');
      }

      return initialized;
    } catch (error) {
      console.error('Failed to initialize mobile mail service:', error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.database) return;

    await this.database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      
      -- Cached messages table for offline access
      CREATE TABLE IF NOT EXISTS cached_messages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        folder_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        from_address TEXT NOT NULL,
        snippet TEXT NOT NULL,
        body_html TEXT,
        body_text TEXT,
        received_at INTEGER NOT NULL,
        flags TEXT NOT NULL, -- JSON
        labels TEXT NOT NULL, -- JSON array
        sync_status TEXT DEFAULT 'synced',
        cached_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES cached_accounts (id) ON DELETE CASCADE
      );

      -- Cached accounts table
      CREATE TABLE IF NOT EXISTS cached_accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        display_name TEXT NOT NULL,
        last_sync_at INTEGER,
        sync_status TEXT DEFAULT 'idle',
        cached_at INTEGER NOT NULL
      );

      -- Offline operation queue
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        account_id TEXT NOT NULL,
        data TEXT NOT NULL, -- JSON
        timestamp INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending'
      );

      -- Draft messages for offline compose
      CREATE TABLE IF NOT EXISTS draft_messages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        to_addresses TEXT NOT NULL, -- JSON array
        cc_addresses TEXT, -- JSON array
        bcc_addresses TEXT, -- JSON array
        subject TEXT,
        body_html TEXT,
        body_text TEXT,
        attachments TEXT, -- JSON array
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local'
      );

      -- Attachment cache
      CREATE TABLE IF NOT EXISTS attachment_cache (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        local_path TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_cached_messages_account_folder 
        ON cached_messages(account_id, folder_id);
      CREATE INDEX IF NOT EXISTS idx_cached_messages_received_at 
        ON cached_messages(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_offline_queue_status 
        ON offline_queue(status, timestamp);
      CREATE INDEX IF NOT EXISTS idx_attachment_cache_message 
        ON attachment_cache(message_id);
    `);
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        // Back online - process offline queue
        this.processOfflineQueue();
      }
    });
  }

  private setupEventListeners(): void {
    // Listen for native events from the Rust engine
    DeviceEventEmitter.addListener('MailEngine:SyncStarted', (event) => {
      DeviceEventEmitter.emit('Mail:SyncStarted', event);
    });

    DeviceEventEmitter.addListener('MailEngine:SyncCompleted', (event) => {
      DeviceEventEmitter.emit('Mail:SyncCompleted', event);
      this.updateCacheAfterSync(event.accountId, event.messages);
    });

    DeviceEventEmitter.addListener('MailEngine:SyncError', (event) => {
      DeviceEventEmitter.emit('Mail:SyncError', event);
    });

    DeviceEventEmitter.addListener('MailEngine:NewMessages', (event) => {
      DeviceEventEmitter.emit('Mail:NewMessages', event);
      this.cacheNewMessages(event.messages);
    });

    DeviceEventEmitter.addListener('MailEngine:AuthRequired', (event) => {
      DeviceEventEmitter.emit('Mail:AuthRequired', event);
    });
  }

  // Account Management
  async addAccount(accountData: CreateMailAccountInput): Promise<MailAccount> {
    await this.ensureInitialized();

    try {
      const accountJson = await this.nativeModule!.addAccount(JSON.stringify(accountData));
      const account: MailAccount = JSON.parse(accountJson);

      // Cache account locally
      await this.cacheAccount(account);
      
      // Trigger initial sync if online
      if (this.isOnline) {
        this.syncAccount(account.id);
      }

      return account;
    } catch (error) {
      console.error('Failed to add mail account:', error);
      throw error;
    }
  }

  async updateAccount(accountId: string, updates: UpdateMailAccountInput): Promise<MailAccount | null> {
    await this.ensureInitialized();

    try {
      const updatedAccountJson = await this.nativeModule!.updateAccount(accountId, JSON.stringify(updates));
      const account: MailAccount = JSON.parse(updatedAccountJson);

      // Update cached account
      await this.updateCachedAccount(account);

      return account;
    } catch (error) {
      console.error('Failed to update mail account:', error);
      throw error;
    }
  }

  async removeAccount(accountId: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const removed = await this.nativeModule!.removeAccount(accountId);
      
      if (removed) {
        // Remove from local cache
        await this.removeCachedAccount(accountId);
      }

      return removed;
    } catch (error) {
      console.error('Failed to remove mail account:', error);
      return false;
    }
  }

  async listAccounts(): Promise<MailAccount[]> {
    await this.ensureInitialized();

    try {
      if (this.isOnline) {
        const accountsJson = await this.nativeModule!.listAccounts();
        const accounts: MailAccount[] = JSON.parse(accountsJson);
        
        // Update cache
        for (const account of accounts) {
          await this.cacheAccount(account);
        }
        
        return accounts;
      } else {
        // Return cached accounts when offline
        return await this.getCachedAccounts();
      }
    } catch (error) {
      console.error('Failed to list mail accounts:', error);
      // Fallback to cached accounts on error
      return await this.getCachedAccounts();
    }
  }

  // Message Operations
  async getMessages(accountId: string, folderId?: string, options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<EmailMessage[]> {
    await this.ensureInitialized();

    try {
      if (this.isOnline) {
        const messagesJson = await this.nativeModule!.getMessages(
          accountId, 
          folderId, 
          options ? JSON.stringify(options) : undefined
        );
        const messages: EmailMessage[] = JSON.parse(messagesJson);
        
        // Cache messages locally
        await this.cacheMessages(messages);
        
        return messages;
      } else {
        // Return cached messages when offline
        return await this.getCachedMessages(accountId, folderId, options);
      }
    } catch (error) {
      console.error('Failed to get messages:', error);
      // Fallback to cached messages on error
      return await this.getCachedMessages(accountId, folderId, options);
    }
  }

  async sendMessage(accountId: string, message: Partial<EmailMessage>): Promise<string> {
    await this.ensureInitialized();

    if (this.isOnline) {
      try {
        const messageId = await this.nativeModule!.sendMessage(accountId, JSON.stringify(message));
        return messageId;
      } catch (error) {
        // Add to offline queue if send fails
        await this.addToOfflineQueue('send', accountId, message);
        throw error;
      }
    } else {
      // Add to offline queue when offline
      const queueId = await this.addToOfflineQueue('send', accountId, message);
      throw new Error(`Message queued for sending when online (Queue ID: ${queueId})`);
    }
  }

  async markMessageRead(accountId: string, messageId: string, read: boolean): Promise<boolean> {
    await this.ensureInitialized();

    // Update local cache immediately for responsive UI
    await this.updateCachedMessageFlags(messageId, { isRead: read });

    if (this.isOnline) {
      try {
        return await this.nativeModule!.markMessageRead(accountId, messageId, read);
      } catch (error) {
        // Add to offline queue if operation fails
        await this.addToOfflineQueue('mark_read', accountId, { messageId, read });
        return false;
      }
    } else {
      // Add to offline queue when offline
      await this.addToOfflineQueue('mark_read', accountId, { messageId, read });
      return true; // Return true since we updated cache
    }
  }

  async searchMessages(query: string, options?: {
    accountId?: string;
    limit?: number;
  }): Promise<EmailSearchResult> {
    await this.ensureInitialized();

    try {
      if (this.isOnline) {
        const searchResultJson = await this.nativeModule!.searchMessages(
          query, 
          options ? JSON.stringify(options) : undefined
        );
        return JSON.parse(searchResultJson);
      } else {
        // Perform local search on cached messages
        return await this.searchCachedMessages(query, options);
      }
    } catch (error) {
      console.error('Failed to search messages:', error);
      // Fallback to local search on error
      return await this.searchCachedMessages(query, options);
    }
  }

  // Sync Operations
  async syncAccount(accountId: string): Promise<MailSyncStatus> {
    await this.ensureInitialized();

    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const syncResultJson = await this.nativeModule!.syncAccount(accountId);
      return JSON.parse(syncResultJson);
    } catch (error) {
      console.error('Failed to sync account:', error);
      throw error;
    }
  }

  async syncAllAccounts(): Promise<Record<string, MailSyncStatus>> {
    await this.ensureInitialized();

    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const syncResultJson = await this.nativeModule!.syncAllAccounts();
      return JSON.parse(syncResultJson);
    } catch (error) {
      console.error('Failed to sync all accounts:', error);
      throw error;
    }
  }

  // OAuth Authentication
  async getAuthUrl(provider: 'gmail' | 'outlook'): Promise<string> {
    await this.ensureInitialized();
    
    try {
      return await this.nativeModule!.getAuthUrl(provider);
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      throw error;
    }
  }

  async handleOAuthCallback(code: string, state: string, accountId: string): Promise<any> {
    await this.ensureInitialized();

    try {
      const resultJson = await this.nativeModule!.handleOAuthCallback(code, state, accountId);
      return JSON.parse(resultJson);
    } catch (error) {
      console.error('Failed to handle OAuth callback:', error);
      throw error;
    }
  }

  // Background sync management
  private startBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && this.isInitialized) {
        try {
          await this.nativeModule!.startBackgroundSync();
        } catch (error) {
          console.error('Background sync error:', error);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Offline queue management
  private async addToOfflineQueue(
    type: OfflineQueueItem['type'],
    accountId: string,
    data: any
  ): Promise<string> {
    if (!this.database) return '';

    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: OfflineQueueItem = {
      id,
      type,
      accountId,
      data,
      timestamp: new Date(),
      attempts: 0,
    };

    await this.database.runAsync(
      'INSERT INTO offline_queue (id, type, account_id, data, timestamp, attempts) VALUES (?, ?, ?, ?, ?, ?)',
      [id, type, accountId, JSON.stringify(data), Date.now(), 0]
    );

    this.offlineQueue.push(item);
    return id;
  }

  private async loadOfflineQueue(): Promise<void> {
    if (!this.database) return;

    try {
      const result = await this.database.getAllAsync(
        'SELECT * FROM offline_queue WHERE status = "pending" ORDER BY timestamp ASC'
      ) as any[];

      this.offlineQueue = result.map(row => ({
        id: row.id,
        type: row.type,
        accountId: row.account_id,
        data: JSON.parse(row.data),
        timestamp: new Date(row.timestamp),
        attempts: row.attempts,
      }));
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || !this.database) return;

    console.log(`Processing ${this.offlineQueue.length} offline operations`);

    for (const item of this.offlineQueue) {
      try {
        let success = false;

        switch (item.type) {
          case 'send':
            await this.nativeModule!.sendMessage(item.accountId, JSON.stringify(item.data));
            success = true;
            break;
          case 'mark_read':
            await this.nativeModule!.markMessageRead(
              item.accountId,
              item.data.messageId,
              item.data.read
            );
            success = true;
            break;
          // Add other operation types as needed
        }

        if (success) {
          await this.database.runAsync(
            'UPDATE offline_queue SET status = "completed" WHERE id = ?',
            [item.id]
          );
          console.log(`Processed offline operation: ${item.type}`);
        }
      } catch (error) {
        console.error(`Failed to process offline operation ${item.id}:`, error);
        
        // Increment attempt count
        await this.database.runAsync(
          'UPDATE offline_queue SET attempts = attempts + 1 WHERE id = ?',
          [item.id]
        );

        // Remove from queue if too many attempts
        if (item.attempts >= 3) {
          await this.database.runAsync(
            'UPDATE offline_queue SET status = "failed" WHERE id = ?',
            [item.id]
          );
        }
      }
    }

    // Reload queue after processing
    await this.loadOfflineQueue();
  }

  // Cache management methods
  private async cacheAccount(account: MailAccount): Promise<void> {
    if (!this.database) return;

    await this.database.runAsync(
      `INSERT OR REPLACE INTO cached_accounts 
       (id, email, provider, display_name, last_sync_at, sync_status, cached_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.email,
        account.provider,
        account.name,
        account.lastSyncAt ? account.lastSyncAt.getTime() : null,
        account.status,
        Date.now(),
      ]
    );
  }

  private async getCachedAccounts(): Promise<MailAccount[]> {
    if (!this.database) return [];

    try {
      const result = await this.database.getAllAsync(
        'SELECT * FROM cached_accounts ORDER BY cached_at DESC'
      ) as any[];

      return result.map(row => ({
        id: row.id,
        userId: 'current-user', // TODO: Get from auth context
        name: row.display_name,
        email: row.email,
        provider: row.provider,
        config: {}, // Simplified for cache
        status: row.sync_status,
        lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
        syncIntervalMinutes: 5,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error('Failed to get cached accounts:', error);
      return [];
    }
  }

  private async cacheMessages(messages: EmailMessage[]): Promise<void> {
    if (!this.database) return;

    for (const message of messages) {
      await this.database.runAsync(
        `INSERT OR REPLACE INTO cached_messages 
         (id, account_id, folder_id, subject, from_address, snippet, body_html, body_text, 
          received_at, flags, labels, sync_status, cached_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.accountId,
          message.folder,
          message.subject,
          message.from.address,
          message.snippet,
          message.bodyHtml || '',
          message.bodyText || '',
          message.date.getTime(),
          JSON.stringify(message.flags),
          JSON.stringify(message.labels),
          'synced',
          Date.now(),
        ]
      );
    }
  }

  private async getCachedMessages(
    accountId: string,
    folderId?: string,
    options?: { limit?: number; offset?: number; search?: string }
  ): Promise<EmailMessage[]> {
    if (!this.database) return [];

    try {
      let query = 'SELECT * FROM cached_messages WHERE account_id = ?';
      const params: any[] = [accountId];

      if (folderId) {
        query += ' AND folder_id = ?';
        params.push(folderId);
      }

      if (options?.search) {
        query += ' AND (subject LIKE ? OR from_address LIKE ? OR snippet LIKE ?)';
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      query += ' ORDER BY received_at DESC';

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const result = await this.database.getAllAsync(query, params) as any[];

      return result.map(row => ({
        id: row.id,
        accountId: row.account_id,
        providerId: row.id,
        threadId: row.id, // Simplified for cache
        subject: row.subject,
        bodyHtml: row.body_html,
        bodyText: row.body_text,
        snippet: row.snippet,
        from: { address: row.from_address },
        to: [],
        cc: [],
        bcc: [],
        replyTo: [],
        date: new Date(row.received_at),
        flags: JSON.parse(row.flags),
        labels: JSON.parse(row.labels),
        folder: row.folder_id,
        importance: 'normal',
        priority: 'normal',
        size: 0,
        attachments: [],
        headers: {},
        messageId: row.id,
        references: [],
        createdAt: new Date(row.cached_at),
        updatedAt: new Date(row.cached_at),
      }));
    } catch (error) {
      console.error('Failed to get cached messages:', error);
      return [];
    }
  }

  private async searchCachedMessages(
    query: string,
    options?: { accountId?: string; limit?: number }
  ): Promise<EmailSearchResult> {
    const messages = await this.getCachedMessages(
      options?.accountId || '',
      undefined,
      { search: query, limit: options?.limit }
    );

    return {
      query,
      totalCount: messages.length,
      messages,
      took: 0, // Local search is fast
      suggestions: [],
    };
  }

  // Helper methods
  private async updateCachedMessageFlags(messageId: string, flags: Partial<any>): Promise<void> {
    if (!this.database) return;

    try {
      const result = await this.database.getFirstAsync(
        'SELECT flags FROM cached_messages WHERE id = ?',
        [messageId]
      ) as any;

      if (result) {
        const currentFlags = JSON.parse(result.flags);
        const updatedFlags = { ...currentFlags, ...flags };

        await this.database.runAsync(
          'UPDATE cached_messages SET flags = ? WHERE id = ?',
          [JSON.stringify(updatedFlags), messageId]
        );
      }
    } catch (error) {
      console.error('Failed to update cached message flags:', error);
    }
  }

  private async updateCacheAfterSync(accountId: string, messages: EmailMessage[]): Promise<void> {
    // Update cached messages after sync
    await this.cacheMessages(messages);
  }

  private async cacheNewMessages(messages: EmailMessage[]): Promise<void> {
    // Cache new messages from push notifications
    await this.cacheMessages(messages);
  }

  private async updateCachedAccount(account: MailAccount): Promise<void> {
    await this.cacheAccount(account);
  }

  private async removeCachedAccount(accountId: string): Promise<void> {
    if (!this.database) return;

    await this.database.runAsync('DELETE FROM cached_accounts WHERE id = ?', [accountId]);
    await this.database.runAsync('DELETE FROM cached_messages WHERE account_id = ?', [accountId]);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Mock implementation for development
  private createMockNativeModule(): MailEngineNativeModule {
    return {
      initialize: async () => true,
      addAccount: async (accountData) => {
        const account = JSON.parse(accountData);
        return JSON.stringify({ ...account, id: `mock_${Date.now()}` });
      },
      updateAccount: async (accountId, updates) => {
        return JSON.stringify({ id: accountId, ...JSON.parse(updates) });
      },
      removeAccount: async () => true,
      listAccounts: async () => JSON.stringify([]),
      syncAccount: async (accountId) => JSON.stringify({ accountId, status: 'idle', stats: {} }),
      syncAllAccounts: async () => JSON.stringify({}),
      getMessages: async () => JSON.stringify([]),
      sendMessage: async () => `mock_msg_${Date.now()}`,
      searchMessages: async (query) => JSON.stringify({
        query,
        totalCount: 0,
        messages: [],
        took: 0,
      }),
      getFolders: async () => JSON.stringify([]),
      markMessageRead: async () => true,
      getAuthUrl: async (provider) => `https://accounts.google.com/oauth/authorize?provider=${provider}`,
      handleOAuthCallback: async () => JSON.stringify({ success: true }),
      performBulkOperation: async () => JSON.stringify({ successful: 0, failed: 0, errors: [] }),
      getSyncStatus: async () => JSON.stringify({}),
      startBackgroundSync: async () => true,
      stopBackgroundSync: async () => true,
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.nativeModule) {
      await this.nativeModule.stopBackgroundSync();
    }

    if (this.database) {
      await this.database.closeAsync();
    }

    this.isInitialized = false;
  }
}

// Singleton export
export const mailService = MobileMailService.getInstance();

// Helper functions
export const initializeMailService = () => mailService.initialize();
export const getMailService = () => mailService;