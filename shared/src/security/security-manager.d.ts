/**
 * Security Manager - Comprehensive security hardening and threat protection
 * Handles authentication, authorization, encryption, CSP, XSS protection, and security monitoring
 */
export interface SecurityConfig {
    encryption: {
        enabled: boolean;
        algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
        keyDerivation: 'pbkdf2' | 'argon2' | 'scrypt';
        keyRotationInterval: number;
    };
    authentication: {
        sessionTimeout: number;
        maxLoginAttempts: number;
        lockoutDuration: number;
        requireMFA: boolean;
        passwordMinLength: number;
        passwordRequireSpecialChars: boolean;
        biometricEnabled: boolean;
    };
    authorization: {
        rbacEnabled: boolean;
        defaultRole: string;
        permissionCaching: boolean;
        auditLogging: boolean;
    };
    contentSecurity: {
        enableCSP: boolean;
        cspDirectives: CSPDirectives;
        enableXSSProtection: boolean;
        enableClickjacking: boolean;
        enableMIMESniffing: boolean;
    };
    networkSecurity: {
        enableHTTPS: boolean;
        enableHSTS: boolean;
        enableCORS: boolean;
        allowedOrigins: string[];
        rateLimiting: RateLimitConfig;
    };
    dataProtection: {
        enableFieldEncryption: boolean;
        sensitiveFields: string[];
        dataRetention: number;
        anonymization: boolean;
        rightToErasure: boolean;
    };
    monitoring: {
        enableThreatDetection: boolean;
        suspiciousActivityThreshold: number;
        enableSecurityAudit: boolean;
        logRetention: number;
    };
}
export interface CSPDirectives {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    frameSrc: string[];
    workerSrc: string[];
    manifestSrc: string[];
}
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
}
export interface SecurityEvent {
    id: string;
    type: SecurityEventType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: number;
    userId?: string;
    ip?: string;
    userAgent?: string;
    details: any;
    resolved: boolean;
    actions: SecurityAction[];
}
export type SecurityEventType = 'login_attempt' | 'login_failure' | 'session_hijack' | 'xss_attempt' | 'csrf_attempt' | 'sql_injection' | 'brute_force' | 'suspicious_activity' | 'data_breach' | 'unauthorized_access' | 'rate_limit_exceeded' | 'malicious_payload';
export interface SecurityAction {
    type: 'block_ip' | 'logout_user' | 'require_mfa' | 'alert_admin' | 'quarantine_data';
    timestamp: number;
    details: any;
}
export interface EncryptionKey {
    id: string;
    key: Buffer;
    algorithm: string;
    createdAt: number;
    expiresAt: number;
    active: boolean;
}
export interface UserSession {
    id: string;
    userId: string;
    deviceId: string;
    ip: string;
    userAgent: string;
    createdAt: number;
    lastActivity: number;
    expiresAt: number;
    mfaVerified: boolean;
    permissions: string[];
    securityLevel: 'standard' | 'elevated' | 'admin';
}
export interface SecurityAuditLog {
    id: string;
    timestamp: number;
    userId?: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'blocked';
    details: any;
    ip?: string;
    userAgent?: string;
}
export declare class SecurityManager {
    private static instance;
    private config;
    private encryptionKeys;
    private activeSessions;
    private securityEvents;
    private auditLogs;
    private rateLimitStore;
    private blockedIPs;
    private failedLoginAttempts;
    constructor(config: SecurityConfig);
    static getInstance(config?: SecurityConfig): SecurityManager;
    /**
     * Initialize security manager
     */
    initialize(): Promise<void>;
    /**
     * Authenticate user with comprehensive security checks
     */
    authenticateUser(credentials: {
        username: string;
        password: string;
        mfaToken?: string;
        deviceId: string;
        ip: string;
        userAgent: string;
    }): Promise<{
        success: boolean;
        sessionId?: string;
        requireMFA?: boolean;
        error?: string;
    }>;
    /**
     * Validate session and check for security threats
     */
    validateSession(sessionId: string, ip: string, userAgent: string): Promise<{
        valid: boolean;
        session?: UserSession;
        requireReauth?: boolean;
    }>;
    /**
     * Encrypt sensitive data
     */
    encryptData(data: string, keyId?: string): Promise<{
        encrypted: string;
        keyId: string;
        iv: string;
        authTag: string;
    }>;
    /**
     * Decrypt sensitive data
     */
    decryptData(encryptedData: {
        encrypted: string;
        keyId: string;
        iv: string;
        authTag: string;
    }): Promise<string>;
    /**
     * Sanitize input to prevent XSS attacks
     */
    sanitizeInput(input: string, allowHTML?: boolean): string;
    /**
     * Validate CSRF token
     */
    validateCSRFToken(token: string, sessionId: string): boolean;
    /**
     * Generate CSRF token for session
     */
    generateCSRFToken(sessionId: string): string;
    /**
     * Check if user has permission
     */
    checkPermission(sessionId: string, permission: string): Promise<boolean>;
    /**
     * Audit log entry
     */
    auditLog(action: string, resource: string, result: 'success' | 'failure' | 'blocked', details?: any, sessionId?: string): void;
    /**
     * Detect suspicious activity patterns
     */
    detectSuspiciousActivity(userId: string, activity: any): boolean;
    /**
     * Get security dashboard data
     */
    getSecurityDashboard(): {
        activeSessions: number;
        recentEvents: SecurityEvent[];
        auditLogs: SecurityAuditLog[];
        threatLevel: 'low' | 'medium' | 'high' | 'critical';
        blockedIPs: number;
    };
    private initializeEncryption;
    private generateEncryptionKeys;
    private startKeyRotation;
    private getActiveEncryptionKey;
    private setupSecurityHeaders;
    private setupCSP;
    private generateCSPHeader;
    private initializeThreatDetection;
    private startSecurityMonitoring;
    private cleanupExpiredSessions;
    private analyzeSecurityEvents;
    private identifySuspiciousIPs;
    private updateThreatLevel;
    private createUserSession;
    private checkRateLimit;
    private recordFailedLogin;
    private logSecurityEvent;
    private handleCriticalSecurityEvent;
    private verifyCredentials;
    private verifyMFA;
    private generateId;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
export declare const createSecurityManager: (config: SecurityConfig) => SecurityManager;
export declare const getSecurityManager: () => SecurityManager;
export declare const withSecurity: <T extends (...args: any[]) => any>(fn: T, requiredPermission?: string) => (...args: any[]) => Promise<any>;
//# sourceMappingURL=security-manager.d.ts.map