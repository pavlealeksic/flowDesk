/**
 * Cross-Platform Encryption Key Manager
 * 
 * Automatically generates and securely stores encryption keys across Windows, macOS, and Linux
 * without requiring any user configuration. Keys are stored in platform-specific secure storage.
 * 
 * Storage Locations:
 * - Windows: Windows Credential Manager
 * - macOS: macOS Keychain Services
 * - Linux: Secret Service API (libsecret) with fallback to encrypted file
 */

import { app, safeStorage } from 'electron';
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { join } from 'path';
import { existsSync, promises as fs } from 'fs';
import log from 'electron-log';
import * as keytar from 'keytar';

export interface EncryptionKeys {
  oauthEncryptionKey: string;
  databaseEncryptionKey: string;
  sessionSecret: string;
  masterKey: string;
}

export interface KeyMetadata {
  version: number;
  createdAt: Date;
  lastRotated: Date;
  rotationCount: number;
  platform: NodeJS.Platform;
}

/**
 * Cross-platform encryption key manager
 * Handles automatic key generation, storage, retrieval, and rotation
 */
export class EncryptionKeyManager {
  private static instance: EncryptionKeyManager;
  
  private readonly SERVICE_NAME = 'FlowDeskEncryption';
  private readonly ACCOUNT_PREFIX = 'flowdesk_';
  private readonly KEY_VERSION = 1;
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly ITERATIONS = 100000;
  
  private keys: EncryptionKeys | null = null;
  private metadata: KeyMetadata | null = null;
  private isInitialized = false;
  
  // Fallback file paths for Linux when Secret Service is unavailable
  private readonly fallbackDir = join(app.getPath('userData'), '.encryption');
  private readonly fallbackKeyFile = join(this.fallbackDir, 'keys.enc');
  private readonly fallbackMetaFile = join(this.fallbackDir, 'meta.json');

  private constructor() {
    log.info('Encryption Key Manager initialized for platform:', process.platform);
  }

  public static getInstance(): EncryptionKeyManager {
    if (!EncryptionKeyManager.instance) {
      EncryptionKeyManager.instance = new EncryptionKeyManager();
    }
    return EncryptionKeyManager.instance;
  }

