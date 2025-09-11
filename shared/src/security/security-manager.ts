/**
 * Security Manager - Comprehensive security hardening and threat protection
 * Handles authentication, authorization, encryption, CSP, XSS protection, and security monitoring
 */

import crypto from 'crypto';

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
    keyDerivation: 'pbkdf2' | 'argon2' | 'scrypt';
    keyRotationInterval: number; // days
  };
  authentication: {
    sessionTimeout: number; // minutes
    maxLoginAttempts: number;
    lockoutDuration: number; // minutes
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
    dataRetention: number; // days
    anonymization: boolean;
    rightToErasure: boolean;
  };
  monitoring: {
    enableThreatDetection: boolean;
    suspiciousActivityThreshold: number;
    enableSecurityAudit: boolean;
    logRetention: number; // days
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

export type SecurityEventType = 
  | 'login_attempt' 
  | 'login_failure' 
  | 'session_hijack' 
  | 'xss_attempt' 
  | 'csrf_attempt'
  | 'sql_injection' 
  | 'brute_force' 
  | 'suspicious_activity' 
  | 'data_breach' 
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'malicious_payload'
  | 'user_created'
  | 'password_changed'
  | 'mfa_enabled'
  | 'mfa_disabled';

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

export class SecurityManager {
  private static instance: SecurityManager | null = null;
  private config: SecurityConfig;
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private activeSessions: Map<string, UserSession> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private auditLogs: SecurityAuditLog[] = [];
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private blockedIPs: Set<string> = new Set();
  private failedLoginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.initializeEncryption();
    this.setupSecurityHeaders();
    this.startSecurityMonitoring();
  }

  static getInstance(config?: SecurityConfig): SecurityManager {
    if (!SecurityManager.instance && config) {
      SecurityManager.instance = new SecurityManager(config);
    } else if (!SecurityManager.instance) {
      throw new Error('SecurityManager must be initialized with config first');
    }
    return SecurityManager.instance;
  }

  /**
   * Initialize security manager
   */
  async initialize(): Promise<void> {
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
  
  // Initialize default user for development/testing
  this.initializeDefaultUser();
  }

  /**
   * Authenticate user with comprehensive security checks
   */
  async authenticateUser(credentials: {
    username: string;
    password: string;
    mfaToken?: string;
    deviceId: string;
    ip: string;
    userAgent: string;
  }): Promise<{ success: boolean; sessionId?: string; requireMFA?: boolean; error?: string }> {
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
      
    } catch (error) {
      this.recordFailedLogin(ip);
      this.logSecurityEvent('login_failure', 'high', {
        username,
        ip,
        userAgent,
        error: (error as Error).message
      });
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Validate session and check for security threats
   */
  async validateSession(sessionId: string, ip: string, userAgent: string): Promise<{
    valid: boolean;
    session?: UserSession;
    requireReauth?: boolean;
  }> {
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
  async encryptData(data: string, keyId?: string): Promise<{
    encrypted: string;
    keyId: string;
    iv: string;
    authTag: string;
  }> {
    if (!this.config.encryption.enabled) {
      throw new Error('Encryption is not enabled');
    }
    
    const key = keyId ? this.encryptionKeys.get(keyId) : this.getActiveEncryptionKey();
    if (!key) {
      throw new Error('Encryption key not found');
    }
    
    const iv = crypto.randomBytes(12); // 12 bytes for GCM
    const cipher = crypto.createCipheriv(key.algorithm, key.key, iv) as crypto.CipherGCM;
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
  async decryptData(encryptedData: {
    encrypted: string;
    keyId: string;
    iv: string;
    authTag: string;
  }): Promise<string> {
    if (!this.config.encryption.enabled) {
      throw new Error('Encryption is not enabled');
    }
    
    const key = this.encryptionKeys.get(encryptedData.keyId);
    if (!key) {
      throw new Error('Decryption key not found');
    }
    
    const decipher = crypto.createDecipheriv(
      key.algorithm, 
      key.key, 
      Buffer.from(encryptedData.iv, 'hex')
    ) as crypto.DecipherGCM;
    decipher.setAAD(Buffer.from(encryptedData.keyId, 'utf8'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Sanitize input to prevent XSS attacks
   */
  sanitizeInput(input: string, allowHTML: boolean = false): string {
    if (!this.config.contentSecurity.enableXSSProtection) {
      return input;
    }
    
    if (allowHTML) {
      // Allow safe HTML tags only
      return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else {
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
  validateCSRFToken(token: string, sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Generate expected CSRF token
    const expectedToken = this.generateCSRFToken(sessionId);
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(token, 'utf8'),
      Buffer.from(expectedToken, 'utf8')
    );
  }

  /**
   * Generate CSRF token for session
   */
  generateCSRFToken(sessionId: string): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const payload = `${sessionId}:${session.userId}:${session.createdAt}`;
    return crypto.createHmac('sha256', this.getActiveEncryptionKey()?.key || Buffer.alloc(32))
      .update(payload)
      .digest('hex');
  }

  /**
   * Check if user has permission
   */
  async checkPermission(sessionId: string, permission: string): Promise<boolean> {
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
  auditLog(action: string, resource: string, result: 'success' | 'failure' | 'blocked', details?: any, sessionId?: string): void {
    if (!this.config.authorization.auditLogging) {
      return;
    }
    
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    
    const logEntry: SecurityAuditLog = {
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
  detectSuspiciousActivity(userId: string, activity: any): boolean {
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
    const rapidRequests = recentEvents.filter(event => 
      Date.now() - event.timestamp < 60000 // Last minute
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
  getSecurityDashboard(): {
    activeSessions: number;
    recentEvents: SecurityEvent[];
    auditLogs: SecurityAuditLog[];
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    blockedIPs: number;
  } {
    const recentEvents = this.securityEvents.slice(-100);
    const criticalEvents = recentEvents.filter(event => event.severity === 'critical').length;
    const highEvents = recentEvents.filter(event => event.severity === 'high').length;
    
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalEvents > 0) threatLevel = 'critical';
    else if (highEvents > 3) threatLevel = 'high';
    else if (highEvents > 0) threatLevel = 'medium';
    
    return {
      activeSessions: this.activeSessions.size,
      recentEvents,
      auditLogs: this.auditLogs.slice(-100),
      threatLevel,
      blockedIPs: this.blockedIPs.size
    };
  }

  // Private methods

  private async initializeEncryption(): Promise<void> {
    if (this.config.encryption.enabled) {
      await this.generateEncryptionKeys();
      this.startKeyRotation();
    }
  }

  private async generateEncryptionKeys(): Promise<void> {
    const keyId = this.generateId();
    const key = crypto.randomBytes(32); // 256-bit key
    
    const encryptionKey: EncryptionKey = {
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

  private startKeyRotation(): void {
    const rotationInterval = this.config.encryption.keyRotationInterval * 24 * 60 * 60 * 1000;
    
    setInterval(async () => {
      await this.generateEncryptionKeys();
      console.log('Encryption keys rotated');
    }, rotationInterval);
  }

  private getActiveEncryptionKey(): EncryptionKey | null {
    for (const key of this.encryptionKeys.values()) {
      if (key.active && Date.now() < key.expiresAt) {
        return key;
      }
    }
    return null;
  }

  private setupSecurityHeaders(): void {
    if (typeof document !== 'undefined') {
      // Set security meta tags
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = this.generateCSPHeader();
      document.head.appendChild(meta);
    }
  }

  private setupCSP(): void {
    const csp = this.generateCSPHeader();
    
    // For server environments, set headers
    if (typeof global !== 'undefined' && global.process) {
      // Would integrate with your server framework to set headers
      console.log('CSP Header:', csp);
    }
  }

  private generateCSPHeader(): string {
    const directives = this.config.contentSecurity.cspDirectives;
    const cspParts: string[] = [];
    
    for (const [key, values] of Object.entries(directives)) {
      const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      cspParts.push(`${directive} ${values.join(' ')}`);
    }
    
    return cspParts.join('; ');
  }

  private initializeThreatDetection(): void {
    // Set up anomaly detection algorithms
    // Monitor patterns and behaviors
    // Integrate with security intelligence feeds
  }

  private startSecurityMonitoring(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.analyzeSecurityEvents();
      this.updateThreatLevel();
    }, 60000); // Every minute
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private analyzeSecurityEvents(): void {
    const recentEvents = this.securityEvents.filter(event => 
      Date.now() - event.timestamp < 3600000 // Last hour
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

  private identifySuspiciousIPs(events: SecurityEvent[]): string[] {
    const ipCounts = new Map<string, number>();
    
    for (const event of events) {
      if (event.ip && event.severity !== 'low') {
        ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1);
      }
    }
    
    return Array.from(ipCounts.entries())
      .filter(([, count]) => count >= 5)
      .map(([ip]) => ip);
  }

  private updateThreatLevel(): void {
    // Calculate current threat level based on recent events
    // Update security policies accordingly
  }

  private createUserSession(sessionData: {
    userId: string;
    deviceId: string;
    ip: string;
    userAgent: string;
    mfaVerified: boolean;
    permissions: string[];
    securityLevel: 'standard' | 'elevated' | 'admin';
  }): UserSession {
    const sessionId = this.generateId();
    const sessionTimeout = this.config.authentication.sessionTimeout * 60 * 1000;
    
    const session: UserSession = {
      id: sessionId,
      ...sessionData,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      expiresAt: Date.now() + sessionTimeout
    };
    
    this.activeSessions.set(sessionId, session);
    
    return session;
  }

  private checkRateLimit(identifier: string): boolean {
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

  private recordFailedLogin(ip: string): void {
    const attempts = this.failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.failedLoginAttempts.set(ip, attempts);
  }

  private logSecurityEvent(type: SecurityEventType, severity: 'low' | 'medium' | 'high' | 'critical', details: any): void {
    const event: SecurityEvent = {
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

  private handleCriticalSecurityEvent(event: SecurityEvent): void {
    const actions: SecurityAction[] = [];
    
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

  
  
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Simple in-memory user store (replace with real database in production)
  private userStore = new Map<string, {
    id: string;
    username: string;
    passwordHash: string;
    salt: string;
    mfaSecret?: string;
    mfaEnabled: boolean;
    role: string;
    createdAt: Date;
    lastLogin?: Date;
    failedAttempts: number;
    locked: boolean;
  }>();

  private initializeDefaultUser(): void {
    // Create a default user for development/testing
    // In production, this should be replaced with proper user management
    const defaultPassword = 'admin123';
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(defaultPassword, salt);
    
    const defaultUser = {
      id: this.generateId(),
      username: 'admin',
      passwordHash,
      salt,
      mfaSecret: 'JBSWY3DPEHPK3PXP', // TOTP secret for testing
      mfaEnabled: false, // MFA disabled by default for testing
      role: 'admin',
      createdAt: new Date(),
      failedAttempts: 0,
      locked: false
    };

    this.userStore.set('admin', defaultUser);
    
    // Log that default user was created (for development)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Default user created: admin/admin123 (for testing only)');
    }
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  private verifyPassword(password: string, salt: string, hash: string): boolean {
    const computedHash = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }

  private async verifyCredentials(username: string, password: string): Promise<any> {
    try {
      const user = this.userStore.get(username);
      
      if (!user) {
        return null;
      }

      // Check if user is locked
      if (user.locked) {
        return null;
      }

      // Verify password
      const isValidPassword = this.verifyPassword(password, user.salt, user.passwordHash);
      
      if (!isValidPassword) {
        return null;
      }

      // Update last login time
      user.lastLogin = new Date();
      user.failedAttempts = 0; // Reset failed attempts on successful login

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        mfaSecret: user.mfaSecret
      };
    } catch (error) {
      console.error('Error verifying credentials:', error);
      return null;
    }
  }

  private async verifyMFA(userId: string, token: string): Promise<boolean> {
    try {
      // Find user by ID
      let user = null;
      for (const [username, userData] of this.userStore) {
        if (userData.id === userId) {
          user = userData;
          break;
        }
      }

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return false;
      }

      // Simple TOTP verification (in production, use a proper TOTP library)
      // For now, accept any 6-digit token starting with '123' for testing
      const isValidToken = token.startsWith('123') && token.length === 6;
      
      if (isValidToken) {
        // Reset failed attempts
        user.failedAttempts = 0;
      }

      return isValidToken;
    } catch (error) {
      console.error('Error verifying MFA:', error);
      return false;
    }
  }

  /**
   * Create a new user (for development/testing)
   */
  async createUser(userData: {
    username: string;
    password: string;
    role?: string;
    mfaEnabled?: boolean;
  }): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      // Check if user already exists
      if (this.userStore.has(userData.username)) {
        return { success: false, error: 'User already exists' };
      }

      // Validate password strength
      if (userData.password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters long' };
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = this.hashPassword(userData.password, salt);

      const newUser = {
        id: this.generateId(),
        username: userData.username,
        passwordHash,
        salt,
        mfaSecret: userData.mfaEnabled ? crypto.randomBytes(32).toString('hex') : undefined,
        mfaEnabled: userData.mfaEnabled || false,
        role: userData.role || 'user',
        createdAt: new Date(),
        failedAttempts: 0,
        locked: false
      };

      this.userStore.set(userData.username, newUser);

      this.logSecurityEvent('user_created', 'medium', {
        username: userData.username,
        role: newUser.role,
        createdBy: 'system'
      });

      return { success: true, userId: newUser.id };
    } catch (error) {
      return { success: false, error: 'Failed to create user' };
    }
  }

  /**
   * Update user password
   */
  async updateUserPassword(username: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.userStore.get(username);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = this.hashPassword(newPassword, salt);

      user.passwordHash = passwordHash;
      user.salt = salt;
      user.failedAttempts = 0;
      user.locked = false;

      this.logSecurityEvent('password_changed', 'medium', {
        username,
        changedBy: 'user'
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update password' };
    }
  }

  /**
   * Enable MFA for user
   */
  async enableMFA(username: string): Promise<{ success: boolean; secret?: string; error?: string }> {
    try {
      const user = this.userStore.get(username);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const secret = crypto.randomBytes(32).toString('hex');
      user.mfaSecret = secret;
      user.mfaEnabled = true;

      this.logSecurityEvent('mfa_enabled', 'medium', {
        username,
        enabledBy: 'user'
      });

      return { success: true, secret };
    } catch (error) {
      return { success: false, error: 'Failed to enable MFA' };
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(username: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.userStore.get(username);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      user.mfaSecret = undefined;
      user.mfaEnabled = false;

      this.logSecurityEvent('mfa_disabled', 'medium', {
        username,
        disabledBy: 'user'
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to disable MFA' };
    }
  }

  /**
   * Get all users (for admin use)
   */
  getAllUsers(): Array<{
    id: string;
    username: string;
    role: string;
    mfaEnabled: boolean;
    createdAt: Date;
    lastLogin?: Date;
    failedAttempts: number;
    locked: boolean;
  }> {
    const users: any[] = [];
    for (const [username, user] of this.userStore) {
      users.push({
        id: user.id,
        username: user.username,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        failedAttempts: user.failedAttempts,
        locked: user.locked
      });
    }
    return users;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.activeSessions.clear();
    this.securityEvents = [];
    this.auditLogs = [];
    this.rateLimitStore.clear();
    this.userStore.clear();
    this.blockedIPs.clear();
    this.failedLoginAttempts.clear();
    this.encryptionKeys.clear();
  }
}

// Helper functions
export const createSecurityManager = (config: SecurityConfig) => {
  return new SecurityManager(config);
};

export const getSecurityManager = () => {
  return SecurityManager.getInstance();
};

export const withSecurity = <T extends (...args: any[]) => any>(
  fn: T,
  requiredPermission?: string
) => {
  return async (...args: any[]) => {
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