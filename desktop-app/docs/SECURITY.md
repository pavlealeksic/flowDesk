# Flow Desk Security Model

This document outlines Flow Desk's comprehensive security architecture, threat model, and implemented security measures.

## Table of Contents

- [Security Overview](#security-overview)
- [Threat Model](#threat-model)
- [Process Isolation](#process-isolation)
- [Data Isolation](#data-isolation)
- [Input Validation](#input-validation)
- [Network Security](#network-security)
- [Credential Management](#credential-management)
- [Browser View Security](#browser-view-security)
- [Security Best Practices](#security-best-practices)
- [Security Auditing](#security-auditing)

## Security Overview

Flow Desk implements a defense-in-depth security model with multiple layers of protection:

1. **Process Isolation**: Separate processes for main, renderer, and service content
2. **Context Isolation**: Strict API boundaries between processes
3. **Data Isolation**: Workspace and service data separation
4. **Input Validation**: Comprehensive validation of all user inputs
5. **Network Security**: Secure communication and content loading
6. **Credential Protection**: Secure storage and handling of sensitive data

## Threat Model

### Identified Threats

#### T1: Malicious Web Content
- **Description**: Services loading malicious JavaScript or attempting to escape sandbox
- **Impact**: High - Could compromise user data or system
- **Mitigation**: Context isolation, sandboxing, CSP headers

#### T2: Cross-Service Data Leakage
- **Description**: One service accessing data from another service
- **Impact**: Medium - Privacy violation, data exposure
- **Mitigation**: Session partitioning, browser isolation

#### T3: IPC Injection Attacks
- **Description**: Malicious input sent through IPC channels
- **Impact**: High - Could execute arbitrary code in main process
- **Mitigation**: Input validation, rate limiting, API whitelisting

#### T4: Credential Theft
- **Description**: Unauthorized access to stored credentials
- **Impact**: High - Account compromise
- **Mitigation**: System keychain integration, encryption

#### T5: Main Process Compromise
- **Description**: Vulnerability in main process allows system access
- **Impact**: Critical - Full system compromise
- **Mitigation**: Minimal attack surface, security reviews, updates

### Attack Vectors

1. **Malicious Service URLs**: User adds compromised service
2. **Supply Chain Attacks**: Compromised dependencies
3. **Social Engineering**: Tricking users into unsafe actions
4. **Local Privilege Escalation**: Exploiting system vulnerabilities
5. **Network-based Attacks**: Man-in-the-middle, DNS poisoning

## Process Isolation

### Main Process Security

The main process runs with elevated privileges but implements strict security boundaries:

```typescript
// Security configuration in main process
const securityConfig = {
  // Disable Node.js integration in all web content
  nodeIntegration: false,
  
  // Enable context isolation
  contextIsolation: true,
  
  // Enable sandbox mode
  sandbox: true,
  
  // Disable remote module
  enableRemoteModule: false,
  
  // Restrict navigation
  webSecurity: true,
  
  // Prevent insecure content
  allowRunningInsecureContent: false
};
```

### Renderer Process Isolation

The renderer process runs in a sandboxed environment:

```typescript
// Main window security configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: join(__dirname, '../preload/preload.js'),
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false
  }
});
```

### Preload Script Security

Preload scripts provide controlled API access:

```typescript
// Secure API surface exposure
contextBridge.exposeInMainWorld('flowDesk', {
  // Only expose necessary functions
  workspace: {
    create: (data: CreateWorkspaceData) => ipcRenderer.invoke('workspace:create', data),
    // Input validation applied to all parameters
  }
});

// Input validation example
const validateString = (input: unknown, maxLength: number = 1000): string => {
  if (typeof input !== 'string') {
    throw new Error('Invalid input: expected string');
  }
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength}`);
  }
  // Remove potential script injection attempts
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};
```

## Data Isolation

### Workspace Isolation

Workspaces can be configured with different isolation levels:

```typescript
type BrowserIsolation = 'shared' | 'isolated';

// Isolated mode: Each service gets its own session partition
const createIsolatedSession = (workspaceId: string, serviceId: string) => {
  const sessionName = `workspace-${workspaceId}-service-${serviceId}`;
  return session.fromPartition(`persist:${sessionName}`);
};

// Shared mode: Services share session within workspace
const createSharedSession = (workspaceId: string) => {
  const sessionName = `workspace-${workspaceId}-shared`;
  return session.fromPartition(`persist:${sessionName}`);
};
```

### Session Security Configuration

Each browser view session is configured with security policies:

```typescript
const configureBrowserViewSecurity = (browserView: BrowserView) => {
  // Content Security Policy
  browserView.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "connect-src 'self' https: wss: ws:; " +
          "img-src 'self' data: https:; " +
          "media-src 'self' https:; " +
          "frame-src 'self' https:;"
        ]
      }
    });
  });

  // Block dangerous protocols
  browserView.webContents.setWindowOpenHandler(({ url }) => {
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    try {
      const parsedUrl = new URL(url);
      if (allowedProtocols.includes(parsedUrl.protocol)) {
        shell.openExternal(url);
      }
    } catch (error) {
      console.warn('Blocked potentially dangerous URL:', url);
    }
    return { action: 'deny' };
  });
};
```

## Input Validation

### IPC Input Validation

All IPC communications are validated before processing:

```typescript
// URL validation
const validateUrl = (url: unknown): string => {
  const validatedUrl = validateString(url, 2000);
  try {
    const parsedUrl = new URL(validatedUrl);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol');
    }
    return validatedUrl;
  } catch {
    throw new Error('Invalid URL format');
  }
};