  /**
   * Initialize the key manager and ensure all keys are available
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      log.info('Initializing encryption key management...');
      
      // Check if keys exist
      const existingKeys = await this.loadKeys();
      
      if (existingKeys) {
        this.keys = existingKeys;
        log.info('Loaded existing encryption keys');
      } else {
        // Generate new keys on first run
        log.info('First run detected, generating new encryption keys...');
        this.keys = await this.generateKeys();
        await this.saveKeys(this.keys);
        log.info('New encryption keys generated and stored securely');
      }
      
      // Load or create metadata
      this.metadata = await this.loadMetadata() || this.createMetadata();
      await this.saveMetadata(this.metadata);
      
      this.isInitialized = true;
      log.info('Encryption key manager initialized successfully');
      return true;
      
    } catch (error) {
      log.error('Failed to initialize encryption key manager:', error);
      return false;
    }
  }

  /**
   * Get encryption keys
   */
  public async getKeys(): Promise<EncryptionKeys | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.keys;
  }

  /**
   * Get a specific key
   */
  public async getKey(keyName: keyof EncryptionKeys): Promise<string | null> {
    const keys = await this.getKeys();
    return keys ? keys[keyName] : null;
  }

  /**
   * Generate new encryption keys
   */
  private async generateKeys(): Promise<EncryptionKeys> {
    return {
      oauthEncryptionKey: randomBytes(this.KEY_LENGTH).toString('hex'),
      databaseEncryptionKey: randomBytes(this.KEY_LENGTH).toString('hex'),
      sessionSecret: randomBytes(this.KEY_LENGTH).toString('hex'),
      masterKey: randomBytes(this.KEY_LENGTH).toString('hex')
    };
  }

  /**
   * Save keys to platform-specific secure storage
   */
  private async saveKeys(keys: EncryptionKeys): Promise<void> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin' || platform === 'win32') {
        // Use keytar for macOS Keychain and Windows Credential Manager
        await this.saveKeysWithKeytar(keys);
      } else if (platform === 'linux') {
        // Try keytar first (Secret Service), fall back to encrypted file
        try {
          await this.saveKeysWithKeytar(keys);
        } catch (error) {
          log.warn('Secret Service unavailable, using encrypted file fallback');
          await this.saveKeysWithFallback(keys);
        }
      } else {
        // Unknown platform, use encrypted file fallback
        await this.saveKeysWithFallback(keys);
      }
    } catch (error) {
      log.error('Failed to save encryption keys:', error);
      throw new Error('Unable to securely store encryption keys');
    }
  }

  /**
   * Load keys from platform-specific secure storage
   */
  private async loadKeys(): Promise<EncryptionKeys | null> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin' || platform === 'win32') {
        // Use keytar for macOS Keychain and Windows Credential Manager
        return await this.loadKeysWithKeytar();
      } else if (platform === 'linux') {
        // Try keytar first (Secret Service), fall back to encrypted file
        try {
          const keys = await this.loadKeysWithKeytar();
          if (keys) return keys;
        } catch (error) {
          log.debug('Secret Service unavailable, trying encrypted file fallback');
        }
        return await this.loadKeysWithFallback();
      } else {
        // Unknown platform, use encrypted file fallback
        return await this.loadKeysWithFallback();
      }
    } catch (error) {
      log.error('Failed to load encryption keys:', error);
      return null;
    }
  }

  /**
   * Save keys using keytar (macOS Keychain, Windows Credential Manager, Linux Secret Service)
   */
  private async saveKeysWithKeytar(keys: EncryptionKeys): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [keyName, keyValue] of Object.entries(keys)) {
      promises.push(
        keytar.setPassword(
          this.SERVICE_NAME,
          `${this.ACCOUNT_PREFIX}${keyName}`,
          keyValue
        )
      );
    }
    
    await Promise.all(promises);
  }

  /**
   * Load keys using keytar
   */
  private async loadKeysWithKeytar(): Promise<EncryptionKeys | null> {
    const keyNames: (keyof EncryptionKeys)[] = [
      'oauthEncryptionKey',
      'databaseEncryptionKey',
      'sessionSecret',
      'masterKey'
    ];
    
    const keys: Partial<EncryptionKeys> = {};
    
    for (const keyName of keyNames) {
      const value = await keytar.getPassword(
        this.SERVICE_NAME,
        `${this.ACCOUNT_PREFIX}${keyName}`
      );
      
      if (!value) {
        return null; // Keys not found or incomplete
      }
      
      keys[keyName] = value;
    }
    
    return keys as EncryptionKeys;
  }

  /**
   * Save keys using encrypted file fallback (primarily for Linux without Secret Service)
   */
  private async saveKeysWithFallback(keys: EncryptionKeys): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.fallbackDir)) {
      await fs.mkdir(this.fallbackDir, { recursive: true, mode: 0o700 });
    }
    
    // Use Electron's safeStorage for additional protection
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedData = safeStorage.encryptString(JSON.stringify(keys));
      await fs.writeFile(this.fallbackKeyFile, encryptedData, { mode: 0o600 });
    } else {
      // Fall back to machine-specific encryption
      const encrypted = await this.encryptWithMachineKey(JSON.stringify(keys));
      await fs.writeFile(this.fallbackKeyFile, encrypted, { mode: 0o600 });
    }
  }

  /**
   * Load keys using encrypted file fallback
   */
  private async loadKeysWithFallback(): Promise<EncryptionKeys | null> {
    if (!existsSync(this.fallbackKeyFile)) {
      return null;
    }
    
    try {
      const encryptedData = await fs.readFile(this.fallbackKeyFile);
      
      let decryptedString: string;
      if (safeStorage.isEncryptionAvailable()) {
        decryptedString = safeStorage.decryptString(encryptedData);
      } else {
        decryptedString = await this.decryptWithMachineKey(encryptedData);
      }
      
      return JSON.parse(decryptedString) as EncryptionKeys;
    } catch (error) {
      log.error('Failed to load keys from fallback:', error);
      return null;
    }
  }

  /**
   * Encrypt data using machine-specific key (fallback for when safeStorage is unavailable)
   */
  private async encryptWithMachineKey(data: string): Promise<Buffer> {
    const machineId = await this.getMachineId();
    const salt = randomBytes(16);
    const key = pbkdf2Sync(machineId, salt, this.ITERATIONS, 32, 'sha256');
    const iv = randomBytes(16);
    
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    // Prepend salt and iv to the encrypted data
    return Buffer.concat([salt, iv, encrypted]);
  }

  /**
   * Decrypt data using machine-specific key
   */
  private async decryptWithMachineKey(encryptedData: Buffer): Promise<string> {
    const machineId = await this.getMachineId();
    
    // Extract salt, iv, and encrypted content
    const salt = encryptedData.subarray(0, 16);
    const iv = encryptedData.subarray(16, 32);
    const encrypted = encryptedData.subarray(32);
    
    const key = pbkdf2Sync(machineId, salt, this.ITERATIONS, 32, 'sha256');
    
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Get machine-specific identifier for encryption
   */
  private async getMachineId(): Promise<string> {
    // Combine multiple factors to create a machine-specific ID
    const factors = [
      app.getPath('userData'),
      process.platform,
      process.arch,
      app.getName(),
      app.getVersion()
    ];
    
    // Add OS-specific user info if available
    try {
      const os = await import('os');
      factors.push(os.hostname());
      factors.push(os.userInfo().username);
    } catch (error) {
      // Ignore if not available
    }
    
    return factors.join('|');
  }

  /**
   * Create metadata for keys
   */
  private createMetadata(): KeyMetadata {
    return {
      version: this.KEY_VERSION,
      createdAt: new Date(),
      lastRotated: new Date(),
      rotationCount: 0,
      platform: process.platform
    };
  }

  /**
   * Save metadata
   */
  private async saveMetadata(metadata: KeyMetadata): Promise<void> {
    try {
      if (process.platform === 'darwin' || process.platform === 'win32') {
        await keytar.setPassword(
          this.SERVICE_NAME,
          `${this.ACCOUNT_PREFIX}metadata`,
          JSON.stringify(metadata)
        );
      } else {
        // Use file for metadata on Linux
        if (!existsSync(this.fallbackDir)) {
          await fs.mkdir(this.fallbackDir, { recursive: true, mode: 0o700 });
        }
        await fs.writeFile(this.fallbackMetaFile, JSON.stringify(metadata, null, 2), { mode: 0o600 });
      }
    } catch (error) {
      log.warn('Failed to save metadata:', error);
    }
  }

  /**
   * Load metadata
   */
  private async loadMetadata(): Promise<KeyMetadata | null> {
    try {
      let metadataString: string | null = null;
      
      if (process.platform === 'darwin' || process.platform === 'win32') {
        metadataString = await keytar.getPassword(
          this.SERVICE_NAME,
          `${this.ACCOUNT_PREFIX}metadata`
        );
      } else if (existsSync(this.fallbackMetaFile)) {
        metadataString = await fs.readFile(this.fallbackMetaFile, 'utf8');
      }
      
      if (metadataString) {
        return JSON.parse(metadataString) as KeyMetadata;
      }
    } catch (error) {
      log.warn('Failed to load metadata:', error);
    }
    
    return null;
  }

  /**
   * Rotate encryption keys (for enhanced security)
   */
  public async rotateKeys(): Promise<boolean> {
    try {
      log.info('Starting key rotation...');
      
      // Generate new keys
      const newKeys = await this.generateKeys();
      
      // Save old keys for migration (optional)
      const oldKeys = this.keys;
      
      // Update keys
      await this.saveKeys(newKeys);
      this.keys = newKeys;
      
      // Update metadata
      if (this.metadata) {
        this.metadata.lastRotated = new Date();
        this.metadata.rotationCount++;
        await this.saveMetadata(this.metadata);
      }
      
      log.info('Key rotation completed successfully');
      
      // Emit event for services to re-encrypt data with new keys
      (process as any).emit('encryption-keys-rotated', { oldKeys, newKeys });
      
      return true;
    } catch (error) {
      log.error('Key rotation failed:', error);
      return false;
    }
  }

  /**
   * Export keys for backup (encrypted)
   */
  public async exportKeys(password: string): Promise<string> {
    if (!this.keys) {
      throw new Error('No keys to export');
    }
    
    const salt = randomBytes(16);
    const key = pbkdf2Sync(password, salt, this.ITERATIONS, 32, 'sha256');
    const iv = randomBytes(16);
    
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(this.keys), 'utf8'),
      cipher.final()
    ]);
    
    const exportData = {
      version: this.KEY_VERSION,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      metadata: this.metadata
    };
    
    return Buffer.from(JSON.stringify(exportData)).toString('base64');
  }

  /**
   * Import keys from backup
   */
  public async importKeys(exportedData: string, password: string): Promise<boolean> {
    try {
      const exportData = JSON.parse(Buffer.from(exportedData, 'base64').toString('utf8'));
      
      const salt = Buffer.from(exportData.salt, 'base64');
      const iv = Buffer.from(exportData.iv, 'base64');
      const encrypted = Buffer.from(exportData.data, 'base64');
      
      const key = pbkdf2Sync(password, salt, this.ITERATIONS, 32, 'sha256');
      
      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      const keys = JSON.parse(decrypted.toString('utf8')) as EncryptionKeys;
      
      // Save imported keys
      await this.saveKeys(keys);
      this.keys = keys;
      
      // Save metadata if provided
      if (exportData.metadata) {
        this.metadata = exportData.metadata;
        await this.saveMetadata(exportData.metadata);
      }
      
      log.info('Keys imported successfully');
      return true;
    } catch (error) {
      log.error('Failed to import keys:', error);
      return false;
    }
  }

  /**
   * Clear all stored keys (for security or reset purposes)
   */
  public async clearKeys(): Promise<void> {
    try {
      // Clear from keytar
      if (process.platform === 'darwin' || process.platform === 'win32') {
        const keyNames: (keyof EncryptionKeys)[] = [
          'oauthEncryptionKey',
          'databaseEncryptionKey',
          'sessionSecret',
          'masterKey'
        ];
        
        for (const keyName of keyNames) {
          await keytar.deletePassword(
            this.SERVICE_NAME,
            `${this.ACCOUNT_PREFIX}${keyName}`
          );
        }
        
        await keytar.deletePassword(
          this.SERVICE_NAME,
          `${this.ACCOUNT_PREFIX}metadata`
        );
      }
      
      // Clear fallback files
      if (existsSync(this.fallbackKeyFile)) {
        await fs.unlink(this.fallbackKeyFile);
      }
      if (existsSync(this.fallbackMetaFile)) {
        await fs.unlink(this.fallbackMetaFile);
      }
      
      this.keys = null;
      this.metadata = null;
      this.isInitialized = false;
      
      log.info('All encryption keys cleared');
    } catch (error) {
      log.error('Failed to clear keys:', error);
      throw error;
    }
  }

  /**
   * Get key age in days
   */
  public getKeyAge(): number {
    if (!this.metadata) {
      return 0;
    }
    
    const now = new Date();
    const created = new Date(this.metadata.lastRotated);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Check if keys need rotation (recommended every 90 days)
   */
  public needsRotation(maxAgeDays: number = 90): boolean {
    return this.getKeyAge() > maxAgeDays;
  }
}

// Export singleton instance
export const encryptionKeyManager = EncryptionKeyManager.getInstance();
export default encryptionKeyManager;