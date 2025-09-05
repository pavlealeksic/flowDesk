"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionKeyManager = exports.EncryptionKeyManager = void 0;
const electron_1 = require("electron");
const crypto_1 = require("crypto");
const path_1 = require("path");
const fs_1 = require("fs");
const electron_log_1 = __importDefault(require("electron-log"));
const keytar = __importStar(require("keytar"));
/**
 * Cross-platform encryption key manager
 * Handles automatic key generation, storage, retrieval, and rotation
 */
class EncryptionKeyManager {
    constructor() {
        this.SERVICE_NAME = 'FlowDeskEncryption';
        this.ACCOUNT_PREFIX = 'flowdesk_';
        this.KEY_VERSION = 1;
        this.KEY_LENGTH = 32; // 256 bits
        this.ITERATIONS = 100000;
        this.keys = null;
        this.metadata = null;
        this.isInitialized = false;
        // Fallback file paths for Linux when Secret Service is unavailable
        this.fallbackDir = (0, path_1.join)(electron_1.app.getPath('userData'), '.encryption');
        this.fallbackKeyFile = (0, path_1.join)(this.fallbackDir, 'keys.enc');
        this.fallbackMetaFile = (0, path_1.join)(this.fallbackDir, 'meta.json');
        electron_log_1.default.info('Encryption Key Manager initialized for platform:', process.platform);
    }
    static getInstance() {
        if (!EncryptionKeyManager.instance) {
            EncryptionKeyManager.instance = new EncryptionKeyManager();
        }
        return EncryptionKeyManager.instance;
    }
    /**
     * Initialize the key manager and ensure all keys are available
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }
        try {
            electron_log_1.default.info('Initializing encryption key management...');
            // Check if keys exist
            const existingKeys = await this.loadKeys();
            if (existingKeys) {
                this.keys = existingKeys;
                electron_log_1.default.info('Loaded existing encryption keys');
            }
            else {
                // Generate new keys on first run
                electron_log_1.default.info('First run detected, generating new encryption keys...');
                this.keys = await this.generateKeys();
                await this.saveKeys(this.keys);
                electron_log_1.default.info('New encryption keys generated and stored securely');
            }
            // Load or create metadata
            this.metadata = await this.loadMetadata() || this.createMetadata();
            await this.saveMetadata(this.metadata);
            this.isInitialized = true;
            electron_log_1.default.info('Encryption key manager initialized successfully');
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize encryption key manager:', error);
            return false;
        }
    }
    /**
     * Get encryption keys
     */
    async getKeys() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.keys;
    }
    /**
     * Get a specific key
     */
    async getKey(keyName) {
        const keys = await this.getKeys();
        return keys ? keys[keyName] : null;
    }
    /**
     * Generate new encryption keys
     */
    async generateKeys() {
        return {
            oauthEncryptionKey: (0, crypto_1.randomBytes)(this.KEY_LENGTH).toString('hex'),
            databaseEncryptionKey: (0, crypto_1.randomBytes)(this.KEY_LENGTH).toString('hex'),
            sessionSecret: (0, crypto_1.randomBytes)(this.KEY_LENGTH).toString('hex'),
            masterKey: (0, crypto_1.randomBytes)(this.KEY_LENGTH).toString('hex')
        };
    }
    /**
     * Save keys to platform-specific secure storage
     */
    async saveKeys(keys) {
        const platform = process.platform;
        try {
            if (platform === 'darwin' || platform === 'win32') {
                // Use keytar for macOS Keychain and Windows Credential Manager
                await this.saveKeysWithKeytar(keys);
            }
            else if (platform === 'linux') {
                // Try keytar first (Secret Service), fall back to encrypted file
                try {
                    await this.saveKeysWithKeytar(keys);
                }
                catch (error) {
                    electron_log_1.default.warn('Secret Service unavailable, using encrypted file fallback');
                    await this.saveKeysWithFallback(keys);
                }
            }
            else {
                // Unknown platform, use encrypted file fallback
                await this.saveKeysWithFallback(keys);
            }
        }
        catch (error) {
            electron_log_1.default.error('Failed to save encryption keys:', error);
            throw new Error('Unable to securely store encryption keys');
        }
    }
    /**
     * Load keys from platform-specific secure storage
     */
    async loadKeys() {
        const platform = process.platform;
        try {
            if (platform === 'darwin' || platform === 'win32') {
                // Use keytar for macOS Keychain and Windows Credential Manager
                return await this.loadKeysWithKeytar();
            }
            else if (platform === 'linux') {
                // Try keytar first (Secret Service), fall back to encrypted file
                try {
                    const keys = await this.loadKeysWithKeytar();
                    if (keys)
                        return keys;
                }
                catch (error) {
                    electron_log_1.default.debug('Secret Service unavailable, trying encrypted file fallback');
                }
                return await this.loadKeysWithFallback();
            }
            else {
                // Unknown platform, use encrypted file fallback
                return await this.loadKeysWithFallback();
            }
        }
        catch (error) {
            electron_log_1.default.error('Failed to load encryption keys:', error);
            return null;
        }
    }
    /**
     * Save keys using keytar (macOS Keychain, Windows Credential Manager, Linux Secret Service)
     */
    async saveKeysWithKeytar(keys) {
        const promises = [];
        for (const [keyName, keyValue] of Object.entries(keys)) {
            promises.push(keytar.setPassword(this.SERVICE_NAME, `${this.ACCOUNT_PREFIX}${keyName}`, keyValue));
        }
        await Promise.all(promises);
    }
    /**
     * Load keys using keytar
     */
    async loadKeysWithKeytar() {
        const keyNames = [
            'oauthEncryptionKey',
            'databaseEncryptionKey',
            'sessionSecret',
            'masterKey'
        ];
        const keys = {};
        for (const keyName of keyNames) {
            const value = await keytar.getPassword(this.SERVICE_NAME, `${this.ACCOUNT_PREFIX}${keyName}`);
            if (!value) {
                return null; // Keys not found or incomplete
            }
            keys[keyName] = value;
        }
        return keys;
    }
    /**
     * Save keys using encrypted file fallback (primarily for Linux without Secret Service)
     */
    async saveKeysWithFallback(keys) {
        // Ensure directory exists
        if (!(0, fs_1.existsSync)(this.fallbackDir)) {
            await fs_1.promises.mkdir(this.fallbackDir, { recursive: true, mode: 0o700 });
        }
        // Use Electron's safeStorage for additional protection
        if (electron_1.safeStorage.isEncryptionAvailable()) {
            const encryptedData = electron_1.safeStorage.encryptString(JSON.stringify(keys));
            await fs_1.promises.writeFile(this.fallbackKeyFile, encryptedData, { mode: 0o600 });
        }
        else {
            // Fall back to machine-specific encryption
            const encrypted = await this.encryptWithMachineKey(JSON.stringify(keys));
            await fs_1.promises.writeFile(this.fallbackKeyFile, encrypted, { mode: 0o600 });
        }
    }
    /**
     * Load keys using encrypted file fallback
     */
    async loadKeysWithFallback() {
        if (!(0, fs_1.existsSync)(this.fallbackKeyFile)) {
            return null;
        }
        try {
            const encryptedData = await fs_1.promises.readFile(this.fallbackKeyFile);
            let decryptedString;
            if (electron_1.safeStorage.isEncryptionAvailable()) {
                decryptedString = electron_1.safeStorage.decryptString(encryptedData);
            }
            else {
                decryptedString = await this.decryptWithMachineKey(encryptedData);
            }
            return JSON.parse(decryptedString);
        }
        catch (error) {
            electron_log_1.default.error('Failed to load keys from fallback:', error);
            return null;
        }
    }
    /**
     * Encrypt data using machine-specific key (fallback for when safeStorage is unavailable)
     */
    async encryptWithMachineKey(data) {
        const machineId = await this.getMachineId();
        const salt = (0, crypto_1.randomBytes)(16);
        const key = (0, crypto_1.pbkdf2Sync)(machineId, salt, this.ITERATIONS, 32, 'sha256');
        const iv = (0, crypto_1.randomBytes)(16);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
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
    async decryptWithMachineKey(encryptedData) {
        const machineId = await this.getMachineId();
        // Extract salt, iv, and encrypted content
        const salt = encryptedData.subarray(0, 16);
        const iv = encryptedData.subarray(16, 32);
        const encrypted = encryptedData.subarray(32);
        const key = (0, crypto_1.pbkdf2Sync)(machineId, salt, this.ITERATIONS, 32, 'sha256');
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
        return decrypted.toString('utf8');
    }
    /**
     * Get machine-specific identifier for encryption
     */
    async getMachineId() {
        // Combine multiple factors to create a machine-specific ID
        const factors = [
            electron_1.app.getPath('userData'),
            process.platform,
            process.arch,
            electron_1.app.getName(),
            electron_1.app.getVersion()
        ];
        // Add OS-specific user info if available
        try {
            const os = await Promise.resolve().then(() => __importStar(require('os')));
            factors.push(os.hostname());
            factors.push(os.userInfo().username);
        }
        catch (error) {
            // Ignore if not available
        }
        return factors.join('|');
    }
    /**
     * Create metadata for keys
     */
    createMetadata() {
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
    async saveMetadata(metadata) {
        try {
            if (process.platform === 'darwin' || process.platform === 'win32') {
                await keytar.setPassword(this.SERVICE_NAME, `${this.ACCOUNT_PREFIX}metadata`, JSON.stringify(metadata));
            }
            else {
                // Use file for metadata on Linux
                if (!(0, fs_1.existsSync)(this.fallbackDir)) {
                    await fs_1.promises.mkdir(this.fallbackDir, { recursive: true, mode: 0o700 });
                }
                await fs_1.promises.writeFile(this.fallbackMetaFile, JSON.stringify(metadata, null, 2), { mode: 0o600 });
            }
        }
        catch (error) {
            electron_log_1.default.warn('Failed to save metadata:', error);
        }
    }
    /**
     * Load metadata
     */
    async loadMetadata() {
        try {
            let metadataString = null;
            if (process.platform === 'darwin' || process.platform === 'win32') {
                metadataString = await keytar.getPassword(this.SERVICE_NAME, `${this.ACCOUNT_PREFIX}metadata`);
            }
            else if ((0, fs_1.existsSync)(this.fallbackMetaFile)) {
                metadataString = await fs_1.promises.readFile(this.fallbackMetaFile, 'utf8');
            }
            if (metadataString) {
                return JSON.parse(metadataString);
            }
        }
        catch (error) {
            electron_log_1.default.warn('Failed to load metadata:', error);
        }
        return null;
    }
    /**
     * Rotate encryption keys (for enhanced security)
     */
    async rotateKeys() {
        try {
            electron_log_1.default.info('Starting key rotation...');
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
            electron_log_1.default.info('Key rotation completed successfully');
            // Emit event for services to re-encrypt data with new keys
            process.emit('encryption-keys-rotated', { oldKeys, newKeys });
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Key rotation failed:', error);
            return false;
        }
    }
    /**
     * Export keys for backup (encrypted)
     */
    async exportKeys(password) {
        if (!this.keys) {
            throw new Error('No keys to export');
        }
        const salt = (0, crypto_1.randomBytes)(16);
        const key = (0, crypto_1.pbkdf2Sync)(password, salt, this.ITERATIONS, 32, 'sha256');
        const iv = (0, crypto_1.randomBytes)(16);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
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
    async importKeys(exportedData, password) {
        try {
            const exportData = JSON.parse(Buffer.from(exportedData, 'base64').toString('utf8'));
            const salt = Buffer.from(exportData.salt, 'base64');
            const iv = Buffer.from(exportData.iv, 'base64');
            const encrypted = Buffer.from(exportData.data, 'base64');
            const key = (0, crypto_1.pbkdf2Sync)(password, salt, this.ITERATIONS, 32, 'sha256');
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final()
            ]);
            const keys = JSON.parse(decrypted.toString('utf8'));
            // Save imported keys
            await this.saveKeys(keys);
            this.keys = keys;
            // Save metadata if provided
            if (exportData.metadata) {
                this.metadata = exportData.metadata;
                await this.saveMetadata(exportData.metadata);
            }
            electron_log_1.default.info('Keys imported successfully');
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Failed to import keys:', error);
            return false;
        }
    }
    /**
     * Clear all stored keys (for security or reset purposes)
     */
    async clearKeys() {
        try {
            // Clear from keytar
            if (process.platform === 'darwin' || process.platform === 'win32') {
                const keyNames = [
                    'oauthEncryptionKey',
                    'databaseEncryptionKey',
                    'sessionSecret',
                    'masterKey'
                ];
                for (const keyName of keyNames) {
                    await keytar.deletePassword(this.SERVICE_NAME, `${this.ACCOUNT_PREFIX}${keyName}`);
                }
                await keytar.deletePassword(this.SERVICE_NAME, `${this.ACCOUNT_PREFIX}metadata`);
            }
            // Clear fallback files
            if ((0, fs_1.existsSync)(this.fallbackKeyFile)) {
                await fs_1.promises.unlink(this.fallbackKeyFile);
            }
            if ((0, fs_1.existsSync)(this.fallbackMetaFile)) {
                await fs_1.promises.unlink(this.fallbackMetaFile);
            }
            this.keys = null;
            this.metadata = null;
            this.isInitialized = false;
            electron_log_1.default.info('All encryption keys cleared');
        }
        catch (error) {
            electron_log_1.default.error('Failed to clear keys:', error);
            throw error;
        }
    }
    /**
     * Get key age in days
     */
    getKeyAge() {
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
    needsRotation(maxAgeDays = 90) {
        return this.getKeyAge() > maxAgeDays;
    }
}
exports.EncryptionKeyManager = EncryptionKeyManager;
// Export singleton instance
exports.encryptionKeyManager = EncryptionKeyManager.getInstance();
exports.default = exports.encryptionKeyManager;
