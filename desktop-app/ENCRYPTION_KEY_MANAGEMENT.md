# Automatic Encryption Key Management

## Overview

Flow Desk now features automatic encryption key management that works seamlessly across Windows, macOS, and Linux without requiring any user configuration. Encryption keys are generated automatically on first launch and stored securely using platform-specific secure storage mechanisms.

## Key Features

### Automatic Key Generation
- Cryptographically secure 256-bit encryption keys are generated automatically
- Keys are created on first app launch
- No user intervention or configuration required
- Multiple keys for different purposes (OAuth, Database, Session, Master)

### Cross-Platform Secure Storage

#### Windows
- **Storage**: Windows Credential Manager
- **Access**: Protected by Windows user account
- **Security**: Encrypted by Windows DPAPI

#### macOS
- **Storage**: macOS Keychain Services
- **Access**: Protected by macOS user account
- **Security**: Encrypted by Keychain with hardware security when available

#### Linux
- **Primary Storage**: Secret Service API (libsecret)
- **Fallback**: Encrypted file with machine-specific encryption
- **Security**: Protected by user session or machine-specific key

### Key Security Features

#### Automatic Management
- Keys are generated once and persist across app sessions
- Automatic loading on app startup
- No manual configuration in .env files needed

#### Key Rotation
- Support for key rotation (recommended every 90 days)
- Automatic detection of key age
- Seamless re-encryption with new keys

#### Backup & Recovery
- Export encrypted key backups with password protection
- Import keys from backup when needed
- Disaster recovery capabilities

## Implementation Details

### Key Types

1. **OAuth Encryption Key**: Encrypts OAuth tokens for email/calendar providers
2. **Database Encryption Key**: Encrypts sensitive database content
3. **Session Secret**: Secures session data
4. **Master Key**: Root encryption key for additional security layers

### Storage Locations

#### Windows
```
Credential Manager > Windows Credentials > FlowDeskEncryption
```

#### macOS
```
Keychain Access > login > FlowDeskEncryption
```

#### Linux (with Secret Service)
```
Secret Service Provider (e.g., GNOME Keyring, KDE Wallet)
```

#### Linux (Fallback)
```
~/.config/FlowDesk/userData/.encryption/
├── keys.enc    # Encrypted keys
└── meta.json   # Metadata
```

### Security Measures

1. **Encryption Algorithm**: AES-256-GCM for token encryption
2. **Key Derivation**: PBKDF2 with 100,000 iterations for fallback encryption
3. **Authentication**: HMAC for integrity verification
4. **Access Control**: Platform-specific user authentication required

## Migration from Manual Keys

If you're upgrading from a version that required manual encryption keys:

1. The app will automatically generate new keys on first launch
2. Old .env encryption key settings are ignored
3. Existing encrypted data will need re-encryption with new keys
4. No action required from users

## Troubleshooting

### Keys Not Found
- **Windows**: Ensure Windows Credential Manager service is running
- **macOS**: Check Keychain Access permissions
- **Linux**: Verify Secret Service is available or fallback directory has proper permissions

### Permission Errors
- **Windows**: Run as the same user account
- **macOS**: Grant Keychain access when prompted
- **Linux**: Ensure proper file permissions (0600) for fallback files

### Key Rotation
To manually trigger key rotation:
```javascript
// This happens automatically, but can be triggered if needed
await encryptionKeyManager.rotateKeys();
```

## Security Best Practices

1. **Never share or expose the encryption keys**
2. **Keep your operating system user account secure**
3. **Use strong OS-level authentication (password, biometric)**
4. **Regularly update the application for security patches**
5. **Consider key rotation every 90 days**

## Developer Information

### Using the Encryption Key Manager

```javascript
import { encryptionKeyManager } from './encryption-key-manager';

// Initialize (happens automatically on app start)
await encryptionKeyManager.initialize();

// Get all keys
const keys = await encryptionKeyManager.getKeys();

// Get specific key
const oauthKey = await encryptionKeyManager.getKey('oauthEncryptionKey');

// Check if rotation needed
if (encryptionKeyManager.needsRotation()) {
  await encryptionKeyManager.rotateKeys();
}
```

### Handling Key Rotation Events

```javascript
process.on('encryption-keys-rotated', ({ oldKeys, newKeys }) => {
  // Re-encrypt existing data with new keys
  await reencryptData(oldKeys, newKeys);
});
```

## Compliance

This automatic encryption key management system helps meet various compliance requirements:

- **SOC 2**: Encryption at rest and key management controls
- **PCI DSS**: Strong cryptography and key management procedures
- **GDPR**: Technical measures for data protection
- **HIPAA**: Encryption requirements for PHI

## Support

For issues related to encryption key management:

1. Check this documentation
2. Review application logs in:
   - Windows: `%APPDATA%\FlowDesk\logs\`
   - macOS: `~/Library/Logs/FlowDesk/`
   - Linux: `~/.config/FlowDesk/logs/`
3. Contact support with encrypted diagnostic information

## Version History

- **v1.0.0**: Initial automatic key management implementation
- Platform-specific secure storage support
- Automatic generation and management
- No user configuration required