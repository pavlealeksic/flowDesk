# Gmail OAuth2 IMAP Integration - Complete Implementation

This document describes the complete Gmail IMAP OAuth2 integration implementation that enables production-ready email functionality with real Gmail IMAP connections using OAuth2 authentication.

## 🚀 What's Implemented

### 1. Complete OAuth2 XOAUTH2 SASL Mechanism (`/src/main/imap-client.ts`)

✅ **Enhanced IMAP Client with OAuth2 Support**
- XOAUTH2 SASL authentication for Gmail IMAP
- Automatic OAuth2 token refresh on authentication failures
- Built-in retry logic with exponential backoff
- Connection pooling support
- Proper error handling for OAuth2-specific issues

**Key Features:**
```typescript
interface ImapConfig {
  oauth2?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    provider?: string;
  };
  authMethod?: 'XOAUTH2' | 'PLAIN' | 'LOGIN';
}
```

### 2. Production-Ready Gmail IMAP Provider (`/src/main/providers/gmail-imap-provider.ts`)

✅ **Complete Gmail IMAP Provider**
- Direct Gmail IMAP connection (imap.gmail.com:993)
- OAuth2 authentication with XOAUTH2 SASL
- Gmail-specific folder mapping (INBOX, [Gmail]/Sent Mail, etc.)
- Real-time message synchronization
- Proper Gmail label handling
- Attachment support
- Search functionality with Gmail syntax
- Rate limiting compliance with Gmail IMAP limits

**Key Features:**
- Connects directly to Gmail IMAP servers
- Uses OAuth2 tokens for authentication
- Maps Gmail labels to standard folder types
- Handles Gmail-specific IMAP quirks
- Supports IDLE for real-time notifications

### 3. OAuth2-IMAP Integration Service (`/src/main/oauth-imap-integration.ts`)

✅ **Comprehensive Integration Layer**
- Automatic OAuth2 token refresh during IMAP operations
- Connection recovery and retry logic
- Authentication error detection and handling
- Connection pooling and management
- Token expiration monitoring

**Key Features:**
- Seamless token refresh without connection interruption
- Intelligent error handling for OAuth2 failures
- Connection health monitoring
- Automatic reconnection on network issues

### 4. Gmail-Specific IMAP Features (`/src/main/gmail-imap-features.ts`)

✅ **Gmail IMAP Extensions Support**
- Gmail system folder mapping
- Gmail search query translation to IMAP
- Gmail label extraction and management
- X-GM-LABELS, X-GM-THRID, X-GM-MSGID support
- Gmail folder ordering and display names

**Key Features:**
```typescript
// Folder mappings
'INBOX' → { type: 'inbox', displayName: 'Inbox' }
'[Gmail]/Sent Mail' → { type: 'sent', displayName: 'Sent' }
'[Gmail]/Drafts' → { type: 'drafts', displayName: 'Drafts' }

// Search query translation
'from:user@example.com' → ['FROM', 'user@example.com']
'is:unread' → ['UNSEEN']
'has:attachment' → ['HEADER', 'Content-Disposition', 'attachment']
```

### 5. Enhanced Gmail Provider (`/src/main/providers/gmail-provider.ts`)

✅ **Dual-Mode Gmail Provider**
- Supports both Gmail API and IMAP modes
- Automatic delegation to IMAP provider when enabled
- Backward compatibility with existing Gmail API implementation
- Configuration-based mode selection

**Usage:**
```typescript
// Enable IMAP mode via environment variable
process.env.GMAIL_USE_IMAP = 'true'

// Or via account settings
account.settings.useImap = true
```

### 6. Comprehensive Test Suite (`/src/test/gmail-oauth-imap-integration-test.ts`)

✅ **Complete Integration Tests**
- OAuth2 token management tests
- IMAP authentication flow tests
- Gmail provider functionality tests
- Error handling and recovery tests
- Performance and rate limiting tests

## 🔧 How It Works

### OAuth2 to IMAP Authentication Flow

1. **OAuth2 Token Acquisition**
   ```typescript
   // User completes OAuth2 flow via browser
   const token = await oAuth2IntegrationManager.authenticateProvider('gmail')
   
   // Token is stored securely
   await oAuth2TokenManager.storeToken(token)
   ```

