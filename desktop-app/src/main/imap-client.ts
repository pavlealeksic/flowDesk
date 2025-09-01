/**
 * Generic IMAP Client with TLS/SSL Support and Connection Pooling
 * 
 * Production-ready IMAP client that handles multiple providers with
 * connection pooling, retry logic, and real-time IDLE support
 */

import * as Imap from 'node-imap'
import { EventEmitter } from 'events'
import log from 'electron-log'
import type { EmailMessage, MailFolder, EmailFlags, EmailAttachment } from '@flow-desk/shared'

export interface ImapConfig {
  user: string
  password?: string
  accessToken?: string
  host: string
  port: number
  tls: boolean
  tlsOptions?: any
  authTimeout?: number
  connTimeout?: number
  keepalive?: {
    interval: number
    idleInterval: number
    forceNoop: boolean
  }
  debug?: boolean
}

export interface ImapMessage {
  uid: number
  flags: string[]
  date: Date
  struct: any
  size: number
  header: Record<string, any>
  body?: string
  attachments?: ImapAttachment[]
}

export interface ImapAttachment {
  partID: string
  type: string
  subtype: string
  params: any
  id?: string
  description?: string
  encoding: string
  size: number
  md5?: string
  disposition?: any
}

export interface ImapSearchOptions {
  query?: string[]
  since?: Date
  before?: Date
  unseen?: boolean
  seen?: boolean
  flagged?: boolean
  unflagged?: boolean
  deleted?: boolean
  undeleted?: boolean
  from?: string
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  larger?: number
  smaller?: number
  uid?: number[]
}

export interface ImapFetchOptions {
  bodies?: string | string[]
  struct?: boolean
  envelope?: boolean
  size?: boolean
  markSeen?: boolean
  uid?: boolean
}

class ImapConnection extends EventEmitter {
  private imap: Imap
  private isConnected = false
  private isIdling = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private keepAliveInterval?: NodeJS.Timeout
  private idleTimeout?: NodeJS.Timeout
  private lastActivity = Date.now()

  constructor(private config: ImapConfig, private accountId: string) {
    super()
    this.setupConnection()
  }

  private setupConnection() {
    this.imap = new Imap({
      user: this.config.user,
      password: this.config.password,
      xoauth2: this.config.accessToken,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: this.config.tlsOptions || { rejectUnauthorized: false },
      authTimeout: this.config.authTimeout || 10000,
      connTimeout: this.config.connTimeout || 10000,
      keepalive: this.config.keepalive || {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: false
      },
      debug: this.config.debug ? console.log : undefined
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.imap.on('ready', () => {
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connected')
      this.startKeepAlive()
      log.info(`IMAP connected for account ${this.accountId}`)
    })

    this.imap.on('end', () => {
      this.isConnected = false
      this.isIdling = false
      this.stopKeepAlive()
      this.emit('disconnected')
      log.info(`IMAP disconnected for account ${this.accountId}`)
    })

    this.imap.on('error', (error) => {
      this.isConnected = false
      this.isIdling = false
      this.stopKeepAlive()
      log.error(`IMAP error for account ${this.accountId}:`, error)
      this.emit('error', error)
      this.handleReconnect()
    })

    this.imap.on('close', (hasError) => {
      this.isConnected = false
      this.isIdling = false
      this.stopKeepAlive()
      
      if (hasError) {
        log.warn(`IMAP connection closed with error for account ${this.accountId}`)
        this.handleReconnect()
      } else {
        log.info(`IMAP connection closed normally for account ${this.accountId}`)
      }
    })

    this.imap.on('mail', (numNewMsgs) => {
      this.lastActivity = Date.now()
      this.emit('newMail', numNewMsgs)
      log.info(`${numNewMsgs} new messages received for account ${this.accountId}`)
    })

    this.imap.on('expunge', (seqno) => {
      this.lastActivity = Date.now()
      this.emit('messageDeleted', seqno)
    })

    this.imap.on('update', (seqno, info) => {
      this.lastActivity = Date.now()
      this.emit('messageUpdated', seqno, info)
    })
  }

  async connect(): Promise<void> {
    if (this.isConnected) return

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP connection timeout'))
      }, 30000)

      this.once('connected', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      this.imap.connect()
    })
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return

    this.stopKeepAlive()
    this.stopIdle()
    
