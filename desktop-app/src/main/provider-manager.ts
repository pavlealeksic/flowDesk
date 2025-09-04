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

  async testConnection(providerId: string, credentials: any): Promise<{ success: boolean; error?: string; details?: any }> {
    const testStartTime = Date.now()
    
    try {
      const provider = this.getProvider(providerId)
      if (!provider) {
        return { 
          success: false, 
          error: `Provider not found: ${providerId}` 
        }
      }

      const connection = await this.createConnection(providerId, credentials)
      
      // Test the connection based on provider type
      if (connection.type === 'oauth2') {
        // Test OAuth token validity by attempting to validate the token
        const testResult = await this.testOAuthConnection(provider, connection)
        return {
          success: testResult.valid,
          error: testResult.valid ? undefined : testResult.error,
          details: {
            providerId,
            email: credentials.email,
            testDurationMs: Date.now() - testStartTime,
            tokenValid: testResult.valid,
            scopes: testResult.scopes || []
          }
        }
      } else {
        // Test IMAP/SMTP connection
        const testResult = await this.testPasswordConnection(provider, connection)
        return {
          success: testResult.connected,
          error: testResult.connected ? undefined : testResult.error,
          details: {
            providerId,
            email: credentials.email,
            testDurationMs: Date.now() - testStartTime,
            imapConnected: testResult.imapConnected,
            smtpConnected: testResult.smtpConnected
          }
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed',
        details: {
          providerId,
          testDurationMs: Date.now() - testStartTime,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        }
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

  /**
   * Test OAuth connection by validating token
   */
  private async testOAuthConnection(provider: ProviderConfig, connection: any): Promise<{ valid: boolean; error?: string; scopes?: string[] }> {
    try {
      if (provider.id === 'gmail') {
        // Test Gmail OAuth token by making a simple API call
        const response = await this.testGmailToken(connection.accessToken)
        return {
          valid: response.valid,
          error: response.error,
          scopes: response.scopes
        }
      } else if (provider.id === 'outlook') {
        // Test Microsoft Graph token
        const response = await this.testMicrosoftToken(connection.accessToken)
        return {
          valid: response.valid,
          error: response.error,
          scopes: response.scopes
        }
      } else {
        // Generic OAuth test - just check if token exists
        return {
          valid: !!connection.accessToken,
          error: connection.accessToken ? undefined : 'No access token provided',
          scopes: []
        }
      }
    } catch (error) {
      log.error('OAuth connection test failed:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'OAuth token validation failed',
        scopes: []
      }
    }
  }

  /**
   * Test password-based connection (IMAP/SMTP)
   */
  private async testPasswordConnection(provider: ProviderConfig, connection: any): Promise<{ connected: boolean; error?: string; imapConnected?: boolean; smtpConnected?: boolean }> {
    try {
      let imapConnected = false
      let smtpConnected = false
      const errors: string[] = []

      // Test IMAP connection if available
      if (provider.servers.imap) {
        try {
          imapConnected = await this.testImapConnection(provider.servers.imap, connection)
        } catch (error) {
          errors.push(`IMAP: ${error instanceof Error ? error.message : 'Connection failed'}`)
        }
      }

      // Test SMTP connection if available
      if (provider.servers.smtp) {
        try {
          smtpConnected = await this.testSmtpConnection(provider.servers.smtp, connection)
        } catch (error) {
          errors.push(`SMTP: ${error instanceof Error ? error.message : 'Connection failed'}`)
        }
      }

      const connected = imapConnected || smtpConnected
      return {
        connected,
        error: connected ? undefined : errors.join('; '),
        imapConnected,
        smtpConnected
      }
    } catch (error) {
      log.error('Password connection test failed:', error)
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        imapConnected: false,
        smtpConnected: false
      }
    }
  }

  /**
   * Test Gmail OAuth token validity
   */
  private async testGmailToken(accessToken: string): Promise<{ valid: boolean; error?: string; scopes?: string[] }> {
    try {
      // Make a simple API call to verify token
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        return {
          valid: true,
          scopes: ['gmail'] // Simplified scope indication
        }
      } else {
        const errorText = await response.text()
        return {
          valid: false,
          error: `Gmail API returned ${response.status}: ${errorText}`,
          scopes: []
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Gmail token validation failed',
        scopes: []
      }
    }
  }

  /**
   * Test Microsoft Graph OAuth token validity
   */
  private async testMicrosoftToken(accessToken: string): Promise<{ valid: boolean; error?: string; scopes?: string[] }> {
    try {
      // Make a simple API call to verify token
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        return {
          valid: true,
          scopes: ['graph'] // Simplified scope indication
        }
      } else {
        const errorText = await response.text()
        return {
          valid: false,
          error: `Microsoft Graph returned ${response.status}: ${errorText}`,
          scopes: []
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Microsoft Graph token validation failed',
        scopes: []
      }
    }
  }

  /**
   * Test IMAP connection
   */
  private async testImapConnection(imapServer: { host: string; port: number; secure: boolean }, connection: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // For now, we'll do a basic TCP connection test
      // In a full implementation, you'd use a proper IMAP library
      const net = require('net')
      const socket = new net.Socket()
      
      const timeout = setTimeout(() => {
        socket.destroy()
        reject(new Error('IMAP connection timeout'))
      }, 5000)

      socket.connect(imapServer.port, imapServer.host, () => {
        clearTimeout(timeout)
        socket.destroy()
        log.info(`IMAP connection test successful to ${imapServer.host}:${imapServer.port}`)
        resolve(true)
      })

      socket.on('error', (error) => {
        clearTimeout(timeout)
        socket.destroy()
        log.error(`IMAP connection test failed to ${imapServer.host}:${imapServer.port}:`, error)
        reject(error)
      })
    })
  }

  /**
   * Test SMTP connection
   */
  private async testSmtpConnection(smtpServer: { host: string; port: number; secure: boolean }, connection: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // For now, we'll do a basic TCP connection test
      // In a full implementation, you'd use a proper SMTP library
      const net = require('net')
      const socket = new net.Socket()
      
      const timeout = setTimeout(() => {
        socket.destroy()
        reject(new Error('SMTP connection timeout'))
      }, 5000)

      socket.connect(smtpServer.port, smtpServer.host, () => {
        clearTimeout(timeout)
        socket.destroy()
        log.info(`SMTP connection test successful to ${smtpServer.host}:${smtpServer.port}`)
        resolve(true)
      })

      socket.on('error', (error) => {
        clearTimeout(timeout)
        socket.destroy()
        log.error(`SMTP connection test failed to ${smtpServer.host}:${smtpServer.port}:`, error)
        reject(error)
      })
    })
  }
}