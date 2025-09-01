/**
 * Generic SMTP Client with Attachment Support
 * 
 * Production-ready SMTP client using nodemailer with support for
 * multiple providers, OAuth2, attachments, and retry logic
 */

import * as nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'
import Mail from 'nodemailer/lib/mailer'
import log from 'electron-log'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  requireTLS?: boolean
  auth?: {
    user: string
    pass?: string
    accessToken?: string
    type?: 'oauth2' | 'password'
  }
  pool?: boolean
  maxConnections?: number
  maxMessages?: number
  rateDelta?: number
  rateLimit?: number
  debug?: boolean
}

export interface EmailRecipient {
  address: string
  name?: string
}

export interface EmailAttachment {
  filename: string
  content?: Buffer | string
  path?: string
  href?: string
  contentType?: string
  contentId?: string
  encoding?: string
  size?: number
}

export interface SendMailOptions {
  from: EmailRecipient
  to: EmailRecipient[]
  cc?: EmailRecipient[]
  bcc?: EmailRecipient[]
  replyTo?: EmailRecipient
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
  messageId?: string
  inReplyTo?: string
  references?: string[]
  priority?: 'high' | 'normal' | 'low'
  headers?: Record<string, string>
  date?: Date
}

export interface SendResult {
  messageId: string
  accepted: string[]
  rejected: string[]
  pending: string[]
  envelope: {
    from: string
    to: string[]
  }
  response: string
}

class SmtpClient extends EventEmitter {
  private transporter?: Transporter
  private config: SmtpConfig
  private accountId: string
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private connectionPool: boolean

  constructor(config: SmtpConfig, accountId: string) {
    super()
    this.config = config
    this.accountId = accountId
    this.connectionPool = config.pool !== false
    this.setupTransporter()
  }

  private setupTransporter() {
    const transportOptions: any = {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      requireTLS: this.config.requireTLS,
      debug: this.config.debug || false,
      logger: this.config.debug,
    }

    // Authentication configuration
    if (this.config.auth) {
      if (this.config.auth.type === 'oauth2' && this.config.auth.accessToken) {
        transportOptions.auth = {
          type: 'OAuth2',
          user: this.config.auth.user,
          accessToken: this.config.auth.accessToken
        }
      } else if (this.config.auth.pass) {
        transportOptions.auth = {
          user: this.config.auth.user,
          pass: this.config.auth.pass
        }
      }
    }

    // Connection pooling configuration
    if (this.connectionPool) {
      transportOptions.pool = true
      transportOptions.maxConnections = this.config.maxConnections || 5
      transportOptions.maxMessages = this.config.maxMessages || 100
      transportOptions.rateDelta = this.config.rateDelta || 1000
      transportOptions.rateLimit = this.config.rateLimit || 10
    }

    // TLS options for security
    transportOptions.tls = {
      rejectUnauthorized: false, // For self-signed certificates
      ciphers: 'SSLv3'
    }

    this.transporter = nodemailer.createTransporter(transportOptions)

    // Setup event handlers
    this.transporter.on('idle', () => {
      this.emit('idle')
      log.debug(`SMTP transporter idle for account ${this.accountId}`)
    })

    this.transporter.on('token', (token) => {
      this.emit('tokenRefresh', token)
      log.debug(`SMTP token refreshed for account ${this.accountId}`)
    })
  }

