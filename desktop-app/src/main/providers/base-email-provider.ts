/**
 * Base Email Provider Class
 * 
 * Abstract base class that defines the interface for all email providers
 * and provides common functionality
 */

import { EventEmitter } from 'events'
import log from 'electron-log'
import type { 
  MailAccount, 
  EmailMessage, 
  MailFolder, 
  MailSyncStatus,
  MailAccountCredentials
} from '@flow-desk/shared'
import type { ImapConnectionPool } from '../imap-client'
import type { SmtpConnectionPool } from '../smtp-client'
import EmailCache from '../email-cache'

export interface EmailProviderConfig {
  accountId: string
  credentials: MailAccountCredentials
  config: any // Provider-specific config
}

export interface SendMessageOptions {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  replyTo?: string
  inReplyTo?: string
  references?: string[]
}

export interface SyncOptions {
  fullSync?: boolean
  folderName?: string
  since?: Date
  limit?: number
}

export interface ProviderCapabilities {
  supportsOAuth: boolean
  supportsIdle: boolean
  supportsPush: boolean
  supportsSearch: boolean
  supportsLabels: boolean
  supportsThreads: boolean
  maxAttachmentSize: number
  rateLimit?: {
    requests: number
    window: number // seconds
  }
}

export abstract class BaseEmailProvider extends EventEmitter {
  protected account: MailAccount
  protected imapPool?: ImapConnectionPool
  protected smtpPool?: SmtpConnectionPool
  protected cache?: EmailCache
  protected isInitialized = false
  protected syncStatus: MailSyncStatus
  protected rateLimitTracker: Map<string, number[]> = new Map()

  constructor(account: MailAccount, imapPool?: ImapConnectionPool, smtpPool?: SmtpConnectionPool, cache?: EmailCache) {
    super()
    this.account = account
    this.imapPool = imapPool
    this.smtpPool = smtpPool
    this.cache = cache
    
    this.syncStatus = {
      accountId: account.id,
      status: 'idle',
      stats: {
        totalMessages: 0,
        newMessages: 0,
        updatedMessages: 0,
        deletedMessages: 0,
        syncErrors: 0
      }
    }
  }

  // Abstract methods that must be implemented by providers
  abstract getProviderType(): string
  abstract getCapabilities(): ProviderCapabilities
  abstract initialize(): Promise<void>
  abstract getFolders(): Promise<MailFolder[]>
  abstract getMessages(folderId?: string, options?: { limit?: number, since?: Date }): Promise<EmailMessage[]>
  abstract sendMessage(options: SendMessageOptions): Promise<string>
  abstract syncAccount(options?: SyncOptions): Promise<MailSyncStatus>
  abstract searchMessages(query: string, options?: { limit?: number }): Promise<EmailMessage[]>

  // Optional methods with default implementations
  async markMessageRead(messageId: string, read: boolean): Promise<void> {
    throw new Error('markMessageRead not implemented by provider')
  }

  async markMessageStarred(messageId: string, starred: boolean): Promise<void> {
    throw new Error('markMessageStarred not implemented by provider')
  }

  async moveMessage(messageId: string, targetFolder: string): Promise<void> {
    throw new Error('moveMessage not implemented by provider')
  }

  async deleteMessage(messageId: string): Promise<void> {
    throw new Error('deleteMessage not implemented by provider')
  }

  async startIdle(): Promise<void> {
    // Default implementation - no-op
    log.warn(`IDLE not supported by provider ${this.getProviderType()}`)
  }

  async stopIdle(): Promise<void> {
    // Default implementation - no-op
  }

  // Common utility methods
  protected async checkRateLimit(operation: string): Promise<void> {
    const capabilities = this.getCapabilities()
    if (!capabilities.rateLimit) return

    const now = Date.now()
    const windowMs = capabilities.rateLimit.window * 1000
    const requests = this.rateLimitTracker.get(operation) || []
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < windowMs)
    
