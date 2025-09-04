/**
 * Security Configuration
 * 
 * Centralized security settings for production deployment
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyLength: number;
    saltLength: number;
    iterations: number;
  };
  session: {
    secret: string;
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  contentSecurity: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    frameAncestors: string[];
  };
}

class SecurityConfiguration {
  private config: SecurityConfig;
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): SecurityConfig {
    return {
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        saltLength: 32,
        iterations: 100000, // PBKDF2 iterations
      },
      session: {
        secret: this.getSessionSecret(),
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: this.isProduction,
        httpOnly: true,
        sameSite: 'strict',
      },
      cors: {
        origin: this.isProduction 
          ? process.env.ALLOWED_ORIGINS?.split(',') || false
          : true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: this.isProduction ? 100 : 1000, // Limit requests per window
      },
      contentSecurity: {
        defaultSrc: ["'self'"],
        scriptSrc: this.isProduction 
          ? ["'self'", "'unsafe-inline'"] 
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.openai.com', 'https://api.anthropic.com'],
        frameAncestors: ["'none'"],
      },
    };
  }

  private getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    
    if (!secret && this.isProduction) {
      logger.error('CRITICAL: SESSION_SECRET not set in production environment');
      throw new Error('SESSION_SECRET must be set in production');
    }
    
    if (!secret) {
      logger.warn('Using development session secret. Set SESSION_SECRET for production.');
      return crypto.randomBytes(32).toString('hex');
    }
    
    // Validate secret strength
    if (secret.length < 32) {
      logger.error('SESSION_SECRET is too short. Must be at least 32 characters.');
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }
    
    return secret;
  }

  private validateConfiguration(): void {
    // Validate encryption key if provided
    const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;
    if (encryptionKey && encryptionKey !== 'default-dev-key-change-in-production') {
      if (encryptionKey.length !== 64 || !/^[0-9a-f]+$/i.test(encryptionKey)) {
        logger.error('Invalid OAUTH_ENCRYPTION_KEY format');
        throw new Error('OAUTH_ENCRYPTION_KEY must be a 64-character hex string');
      }
    }

    // Check for required production environment variables
    if (this.isProduction) {
      const requiredVars = [
        'OAUTH_ENCRYPTION_KEY',
        'SESSION_SECRET',
        'DATABASE_ENCRYPTION_KEY',
      ];
      
      const missing = requiredVars.filter(v => !process.env[v]);
      if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        throw new Error(`Production requires: ${missing.join(', ')}`);
      }
    }

    logger.info('Security configuration validated successfully');
  }

  /**
   * Get encryption key for database or file encryption
   */
  getDatabaseEncryptionKey(): Buffer {
    const key = process.env.DATABASE_ENCRYPTION_KEY;
    
    if (!key && this.isProduction) {
      throw new Error('DATABASE_ENCRYPTION_KEY must be set in production');
    }
    
    if (!key) {
      // Development only - generate deterministic key
      const material = `${process.platform}-${require('os').hostname()}-db-dev`;
      return crypto.scryptSync(material, 'db-salt-dev', 32);
    }
    
    // Validate and return production key
    if (key.length !== 64 || !/^[0-9a-f]+$/i.test(key)) {
      throw new Error('DATABASE_ENCRYPTION_KEY must be a 64-character hex string');
    }
    
    return Buffer.from(key, 'hex');
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data (one-way)
   */
  hashData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Encrypt sensitive data (two-way)
   */
  encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const key = this.getDatabaseEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.config.encryption.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag().toString('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    const key = this.getDatabaseEncryptionKey();
    const decipher = crypto.createDecipheriv(
      this.config.encryption.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    (decipher as any).setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get Content Security Policy header
   */
  getCSPHeader(): string {
    const csp = this.config.contentSecurity;
    const directives = [
      `default-src ${csp.defaultSrc.join(' ')}`,
      `script-src ${csp.scriptSrc.join(' ')}`,
      `style-src ${csp.styleSrc.join(' ')}`,
      `img-src ${csp.imgSrc.join(' ')}`,
      `connect-src ${csp.connectSrc.join(' ')}`,
      `frame-ancestors ${csp.frameAncestors.join(' ')}`,
      "base-uri 'self'",
      "form-action 'self'",
    ];
    
    return directives.join('; ');
  }

  /**
   * Get security headers for HTTP responses
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': this.getCSPHeader(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };
  }

  getConfig(): SecurityConfig {
    return this.config;
  }
}

// Export singleton instance
export const securityConfig = new SecurityConfiguration();
export default securityConfig;