  async connect(): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized')
    }

    try {
      await this.verifyConnection()
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connected')
      log.info(`SMTP connected for account ${this.accountId}`)
    } catch (error) {
      this.isConnected = false
      log.error(`SMTP connection failed for account ${this.accountId}:`, error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.transporter && this.connectionPool) {
      this.transporter.close()
      this.isConnected = false
      this.emit('disconnected')
      log.info(`SMTP disconnected for account ${this.accountId}`)
    }
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized')
    }

    return new Promise((resolve, reject) => {
      this.transporter!.verify((error, success) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  async sendMail(options: SendMailOptions): Promise<SendResult> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized')
    }

    // Ensure connection
    if (!this.isConnected) {
      await this.connect()
    }

    const mailOptions = await this.buildMailOptions(options)

    try {
      const info = await this.transporter.sendMail(mailOptions)
      
      const result: SendResult = {
        messageId: info.messageId,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        pending: info.pending || [],
        envelope: info.envelope,
        response: info.response
      }

      this.emit('messageSent', result)
      log.info(`Email sent successfully for account ${this.accountId}`, { messageId: result.messageId })
      
      return result
    } catch (error) {
      log.error(`Failed to send email for account ${this.accountId}:`, error)
      this.emit('sendError', error)
      
      // Attempt reconnection on certain errors
      if (this.shouldReconnect(error)) {
        await this.handleReconnect()
      }
      
      throw error
    }
  }

  private async buildMailOptions(options: SendMailOptions): Promise<Mail.Options> {
    const mailOptions: Mail.Options = {
      from: this.formatRecipient(options.from),
      to: options.to.map(r => this.formatRecipient(r)),
      subject: options.subject,
      messageId: options.messageId,
      date: options.date || new Date(),
    }

    // Optional recipients
    if (options.cc?.length) {
      mailOptions.cc = options.cc.map(r => this.formatRecipient(r))
    }
    
    if (options.bcc?.length) {
      mailOptions.bcc = options.bcc.map(r => this.formatRecipient(r))
    }

    if (options.replyTo) {
      mailOptions.replyTo = this.formatRecipient(options.replyTo)
    }

    // Message content
    if (options.text) {
      mailOptions.text = options.text
    }
    
    if (options.html) {
      mailOptions.html = options.html
    }

    // Threading headers
    if (options.inReplyTo) {
      mailOptions.inReplyTo = options.inReplyTo
    }
    
    if (options.references?.length) {
      mailOptions.references = options.references.join(' ')
    }

    // Priority
    if (options.priority) {
      mailOptions.priority = options.priority
    }

    // Custom headers
    if (options.headers) {
      mailOptions.headers = options.headers
    }

    // Process attachments
    if (options.attachments?.length) {
      mailOptions.attachments = await this.processAttachments(options.attachments)
    }

    return mailOptions
  }

  private formatRecipient(recipient: EmailRecipient): string {
    if (recipient.name) {
      return `"${recipient.name}" <${recipient.address}>`
    }
    return recipient.address
  }

  private async processAttachments(attachments: EmailAttachment[]): Promise<Mail.Attachment[]> {
    const processedAttachments: Mail.Attachment[] = []

    for (const attachment of attachments) {
      const mailAttachment: Mail.Attachment = {
        filename: attachment.filename,
        contentType: attachment.contentType,
        contentId: attachment.contentId,
        encoding: attachment.encoding as any
      }

      // Handle different attachment sources
      if (attachment.content) {
        mailAttachment.content = attachment.content
      } else if (attachment.path) {
        // Verify file exists and is readable
        try {
          await fs.promises.access(attachment.path, fs.constants.R_OK)
          mailAttachment.path = attachment.path
        } catch (error) {
          log.warn(`Attachment file not accessible: ${attachment.path}`)
          continue // Skip this attachment
        }
      } else if (attachment.href) {
        mailAttachment.href = attachment.href
      } else {
        log.warn(`Invalid attachment: ${attachment.filename} - no content source`)
        continue
      }

      // Set content type if not provided
      if (!mailAttachment.contentType && attachment.path) {
        mailAttachment.contentType = this.guessContentType(attachment.path)
      }

      processedAttachments.push(mailAttachment)
    }

    return processedAttachments
  }

  private guessContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml'
    }

    return contentTypes[ext] || 'application/octet-stream'
  }

  private shouldReconnect(error: any): boolean {
    // Check if error indicates connection issues
    const reconnectableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED'
    ]

    return reconnectableErrors.some(code => 
      error.code === code || error.message?.includes(code)
    )
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error(`Max reconnect attempts reached for SMTP account ${this.accountId}`)
      this.emit('maxReconnectAttemptsReached')
      return
    }

    this.reconnectAttempts++
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff

    log.info(`Attempting to reconnect SMTP for account ${this.accountId} in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(async () => {
      try {
        this.isConnected = false
        this.setupTransporter() // Recreate transporter
        await this.connect()
        log.info(`SMTP reconnected successfully for account ${this.accountId}`)
      } catch (error) {
        log.error(`SMTP reconnect attempt ${this.reconnectAttempts} failed for account ${this.accountId}:`, error)
        this.handleReconnect()
      }
    }, delay)
  }

  async updateAuth(auth: SmtpConfig['auth']): Promise<void> {
    this.config.auth = auth
    this.setupTransporter()
    
    if (this.isConnected) {
      await this.connect() // Test new authentication
    }
    
    log.info(`SMTP authentication updated for account ${this.accountId}`)
  }

  getStatus(): { connected: boolean, poolSize?: number, poolIdle?: number } {
    const status = { connected: this.isConnected }
    
    if (this.transporter && this.connectionPool) {
      // Get pool information if available
      const pool = (this.transporter as any).transporter?.pool
      if (pool) {
        return {
          ...status,
          poolSize: pool.connections?.length || 0,
          poolIdle: pool.idleConnections?.length || 0
        }
      }
    }
    
    return status
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.verifyConnection()
      return true
    } catch (error) {
      log.error(`SMTP connection test failed for account ${this.accountId}:`, error)
      return false
    }
  }

  destroy(): void {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = undefined
    }
    
    this.isConnected = false
    this.removeAllListeners()
    log.info(`SMTP client destroyed for account ${this.accountId}`)
  }
}

/**
 * SMTP Connection Pool Manager
 */
export class SmtpConnectionPool extends EventEmitter {
  private connections: Map<string, SmtpClient> = new Map()
  private maxConnections = 10

  constructor(maxConnections = 10) {
    super()
    this.maxConnections = maxConnections
  }

  async getConnection(accountId: string, config: SmtpConfig): Promise<SmtpClient> {
    let connection = this.connections.get(accountId)
    
    if (!connection) {
      if (this.connections.size >= this.maxConnections) {
        throw new Error('Maximum number of SMTP connections reached')
      }
      
      connection = new SmtpClient(config, accountId)
      this.connections.set(accountId, connection)
      
      // Setup connection event handlers
      connection.on('sendError', (error) => {
        log.error(`SMTP send error for ${accountId}:`, error)
        this.emit('sendError', accountId, error)
      })
      
      connection.on('disconnected', () => {
        this.connections.delete(accountId)
        this.emit('connectionClosed', accountId)
      })
      
      connection.on('maxReconnectAttemptsReached', () => {
        this.connections.delete(accountId)
        this.emit('connectionFailed', accountId)
      })
    }
    
    return connection
  }

  async closeConnection(accountId: string): Promise<void> {
    const connection = this.connections.get(accountId)
    if (connection) {
      connection.destroy()
      this.connections.delete(accountId)
    }
  }

  async closeAllConnections(): Promise<void> {
    for (const [accountId, connection] of this.connections.entries()) {
      connection.destroy()
    }
    this.connections.clear()
  }

  async updateConnectionAuth(accountId: string, auth: SmtpConfig['auth']): Promise<void> {
    const connection = this.connections.get(accountId)
    if (connection) {
      await connection.updateAuth(auth)
    }
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys())
  }

  getConnectionStatus(accountId: string): { connected: boolean, poolSize?: number, poolIdle?: number } | null {
    const connection = this.connections.get(accountId)
    return connection ? connection.getStatus() : null
  }

  async testConnection(accountId: string, config: SmtpConfig): Promise<boolean> {
    const testClient = new SmtpClient(config, `${accountId}-test`)
    try {
      return await testClient.testConnection()
    } finally {
      testClient.destroy()
    }
  }
}

export { SmtpClient }
export default SmtpConnectionPool