    if (recentRequests.length >= capabilities.rateLimit.requests) {
      const oldestRequest = Math.min(...recentRequests)
      const waitTime = windowMs - (now - oldestRequest)
      
      log.warn(`Rate limit reached for ${operation}, waiting ${waitTime}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    // Add current request
    recentRequests.push(now)
    this.rateLimitTracker.set(operation, recentRequests)
  }

  protected normalizeFolder(folderName: string): MailFolder['type'] {
    const name = folderName.toLowerCase()
    if (name.includes('inbox')) return 'inbox'
    if (name.includes('sent')) return 'sent'
    if (name.includes('draft')) return 'drafts'
    if (name.includes('trash') || name.includes('deleted')) return 'trash'
    if (name.includes('spam') || name.includes('junk')) return 'spam'
    if (name.includes('archive')) return 'archive'
    return 'custom'
  }

  protected generateMessageId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2)
    const hostname = require('os').hostname()
    return `<${timestamp}.${random}@${hostname}>`
  }

  protected async updateSyncStatus(updates: Partial<MailSyncStatus>): Promise<void> {
    this.syncStatus = { ...this.syncStatus, ...updates }
    this.emit('syncStatusUpdate', this.syncStatus)
    
    // Update cache if available
    if (this.cache) {
      try {
        // Would implement cache update for sync status
      } catch (error) {
        log.error('Failed to update sync status in cache:', error)
      }
    }
  }

  protected async handleSyncError(error: Error, operation: string): Promise<void> {
    this.syncStatus.stats.syncErrors++
    this.syncStatus.lastError = {
      message: error.message,
      code: (error as any).code || 'UNKNOWN',
      timestamp: new Date(),
      details: { operation }
    }
    
    await this.updateSyncStatus({ status: 'error' })
    this.emit('syncError', error, operation)
    
    log.error(`Sync error in ${this.getProviderType()} provider:`, error)
  }

  // Public interface methods
  async testConnection(): Promise<boolean> {
    try {
      await this.initialize()
      await this.getFolders() // Basic connectivity test
      return true
    } catch (error) {
      log.error(`Connection test failed for ${this.getProviderType()}:`, error)
      return false
    }
  }

  getAccount(): MailAccount {
    return this.account
  }

  getSyncStatus(): MailSyncStatus {
    return this.syncStatus
  }

  async updateCredentials(credentials: MailAccountCredentials): Promise<void> {
    this.account.credentials = credentials
    this.account.updatedAt = new Date()
    
    // Re-initialize if already initialized
    if (this.isInitialized) {
      this.isInitialized = false
      await this.initialize()
    }
    
    this.emit('credentialsUpdated', credentials)
  }

  async disconnect(): Promise<void> {
    try {
      await this.stopIdle()
      
      // Close IMAP connection
      if (this.imapPool) {
        await this.imapPool.closeConnection(this.account.id)
      }
      
      // Close SMTP connection
      if (this.smtpPool) {
        await this.smtpPool.closeConnection(this.account.id)
      }
      
      this.isInitialized = false
      this.emit('disconnected')
      
      log.info(`Disconnected ${this.getProviderType()} provider for account ${this.account.id}`)
    } catch (error) {
      log.error(`Error disconnecting ${this.getProviderType()} provider:`, error)
      throw error
    }
  }

  // Event handling for real-time updates
  protected handleNewMail(count: number): void {
    this.emit('newMail', count)
    log.info(`${count} new messages received for account ${this.account.id}`)
  }

  protected handleMessageUpdate(messageId: string, updates: any): void {
    this.emit('messageUpdate', messageId, updates)
  }

  protected handleMessageDeleted(messageId: string): void {
    this.emit('messageDeleted', messageId)
  }

  // Cleanup
  async destroy(): Promise<void> {
    try {
      await this.disconnect()
      this.removeAllListeners()
      this.rateLimitTracker.clear()
      
      log.info(`Destroyed ${this.getProviderType()} provider for account ${this.account.id}`)
    } catch (error) {
      log.error(`Error destroying ${this.getProviderType()} provider:`, error)
    }
  }
}

export default BaseEmailProvider