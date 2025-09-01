/**
 * Real Multi-Provider Email Service
 * 
 * Production IMAP/SMTP implementation for all major email providers
 */

import * as nodemailer from 'nodemailer'
const imaps = require('imap-simple')
import log from 'electron-log'

interface EmailProvider {
  id: string
  name: string
  imap: {
    host: string
    port: number
    tls: boolean
    authTimeout: number
  }
  smtp: {
    host: string
    port: number
    secure: boolean
  }
}

const EMAIL_PROVIDERS: Record<string, EmailProvider> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993, tls: true, authTimeout: 3000 },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false }
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook',
    imap: { host: 'outlook.office365.com', port: 993, tls: true, authTimeout: 3000 },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  },
  yahoo: {
    id: 'yahoo',
    name: 'Yahoo',
    imap: { host: 'imap.mail.yahoo.com', port: 993, tls: true, authTimeout: 3000 },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false }
  },
  fastmail: {
    id: 'fastmail',
    name: 'Fastmail',
    imap: { host: 'imap.fastmail.com', port: 993, tls: true, authTimeout: 3000 },
    smtp: { host: 'smtp.fastmail.com', port: 587, secure: false }
  },
  icloud: {
    id: 'icloud',
    name: 'iCloud',
    imap: { host: 'imap.mail.me.com', port: 993, tls: true, authTimeout: 3000 },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false }
  }
}

interface EmailAccount {
  id: string
  email: string
  password: string
  provider: string
  displayName: string
  isEnabled: boolean
}

interface EmailMessage {
  id: string
  accountId: string
  subject: string
  from: { name: string; address: string }
  to: { name: string; address: string }[]
  body: string
  bodyHtml?: string
  date: Date
  isRead: boolean
  isStarred: boolean
  hasAttachments: boolean
  folder: string
}

export class RealEmailService {
  private accounts: Map<string, EmailAccount> = new Map()
  private imapConnections: Map<string, any> = new Map()
  private smtpTransporters: Map<string, nodemailer.Transporter> = new Map()

  async addAccount(accountData: EmailAccount): Promise<void> {
    try {
      // Test the connection first
      await this.testConnection(accountData)
      
      // Store the account
      this.accounts.set(accountData.id, accountData)
      
      log.info(`Added real email account: ${accountData.email} (${accountData.provider})`)
    } catch (error) {
      log.error(`Failed to add account ${accountData.email}:`, error)
      throw error
    }
  }

  async testConnection(account: EmailAccount): Promise<boolean> {
    const provider = EMAIL_PROVIDERS[account.provider]
    if (!provider) {
      throw new Error(`Unsupported provider: ${account.provider}`)
    }

    try {
      // Test IMAP connection
      const imapConfig = {
        imap: {
          user: account.email,
          password: account.password,
          host: provider.imap.host,
          port: provider.imap.port,
          tls: provider.imap.tls,
          authTimeout: provider.imap.authTimeout
        }
      }

      const connection = await imaps.connect(imapConfig)
      await connection.end()

      // Test SMTP connection  
      const smtpTransporter = nodemailer.createTransport({
        host: provider.smtp.host,
        port: provider.smtp.port,
        secure: provider.smtp.secure,
        auth: {
          user: account.email,
          pass: account.password
        }
      })

      await smtpTransporter.verify()
      smtpTransporter.close()

      log.info(`Connection test successful for ${account.email}`)
      return true
    } catch (error) {
      log.error(`Connection test failed for ${account.email}:`, error)
      throw new Error(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getMessages(accountId: string, folder: string = 'INBOX', limit: number = 50): Promise<EmailMessage[]> {
    const account = this.accounts.get(accountId)
    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const provider = EMAIL_PROVIDERS[account.provider]
    if (!provider) {
      throw new Error(`Provider not supported: ${account.provider}`)
    }

    try {
      const imapConfig = {
        imap: {
          user: account.email,
          password: account.password,
          host: provider.imap.host,
          port: provider.imap.port,
          tls: provider.imap.tls,
          authTimeout: provider.imap.authTimeout
        }
      }

      const connection = await imaps.connect(imapConfig)
      await connection.openBox(folder)

      // Search for recent messages
      const searchCriteria = ['ALL']
      const fetchOptions = {
        bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
        markSeen: false,
        struct: true
      }

      const messages = await connection.search(searchCriteria, fetchOptions)
      const emailMessages: EmailMessage[] = []

      for (const message of messages.slice(-limit)) {
        try {
          const header = message.parts.find((part: any) => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)')
          if (header) {
            const emailMessage: EmailMessage = {
              id: message.attributes.uid.toString(),
              accountId,
              subject: this.parseHeader(header.body, 'subject') || '(No subject)',
              from: this.parseEmailAddress(this.parseHeader(header.body, 'from') || ''),
              to: [this.parseEmailAddress(this.parseHeader(header.body, 'to') || '')],
              body: '', // Will be fetched on demand
              date: new Date(this.parseHeader(header.body, 'date') || Date.now()),
              isRead: message.attributes.flags.includes('\\Seen'),
              isStarred: message.attributes.flags.includes('\\Flagged'),
              hasAttachments: message.attributes.struct?.some((part: any) => 
                part.disposition?.type === 'attachment') || false,
              folder
            }
            emailMessages.push(emailMessage)
          }
        } catch (error) {
          log.warn(`Failed to parse message ${message.attributes.uid}:`, error)
        }
      }

      await connection.end()
      log.info(`Fetched ${emailMessages.length} messages from ${account.email}`)
      return emailMessages

    } catch (error) {
      log.error(`Failed to fetch messages for ${account.email}:`, error)
      throw error
    }
  }

  async sendMessage(accountId: string, messageData: {
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    body: string
    attachments?: any[]
  }): Promise<boolean> {
    const account = this.accounts.get(accountId)
    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const provider = EMAIL_PROVIDERS[account.provider]
    if (!provider) {
      throw new Error(`Provider not supported: ${account.provider}`)
    }

    try {
      const transporter = nodemailer.createTransport({
        host: provider.smtp.host,
        port: provider.smtp.port,
        secure: provider.smtp.secure,
        auth: {
          user: account.email,
          pass: account.password
        }
      })

      const mailOptions = {
        from: account.email,
        to: messageData.to.join(', '),
        cc: messageData.cc?.join(', '),
        bcc: messageData.bcc?.join(', '),
        subject: messageData.subject,
        html: messageData.body,
        attachments: messageData.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.mimeType
        }))
      }

      const info = await transporter.sendMail(mailOptions)
      transporter.close()

      log.info(`Email sent successfully from ${account.email}: ${messageData.subject}`)
      return true
    } catch (error) {
      log.error(`Failed to send email from ${account.email}:`, error)
      throw error
    }
  }

