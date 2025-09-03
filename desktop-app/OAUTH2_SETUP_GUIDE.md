# OAuth2 Setup Guide for Flow Desk Desktop App

## Overview

Flow Desk now includes complete OAuth2 integration with real providers including Gmail, Outlook, Google Calendar, and more. This guide will help you set up OAuth2 authentication so users can connect their actual email and calendar accounts.

## Architecture

The OAuth2 system consists of several components:

1. **OAuth2 Integration Manager** - Orchestrates the complete OAuth flow
2. **OAuth2 Token Manager** - Handles automatic token refresh and validation
3. **OAuth2 Provider Config** - Centralized provider configuration
4. **OAuth2 Callback Server** - Local server for handling OAuth callbacks
5. **Rust OAuth Bridge** - Integrates with Rust engine for secure storage
6. **React UI Components** - User interface for authentication flows

## Quick Setup

### 1. Environment Configuration

Create a `.env` file in your project root with the following OAuth2 credentials:

```env
# Gmail OAuth2 (Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Outlook OAuth2 (Azure App Registration)
MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here

# Optional: Yahoo Mail OAuth2
YAHOO_CLIENT_ID=your_yahoo_client_id_here
YAHOO_CLIENT_SECRET=your_yahoo_client_secret_here

# OAuth2 Security
OAUTH_ENCRYPTION_KEY=your_secure_encryption_key_change_in_production
```

### 2. Provider Setup Instructions

#### Gmail Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API and Google Calendar API
4. Go to **Credentials > Create Credentials > OAuth 2.0 Client IDs**
5. Choose **Desktop Application** as the application type
6. Add authorized redirect URI: `http://localhost:8080/oauth/callback`
7. Copy the Client ID and Client Secret to your `.env` file
8. Ensure your Google account has 2-factor authentication enabled

#### Outlook Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Name your application (e.g., "Flow Desk Desktop")
5. Choose **Accounts in any organizational directory and personal Microsoft accounts**
6. Set redirect URI: `http://localhost:8080/oauth/callback` (Public client/native)
7. After creation, go to **API permissions**
8. Add Microsoft Graph permissions:
   - Mail.Read
   - Mail.Send
   - IMAP.AccessAsUser.All
   - SMTP.Send
   - User.Read
   - Calendars.ReadWrite (for calendar access)
9. Add Office 365 Exchange Online permissions:
   - IMAP.AccessAsUser.All
   - SMTP.Send
10. Grant admin consent for the permissions
11. Go to **Certificates & secrets** and create a new client secret
12. Copy the Application (client) ID and client secret value to your `.env` file

### 3. Testing the Setup

The system includes built-in testing tools. Run the OAuth2 diagnostic:

```typescript
import { oAuth2TestSetup } from './src/main/oauth-test-setup';

// Run full diagnostic
const diagnostic = await oAuth2TestSetup.runFullDiagnostic();
console.log('OAuth2 Health:', diagnostic.overallHealth);

// Generate setup report
const report = await oAuth2TestSetup.generateSetupReport();
console.log(report);
```

## User Authentication Flow

### 1. Starting OAuth Flow

When a user wants to connect an account:

```typescript
// From React component
const result = await window.flowDesk.mail.startOAuthFlow('gmail');

if (result.success) {
  // Account connected successfully
  console.log('Connected account:', result.email);
} else {
  // Handle error
  console.error('OAuth failed:', result.error);
}
```

### 2. What Happens Behind the Scenes

1. **Validation** - System checks if provider is configured
2. **Authorization URL** - Generates secure OAuth2 URL with PKCE
3. **User Authorization** - Opens browser for user consent
4. **Callback Handling** - Local server captures authorization code
5. **Token Exchange** - Exchanges code for access/refresh tokens
6. **Secure Storage** - Stores encrypted tokens in Rust engine
7. **Account Creation** - Creates mail account with OAuth credentials

### 3. Automatic Token Management

The system automatically:

- **Refreshes tokens** before they expire (5 minutes before expiry)
- **Validates tokens** before each API call
- **Retries refresh** up to 3 times on failure
- **Stores tokens securely** using Rust encryption
- **Revokes tokens** on account removal

## Available Providers

### Currently Supported

- **Gmail** - Full support with Google APIs
- **Outlook** - Full support with Microsoft Graph
- **Google Calendar** - Full calendar integration
- **Microsoft Calendar** - Full calendar integration

### Partially Supported

- **Yahoo Mail** - Basic IMAP/SMTP (OAuth optional)

### Adding New Providers

To add a new OAuth2 provider:

1. **Update Provider Config**:
```typescript
// In oauth-provider-config.ts
this.providers.set('new-provider', {
  providerId: 'new-provider',
  name: 'New Provider',
  clientId: process.env.NEW_PROVIDER_CLIENT_ID || '',
  clientSecret: process.env.NEW_PROVIDER_CLIENT_SECRET || '',
  authUrl: 'https://provider.com/oauth2/authorize',
  tokenUrl: 'https://provider.com/oauth2/token',
  userInfoUrl: 'https://provider.com/oauth2/userinfo',
  scopes: ['read', 'write'],
  redirectUri: 'http://localhost:8080/oauth/callback',
  supportsRefreshToken: true,
  requiresClientSecret: true
});
```

