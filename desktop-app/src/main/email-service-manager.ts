/**
 * Email Service Manager
 * 
 * Central coordinator for all email providers with real-time sync,
 * offline queue management, and unified API interface
 */

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'
import { BaseEmailProvider } from './providers/base-email-provider'
import { GmailProvider } from './providers/gmail-provider'
import { ImapProvider } from './providers/imap-provider'
import { ImapConnectionPool } from './imap-client'
import { SmtpConnectionPool } from './smtp-client'
import OAuth2Manager from './oauth-manager'
import EmailCache from './email-cache'
import { detectProvider, EMAIL_PROVIDERS } from './providers/provider-config'
import type { 
  MailAccount, 
  EmailMessage, 
  MailFolder, 
  MailSyncStatus,
  CreateMailAccountInput,
  UpdateMailAccountInput,
  BulkEmailOperation,
  BulkEmailOperationResult
} from '@flow-desk/shared'

export interface EmailServiceConfig {
  encryptionKey: string
  cacheDirectory?: string
  maxConcurrentSyncs?: number
  syncIntervalMinutes?: number
  offlineQueueSize?: number
  enablePushNotifications?: boolean
}

export interface UnifiedInbox {
  messages: EmailMessage[]
  totalCount: number
  unreadCount: number
  accounts: string[]
}

export interface OfflineQueueItem {
  id: string
  type: 'send' | 'markRead' | 'markStarred' | 'move' | 'delete'
  accountId: string
  data: any
  timestamp: Date
  retryCount: number
  lastError?: string
}

export class EmailServiceManager extends EventEmitter {
  private config: EmailServiceConfig
  private providers: Map<string, BaseEmailProvider> = new Map()
  private accounts: Map<string, MailAccount> = new Map()
  private syncStatus: Map<string, MailSyncStatus> = new Map()
  private offlineQueue: OfflineQueueItem[] = []
  private syncTimer?: NodeJS.Timeout
  private isInitialized = false
  private mainWindow?: BrowserWindow

  // Service components
  private imapPool: ImapConnectionPool
  private smtpPool: SmtpConnectionPool
  private oauth2Manager: OAuth2Manager
  private cache: EmailCache

  // Sync control
  private activeSyncs = 0
  private maxConcurrentSyncs: number
  private syncIntervalMs: number

