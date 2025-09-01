import { ipcMain, BrowserWindow, shell } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'
import { GmailService } from './gmail-service'

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

// Mail engine service class using real Gmail API
class MailEngineService {
  private gmailService: GmailService
  private isInitialized = false

  constructor(encryptionKey: string) {
    this.gmailService = new GmailService(encryptionKey)
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      log.info('Initializing mail engine with Gmail API...')
      
      this.isInitialized = true
      log.info('Mail engine initialized successfully with Gmail API')
    } catch (error) {
      log.error('Failed to initialize mail engine:', error)
      throw error
    }
  }


  async listAccounts(): Promise<MailAccount[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.listAccounts()
    } catch (error) {
      log.error('Failed to list mail accounts:', error)
      throw error
    }
  }

  async addAccount(account: CreateMailAccountInput): Promise<MailAccount> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // For Gmail accounts, we need OAuth flow
      if (account.provider === 'gmail') {
        throw new Error('Use startGmailOAuth() for Gmail account setup')
      }
      
      throw new Error('Only Gmail accounts are currently supported')
    } catch (error) {
      log.error('Failed to add mail account:', error)
      throw error
    }
  }

  async updateAccount(accountId: string, updates: UpdateMailAccountInput): Promise<MailAccount | null> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Use Rust engine for account updates
      const rustEngine = require('../lib/rust-engine')
      await rustEngine.updateMailAccount(accountId, updates)
      
      // Get updated account
      const accounts = await this.getAccounts()
      const updatedAccount = accounts.find(acc => acc.id === accountId)
      
      log.info('Updated mail account:', accountId)
      return updatedAccount || null
    } catch (error) {
      log.error('Failed to update mail account:', error)
      throw error
    }
  }

  async removeAccount(accountId: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.removeAccount(accountId)
    } catch (error) {
      log.error('Failed to remove mail account:', error)
      return false
    }
  }

  async syncAccount(accountId: string): Promise<MailSyncStatus> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.syncAccount(accountId)
    } catch (error) {
      log.error('Failed to sync mail account:', error)
      throw error
    }
  }

  async getMessages(accountId: string, folderId?: string, options?: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const gmailOptions: any = {}
      
      if (options?.limit) gmailOptions.limit = options.limit
      if (options?.search) gmailOptions.query = options.search
      if (folderId) gmailOptions.labelIds = [folderId]
      
      return await this.gmailService.getMessages(accountId, gmailOptions)
    } catch (error) {
      log.error('Failed to get messages:', error)
      throw error
    }
  }

  async sendMessage(accountId: string, message: Partial<EmailMessage>): Promise<string> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.sendMessage(accountId, message)
    } catch (error) {
      log.error('Failed to send message:', error)
      throw error
    }
  }

  async searchMessages(query: string, options?: {
    accountId?: string
    limit?: number
  }): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      if (!options?.accountId) {
        throw new Error('Account ID is required for search')
      }
      
      return await this.gmailService.searchMessages(options.accountId, query, {
        limit: options.limit
      })
    } catch (error) {
      log.error('Failed to search messages:', error)
      throw error
    }
  }

  async getFolders(accountId: string): Promise<MailFolder[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.getFolders(accountId)
    } catch (error) {
      log.error('Failed to get folders:', error)
      throw error
    }
  }

  async markMessageRead(accountId: string, messageId: string, read: boolean): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      await this.gmailService.markMessageRead(accountId, messageId, read)
    } catch (error) {
      log.error('Failed to mark message read/unread:', error)
      throw error
    }
  }

  async getAuthUrl(provider: 'gmail' | 'outlook'): Promise<string> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      if (provider !== 'gmail') {
        throw new Error('Only Gmail is currently supported')
      }
      
      return await this.gmailService.getAuthUrl()
    } catch (error) {
      log.error('Failed to get auth URL:', error)
      throw error
    }
  }

  async handleOAuthCallback(code: string, state: string, accountId?: string): Promise<MailAccount> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.handleOAuthCallback(code, accountId)
    } catch (error) {
      log.error('Failed to handle OAuth callback:', error)
      throw error
    }
  }

  async getSyncStatus(): Promise<Record<string, MailSyncStatus>> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Use Rust engine for sync status
      const rustEngine = require('../lib/rust-engine')
      const syncStatus = await rustEngine.getMailSyncStatus()
      
      return syncStatus || {}
    } catch (error) {
      log.error('Failed to get sync status:', error)
      throw error
    }
  }

  async startSync(): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Use Rust engine to start sync
      const rustEngine = require('../lib/rust-engine')
      await rustEngine.startMailSync()
      
      log.info('Started background mail sync')
    } catch (error) {
      log.error('Failed to start sync:', error)
      throw error
    }
  }

  async stopSync(): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Use Rust engine to stop sync
      const rustEngine = require('../lib/rust-engine')
      await rustEngine.stopMailSync()
      
      log.info('Stopped background mail sync')
    } catch (error) {
      log.error('Failed to stop sync:', error)
      throw error
    }
  }

  async performBulkOperation(accountId: string, operation: BulkEmailOperation): Promise<BulkEmailOperationResult> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.performBulkOperation(accountId, operation)
    } catch (error) {
      log.error('Failed to perform bulk operation:', error)
      throw error
    }
  }

  // New advanced features
  async markMessageStarred(accountId: string, messageId: string, starred: boolean): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      await this.gmailService.markMessageStarred(accountId, messageId, starred)
    } catch (error) {
      log.error('Failed to mark message starred:', error)
      throw error
    }
  }

  async getUnifiedMessages(limit?: number): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.getUnifiedMessages(limit)
    } catch (error) {
      log.error('Failed to get unified messages:', error)
      throw error
    }
  }

  async getSmartMailboxMessages(criteria: string): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.getSmartMailboxMessages(criteria)
    } catch (error) {
      log.error('Failed to get smart mailbox messages:', error)
      throw error
    }
  }

  async getMessageThread(accountId: string, threadId: string): Promise<EmailMessage[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.getMessageThread(accountId, threadId)
    } catch (error) {
      log.error('Failed to get message thread:', error)
      throw error
    }
  }

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
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.scheduleMessage(accountId, message, scheduledDate)
    } catch (error) {
      log.error('Failed to schedule message:', error)
      throw error
    }
  }

  async getScheduledMessages(accountId: string): Promise<any[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.getScheduledMessages(accountId)
    } catch (error) {
      log.error('Failed to get scheduled messages:', error)
      throw error
    }
  }

  async cancelScheduledMessage(accountId: string, messageId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      await this.gmailService.cancelScheduledMessage(accountId, messageId)
    } catch (error) {
      log.error('Failed to cancel scheduled message:', error)
      throw error
    }
  }

  async getEmailAliases(accountId: string): Promise<any[]> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.getEmailAliases(accountId)
    } catch (error) {
      log.error('Failed to get email aliases:', error)
      throw error
    }
  }

  async addEmailAlias(accountId: string, address: string, name: string): Promise<any> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.addEmailAlias(accountId, address, name)
    } catch (error) {
      log.error('Failed to add email alias:', error)
      throw error
    }
  }

  async removeEmailAlias(accountId: string, aliasAddress: string): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      await this.gmailService.removeEmailAlias(accountId, aliasAddress)
    } catch (error) {
      log.error('Failed to remove email alias:', error)
      throw error
    }
  }

  async startIdle(accountId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      await this.gmailService.startIdle(accountId)
    } catch (error) {
      log.error('Failed to start IDLE sync:', error)
      throw error
    }
  }

  async stopIdle(accountId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      await this.gmailService.stopIdle(accountId)
    } catch (error) {
      log.error('Failed to stop IDLE sync:', error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return
    
    try {
      this.gmailService.shutdown()
      this.isInitialized = false
      log.info('Mail engine shut down')
    } catch (error) {
      log.error('Failed to shutdown mail engine:', error)
    }
  }

  // Gmail-specific methods
  async startGmailOAuth(): Promise<MailAccount> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      return await this.gmailService.startOAuthFlow()
    } catch (error) {
      log.error('Failed to start Gmail OAuth:', error)
      throw error
    }
  }
}

