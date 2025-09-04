/**
 * Gmail Email Provider
 * 
 * Implements Gmail API and IMAP/SMTP for comprehensive Gmail support
 * with OAuth2 authentication and real-time push notifications
 * 
 * NOTE: This provider now supports both Gmail API and direct IMAP connections
 * For production Gmail IMAP with OAuth2, use GmailImapProvider
 */

import { BaseEmailProvider, SendMessageOptions, SyncOptions, ProviderCapabilities } from './base-email-provider'
import { EMAIL_PROVIDERS } from './provider-config'
import OAuth2Manager from '../oauth-manager'
import { oAuth2TokenManager } from '../oauth-token-manager'
import { oAuth2ImapIntegration } from '../oauth-imap-integration'
import { GmailImapProvider } from './gmail-imap-provider'
import log from 'electron-log'
import { gmail_v1, google } from 'googleapis'
import type { 
  MailAccount, 
  EmailMessage, 
  MailFolder, 
  MailSyncStatus,
  EmailAddress,
  EmailAttachment,
  EmailFlags
} from '@flow-desk/shared'

interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string
  payload: gmail_v1.Schema$MessagePart
  sizeEstimate: number
}

interface GmailLabel {
  id: string
  name: string
  messageListVisibility: string
  labelListVisibility: string
  type: string
  messagesTotal?: number
  messagesUnread?: number
}

export class GmailProvider extends BaseEmailProvider {
  private gmailApi?: gmail_v1.Gmail
  private oauth2Manager: OAuth2Manager
  private watchExpiration?: Date
  private historyId?: string
  private gmailImapProvider?: GmailImapProvider
  private useImapMode: boolean = false

  constructor(account: MailAccount, oauth2Manager: OAuth2Manager, imapPool?, smtpPool?, cache?) {
    super(account, imapPool, smtpPool, cache)
    this.oauth2Manager = oauth2Manager
    
    // Check if IMAP mode should be used (from account settings or environment)
    this.useImapMode = account.settings?.useImap === true || process.env.GMAIL_USE_IMAP === 'true'
    
    if (this.useImapMode) {
      this.gmailImapProvider = new GmailImapProvider(account, imapPool, smtpPool, cache)
    }
  }

  getProviderType(): string {
    return 'gmail'
  }

