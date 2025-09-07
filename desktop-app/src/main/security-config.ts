/**
 * Security Configuration for Production
 * 
 * Centralized security settings and validation for production deployment
 */

import log from 'electron-log';
import { app, session, protocol } from 'electron';
import crypto from 'crypto';
import { URL } from 'url';

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Security configuration with production-safe defaults
 */
export class SecurityConfig {
  private static instance: SecurityConfig;
  private encryptionKey: string | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): SecurityConfig {
    if (!SecurityConfig.instance) {
      SecurityConfig.instance = new SecurityConfig();
    }
    return SecurityConfig.instance;
  }

  /**
   * Initialize security configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Validate environment
      this.validateEnvironment();

      // Set up encryption key
      await this.setupEncryptionKey();

      // Configure logging
      this.configureLogging();

      // Set security headers
      this.setSecurityHeaders();

      this.initialized = true;
      log.info('Security configuration initialized successfully');
    } catch (error) {
      log.error('Failed to initialize security configuration:', error);
      throw new Error('Security initialization failed');
    }
  }

  /**
   * Validate environment configuration
   */
  private validateEnvironment(): void {
    const requiredEnvVars = [
      'NODE_ENV'
    ];

    const missing = requiredEnvVars.filter(key => !process.env[key]);
    
    if (missing.length > 0 && isProduction) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate NODE_ENV
    if (!['development', 'production', 'test'].includes(process.env.NODE_ENV || '')) {
      log.warn('Invalid NODE_ENV, defaulting to production');
      process.env.NODE_ENV = 'production';
    }
  }

  /**
   * Set up encryption key from environment or generate a secure one
   */
  private async setupEncryptionKey(): Promise<void> {
    if (process.env.ENCRYPTION_KEY) {
      // Validate provided key
      const key = process.env.ENCRYPTION_KEY;
      if (key.length < 32) {
        throw new Error('Encryption key must be at least 32 characters');
      }
      this.encryptionKey = key;
    } else if (isProduction) {
      // In production, require an encryption key
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    } else {
      // Development mode - generate a temporary key
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
      log.warn('Using temporary encryption key for development');
    }
  }

  /**
   * Configure logging for production
   */
  private configureLogging(): void {
    // Disable console logging in production
    if (isProduction) {
      log.transports.console.level = false;
      log.transports.file.level = 'warn';
      
      // Set log file location
      log.transports.file.resolvePath = () => {
        return app.getPath('logs') + '/flow-desk.log';
      };
      
      // Limit log file size
      log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
    } else {
      log.transports.console.level = 'debug';
      log.transports.file.level = 'debug';
    }

    // Never log sensitive data
    log.hooks.push((message: any, transport: any) => {
      // Redact sensitive patterns
      if (typeof message === 'string') {
        let redactedMessage = message;
        redactedMessage = redactedMessage.replace(/password["\s]*[:=]["\s]*"[^"]*"/gi, 'password: "[REDACTED]"');
        redactedMessage = redactedMessage.replace(/token["\s]*[:=]["\s]*"[^"]*"/gi, 'token: "[REDACTED]"');
        redactedMessage = redactedMessage.replace(/api[_-]?key["\s]*[:=]["\s]*"[^"]*"/gi, 'api_key: "[REDACTED]"');
        redactedMessage = redactedMessage.replace(/secret["\s]*[:=]["\s]*"[^"]*"/gi, 'secret: "[REDACTED]"');
        return redactedMessage;
      }
      return message;
    });
  }

  /**
   * Set security headers for web requests
   */
  setSecurityHeaders(): void {
    // Configure Content Security Policy
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; '),
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin']
      };
      
      callback({ responseHeaders });
    });

    // Set permission request handler
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Deny dangerous permissions by default
      const deniedPermissions = [
        'openExternal',
        'media',
        'geolocation',
        'notifications',
        'midi',
        'pointerLock',
        'fullscreen',
        'clipboard-read'
      ];

      if (deniedPermissions.includes(permission)) {
        callback(false);
        log.warn(`Permission denied: ${permission}`);
      } else {
        callback(true);
      }
    });

    // Disable remote module for security
    app.commandLine.appendSwitch('disable-remote-module');
    
    // Disable node integration in all web contents
    app.commandLine.appendSwitch('disable-node-integration-in-worker');
  }

  /**
   * Get encryption key (throws if not initialized)
   */
  getEncryptionKey(): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    return this.encryptionKey;
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.getEncryptionKey().substring(0, 32));
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.getEncryptionKey().substring(0, 32));
    
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Validate OAuth configuration
   */
  validateOAuthConfig(provider: string, config: any): boolean {
    if (!config.clientId || !config.clientSecret) {
      log.error(`Invalid OAuth config for ${provider}: missing credentials`);
      return false;
    }

    // Don't allow default/example credentials in production
    if (isProduction) {
      const invalidPatterns = [
        'your-client-id',
        'your-client-secret',
        'example',
        'default',
        'test',
        'demo'
      ];

      for (const pattern of invalidPatterns) {
        if (config.clientId.toLowerCase().includes(pattern) ||
            config.clientSecret.toLowerCase().includes(pattern)) {
          log.error(`Invalid OAuth config for ${provider}: contains placeholder values`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    // Remove any potential script tags or dangerous HTML
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Check if running in secure context
   */
  isSecureContext(): boolean {
    return isProduction && this.initialized;
  }

  /**
   * Get security status
   */
  getSecurityStatus(): {
    initialized: boolean;
    environment: string;
    encryptionEnabled: boolean;
    loggingConfigured: boolean;
  } {
    return {
      initialized: this.initialized,
      environment: process.env.NODE_ENV || 'unknown',
      encryptionEnabled: !!this.encryptionKey,
      loggingConfigured: true
    };
  }

  /**
   * Configure protocol security
   */
  configureProtocolSecurity(): void {
    // Prevent navigation to external protocols
    app.on('web-contents-created', (event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        // Only allow http/https in production
        if (isProduction && !['http:', 'https:'].includes(parsedUrl.protocol)) {
          event.preventDefault();
          log.warn(`Blocked navigation to: ${navigationUrl}`);
        }
      });

      // Prevent new window creation
      contents.setWindowOpenHandler(({ url }) => {
        // Validate URL before opening
        try {
          const parsedUrl = new URL(url);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            log.warn(`Blocked window open for: ${url}`);
            return { action: 'deny' };
          }
        } catch (error) {
          log.error(`Invalid URL: ${url}`);
          return { action: 'deny' };
        }
        
        // Allow but log
        log.info(`Allowing window open for: ${url}`);
        return { action: 'allow' };
      });

      // Disable or limit webview tag
      contents.on('will-attach-webview', (event, webPreferences, params) => {
        // Strip away preload scripts if unused or verify they're safe
        delete webPreferences.preload;

        // Force security options
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
        webPreferences.webSecurity = true;
      });
    });

    // Register secure protocol schemes
    protocol.registerSchemesAsPrivileged([
      { scheme: 'app', privileges: { secure: true, standard: true } }
    ]);
  }

  /**
   * Validate and sanitize file paths
   */
  validatePath(filePath: string): boolean {
    // Prevent directory traversal attacks
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      log.error(`Path traversal attempt detected: ${filePath}`);
      return false;
    }

    // Check for null bytes
    if (normalizedPath.includes('\0')) {
      log.error(`Null byte injection detected: ${filePath}`);
      return false;
    }

    return true;
  }

  /**
   * Rate limiting for API calls
   */
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const limit = this.rateLimitMap.get(identifier);

    if (!limit || now > limit.resetTime) {
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    if (limit.count >= maxRequests) {
      log.warn(`Rate limit exceeded for: ${identifier}`);
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Clear expired rate limits
   */
  clearExpiredRateLimits(): void {
    const now = Date.now();
    for (const [key, limit] of this.rateLimitMap.entries()) {
      if (now > limit.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}

// Export singleton instance
export const securityConfig = SecurityConfig.getInstance();