// Global mail service instance
let mailService: MailEngineService | null = null
let mainWindow: BrowserWindow | null = null

export function initializeMailService(encryptionKey: string, window?: BrowserWindow): void {
  if (mailService) return
  
  mailService = new MailEngineService(encryptionKey)
  mainWindow = window || null
  
  // Setup IPC handlers
  setupMailIPC()
  
  // Start real-time sync
  startRealTimeSync()
  
  log.info('Mail service initialized')
}

// Real-time sync functionality
function startRealTimeSync(): void {
  // Periodic sync every 5 minutes
  setInterval(async () => {
    if (!mailService || !mainWindow) return
    
    try {
      const accounts = await mailService.listAccounts()
      const syncPromises = accounts.map(account => syncAccountInBackground(account.id))
      await Promise.all(syncPromises)
    } catch (error) {
      log.error('Background sync error:', error)
    }
  }, 5 * 60 * 1000) // 5 minutes

  log.info('Real-time sync started')
}

async function syncAccountInBackground(accountId: string): Promise<void> {
  if (!mailService || !mainWindow) return
  
  try {
    // Notify UI that sync is starting
    mainWindow.webContents.send('mail:sync-started', { accountId })
    
    const syncResult = await mailService.syncAccount(accountId)
    
    // Notify UI about sync completion
    mainWindow.webContents.send('mail:sync-completed', { 
      accountId, 
      syncResult 
    })
    
    // If there are new messages, send notification
    if (syncResult.stats.newMessages > 0) {
      mainWindow.webContents.send('mail:new-messages', {
        accountId,
        count: syncResult.stats.newMessages
      })
    }
    
    log.info(`Synced account ${accountId}: ${syncResult.stats.newMessages} new messages`)
  } catch (error) {
    log.error(`Failed to sync account ${accountId}:`, error)
    mainWindow.webContents.send('mail:sync-error', {
      accountId,
      error: error instanceof Error ? error.message : 'Sync failed'
    })
  }
}

