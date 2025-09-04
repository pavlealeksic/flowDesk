/**
 * Production Email API - Renderer Side
 * 
 * Provides a clean interface for the renderer process to interact with
 * the production email service running in the main process.
 */

import { 
  EmailCredentials, 
  AccountSetupResult, 
  ValidationResult, 
  SyncResult, 
  EmailMessage, 
  NewMessage, 
  MailFolder, 
  ServerConfig 
} from '../types/email'

export class ProductionEmailAPI {
  private ipcRenderer: any

  constructor() {
    // Access ipcRenderer through window.electronAPI (provided by preload script)
    this.ipcRenderer = (window as any).electronAPI
    if (!this.ipcRenderer) {
      throw new Error('Electron API not available. Make sure preload script is loaded.')
    }
  }

  // Account Management
  
  /**
   * Setup a new email account with automatic server detection
   */
  async setupEmailAccount(userId: string, credentials: EmailCredentials): Promise<AccountSetupResult> {
    return await this.ipcRenderer.invoke('email:setup-account', userId, credentials)
  }

  /**
   * Remove an email account and its stored credentials
   */
  async removeAccount(accountId: string): Promise<void> {
    return await this.ipcRenderer.invoke('email:remove-account', accountId)
  }

  /**
   * Update the password for an email account
   */
  async updateAccountPassword(accountId: string, newPassword: string): Promise<void> {
    return await this.ipcRenderer.invoke('email:update-password', accountId, newPassword)
  }

  /**
   * Get list of all stored email account IDs
   */
  async getStoredAccounts(): Promise<string[]> {
    return await this.ipcRenderer.invoke('email:get-stored-accounts')
  }

  /**
   * Test email setup without storing credentials
   */
  async testEmailSetup(credentials: EmailCredentials): Promise<ValidationResult> {
    return await this.ipcRenderer.invoke('email:test-setup', credentials)
  }

  // Server Configuration

  /**
   * Get server configuration for an email address
   */
  async getServerConfig(email: string): Promise<ServerConfig> {
    return await this.ipcRenderer.invoke('email:get-server-config', email)
  }

  // Email Operations

  /**
   * Sync emails for an account
   */
  async syncAccount(accountId: string): Promise<SyncResult> {
    return await this.ipcRenderer.invoke('email:sync-account', accountId)
  }

  /**
   * Send an email
   */
  async sendEmail(accountId: string, message: NewMessage): Promise<void> {
    return await this.ipcRenderer.invoke('email:send', accountId, message)
  }

  /**
   * Get folders for an account
   */
  async getFolders(accountId: string): Promise<MailFolder[]> {
    return await this.ipcRenderer.invoke('email:get-folders', accountId)
  }

  /**
   * Get messages from a folder
   */
  async getMessages(accountId: string, folderName: string, limit?: number): Promise<EmailMessage[]> {
    return await this.ipcRenderer.invoke('email:get-messages', accountId, folderName, limit)
  }

  /**
   * Mark a message as read or unread
   */
  async markMessageRead(accountId: string, folderName: string, messageUid: number, isRead: boolean): Promise<void> {
    return await this.ipcRenderer.invoke('email:mark-read', accountId, folderName, messageUid, isRead)
  }

  /**
   * Delete a message
   */
  async deleteMessage(accountId: string, folderName: string, messageUid: number): Promise<void> {
    return await this.ipcRenderer.invoke('email:delete-message', accountId, folderName, messageUid)
  }

  // System Operations

  /**
   * Get health status of all email connections
   * Returns a map of accountId -> [imapHealthy, smtpHealthy]
   */
  async getHealthStatus(): Promise<Record<string, [boolean, boolean]>> {
    return await this.ipcRenderer.invoke('email:health-check')
  }

  /**
   * Close connections for a specific account
   */
  async closeConnections(accountId: string): Promise<void> {
    return await this.ipcRenderer.invoke('email:close-connections', accountId)
  }

  // Utility Methods

  /**
   * Detect email provider from email address
   */
  detectProvider(email: string): string {
    const domain = email.split('@')[1]?.toLowerCase()
    
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return 'Gmail'
    }
    
    if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
      return 'Outlook'
    }
    
    if (['yahoo.com', 'yahoo.co.uk', 'yahoo.fr'].includes(domain)) {
      return 'Yahoo'
    }
    
    if (['protonmail.com', 'protonmail.ch', 'pm.me'].includes(domain)) {
      return 'ProtonMail'
    }
    
    if (['fastmail.com', 'fastmail.fm'].includes(domain)) {
      return 'FastMail'
    }
    
    if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
      return 'iCloud'
    }
    
    return 'Custom'
  }

  /**
   * Check if a provider requires app password
   */
  requiresAppPassword(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase()
    
    // Gmail typically requires app password for third-party apps
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return true
    }
    
    // Yahoo requires app password
    if (['yahoo.com', 'yahoo.co.uk', 'yahoo.fr'].includes(domain)) {
      return true
    }
    
    // iCloud requires app password
    if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
      return true
    }
    
    return false
  }

  /**
   * Get app password setup instructions for a provider
   */
  getAppPasswordInstructions(email: string): string[] {
    const domain = email.split('@')[1]?.toLowerCase()
    
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return [
        'Go to your Google Account settings',
        'Select Security from the left panel',
        'Enable 2-Step Verification if not already enabled',
        'Click on "App passwords"',
        'Generate an app password for "Mail"',
        'Use the generated password instead of your regular password'
      ]
    }
    
    if (['yahoo.com', 'yahoo.co.uk', 'yahoo.fr'].includes(domain)) {
      return [
        'Go to Yahoo Account Security settings',
        'Turn on 2-step verification',
        'Click "Generate app password"',
        'Select "Other app" and name it',
        'Use the generated password for email setup'
      ]
    }
    
    if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
      return [
        'Go to Apple ID account page',
        'Sign in with your Apple ID',
        'Go to Security section',
        'Generate an app-specific password',
        'Use this password for email setup'
      ]
    }
    
    return [
      'Check your email provider\'s documentation',
      'Look for "App Password" or "Application Password" settings',
      'Generate a password specifically for email clients'
    ]
  }

  /**
   * Format email address for display
   */
  formatEmailAddress(address: string, name?: string): string {
    if (name && name.trim()) {
      return `${name} <${address}>`
    }
    return address
  }

  /**
   * Parse email address from formatted string
   */
  parseEmailAddress(formatted: string): { email: string; name?: string } {
    const match = formatted.match(/(.*?)\s*<(.+?)>/)
    if (match) {
      return {
        name: match[1].trim(),
        email: match[2].trim()
      }
    }
    return { email: formatted.trim() }
  }

  /**
   * Validate email address format
   */
  validateEmailAddress(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Get security recommendations for email setup
   */
  getSecurityRecommendations(email: string): string[] {
    const recommendations = [
      'Use app passwords instead of your main password',
      'Enable two-factor authentication on your email account',
      'Regularly review connected applications'
    ]

    const provider = this.detectProvider(email)
    
    if (provider === 'Gmail') {
      recommendations.push('Consider using OAuth2 for enhanced security')
      recommendations.push('Monitor Google Account security activity')
    }
    
    if (provider === 'Outlook') {
      recommendations.push('Use Microsoft Authenticator for 2FA')
      recommendations.push('Review Microsoft account security dashboard')
    }
    
    return recommendations
  }
}

// Singleton instance for use throughout the renderer process
export const productionEmailAPI = new ProductionEmailAPI()