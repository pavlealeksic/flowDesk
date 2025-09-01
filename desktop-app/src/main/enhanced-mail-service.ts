/**
 * Enhanced Mail Service
 * 
 * Updated mail service that integrates the new multi-provider email system
 * with the existing IPC interface and adds comprehensive provider support
 */

import { ipcMain, BrowserWindow, shell } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'
import EmailServiceManager from './email-service-manager'
import { detectProvider, EMAIL_PROVIDERS } from './providers/provider-config'

// Import shared types
import type {
  MailAccount,
  EmailMessage,
  MailFolder,
  MailSyncStatus,
  BulkEmailOperation,
  BulkEmailOperationResult,
  CreateMailAccountInput,
  UpdateMailAccountInput
} from '@flow-desk/shared'

// Enhanced Mail Service class using the new email service manager
class EnhancedMailService {
  private emailManager: EmailServiceManager
  private isInitialized = false
  private mainWindow?: BrowserWindow

  constructor(encryptionKey: string, mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow
    this.emailManager = new EmailServiceManager(
      {
        encryptionKey,
        maxConcurrentSyncs: 3,
        syncIntervalMinutes: 15,
        offlineQueueSize: 1000,
        enablePushNotifications: true
      },
      mainWindow
    )

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Forward events from email manager to IPC
    this.emailManager.on('accountAdded', (account) => {
      this.notifyRenderer('mail:account-added', account)
    })

    this.emailManager.on('accountUpdated', (account) => {
      this.notifyRenderer('mail:account-updated', account)
    })

    this.emailManager.on('accountRemoved', (accountId) => {
      this.notifyRenderer('mail:account-removed', { accountId })
    })

    this.emailManager.on('newMail', (accountId, count) => {
      this.notifyRenderer('mail:new-messages', { accountId, count })
    })

    this.emailManager.on('syncCompleted', (accountId, status) => {
      this.notifyRenderer('mail:sync-completed', { accountId, status })
    })

    this.emailManager.on('syncError', (accountId, error) => {
      this.notifyRenderer('mail:sync-error', { 
        accountId, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      })
    })
  }

  private notifyRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      log.info('Initializing Enhanced Mail Service...')
      
      await this.emailManager.initialize()
      