2. **IMAP Connection with OAuth2**
   ```typescript
   // Create IMAP config with OAuth2
   const imapConfig = {
     user: 'user@gmail.com',
     host: 'imap.gmail.com',
     port: 993,
     tls: true,
     authMethod: 'XOAUTH2',
     oauth2: {
       accessToken: token.accessToken,
       refreshToken: token.refreshToken,
       expiresAt: token.expiresAt,
       provider: 'gmail'
     }
   }
   
   // Connect to Gmail IMAP with OAuth2
   const imapClient = new ImapClient(imapConfig)
   await imapClient.connect()
   ```

3. **Automatic Token Refresh**
   ```typescript
   // Token refresh happens automatically on auth failures
   imapClient.on('error', async (error) => {
     if (isAuthenticationError(error)) {
       const refreshed = await refreshOAuth2Token()
       if (refreshed) {
         // Retry connection with new token
         await imapClient.connect()
       }
     }
   })
   ```

### Gmail IMAP Operations

```typescript
// Initialize Gmail IMAP provider
const gmailProvider = new GmailImapProvider(account)
await gmailProvider.initialize()

// Get folders (Gmail labels mapped to folders)
const folders = await gmailProvider.getFolders()
// Returns: [{ name: 'INBOX', type: 'inbox' }, { name: '[Gmail]/Sent Mail', type: 'sent' }, ...]

// Get messages from INBOX
const messages = await gmailProvider.getMessages('INBOX', { limit: 50 })

// Search messages with Gmail syntax
const searchResults = await gmailProvider.searchMessages('from:important@company.com is:unread')

// Sync account
const syncStatus = await gmailProvider.syncAccount({ fullSync: true })
```

## 📋 Required Configuration

### Environment Variables
```bash
# Gmail OAuth2 credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Enable IMAP mode for Gmail
GMAIL_USE_IMAP=true

# OAuth2 encryption key
OAUTH_ENCRYPTION_KEY=your_secure_encryption_key
```

### Gmail OAuth2 Scopes
The integration requires these OAuth2 scopes:
- `https://mail.google.com/` - Full Gmail access (includes IMAP)
- `https://www.googleapis.com/auth/gmail.modify` - Read/write Gmail access
- `https://www.googleapis.com/auth/userinfo.email` - User email address

### Google Cloud Console Setup
1. Enable Gmail API
2. Configure OAuth2 consent screen
3. Add authorized redirect URIs: `http://localhost:8080/oauth/callback`
4. Generate OAuth2 client credentials

## 🚀 Usage Examples

### Basic Gmail IMAP Setup

```typescript
import { GmailImapProvider } from './providers/gmail-imap-provider'
import { oAuth2TokenManager } from './oauth-token-manager'

// 1. Set up OAuth2 token (after user authentication)
const token = {
  accountId: 'user-account-id',
  providerId: 'gmail',
  accessToken: 'ya29.a0...',
  refreshToken: '1//04...',
  expiresAt: new Date(Date.now() + 3600 * 1000),
  userInfo: { email: 'user@gmail.com' }
}

await oAuth2TokenManager.storeToken(token)

// 2. Create Gmail IMAP provider
const account = {
  id: 'user-account-id',
  email: 'user@gmail.com',
  provider: 'gmail',
  // ... other account properties
}

const gmailProvider = new GmailImapProvider(account)

// 3. Initialize and use
await gmailProvider.initialize()

// Get folders
const folders = await gmailProvider.getFolders()
console.log('Gmail folders:', folders.map(f => f.displayName))

// Get recent messages from INBOX
const messages = await gmailProvider.getMessages('INBOX', { limit: 10 })
console.log(`Retrieved ${messages.length} messages`)

// Search for unread emails
const unreadMessages = await gmailProvider.searchMessages('is:unread')
console.log(`Found ${unreadMessages.length} unread messages`)
```

### Advanced Usage with Error Handling

```typescript
import { oAuth2ImapIntegration } from './oauth-imap-integration'

// Create IMAP connection with comprehensive error handling
const config = {
  accountId: 'user-account-id',
  providerId: 'gmail',
  email: 'user@gmail.com',
  imapHost: 'imap.gmail.com',
  imapPort: 993,
  imapTls: true
}

try {
  const result = await oAuth2ImapIntegration.createImapConnection(config)
  
  if (result.success) {
    const imapClient = result.client
    
    // Use IMAP client for operations
    await imapClient.selectFolder('INBOX')
    const messages = await imapClient.getMessages(50)
    
  } else {
    console.error('Failed to create IMAP connection:', result.error)
  }
} catch (error) {
  console.error('IMAP connection error:', error)
}

// Handle token refresh events
oAuth2ImapIntegration.on('reconnected', (accountId, providerId) => {
  console.log(`IMAP reconnected after token refresh: ${accountId}`)
})

oAuth2ImapIntegration.on('authenticationFailed', (accountId, providerId, error) => {
  console.error(`IMAP authentication failed: ${accountId}`, error)
  // Handle re-authentication flow
})
```

