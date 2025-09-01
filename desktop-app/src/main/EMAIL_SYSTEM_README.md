# Flow Desk Multi-Provider Email Integration System

A comprehensive, production-ready email integration system that supports all major email providers with real IMAP/SMTP connections, OAuth2 authentication, and advanced features.

## 🌟 Features

### Multi-Provider Support
- **Gmail** - OAuth2 + Gmail API integration
- **Outlook/Office365** - OAuth2 + Exchange/IMAP support
- **Yahoo Mail** - IMAP/SMTP with app passwords
- **Fastmail** - IMAP/SMTP with native authentication
- **iCloud** - IMAP/SMTP with app-specific passwords
- **Generic IMAP/SMTP** - Custom server configurations
- **Exchange Server** - On-premises Exchange support

### Core Capabilities
- ✅ Real IMAP/SMTP connections with TLS/SSL
- ✅ OAuth2 authentication for supported providers
- ✅ Connection pooling and session management
- ✅ SQLite-based email caching with full-text search
- ✅ Real-time IDLE support for push notifications
- ✅ Attachment handling (up to 150MB depending on provider)
- ✅ Unified inbox across all accounts
- ✅ Smart mailboxes (Today, Flagged, Unread, etc.)
- ✅ Message threading and conversation view
- ✅ Offline queue for failed operations
- ✅ Comprehensive error handling and retry logic
- ✅ Rate limiting and quota management

## 📁 System Architecture

```
src/main/
├── providers/
│   ├── provider-config.ts       # Provider configurations and auto-discovery
│   ├── base-email-provider.ts   # Abstract base class for all providers
│   ├── gmail-provider.ts        # Gmail API + IMAP implementation
│   ├── imap-provider.ts         # Generic IMAP/SMTP provider
│   └── outlook-provider.ts      # (Future: Outlook Graph API)
├── imap-client.ts              # Production IMAP client with pooling
├── smtp-client.ts              # Production SMTP client with attachments
├── oauth-manager.ts            # OAuth2 flow management
├── email-cache.ts              # SQLite caching with indexing
├── email-service-manager.ts    # Main service coordinator
├── enhanced-mail-service.ts    # Integration with existing IPC
├── error-handler.ts            # Comprehensive error handling
├── integration-example.ts      # Usage examples
└── EMAIL_SYSTEM_README.md      # This documentation
```

## 🚀 Quick Start

### 1. Installation

The required packages are already installed:
- `node-imap` - IMAP client
- `nodemailer` - SMTP client  
- `better-sqlite3` - SQLite database
- `crypto-js` - Encryption utilities

### 2. Environment Variables

Create a `.env` file in your project root:

```env
# Required for credential encryption
EMAIL_ENCRYPTION_KEY=your-secure-32-character-encryption-key-here

# Gmail OAuth (optional, for Gmail support)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Microsoft OAuth (optional, for Outlook support)  
MICROSOFT_CLIENT_ID=your-microsoft-oauth-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-oauth-client-secret
```

### 3. Integration

Update your main process initialization:

```typescript
import { BrowserWindow } from 'electron'
import { initializeEnhancedMailService } from './enhanced-mail-service'

function createWindow() {
  const mainWindow = new BrowserWindow({
    // your window configuration
  })

  // Initialize the email system
  const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key'
  initializeEnhancedMailService(encryptionKey, mainWindow)

  return mainWindow
}
```

### 4. Usage in Renderer Process

The system maintains compatibility with the existing Redux store and IPC interface:

```typescript
// Add Gmail account via OAuth
const account = await window.flowDesk.mail.startGmailOAuth()

// Add IMAP account (Yahoo, Fastmail, etc.)
const imapAccount = await window.flowDesk.mail.addAccount({
  userId: 'current-user',
  name: 'My Yahoo Account',
  email: 'user@yahoo.com',
  provider: 'yahoo',
  credentials: { password: 'encrypted-password' },
  syncIntervalMinutes: 15,
  isEnabled: true
})

// Get unified inbox
const messages = await window.flowDesk.mail.getUnifiedMessages(50)

// Search across all accounts
const results = await window.flowDesk.mail.searchMessages('meeting tomorrow')

// Send email with attachments
await window.flowDesk.mail.sendMessage(accountId, {
  to: ['recipient@example.com'],
  subject: 'Test Email',
  body: '<h1>Hello World</h1>',
  attachments: [{ filename: 'doc.pdf', content: pdfBuffer }]
})
```

## 📋 Provider Configuration

### Gmail Setup

