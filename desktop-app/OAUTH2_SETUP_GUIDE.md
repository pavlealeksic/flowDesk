# OAuth2 Setup Guide for Flow Desk Desktop App - Email/Calendar API Access

## Overview

Flow Desk uses a **dual authentication architecture**:
- **User Authentication**: Handled by [Clerk](https://clerk.com) (external service)
- **Email/Calendar API Access**: OAuth2 for accessing Gmail, Outlook, and calendar data

This guide focuses on setting up OAuth2 for **email/calendar API access only**. User authentication (login, signup, sessions) is managed entirely by Clerk.

## Architecture Clarification

### What Clerk Handles (User Management)
- User registration and login
- Session management
- Multi-factor authentication (MFA)
- User profiles and metadata
- Password resets
- SSO (Single Sign-On)
- User security and compliance

### What OAuth2 Handles (API Access)
- Requesting permission to access user's email accounts (Gmail, Outlook, etc.)
- Requesting permission to access user's calendar accounts
- Obtaining API access tokens for email/calendar providers
- Refreshing expired API tokens
- Storing encrypted API tokens locally

### Data Flow
```
1. User logs in via Clerk → Gets user identity
2. User connects email account → OAuth2 flow for API access
3. API tokens stored locally → Encrypted and linked to Clerk user ID
4. App accesses email/calendar → Uses stored API tokens
```

## Quick Setup

### 1. Clerk Configuration (User Authentication)

First, set up Clerk for user authentication:

```env
# In your .env file
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
```

Get these from [Clerk Dashboard](https://dashboard.clerk.com)

### 2. Email/Calendar API Configuration

Then configure OAuth2 for API access:

```env
# Email/Calendar API Access Tokens
TOKEN_ENCRYPTION_KEY=your_secure_32_char_key_here

# Gmail/Google Calendar API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Outlook/Microsoft Calendar API
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
```

## Provider Setup Instructions

### Gmail/Google Calendar Setup

These credentials allow the app to access Gmail and Google Calendar on behalf of users:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Gmail API (for email access)
   - Google Calendar API (for calendar access)
4. Create OAuth 2.0 credentials:
   - Go to **Credentials > Create Credentials > OAuth 2.0 Client ID**
   - Choose **Desktop Application** as type
   - Name: "Flow Desk Desktop"
5. Add redirect URIs:
   - `http://localhost:8080/oauth/callback`
   - `http://127.0.0.1:8080/oauth/callback`
6. Copy Client ID and Secret to `.env`

**Required Scopes**:
- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.send` - Send emails
- `https://www.googleapis.com/auth/calendar` - Calendar access

### Outlook/Microsoft Calendar Setup

These credentials allow the app to access Outlook Mail and Microsoft Calendar:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**:
   - Name: "Flow Desk Desktop"
   - Supported accounts: "Personal Microsoft accounts and organizational accounts"
   - Redirect URI: `http://localhost:8080/oauth/callback` (Web platform)
4. After creation, go to **API permissions** and add:
   - **Microsoft Graph**:
     - `Mail.Read` - Read user mail
     - `Mail.Send` - Send mail as user
     - `Calendars.ReadWrite` - Full calendar access
     - `User.Read` - Read user profile (for email address)
   - **Office 365 Exchange Online** (for IMAP/SMTP):
     - `IMAP.AccessAsUser.All`
     - `SMTP.Send`
5. Go to **Certificates & secrets**:
   - Create new client secret
   - Copy the value (only shown once!)
6. Copy Application ID and Secret to `.env`

## User Experience Flow

### From the User's Perspective

1. **User Login** (via Clerk):
   ```
   User → Login with Clerk → Authenticated
   ```

2. **Connect Email Account** (via OAuth2):
   ```
   User → "Add Gmail Account" → Browser opens → 
   User grants permission → Tokens stored locally
   ```

3. **Access Email/Calendar**:
   ```
   App uses stored tokens → Fetches emails/events → 
   Shows in UI
   ```

### From the Developer's Perspective

```typescript
// 1. Check if user is authenticated (Clerk)
const { userId } = useAuth(); // Clerk hook
if (!userId) return <SignIn />; // Clerk component

// 2. Connect email account (OAuth2 for API access)
const connectGmail = async () => {
  // This triggers OAuth2 flow for Gmail API access
  const result = await window.flowDesk.mail.startOAuthFlow('gmail');
  
  if (result.success) {
    // API tokens are now stored, linked to Clerk user ID
    console.log('Gmail connected:', result.email);
  }
};

// 3. Use the connected account
const fetchEmails = async () => {
  // Uses stored API tokens to access Gmail
  const emails = await window.flowDesk.mail.getEmails('gmail');
};
```

## Security Model

### User Authentication Security (Clerk)
- Handled entirely by Clerk's infrastructure
- Industry-standard security practices
- SOC 2 Type II compliant
- GDPR compliant
- No passwords stored locally

### API Token Security (Local)
- Tokens encrypted with AES-256-GCM
- Machine-specific encryption keys
- Tokens linked to Clerk user ID
- Automatic token refresh
- Tokens expire after 90 days of inactivity

### Data Isolation
```
Clerk User ID → Links to → Encrypted API Tokens
             ↓
    Each user's tokens are isolated
```

## Common Scenarios

### Scenario 1: New User Signup
1. User signs up via Clerk
2. Clerk creates user account
3. User is prompted to connect email accounts
4. OAuth2 flow gets API permissions
5. Tokens stored locally, linked to Clerk user

### Scenario 2: Existing User, New Device
1. User logs in via Clerk on new device
2. No email accounts connected (tokens are local)
3. User re-authorizes email accounts
4. New tokens stored on this device

### Scenario 3: Token Refresh
1. API token expires
2. System automatically uses refresh token
3. New access token obtained
4. User experiences no interruption

## Troubleshooting

### "User not authenticated"
- **Issue**: Clerk authentication failed
- **Solution**: Check Clerk keys in `.env`
- **Not related to**: OAuth2 or email/calendar access

### "Gmail/Outlook connection failed"
- **Issue**: OAuth2 flow for API access failed
- **Solution**: Check Google/Microsoft credentials in `.env`
- **Not related to**: User authentication (Clerk)

### "Invalid API credentials"
- **Issue**: Email/calendar provider credentials incorrect
- **Solution**: Verify CLIENT_ID and CLIENT_SECRET for the provider
- **Note**: These are NOT user credentials

### "Token expired"
- **Issue**: API access token needs refresh
- **Solution**: System should auto-refresh; if not, user needs to re-authorize
- **Not related to**: User session (managed by Clerk)

## Testing the Setup

### Test User Authentication (Clerk)
```typescript
// Check if Clerk is configured
const { isLoaded, isSignedIn } = useAuth();
console.log('Clerk loaded:', isLoaded);
console.log('User signed in:', isSignedIn);
```

### Test Email API Access (OAuth2)
```typescript
// Test OAuth2 configuration
const testEmailConnection = async () => {
  try {
    const result = await window.flowDesk.mail.startOAuthFlow('gmail');
    console.log('OAuth2 test:', result);
  } catch (error) {
    console.error('OAuth2 failed:', error);
  }
};
```

## Production Deployment

### Checklist
- [ ] **Clerk Production Keys**: Update `CLERK_*` environment variables
- [ ] **Strong Encryption Key**: Generate with `openssl rand -base64 32`
- [ ] **API Credentials**: Use production OAuth2 apps (not test apps)
- [ ] **Redirect URIs**: Update for production domain
- [ ] **HTTPS**: Ensure all callbacks use HTTPS in production
- [ ] **Token Rotation**: Plan for regular credential rotation
- [ ] **Monitoring**: Set up alerts for OAuth2 failures

### Environment Variables
```env
# Production example
NODE_ENV=production

# Clerk (production keys from dashboard.clerk.com)
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx

# API Token Encryption (generate new for production)
TOKEN_ENCRYPTION_KEY=<32+ character key from openssl>

# Gmail/Google (production OAuth2 app)
GOOGLE_CLIENT_ID=<production_client_id>
GOOGLE_CLIENT_SECRET=<production_secret>

# Outlook/Microsoft (production OAuth2 app)
MICROSOFT_CLIENT_ID=<production_client_id>
MICROSOFT_CLIENT_SECRET=<production_secret>
```

## FAQ

### Q: Why use Clerk for user auth instead of OAuth2?
**A**: Clerk provides a complete user management solution with MFA, SSO, compliance, and more. OAuth2 alone would only provide basic authentication without user management features.

### Q: Why not use Clerk for email/calendar access too?
**A**: Clerk manages user identities, not third-party API access. OAuth2 is the standard for obtaining API permissions from providers like Google and Microsoft.

### Q: Where are API tokens stored?
**A**: Encrypted locally on the user's device, linked to their Clerk user ID. They are never sent to external servers.

### Q: What happens when a user logs out?
**A**: Clerk session ends, but API tokens remain stored (encrypted). When the user logs back in, their email/calendar connections are still available.

### Q: Can users share API tokens between devices?
**A**: No, tokens are device-specific. Users must authorize email/calendar access on each device they use.

## Support

For issues related to:
- **User authentication**: Check Clerk documentation at https://clerk.com/docs
- **Email/Calendar API access**: Review OAuth2 configuration above
- **Token encryption**: Ensure `TOKEN_ENCRYPTION_KEY` is properly set

Remember: Clerk handles WHO the user is, OAuth2 handles WHAT they can access.