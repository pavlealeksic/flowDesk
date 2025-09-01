/**
 * Generic IMAP Email Provider
 * 
 * Implements IMAP/SMTP for providers like Yahoo, Fastmail, iCloud, and generic IMAP servers
 * with password authentication and support for standard IMAP features
 */

import { BaseEmailProvider, SendMessageOptions, SyncOptions, ProviderCapabilities } from './base-email-provider'
import { EMAIL_PROVIDERS } from './provider-config'
import { ImapConnectionPool, ImapConnection, ImapMessage, ImapSearchOptions } from '../imap-client'
import { SmtpConnectionPool, EmailRecipient, EmailAttachment as SmtpAttachment } from '../smtp-client'
import CryptoJS from 'crypto-js'
import log from 'electron-log'
import type { 
  MailAccount, 
  EmailMessage, 
  MailFolder, 
  MailSyncStatus,
  EmailAddress,
  EmailAttachment,
  EmailFlags
} from '@flow-desk/shared'

export class ImapProvider extends BaseEmailProvider {
  private providerConfig: any
  private connection?: ImapConnection
  private encryptionKey: string

  constructor(
    account: MailAccount, 
    imapPool: ImapConnectionPool, 
    smtpPool: SmtpConnectionPool, 
    cache?, 
    encryptionKey: string = 'default-key'
  ) {
    super(account, imapPool, smtpPool, cache)
    this.encryptionKey = encryptionKey
    
    // Get provider-specific configuration
    const providerType = account.provider as keyof typeof EMAIL_PROVIDERS
    this.providerConfig = EMAIL_PROVIDERS[providerType] || EMAIL_PROVIDERS.generic
  }

  getProviderType(): string {
    return this.account.provider
  }

  getCapabilities(): ProviderCapabilities {
    return this.providerConfig.capabilities
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Decrypt credentials
      const credentials = this.decryptCredentials()
      
      // Setup IMAP connection
      const imapConfig = {
        user: credentials.user,
        password: credentials.password,
        host: this.providerConfig.config.imap.host,
        port: this.providerConfig.config.imap.port,
        tls: this.providerConfig.config.imap.secure,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: false
        }
      }

      this.connection = await this.imapPool!.getConnection(this.account.id, imapConfig)
      
      // Setup event handlers
      this.setupConnectionEventHandlers()
      
      // Test connection
      await this.connection.selectMailbox('INBOX')
      
      this.isInitialized = true
      this.emit('initialized')
      