1. Create a Google Cloud project
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Set authorized redirect URIs: `http://localhost:8080/oauth/callback`
5. Add client ID/secret to environment variables

### Outlook Setup  

1. Register application in Azure AD
2. Configure delegated permissions for Mail.Read, Mail.Send
3. Set redirect URI: `http://localhost:8080/oauth/callback`
4. Add client ID/secret to environment variables

### IMAP Providers (Yahoo, Fastmail, iCloud)

Most IMAP providers work out of the box with proper credentials:

- **Yahoo**: Requires app password (not regular password)
- **Fastmail**: Uses regular password or app password
- **iCloud**: Requires app-specific password
- **Generic**: Auto-detects server settings or allows manual configuration

## 🔧 Advanced Configuration

### Custom Provider Settings

```typescript
import { EMAIL_PROVIDERS } from './providers/provider-config'

// Add custom provider
EMAIL_PROVIDERS.myProvider = {
  id: 'my-provider',
  name: 'My Email Provider',
  domains: ['myemail.com'],
  config: {
    imap: { host: 'imap.myemail.com', port: 993, secure: true },
    smtp: { host: 'smtp.myemail.com', port: 465, secure: true }
  },
  capabilities: {
    supportsOAuth: false,
    supportsIdle: true,
    maxAttachmentSize: 25 * 1024 * 1024
  }
}
```

### Sync Configuration

```typescript
const emailManager = new EmailServiceManager({
  encryptionKey: 'your-key',
  maxConcurrentSyncs: 3,        // Max accounts syncing simultaneously
  syncIntervalMinutes: 15,       // Background sync interval
  offlineQueueSize: 1000,       // Max offline operations to queue
  enablePushNotifications: true // Enable real-time notifications
})
```

### Cache Management

```typescript
import EmailCache from './email-cache'

const cache = new EmailCache('/path/to/cache.db')

// Get cache statistics
const stats = await cache.getStatistics()
console.log(`Total messages: ${stats.totalMessages}`)
console.log(`Database size: ${stats.databaseSize / 1024 / 1024}MB`)

// Optimize database
await cache.optimize()
await cache.vacuum()
```

## 🔍 Error Handling

The system includes comprehensive error handling:

```typescript
import EmailErrorHandler from './error-handler'

const errorHandler = new EmailErrorHandler()

// Process errors with automatic categorization
const emailError = errorHandler.processError(error, {
  accountId: 'account-123',
  operation: 'syncMessages',
  provider: 'gmail'
})

// Automatic retry with exponential backoff
const shouldRetry = errorHandler.shouldRetry(emailError)
if (shouldRetry) {
  const delay = errorHandler.calculateRetryDelay(emailError)
  // Retry after delay...
}
```

Error categories:
- **Temporary**: Network issues, server errors (auto-retry)
- **Permanent**: Authentication failures, quota exceeded (user action required)
- **Configuration**: Setup issues, invalid settings
- **Critical**: System errors, unknown failures

## 📊 Performance Features

### Connection Pooling

- IMAP: Up to 10 concurrent connections per account
- SMTP: Up to 5 concurrent connections per account
- Automatic connection recovery and retry logic
- Keep-alive mechanisms to maintain connections

### Caching Strategy

- **SQLite**: Fast, embedded database for email storage
- **Full-text search**: Built-in FTS5 for message content search
- **Indexing**: Optimized indexes for common queries
- **Incremental sync**: Only fetch new/changed messages

### Rate Limiting

- Provider-specific rate limits (Gmail: 250/min, Outlook: 100/min)
- Automatic backoff when limits are exceeded
- Request queuing to prevent API violations

## 🔐 Security Features

- **Credential encryption**: AES encryption for all stored credentials
- **OAuth2 PKCE**: Secure OAuth flow with code challenges
- **TLS/SSL**: All connections use encryption
- **Token refresh**: Automatic OAuth token renewal
- **Secure storage**: Credentials stored encrypted in SQLite

## 📱 Real-time Features

### Push Notifications

- **Gmail**: Uses Gmail push notifications (webhook)
- **IMAP**: Uses IDLE command for real-time updates
- **Outlook**: Uses Microsoft Graph webhooks (when implemented)

### Live Sync

```typescript
// Enable IDLE for real-time updates
await emailService.startIdle(accountId)

// Listen for new mail events
emailService.on('newMail', (accountId, count) => {
  showNotification(`${count} new messages`)
})
```

## 🧪 Testing

### Connection Testing

