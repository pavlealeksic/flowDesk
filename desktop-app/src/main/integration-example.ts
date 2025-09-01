/**
 * Email Service Integration Example
 * 
 * Complete example showing how to integrate the new multi-provider email system
 * with the existing Flow Desk application
 */

import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { initializeEnhancedMailService, setupEnhancedMailIPC } from './enhanced-mail-service'
import { EMAIL_PROVIDERS, detectProvider } from './providers/provider-config'

/**
 * Initialize the enhanced email service in your main process
 */
export async function initializeEmailSystem(mainWindow: BrowserWindow): Promise<void> {
  try {
    // Generate or retrieve encryption key for credentials
    const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'your-secure-encryption-key'
    
    log.info('Initializing enhanced email system...')
    
    // Initialize the enhanced mail service
    initializeEnhancedMailService(encryptionKey, mainWindow)
    
    log.info('Enhanced email system initialized successfully')
  } catch (error) {
    log.error('Failed to initialize email system:', error)
    throw error
  }
}

/**
 * Example: Add a Gmail account using OAuth2
 */
export async function addGmailAccount(): Promise<void> {
  try {
    // This would be called from IPC handler when user clicks "Add Gmail Account"
    const account = await new Promise((resolve, reject) => {
      // The enhanced mail service will handle the OAuth flow
      mainWindow.webContents.send('mail:start-oauth', { provider: 'gmail' })
      
      // Listen for OAuth completion
      const handleOAuthComplete = (event: any, result: any) => {
        if (result.success) {
          resolve(result.account)
        } else {
          reject(new Error(result.error))
        }
        // Remove listener
        mainWindow.webContents.removeListener('mail:oauth-complete', handleOAuthComplete)
      }
      
      mainWindow.webContents.on('mail:oauth-complete', handleOAuthComplete)
    })
    
    log.info('Gmail account added successfully:', account)
  } catch (error) {
    log.error('Failed to add Gmail account:', error)
    throw error
  }
}

/**
 * Example: Add an IMAP account (Yahoo, Fastmail, etc.)
 */
export async function addImapAccount(email: string, password: string): Promise<void> {
  try {
    // Auto-detect provider based on email address
    const provider = detectProvider(email)
    
    if (!provider) {
      throw new Error('Unable to detect email provider for: ' + email)
    }
    
    // Create account input
    const accountInput = {
      userId: 'current-user-id', // Get from your app state
      name: email.split('@')[0], // Use email prefix as default name
      email: email,
      provider: provider.id,
      config: provider.config,
      credentials: {
        password: password // Will be encrypted by the service
      },
      syncIntervalMinutes: 15,
      isEnabled: true
    }
    
    // Add account through IPC
    const account = await mainWindow.webContents.invoke('mail:add-account', accountInput)
    
    log.info(`${provider.name} account added successfully:`, account)
  } catch (error) {
    log.error('Failed to add IMAP account:', error)
    throw error
  }
}

/**
 * Example: Send an email with attachments
 */
export async function sendEmailWithAttachment(
  accountId: string,
  to: string[],
  subject: string,
  body: string,
  attachmentPath: string
): Promise<void> {
  try {
    // Read attachment file
    const fs = require('fs')
    const path = require('path')
    const attachmentBuffer = fs.readFileSync(attachmentPath)
    
    const message = {
      to,
      subject,
      body,
      attachments: [{
        filename: path.basename(attachmentPath),
        content: attachmentBuffer,
        contentType: 'application/octet-stream' // Auto-detected by SMTP client
      }]
    }
    
    // Send through IPC
    const messageId = await mainWindow.webContents.invoke('mail:send-message', accountId, message)
    
    log.info('Email sent successfully:', messageId)
  } catch (error) {
    log.error('Failed to send email:', error)
    throw error
  }
}

/**
 * Example: Search across all accounts
 */
export async function searchEmails(query: string): Promise<any[]> {
  try {
    // Search across all accounts
    const results = await mainWindow.webContents.invoke('mail:search-messages', query, {
      limit: 50
    })
    
    log.info(`Found ${results.length} messages for query: ${query}`)
    return results
  } catch (error) {
    log.error('Search failed:', error)
    throw error
  }
}

/**
 * Example: Get unified inbox messages
 */
export async function getUnifiedInbox(): Promise<any[]> {
  try {
    const messages = await mainWindow.webContents.invoke('mail:get-unified-messages', 100)
    
    log.info(`Retrieved ${messages.length} messages from unified inbox`)
    return messages
  } catch (error) {
    log.error('Failed to get unified inbox:', error)
    throw error
  }
}

/**
 * Example: Setup real-time notifications
 */
export function setupEmailNotifications(mainWindow: BrowserWindow): void {
  // Listen for new mail events from the email service
  mainWindow.webContents.on('mail:new-messages', (event, data) => {
    const { accountId, count } = data
    
    // Show system notification
    const { Notification } = require('electron')
    
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'New Email',
        body: `You have ${count} new message${count > 1 ? 's' : ''}`,
        icon: path.join(__dirname, '../assets/mail-icon.png') // Add your icon
      })
      
      notification.on('click', () => {
        // Focus the window and navigate to the account
        mainWindow.focus()
        mainWindow.webContents.send('navigate-to-account', accountId)
      })
      
      notification.show()
    }
    
    // Update app badge (macOS)
    if (process.platform === 'darwin') {
      app.setBadgeCount(count)
    }
  })
  
  // Listen for sync errors
  mainWindow.webContents.on('mail:sync-error', (event, data) => {
    const { accountId, error } = data
    
    log.error(`Sync error for account ${accountId}: ${error}`)
    
    // Show error notification to user
    mainWindow.webContents.send('mail:show-error', {
      title: 'Email Sync Error',
      message: error,
      accountId
    })
  })
}