      log.info(`${this.getProviderType()} provider initialized for account ${this.account.id}`)
    } catch (error) {
      log.error(`Failed to initialize ${this.getProviderType()} provider for account ${this.account.id}:`, error)
      throw error
    }
  }

  private decryptCredentials(): { user: string, password: string } {
    if (!this.account.credentials?.password) {
      throw new Error('No password credentials available for IMAP account')
    }

    try {
      const password = CryptoJS.AES.decrypt(this.account.credentials.password, this.encryptionKey).toString(CryptoJS.enc.Utf8)
      return {
        user: this.account.email,
        password
      }
    } catch (error) {
      throw new Error('Failed to decrypt IMAP credentials')
    }
  }

  private setupConnectionEventHandlers(): void {
    if (!this.connection) return

    this.connection.on('newMail', (count) => {
      this.handleNewMail(count)
    })

    this.connection.on('messageUpdated', (seqno, info) => {
      this.handleMessageUpdate(seqno.toString(), info)
    })

    this.connection.on('messageDeleted', (seqno) => {
      this.handleMessageDeleted(seqno.toString())
    })

    this.connection.on('error', (error) => {
      log.error(`IMAP connection error for ${this.account.id}:`, error)
      this.emit('error', error)
    })

    this.connection.on('disconnected', () => {
      log.warn(`IMAP connection disconnected for ${this.account.id}`)
      this.emit('disconnected')
    })
  }

  async getFolders(): Promise<MailFolder[]> {
    await this.checkRateLimit('getFolders')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      const folders = await this.connection.getMailboxes()
      
      log.info(`Retrieved ${folders.length} folders for ${this.getProviderType()} account ${this.account.id}`)
      return folders
    } catch (error) {
      await this.handleSyncError(error as Error, 'getFolders')
      throw error
    }
  }

  async getMessages(folderId = 'INBOX', options: { limit?: number, since?: Date } = {}): Promise<EmailMessage[]> {
    await this.checkRateLimit('getMessages')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      // Select mailbox
      await this.connection.selectMailbox(folderId)

      // Build search criteria
      const searchOptions: ImapSearchOptions = {}
      
      if (options.since) {
        searchOptions.since = options.since
      }

      // Search for messages
      const uids = await this.connection.searchMessages(searchOptions)
      
      if (uids.length === 0) {
        return []
      }

      // Limit results if specified
      const limitedUids = options.limit ? uids.slice(-options.limit) : uids

      // Fetch messages
      const imapMessages = await this.connection.fetchMessages(limitedUids, {
        bodies: ['HEADER', 'TEXT'],
        struct: true,
        envelope: true,
        size: true
      })

      // Convert to EmailMessage format
      const messages = imapMessages.map(msg => this.convertImapMessage(msg, folderId))

      // Cache messages if cache is available
      if (this.cache) {
        for (const message of messages) {
          await this.cache.insertMessage(message)
        }
      }

      log.info(`Retrieved ${messages.length} messages from ${folderId} for ${this.getProviderType()} account ${this.account.id}`)
      return messages
    } catch (error) {
      await this.handleSyncError(error as Error, 'getMessages')
      throw error
    }
  }

  private convertImapMessage(imapMessage: ImapMessage, folder: string): EmailMessage {
    const headers = imapMessage.header || {}
    
    // Parse email addresses
    const from = this.parseEmailAddress(headers['from']?.[0] || '')
    const to = this.parseEmailAddresses(headers['to']?.[0] || '')
    const cc = this.parseEmailAddresses(headers['cc']?.[0] || '')
    const bcc = this.parseEmailAddresses(headers['bcc']?.[0] || '')
    const replyTo = this.parseEmailAddresses(headers['reply-to']?.[0] || '')

    // Parse flags
    const flags: EmailFlags = {
      isRead: !imapMessage.flags.includes('\\Unseen'),
      isStarred: imapMessage.flags.includes('\\Flagged'),
      isTrashed: folder.toLowerCase().includes('trash'),
      isSpam: folder.toLowerCase().includes('spam') || folder.toLowerCase().includes('junk'),
      isImportant: imapMessage.flags.includes('\\Important') || imapMessage.flags.includes('$Important'),
      isArchived: false, // Provider specific
      isDraft: imapMessage.flags.includes('\\Draft'),
      isSent: folder.toLowerCase().includes('sent'),
      hasAttachments: (imapMessage.attachments?.length || 0) > 0
    }

    // Convert attachments
    const attachments: EmailAttachment[] = (imapMessage.attachments || []).map(att => ({
      id: att.partID,
      filename: att.params?.name || 'attachment',
      mimeType: `${att.type}/${att.subtype}`,
      size: att.size,
      contentId: att.id,
      isInline: att.disposition?.type === 'inline'
    }))

    // Extract body content
    const bodyText = this.extractTextContent(imapMessage.body)
    const snippet = this.generateSnippet(bodyText)

    const message: EmailMessage = {
      id: `${this.account.id}-${imapMessage.uid}`,
      accountId: this.account.id,
      providerId: imapMessage.uid.toString(),
      threadId: this.generateThreadId(headers),
      subject: headers['subject']?.[0] || '(No Subject)',
      bodyHtml: this.extractHtmlContent(imapMessage.body),
      bodyText,
      snippet,
      from,
      to,
      cc,
      bcc,
      replyTo,
      date: imapMessage.date,
      flags,
      labels: [], // IMAP doesn't have labels like Gmail
      folder,
      importance: flags.isImportant ? 'high' : 'normal',
      priority: this.parsePriority(headers['x-priority']?.[0] || headers['priority']?.[0]),
      size: imapMessage.size,
      attachments,
      headers: this.flattenHeaders(headers),
      messageId: headers['message-id']?.[0] || this.generateMessageId(),
      inReplyTo: headers['in-reply-to']?.[0],
      references: headers['references']?.[0]?.split(/\s+/) || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return message
  }

  private parseEmailAddress(addressStr: string): EmailAddress {
    if (!addressStr) return { address: '' }
    
    const match = addressStr.match(/^(.+?)\s*<(.+)>$/)
    if (match) {
      return {
        name: match[1].trim().replace(/^["']|["']$/g, ''),
        address: match[2].trim()
      }
    }
    return { address: addressStr.trim() }
  }

  private parseEmailAddresses(addressStr: string): EmailAddress[] {
    if (!addressStr) return []
    
    return addressStr.split(',').map(addr => this.parseEmailAddress(addr.trim()))
  }

  private extractTextContent(body?: string): string {
    if (!body) return ''
    
    // Simple text extraction - in production, you'd want more sophisticated parsing
    return body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }

  private extractHtmlContent(body?: string): string | undefined {
    if (!body) return undefined
    
    // Check if body contains HTML tags
    if (body.includes('<html') || body.includes('<body') || body.includes('<div')) {
      return body
    }
    
    return undefined
  }

  private generateSnippet(text: string): string {
    return text.substring(0, 200).trim()
  }

  private generateThreadId(headers: any): string {
    // Use References header or Message-ID to group messages
    const references = headers['references']?.[0]
    const inReplyTo = headers['in-reply-to']?.[0]
    const messageId = headers['message-id']?.[0]
    
    if (references) {
      const firstRef = references.split(/\s+/)[0]
      return `thread-${Buffer.from(firstRef).toString('base64').substring(0, 16)}`
    }
    
    if (inReplyTo) {
      return `thread-${Buffer.from(inReplyTo).toString('base64').substring(0, 16)}`
    }
    
    if (messageId) {
      return `thread-${Buffer.from(messageId).toString('base64').substring(0, 16)}`
    }
    
    // Fallback to subject-based threading
    const subject = headers['subject']?.[0] || ''
    const cleanSubject = subject.replace(/^(re|fwd?):\s*/i, '').trim()
    return `thread-${Buffer.from(cleanSubject).toString('base64').substring(0, 16)}`
  }

  private parsePriority(priorityStr?: string): 'low' | 'normal' | 'high' {
    if (!priorityStr) return 'normal'
    
    const priority = priorityStr.toLowerCase()
    if (priority.includes('high') || priority.includes('urgent') || priority === '1') return 'high'
    if (priority.includes('low') || priority === '5') return 'low'
    return 'normal'
  }

  private flattenHeaders(headers: any): Record<string, string> {
    const flattened: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        flattened[key] = (value as string[]).join(', ')
      } else {
        flattened[key] = value as string
      }
    }
    
    return flattened
  }

  async sendMessage(options: SendMessageOptions): Promise<string> {
    await this.checkRateLimit('sendMessage')
    
    try {
      if (!this.smtpPool) {
        throw new Error('SMTP connection pool not available')
      }

      const credentials = this.decryptCredentials()
      
      const smtpConfig = {
        host: this.providerConfig.config.smtp.host,
        port: this.providerConfig.config.smtp.port,
        secure: this.providerConfig.config.smtp.secure,
        requireTLS: this.providerConfig.config.smtp.requireTLS,
        auth: {
          user: credentials.user,
          pass: credentials.password
        }
      }

      const smtpClient = await this.smtpPool.getConnection(this.account.id, smtpConfig)

      // Convert recipients
      const from: EmailRecipient = {
        address: this.account.email,
        name: this.account.name
      }

      const to: EmailRecipient[] = options.to.map(email => ({ address: email }))
      const cc: EmailRecipient[] = options.cc?.map(email => ({ address: email })) || []
      const bcc: EmailRecipient[] = options.bcc?.map(email => ({ address: email })) || []

      // Convert attachments
      const attachments: SmtpAttachment[] = options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      })) || []

      const sendOptions = {
        from,
        to,
        cc,
        bcc,
        subject: options.subject,
        html: options.body,
        attachments,
        inReplyTo: options.inReplyTo,
        references: options.references
      }

      const result = await smtpClient.sendMail(sendOptions)
      
      log.info(`Message sent successfully via ${this.getProviderType()} SMTP: ${result.messageId}`)
      return result.messageId
    } catch (error) {
      log.error(`Failed to send message via ${this.getProviderType()} SMTP:`, error)
      throw error
    }
  }

  async searchMessages(query: string, options: { limit?: number } = {}): Promise<EmailMessage[]> {
    await this.checkRateLimit('searchMessages')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      // Select INBOX for search
      await this.connection.selectMailbox('INBOX')

      // Build IMAP search criteria from query
      const searchOptions: ImapSearchOptions = {
        query: this.buildSearchQuery(query)
      }

      const uids = await this.connection.searchMessages(searchOptions)
      
      if (uids.length === 0) {
        return []
      }

      // Limit results
      const limitedUids = options.limit ? uids.slice(-options.limit) : uids

      // Fetch messages
      const imapMessages = await this.connection.fetchMessages(limitedUids, {
        bodies: ['HEADER', 'TEXT'],
        struct: true
      })

      return imapMessages.map(msg => this.convertImapMessage(msg, 'INBOX'))
    } catch (error) {
      log.error(`${this.getProviderType()} search failed:`, error)
      throw error
    }
  }

  private buildSearchQuery(query: string): string[] {
    // Simple query parsing - in production, you'd want more sophisticated parsing
    const words = query.toLowerCase().split(/\s+/)
    const criteria: string[] = []
    
    for (const word of words) {
      if (word.startsWith('from:')) {
        criteria.push('FROM', word.substring(5))
      } else if (word.startsWith('to:')) {
        criteria.push('TO', word.substring(3))
      } else if (word.startsWith('subject:')) {
        criteria.push('SUBJECT', word.substring(8))
      } else {
        criteria.push('BODY', word)
      }
    }
    
    return criteria.length > 0 ? criteria : ['ALL']
  }

  async syncAccount(options: SyncOptions = {}): Promise<MailSyncStatus> {
    await this.updateSyncStatus({ status: 'syncing', currentOperation: { type: 'full_sync', progress: 0, startedAt: new Date() } })
    
    try {
      log.info(`Starting ${this.getProviderType()} sync for account ${this.account.id}`)
      
      const startTime = Date.now()
      const folders = await this.getFolders()
      let totalNew = 0
      
      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i]
        
        // Skip system folders if not doing full sync
        if (!options.fullSync && ['spam', 'trash'].includes(folder.type)) {
          continue
        }
        
        const progress = Math.round((i / folders.length) * 100)
        await this.updateSyncStatus({
          currentOperation: { 
            type: 'folder_sync', 
            folder: folder.name, 
            progress, 
            startedAt: new Date() 
          }
        })
        
        const messages = await this.getMessages(folder.path, {
          limit: options.limit || 100,
          since: options.since
        })
        
        totalNew += messages.length
      }
      
      const syncResult: MailSyncStatus = {
        accountId: this.account.id,
        status: 'idle',
        lastSyncAt: new Date(),
        stats: {
          totalMessages: totalNew,
          newMessages: totalNew,
          updatedMessages: 0,
          deletedMessages: 0,
          syncErrors: 0
        }
      }
      
      await this.updateSyncStatus(syncResult)
      
      log.info(`${this.getProviderType()} sync completed for account ${this.account.id} in ${Date.now() - startTime}ms. ${totalNew} messages synced.`)
      return syncResult
    } catch (error) {
      await this.handleSyncError(error as Error, 'syncAccount')
      throw error
    }
  }

  async markMessageRead(messageId: string, read: boolean): Promise<void> {
    await this.checkRateLimit('markMessageRead')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      const uid = parseInt(messageId.split('-').pop() || '0')
      
      if (read) {
        await this.connection.setFlags([uid], ['\\Seen'], 'add')
      } else {
        await this.connection.setFlags([uid], ['\\Seen'], 'remove')
      }

      this.handleMessageUpdate(messageId, { isRead: read })
    } catch (error) {
      log.error(`Failed to mark ${this.getProviderType()} message ${messageId} as ${read ? 'read' : 'unread'}:`, error)
      throw error
    }
  }

  async markMessageStarred(messageId: string, starred: boolean): Promise<void> {
    await this.checkRateLimit('markMessageStarred')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      const uid = parseInt(messageId.split('-').pop() || '0')
      
      if (starred) {
        await this.connection.setFlags([uid], ['\\Flagged'], 'add')
      } else {
        await this.connection.setFlags([uid], ['\\Flagged'], 'remove')
      }

      this.handleMessageUpdate(messageId, { isStarred: starred })
    } catch (error) {
      log.error(`Failed to mark ${this.getProviderType()} message ${messageId} as ${starred ? 'starred' : 'unstarred'}:`, error)
      throw error
    }
  }

  async moveMessage(messageId: string, targetFolder: string): Promise<void> {
    await this.checkRateLimit('moveMessage')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      const uid = parseInt(messageId.split('-').pop() || '0')
      
      await this.connection.moveMessages([uid], targetFolder)
      this.handleMessageUpdate(messageId, { folder: targetFolder })
    } catch (error) {
      log.error(`Failed to move ${this.getProviderType()} message ${messageId} to ${targetFolder}:`, error)
      throw error
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.checkRateLimit('deleteMessage')
    
    try {
      if (!this.connection) {
        throw new Error('IMAP connection not initialized')
      }

      const uid = parseInt(messageId.split('-').pop() || '0')
      
      // Mark as deleted and expunge
      await this.connection.setFlags([uid], ['\\Deleted'], 'add')
      await this.connection.expungeMessages()
      
      this.handleMessageDeleted(messageId)
    } catch (error) {
      log.error(`Failed to delete ${this.getProviderType()} message ${messageId}:`, error)
      throw error
    }
  }

  async startIdle(): Promise<void> {
    if (!this.connection) return
    
    try {
      await this.connection.selectMailbox('INBOX')
      await this.connection.startIdle()
      
      log.info(`IDLE started for ${this.getProviderType()} account ${this.account.id}`)
    } catch (error) {
      log.error(`Failed to start IDLE for ${this.getProviderType()} account ${this.account.id}:`, error)
    }
  }

  async stopIdle(): Promise<void> {
    if (!this.connection) return
    
    try {
      await this.connection.stopIdle()
      log.info(`IDLE stopped for ${this.getProviderType()} account ${this.account.id}`)
    } catch (error) {
      log.error(`Failed to stop IDLE for ${this.getProviderType()} account ${this.account.id}:`, error)
    }
  }
}

export default ImapProvider