export function setupMailIPC(): void {
  if (!mailService) {
    throw new Error('Mail service not initialized')
  }

  // Account management
  ipcMain.handle('mail:list-accounts', async () => {
    try {
      return await mailService!.listAccounts()
    } catch (error) {
      log.error('IPC mail:list-accounts error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:add-account', async (_, account: CreateMailAccountInput) => {
    try {
      return await mailService!.addAccount(account)
    } catch (error) {
      log.error('IPC mail:add-account error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:update-account', async (_, accountId: string, updates: UpdateMailAccountInput) => {
    try {
      return await mailService!.updateAccount(accountId, updates)
    } catch (error) {
      log.error('IPC mail:update-account error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:remove-account', async (_, accountId: string) => {
    try {
      return await mailService!.removeAccount(accountId)
    } catch (error) {
      log.error('IPC mail:remove-account error:', error)
      throw error
    }
  })

  // Sync operations
  ipcMain.handle('mail:sync-account', async (_, accountId: string) => {
    try {
      return await mailService!.syncAccount(accountId)
    } catch (error) {
      log.error('IPC mail:sync-account error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-sync-status', async () => {
    try {
      return await mailService!.getSyncStatus()
    } catch (error) {
      log.error('IPC mail:get-sync-status error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:start-sync', async () => {
    try {
      await mailService!.startSync()
      return true
    } catch (error) {
      log.error('IPC mail:start-sync error:', error)
      return false
    }
  })

  ipcMain.handle('mail:stop-sync', async () => {
    try {
      await mailService!.stopSync()
      return true
    } catch (error) {
      log.error('IPC mail:stop-sync error:', error)
      return false
    }
  })

  // Message operations
  ipcMain.handle('mail:get-messages', async (_, accountId: string, folderId?: string, options?: any) => {
    try {
      return await mailService!.getMessages(accountId, folderId, options)
    } catch (error) {
      log.error('IPC mail:get-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:send-message', async (_, accountId: string, message: any) => {
    try {
      return await mailService!.sendMessage(accountId, message)
    } catch (error) {
      log.error('IPC mail:send-message error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:search-messages', async (_, query: string, options?: any) => {
    try {
      return await mailService!.searchMessages(query, options)
    } catch (error) {
      log.error('IPC mail:search-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-folders', async (_, accountId: string) => {
    try {
      return await mailService!.getFolders(accountId)
    } catch (error) {
      log.error('IPC mail:get-folders error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:mark-message-read', async (_, accountId: string, messageId: string, read: boolean) => {
    try {
      await mailService!.markMessageRead(accountId, messageId, read)
      return true
    } catch (error) {
      log.error('IPC mail:mark-message-read error:', error)
      return false
    }
  })

  // OAuth operations
  ipcMain.handle('mail:get-auth-url', async (_, provider: 'gmail' | 'outlook') => {
    try {
      return await mailService!.getAuthUrl(provider)
    } catch (error) {
      log.error('IPC mail:get-auth-url error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:handle-oauth-callback', async (_, code: string, state: string, accountId?: string) => {
    try {
      return await mailService!.handleOAuthCallback(code, state, accountId)
    } catch (error) {
      log.error('IPC mail:handle-oauth-callback error:', error)
      throw error
    }
  })

  // Gmail-specific OAuth flow
  ipcMain.handle('mail:start-gmail-oauth', async () => {
    try {
      return await mailService!.startGmailOAuth()
    } catch (error) {
      log.error('IPC mail:start-gmail-oauth error:', error)
      throw error
    }
  })

  // Bulk operations
  ipcMain.handle('mail:bulk-operation', async (_, accountId: string, operation: BulkEmailOperation) => {
    try {
      return await mailService!.performBulkOperation(accountId, operation)
    } catch (error) {
      log.error('IPC mail:bulk-operation error:', error)
      throw error
    }
  })

  // New advanced features IPC handlers
  
  // Star/Unstar messages
  ipcMain.handle('mail:mark-message-starred', async (_, accountId: string, messageId: string, starred: boolean) => {
    try {
      await mailService!.markMessageStarred(accountId, messageId, starred)
      return true
    } catch (error) {
      log.error('IPC mail:mark-message-starred error:', error)
      throw error
    }
  })

  // Unified inbox
  ipcMain.handle('mail:get-unified-messages', async (_, limit?: number) => {
    try {
      return await mailService!.getUnifiedMessages(limit)
    } catch (error) {
      log.error('IPC mail:get-unified-messages error:', error)
      throw error
    }
  })

  // Smart mailboxes
  ipcMain.handle('mail:get-smart-mailbox-messages', async (_, criteria: string) => {
    try {
      return await mailService!.getSmartMailboxMessages(criteria)
    } catch (error) {
      log.error('IPC mail:get-smart-mailbox-messages error:', error)
      throw error
    }
  })

  // Message threading
  ipcMain.handle('mail:get-message-thread', async (_, accountId: string, threadId: string) => {
    try {
      return await mailService!.getMessageThread(accountId, threadId)
    } catch (error) {
      log.error('IPC mail:get-message-thread error:', error)
      throw error
    }
  })

  // Email scheduling
  ipcMain.handle('mail:schedule-message', async (_, accountId: string, message: any, scheduledDate: Date) => {
    try {
      return await mailService!.scheduleMessage(accountId, message, scheduledDate)
    } catch (error) {
      log.error('IPC mail:schedule-message error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:get-scheduled-messages', async (_, accountId: string) => {
    try {
      return await mailService!.getScheduledMessages(accountId)
    } catch (error) {
      log.error('IPC mail:get-scheduled-messages error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:cancel-scheduled-message', async (_, accountId: string, messageId: string) => {
    try {
      await mailService!.cancelScheduledMessage(accountId, messageId)
      return true
    } catch (error) {
      log.error('IPC mail:cancel-scheduled-message error:', error)
      throw error
    }
  })

  // Email aliases
  ipcMain.handle('mail:get-email-aliases', async (_, accountId: string) => {
    try {
      return await mailService!.getEmailAliases(accountId)
    } catch (error) {
      log.error('IPC mail:get-email-aliases error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:add-email-alias', async (_, accountId: string, address: string, name: string) => {
    try {
      return await mailService!.addEmailAlias(accountId, address, name)
    } catch (error) {
      log.error('IPC mail:add-email-alias error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:remove-email-alias', async (_, accountId: string, aliasAddress: string) => {
    try {
      await mailService!.removeEmailAlias(accountId, aliasAddress)
      return true
    } catch (error) {
      log.error('IPC mail:remove-email-alias error:', error)
      throw error
    }
  })

  // IDLE/Push sync
  ipcMain.handle('mail:start-idle', async (_, accountId: string) => {
    try {
      await mailService!.startIdle(accountId)
      return true
    } catch (error) {
      log.error('IPC mail:start-idle error:', error)
      throw error
    }
  })

  ipcMain.handle('mail:stop-idle', async (_, accountId: string) => {
    try {
      await mailService!.stopIdle(accountId)
      return true
    } catch (error) {
      log.error('IPC mail:stop-idle error:', error)
      throw error
    }
  })

  log.info('Mail IPC handlers registered (including advanced features)')
}

export async function shutdownMailService(): Promise<void> {
  if (mailService) {
    await mailService.shutdown()
    mailService = null
  }
}

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
  log.info('Mail service main window updated')
}

export function getMailService(): MailEngineService | null {
  return mailService
}