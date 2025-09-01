/**
 * SQLite-based Email Cache System
 * 
 * High-performance email caching with full-text search indexing,
 * attachment management, and optimized queries for large mailboxes
 */

import Database from 'better-sqlite3'
import log from 'electron-log'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import type { 
  EmailMessage, 
  MailFolder, 
  EmailThread, 
  MailSyncStatus,
  EmailAttachment,
  EmailAddress 
} from '@flow-desk/shared'

export interface CacheStatistics {
  totalMessages: number
  totalAttachments: number
  databaseSize: number
  lastVacuum: Date
  messagesByAccount: Record<string, number>
  messagesByFolder: Record<string, number>
}

export interface SearchOptions {
  query?: string
  accountId?: string
  folderId?: string
  from?: string
  to?: string
  subject?: string
  hasAttachments?: boolean
  isUnread?: boolean
  isStarred?: boolean
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
  sortBy?: 'date' | 'from' | 'subject' | 'size'
  sortOrder?: 'asc' | 'desc'
}

export interface MessageUpdate {
  flags?: Partial<EmailMessage['flags']>
  folder?: string
  labels?: string[]
}

class EmailCache {
  private db: Database.Database
  private dbPath: string
  private isInitialized = false

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'email-cache.db')
    this.ensureDbDirectory()
    this.db = new Database(this.dbPath)
    this.initialize()
  }

  private ensureDbDirectory(): void {
    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
  }

  private initialize(): void {
    if (this.isInitialized) return

    try {
      // Enable WAL mode for better concurrent performance
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
      this.db.pragma('cache_size = 10000')
      this.db.pragma('temp_store = memory')
      this.db.pragma('mmap_size = 268435456') // 256MB

      // Create tables
      this.createTables()
      this.createIndexes()
      this.createTriggers()
      
      this.isInitialized = true
      log.info('Email cache initialized successfully', { dbPath: this.dbPath })
    } catch (error) {
      log.error('Failed to initialize email cache:', error)
      throw error
    }
  }

  private createTables(): void {
    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_html TEXT,
        body_text TEXT,
        snippet TEXT NOT NULL,
        from_name TEXT,
        from_address TEXT NOT NULL,
        date INTEGER NOT NULL,
        folder TEXT NOT NULL,
        importance TEXT DEFAULT 'normal',
        priority TEXT DEFAULT 'normal',
        size INTEGER DEFAULT 0,
        message_id TEXT,
        in_reply_to TEXT,
        references TEXT,
        
        -- Flags
        is_read INTEGER DEFAULT 0,
        is_starred INTEGER DEFAULT 0,
        is_trashed INTEGER DEFAULT 0,
        is_spam INTEGER DEFAULT 0,
        is_important INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        is_sent INTEGER DEFAULT 0,
        has_attachments INTEGER DEFAULT 0,
        
        -- Metadata
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )
    `)

    // Recipients table (normalized for better search performance)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_recipients (
        message_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('to', 'cc', 'bcc', 'reply_to')),
        name TEXT,
        address TEXT NOT NULL,
        PRIMARY KEY (message_id, type, address),
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `)

    // Labels/Tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_labels (
        message_id TEXT NOT NULL,
        label TEXT NOT NULL,
        PRIMARY KEY (message_id, label),
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `)

    // Attachments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        content_id TEXT,
        is_inline INTEGER DEFAULT 0,
        download_url TEXT,
        local_path TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `)

    // Accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        last_sync_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Folders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        is_selectable INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )
    `)

    // Threads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        participant_addresses TEXT NOT NULL, -- JSON array
        has_unread INTEGER DEFAULT 0,
        has_starred INTEGER DEFAULT 0,
        has_important INTEGER DEFAULT 0,
        has_attachments INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        last_message_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )
    `)

    // Sync status table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_status (
        account_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'idle',
        last_sync_at INTEGER,
        current_operation TEXT,
        progress INTEGER DEFAULT 0,
        total_messages INTEGER DEFAULT 0,
        new_messages INTEGER DEFAULT 0,
        updated_messages INTEGER DEFAULT 0,
        deleted_messages INTEGER DEFAULT 0,
        sync_errors INTEGER DEFAULT 0,
        last_error TEXT,
        last_error_at INTEGER,
        FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
      )
    `)

    // Full-text search table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id UNINDEXED,
        subject,
        body_text,
        from_name,
        from_address,
        snippet,
        content='messages',
        content_rowid='rowid'
      )
    `)
  }

  private createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages (account_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_folder ON messages (folder)',
      'CREATE INDEX IF NOT EXISTS idx_messages_date ON messages (date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_messages_flags ON messages (is_read, is_starred, is_trashed)',
      'CREATE INDEX IF NOT EXISTS idx_messages_from ON messages (from_address)',
      'CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages (message_id)',
      'CREATE INDEX IF NOT EXISTS idx_message_recipients_address ON message_recipients (address)',
      'CREATE INDEX IF NOT EXISTS idx_message_recipients_type ON message_recipients (type)',
      'CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id)',
      'CREATE INDEX IF NOT EXISTS idx_folders_account_id ON folders (account_id)',
      'CREATE INDEX IF NOT EXISTS idx_threads_account_id ON threads (account_id)',
      'CREATE INDEX IF NOT EXISTS idx_threads_last_message ON threads (last_message_at DESC)',
      
      // Composite indexes for common queries
      'CREATE INDEX IF NOT EXISTS idx_messages_account_folder_date ON messages (account_id, folder, date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (account_id, is_read) WHERE is_read = 0',
      'CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages (account_id, is_starred) WHERE is_starred = 1',
      'CREATE INDEX IF NOT EXISTS idx_messages_attachments ON messages (account_id, has_attachments) WHERE has_attachments = 1',
    ]

    for (const index of indexes) {
      try {
        this.db.exec(index)
      } catch (error) {
        log.warn('Index creation failed (may already exist):', index)
      }
    }
  }

  private createTriggers(): void {
    // Update messages_fts when messages are inserted/updated/deleted
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(id, subject, body_text, from_name, from_address, snippet)
        VALUES (NEW.id, NEW.subject, NEW.body_text, NEW.from_name, NEW.from_address, NEW.snippet);
      END
    `)

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
        UPDATE messages_fts SET
          subject = NEW.subject,
          body_text = NEW.body_text,
          from_name = NEW.from_name,
          from_address = NEW.from_address,
          snippet = NEW.snippet
        WHERE id = NEW.id;
      END
    `)

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = OLD.id;
      END
    `)

    // Update thread statistics
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_thread_stats AFTER UPDATE ON messages BEGIN
        UPDATE threads SET
          has_unread = (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM messages WHERE thread_id = NEW.thread_id AND is_read = 0),
          has_starred = (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM messages WHERE thread_id = NEW.thread_id AND is_starred = 1),
          has_important = (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM messages WHERE thread_id = NEW.thread_id AND is_important = 1),
          has_attachments = (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM messages WHERE thread_id = NEW.thread_id AND has_attachments = 1),
          message_count = (SELECT COUNT(*) FROM messages WHERE thread_id = NEW.thread_id),
          last_message_at = (SELECT MAX(date) FROM messages WHERE thread_id = NEW.thread_id),
          updated_at = strftime('%s', 'now')
        WHERE id = NEW.thread_id;
      END
    `)

    // Update folder counts
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_folder_counts AFTER UPDATE ON messages BEGIN
        UPDATE folders SET
          message_count = (SELECT COUNT(*) FROM messages WHERE account_id = NEW.account_id AND folder = NEW.folder),
          unread_count = (SELECT COUNT(*) FROM messages WHERE account_id = NEW.account_id AND folder = NEW.folder AND is_read = 0),
          updated_at = strftime('%s', 'now')
        WHERE account_id = NEW.account_id AND path = NEW.folder;
      END
    `)

    // Auto-update timestamps
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_messages_timestamp AFTER UPDATE ON messages BEGIN
        UPDATE messages SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END
    `)
  }

  // Account management
  async upsertAccount(account: { id: string, email: string, provider: string, name: string }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (id, email, provider, name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        provider = excluded.provider,
        name = excluded.name,
        updated_at = strftime('%s', 'now')
    `)
    
    stmt.run(account.id, account.email, account.provider, account.name)
  }

  async deleteAccount(accountId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?')
    stmt.run(accountId)
    log.info(`Deleted account from cache: ${accountId}`)
  }

  // Message operations
  async insertMessage(message: EmailMessage): Promise<void> {
    const tx = this.db.transaction(() => {
      // Insert message
      const messageStmt = this.db.prepare(`
        INSERT OR REPLACE INTO messages (
          id, account_id, provider_id, thread_id, subject, body_html, body_text, snippet,
          from_name, from_address, date, folder, importance, priority, size, message_id,
          in_reply_to, references, is_read, is_starred, is_trashed, is_spam, is_important,
          is_archived, is_draft, is_sent, has_attachments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      messageStmt.run(
        message.id, message.accountId, message.providerId, message.threadId,
        message.subject, message.bodyHtml, message.bodyText, message.snippet,
        message.from.name, message.from.address, message.date.getTime(), message.folder,
        message.importance, message.priority, message.size, message.messageId,
        message.inReplyTo, message.references.join(','),
        message.flags.isRead ? 1 : 0, message.flags.isStarred ? 1 : 0,
        message.flags.isTrashed ? 1 : 0, message.flags.isSpam ? 1 : 0,
        message.flags.isImportant ? 1 : 0, message.flags.isArchived ? 1 : 0,
        message.flags.isDraft ? 1 : 0, message.flags.isSent ? 1 : 0,
        message.flags.hasAttachments ? 1 : 0
      )

      // Insert recipients
      this.insertRecipients(message.id, message.to, 'to')
      this.insertRecipients(message.id, message.cc, 'cc')
      this.insertRecipients(message.id, message.bcc, 'bcc')
      this.insertRecipients(message.id, message.replyTo, 'reply_to')

      // Insert labels
      if (message.labels.length > 0) {
        const labelStmt = this.db.prepare('INSERT OR REPLACE INTO message_labels (message_id, label) VALUES (?, ?)')
        for (const label of message.labels) {
          labelStmt.run(message.id, label)
        }
      }

      // Insert attachments
      if (message.attachments.length > 0) {
        this.insertAttachments(message.id, message.attachments)
      }
    })

    tx()
  }

  private insertRecipients(messageId: string, recipients: EmailAddress[], type: string): void {
    if (recipients.length === 0) return
    
    const stmt = this.db.prepare('INSERT OR REPLACE INTO message_recipients (message_id, type, name, address) VALUES (?, ?, ?, ?)')
    for (const recipient of recipients) {
      stmt.run(messageId, type, recipient.name, recipient.address)
    }
  }

  private insertAttachments(messageId: string, attachments: EmailAttachment[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO attachments (id, message_id, filename, mime_type, size, content_id, is_inline, download_url, local_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    for (const attachment of attachments) {
      stmt.run(
        attachment.id, messageId, attachment.filename, attachment.mimeType,
        attachment.size, attachment.contentId, attachment.isInline ? 1 : 0,
        attachment.downloadUrl, attachment.localPath
      )
    }
  }

  async updateMessage(messageId: string, updates: MessageUpdate): Promise<void> {
    const setParts: string[] = []
    const values: any[] = []

    if (updates.flags) {
      for (const [key, value] of Object.entries(updates.flags)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        setParts.push(`${dbKey} = ?`)
        values.push(value ? 1 : 0)
      }
    }

    if (updates.folder) {
      setParts.push('folder = ?')
      values.push(updates.folder)
    }

    if (setParts.length === 0) return

    setParts.push('updated_at = strftime(\'%s\', \'now\')')
    values.push(messageId)

    const sql = `UPDATE messages SET ${setParts.join(', ')} WHERE id = ?`
    const stmt = this.db.prepare(sql)
    stmt.run(...values)

    // Update labels if provided
    if (updates.labels) {
      this.db.prepare('DELETE FROM message_labels WHERE message_id = ?').run(messageId)
      if (updates.labels.length > 0) {
        const labelStmt = this.db.prepare('INSERT INTO message_labels (message_id, label) VALUES (?, ?)')
        for (const label of updates.labels) {
          labelStmt.run(messageId, label)
        }
      }
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?')
    stmt.run(messageId)
  }

  async deleteMessagesByAccount(accountId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM messages WHERE account_id = ?')
    stmt.run(accountId)
    log.info(`Deleted messages for account: ${accountId}`)
  }

  // Search operations
  async searchMessages(options: SearchOptions): Promise<EmailMessage[]> {
    let sql = `
      SELECT m.*, GROUP_CONCAT(ml.label) as labels
      FROM messages m
      LEFT JOIN message_labels ml ON m.id = ml.message_id
    `
    
    const conditions: string[] = []
    const values: any[] = []

    // Full-text search
    if (options.query) {
      sql = `
        SELECT m.*, GROUP_CONCAT(ml.label) as labels, fts.rank
        FROM messages_fts fts
        JOIN messages m ON m.id = fts.id
        LEFT JOIN message_labels ml ON m.id = ml.message_id
      `
      conditions.push('fts MATCH ?')
      values.push(options.query)
    }

    // Filters
    if (options.accountId) {
      conditions.push('m.account_id = ?')
      values.push(options.accountId)
    }

    if (options.folderId) {
      conditions.push('m.folder = ?')
      values.push(options.folderId)
    }

    if (options.from) {
      conditions.push('(m.from_address LIKE ? OR m.from_name LIKE ?)')
      values.push(`%${options.from}%`, `%${options.from}%`)
    }

    if (options.to) {
      conditions.push(`m.id IN (SELECT message_id FROM message_recipients WHERE type = 'to' AND (address LIKE ? OR name LIKE ?))`)
      values.push(`%${options.to}%`, `%${options.to}%`)
    }

    if (options.subject) {
      conditions.push('m.subject LIKE ?')
      values.push(`%${options.subject}%`)
    }

    if (options.hasAttachments !== undefined) {
      conditions.push('m.has_attachments = ?')
      values.push(options.hasAttachments ? 1 : 0)
    }

    if (options.isUnread !== undefined) {
      conditions.push('m.is_read = ?')
      values.push(options.isUnread ? 0 : 1)
    }

    if (options.isStarred !== undefined) {
      conditions.push('m.is_starred = ?')
      values.push(options.isStarred ? 1 : 0)
    }

    if (options.dateFrom) {
      conditions.push('m.date >= ?')
      values.push(options.dateFrom.getTime())
    }

    if (options.dateTo) {
      conditions.push('m.date <= ?')
      values.push(options.dateTo.getTime())
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' GROUP BY m.id'

    // Sorting
    const sortBy = options.sortBy || 'date'
    const sortOrder = options.sortOrder || 'desc'
    
    if (options.query && !options.sortBy) {
      sql += ' ORDER BY fts.rank'
    } else {
      sql += ` ORDER BY m.${sortBy} ${sortOrder.toUpperCase()}`
    }

    // Pagination
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`
      }
    }

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...values)

    return rows.map(this.rowToEmailMessage.bind(this))
  }

  async getMessage(messageId: string): Promise<EmailMessage | null> {
    const stmt = this.db.prepare(`
      SELECT m.*, GROUP_CONCAT(ml.label) as labels
      FROM messages m
      LEFT JOIN message_labels ml ON m.id = ml.message_id
      WHERE m.id = ?
      GROUP BY m.id
    `)
    
    const row = stmt.get(messageId)
    return row ? this.rowToEmailMessage(row) : null
  }

  async getMessagesByThread(threadId: string): Promise<EmailMessage[]> {
    const stmt = this.db.prepare(`
      SELECT m.*, GROUP_CONCAT(ml.label) as labels
      FROM messages m
      LEFT JOIN message_labels ml ON m.id = ml.message_id
      WHERE m.thread_id = ?
      GROUP BY m.id
      ORDER BY m.date ASC
    `)
    
    const rows = stmt.all(threadId)
    return rows.map(this.rowToEmailMessage.bind(this))
  }

  private rowToEmailMessage(row: any): EmailMessage {
    // Get recipients
    const recipientStmt = this.db.prepare('SELECT * FROM message_recipients WHERE message_id = ?')
    const recipientRows = recipientStmt.all(row.id)
    
    const to: EmailAddress[] = []
    const cc: EmailAddress[] = []
    const bcc: EmailAddress[] = []
    const replyTo: EmailAddress[] = []
    
    for (const recip of recipientRows) {
      const address: EmailAddress = { address: recip.address, name: recip.name }
      switch (recip.type) {
        case 'to': to.push(address); break
        case 'cc': cc.push(address); break
        case 'bcc': bcc.push(address); break
        case 'reply_to': replyTo.push(address); break
      }
    }

    // Get attachments
    const attachmentStmt = this.db.prepare('SELECT * FROM attachments WHERE message_id = ?')
    const attachmentRows = attachmentStmt.all(row.id)
    
    const attachments: EmailAttachment[] = attachmentRows.map(att => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mime_type,
      size: att.size,
      contentId: att.content_id,
      isInline: Boolean(att.is_inline),
      downloadUrl: att.download_url,
      localPath: att.local_path
    }))

    return {
      id: row.id,
      accountId: row.account_id,
      providerId: row.provider_id,
      threadId: row.thread_id,
      subject: row.subject,
      bodyHtml: row.body_html,
      bodyText: row.body_text,
      snippet: row.snippet,
      from: { address: row.from_address, name: row.from_name },
      to,
      cc,
      bcc,
      replyTo,
      date: new Date(row.date),
      flags: {
        isRead: Boolean(row.is_read),
        isStarred: Boolean(row.is_starred),
        isTrashed: Boolean(row.is_trashed),
        isSpam: Boolean(row.is_spam),
        isImportant: Boolean(row.is_important),
        isArchived: Boolean(row.is_archived),
        isDraft: Boolean(row.is_draft),
        isSent: Boolean(row.is_sent),
        hasAttachments: Boolean(row.has_attachments)
      },
      labels: row.labels ? row.labels.split(',') : [],
      folder: row.folder,
      importance: row.importance,
      priority: row.priority,
      size: row.size,
      attachments,
      headers: {}, // Not cached for performance
      messageId: row.message_id,
      inReplyTo: row.in_reply_to,
      references: row.references ? row.references.split(',') : [],
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000)
    }
  }

  // Maintenance operations
  async vacuum(): Promise<void> {
    this.db.exec('VACUUM')
    log.info('Database vacuum completed')
  }

  async optimize(): Promise<void> {
    this.db.exec('ANALYZE')
    this.db.exec('PRAGMA optimize')
    log.info('Database optimization completed')
  }

  async getStatistics(): Promise<CacheStatistics> {
    const stats = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM attachments) as total_attachments,
        (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as database_size
    `).get()

    const messagesByAccount = this.db.prepare(`
      SELECT account_id, COUNT(*) as count 
      FROM messages 
      GROUP BY account_id
    `).all().reduce((acc, row) => {
      acc[row.account_id] = row.count
      return acc
    }, {})

    const messagesByFolder = this.db.prepare(`
      SELECT folder, COUNT(*) as count 
      FROM messages 
      GROUP BY folder
    `).all().reduce((acc, row) => {
      acc[row.folder] = row.count
      return acc
    }, {})

    return {
      totalMessages: stats.total_messages,
      totalAttachments: stats.total_attachments,
      databaseSize: stats.database_size,
      lastVacuum: new Date(), // Would need to store this
      messagesByAccount,
      messagesByFolder
    }
  }

  close(): void {
    if (this.db) {
      this.db.close()
      log.info('Email cache database closed')
    }
  }
}

export default EmailCache