// ID validation
const validateId = (id: unknown): string => {
  const validatedId = validateString(id, 100);
  // Ensure ID contains only safe characters
  if (!/^[a-zA-Z0-9_-]+$/.test(validatedId)) {
    throw new Error('Invalid ID format');
  }
  return validatedId;
};

// Color validation
const validateColor = (color: unknown): string => {
  const validatedColor = validateString(color, 7);
  if (!/^#[0-9A-Fa-f]{6}$/.test(validatedColor)) {
    throw new Error('Invalid color format');
  }
  return validatedColor;
};
```

### Rate Limiting

Protect against abuse with rate limiting:

```typescript
class SecurityConfig {
  private rateLimits = new Map<string, number[]>();
  private readonly MAX_REQUESTS_PER_MINUTE = 60;

  checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const requests = this.rateLimits.get(identifier) || [];
    
    // Remove requests older than 1 minute
    const recentRequests = requests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= this.MAX_REQUESTS_PER_MINUTE) {
      return false; // Rate limit exceeded
    }
    
    recentRequests.push(now);
    this.rateLimits.set(identifier, recentRequests);
    return true;
  }
}
```

## Network Security

### HTTPS Enforcement

```typescript
// Force HTTPS for external content
const enforceHttps = (url: string): string => {
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};
```

### Certificate Validation

```typescript
// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // In production, be strict about certificates
  if (process.env.NODE_ENV === 'production') {
    event.preventDefault();
    callback(false); // Reject invalid certificates
  } else {
    // In development, allow self-signed certificates with user consent
    callback(true);
  }
});
```

### Request Filtering

```typescript
// Filter and monitor network requests
session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
  const url = new URL(details.url);
  
  // Block known malicious domains
  const blockedDomains = [
    'malicious-site.com',
    'phishing-domain.net'
  ];
  
  if (blockedDomains.includes(url.hostname)) {
    console.warn('Blocked request to malicious domain:', url.hostname);
    callback({ cancel: true });
    return;
  }
  
  callback({ cancel: false });
});
```

## Credential Management

### System Keychain Integration

```typescript
import * as keytar from 'keytar';

class CredentialManager {
  private static readonly SERVICE_NAME = 'flow-desk';

  static async storeCredential(account: string, password: string): Promise<void> {
    try {
      await keytar.setPassword(this.SERVICE_NAME, account, password);
    } catch (error) {
      throw new Error(`Failed to store credential: ${error.message}`);
    }
  }

  static async getCredential(account: string): Promise<string | null> {
    try {
      return await keytar.getPassword(this.SERVICE_NAME, account);
    } catch (error) {
      console.error('Failed to retrieve credential:', error);
      return null;
    }
  }