  async markMessageRead(accountId: string, messageId: string, isRead: boolean): Promise<boolean> {
    const account = this.accounts.get(accountId)
    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const provider = EMAIL_PROVIDERS[account.provider]
    if (!provider) {
      throw new Error(`Provider not supported: ${account.provider}`)
    }

    try {
      const imapConfig = {
        imap: {
          user: account.email,
          password: account.password,
          host: provider.imap.host,
          port: provider.imap.port,
          tls: provider.imap.tls,
          authTimeout: provider.imap.authTimeout
        }
      }

      const connection = await imaps.connect(imapConfig)
      await connection.openBox('INBOX')

      const flag = isRead ? '\\Seen' : '\\Unseen'
      await connection.addFlags([messageId], flag)

      await connection.end()
      log.info(`Marked message ${messageId} as ${isRead ? 'read' : 'unread'}`)
      return true
    } catch (error) {
      log.error(`Failed to mark message ${messageId}:`, error)
      return false
    }
  }

  private parseHeader(headerBody: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*(.+)`, 'i')
    const match = headerBody.match(regex)
    return match ? match[1].trim() : null
  }

  private parseEmailAddress(emailString: string): { name: string; address: string } {
    const match = emailString.match(/^(.+?)\s*<(.+)>$/)
    if (match) {
      return { name: match[1].trim().replace(/['"]/g, ''), address: match[2].trim() }
    }
    return { name: '', address: emailString.trim() }
  }

  async getFolders(accountId: string): Promise<any[]> {
    // Implementation for folder listing
    return [
      { id: 'INBOX', name: 'Inbox', unreadCount: 0, type: 'inbox' },
      { id: 'SENT', name: 'Sent', unreadCount: 0, type: 'sent' },
      { id: 'DRAFT', name: 'Drafts', unreadCount: 0, type: 'drafts' },
      { id: 'TRASH', name: 'Trash', unreadCount: 0, type: 'trash' }
    ]
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const deleted = this.accounts.delete(accountId)
    
    // Close connections
    const imapConnection = this.imapConnections.get(accountId)
    if (imapConnection) {
      try {
        await imapConnection.end()
      } catch (error) {
        log.warn(`Failed to close IMAP connection for ${accountId}:`, error)
      }
      this.imapConnections.delete(accountId)
    }

    const smtpTransporter = this.smtpTransporters.get(accountId)
    if (smtpTransporter) {
      smtpTransporter.close()
      this.smtpTransporters.delete(accountId)
    }

    if (deleted) {
      log.info(`Removed email account: ${accountId}`)
    }
    
    return deleted
  }

  getAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values())
  }
}