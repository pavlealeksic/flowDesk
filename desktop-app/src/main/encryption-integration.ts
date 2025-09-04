/**
 * Encryption Integration Module
 * 
 * Provides integration between the automatic encryption key manager
 * and existing services that require encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import log from 'electron-log';
import { encryptionKeyManager } from './encryption-key-manager';

export interface EncryptionConfig {
  algorithm?: string;
  keyDerivation?: 'direct' | 'pbkdf2' | 'scrypt';
  iterations?: number;
}

/**
 * Unified encryption service using automatic keys
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private readonly ALGORITHM = 'aes-256-gcm';
  private keys: any = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize the encryption service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get keys from the automatic key manager
      this.keys = await encryptionKeyManager.getKeys();
      
      if (!this.keys) {
        throw new Error('Failed to obtain encryption keys');
      }
      
      this.isInitialized = true;
      log.info('Encryption service initialized with automatic keys');
    } catch (error) {
      log.error('Failed to initialize encryption service:', error);
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Encrypt OAuth token
   */
  public async encryptOAuthToken(token: string): Promise<string> {
    await this.ensureInitialized();
    return this.encrypt(token, this.keys.oauthEncryptionKey);
  }

  /**
   * Decrypt OAuth token
   */
  public async decryptOAuthToken(encryptedToken: string): Promise<string> {
    await this.ensureInitialized();
    return this.decrypt(encryptedToken, this.keys.oauthEncryptionKey);
  }

  /**
   * Encrypt database data
   */
  public async encryptDatabaseData(data: string): Promise<string> {
    await this.ensureInitialized();
    return this.encrypt(data, this.keys.databaseEncryptionKey);
  }

  /**
   * Decrypt database data
   */
  public async decryptDatabaseData(encryptedData: string): Promise<string> {
    await this.ensureInitialized();
    return this.decrypt(encryptedData, this.keys.databaseEncryptionKey);
  }

  /**
   * Encrypt session data
   */
  public async encryptSessionData(data: string): Promise<string> {
    await this.ensureInitialized();
    return this.encrypt(data, this.keys.sessionSecret);
  }

  /**
   * Decrypt session data
   */
  public async decryptSessionData(encryptedData: string): Promise<string> {
    await this.ensureInitialized();
    return this.decrypt(encryptedData, this.keys.sessionSecret);
  }

  /**
   * Generic encrypt function
   */
  private encrypt(text: string, keyHex: string): string {
    const iv = randomBytes(16);
    const key = Buffer.from(keyHex, 'hex');
    
    const cipher = createCipheriv(this.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    const combined = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted
    };
    
    return Buffer.from(JSON.stringify(combined)).toString('base64');
  }

  /**
   * Generic decrypt function
   */
  private decrypt(encryptedData: string, keyHex: string): string {
    try {
      const combined = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      
      const iv = Buffer.from(combined.iv, 'base64');
      const authTag = Buffer.from(combined.authTag, 'base64');
      const encrypted = combined.data;
      
      const key = Buffer.from(keyHex, 'hex');
      
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      log.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  public hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compare hashed data
   */
  public compareHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  /**
   * Handle key rotation
   */
  public async handleKeyRotation(): Promise<void> {
    log.info('Handling key rotation in encryption service');
    
    // Re-initialize with new keys
    this.isInitialized = false;
    await this.initialize();
    
    log.info('Encryption service updated with rotated keys');
  }

  /**
   * Get encryption status
   */
  public getStatus(): {
    initialized: boolean;
    keyAge: number;
    needsRotation: boolean;
  } {
    return {
      initialized: this.isInitialized,
      keyAge: encryptionKeyManager.getKeyAge(),
      needsRotation: encryptionKeyManager.needsRotation()
    };
  }
}

/**
 * OAuth Token Encryption Helper
 */
export class OAuthTokenEncryption {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = EncryptionService.getInstance();
  }

  /**
   * Encrypt OAuth credentials
   */
  public async encryptCredentials(credentials: {
    accessToken: string;
    refreshToken?: string;
    [key: string]: any;
  }): Promise<string> {
    const encryptedCreds = {
      ...credentials,
      accessToken: await this.encryptionService.encryptOAuthToken(credentials.accessToken)
    };
    
    if (credentials.refreshToken) {
      encryptedCreds.refreshToken = await this.encryptionService.encryptOAuthToken(credentials.refreshToken);
    }
    
    return JSON.stringify(encryptedCreds);
  }

  /**
   * Decrypt OAuth credentials
   */
  public async decryptCredentials(encryptedData: string): Promise<any> {
    const credentials = JSON.parse(encryptedData);
    
    const decryptedCreds = {
      ...credentials,
      accessToken: await this.encryptionService.decryptOAuthToken(credentials.accessToken)
    };
    
    if (credentials.refreshToken) {
      decryptedCreds.refreshToken = await this.encryptionService.decryptOAuthToken(credentials.refreshToken);
    }
    
    return decryptedCreds;
  }
}

