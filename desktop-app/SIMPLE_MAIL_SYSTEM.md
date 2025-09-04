# Simple Mail System - Apple Mail Style

This document describes the new Simple Mail System implemented in Flow Desk, which provides Apple Mail-style email account setup with just email and password authentication.

## Overview

The Simple Mail System eliminates OAuth complexity by using direct IMAP/SMTP connections with predefined server configurations for major email providers. Users only need to provide their email address and password (or app-specific password for Gmail/Outlook).

## Supported Email Providers

The system automatically detects the email provider from the domain and uses predefined server configurations:

### Gmail (`@gmail.com`, `@googlemail.com`)
- **IMAP**: `imap.gmail.com:993` (SSL/TLS)
- **SMTP**: `smtp.gmail.com:587` (STARTTLS)
- **Note**: Requires app-specific password, not your regular Gmail password

### Outlook (`@outlook.com`, `@hotmail.com`, `@live.com`, `@msn.com`)
- **IMAP**: `outlook.office365.com:993` (SSL/TLS)
- **SMTP**: `smtp-mail.outlook.com:587` (STARTTLS)
- **Note**: May require app-specific password

### Yahoo Mail (`@yahoo.com`, `@yahoo.co.uk`, `@ymail.com`)
- **IMAP**: `imap.mail.yahoo.com:993` (SSL/TLS)
- **SMTP**: `smtp.mail.yahoo.com:587` (STARTTLS)
- **Note**: Requires app-specific password

### iCloud Mail (`@icloud.com`, `@me.com`, `@mac.com`)
- **IMAP**: `imap.mail.me.com:993` (SSL/TLS)
- **SMTP**: `smtp.mail.me.com:587` (STARTTLS)
- **Note**: Requires app-specific password

### FastMail (`@fastmail.com`, `@fastmail.fm`)
- **IMAP**: `imap.fastmail.com:993` (SSL/TLS)
- **SMTP**: `smtp.fastmail.com:587` (STARTTLS)
- **Note**: Can use regular password

## Architecture

### Rust Backend (`simple_mail_engine.rs`)
- **`SimpleMailEngine`**: Core engine handling IMAP/SMTP operations
- **`ServerConfig`**: Predefined configurations for email providers
- **`SimpleMailAccount`**: Account representation with encrypted password storage
- **`KeychainStorage`**: Cross-platform keychain integration for encryption keys

### NAPI Bindings (`simple_mail_napi.rs`)
- Exposes Rust functionality to Node.js/Electron
- Handles serialization between Rust and JavaScript types
- Provides async API for all mail operations

### TypeScript Types (`src/types/simple-mail.ts`)
- Complete type definitions for the Simple Mail API
- Interfaces for accounts, messages, and configurations
- Type-safe integration with React components

### Frontend Integration
- **`SimpleMailAccountModal`**: Updated to use the new simple mail API
- **Preload Script**: Exposes `window.flowDesk.simpleMail` API
- **Main Process**: IPC handlers for all simple mail operations

## Key Features

### 1. Automatic Provider Detection
```typescript
const providerInfo = await window.flowDesk.simpleMail.detectEmailProvider(email);
// Returns: { name: "gmail", displayName: "Gmail", supported: true }
```

### 2. Connection Testing
```typescript
const isValid = await window.flowDesk.simpleMail.testConnection(email, password);
// Tests both IMAP and SMTP connections before account creation
```

### 3. Secure Password Storage
- Passwords are encrypted using system keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- Automatic encryption key generation and management
- Cross-platform secure storage

### 4. Simple Account Management
```typescript
// Add account
const account = await window.flowDesk.simpleMail.addAccount({
  email: "user@gmail.com",
  password: "app-specific-password",
  displayName: "My Gmail"
});

// Fetch messages
const messages = await window.flowDesk.simpleMail.fetchMessages(accountId, "INBOX");

// Send email
await window.flowDesk.simpleMail.sendEmail(accountId, ["recipient@example.com"], "Subject", "Body");
```

## Security Considerations

### Password Storage
- All passwords are encrypted before storage using AES-256
- Encryption keys are stored in the system keychain
- Keys are generated automatically on first run

### App-Specific Passwords
For enhanced security, most providers require app-specific passwords:

#### Gmail
1. Enable 2-Step Verification
2. Go to Google Account settings > Security > App passwords
3. Generate an app password for "Mail"
4. Use this password in Flow Desk

#### Outlook
1. Go to Microsoft Account security settings
2. Enable 2-Step Verification
3. Create an app password for email applications
4. Use this password in Flow Desk

## Error Handling

The system provides clear error messages for common issues:

- **Unsupported Provider**: Clear message with list of supported providers
- **Authentication Failed**: Guidance on using app-specific passwords
- **Connection Errors**: Network and server-related error details
- **Configuration Errors**: Invalid settings or missing parameters

## Implementation Files

### Rust Backend
- `src/lib/rust-engine/src/simple_mail_engine.rs` - Core mail engine
- `src/lib/rust-engine/src/simple_mail_napi.rs` - NAPI bindings
- `src/lib/rust-engine/src/lib.rs` - Module registration

### Frontend
- `src/types/simple-mail.ts` - TypeScript type definitions
- `src/renderer/components/mail/SimpleMailAccountModal.tsx` - Account setup UI
- `src/preload/preload.ts` - API exposure to renderer

### Main Process
- `src/main/main.ts` - IPC handlers for simple mail operations

## Future Enhancements

### Planned Features
1. **Folder Synchronization**: Full IMAP folder structure support
2. **Message Threading**: Email conversation grouping
3. **Advanced Search**: Full-text search across all accounts
4. **Push Notifications**: Real-time email notifications via IMAP IDLE
5. **Attachment Support**: Complete attachment handling
6. **Message Caching**: Offline message access

### Additional Providers
- ProtonMail (via Bridge)
- Custom IMAP servers
- Corporate Exchange servers
- Regional email providers

## Migration from OAuth

The Simple Mail System coexists with the existing OAuth-based mail system. Users can choose between:

1. **Simple Setup** (new): Email + password with predefined configs
2. **OAuth Setup** (existing): Full OAuth flow with advanced permissions

This allows for a gradual migration while maintaining backward compatibility.

## Testing

### Connection Testing
The system includes comprehensive connection testing:
- IMAP server connectivity and authentication
- SMTP server connectivity and authentication  
- SSL/TLS certificate validation
- Port accessibility checks

### Error Recovery
- Automatic retry logic for transient failures
- Graceful handling of network interruptions
- Clear error reporting for debugging

## Performance

### Optimizations
- Connection pooling for SMTP operations
- Efficient IMAP folder selection
- Minimal memory usage for message metadata
- Background synchronization without blocking UI

### Limitations
- Initial implementation focuses on basic functionality
- Advanced IMAP features (like server-side search) will be added later
- Message body fetching is on-demand to conserve bandwidth

This Simple Mail System provides a streamlined, user-friendly email experience that matches the simplicity users expect from modern mail applications while maintaining security and reliability.