  getCapabilities(): ProviderCapabilities {
    return EMAIL_PROVIDERS.gmail.capabilities
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      log.info(`Initializing Gmail provider for account ${this.account.id} (IMAP mode: ${this.useImapMode})`)
      
      if (this.useImapMode && this.gmailImapProvider) {
        // Use IMAP provider for direct Gmail IMAP connection
        await this.gmailImapProvider.initialize()
        this.isInitialized = true
        this.emit('initialized')
        log.info(`Gmail IMAP provider initialized for account ${this.account.id}`)
        return
      }
      
      // Fallback to Gmail API mode
      await this.setupAuthentication()
      
      // Initialize Gmail API
      this.gmailApi = google.gmail({ 
        version: 'v1', 
        auth: this.oauth2Client 
      })
      
      // Test API access
      await this.gmailApi.users.getProfile({ userId: 'me' })
      
      // Setup push notifications if supported
      await this.setupPushNotifications()
      
      this.isInitialized = true
      this.emit('initialized')
      
      log.info(`Gmail API provider initialized for account ${this.account.id}`)
    } catch (error) {
      log.error(`Failed to initialize Gmail provider for account ${this.account.id}:`, error)
      throw error
    }
  }

  private oauth2Client?: any

  private async setupAuthentication(): Promise<void> {
    if (!this.account.credentials) {
      throw new Error('No credentials available for Gmail account')
    }

    // Decrypt and validate credentials
    const credentials = this.oauth2Manager.decryptCredentials(this.account.credentials)
    if (!credentials) {
      throw new Error('Failed to decrypt Gmail credentials')
    }

    // Check if token needs refresh
    if (this.oauth2Manager.needsRefresh(this.account.credentials)) {
      try {
        const refreshedCredentials = await this.oauth2Manager.refreshToken('gmail', credentials.refreshToken!)
        const encryptedCredentials = this.oauth2Manager.encryptCredentials(refreshedCredentials)
        await this.updateCredentials(encryptedCredentials)
        
        // Use refreshed credentials
        this.oauth2Client = this.createOAuth2Client(refreshedCredentials.accessToken)
      } catch (error) {
        log.error('Failed to refresh Gmail token:', error)
        throw new Error('Gmail authentication failed - please re-authenticate')
      }
    } else {
      this.oauth2Client = this.createOAuth2Client(credentials.accessToken)
    }
  }

  private createOAuth2Client(accessToken: string): any {
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: accessToken
    })
    return oauth2Client
  }

  async getFolders(): Promise<MailFolder[]> {
    await this.checkRateLimit('getFolders')
    
    // Delegate to IMAP provider if in IMAP mode
    if (this.useImapMode && this.gmailImapProvider) {
      return this.gmailImapProvider.getFolders()
    }
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      const response = await this.gmailApi.users.labels.list({
        userId: 'me'
      })

      const labels = response.data.labels || []
      const folders: MailFolder[] = []

      for (const label of labels) {
        const folder: MailFolder = {
          id: label.id!,
          accountId: this.account.id,
          name: label.name!,
          displayName: this.formatLabelName(label.name!),
          type: this.getLabelType(label.name!),
          path: label.name!,
          attributes: [label.type || 'user'],
          messageCount: label.messagesTotal || 0,
          unreadCount: label.messagesUnread || 0,
          isSelectable: label.messageListVisibility !== 'hide',
          syncStatus: {
            isBeingSynced: false
          }
        }

        folders.push(folder)
      }

      // Sort folders by importance
      folders.sort((a, b) => {
        const order = ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'custom', 'system']
        return order.indexOf(a.type) - order.indexOf(b.type)
      })

      log.info(`Retrieved ${folders.length} folders for Gmail account ${this.account.id}`)
      return folders
    } catch (error) {
      await this.handleSyncError(error as Error, 'getFolders')
      throw error
    }
  }

  private formatLabelName(labelName: string): string {
    // Format Gmail system labels for display
    const systemLabels: Record<string, string> = {
      'INBOX': 'Inbox',
      'SENT': 'Sent',
      'DRAFT': 'Drafts',
      'TRASH': 'Trash',
      'SPAM': 'Spam',
      'STARRED': 'Starred',
      'IMPORTANT': 'Important',
      'CATEGORY_PERSONAL': 'Personal',
      'CATEGORY_SOCIAL': 'Social',
      'CATEGORY_PROMOTIONS': 'Promotions',
      'CATEGORY_UPDATES': 'Updates',
      'CATEGORY_FORUMS': 'Forums'
    }

    return systemLabels[labelName] || labelName
  }

  private getLabelType(labelName: string): MailFolder['type'] {
    const labelTypeMap: Record<string, MailFolder['type']> = {
      'INBOX': 'inbox',
      'SENT': 'sent',
      'DRAFT': 'drafts',
      'TRASH': 'trash',
      'SPAM': 'spam'
    }

    return labelTypeMap[labelName] || 'custom'
  }

  async getMessages(folderId = 'INBOX', options: { limit?: number, since?: Date } = {}): Promise<EmailMessage[]> {
    await this.checkRateLimit('getMessages')
    
    // Delegate to IMAP provider if in IMAP mode
    if (this.useImapMode && this.gmailImapProvider) {
      return this.gmailImapProvider.getMessages(folderId, options)
    }
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      const query: string[] = []
      
      // Add label filter
      if (folderId !== 'INBOX') {
        query.push(`label:${folderId}`)
      }
      
      // Add date filter
      if (options.since) {
        const sinceStr = options.since.toISOString().split('T')[0]
        query.push(`after:${sinceStr}`)
      }

      const listResponse = await this.gmailApi.users.messages.list({
        userId: 'me',
        q: query.length > 0 ? query.join(' ') : undefined,
        labelIds: folderId === 'INBOX' ? ['INBOX'] : [folderId],
        maxResults: Math.min(options.limit || 50, 500) // Gmail API limit
      })

      const messageIds = listResponse.data.messages || []
      if (messageIds.length === 0) {
        return []
      }

      // Fetch full message details in batches
      const messages: EmailMessage[] = []
      const batchSize = 10 // Reasonable batch size to avoid rate limits
      
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize)
        const batchMessages = await Promise.all(
          batch.map(msg => this.getGmailMessage(msg.id!))
        )
        messages.push(...batchMessages.filter(Boolean) as EmailMessage[])
      }

      // Cache messages if cache is available
      if (this.cache) {
        for (const message of messages) {
          await this.cache.insertMessage(message)
        }
      }

      log.info(`Retrieved ${messages.length} messages from ${folderId} for Gmail account ${this.account.id}`)
      return messages
    } catch (error) {
      await this.handleSyncError(error as Error, 'getMessages')
      throw error
    }
  }

  private async getGmailMessage(messageId: string): Promise<EmailMessage | null> {
    try {
      const response = await this.gmailApi!.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      })

      const gmailMessage = response.data
      return this.parseGmailMessage(gmailMessage)
    } catch (error) {
      log.error(`Failed to fetch Gmail message ${messageId}:`, error)
      return null
    }
  }

  private parseGmailMessage(gmailMessage: any): EmailMessage {
    const headers = this.extractHeaders(gmailMessage.payload)
    const body = this.extractBody(gmailMessage.payload)
    const attachments = this.extractAttachments(gmailMessage.payload)

    // Parse addresses
    const from = this.parseEmailAddress(headers['from'] || '')
    const to = this.parseEmailAddresses(headers['to'] || '')
    const cc = this.parseEmailAddresses(headers['cc'] || '')
    const bcc = this.parseEmailAddresses(headers['bcc'] || '')
    const replyTo = this.parseEmailAddresses(headers['reply-to'] || '')

    // Parse flags from labels
    const flags: EmailFlags = {
      isRead: !gmailMessage.labelIds?.includes('UNREAD'),
      isStarred: gmailMessage.labelIds?.includes('STARRED') || false,
      isTrashed: gmailMessage.labelIds?.includes('TRASH') || false,
      isSpam: gmailMessage.labelIds?.includes('SPAM') || false,
      isImportant: gmailMessage.labelIds?.includes('IMPORTANT') || false,
      isArchived: !gmailMessage.labelIds?.includes('INBOX') && !gmailMessage.labelIds?.includes('TRASH'),
      isDraft: gmailMessage.labelIds?.includes('DRAFT') || false,
      isSent: gmailMessage.labelIds?.includes('SENT') || false,
      hasAttachments: attachments.length > 0
    }

    const message: EmailMessage = {
      id: gmailMessage.id!,
      accountId: this.account.id,
      providerId: gmailMessage.id!,
      threadId: gmailMessage.threadId!,
      subject: headers['subject'] || '(No Subject)',
      bodyHtml: body.html,
      bodyText: body.text,
      snippet: gmailMessage.snippet || '',
      from,
      to,
      cc,
      bcc,
      replyTo,
      date: new Date(parseInt(gmailMessage.internalDate!)),
      flags,
      labels: gmailMessage.labelIds || [],
      folder: this.getPrimaryFolder(gmailMessage.labelIds || []),
      importance: this.getImportance(gmailMessage.labelIds || []),
      priority: 'normal',
      size: gmailMessage.sizeEstimate || 0,
      attachments,
      headers,
      messageId: headers['message-id'] || this.generateMessageId(),
      inReplyTo: headers['in-reply-to'],
      references: headers['references']?.split(/\s+/) || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return message
  }

  private extractHeaders(payload: any): Record<string, string> {
    const headers: Record<string, string> = {}
    
    if (payload.headers) {
      for (const header of payload.headers) {
        headers[header.name.toLowerCase()] = header.value
      }
    }
    
    return headers
  }

  private extractBody(payload: any): { html?: string, text?: string } {
    let html = ''
    let text = ''

    const extractFromPart = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.parts) {
        for (const subpart of part.parts) {
          extractFromPart(subpart)
        }
      }
    }

    extractFromPart(payload)

    return { html: html || undefined, text: text || undefined }
  }

  private extractAttachments(payload: any): EmailAttachment[] {
    const attachments: EmailAttachment[] = []

    const extractFromPart = (part: any) => {
      if (part.filename && part.body?.attachmentId) {
        const attachment: EmailAttachment = {
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size || 0,
          contentId: part.headers?.find((h: any) => h.name === 'Content-Id')?.value,
          isInline: part.headers?.find((h: any) => h.name === 'Content-Disposition')?.value?.includes('inline') || false
        }
        attachments.push(attachment)
      }

      if (part.parts) {
        for (const subpart of part.parts) {
          extractFromPart(subpart)
        }
      }
    }

    extractFromPart(payload)
    return attachments
  }

  private parseEmailAddress(addressStr: string): EmailAddress {
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

  private getPrimaryFolder(labelIds: string[]): string {
    if (labelIds.includes('INBOX')) return 'INBOX'
    if (labelIds.includes('SENT')) return 'SENT'
    if (labelIds.includes('DRAFT')) return 'DRAFT'
    if (labelIds.includes('TRASH')) return 'TRASH'
    if (labelIds.includes('SPAM')) return 'SPAM'
    
    // Return first custom label
    const customLabel = labelIds.find(label => 
      !['UNREAD', 'STARRED', 'IMPORTANT'].includes(label)
    )
    return customLabel || 'INBOX'
  }

  private getImportance(labelIds: string[]): 'low' | 'normal' | 'high' {
    if (labelIds.includes('IMPORTANT')) return 'high'
    return 'normal'
  }

  async sendMessage(options: SendMessageOptions): Promise<string> {
    await this.checkRateLimit('sendMessage')
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      // Build RFC 2822 message
      const message = this.buildRFC2822Message(options)
      
      const response = await this.gmailApi.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message).toString('base64url')
        }
      })

      const messageId = response.data.id!
      log.info(`Message sent successfully via Gmail API: ${messageId}`)
      
      return messageId
    } catch (error) {
      log.error('Failed to send message via Gmail API:', error)
      throw error
    }
  }

  private buildRFC2822Message(options: SendMessageOptions): string {
    const lines: string[] = []
    
    // Headers
    lines.push(`From: ${this.account.email}`)
    lines.push(`To: ${options.to.join(', ')}`)
    
    if (options.cc?.length) {
      lines.push(`Cc: ${options.cc.join(', ')}`)
    }
    
    if (options.bcc?.length) {
      lines.push(`Bcc: ${options.bcc.join(', ')}`)
    }
    
    if (options.replyTo) {
      lines.push(`Reply-To: ${options.replyTo}`)
    }
    
    lines.push(`Subject: ${options.subject}`)
    lines.push(`Date: ${new Date().toUTCString()}`)
    lines.push(`Message-ID: ${this.generateMessageId()}`)
    
    if (options.inReplyTo) {
      lines.push(`In-Reply-To: ${options.inReplyTo}`)
    }
    
    if (options.references?.length) {
      lines.push(`References: ${options.references.join(' ')}`)
    }
    
    lines.push('MIME-Version: 1.0')
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('Content-Transfer-Encoding: quoted-printable')
    lines.push('')
    
    // Body
    lines.push(options.body)
    
    return lines.join('\r\n')
  }

  async searchMessages(query: string, options: { limit?: number } = {}): Promise<EmailMessage[]> {
    await this.checkRateLimit('searchMessages')
    
    // Delegate to IMAP provider if in IMAP mode
    if (this.useImapMode && this.gmailImapProvider) {
      return this.gmailImapProvider.searchMessages(query, options)
    }
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      const response = await this.gmailApi.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(options.limit || 50, 500)
      })

      const messageIds = response.data.messages || []
      if (messageIds.length === 0) {
        return []
      }

      // Fetch full messages
      const messages = await Promise.all(
        messageIds.map(msg => this.getGmailMessage(msg.id!))
      )

      return messages.filter(Boolean) as EmailMessage[]
    } catch (error) {
      log.error('Gmail search failed:', error)
      throw error
    }
  }

  async syncAccount(options: SyncOptions = {}): Promise<MailSyncStatus> {
    await this.updateSyncStatus({ status: 'syncing', currentOperation: { type: 'full_sync', progress: 0, startedAt: new Date() } })
    
    try {
      log.info(`Starting Gmail sync for account ${this.account.id}`)
      
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
        
        const messages = await this.getMessages(folder.id, {
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
      
      log.info(`Gmail sync completed for account ${this.account.id} in ${Date.now() - startTime}ms. ${totalNew} messages synced.`)
      return syncResult
    } catch (error) {
      await this.handleSyncError(error as Error, 'syncAccount')
      throw error
    }
  }

  async markMessageRead(messageId: string, read: boolean): Promise<void> {
    await this.checkRateLimit('markMessageRead')
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      if (read) {
        await this.gmailApi.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        })
      } else {
        await this.gmailApi.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds: ['UNREAD']
          }
        })
      }

      this.handleMessageUpdate(messageId, { isRead: read })
    } catch (error) {
      log.error(`Failed to mark Gmail message ${messageId} as ${read ? 'read' : 'unread'}:`, error)
      throw error
    }
  }

  async markMessageStarred(messageId: string, starred: boolean): Promise<void> {
    await this.checkRateLimit('markMessageStarred')
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      if (starred) {
        await this.gmailApi.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            addLabelIds: ['STARRED']
          }
        })
      } else {
        await this.gmailApi.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
            removeLabelIds: ['STARRED']
          }
        })
      }

      this.handleMessageUpdate(messageId, { isStarred: starred })
    } catch (error) {
      log.error(`Failed to mark Gmail message ${messageId} as ${starred ? 'starred' : 'unstarred'}:`, error)
      throw error
    }
  }

  async moveMessage(messageId: string, targetFolder: string): Promise<void> {
    await this.checkRateLimit('moveMessage')
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      // Get current message to determine current labels
      const currentMessage = await this.gmailApi.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'minimal'
      })

      const currentLabels = currentMessage.data.labelIds || []
      const folderLabels = ['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM']
      
      // Remove current folder labels
      const labelsToRemove = currentLabels.filter(label => folderLabels.includes(label))
      
      await this.gmailApi.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [targetFolder],
          removeLabelIds: labelsToRemove
        }
      })

      this.handleMessageUpdate(messageId, { folder: targetFolder })
    } catch (error) {
      log.error(`Failed to move Gmail message ${messageId} to ${targetFolder}:`, error)
      throw error
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.checkRateLimit('deleteMessage')
    
    try {
      if (!this.gmailApi) {
        throw new Error('Gmail API not initialized')
      }

      // Move to trash instead of permanent delete
      await this.gmailApi.users.messages.trash({
        userId: 'me',
        id: messageId
      })

      this.handleMessageDeleted(messageId)
    } catch (error) {
      log.error(`Failed to delete Gmail message ${messageId}:`, error)
      throw error
    }
  }

  private async setupPushNotifications(): Promise<void> {
    try {
      if (!this.gmailApi) return

      // Setup Gmail push notifications (if configured)
      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
          labelIds: ['INBOX'],
          labelFilterAction: 'include'
        }
      }

      const response = await this.gmailApi.users.watch(watchRequest)
      this.historyId = response.data.historyId
      this.watchExpiration = new Date(parseInt(response.data.expiration!))
      
      log.info(`Gmail push notifications setup for account ${this.account.id}, expires: ${this.watchExpiration}`)
    } catch (error) {
      log.warn('Failed to setup Gmail push notifications (continuing without):', error)
    }
  }

  async startIdle(): Promise<void> {
    // Gmail uses push notifications instead of IDLE
    if (!this.watchExpiration || this.watchExpiration < new Date()) {
      await this.setupPushNotifications()
    }
    
    log.info(`Gmail push notifications active for account ${this.account.id}`)
  }

  async stopIdle(): Promise<void> {
    try {
      if (!this.gmailApi) return

      await this.gmailApi.users.stop({
        userId: 'me'
      })
      
      log.info(`Gmail push notifications stopped for account ${this.account.id}`)
    } catch (error) {
      log.warn('Failed to stop Gmail push notifications:', error)
    }
  }
}

export default GmailProvider