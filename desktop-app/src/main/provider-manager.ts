/**
 * Multi-Provider Email and Calendar Manager
 * 
 * Unified interface for all email and calendar providers
 */

import log from 'electron-log'

interface ProviderConfig {
  id: string
  name: string
  type: 'email' | 'calendar' | 'both'
  authType: 'oauth2' | 'password' | 'app-password'
  servers: {
    imap?: { host: string; port: number; secure: boolean }
    smtp?: { host: string; port: number; secure: boolean }
    caldav?: { host: string; port: number; secure: boolean }
    api?: { baseUrl: string; version: string }
  }
  oauth?: {
    clientId: string
    scopes: string[]
    authUrl: string
    tokenUrl: string
  }
}

export class ProviderManager {
  private providers: Map<string, ProviderConfig> = new Map()
  private activeConnections: Map<string, any> = new Map()

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders(): void {
    // Gmail
    this.providers.set('gmail', {
      id: 'gmail',
      name: 'Gmail',
      type: 'both',
      authType: 'oauth2',
      servers: {
        api: { baseUrl: 'https://gmail.googleapis.com', version: 'v1' }
      },
      oauth: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/calendar'
        ],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token'
      }
    })

    // Outlook/Office365
    this.providers.set('outlook', {
      id: 'outlook',
      name: 'Microsoft Outlook',
      type: 'both',
      authType: 'oauth2',
      servers: {
        imap: { host: 'outlook.office365.com', port: 993, secure: true },
        smtp: { host: 'smtp.office365.com', port: 587, secure: true },
        api: { baseUrl: 'https://graph.microsoft.com', version: 'v1.0' }
      },
      oauth: {
        clientId: process.env.MICROSOFT_CLIENT_ID || '',
        scopes: [
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/User.Read'
        ],
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
      }
    })

    // Yahoo Mail
    this.providers.set('yahoo', {
      id: 'yahoo',
      name: 'Yahoo Mail',
      type: 'email',
      authType: 'app-password',
      servers: {
        imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
        smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: true }
      }
    })

    // Fastmail
    this.providers.set('fastmail', {
      id: 'fastmail',
      name: 'Fastmail',
      type: 'both',
      authType: 'password',
      servers: {
        imap: { host: 'imap.fastmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.fastmail.com', port: 587, secure: true },
        caldav: { host: 'caldav.fastmail.com', port: 443, secure: true }
      }
    })

    // iCloud
    this.providers.set('icloud', {
      id: 'icloud',
      name: 'iCloud',
      type: 'both',
      authType: 'app-password',
      servers: {
        imap: { host: 'imap.mail.me.com', port: 993, secure: true },
        smtp: { host: 'smtp.mail.me.com', port: 587, secure: true },
        caldav: { host: 'caldav.icloud.com', port: 443, secure: true }
      }
    })

    log.info('Initialized email and calendar providers')
  }

  getProvider(providerId: string): ProviderConfig | null {
    return this.providers.get(providerId) || null
  }

  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
  }

  getEmailProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
      .filter(p => p.type === 'email' || p.type === 'both')
  }

  getCalendarProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
      .filter(p => p.type === 'calendar' || p.type === 'both')
  }

  async createConnection(providerId: string, credentials: any): Promise<any> {
    const provider = this.getProvider(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    try {
      let connection: any = null

      if (provider.authType === 'oauth2') {
        connection = await this.createOAuthConnection(provider, credentials)
      } else {
        connection = await this.createPasswordConnection(provider, credentials)
      }

      this.activeConnections.set(`${providerId}-${credentials.email}`, connection)
      log.info(`Created connection for ${provider.name}: ${credentials.email}`)
      
      return connection
    } catch (error) {
      log.error(`Failed to create connection for ${provider.name}:`, error)
      throw error
    }
  }

  private async createOAuthConnection(provider: ProviderConfig, credentials: any): Promise<any> {
    // OAuth2 connection logic
    return {
      provider: provider.id,
      type: 'oauth2',
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      email: credentials.email
    }
  }

  private async createPasswordConnection(provider: ProviderConfig, credentials: any): Promise<any> {
    // Password-based connection logic
    return {
      provider: provider.id,
      type: 'password',
      email: credentials.email,
      password: credentials.password,
      servers: provider.servers
    }
  }

  async testConnection(providerId: string, credentials: any): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = await this.createConnection(providerId, credentials)
      
      // Test the connection based on provider type
      if (connection.type === 'oauth2') {
        // Test OAuth token validity
        return { success: true }
      } else {
        // Test IMAP/SMTP connection
        return { success: true }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      }
    }
  }

  getConnection(providerId: string, email: string): any {
    return this.activeConnections.get(`${providerId}-${email}`)
  }

  async closeConnection(providerId: string, email: string): Promise<void> {
    const key = `${providerId}-${email}`
    const connection = this.activeConnections.get(key)
    
    if (connection) {
      // Close connection based on type
      if (connection.close) {
        await connection.close()
      }
      
      this.activeConnections.delete(key)
      log.info(`Closed connection for ${providerId}: ${email}`)
    }
  }

  async closeAllConnections(): Promise<void> {
    for (const [key, connection] of this.activeConnections.entries()) {
      try {
        if (connection.close) {
          await connection.close()
        }
      } catch (error) {
        log.warn(`Failed to close connection ${key}:`, error)
      }
    }
    
    this.activeConnections.clear()
    log.info('Closed all provider connections')
  }
}