      this.isInitialized = true
      log.info('Enhanced Mail Service initialized successfully')
    } catch (error) {
      log.error('Failed to initialize Enhanced Mail Service:', error)
      throw error
    }
  }

  // Account Management
  async listAccounts(): Promise<MailAccount[]> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.getAccounts()
  }

  async addAccount(account: CreateMailAccountInput): Promise<MailAccount> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Auto-detect provider if not specified or if generic
      if (!account.provider || account.provider === 'imap') {
        const detectedProvider = detectProvider(account.email)
        if (detectedProvider) {
          account.provider = detectedProvider.id as any
          account.config = detectedProvider.config
        }
      }

      return await this.emailManager.addAccount(account)
    } catch (error) {
      log.error('Failed to add account:', error)
      throw error
    }
  }

  async updateAccount(accountId: string, updates: UpdateMailAccountInput): Promise<MailAccount | null> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.updateAccount(accountId, updates)
  }

  async removeAccount(accountId: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.removeAccount(accountId)
  }

  async syncAccount(accountId: string): Promise<MailSyncStatus> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.syncAccount(accountId)
  }

  // Message Operations
  async getMessages(accountId: string, folderId?: string, options?: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.getMessages(accountId, folderId, options)
  }

  async sendMessage(accountId: string, message: {
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    body: string
    attachments?: Array<{
      filename: string
      content: Buffer
      contentType?: string
    }>
  }): Promise<string> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.sendMessage(accountId, message)
  }

  async searchMessages(query: string, options?: {
    accountId?: string
    limit?: number
  }): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.searchMessages(query, options)
  }

  async getFolders(accountId: string): Promise<MailFolder[]> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.getFolders(accountId)
  }

  async markMessageRead(accountId: string, messageId: string, read: boolean): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.markMessageRead(accountId, messageId, read)
  }

  async markMessageStarred(accountId: string, messageId: string, starred: boolean): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.markMessageStarred(accountId, messageId, starred)
  }

  // OAuth Flow Management
  async getAuthUrl(provider: 'gmail' | 'outlook'): Promise<string> {
    if (!this.isInitialized) await this.initialize()
    
    const providerConfig = EMAIL_PROVIDERS[provider]
    if (!providerConfig?.config.oauth) {
      throw new Error(`OAuth not supported for provider: ${provider}`)
    }

    // This would return the OAuth URL - for now return a placeholder
    return `${providerConfig.config.oauth.authUrl}?client_id=${providerConfig.config.oauth.clientId || 'not-configured'}`
  }

  async handleOAuthCallback(code: string, state: string, accountId?: string): Promise<MailAccount> {
    // This would be handled by the OAuth manager
    throw new Error('OAuth callback handling moved to OAuth manager')
  }

  async startGmailOAuth(): Promise<MailAccount> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.startOAuthFlow('gmail')
  }

  async startOutlookOAuth(): Promise<MailAccount> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.startOAuthFlow('outlook')
  }

  // Sync Status
  async getSyncStatus(): Promise<Record<string, MailSyncStatus>> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.getSyncStatus()
  }

  async startSync(): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    // Start sync for all accounts
    await this.emailManager.syncAllAccounts()
  }

  async stopSync(): Promise<void> {
    // No-op for now - background sync runs continuously
  }

  // Bulk Operations
  async performBulkOperation(accountId: string, operation: BulkEmailOperation): Promise<BulkEmailOperationResult> {
    if (!this.isInitialized) await this.initialize()
    
    // Implement bulk operations using individual message operations
    const result: BulkEmailOperationResult = {
      successful: 0,
      failed: 0,
      errors: []
    }

    for (const messageId of operation.messageIds) {
      try {
        switch (operation.type) {
          case 'mark_read':
            await this.markMessageRead(accountId, messageId, true)
            break
          case 'mark_unread':
            await this.markMessageRead(accountId, messageId, false)
            break
          case 'star':
            await this.markMessageStarred(accountId, messageId, true)
            break
          case 'unstar':
            await this.markMessageStarred(accountId, messageId, false)
            break
          default:
            throw new Error(`Bulk operation ${operation.type} not implemented`)
        }
        result.successful++
      } catch (error) {
        result.failed++
        result.errors.push({
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  }

  // Advanced Features
  async getUnifiedMessages(limit?: number): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.getUnifiedMessages(limit)
  }

  async getSmartMailboxMessages(criteria: string): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    // Implement smart mailbox logic based on criteria
    const options: any = {}
    
    switch (criteria) {
      case 'today':
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        // Would implement date filtering
        break
      case 'flagged':
        options.isStarred = true
        break
      case 'unread':
        options.isUnread = true
        break
      case 'with_attachments':
        options.hasAttachments = true
        break
    }

    // For now, return unified messages (would implement proper filtering)
    return this.getUnifiedMessages(50)
  }

  async getMessageThread(accountId: string, threadId: string): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    // Search for messages with the same thread ID
    return this.searchMessages(`thread:${threadId}`, { accountId })
  }

  // Email Scheduling (placeholder)
  async scheduleMessage(
    accountId: string,
    message: any,
    scheduledDate: Date
  ): Promise<string> {
    throw new Error('Email scheduling not yet implemented')
  }

  async getScheduledMessages(accountId: string): Promise<any[]> {
    return []
  }

  async cancelScheduledMessage(accountId: string, messageId: string): Promise<void> {
    throw new Error('Email scheduling not yet implemented')
  }

  // Email Aliases (placeholder)
  async getEmailAliases(accountId: string): Promise<any[]> {
    return []
  }

  async addEmailAlias(accountId: string, address: string, name: string): Promise<any> {
    throw new Error('Email aliases not yet implemented')
  }

  async removeEmailAlias(accountId: string, aliasAddress: string): Promise<void> {
    throw new Error('Email aliases not yet implemented')
  }

  // IDLE/Push Notifications
  async startIdle(accountId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.startIdle(accountId)
  }

  async stopIdle(accountId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    return this.emailManager.stopIdle(accountId)
  }

  // Provider Information
  async getProviderInfo(email: string): Promise<{
    provider: string
    config: any
    supportsOAuth: boolean
  }> {
    const detectedProvider = detectProvider(email)
    
    if (detectedProvider) {
      return {
        provider: detectedProvider.id,
        config: detectedProvider.config,
        supportsOAuth: detectedProvider.capabilities.supportsOAuth
      }
    }

    return {
      provider: 'generic',
      config: EMAIL_PROVIDERS.generic.config,
      supportsOAuth: false
    }
  }

  async testAccountConnection(config: {
    email: string
    password?: string
    provider?: string
    imapHost?: string
    imapPort?: number
    smtpHost?: string
    smtpPort?: number
  }): Promise<boolean> {
    if (!this.isInitialized) await this.initialize()
    
    // Would implement connection testing
    // For now, return true as placeholder
    return true
  }

  shutdown(): void {
    if (this.emailManager) {
      this.emailManager.shutdown()
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }
}

// Global service instance
let enhancedMailService: EnhancedMailService | null = null
let mainWindow: BrowserWindow | null = null

export function initializeEnhancedMailService(encryptionKey: string, window?: BrowserWindow): void {
  if (enhancedMailService) return
  
  enhancedMailService = new EnhancedMailService(encryptionKey, window)
  mainWindow = window || null
  
  // Setup IPC handlers
  setupEnhancedMailIPC()
  
  log.info('Enhanced Mail Service initialized')
}

// Enhanced IPC handlers that maintain compatibility with existing interface
export function setupEnhancedMailIPC(): void {
  if (!enhancedMailService) {
    throw new Error('Enhanced Mail Service not initialized')
  }

  // Account management
  ipcMain.handle('mail:list-accounts', async () => {
    try {
      return await enhancedMailService!.listAccounts()
    } catch (error) {
      log.error('IPC mail:list-accounts error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:add-account', async (_, account: CreateMailAccountInput) => {
    try {
      return await enhancedMailService!.addAccount(account)
    } catch (error) {
      log.error('IPC mail:add-account error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:update-account', async (_, accountId: string, updates: UpdateMailAccountInput) => {
    try {
      return await enhancedMailService!.updateAccount(accountId, updates)
    } catch (error) {
      log.error('IPC mail:update-account error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:remove-account', async (_, accountId: string) => {
    try {
      return await enhancedMailService!.removeAccount(accountId)
    } catch (error) {
      log.error('IPC mail:remove-account error:', error)
      throw error
    }
  })

  // Sync operations
  ipcMain.handle('mail:sync-account', async (_, accountId: string) => {
    try {
      return await enhancedMailService!.syncAccount(accountId)
    } catch (error) {
      log.error('IPC mail:sync-account error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-sync-status', async () => {
    try {
      return await enhancedMailService!.getSyncStatus()
    } catch (error) {
      log.error('IPC mail:get-sync-status error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:start-sync', async () => {
    try {
      await enhancedMailService!.startSync()
      return true
    } catch (error) {
      log.error('IPC mail:start-sync error:', error)
      return false
    }
  })

  // Message operations
  ipcMain.handle('mail:get-messages', async (_, accountId: string, folderId?: string, options?: any) => {
    try {
      return await enhancedMailService!.getMessages(accountId, folderId, options)
    } catch (error) {
      log.error('IPC mail:get-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:send-message', async (_, accountId: string, message: any) => {
    try {
      return await enhancedMailService!.sendMessage(accountId, message)
    } catch (error) {
      log.error('IPC mail:send-message error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:search-messages', async (_, query: string, options?: any) => {
    try {
      return await enhancedMailService!.searchMessages(query, options)
    } catch (error) {
      log.error('IPC mail:search-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-folders', async (_, accountId: string) => {
    try {
      return await enhancedMailService!.getFolders(accountId)
    } catch (error) {
      log.error('IPC mail:get-folders error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:mark-message-read', async (_, accountId: string, messageId: string, read: boolean) => {
    try {
      await enhancedMailService!.markMessageRead(accountId, messageId, read)
      return true
    } catch (error) {
      log.error('IPC mail:mark-message-read error:', error)
      return false
    }
  })

  ipcMain.handle('mail:mark-message-starred', async (_, accountId: string, messageId: string, starred: boolean) => {
    try {
      await enhancedMailService!.markMessageStarred(accountId, messageId, starred)
      return true
    } catch (error) {
      log.error('IPC mail:mark-message-starred error:', error)
      throw error
    }
  })

  // OAuth operations
  ipcMain.handle('mail:get-auth-url', async (_, provider: 'gmail' | 'outlook') => {
    try {
      return await enhancedMailService!.getAuthUrl(provider)
    } catch (error) {
      log.error('IPC mail:get-auth-url error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:start-gmail-oauth', async () => {
    try {
      return await enhancedMailService!.startGmailOAuth()
    } catch (error) {
      log.error('IPC mail:start-gmail-oauth error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:start-outlook-oauth', async () => {
    try {
      return await enhancedMailService!.startOutlookOAuth()
    } catch (error) {
      log.error('IPC mail:start-outlook-oauth error:', error)
      throw error
    }
  })

  // Advanced features
  ipcMain.handle('mail:get-unified-messages', async (_, limit?: number) => {
    try {
      return await enhancedMailService!.getUnifiedMessages(limit)
    } catch (error) {
      log.error('IPC mail:get-unified-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-smart-mailbox-messages', async (_, criteria: string) => {
    try {
      return await enhancedMailService!.getSmartMailboxMessages(criteria)
    } catch (error) {
      log.error('IPC mail:get-smart-mailbox-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-message-thread', async (_, accountId: string, threadId: string) => {
    try {
      return await enhancedMailService!.getMessageThread(accountId, threadId)
    } catch (error) {
      log.error('IPC mail:get-message-thread error:', error)
      throw error
    }
  })

  // Provider utilities
  ipcMain.handle('mail:get-provider-info', async (_, email: string) => {
    try {
      return await enhancedMailService!.getProviderInfo(email)
    } catch (error) {
      log.error('IPC mail:get-provider-info error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:test-connection', async (_, config: any) => {
    try {
      return await enhancedMailService!.testAccountConnection(config)
    } catch (error) {
      log.error('IPC mail:test-connection error:', error)
      return false
    }
  })

  // IDLE operations
  ipcMain.handle('mail:start-idle', async (_, accountId: string) => {
    try {
      await enhancedMailService!.startIdle(accountId)
      return true
    } catch (error) {
      log.error('IPC mail:start-idle error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:stop-idle', async (_, accountId: string) => {
    try {
      await enhancedMailService!.stopIdle(accountId)
      return true
    } catch (error) {
      log.error('IPC mail:stop-idle error:', error)
      throw error
    }
  })

  log.info('Enhanced Mail IPC handlers registered')
}

export async function shutdownEnhancedMailService(): Promise<void> {
  if (enhancedMailService) {
    enhancedMailService.shutdown()
    enhancedMailService = null
  }
}

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
  if (enhancedMailService) {
    enhancedMailService.setMainWindow(window)
  }
}

export function getEnhancedMailService(): EnhancedMailService | null {
  return enhancedMailService
}

// Export the enhanced service as default
export { EnhancedMailService }
export default EnhancedMailService