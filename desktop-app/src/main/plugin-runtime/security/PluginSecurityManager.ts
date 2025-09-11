/**
 * Plugin Security Manager - Handles all security aspects of plugin execution
 * 
 * This manager implements comprehensive security measures including:
 * - Digital signature verification
 * - Permission validation and enforcement
 * - CSP policy generation and enforcement
 * - Token-based API access control
 * - Security audit logging
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { 
  PluginManifest, 
  PluginInstallation, 
  PluginPermission, 
  PluginScope 
} from '@flow-desk/shared';
import { PluginLogger } from '../utils/PluginLogger';

export interface SecurityConfig {
  /** Enable strict CSP */
  strictCSP: boolean;
  /** Allowed origins for network requests */
  allowedOrigins: string[];
  /** Enable signature verification */
  verifySignatures: boolean;
  /** Path to trusted certificate store */
  trustedCertsPath?: string;
  /** Enable security audit logging */
  auditLogging: boolean;
}

export interface PluginSecurityContext {
  /** Plugin installation ID */
  installationId: string;
  /** Granted permissions */
  grantedPermissions: PluginPermission[];
  /** Granted scopes */
  grantedScopes: PluginScope[];
  /** API access token */
  accessToken: string;
  /** Token expiry time */
  tokenExpiry: Date;
  /** Security level */
  securityLevel: 'low' | 'medium' | 'high';
  /** Allowed domains for network requests */
  allowedDomains: string[];
}

export interface SecurityViolation {
  /** Violation type */
  type: 'permission_denied' | 'scope_exceeded' | 'signature_invalid' | 'network_blocked' | 'resource_exceeded';
  /** Plugin installation ID */
  installationId: string;
  /** Violation description */
  description: string;
  /** Violation data */
  data: any;
  /** Timestamp */
  timestamp: Date;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Plugin Security Manager
 * 
 * Implements comprehensive security controls for plugin execution,
 * including signature verification, permission enforcement, and audit logging.
 */
export class PluginSecurityManager extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly config: SecurityConfig;
  private readonly securityContexts = new Map<string, PluginSecurityContext>();
  private readonly trustedPublicKeys = new Set<string>();
  private readonly securityViolations: SecurityViolation[] = [];
  private readonly apiTokens = new Map<string, { token: string; expiry: Date }>();

  constructor(config: SecurityConfig) {
    super();
    this.config = config;
    this.logger = new PluginLogger('PluginSecurityManager');
  }