  static async deleteCredential(account: string): Promise<void> {
    try {
      await keytar.deletePassword(this.SERVICE_NAME, account);
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  }
}
```

### Encryption for Local Data

```typescript
import * as crypto from 'crypto';

class DataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  
  static encrypt(text: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from('flow-desk'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }, key: Buffer): string {
    const decipher = crypto.createDecipher(this.ALGORITHM, key);
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    decipher.setAAD(Buffer.from('flow-desk'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## Browser View Security

### Sandboxing Configuration

```typescript
const createSecureBrowserView = (service: WorkspaceService): BrowserView => {
  return new BrowserView({
    webPreferences: {
      // Core security settings
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      
      // Additional security
      backgroundThrottling: false,
      devTools: process.env.NODE_ENV === 'development',
      
      // Session isolation
      session: createServiceSession(service),
      
      // Preload script for service-specific APIs (if needed)
      preload: service.config.preloadScript || undefined
    }
  });
};
```

### Permission Management

```typescript
const configurePermissions = (session: Session) => {
  // Handle permission requests
  session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = [
      'clipboard-read',
      'clipboard-sanitized-write',
      'fullscreen',
      'notifications'
    ];
    
    const deniedPermissions = [
      'camera',
      'microphone',
      'geolocation',
      'midi',
      'pointerLock'
    ];
    
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else if (deniedPermissions.includes(permission)) {
      callback(false);
    } else {
      // Unknown permission - deny by default
      console.warn(`Unknown permission requested: ${permission}`);
      callback(false);
    }
  });
};
```

## Security Best Practices

### Development Guidelines

1. **Input Validation**: Always validate inputs at boundaries
2. **Principle of Least Privilege**: Grant minimal necessary permissions
3. **Defense in Depth**: Layer multiple security mechanisms
4. **Fail Secure**: Default to secure behavior on errors
5. **Regular Updates**: Keep dependencies updated

### Code Review Checklist

- [ ] All user inputs are validated
- [ ] No `eval()` or similar dynamic code execution
- [ ] Proper error handling without information disclosure
- [ ] Secure defaults for all configurations
- [ ] No hardcoded credentials or secrets
- [ ] Proper session and data isolation
- [ ] Network requests use HTTPS where possible

### Secure Coding Patterns

```typescript
// Good: Parameterized queries (if using SQL)
const query = 'SELECT * FROM workspaces WHERE id = ?';
db.query(query, [workspaceId]);

// Bad: String concatenation
const badQuery = `SELECT * FROM workspaces WHERE id = ${workspaceId}`;

// Good: Input validation
const createWorkspace = (data: unknown) => {
  const validated = WorkspaceSchema.parse(data); // Using Zod or similar
  return workspaceManager.create(validated);
};

// Bad: Trusting input
const createWorkspace = (data: any) => {
  return workspaceManager.create(data);
};
```

## Security Auditing

### Automated Security Scanning

```bash
# Dependency vulnerability scanning
npm audit

# Security-focused linting
npm run lint:security

# SAST (Static Application Security Testing)
npm run security:scan
```

### Security Testing

```typescript
// Security test example
describe('IPC Security', () => {
  test('should reject invalid workspace data', async () => {
    const maliciousData = {
      name: '<script>alert("xss")</script>',
      color: 'invalid-color'
    };
    
    await expect(
      window.flowDesk.workspace.create(maliciousData)
    ).rejects.toThrow('Invalid input');
  });
  
  test('should rate limit IPC calls', async () => {
    // Send many requests quickly
    const requests = Array(100).fill(0).map(() => 
      window.flowDesk.workspace.list()
    );
    
    // Some should be rejected
    const results = await Promise.allSettled(requests);
    const rejected = results.filter(r => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThan(0);
  });
});
```

### Security Monitoring

```typescript
// Security event logging
class SecurityMonitor {
  static logSecurityEvent(event: string, details: Record<string, any>) {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity: this.getSeverity(event)
    };
    
    // Log to secure audit trail
    console.log('SECURITY_EVENT:', JSON.stringify(securityEvent));
    
    // Send to monitoring system in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToSIEM(securityEvent);
    }
  }
  
  private static getSeverity(event: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap = {
      'rate_limit_exceeded': 'medium',
      'invalid_input_blocked': 'low',
      'certificate_error': 'high',
      'permission_denied': 'medium'
    };
    
    return severityMap[event] || 'medium';
  }
}
```

### Incident Response

1. **Detection**: Automated monitoring and user reports
2. **Analysis**: Determine scope and impact
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat and vulnerabilities
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

### Security Updates

```typescript
// Auto-updater security configuration
const { autoUpdater } = require('electron-updater');

// Configure secure update server
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'flow-desk',
  repo: 'desktop-app',
  private: false // Set to true for private repos
});

// Verify update signatures
autoUpdater.verifySignature = true;

// Handle update events
autoUpdater.on('update-available', () => {
  // Notify user of available update
});

autoUpdater.on('update-downloaded', () => {
  // Prompt user to restart and apply update
});
```

---

This security model provides comprehensive protection while maintaining usability. Regular security reviews and updates ensure continued protection against evolving threats.