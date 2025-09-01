/**
 * OAuth2 Manager for Multi-Provider Email Authentication
 * 
 * Handles OAuth2 flows for Gmail, Outlook, and other supported providers
 */

import { BrowserWindow, shell } from 'electron'
import log from 'electron-log'
import { URLSearchParams } from 'url'
import CryptoJS from 'crypto-js'
import { getOAuthConfig } from './providers/provider-config'
import type { MailAccount, MailAccountCredentials } from '@flow-desk/shared'

export interface OAuthCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  scope?: string
  tokenType?: string
}

export interface OAuthFlowResult {
  credentials: OAuthCredentials
  userInfo: {
    email: string
    name?: string
  }
}

export interface OAuthProvider {
  id: string
  name: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
  userInfoUrl?: string
}

class OAuth2Manager {
  private encryptionKey: string
  private providers: Map<string, OAuthProvider> = new Map()
  private activeFlows: Map<string, { window: BrowserWindow, resolve: Function, reject: Function }> = new Map()

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey
    this.initializeProviders()
  }

  private initializeProviders() {
    // Gmail OAuth Configuration
    this.providers.set('gmail', {
      id: 'gmail',
      name: 'Gmail',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: 'http://localhost:8080/oauth/callback',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
    })

    // Outlook/Microsoft OAuth Configuration  
    this.providers.set('outlook', {
      id: 'outlook',
      name: 'Outlook',
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: 'http://localhost:8080/oauth/callback',
      scopes: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'https://outlook.office.com/SMTP.Send',
        'https://graph.microsoft.com/User.Read',
        'offline_access'
      ],
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
    })

    log.info('OAuth2 providers initialized', Array.from(this.providers.keys()))
  }

  /**
   * Start OAuth2 flow for a provider
   */
  async startOAuthFlow(providerId: string): Promise<OAuthFlowResult> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`OAuth provider ${providerId} not configured`)
    }

    if (!provider.clientId) {
      throw new Error(`OAuth client ID not configured for ${providerId}`)
    }

    return new Promise((resolve, reject) => {
      const state = this.generateState()
      const codeVerifier = this.generateCodeVerifier()
      const codeChallenge = this.generateCodeChallenge(codeVerifier)

      // Build authorization URL
      const authParams = new URLSearchParams({
        client_id: provider.clientId,
        response_type: 'code',
        redirect_uri: provider.redirectUri,
        scope: provider.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline', // For refresh tokens
        prompt: 'consent' // Force consent screen to get refresh token
      })

      const authUrl = `${provider.authUrl}?${authParams.toString()}`

      // Create OAuth window
      const oauthWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true
        }
      })

      // Store flow information
      this.activeFlows.set(state, {
        window: oauthWindow,
        resolve: async (authCode: string) => {
          try {
            const result = await this.exchangeCodeForTokens(provider, authCode, codeVerifier)
            resolve(result)
          } catch (error) {
            reject(error)
          } finally {
            this.activeFlows.delete(state)
          }
        },
        reject: (error: Error) => {
          reject(error)
          this.activeFlows.delete(state)
        }
      })

      // Handle window navigation
      oauthWindow.webContents.on('will-redirect', (event, navigationUrl) => {
        this.handleOAuthCallback(navigationUrl, state)
      })

      oauthWindow.webContents.on('did-navigate', (event, navigationUrl) => {
        this.handleOAuthCallback(navigationUrl, state)
      })

      // Handle window close
      oauthWindow.on('closed', () => {
        const flow = this.activeFlows.get(state)
        if (flow) {
          flow.reject(new Error('OAuth flow cancelled by user'))
          this.activeFlows.delete(state)
        }
      })

      // Load authorization URL
      oauthWindow.loadURL(authUrl)
      log.info(`Started OAuth flow for ${providerId}`, { state })
    })
  }

  /**
   * Handle OAuth callback URL
   */
  private handleOAuthCallback(url: string, state: string) {
    const flow = this.activeFlows.get(state)
    if (!flow) return

    try {
      const urlObj = new URL(url)
      
      // Check if this is our redirect URI
      if (!url.startsWith('http://localhost:8080/oauth/callback')) {
        return
      }

      const params = urlObj.searchParams
      const returnedState = params.get('state')
      const code = params.get('code')
      const error = params.get('error')

      if (error) {
        flow.reject(new Error(`OAuth error: ${error}`))
        flow.window.close()
        return
      }

      if (returnedState !== state) {
        flow.reject(new Error('OAuth state mismatch'))
        flow.window.close()
        return
      }

      if (code) {
        flow.resolve(code)
        flow.window.close()
      }
    } catch (error) {
      log.error('Error handling OAuth callback:', error)
      flow.reject(error)
      flow.window.close()
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(
    provider: OAuthProvider, 
    code: string, 
    codeVerifier: string
  ): Promise<OAuthFlowResult> {
    const tokenParams = new URLSearchParams({
      client_id: provider.clientId,
      code,
      redirect_uri: provider.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    })

    // Add client secret for providers that require it
    if (provider.clientSecret) {
      tokenParams.append('client_secret', provider.clientSecret)
    }

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: tokenParams.toString()
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
      }

      const tokenData = await response.json()

      // Create credentials object
      const credentials: OAuthCredentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        scope: tokenData.scope,
        tokenType: tokenData.token_type || 'Bearer'
      }

      // Get user info
      const userInfo = await this.getUserInfo(provider, credentials.accessToken)

      return {
        credentials,
        userInfo
      }
    } catch (error) {
      log.error('Token exchange failed:', error)
      throw new Error(`Failed to exchange authorization code: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user information using access token
   */
  private async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<{ email: string, name?: string }> {
    if (!provider.userInfoUrl) {
      return { email: '' } // Will need to be filled in later
    }

    try {
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.status}`)
      }

      const userData = await response.json()

      // Extract email and name based on provider
      if (provider.id === 'gmail') {
        return {
          email: userData.email,
          name: userData.name
        }
      } else if (provider.id === 'outlook') {
        return {
          email: userData.mail || userData.userPrincipalName,
          name: userData.displayName
        }
      }

      return { email: userData.email || '', name: userData.name }
    } catch (error) {
      log.warn('Failed to get user info:', error)
      return { email: '' } // Return empty, will be filled in during account setup
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(providerId: string, refreshToken: string): Promise<OAuthCredentials> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`OAuth provider ${providerId} not configured`)
    }

    const refreshParams = new URLSearchParams({
      client_id: provider.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })

    if (provider.clientSecret) {
      refreshParams.append('client_secret', provider.clientSecret)
    }

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: refreshParams.toString()
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`)
      }

      const tokenData = await response.json()

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token or keep existing
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        scope: tokenData.scope,
        tokenType: tokenData.token_type || 'Bearer'
      }
    } catch (error) {
      log.error('Token refresh failed:', error)
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if access token needs refresh
   */
  needsRefresh(credentials: MailAccountCredentials): boolean {
    if (!credentials.tokenExpiresAt) return false
    
    // Refresh if expires within 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    return credentials.tokenExpiresAt <= fiveMinutesFromNow
  }

  /**
   * Encrypt credentials for storage
   */
  encryptCredentials(credentials: OAuthCredentials): MailAccountCredentials {
    return {
      accessToken: this.encrypt(credentials.accessToken),
      refreshToken: credentials.refreshToken ? this.encrypt(credentials.refreshToken) : undefined,
      tokenExpiresAt: credentials.expiresAt,
      additionalTokens: credentials.scope ? { scope: credentials.scope } : {}
    }
  }

  /**
   * Decrypt credentials from storage
   */
  decryptCredentials(credentials: MailAccountCredentials): OAuthCredentials | null {
    try {
      return {
        accessToken: this.decrypt(credentials.accessToken || ''),
        refreshToken: credentials.refreshToken ? this.decrypt(credentials.refreshToken) : undefined,
        expiresAt: credentials.tokenExpiresAt || new Date(),
        scope: credentials.additionalTokens?.scope
      }
    } catch (error) {
      log.error('Failed to decrypt credentials:', error)
      return null
    }
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeToken(providerId: string, accessToken: string): Promise<void> {
    const provider = this.providers.get(providerId)
    if (!provider) return

    try {
      if (provider.id === 'gmail') {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST'
        })
      } else if (provider.id === 'outlook') {
        // Microsoft doesn't have a simple revoke endpoint
        // Token will expire naturally
        log.info('Outlook token revocation - token will expire naturally')
      }
    } catch (error) {
      log.warn('Failed to revoke token:', error)
      // Not critical - tokens will expire eventually
    }
  }

  /**
   * Generate cryptographically secure state parameter
   */
  private generateState(): string {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex)
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64url)
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(verifier: string): string {
    return CryptoJS.SHA256(verifier).toString(CryptoJS.enc.Base64url)
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString()
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(cipherText: string): string {
    const bytes = CryptoJS.AES.decrypt(cipherText, this.encryptionKey)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  /**
   * Cleanup active flows
   */
  cleanup() {
    for (const [state, flow] of this.activeFlows.entries()) {
      flow.window.close()
      flow.reject(new Error('OAuth manager shutting down'))
    }
    this.activeFlows.clear()
  }
}

export default OAuth2Manager