2. **Add Environment Variables**:
```env
NEW_PROVIDER_CLIENT_ID=your_client_id
NEW_PROVIDER_CLIENT_SECRET=your_client_secret
```

3. **Update React UI** to include the new provider in the AddAccountModal.

## Security Features

### Token Security

- **Encryption**: All tokens stored using AES-256-GCM encryption
- **Secure Storage**: Tokens stored in Rust engine with system-derived keys
- **Memory Protection**: Sensitive data zeroed after use
- **Key Derivation**: Machine-specific key derivation for token encryption

### OAuth2 Security

- **PKCE**: Proof Key for Code Exchange for all flows
- **State Parameter**: CSRF protection with cryptographically secure state
- **Secure Redirect**: Localhost-only redirect URIs
- **Token Validation**: Regular token validation and automatic refresh
- **Scope Limitation**: Minimal required scopes for each provider

### Network Security

- **HTTPS Only**: All OAuth2 endpoints use HTTPS
- **Local Callback**: OAuth callbacks handled by local server only
- **Timeout Protection**: OAuth flows timeout after 10 minutes
- **Error Handling**: Comprehensive error handling and logging

## Troubleshooting

### Common Issues

#### 1. "Provider not configured"
**Solution**: Check your `.env` file has the correct OAuth2 credentials

#### 2. "OAuth client ID not configured"
**Solution**: Ensure environment variables are set and restart the application

#### 3. "Token refresh failed"
**Solution**: Check if OAuth2 app is still active in provider console

#### 4. "Invalid redirect URI"
**Solution**: Ensure `http://localhost:8080/oauth/callback` is added to your OAuth2 app

### Diagnostic Tools

Run the diagnostic tool to check system health:

```typescript
import { oAuth2TestSetup } from './src/main/oauth-test-setup';

// Check specific provider
const providerStatus = await oAuth2TestSetup.testProvider('gmail');

// Full system test
const systemStatus = await oAuth2TestSetup.runSystemTest();

// Generate detailed report
const report = await oAuth2TestSetup.generateSetupReport();
```

### Debug Logging

Enable detailed OAuth2 logging:

```typescript
// Set log level
import log from 'electron-log';
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// OAuth2 operations will now log detailed information
```

## Production Deployment

### Environment Variables

For production, ensure all OAuth2 credentials are properly set:

```env
NODE_ENV=production

# Production OAuth2 credentials
GOOGLE_CLIENT_ID=prod_google_client_id
GOOGLE_CLIENT_SECRET=prod_google_client_secret
MICROSOFT_CLIENT_ID=prod_microsoft_client_id
MICROSOFT_CLIENT_SECRET=prod_microsoft_client_secret

# Strong encryption key for production
OAUTH_ENCRYPTION_KEY=very_secure_encryption_key_32_chars_min
```

### Security Checklist

- [ ] OAuth2 apps configured with production domains
- [ ] Client secrets rotated regularly (every 90 days recommended)
- [ ] Minimal scopes requested for each provider
- [ ] Token encryption keys are unique per deployment
- [ ] OAuth2 apps have proper branding and privacy policy
- [ ] Rate limiting configured for OAuth2 endpoints
- [ ] Monitoring set up for OAuth2 failures

### Performance Optimization

- **Token Caching**: Tokens cached in memory for performance
- **Batch Operations**: Multiple account operations batched
- **Background Refresh**: Tokens refreshed in background threads
- **Connection Pooling**: HTTP connections reused for token operations

## API Reference

### OAuth2 IPC Methods

```typescript
// Start OAuth flow
const result = await ipcRenderer.invoke('oauth:start-flow', 'gmail');

// Get provider status
const status = await ipcRenderer.invoke('oauth:get-provider-status', 'gmail');

// Refresh token
const refreshResult = await ipcRenderer.invoke('oauth:refresh-token', accountId, 'gmail');

// Get token status
const tokenStatus = await ipcRenderer.invoke('oauth:get-token-status', accountId, 'gmail');
```

### React Components

```typescript
// Use in React components
const handleConnectGmail = async () => {
  const result = await window.flowDesk.mail.startOAuthFlow('gmail');
  if (result.success) {
    // Handle successful connection
  }
};
```

## Support and Maintenance

### Regular Tasks

1. **Monitor OAuth2 health** using diagnostic tools
2. **Rotate client secrets** every 90 days
3. **Update provider configurations** as APIs change
4. **Review token usage** and clean up unused tokens
5. **Monitor error rates** and success rates

### Debugging

- Check application logs for OAuth2 errors
- Use diagnostic tools for system health checks
- Verify provider configurations in their respective consoles
- Test OAuth2 flows in isolation

For additional support, check the diagnostic output and system logs for detailed error information.