/**
 * Database Encryption Helper
 */
export class DatabaseEncryption {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = EncryptionService.getInstance();
  }

  /**
   * Encrypt sensitive database field
   */
  public async encryptField(value: string): Promise<string> {
    if (!value) return value;
    return await this.encryptionService.encryptDatabaseData(value);
  }

  /**
   * Decrypt sensitive database field
   */
  public async decryptField(encryptedValue: string): Promise<string> {
    if (!encryptedValue) return encryptedValue;
    return await this.encryptionService.decryptDatabaseData(encryptedValue);
  }

  /**
   * Batch encrypt multiple fields
   */
  public async encryptFields(data: Record<string, any>, fieldsToEncrypt: string[]): Promise<Record<string, any>> {
    const encrypted = { ...data };
    
    for (const field of fieldsToEncrypt) {
      if (encrypted[field]) {
        encrypted[field] = await this.encryptField(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Batch decrypt multiple fields
   */
  public async decryptFields(data: Record<string, any>, fieldsToDecrypt: string[]): Promise<Record<string, any>> {
    const decrypted = { ...data };
    
    for (const field of fieldsToDecrypt) {
      if (decrypted[field]) {
        decrypted[field] = await this.decryptField(decrypted[field]);
      }
    }
    
    return decrypted;
  }
}

/**
 * Migration helper for existing encrypted data
 */
export class EncryptionMigration {
  /**
   * Migrate data encrypted with old keys to new keys
   */
  public static async migrateEncryptedData(
    oldKey: string,
    newKey: string,
    data: string[]
  ): Promise<string[]> {
    const migrated: string[] = [];
    
    for (const item of data) {
      try {
        // Decrypt with old key
        const decrypted = await this.decryptWithKey(item, oldKey);
        
        // Re-encrypt with new key
        const encrypted = await this.encryptWithKey(decrypted, newKey);
        
        migrated.push(encrypted);
      } catch (error) {
        log.error('Failed to migrate encrypted item:', error);
        migrated.push(item); // Keep original if migration fails
      }
    }
    
    return migrated;
  }

  private static async decryptWithKey(encryptedData: string, keyHex: string): Promise<string> {
    // Implementation similar to EncryptionService.decrypt
    const combined = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
    const iv = Buffer.from(combined.iv, 'base64');
    const authTag = Buffer.from(combined.authTag, 'base64');
    const encrypted = combined.data;
    const key = Buffer.from(keyHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private static async encryptWithKey(text: string, keyHex: string): Promise<string> {
    // Implementation similar to EncryptionService.encrypt
    const iv = randomBytes(16);
    const key = Buffer.from(keyHex, 'hex');
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    const combined = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted
    };
    
    return Buffer.from(JSON.stringify(combined)).toString('base64');
  }
}

// Export singleton instances
export const encryptionService = EncryptionService.getInstance();
export const oauthTokenEncryption = new OAuthTokenEncryption();
export const databaseEncryption = new DatabaseEncryption();

// Listen for key rotation events
process.on('encryption-keys-rotated' as any, async () => {
  log.info('Encryption keys rotated, updating services...');
  await encryptionService.handleKeyRotation();
});