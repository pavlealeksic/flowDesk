"use strict";
/**
 * Security Manager - Comprehensive security hardening and threat protection
 * Handles authentication, authorization, encryption, CSP, XSS protection, and security monitoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withSecurity = exports.getSecurityManager = exports.createSecurityManager = exports.SecurityManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
class SecurityManager {
    constructor(config) {
        this.encryptionKeys = new Map();
        this.activeSessions = new Map();
        this.securityEvents = [];
        this.auditLogs = [];
        this.rateLimitStore = new Map();
        this.blockedIPs = new Set();
        this.failedLoginAttempts = new Map();
        this.config = config;
        this.initializeEncryption();
        this.setupSecurityHeaders();
        this.startSecurityMonitoring();
    }
    static getInstance(config) {
        if (!SecurityManager.instance && config) {
            SecurityManager.instance = new SecurityManager(config);
        }
        else if (!SecurityManager.instance) {
            throw new Error('SecurityManager must be initialized with config first');
        }
        return SecurityManager.instance;
    }
    /**
     * Initialize security manager
     */
    async initialize() {
        // Generate initial encryption keys
        await this.generateEncryptionKeys();
        // Set up CSP if enabled
        if (this.config.contentSecurity.enableCSP) {
            this.setupCSP();
        }
        // Initialize threat detection
        if (this.config.monitoring.enableThreatDetection) {
            this.initializeThreatDetection();
        }
        console.log('SecurityManager initialized');
    }
    /**
     * Authenticate user with comprehensive security checks
     */
    async authenticateUser(credentials) {
        const { username, password, mfaToken, deviceId, ip, userAgent } = credentials;
        // Check if IP is blocked
        if (this.blockedIPs.has(ip)) {
            this.logSecurityEvent('login_attempt', 'high', {
                username,
                ip,
                userAgent,
                reason: 'blocked_ip'
            });
            return { success: false, error: 'Access denied' };
        }
        // Check rate limiting
        if (!this.checkRateLimit(ip)) {
            this.logSecurityEvent('rate_limit_exceeded', 'medium', {
                username,
                ip,
                userAgent
            });
            return { success: false, error: 'Too many requests' };
        }
        // Check failed login attempts
        const failedAttempts = this.failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
        if (failedAttempts.count >= this.config.authentication.maxLoginAttempts) {
            const lockoutTime = this.config.authentication.lockoutDuration * 60 * 1000;
            if (Date.now() - failedAttempts.lastAttempt < lockoutTime) {
                this.logSecurityEvent('brute_force', 'high', {
                    username,
                    ip,
                    userAgent,
                    attempts: failedAttempts.count
                });
                return { success: false, error: 'Account locked due to too many failed attempts' };
            }
        }
        try {
            // Verify credentials (this would integrate with your user store)
            const user = await this.verifyCredentials(username, password);
            if (!user) {
                this.recordFailedLogin(ip);
                this.logSecurityEvent('login_failure', 'medium', {
                    username,
                    ip,
                    userAgent,
                    reason: 'invalid_credentials'
                });
                return { success: false, error: 'Invalid credentials' };
            }
            // Check if MFA is required
            if (this.config.authentication.requireMFA && !mfaToken) {
                return { success: false, requireMFA: true };
            }
            // Verify MFA if provided
            if (mfaToken) {
                const mfaValid = await this.verifyMFA(user.id, mfaToken);
                if (!mfaValid) {
                    this.recordFailedLogin(ip);
                    this.logSecurityEvent('login_failure', 'medium', {
                        username,
                        ip,
                        userAgent,
                        reason: 'invalid_mfa'
                    });
                    return { success: false, error: 'Invalid MFA token' };
                }
            }
            // Create session
            const session = this.createUserSession({
                userId: user.id,
                deviceId,
                ip,
                userAgent,
                mfaVerified: !!mfaToken,
                permissions: user.permissions || [],
                securityLevel: user.role === 'admin' ? 'admin' : 'standard'
            });
            // Clear failed attempts
            this.failedLoginAttempts.delete(ip);
            this.logSecurityEvent('login_attempt', 'low', {
                username,
                ip,
                userAgent,
                success: true,
                sessionId: session.id
            });
            return { success: true, sessionId: session.id };
        }
        catch (error) {
            this.recordFailedLogin(ip);
            this.logSecurityEvent('login_failure', 'high', {
                username,
                ip,
                userAgent,
                error: error.message
            });
            return { success: false, error: 'Authentication failed' };
        }
    }
    /**
     * Validate session and check for security threats
     */
    async validateSession(sessionId, ip, userAgent) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { valid: false };
        }
        // Check if session expired
        if (Date.now() > session.expiresAt) {
            this.activeSessions.delete(sessionId);
            return { valid: false };
        }
        // Check for session hijacking
        if (session.ip !== ip || session.userAgent !== userAgent) {
            this.logSecurityEvent('session_hijack', 'critical', {
                sessionId,
                originalIP: session.ip,
                currentIP: ip,
                originalUA: session.userAgent,
                currentUA: userAgent
            });
            // Invalidate session
            this.activeSessions.delete(sessionId);
            return { valid: false };
        }
        // Check session timeout
        const sessionTimeout = this.config.authentication.sessionTimeout * 60 * 1000;
        if (Date.now() - session.lastActivity > sessionTimeout) {
            this.activeSessions.delete(sessionId);
            return { valid: false, requireReauth: true };
        }
        // Update last activity
        session.lastActivity = Date.now();
        return { valid: true, session };
    }
    /**
     * Encrypt sensitive data
     */
    async encryptData(data, keyId) {
        if (!this.config.encryption.enabled) {
            throw new Error('Encryption is not enabled');
        }
        const key = keyId ? this.encryptionKeys.get(keyId) : this.getActiveEncryptionKey();
        if (!key) {
            throw new Error('Encryption key not found');
        }
        const iv = crypto_1.default.randomBytes(12); // 12 bytes for GCM
        const cipher = crypto_1.default.createCipheriv(key.algorithm, key.key, iv);
        cipher.setAAD(Buffer.from(keyId || key.id, 'utf8'));
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return {
            encrypted,
            keyId: key.id,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    /**
     * Decrypt sensitive data
     */
    async decryptData(encryptedData) {
        if (!this.config.encryption.enabled) {
            throw new Error('Encryption is not enabled');
        }
        const key = this.encryptionKeys.get(encryptedData.keyId);
        if (!key) {
            throw new Error('Decryption key not found');
        }
        const decipher = crypto_1.default.createDecipheriv(key.algorithm, key.key, Buffer.from(encryptedData.iv, 'hex'));
        decipher.setAAD(Buffer.from(encryptedData.keyId, 'utf8'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Sanitize input to prevent XSS attacks
     */
    sanitizeInput(input, allowHTML = false) {
        if (!this.config.contentSecurity.enableXSSProtection) {
            return input;
        }
        if (allowHTML) {
            // Allow safe HTML tags only
            return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        else {
            // Escape all HTML
            return input
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        }
    }
    /**
     * Validate CSRF token
     */
    validateCSRFToken(token, sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return false;
        }
        // Generate expected CSRF token
        const expectedToken = this.generateCSRFToken(sessionId);
        // Use constant-time comparison to prevent timing attacks
        return crypto_1.default.timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(expectedToken, 'utf8'));
    }
    /**
     * Generate CSRF token for session
     */
    generateCSRFToken(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        const payload = `${sessionId}:${session.userId}:${session.createdAt}`;
        return crypto_1.default.createHmac('sha256', this.getActiveEncryptionKey()?.key || Buffer.alloc(32))
            .update(payload)
            .digest('hex');
    }
    /**
     * Check if user has permission
     */
    async checkPermission(sessionId, permission) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return false;
        }
        // Admin has all permissions
        if (session.securityLevel === 'admin') {
            return true;
        }
        return session.permissions.includes(permission);
    }
    /**
     * Audit log entry
     */
    auditLog(action, resource, result, details, sessionId) {
        if (!this.config.authorization.auditLogging) {
            return;
        }
        const session = sessionId ? this.activeSessions.get(sessionId) : null;
        const logEntry = {
            id: this.generateId(),
            timestamp: Date.now(),
            userId: session?.userId,
            action,
            resource,
            result,
            details,
            ip: session?.ip,
            userAgent: session?.userAgent
        };
        this.auditLogs.push(logEntry);
        // Trim logs to prevent memory issues
        if (this.auditLogs.length > 10000) {
            this.auditLogs = this.auditLogs.slice(-5000);
        }
    }
    /**
     * Detect suspicious activity patterns
     */
    detectSuspiciousActivity(userId, activity) {
        if (!this.config.monitoring.enableThreatDetection) {
            return false;
        }
        // Check for unusual patterns
        const recentEvents = this.securityEvents
            .filter(event => event.userId === userId && Date.now() - event.timestamp < 3600000) // Last hour
            .slice(-20);
        // Multiple failed logins
        const failedLogins = recentEvents.filter(event => event.type === 'login_failure').length;
        if (failedLogins > this.config.monitoring.suspiciousActivityThreshold) {
            return true;
        }
        // Rapid-fire requests
        const rapidRequests = recentEvents.filter(event => Date.now() - event.timestamp < 60000 // Last minute
        ).length;
        if (rapidRequests > 50) {
            return true;
        }
        // Geographic anomalies (would need IP geolocation)
        // Time-based anomalies (unusual activity hours)
        // Device anomalies (new device without proper verification)
        return false;
    }
    /**
     * Get security dashboard data
     */
    getSecurityDashboard() {
        const recentEvents = this.securityEvents.slice(-100);
        const criticalEvents = recentEvents.filter(event => event.severity === 'critical').length;
        const highEvents = recentEvents.filter(event => event.severity === 'high').length;
        let threatLevel = 'low';
        if (criticalEvents > 0)
            threatLevel = 'critical';
        else if (highEvents > 3)
            threatLevel = 'high';
        else if (highEvents > 0)
            threatLevel = 'medium';
        return {
            activeSessions: this.activeSessions.size,
            recentEvents,
            auditLogs: this.auditLogs.slice(-100),
            threatLevel,
            blockedIPs: this.blockedIPs.size
        };
    }
    // Private methods
    async initializeEncryption() {
        if (this.config.encryption.enabled) {
            await this.generateEncryptionKeys();
            this.startKeyRotation();
        }
    }
    async generateEncryptionKeys() {
        const keyId = this.generateId();
        const key = crypto_1.default.randomBytes(32); // 256-bit key
        const encryptionKey = {
            id: keyId,
            key,
            algorithm: this.config.encryption.algorithm,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.config.encryption.keyRotationInterval * 24 * 60 * 60 * 1000),
            active: true
        };
        // Deactivate old keys
        for (const existingKey of this.encryptionKeys.values()) {
            existingKey.active = false;
        }
        this.encryptionKeys.set(keyId, encryptionKey);
    }
    startKeyRotation() {
        const rotationInterval = this.config.encryption.keyRotationInterval * 24 * 60 * 60 * 1000;
        setInterval(async () => {
            await this.generateEncryptionKeys();
            console.log('Encryption keys rotated');
        }, rotationInterval);
    }
    getActiveEncryptionKey() {
        for (const key of this.encryptionKeys.values()) {
            if (key.active && Date.now() < key.expiresAt) {
                return key;
            }
        }
        return null;
    }
    setupSecurityHeaders() {
        if (typeof document !== 'undefined') {
            // Set security meta tags
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            meta.content = this.generateCSPHeader();
            document.head.appendChild(meta);
        }
    }
    setupCSP() {
        const csp = this.generateCSPHeader();
        // For server environments, set headers
        if (typeof global !== 'undefined' && global.process) {
            // Would integrate with your server framework to set headers
            console.log('CSP Header:', csp);
        }
    }
    generateCSPHeader() {
        const directives = this.config.contentSecurity.cspDirectives;
        const cspParts = [];
        for (const [key, values] of Object.entries(directives)) {
            const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            cspParts.push(`${directive} ${values.join(' ')}`);
        }
        return cspParts.join('; ');
    }
    initializeThreatDetection() {
        // Set up anomaly detection algorithms
        // Monitor patterns and behaviors
        // Integrate with security intelligence feeds
    }
    startSecurityMonitoring() {
        setInterval(() => {
            this.cleanupExpiredSessions();
            this.analyzeSecurityEvents();
            this.updateThreatLevel();
        }, 60000); // Every minute
    }
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt) {
                this.activeSessions.delete(sessionId);
            }
        }
    }
    analyzeSecurityEvents() {
        const recentEvents = this.securityEvents.filter(event => Date.now() - event.timestamp < 3600000 // Last hour
        );
        // Analyze patterns and generate alerts
        const suspiciousIPs = this.identifySuspiciousIPs(recentEvents);
        for (const ip of suspiciousIPs) {
            this.blockedIPs.add(ip);
            this.logSecurityEvent('suspicious_activity', 'high', {
                ip,
                reason: 'multiple_security_events'
            });
        }
    }
    identifySuspiciousIPs(events) {
        const ipCounts = new Map();
        for (const event of events) {
            if (event.ip && event.severity !== 'low') {
                ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1);
            }
        }
        return Array.from(ipCounts.entries())
            .filter(([, count]) => count >= 5)
            .map(([ip]) => ip);
    }
    updateThreatLevel() {
        // Calculate current threat level based on recent events
        // Update security policies accordingly
    }
    createUserSession(sessionData) {
        const sessionId = this.generateId();
        const sessionTimeout = this.config.authentication.sessionTimeout * 60 * 1000;
        const session = {
            id: sessionId,
            ...sessionData,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + sessionTimeout
        };
        this.activeSessions.set(sessionId, session);
        return session;
    }
    checkRateLimit(identifier) {
        const now = Date.now();
        const limit = this.rateLimitStore.get(identifier);
        if (!limit || now > limit.resetTime) {
            this.rateLimitStore.set(identifier, {
                count: 1,
                resetTime: now + this.config.networkSecurity.rateLimiting.windowMs
            });
            return true;
        }
        if (limit.count >= this.config.networkSecurity.rateLimiting.maxRequests) {
            return false;
        }
        limit.count++;
        return true;
    }
    recordFailedLogin(ip) {
        const attempts = this.failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.failedLoginAttempts.set(ip, attempts);
    }
    logSecurityEvent(type, severity, details) {
        const event = {
            id: this.generateId(),
            type,
            severity,
            timestamp: Date.now(),
            userId: details.userId,
            ip: details.ip,
            userAgent: details.userAgent,
            details,
            resolved: false,
            actions: []
        };
        this.securityEvents.push(event);
        // Trim events to prevent memory issues
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-500);
        }
        // Trigger automatic responses for critical events
        if (severity === 'critical') {
            this.handleCriticalSecurityEvent(event);
        }
    }
    handleCriticalSecurityEvent(event) {
        const actions = [];
        switch (event.type) {
            case 'session_hijack':
                // Immediately invalidate session
                if (event.details.sessionId) {
                    this.activeSessions.delete(event.details.sessionId);
                }
                actions.push({
                    type: 'logout_user',
                    timestamp: Date.now(),
                    details: { sessionId: event.details.sessionId }
                });
                break;
            case 'brute_force':
                // Block IP address
                if (event.ip) {
                    this.blockedIPs.add(event.ip);
                    actions.push({
                        type: 'block_ip',
                        timestamp: Date.now(),
                        details: { ip: event.ip }
                    });
                }
                break;
        }
        event.actions = actions;
    }
    async verifyCredentials(username, password) {
        // This would integrate with your user authentication system
        // For now, this is a placeholder
        return null;
    }
    async verifyMFA(userId, token) {
        // This would integrate with your MFA system (TOTP, SMS, etc.)
        // For now, this is a placeholder
        return false;
    }
    generateId() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    /**
     * Cleanup resources
     */
    dispose() {
        this.activeSessions.clear();
        this.securityEvents = [];
        this.auditLogs = [];
        this.rateLimitStore.clear();
        this.blockedIPs.clear();
        this.failedLoginAttempts.clear();
        this.encryptionKeys.clear();
    }
}
exports.SecurityManager = SecurityManager;
SecurityManager.instance = null;
// Helper functions
const createSecurityManager = (config) => {
    return new SecurityManager(config);
};
exports.createSecurityManager = createSecurityManager;
const getSecurityManager = () => {
    return SecurityManager.getInstance();
};
exports.getSecurityManager = getSecurityManager;
const withSecurity = (fn, requiredPermission) => {
    return async (...args) => {
        const securityManager = SecurityManager.getInstance();
        const sessionId = args[0]?.sessionId; // Assume first arg contains sessionId
        if (requiredPermission && sessionId) {
            const hasPermission = await securityManager.checkPermission(sessionId, requiredPermission);
            if (!hasPermission) {
                throw new Error('Insufficient permissions');
            }
        }
        return await fn(...args);
    };
};
exports.withSecurity = withSecurity;
//# sourceMappingURL=security-manager.js.map