## 🔍 Testing

Run the comprehensive test suite:

```bash
# Run all Gmail IMAP integration tests
npm test src/test/gmail-oauth-imap-integration-test.ts

# Run with environment variables for integration testing
TEST_GMAIL_CLIENT_ID=your_test_client_id \
TEST_GMAIL_CLIENT_SECRET=your_test_client_secret \
TEST_GMAIL_EMAIL=test@gmail.com \
npm test src/test/gmail-oauth-imap-integration-test.ts
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Gmail IMAP OAuth2 Integration            │
├─────────────────────────────────────────────────────────────┤
│  1. User Authentication (OAuth2 Flow)                      │
│     └── oAuth2IntegrationManager                           │
│                                                             │
│  2. Token Management                                        │
│     └── oAuth2TokenManager (auto-refresh, validation)      │
│                                                             │
│  3. IMAP Connection with OAuth2                             │
│     └── ImapClient (XOAUTH2 SASL, token refresh)           │
│                                                             │
│  4. Gmail IMAP Provider                                     │
│     └── GmailImapProvider (folder mapping, search)         │
│                                                             │
│  5. Integration Layer                                       │
│     └── oAuth2ImapIntegration (error handling, retry)      │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Security Features

- **Encrypted Token Storage**: OAuth2 tokens are encrypted at rest
- **Automatic Token Refresh**: Prevents token expiration issues
- **Secure SASL Authentication**: Uses XOAUTH2 for IMAP authentication
- **Connection Security**: All connections use TLS encryption
- **Error Isolation**: Authentication errors don't expose credentials

## 📊 Performance Features

- **Connection Pooling**: Efficient IMAP connection management
- **Rate Limiting**: Respects Gmail IMAP rate limits
- **Batch Operations**: Efficient message fetching
- **Intelligent Retry**: Exponential backoff for failed operations
- **Memory Management**: Proper cleanup and resource management

## 🎯 Production Readiness Checklist

✅ **OAuth2 Flow Complete**: Full browser-based OAuth2 authentication
✅ **IMAP Authentication**: XOAUTH2 SASL mechanism implemented
✅ **Token Management**: Automatic refresh and validation
✅ **Error Handling**: Comprehensive error detection and recovery
✅ **Connection Management**: Pooling, retry logic, cleanup
✅ **Gmail Features**: Folder mapping, search, label support
✅ **Security**: Encrypted storage, secure connections
✅ **Testing**: Comprehensive test suite
✅ **Documentation**: Complete implementation guide
✅ **Monitoring**: Logging and error tracking

## 🔄 Migration from Gmail API

To migrate from Gmail API to Gmail IMAP:

1. **Enable IMAP Mode**:
   ```typescript
   account.settings.useImap = true
   // OR
   process.env.GMAIL_USE_IMAP = 'true'
   ```

2. **Existing Code Compatibility**:
   ```typescript
   // Existing Gmail provider code works unchanged
   const gmailProvider = new GmailProvider(account, oauth2Manager)
   await gmailProvider.initialize() // Now uses IMAP if enabled
   
   // Same API surface
   const folders = await gmailProvider.getFolders()
   const messages = await gmailProvider.getMessages('INBOX')
   ```

3. **Performance Benefits**:
   - Direct IMAP connection (no API rate limits)
   - Real-time IDLE notifications
   - Better offline support
   - Reduced API quota usage

## 🏁 Conclusion

This implementation provides a complete, production-ready Gmail IMAP integration with OAuth2 authentication. It includes:

- ✅ Full OAuth2 XOAUTH2 SASL authentication
- ✅ Automatic token refresh and error recovery
- ✅ Gmail-specific IMAP features and folder mapping
- ✅ Comprehensive error handling and retry logic
- ✅ Production-grade connection management
- ✅ Complete test coverage
- ✅ Backward compatibility with existing Gmail API code

The system is ready for production deployment and provides a robust foundation for Gmail email functionality in the Flow Desk application.