  constructor(config: EmailServiceConfig, mainWindow?: BrowserWindow) {
    super()
    this.config = config
    this.mainWindow = mainWindow
    this.maxConcurrentSyncs = config.maxConcurrentSyncs || 3
    this.syncIntervalMs = (config.syncIntervalMinutes || 15) * 60 * 1000

    // Initialize service components
    this.imapPool = new ImapConnectionPool(10)
    this.smtpPool = new SmtpConnectionPool(5)
    this.oauth2Manager = new OAuth2Manager(config.encryptionKey)
    this.cache = new EmailCache(config.cacheDirectory)

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Connection pool events
    this.imapPool.on('connectionError', (accountId, error) => {
      log.error(`IMAP connection error for ${accountId}:`, error)
      this.handleConnectionError(accountId, error)
    })

    this.smtpPool.on('sendError', (accountId, error) => {
      log.error(`SMTP send error for ${accountId}:`, error)
      this.emit('sendError', accountId, error)
    })

    // OAuth token refresh events
    this.oauth2Manager.on('tokenRefresh', (accountId, tokens) => {
      log.info(`Tokens refreshed for account ${accountId}`)
      this.handleTokenRefresh(accountId, tokens)
    })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      log.info('Initializing Email Service Manager')

      // Load existing accounts from cache/storage
      await this.loadAccounts()

      // Initialize providers for existing accounts
      await this.initializeProviders()

      // Start background sync
      this.startBackgroundSync()

      // Process offline queue
      this.processOfflineQueue()

      this.isInitialized = true
      this.emit('initialized')

      log.info('Email Service Manager initialized successfully')
    } catch (error) {
      log.error('Failed to initialize Email Service Manager:', error)
      throw error
    }
  }

  private async loadAccounts(): Promise<void> {
    // In a real implementation, this would load from persistent storage
    // For now, we'll maintain accounts in memory
    log.info('Loading email accounts from storage')
  }

  private async initializeProviders(): Promise<void> {
    for (const [accountId, account] of this.accounts.entries()) {
      try {
        await this.createProvider(account)
      } catch (error) {
        log.error(`Failed to initialize provider for account ${accountId}:`, error)
      }
    }
  }

  private async createProvider(account: MailAccount): Promise<BaseEmailProvider> {
    let provider: BaseEmailProvider

    switch (account.provider) {
      case 'gmail':
        provider = new GmailProvider(
          account, 
          this.oauth2Manager,
          this.imapPool, 
          this.smtpPool, 
          this.cache
        )
        break
      
      case 'outlook':
        // Would create OutlookProvider when implemented
        throw new Error('Outlook provider not yet implemented')
      
      case 'yahoo':
      case 'fastmail':
      case 'icloud':
      case 'imap':
      default:
        provider = new ImapProvider(
          account,
          this.imapPool,
          this.smtpPool,
          this.cache,
          this.config.encryptionKey
        )
        break
    }

    // Setup provider event handlers
    this.setupProviderEventHandlers(provider)

    // Initialize provider
    await provider.initialize()

    // Store provider
    this.providers.set(account.id, provider)

    log.info(`Created and initialized ${provider.getProviderType()} provider for account ${account.id}`)
    return provider
  }

  private setupProviderEventHandlers(provider: BaseEmailProvider): void {
    const accountId = provider.getAccount().id

    provider.on('newMail', (count) => {
      this.emit('newMail', accountId, count)
      this.notifyMainWindow('mail:new-messages', { accountId, count })
    })

    provider.on('messageUpdate', (messageId, updates) => {
      this.emit('messageUpdate', accountId, messageId, updates)
      this.notifyMainWindow('mail:message-updated', { accountId, messageId, updates })
    })

    provider.on('messageDeleted', (messageId) => {
      this.emit('messageDeleted', accountId, messageId)
      this.notifyMainWindow('mail:message-deleted', { accountId, messageId })
    })

    provider.on('syncStatusUpdate', (status) => {
      this.syncStatus.set(accountId, status)
      this.emit('syncStatusUpdate', accountId, status)
      this.notifyMainWindow('mail:sync-status-update', { accountId, status })
    })

    provider.on('syncError', (error, operation) => {
      log.error(`Sync error for account ${accountId} during ${operation}:`, error)
      this.emit('syncError', accountId, error, operation)
      this.notifyMainWindow('mail:sync-error', { accountId, error: error.message, operation })
    })

    provider.on('error', (error) => {
      log.error(`Provider error for account ${accountId}:`, error)
      this.handleProviderError(accountId, error)
    })
  }

  private notifyMainWindow(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  // Account Management
  async addAccount(accountInput: CreateMailAccountInput): Promise<MailAccount> {
    const accountId = uuidv4()
    const now = new Date()

    const account: MailAccount = {
      id: accountId,
      userId: accountInput.userId,
      name: accountInput.name,
      email: accountInput.email,
      provider: accountInput.provider,
      config: accountInput.config,
      credentials: accountInput.credentials,
      status: 'active',
      syncIntervalMinutes: accountInput.syncIntervalMinutes,
      isEnabled: accountInput.isEnabled,
      createdAt: now,
      updatedAt: now
    }

    // Store account
    this.accounts.set(accountId, account)
    await this.cache.upsertAccount({
      id: accountId,
      email: account.email,
      provider: account.provider,
      name: account.name
    })

    // Create and initialize provider
    try {
      await this.createProvider(account)
      
      // Start initial sync
      this.syncAccount(accountId)
      
      this.emit('accountAdded', account)
      log.info(`Added new ${account.provider} account: ${account.email}`)
      
      return account
    } catch (error) {
      // Cleanup on failure
      this.accounts.delete(accountId)
      await this.cache.deleteAccount(accountId)
      
      log.error(`Failed to add account ${account.email}:`, error)
      throw error
    }
  }

  async updateAccount(accountId: string, updates: UpdateMailAccountInput): Promise<MailAccount | null> {
    const account = this.accounts.get(accountId)
    if (!account) return null

    const updatedAccount: MailAccount = {
      ...account,
      ...updates,
      updatedAt: new Date()
    }

    this.accounts.set(accountId, updatedAccount)

    // Update provider if credentials changed
    const provider = this.providers.get(accountId)
    if (provider && updates.name) {
      // Provider doesn't need reinitializing for name changes
    }

    this.emit('accountUpdated', updatedAccount)
    return updatedAccount
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId)
    if (!account) return false

    try {
      // Stop and destroy provider
      const provider = this.providers.get(accountId)
      if (provider) {
        await provider.destroy()
        this.providers.delete(accountId)
      }

      // Remove from cache
      await this.cache.deleteAccount(accountId)

      // Remove from memory
      this.accounts.delete(accountId)
      this.syncStatus.delete(accountId)

      this.emit('accountRemoved', accountId)
      log.info(`Removed account: ${account.email}`)
      
      return true
    } catch (error) {
      log.error(`Failed to remove account ${accountId}:`, error)
      return false
    }
  }

  getAccounts(): MailAccount[] {
    return Array.from(this.accounts.values())
  }

  getAccount(accountId: string): MailAccount | null {
    return this.accounts.get(accountId) || null
  }

  // OAuth Flow Management
  async startOAuthFlow(providerId: string): Promise<MailAccount> {
    if (!['gmail', 'outlook'].includes(providerId)) {
      throw new Error(`OAuth not supported for provider: ${providerId}`)
    }

    try {
      const oauthResult = await this.oauth2Manager.startOAuthFlow(providerId)
      
      // Create account from OAuth result
      const providerConfig = EMAIL_PROVIDERS[providerId]
      const accountInput: CreateMailAccountInput = {
        userId: 'current-user', // Would come from app state
        name: oauthResult.userInfo.name || oauthResult.userInfo.email,
        email: oauthResult.userInfo.email,
        provider: providerId as any,
        config: providerConfig.config,
        credentials: this.oauth2Manager.encryptCredentials(oauthResult.credentials),
        syncIntervalMinutes: 15,
        isEnabled: true
      }

      return await this.addAccount(accountInput)
    } catch (error) {
      log.error(`OAuth flow failed for ${providerId}:`, error)
      throw error
    }
  }

  // Message Operations
  async getMessages(accountId: string, folderId?: string, options?: { limit?: number, offset?: number }): Promise<EmailMessage[]> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    try {
      return await provider.getMessages(folderId, { 
        limit: options?.limit,
        since: undefined // Could add date filtering
      })
    } catch (error) {
      log.error(`Failed to get messages for account ${accountId}:`, error)
      throw error
    }
  }

  async getUnifiedMessages(limit = 50): Promise<EmailMessage[]> {
    const allMessages: EmailMessage[] = []
    
    // Collect messages from all active providers
    const messagePromises = Array.from(this.providers.entries()).map(async ([accountId, provider]) => {
      try {
        return await provider.getMessages('INBOX', { limit: Math.ceil(limit / this.providers.size) })
      } catch (error) {
        log.error(`Failed to get messages for unified inbox from account ${accountId}:`, error)
        return []
      }
    })

    const messageArrays = await Promise.all(messagePromises)
    
    // Flatten and sort by date
    for (const messages of messageArrays) {
      allMessages.push(...messages)
    }
    
    // Sort by date (newest first) and limit
    allMessages.sort((a, b) => b.date.getTime() - a.date.getTime())
    
    return allMessages.slice(0, limit)
  }

  async sendMessage(accountId: string, options: {
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    body: string
    attachments?: Array<{ filename: string, content: Buffer, contentType?: string }>
  }): Promise<string> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    try {
      return await provider.sendMessage(options)
    } catch (error) {
      // Add to offline queue if network error
      if (this.isNetworkError(error)) {
        this.addToOfflineQueue({
          type: 'send',
          accountId,
          data: options
        })
      }
      
      log.error(`Failed to send message for account ${accountId}:`, error)
      throw error
    }
  }

  async searchMessages(query: string, options?: { accountId?: string, limit?: number }): Promise<EmailMessage[]> {
    if (options?.accountId) {
      // Search in specific account
      const provider = this.providers.get(options.accountId)
      if (!provider) {
        throw new Error(`Provider not found for account: ${options.accountId}`)
      }
      
      return await provider.searchMessages(query, { limit: options.limit })
    } else {
      // Search across all accounts
      const searchPromises = Array.from(this.providers.entries()).map(async ([accountId, provider]) => {
        try {
          return await provider.searchMessages(query, { limit: options?.limit ? Math.ceil(options.limit / this.providers.size) : 25 })
        } catch (error) {
          log.error(`Search failed for account ${accountId}:`, error)
          return []
        }
      })

      const results = await Promise.all(searchPromises)
      const allResults = results.flat()
      
      // Sort by relevance/date and limit
      allResults.sort((a, b) => b.date.getTime() - a.date.getTime())
      
      return options?.limit ? allResults.slice(0, options.limit) : allResults
    }
  }

  async markMessageRead(accountId: string, messageId: string, read: boolean): Promise<void> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    try {
      await provider.markMessageRead(messageId, read)
    } catch (error) {
      // Add to offline queue if network error
      if (this.isNetworkError(error)) {
        this.addToOfflineQueue({
          type: 'markRead',
          accountId,
          data: { messageId, read }
        })
      }
      
      throw error
    }
  }

  async markMessageStarred(accountId: string, messageId: string, starred: boolean): Promise<void> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    try {
      await provider.markMessageStarred(messageId, starred)
    } catch (error) {
      // Add to offline queue if network error
      if (this.isNetworkError(error)) {
        this.addToOfflineQueue({
          type: 'markStarred',
          accountId,
          data: { messageId, starred }
        })
      }
      
      throw error
    }
  }

  // Folder Operations
  async getFolders(accountId: string): Promise<MailFolder[]> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    return await provider.getFolders()
  }

  // Sync Operations
  async syncAccount(accountId: string, options?: { fullSync?: boolean }): Promise<MailSyncStatus> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    if (this.activeSyncs >= this.maxConcurrentSyncs) {
      throw new Error('Maximum concurrent syncs reached')
    }

    try {
      this.activeSyncs++
      this.emit('syncStarted', accountId)
      
      const result = await provider.syncAccount(options)
      
      this.syncStatus.set(accountId, result)
      this.emit('syncCompleted', accountId, result)
      
      return result
    } catch (error) {
      this.emit('syncError', accountId, error)
      throw error
    } finally {
      this.activeSyncs--
    }
  }

  async syncAllAccounts(): Promise<MailSyncStatus[]> {
    const results: MailSyncStatus[] = []
    const accountIds = Array.from(this.providers.keys())
    
    // Process accounts in batches to respect concurrency limits
    for (let i = 0; i < accountIds.length; i += this.maxConcurrentSyncs) {
      const batch = accountIds.slice(i, i + this.maxConcurrentSyncs)
      
      const batchPromises = batch.map(async (accountId) => {
        try {
          return await this.syncAccount(accountId)
        } catch (error) {
          log.error(`Sync failed for account ${accountId}:`, error)
          return {
            accountId,
            status: 'error' as const,
            lastError: {
              message: error instanceof Error ? error.message : 'Sync failed',
              code: 'SYNC_ERROR',
              timestamp: new Date()
            },
            stats: { totalMessages: 0, newMessages: 0, updatedMessages: 0, deletedMessages: 0, syncErrors: 1 }
          }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }

  getSyncStatus(): Record<string, MailSyncStatus> {
    const status: Record<string, MailSyncStatus> = {}
    
    for (const [accountId, syncStatus] of this.syncStatus.entries()) {
      status[accountId] = syncStatus
    }
    
    return status
  }

  // Background Operations
  private startBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(async () => {
      try {
        log.info('Starting background sync for all accounts')
        await this.syncAllAccounts()
      } catch (error) {
        log.error('Background sync failed:', error)
      }
    }, this.syncIntervalMs)

    log.info(`Background sync started with ${this.syncIntervalMs / 1000 / 60} minute interval`)
  }

  // Offline Queue Management
  private addToOfflineQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      timestamp: new Date(),
      retryCount: 0,
      ...item
    }

    this.offlineQueue.push(queueItem)
    
    // Limit queue size
    if (this.offlineQueue.length > (this.config.offlineQueueSize || 1000)) {
      this.offlineQueue.shift() // Remove oldest item
    }

    log.info(`Added item to offline queue: ${item.type}`)
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return

    log.info(`Processing ${this.offlineQueue.length} items from offline queue`)

    const itemsToRetry: OfflineQueueItem[] = []
    
    for (const item of this.offlineQueue) {
      try {
        await this.processOfflineQueueItem(item)
        log.info(`Successfully processed offline queue item: ${item.id}`)
      } catch (error) {
        item.retryCount++
        item.lastError = error instanceof Error ? error.message : 'Unknown error'
        
        if (item.retryCount < 3) {
          itemsToRetry.push(item)
          log.warn(`Offline queue item failed, will retry: ${item.id}`)
        } else {
          log.error(`Offline queue item failed after 3 retries, discarding: ${item.id}`)
        }
      }
    }

    this.offlineQueue = itemsToRetry

    // Schedule next processing
    setTimeout(() => this.processOfflineQueue(), 60000) // Process every minute
  }

  private async processOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
    const provider = this.providers.get(item.accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${item.accountId}`)
    }

    switch (item.type) {
      case 'send':
        await provider.sendMessage(item.data)
        break
      case 'markRead':
        await provider.markMessageRead(item.data.messageId, item.data.read)
        break
      case 'markStarred':
        await provider.markMessageStarred(item.data.messageId, item.data.starred)
        break
      case 'move':
        await provider.moveMessage(item.data.messageId, item.data.targetFolder)
        break
      case 'delete':
        await provider.deleteMessage(item.data.messageId)
        break
      default:
        throw new Error(`Unknown offline queue item type: ${(item as any).type}`)
    }
  }

  // Error Handling
  private handleConnectionError(accountId: string, error: Error): void {
    log.error(`Connection error for account ${accountId}:`, error)
    
    // Update account status
    const account = this.accounts.get(accountId)
    if (account) {
      account.status = 'error'
      account.updatedAt = new Date()
      this.emit('accountStatusChanged', account)
    }
  }

  private handleTokenRefresh(accountId: string, tokens: any): void {
    const account = this.accounts.get(accountId)
    if (account && account.credentials) {
      // Update stored credentials with new tokens
      account.credentials.accessToken = tokens.accessToken
      account.credentials.refreshToken = tokens.refreshToken
      account.credentials.tokenExpiresAt = tokens.expiresAt
      account.updatedAt = new Date()
    }
  }

  private handleProviderError(accountId: string, error: Error): void {
    log.error(`Provider error for account ${accountId}:`, error)
    this.emit('providerError', accountId, error)
  }

  private isNetworkError(error: any): boolean {
    const networkErrorCodes = [
      'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 
      'ETIMEDOUT', 'ENETDOWN', 'ENETUNREACH'
    ]
    
    return networkErrorCodes.some(code => 
      error?.code === code || error?.message?.includes(code)
    )
  }

  // IDLE/Push Notifications
  async startIdle(accountId: string): Promise<void> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    await provider.startIdle()
  }

  async stopIdle(accountId: string): Promise<void> {
    const provider = this.providers.get(accountId)
    if (!provider) {
      throw new Error(`Provider not found for account: ${accountId}`)
    }

    await provider.stopIdle()
  }

  // Cleanup
  async shutdown(): Promise<void> {
    log.info('Shutting down Email Service Manager')

    // Stop background sync
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }

    // Destroy all providers
    const destroyPromises = Array.from(this.providers.values()).map(provider => 
      provider.destroy().catch(error => 
        log.error('Error destroying provider:', error)
      )
    )
    
    await Promise.all(destroyPromises)
    this.providers.clear()

    // Close connection pools
    await Promise.all([
      this.imapPool.closeAllConnections(),
      this.smtpPool.closeAllConnections()
    ])

    // Cleanup OAuth manager
    this.oauth2Manager.cleanup()

    // Close cache
    this.cache.close()

    this.isInitialized = false
    this.removeAllListeners()

    log.info('Email Service Manager shutdown complete')
  }
}

export default EmailServiceManager