    return new Promise((resolve) => {
      this.once('disconnected', resolve)
      this.imap.end()
    })
  }

  async selectMailbox(mailbox: string = 'INBOX'): Promise<any> {
    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (error, box) => {
        if (error) {
          reject(error)
        } else {
          this.lastActivity = Date.now()
          resolve(box)
        }
      })
    })
  }

  async getMailboxes(): Promise<MailFolder[]> {
    return new Promise((resolve, reject) => {
      this.imap.getBoxes((error, boxes) => {
        if (error) {
          reject(error)
        } else {
          const folders = this.parseMailboxes(boxes)
          this.lastActivity = Date.now()
          resolve(folders)
        }
      })
    })
  }

  private parseMailboxes(boxes: any, parentPath = ''): MailFolder[] {
    const folders: MailFolder[] = []
    
    for (const [name, box] of Object.entries(boxes)) {
      const fullPath = parentPath ? `${parentPath}${box.delimiter}${name}` : name
      
      const folder: MailFolder = {
        id: Buffer.from(fullPath).toString('base64'),
        accountId: this.accountId,
        name,
        displayName: name,
        type: this.getFolderType(name.toLowerCase()),
        path: fullPath,
        attributes: box.attribs || [],
        messageCount: box.messages?.total || 0,
        unreadCount: box.messages?.unseen || 0,
        isSelectable: !box.attribs?.includes('\\Noselect'),
        syncStatus: {
          isBeingSynced: false
        }
      }
      
      folders.push(folder)
      
      // Process child folders
      if (box.children) {
        folders.push(...this.parseMailboxes(box.children, fullPath))
      }
    }
    
    return folders
  }

  private getFolderType(name: string): MailFolder['type'] {
    if (name.includes('inbox')) return 'inbox'
    if (name.includes('sent')) return 'sent'
    if (name.includes('draft')) return 'drafts'
    if (name.includes('trash') || name.includes('deleted')) return 'trash'
    if (name.includes('spam') || name.includes('junk')) return 'spam'
    if (name.includes('archive')) return 'archive'
    if (name.startsWith('[') || name.startsWith('INBOX.')) return 'system'
    return 'custom'
  }

  async searchMessages(criteria: ImapSearchOptions): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const searchCriteria: any[] = []
      
      if (criteria.query) {
        searchCriteria.push(...criteria.query)
      }
      if (criteria.since) {
        searchCriteria.push(['SINCE', criteria.since])
      }
      if (criteria.before) {
        searchCriteria.push(['BEFORE', criteria.before])
      }
      if (criteria.unseen) {
        searchCriteria.push('UNSEEN')
      }
      if (criteria.seen) {
        searchCriteria.push('SEEN')
      }
      if (criteria.flagged) {
        searchCriteria.push('FLAGGED')
      }
      if (criteria.from) {
        searchCriteria.push(['FROM', criteria.from])
      }
      if (criteria.to) {
        searchCriteria.push(['TO', criteria.to])
      }
      if (criteria.subject) {
        searchCriteria.push(['SUBJECT', criteria.subject])
      }
      if (criteria.body) {
        searchCriteria.push(['BODY', criteria.body])
      }
      if (criteria.larger) {
        searchCriteria.push(['LARGER', criteria.larger])
      }
      if (criteria.smaller) {
        searchCriteria.push(['SMALLER', criteria.smaller])
      }
      if (criteria.uid) {
        searchCriteria.push(['UID', criteria.uid.join(',')])
      }

      // Default to 'ALL' if no criteria
      if (searchCriteria.length === 0) {
        searchCriteria.push('ALL')
      }

      this.imap.search(searchCriteria, (error, results) => {
        if (error) {
          reject(error)
        } else {
          this.lastActivity = Date.now()
          resolve(results || [])
        }
      })
    })
  }

  async fetchMessages(uids: number[], options: ImapFetchOptions = {}): Promise<ImapMessage[]> {
    return new Promise((resolve, reject) => {
      const fetchOptions = {
        bodies: options.bodies || ['HEADER', 'TEXT'],
        struct: options.struct !== false,
        envelope: options.envelope !== false,
        size: options.size !== false,
        markSeen: options.markSeen || false
      }

      const messages: ImapMessage[] = []
      const fetch = this.imap.fetch(uids, fetchOptions)

      fetch.on('message', (msg, seqno) => {
        const message: Partial<ImapMessage> = { uid: seqno }
        let headerReceived = false
        let bodyReceived = false

        msg.on('body', (stream, info) => {
          let buffer = ''
          
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8')
          })

          stream.on('end', () => {
            if (info.which === 'HEADER') {
              message.header = Imap.parseHeader(buffer)
              headerReceived = true
            } else {
              message.body = buffer
              bodyReceived = true
            }
          })
        })

        msg.on('attributes', (attrs) => {
          message.uid = attrs.uid
          message.flags = attrs.flags
          message.date = attrs.date
          message.struct = attrs.struct
          message.size = attrs.size
        })

        msg.on('end', () => {
          if (headerReceived && bodyReceived) {
            messages.push(message as ImapMessage)
          }
        })
      })

      fetch.on('error', reject)

      fetch.on('end', () => {
        this.lastActivity = Date.now()
        resolve(messages)
      })
    })
  }

  async setFlags(uids: number[], flags: string[], action: 'add' | 'remove' | 'set' = 'set'): Promise<void> {
    return new Promise((resolve, reject) => {
      let method: string
      switch (action) {
        case 'add':
          method = 'addFlags'
          break
        case 'remove':
          method = 'delFlags'
          break
        default:
          method = 'setFlags'
      }

      this.imap[method](uids, flags, (error) => {
        if (error) {
          reject(error)
        } else {
          this.lastActivity = Date.now()
          resolve()
        }
      })
    })
  }

  async moveMessages(uids: number[], targetMailbox: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.move(uids, targetMailbox, (error) => {
        if (error) {
          reject(error)
        } else {
          this.lastActivity = Date.now()
          resolve()
        }
      })
    })
  }

  async copyMessages(uids: number[], targetMailbox: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.copy(uids, targetMailbox, (error) => {
        if (error) {
          reject(error)
        } else {
          this.lastActivity = Date.now()
          resolve()
        }
      })
    })
  }

  async expungeMessages(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.expunge((error) => {
        if (error) {
          reject(error)
        } else {
          this.lastActivity = Date.now()
          resolve()
        }
      })
    })
  }

  async startIdle(): Promise<void> {
    if (this.isIdling || !this.isConnected) return

    return new Promise((resolve, reject) => {
      this.imap.idle((error) => {
        if (error) {
          reject(error)
        } else {
          this.isIdling = true
          this.emit('idleStarted')
          log.info(`IDLE started for account ${this.accountId}`)
          
          // Set timeout to refresh IDLE connection every 29 minutes (before 30min timeout)
          this.idleTimeout = setTimeout(() => {
            this.refreshIdle()
          }, 29 * 60 * 1000)
          
          resolve()
        }
      })
    })
  }

  async stopIdle(): Promise<void> {
    if (!this.isIdling) return

    return new Promise((resolve) => {
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout)
        this.idleTimeout = undefined
      }

      this.imap.done(() => {
        this.isIdling = false
        this.emit('idleStopped')
        log.info(`IDLE stopped for account ${this.accountId}`)
        resolve()
      })
    })
  }

  private async refreshIdle(): Promise<void> {
    if (!this.isIdling) return

    try {
      await this.stopIdle()
      await this.startIdle()
      log.info(`IDLE refreshed for account ${this.accountId}`)
    } catch (error) {
      log.error(`Failed to refresh IDLE for account ${this.accountId}:`, error)
      this.emit('error', error)
    }
  }

  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.isConnected && !this.isIdling) {
        // Send NOOP to keep connection alive
        this.imap.noop((error) => {
          if (error) {
            log.error(`Keep-alive NOOP failed for account ${this.accountId}:`, error)
          }
        })
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = undefined
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error(`Max reconnect attempts reached for account ${this.accountId}`)
      this.emit('maxReconnectAttemptsReached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff
    
    log.info(`Attempting to reconnect IMAP for account ${this.accountId} in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        log.error(`Reconnect attempt ${this.reconnectAttempts} failed for account ${this.accountId}:`, error)
        this.handleReconnect()
      }
    }, delay)
  }

  getStatus(): { connected: boolean, idling: boolean, lastActivity: Date } {
    return {
      connected: this.isConnected,
      idling: this.isIdling,
      lastActivity: new Date(this.lastActivity)
    }
  }

  async destroy(): Promise<void> {
    this.stopKeepAlive()
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
    }
    
    if (this.isConnected) {
      await this.disconnect()
    }
    
    this.removeAllListeners()
  }
}

/**
 * IMAP Connection Pool Manager
 */
export class ImapConnectionPool extends EventEmitter {
  private connections: Map<string, ImapConnection> = new Map()
  private maxConnections = 10
  private connectionTimeout = 30000

  constructor(maxConnections = 10) {
    super()
    this.maxConnections = maxConnections
  }

  async getConnection(accountId: string, config: ImapConfig): Promise<ImapConnection> {
    let connection = this.connections.get(accountId)
    
    if (!connection) {
      if (this.connections.size >= this.maxConnections) {
        throw new Error('Maximum number of IMAP connections reached')
      }
      
      connection = new ImapConnection(config, accountId)
      this.connections.set(accountId, connection)
      
      // Setup connection event handlers
      connection.on('error', (error) => {
        log.error(`Connection error for ${accountId}:`, error)
        this.emit('connectionError', accountId, error)
      })
      
      connection.on('disconnected', () => {
        this.connections.delete(accountId)
        this.emit('connectionClosed', accountId)
      })
    }
    
    // Ensure connection is established
    if (!connection.getStatus().connected) {
      await connection.connect()
    }
    
    return connection
  }

  async closeConnection(accountId: string): Promise<void> {
    const connection = this.connections.get(accountId)
    if (connection) {
      await connection.destroy()
      this.connections.delete(accountId)
    }
  }

  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.entries()).map(
      ([accountId, connection]) => this.closeConnection(accountId)
    )
    
    await Promise.all(closePromises)
    this.connections.clear()
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys())
  }

  getConnectionStatus(accountId: string): { connected: boolean, idling: boolean, lastActivity: Date } | null {
    const connection = this.connections.get(accountId)
    return connection ? connection.getStatus() : null
  }
}

export default ImapConnectionPool