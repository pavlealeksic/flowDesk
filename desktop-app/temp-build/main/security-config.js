"use strict";
/**
 * Security Configuration for Production
 *
 * Centralized security settings and validation for production deployment
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityConfig = exports.SecurityConfig = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const electron_1 = require("electron");
const crypto_1 = __importDefault(require("crypto"));
// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
/**
 * Security configuration with production-safe defaults
 */
class SecurityConfig {
    constructor() {
        this.encryptionKey = null;
        this.initialized = false;
    }
    static getInstance() {
        if (!SecurityConfig.instance) {
            SecurityConfig.instance = new SecurityConfig();
        }
        return SecurityConfig.instance;
    }
    /**
     * Initialize security configuration
     */
    async initialize() {
        if (this.initialized)
            return;
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
            electron_log_1.default.info('Security configuration initialized successfully');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize security configuration:', error);
            throw new Error('Security initialization failed');
        }
    }
    /**
     * Validate environment configuration
     */
    validateEnvironment() {
        const requiredEnvVars = [
            'NODE_ENV'
        ];
        const missing = requiredEnvVars.filter(key => !process.env[key]);
        if (missing.length > 0 && isProduction) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        // Validate NODE_ENV
        if (!['development', 'production', 'test'].includes(process.env.NODE_ENV || '')) {
            electron_log_1.default.warn('Invalid NODE_ENV, defaulting to production');
            process.env.NODE_ENV = 'production';
        }
    }
    /**
     * Set up encryption key from environment or generate a secure one
     */
    async setupEncryptionKey() {
        if (process.env.ENCRYPTION_KEY) {
            // Validate provided key
            const key = process.env.ENCRYPTION_KEY;
            if (key.length < 32) {
                throw new Error('Encryption key must be at least 32 characters');
            }
            this.encryptionKey = key;
        }
        else if (isProduction) {
            // In production, require an encryption key
            throw new Error('ENCRYPTION_KEY environment variable is required in production');
        }
        else {
            // Development mode - generate a temporary key
            this.encryptionKey = crypto_1.default.randomBytes(32).toString('hex');
            electron_log_1.default.warn('Using temporary encryption key for development');
        }
    }
    /**
     * Configure logging for production
     */
    configureLogging() {
        // Disable console logging in production
        if (isProduction) {
            electron_log_1.default.transports.console.level = false;
            electron_log_1.default.transports.file.level = 'warn';
            // Set log file location
            electron_log_1.default.transports.file.resolvePath = () => {
                return electron_1.app.getPath('logs') + '/flow-desk.log';
            };
            // Limit log file size
            electron_log_1.default.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
        }
        else {
            electron_log_1.default.transports.console.level = 'debug';
            electron_log_1.default.transports.file.level = 'debug';
        }
        // Never log sensitive data
        electron_log_1.default.hooks.push((message, transport) => {
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
    setSecurityHeaders() {
        // This would be implemented with electron's session.setPermissionRequestHandler
        // and webRequest.onHeadersReceived to add security headers
    }
    /**
     * Get encryption key (throws if not initialized)
     */
    getEncryptionKey() {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not initialized');
        }
        return this.encryptionKey;
    }
    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(this.getEncryptionKey().substring(0, 32));
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText) {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(this.getEncryptionKey().substring(0, 32));
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto_1.default.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Validate OAuth configuration
     */
    validateOAuthConfig(provider, config) {
        if (!config.clientId || !config.clientSecret) {
            electron_log_1.default.error(`Invalid OAuth config for ${provider}: missing credentials`);
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
                    electron_log_1.default.error(`Invalid OAuth config for ${provider}: contains placeholder values`);
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Sanitize user input
     */
    sanitizeInput(input) {
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
    isSecureContext() {
        return isProduction && this.initialized;
    }
    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            initialized: this.initialized,
            environment: process.env.NODE_ENV || 'unknown',
            encryptionEnabled: !!this.encryptionKey,
            loggingConfigured: true
        };
    }
}
exports.SecurityConfig = SecurityConfig;
// Export singleton instance
exports.securityConfig = SecurityConfig.getInstance();