  /**
   * Initialize the security manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing plugin security manager');

    try {
      // Load trusted certificates if available
      if (this.config.trustedCertsPath) {
        await this.loadTrustedCertificates();
      }

      // Setup default trusted keys (Flow Desk official plugins)
      await this.setupDefaultTrustedKeys();

      this.logger.info('Plugin security manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize plugin security manager', error);
      throw error;
    }
  }

  /**
   * Shutdown the security manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin security manager');
    
    // Clear sensitive data
    this.securityContexts.clear();
    this.apiTokens.clear();
    this.trustedPublicKeys.clear();
    
    this.logger.info('Plugin security manager shut down');
  }

  /**
   * Verify plugin package signature
   */
  async verifyPluginSignature(packagePath: string, manifest: PluginManifest): Promise<boolean> {
    if (!this.config.verifySignatures) {
      this.logger.warn('Signature verification disabled');
      return true;
    }

    this.logger.info(`Verifying signature for plugin ${manifest.id}`);

    try {
      // Look for signature file
      const signaturePath = packagePath + '.sig';
      const publicKeyPath = packagePath + '.pub';

      const [packageData, signature, publicKey] = await Promise.all([
        fs.readFile(packagePath),
        fs.readFile(signaturePath).catch(() => null),
        fs.readFile(publicKeyPath, 'utf8').catch(() => null)
      ]);

      if (!signature || !publicKey) {
        this.logSecurityViolation({
          type: 'signature_invalid',
          installationId: 'unknown',
          description: 'Missing signature or public key',
          data: { packagePath },
          timestamp: new Date(),
          severity: 'high'
        });
        return false;
      }

      // Verify the signature
      const verify = crypto.createVerify('SHA256');
      verify.update(packageData);
      const isValid = verify.verify(publicKey, signature);

      if (!isValid) {
        this.logSecurityViolation({
          type: 'signature_invalid',
          installationId: 'unknown',
          description: 'Invalid package signature',
          data: { packagePath, manifest: manifest.id },
          timestamp: new Date(),
          severity: 'critical'
        });
      }

      this.logger.info(`Signature verification ${isValid ? 'passed' : 'failed'} for plugin ${manifest.id}`);
      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying signature for plugin ${manifest.id}`, error);
      this.logSecurityViolation({
        type: 'signature_invalid',
        installationId: 'unknown',
        description: 'Signature verification error',
        data: { error: (error as Error).message, packagePath },
        timestamp: new Date(),
        severity: 'high'
      });
      return false;
    }
  }

  /**
   * Validate plugin permissions against manifest
   */
  validatePermissions(
    manifest: PluginManifest, 
    requestedPermissions: PluginPermission[]
  ): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check if all requested permissions are declared in manifest
    for (const permission of requestedPermissions) {
      if (!manifest.permissions.includes(permission)) {
        violations.push(`Undeclared permission: ${permission}`);
      }
    }

    // Check for dangerous permission combinations
    const dangerousCombos = [
      ['filesystem', 'network', 'system:shell'], // File + network + shell access
      ['keychain', 'network'], // Keychain + network access
      ['system:registry', 'network'] // Registry + network access
    ];

    for (const combo of dangerousCombos) {
      if (combo.every(perm => requestedPermissions.includes(perm as PluginPermission))) {
        violations.push(`Dangerous permission combination: ${combo.join(', ')}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Create security context for a plugin installation
   */
  async createSecurityContext(installation: PluginInstallation): Promise<PluginSecurityContext> {
    this.logger.info(`Creating security context for plugin ${installation.pluginId}`);

    try {
      // Generate access token
      const accessToken = this.generateAccessToken(installation);
      const tokenExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

      // Determine security level based on permissions
      const securityLevel = this.determineSecurityLevel(installation.grantedPermissions);

      const context: PluginSecurityContext = {
        installationId: installation.id,
        grantedPermissions: installation.grantedPermissions,
        grantedScopes: installation.grantedScopes,
        accessToken,
        tokenExpiry,
        securityLevel,
        allowedDomains: this.config.allowedOrigins
      };

      // Store context and token
      this.securityContexts.set(installation.id, context);
      this.apiTokens.set(accessToken, { token: accessToken, expiry: tokenExpiry });

      this.logger.info(`Security context created for plugin ${installation.pluginId} with ${securityLevel} security level`);
      return context;
    } catch (error) {
      this.logger.error(`Failed to create security context for plugin ${installation.pluginId}`, error);
      throw error;
    }
  }

  /**
   * Check if plugin has specific permission
   */
  hasPermission(installationId: string, permission: PluginPermission): boolean {
    const context = this.securityContexts.get(installationId);
    if (!context) {
      this.logger.warn(`Security context not found for installation ${installationId}`);
      return false;
    }

    const hasPermission = context.grantedPermissions.includes(permission);
    
    if (!hasPermission) {
      this.logSecurityViolation({
        type: 'permission_denied',
        installationId,
        description: `Permission denied: ${permission}`,
        data: { permission },
        timestamp: new Date(),
        severity: 'medium'
      });
    }

    return hasPermission;
  }

  /**
   * Check if plugin has specific scope
   */
  hasScope(installationId: string, scope: PluginScope): boolean {
    const context = this.securityContexts.get(installationId);
    if (!context) {
      this.logger.warn(`Security context not found for installation ${installationId}`);
      return false;
    }

    const hasScope = context.grantedScopes.includes(scope);
    
    if (!hasScope) {
      this.logSecurityViolation({
        type: 'scope_exceeded',
        installationId,
        description: `Scope exceeded: ${scope}`,
        data: { scope },
        timestamp: new Date(),
        severity: 'medium'
      });
    }

    return hasScope;
  }

  /**
   * Validate API token
   */
  validateAPIToken(token: string): boolean {
    const tokenInfo = this.apiTokens.get(token);
    if (!tokenInfo) {
      return false;
    }

    if (tokenInfo.expiry < new Date()) {
      this.apiTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Get security context by installation ID
   */
  getSecurityContext(installationId: string): PluginSecurityContext | undefined {
    return this.securityContexts.get(installationId);
  }

  /**
   * Generate Content Security Policy for plugin
   */
  generateCSP(installation: PluginInstallation, manifest: PluginManifest): string {
    const context = this.securityContexts.get(installation.id);
    if (!context) {
      throw new Error(`Security context not found for installation ${installation.id}`);
    }

    let csp = "default-src 'self';";

    // Script sources
    if (manifest.type === 'panel' || manifest.type === 'view') {
      csp += " script-src 'self' 'unsafe-inline';"; // Allow inline scripts for UI plugins
    } else {
      csp += " script-src 'self';";
    }

    // Style sources
    csp += " style-src 'self' 'unsafe-inline';";

    // Network access
    if (context.grantedPermissions.includes('network')) {
      const allowedOrigins = this.config.allowedOrigins.join(' ');
      csp += ` connect-src 'self' ${allowedOrigins};`;
      csp += ` img-src 'self' data: ${allowedOrigins};`;
    } else {
      csp += " connect-src 'self';";
      csp += " img-src 'self' data:;";
    }

    // Additional restrictions
    csp += " object-src 'none';";
    csp += " base-uri 'self';";
    csp += " form-action 'self';";
    csp += " frame-ancestors 'none';";

    if (this.config.strictCSP) {
      csp += " upgrade-insecure-requests;";
    }

    return csp;
  }

  /**
   * Get security violations for a plugin
   */
  getSecurityViolations(installationId?: string): SecurityViolation[] {
    if (installationId) {
      return this.securityViolations.filter(v => v.installationId === installationId);
    }
    return [...this.securityViolations];
  }

  /**
   * Private: Generate access token
   */
  private generateAccessToken(installation: PluginInstallation): string {
    const payload = {
      installationId: installation.id,
      pluginId: installation.pluginId,
      userId: installation.userId,
      workspaceId: installation.workspaceId,
      permissions: installation.grantedPermissions,
      scopes: installation.grantedScopes,
      iat: Date.now()
    };

    const token = crypto.createHmac('sha256', this.getTokenSecret())
      .update(JSON.stringify(payload))
      .digest('hex');

    return `fdt_${Buffer.from(JSON.stringify(payload)).toString('base64')}.${token}`;
  }

  /**
   * Private: Get token signing secret
   */
  private getTokenSecret(): string {
    // In production, this should be a secure secret from environment
    return process.env.PLUGIN_TOKEN_SECRET || 'flow-desk-plugin-secret-key';
  }

  /**
   * Private: Determine security level based on permissions
   */
  private determineSecurityLevel(permissions: PluginPermission[]): 'low' | 'medium' | 'high' {
    const highRiskPermissions = ['system:shell', 'system:process', 'system:registry', 'keychain'];
    const mediumRiskPermissions = ['filesystem', 'network', 'write:emails', 'write:calendar'];

    if (permissions.some(p => highRiskPermissions.includes(p))) {
      return 'high';
    } else if (permissions.some(p => mediumRiskPermissions.includes(p))) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Private: Log security violation
   */
  private logSecurityViolation(violation: SecurityViolation): void {
    this.securityViolations.push(violation);
    
    // Keep only last 1000 violations
    if (this.securityViolations.length > 1000) {
      this.securityViolations.shift();
    }

    if (this.config.auditLogging) {
      this.logger.warn(`Security violation [${violation.severity}]: ${violation.description}`, {
        type: violation.type,
        installationId: violation.installationId,
        data: violation.data
      });
    }

    this.emit('securityViolation', violation);
  }

  /**
   * Private: Load trusted certificates
   */
  private async loadTrustedCertificates(): Promise<void> {
    if (!this.config.trustedCertsPath) return;

    try {
      const certFiles = await fs.readdir(this.config.trustedCertsPath);
      
      for (const certFile of certFiles) {
        if (certFile.endsWith('.pub')) {
          const certPath = path.join(this.config.trustedCertsPath, certFile);
          const publicKey = await fs.readFile(certPath, 'utf8');
          this.trustedPublicKeys.add(publicKey.trim());
        }
      }

      this.logger.info(`Loaded ${this.trustedPublicKeys.size} trusted certificates`);
    } catch (error) {
      this.logger.warn('Failed to load trusted certificates', error);
    }
  }

  /**
   * Private: Setup default trusted keys for official plugins
   */
  private async setupDefaultTrustedKeys(): Promise<void> {
    // Add Flow Desk official public keys
    // In production, these would be loaded from secure configuration
    const officialKeys = [
      // Flow Desk official plugin signing key (example)
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----'
    ];

    for (const key of officialKeys) {
      this.trustedPublicKeys.add(key);
    }

    this.logger.debug(`Added ${officialKeys.length} default trusted keys`);
  }

  /**
   * Get allowed domains for a plugin
   */
  getAllowedDomains(installationId: string): string[] {
    return this.securityContexts.get(installationId)?.allowedDomains || [];
  }
}