```typescript
// Test account before adding
const canConnect = await emailService.testAccountConnection({
  email: 'test@example.com',
  password: 'password',
  provider: 'yahoo'
})
```

### Provider Capabilities

```typescript
import { EMAIL_PROVIDERS } from './providers/provider-config'

// Check what a provider supports
const gmail = EMAIL_PROVIDERS.gmail
console.log('Gmail supports OAuth:', gmail.capabilities.supportsOAuth)
console.log('Gmail max attachment:', gmail.capabilities.maxAttachmentSize)
```

## 🚨 Troubleshooting

### Common Issues

1. **OAuth failures**
   - Verify client ID/secret in environment variables
   - Check redirect URI configuration
   - Ensure proper scopes are requested

2. **IMAP connection failures**
   - Verify server settings (host, port, security)
   - Check if app passwords are required
   - Confirm firewall/antivirus isn't blocking

3. **Sync issues**
   - Check account status and error logs
   - Verify network connectivity
   - Look for rate limiting messages

4. **Performance issues**
   - Monitor database size and optimize regularly
   - Adjust sync intervals based on usage
   - Check connection pool usage

### Debug Logging

```typescript
// Enable debug logging
process.env.DEBUG = 'mail:*'

// Or specific components
process.env.DEBUG = 'mail:imap,mail:smtp,mail:oauth'
```

### Cache Maintenance

```typescript
// Regular maintenance (run weekly)
await cache.vacuum()        // Reclaim space
await cache.optimize()      // Update statistics

// Clear old errors (run daily)  
errorHandler.clearOldErrors(7 * 24 * 60 * 60 * 1000) // 7 days
```

## 📈 Monitoring

### Metrics to Track

- Connection success/failure rates
- Sync performance and timing
- Error rates by type and provider  
- Cache hit rates and database size
- OAuth token refresh frequency

### Health Checks

```typescript
// Check system health
const accounts = await emailService.getAccounts()
const syncStatus = await emailService.getSyncStatus()

for (const account of accounts) {
  const status = syncStatus[account.id]
  if (status?.status === 'error') {
    console.warn(`Account ${account.email} has sync errors`)
  }
}
```

## 🔮 Future Enhancements

Planned features:
- [ ] Exchange Web Services (EWS) provider
- [ ] Outlook Graph API provider  
- [ ] Email rules and filters
- [ ] Message encryption (S/MIME, PGP)
- [ ] Calendar integration
- [ ] Contact synchronization
- [ ] Advanced search with filters
- [ ] Message templates
- [ ] Email scheduling
- [ ] Read receipts
- [ ] Message tracking

## 📄 License

This email integration system is part of Flow Desk and follows the same licensing terms.

## 🤝 Contributing

When contributing to the email system:

1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Include proper logging
4. Write tests for new providers
5. Update documentation
6. Consider security implications
7. Test with real email providers

## 📚 API Reference

### EmailServiceManager

Main service class that coordinates all email operations.

#### Methods

- `initialize(): Promise<void>` - Initialize the service
- `addAccount(account): Promise<MailAccount>` - Add new email account
- `getAccounts(): MailAccount[]` - Get all accounts
- `syncAccount(accountId): Promise<MailSyncStatus>` - Sync specific account
- `getMessages(accountId, folderId?, options?): Promise<EmailMessage[]>` - Get messages
- `sendMessage(accountId, options): Promise<string>` - Send email
- `searchMessages(query, options?): Promise<EmailMessage[]>` - Search messages
- `startOAuthFlow(provider): Promise<MailAccount>` - Start OAuth authentication

### Provider Classes

All providers extend `BaseEmailProvider` and implement:

- `initialize(): Promise<void>` - Setup provider connection
- `getFolders(): Promise<MailFolder[]>` - Get folder list
- `getMessages(folderId?, options?): Promise<EmailMessage[]>` - Fetch messages
- `sendMessage(options): Promise<string>` - Send email
- `syncAccount(options?): Promise<MailSyncStatus>` - Perform sync
- `searchMessages(query, options?): Promise<EmailMessage[]>` - Search messages

### IPC Interface

The enhanced mail service maintains compatibility with existing IPC calls:

- `mail:list-accounts` - Get all accounts
- `mail:add-account` - Add new account
- `mail:sync-account` - Sync account
- `mail:get-messages` - Get messages
- `mail:send-message` - Send email
- `mail:search-messages` - Search messages
- `mail:start-gmail-oauth` - Gmail OAuth flow
- `mail:get-unified-messages` - Unified inbox

---

For more detailed examples and advanced usage, see `integration-example.ts`.