/**
 * Example: Get account status and sync information
 */
export async function getAccountStatus(): Promise<void> {
  try {
    // Get all accounts
    const accounts = await mainWindow.webContents.invoke('mail:list-accounts')
    
    // Get sync status for all accounts
    const syncStatus = await mainWindow.webContents.invoke('mail:get-sync-status')
    
    for (const account of accounts) {
      const status = syncStatus[account.id]
      
      log.info(`Account: ${account.email}`)
      log.info(`  Provider: ${account.provider}`)
      log.info(`  Status: ${account.status}`)
      log.info(`  Last Sync: ${status?.lastSyncAt || 'Never'}`)
      log.info(`  Messages: ${status?.stats?.totalMessages || 0}`)
      log.info(`  Unread: ${status?.stats?.newMessages || 0}`)
    }
  } catch (error) {
    log.error('Failed to get account status:', error)
  }
}

/**
 * Example: Handle different provider capabilities
 */
export function demonstrateProviderCapabilities(): void {
  for (const [providerId, provider] of Object.entries(EMAIL_PROVIDERS)) {
    log.info(`Provider: ${provider.name}`)
    log.info(`  OAuth Support: ${provider.capabilities.supportsOAuth}`)
    log.info(`  IDLE Support: ${provider.capabilities.supportsIdle}`)
    log.info(`  Push Support: ${provider.capabilities.supportsPush}`)
    log.info(`  Search Support: ${provider.capabilities.supportsSearch}`)
    log.info(`  Labels Support: ${provider.capabilities.supportsLabels}`)
    log.info(`  Threads Support: ${provider.capabilities.supportsThreads}`)
    log.info(`  Max Attachment: ${provider.capabilities.maxAttachmentSize / 1024 / 1024}MB`)
    
    if (provider.capabilities.rateLimit) {
      log.info(`  Rate Limit: ${provider.capabilities.rateLimit.requests} requests per ${provider.capabilities.rateLimit.window}s`)
    }
    
    log.info('---')
  }
}

/**
 * Example: Bulk operations
 */
export async function markMultipleMessagesRead(
  accountId: string, 
  messageIds: string[]
): Promise<void> {
  try {
    const bulkOperation = {
      type: 'mark_read' as const,
      messageIds: messageIds,
      params: {}
    }
    
    const result = await mainWindow.webContents.invoke('mail:bulk-operation', accountId, bulkOperation)
    
    log.info(`Bulk operation completed: ${result.successful} successful, ${result.failed} failed`)
    
    if (result.errors.length > 0) {
      log.warn('Bulk operation errors:', result.errors)
    }
  } catch (error) {
    log.error('Bulk operation failed:', error)
    throw error
  }
}

/**
 * Example: Test account connection before adding
 */
export async function testAccountConnection(
  email: string,
  password: string
): Promise<boolean> {
  try {
    const provider = detectProvider(email)
    
    if (!provider) {
      throw new Error('Unknown email provider')
    }
    
    const testConfig = {
      email,
      password,
      provider: provider.id,
      imapHost: provider.config.imap.host,
      imapPort: provider.config.imap.port,
      smtpHost: provider.config.smtp.host,
      smtpPort: provider.config.smtp.port
    }
    
    const isConnected = await mainWindow.webContents.invoke('mail:test-connection', testConfig)
    
    log.info(`Connection test for ${email}: ${isConnected ? 'SUCCESS' : 'FAILED'}`)
    return isConnected
  } catch (error) {
    log.error('Connection test failed:', error)
    return false
  }
}

/**
 * Example: Environment variable configuration
 */
export function showRequiredEnvironmentVariables(): void {
  log.info('Required Environment Variables for Email Service:')
  log.info('EMAIL_ENCRYPTION_KEY=your-secure-32-character-key')
  log.info('GOOGLE_CLIENT_ID=your-google-oauth-client-id (for Gmail)')
  log.info('GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret (for Gmail)')
  log.info('MICROSOFT_CLIENT_ID=your-microsoft-oauth-client-id (for Outlook)')
  log.info('MICROSOFT_CLIENT_SECRET=your-microsoft-oauth-client-secret (for Outlook)')
  log.info('GOOGLE_CLOUD_PROJECT_ID=your-project-id (for Gmail push notifications)')
}

// Global reference for example usage
let mainWindow: BrowserWindow

/**
 * Complete integration example for your main process
 */
export function integrateEmailSystem(window: BrowserWindow): void {
  mainWindow = window
  
  // Initialize the email system
  initializeEmailSystem(window).then(() => {
    log.info('Email system ready')
    
    // Setup notifications
    setupEmailNotifications(window)
    
    // Show configuration requirements
    showRequiredEnvironmentVariables()
    
    // Demonstrate capabilities
    demonstrateProviderCapabilities()
    
    // Example: Add event handlers for UI interactions
    window.webContents.on('dom-ready', () => {
      // The UI is ready, email service is available via IPC
      log.info('UI ready, email service available via IPC calls')
    })
    
  }).catch(error => {
    log.error('Failed to initialize email system:', error)
  })
}

export default integrateEmailSystem