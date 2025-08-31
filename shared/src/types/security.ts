/**
 * Security Types for Flow Desk
 * 
 * Defines comprehensive types for authentication, authorization, audit logs,
 * security policies, and threat detection following Blueprint.md requirements.
 */

import { z } from 'zod';

/**
 * Authentication token types
 */
export type TokenType = 
  | 'access_token'    // Short-lived access token
  | 'refresh_token'   // Long-lived refresh token
  | 'id_token'        // OpenID Connect ID token
  | 'api_token'       // API access token
  | 'session_token'   // Session identifier
  | 'device_token'    // Device registration token
  | 'verification_token' // Email/phone verification token
  | 'password_reset_token' // Password reset token
  | 'invitation_token'; // User invitation token

/**
 * Token status
 */
export type TokenStatus = 
  | 'active'      // Token is valid and active
  | 'expired'     // Token has expired
  | 'revoked'     // Token has been revoked
  | 'blacklisted' // Token is blacklisted
  | 'suspended';  // Token is temporarily suspended

/**
 * Security event types
 */
export type SecurityEventType = 
  // Authentication events
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_issued'
  | 'token_refreshed'
  | 'token_revoked'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_challenge'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  // Authorization events
  | 'permission_granted'
  | 'permission_denied'
  | 'role_assigned'
  | 'role_removed'
  | 'access_denied'
  // Account events
  | 'account_created'
  | 'account_updated'
  | 'account_deleted'
  | 'account_locked'
  | 'account_unlocked'
  | 'account_suspended'
  // Device events
  | 'device_registered'
  | 'device_deregistered'
  | 'device_trusted'
  | 'device_blocked'
  | 'suspicious_device'
  // Data events
  | 'data_access'
  | 'data_export'
  | 'data_deletion'
  | 'sensitive_data_access'
  // Security events
  | 'security_policy_violation'
  | 'brute_force_attempt'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'ip_blocked'
  | 'geo_anomaly'
  // System events
  | 'system_access'
  | 'admin_action'
  | 'configuration_changed'
  | 'backup_created'
  | 'backup_restored';

/**
 * Risk level
 */
export type RiskLevel = 
  | 'low'       // Low risk activity
  | 'medium'    // Medium risk activity
  | 'high'      // High risk activity
  | 'critical'; // Critical risk activity

/**
 * Authentication token entity
 */
export interface AuthToken {
  /** Token ID */
  id: string;
  /** User ID */
  userId: string;
  /** Organization ID */
  organizationId?: string;
  /** Token type */
  type: TokenType;
  /** Token value (hashed) */
  tokenHash: string;
  /** Token scope */
  scope: string[];
  /** Token status */
  status: TokenStatus;
  /** Token metadata */
  metadata: TokenMetadata;
  /** Token expiry */
  expiresAt: Date;
  /** Token usage */
  usage: TokenUsage;
  /** Device information */
  device?: DeviceInfo;
  /** Location information */
  location?: LocationInfo;
  /** Token creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last used timestamp */
  lastUsedAt?: Date;
}

/**
 * Token metadata
 */
export interface TokenMetadata {
  /** Client application ID */
  clientId?: string;
  /** Client IP address */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
  /** Session ID */
  sessionId?: string;
  /** OAuth state */
  oauthState?: string;
  /** Token purpose */
  purpose?: string;
  /** Additional metadata */
  custom?: Record<string, any>;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Number of times token was used */
  useCount: number;
  /** First use timestamp */
  firstUsedAt?: Date;
  /** Last use timestamp */
  lastUsedAt?: Date;
  /** Unique IP addresses used from */
  uniqueIPs: number;
  /** Unique devices used from */
  uniqueDevices: number;
  /** Rate limiting information */
  rateLimit?: {
    /** Current request count */
    currentCount: number;
    /** Rate limit window start */
    windowStart: Date;
    /** Rate limit exceeded */
    exceeded: boolean;
  };
}

/**
 * Device information for security tracking
 */
export interface DeviceInfo {
  /** Unique device identifier */
  deviceId: string;
  /** Device fingerprint */
  fingerprint: string;
  /** Device name for display */
  name: string;
  /** Device name (alias for name) */
  deviceName?: string;
  /** Device type */
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  /** Device type (alias for type) */
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  /** Operating system */
  os: string;
  /** OS version */
  osVersion: string;
  /** Browser/client */
  browser: string;
  /** Browser version */
  browserVersion: string;
  /** Device trust level */
  trustLevel: 'trusted' | 'known' | 'unknown' | 'suspicious';
  /** Device registration date */
  registeredAt?: Date;
  /** Last seen timestamp */
  lastSeenAt: Date;
}

/**
 * Location information for security tracking
 */
export interface LocationInfo {
  /** IP address */
  ipAddress: string;
  /** Country code */
  country: string;
  /** Region/state */
  region: string;
  /** City */
  city: string;
  /** Timezone */
  timezone: string;
  /** ISP */
  isp?: string;
  /** VPN/proxy detection */
  vpnDetected: boolean;
  /** Tor detection */
  torDetected: boolean;
  /** Location accuracy */
  accuracy: 'high' | 'medium' | 'low';
}

/**
 * Security audit log entry
 */
export interface AuditLogEntry {
  /** Log entry ID */
  id: string;
  /** User ID (if applicable) */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Event type */
  eventType: SecurityEventType;
  /** Event category */
  category: 'authentication' | 'authorization' | 'data' | 'system' | 'security';
  /** Event severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Risk level */
  riskLevel: RiskLevel;
  /** Event description */
  description: string;
  /** Event details */
  details: AuditEventDetails;
  /** Event context */
  context: AuditEventContext;
  /** Event result */
  result: 'success' | 'failure' | 'partial' | 'denied';
  /** Device information */
  device?: DeviceInfo;
  /** Location information */
  location?: LocationInfo;
  /** Event timestamp */
  timestamp: Date;
  /** Related events */
  relatedEvents?: string[];
  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Audit event details
 */
export interface AuditEventDetails {
  /** Resource affected */
  resource?: {
    type: string;
    id: string;
    name?: string;
  };
  /** Action performed */
  action: string;
  /** Old values (for updates) */
  oldValues?: Record<string, any>;
  /** New values (for updates) */
  newValues?: Record<string, any>;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** Additional details */
  additional?: Record<string, any>;
}

/**
 * Audit event context
 */
export interface AuditEventContext {
  /** Session ID */
  sessionId?: string;
  /** Request ID */
  requestId?: string;
  /** API endpoint */
  apiEndpoint?: string;
  /** HTTP method */
  httpMethod?: string;
  /** Client application */
  clientApp?: string;
  /** User roles */
  userRoles?: string[];
  /** Permissions used */
  permissions?: string[];
  /** Correlation ID */
  correlationId?: string;
}

/**
 * Security policy definition
 */
export interface SecurityPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Policy type */
  type: SecurityPolicyType;
  /** Policy scope */
  scope: PolicyScope;
  /** Policy rules */
  rules: SecurityPolicyRule[];
  /** Policy enforcement */
  enforcement: PolicyEnforcement;
  /** Policy status */
  status: 'active' | 'inactive' | 'draft';
  /** Policy priority */
  priority: number;
  /** Policy metadata */
  metadata: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last evaluation timestamp */
  lastEvaluatedAt?: Date;
}

/**
 * Security policy types
 */
export type SecurityPolicyType = 
  | 'authentication'  // Login and auth policies
  | 'authorization'   // Access control policies
  | 'password'        // Password complexity policies
  | 'session'         // Session management policies
  | 'device'          // Device trust policies
  | 'location'        // Geographic restriction policies
  | 'rate_limiting'   // Rate limiting policies
  | 'data_access'     // Data access policies
  | 'encryption'      // Encryption requirement policies
  | 'compliance'      // Regulatory compliance policies
  | 'custom';         // Custom security policies

/**
 * Policy scope
 */
export interface PolicyScope {
  /** Apply to all users */
  global: boolean;
  /** Specific organizations */
  organizationIds?: string[];
  /** Specific teams */
  teamIds?: string[];
  /** Specific users */
  userIds?: string[];
  /** User roles */
  roles?: string[];
  /** Resource types */
  resourceTypes?: string[];
  /** Conditions */
  conditions?: PolicyCondition[];
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  /** Condition field */
  field: string;
  /** Condition operator */
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  /** Condition value */
  value: any;
  /** Condition logic */
  logic?: 'AND' | 'OR';
}

/**
 * Security policy rule
 */
export interface SecurityPolicyRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Rule condition */
  condition: PolicyRuleCondition;
  /** Rule action */
  action: PolicyRuleAction;
  /** Rule enabled */
  enabled: boolean;
  /** Rule priority */
  priority: number;
}

/**
 * Policy rule condition
 */
export interface PolicyRuleCondition {
  /** Condition type */
  type: string;
  /** Condition parameters */
  parameters: Record<string, any>;
  /** Nested conditions */
  conditions?: PolicyRuleCondition[];
  /** Logic operator */
  logic?: 'AND' | 'OR' | 'NOT';
}

/**
 * Policy rule action
 */
export interface PolicyRuleAction {
  /** Action type */
  type: 'allow' | 'deny' | 'require_mfa' | 'log' | 'alert' | 'block_ip' | 'quarantine' | 'custom';
  /** Action parameters */
  parameters: Record<string, any>;
  /** Action message */
  message?: string;
}

/**
 * Policy enforcement
 */
export interface PolicyEnforcement {
  /** Enforcement mode */
  mode: 'enforce' | 'monitor' | 'test';
  /** Block on violation */
  blockOnViolation: boolean;
  /** Alert on violation */
  alertOnViolation: boolean;
  /** Log violations */
  logViolations: boolean;
  /** Grace period */
  gracePeriod?: {
    duration: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

/**
 * Security incident
 */
export interface SecurityIncident {
  /** Incident ID */
  id: string;
  /** Incident title */
  title: string;
  /** Incident description */
  description: string;
  /** Incident type */
  type: SecurityIncidentType;
  /** Incident severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Incident status */
  status: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'closed';
  /** Affected users */
  affectedUsers: string[];
  /** Affected resources */
  affectedResources: Array<{
    type: string;
    id: string;
    name?: string;
  }>;
  /** Detection details */
  detection: {
    /** Detection method */
    method: 'automated' | 'manual' | 'external_report';
    /** Detection rule */
    rule?: string;
    /** Detection timestamp */
    detectedAt: Date;
    /** Alert ID */
    alertId?: string;
  };
  /** Investigation details */
  investigation: {
    /** Assigned investigator */
    assignedTo?: string;
    /** Investigation notes */
    notes?: string;
    /** Evidence collected */
    evidence?: string[];
    /** Timeline */
    timeline?: Array<{
      timestamp: Date;
      event: string;
      details: string;
    }>;
  };
  /** Response actions */
  response: {
    /** Actions taken */
    actionsTaken: string[];
    /** Containment measures */
    containmentMeasures: string[];
    /** Remediation steps */
    remediationSteps: string[];
  };
  /** Incident metadata */
  metadata: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Resolution timestamp */
  resolvedAt?: Date;
}

/**
 * Security incident types
 */
export type SecurityIncidentType = 
  | 'unauthorized_access'
  | 'data_breach'
  | 'malware_detection'
  | 'phishing_attempt'
  | 'brute_force_attack'
  | 'privilege_escalation'
  | 'suspicious_activity'
  | 'policy_violation'
  | 'system_compromise'
  | 'insider_threat'
  | 'ddos_attack'
  | 'social_engineering'
  | 'account_takeover'
  | 'other';

/**
 * Security alert
 */
export interface SecurityAlert {
  /** Alert ID */
  id: string;
  /** Alert rule ID */
  ruleId: string;
  /** Alert type */
  type: SecurityEventType;
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Alert status */
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Alert details */
  details: Record<string, any>;
  /** Affected entities */
  entities: Array<{
    type: 'user' | 'device' | 'resource' | 'ip' | 'session';
    id: string;
    name?: string;
  }>;
  /** Risk score (0-100) */
  riskScore: number;
  /** Related events */
  relatedEvents: string[];
  /** Alert context */
  context: {
    /** Detection timestamp */
    detectedAt: Date;
    /** Event count */
    eventCount: number;
    /** Time window */
    timeWindow: string;
    /** Additional context */
    metadata: Record<string, any>;
  };
  /** Alert acknowledgment */
  acknowledgment?: {
    /** Acknowledged by */
    acknowledgedBy: string;
    /** Acknowledgment timestamp */
    acknowledgedAt: Date;
    /** Acknowledgment note */
    note?: string;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * MFA (Multi-Factor Authentication) configuration
 */
export interface MFAConfig {
  /** User ID */
  userId: string;
  /** MFA enabled */
  enabled: boolean;
  /** Backup codes */
  backupCodes?: string[];
  /** MFA methods */
  methods: MFAMethod[];
  /** Default method */
  defaultMethod?: string;
  /** MFA settings */
  settings: {
    /** Remember device duration */
    rememberDeviceDays: number;
    /** Require for sensitive operations */
    requireForSensitive: boolean;
    /** Grace period after setup */
    gracePeriodDays: number;
  };
  /** MFA statistics */
  stats: {
    /** Setup date */
    setupDate: Date;
    /** Last used */
    lastUsed?: Date;
    /** Success count */
    successCount: number;
    /** Failure count */
    failureCount: number;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * MFA method
 */
export interface MFAMethod {
  /** Method ID */
  id: string;
  /** Method type */
  type: 'totp' | 'sms' | 'email' | 'hardware_key' | 'backup_codes' | 'push';
  /** Method name */
  name: string;
  /** Method status */
  status: 'active' | 'inactive' | 'pending_verification';
  /** Method configuration */
  config: MFAMethodConfig;
  /** Method statistics */
  stats: {
    /** Last used */
    lastUsed?: Date;
    /** Success count */
    successCount: number;
    /** Failure count */
    failureCount: number;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * MFA method configuration
 */
export type MFAMethodConfig = 
  | TOTPConfig
  | SMSConfig
  | EmailConfig
  | HardwareKeyConfig
  | PushConfig;

/**
 * TOTP (Time-based One-Time Password) configuration
 */
export interface TOTPConfig {
  type: 'totp';
  /** Secret key (encrypted) */
  secret: string;
  /** QR code URL */
  qrCodeUrl?: string;
  /** Issuer name */
  issuer: string;
  /** Account name */
  account: string;
  /** Time step (seconds) */
  timeStep: number;
  /** Code length */
  codeLength: number;
}

/**
 * SMS configuration
 */
export interface SMSConfig {
  type: 'sms';
  /** Phone number */
  phoneNumber: string;
  /** Country code */
  countryCode: string;
  /** SMS provider */
  provider: string;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  type: 'email';
  /** Email address */
  emailAddress: string;
  /** Email template */
  template?: string;
}

/**
 * Hardware key configuration
 */
export interface HardwareKeyConfig {
  type: 'hardware_key';
  /** Key ID */
  keyId: string;
  /** Key name */
  keyName: string;
  /** Key type */
  keyType: 'fido2' | 'u2f';
  /** Public key */
  publicKey: string;
  /** Attestation */
  attestation?: string;
}

/**
 * Push notification configuration
 */
export interface PushConfig {
  type: 'push';
  /** Device token */
  deviceToken: string;
  /** Push service */
  service: 'apns' | 'fcm' | 'web_push';
  /** Device info */
  deviceInfo: {
    name: string;
    type: string;
    os: string;
  };
}

/**
 * Threat intelligence
 */
export interface ThreatIntelligence {
  /** Threat ID */
  id: string;
  /** Threat type */
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'user_agent';
  /** Threat value */
  value: string;
  /** Threat category */
  category: 'malware' | 'phishing' | 'spam' | 'bot' | 'tor' | 'vpn' | 'proxy' | 'suspicious';
  /** Threat level */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Threat sources */
  sources: string[];
  /** Threat description */
  description?: string;
  /** Threat tags */
  tags: string[];
  /** First seen */
  firstSeen: Date;
  /** Last seen */
  lastSeen: Date;
  /** Confidence score (0-100) */
  confidence: number;
  /** Expiry date */
  expiresAt?: Date;
  /** Metadata */
  metadata: Record<string, any>;
}

// Zod schemas for runtime validation
export const AuthTokenSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string().optional(),
  type: z.enum(['access_token', 'refresh_token', 'id_token', 'api_token', 'session_token', 'device_token', 'verification_token', 'password_reset_token', 'invitation_token']),
  tokenHash: z.string(),
  scope: z.array(z.string()),
  status: z.enum(['active', 'expired', 'revoked', 'blacklisted', 'suspended']),
  metadata: z.object({
    clientId: z.string().optional(),
    ipAddress: z.string(),
    userAgent: z.string(),
    sessionId: z.string().optional(),
    oauthState: z.string().optional(),
    purpose: z.string().optional(),
    custom: z.record(z.any()).optional()
  }),
  expiresAt: z.date(),
  usage: z.object({
    useCount: z.number(),
    firstUsedAt: z.date().optional(),
    lastUsedAt: z.date().optional(),
    uniqueIPs: z.number(),
    uniqueDevices: z.number(),
    rateLimit: z.object({
      currentCount: z.number(),
      windowStart: z.date(),
      exceeded: z.boolean()
    }).optional()
  }),
  device: z.object({
    fingerprint: z.string(),
    type: z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
    os: z.string(),
    osVersion: z.string(),
    browser: z.string(),
    browserVersion: z.string(),
    trustLevel: z.enum(['trusted', 'known', 'unknown', 'suspicious']),
    registeredAt: z.date().optional(),
    lastSeenAt: z.date()
  }).optional(),
  location: z.object({
    ipAddress: z.string(),
    country: z.string(),
    region: z.string(),
    city: z.string(),
    timezone: z.string(),
    isp: z.string().optional(),
    vpnDetected: z.boolean(),
    torDetected: z.boolean(),
    accuracy: z.enum(['high', 'medium', 'low'])
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastUsedAt: z.date().optional()
});

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  eventType: z.string(),
  category: z.enum(['authentication', 'authorization', 'data', 'system', 'security']),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  details: z.object({
    resource: z.object({
      type: z.string(),
      id: z.string(),
      name: z.string().optional()
    }).optional(),
    action: z.string(),
    oldValues: z.record(z.any()).optional(),
    newValues: z.record(z.any()).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional()
    }).optional(),
    additional: z.record(z.any()).optional()
  }),
  context: z.object({
    sessionId: z.string().optional(),
    requestId: z.string().optional(),
    apiEndpoint: z.string().optional(),
    httpMethod: z.string().optional(),
    clientApp: z.string().optional(),
    userRoles: z.array(z.string()).optional(),
    permissions: z.array(z.string()).optional(),
    correlationId: z.string().optional()
  }),
  result: z.enum(['success', 'failure', 'partial', 'denied']),
  device: z.object({
    fingerprint: z.string(),
    type: z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
    os: z.string(),
    osVersion: z.string(),
    browser: z.string(),
    browserVersion: z.string(),
    trustLevel: z.enum(['trusted', 'known', 'unknown', 'suspicious']),
    registeredAt: z.date().optional(),
    lastSeenAt: z.date()
  }).optional(),
  location: z.object({
    ipAddress: z.string(),
    country: z.string(),
    region: z.string(),
    city: z.string(),
    timezone: z.string(),
    isp: z.string().optional(),
    vpnDetected: z.boolean(),
    torDetected: z.boolean(),
    accuracy: z.enum(['high', 'medium', 'low'])
  }).optional(),
  timestamp: z.date(),
  relatedEvents: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export const SecurityPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['authentication', 'authorization', 'password', 'session', 'device', 'location', 'rate_limiting', 'data_access', 'encryption', 'compliance', 'custom']),
  scope: z.object({
    global: z.boolean(),
    organizationIds: z.array(z.string()).optional(),
    teamIds: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    resourceTypes: z.array(z.string()).optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'in', 'not_in', 'contains', 'regex', 'greater_than', 'less_than']),
      value: z.any(),
      logic: z.enum(['AND', 'OR']).optional()
    })).optional()
  }),
  rules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    condition: z.object({
      type: z.string(),
      parameters: z.record(z.any()),
      conditions: z.array(z.any()).optional(),
      logic: z.enum(['AND', 'OR', 'NOT']).optional()
    }),
    action: z.object({
      type: z.enum(['allow', 'deny', 'require_mfa', 'log', 'alert', 'block_ip', 'quarantine', 'custom']),
      parameters: z.record(z.any()),
      message: z.string().optional()
    }),
    enabled: z.boolean(),
    priority: z.number()
  })),
  enforcement: z.object({
    mode: z.enum(['enforce', 'monitor', 'test']),
    blockOnViolation: z.boolean(),
    alertOnViolation: z.boolean(),
    logViolations: z.boolean(),
    gracePeriod: z.object({
      duration: z.number(),
      unit: z.enum(['minutes', 'hours', 'days'])
    }).optional()
  }),
  status: z.enum(['active', 'inactive', 'draft']),
  priority: z.number(),
  metadata: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastEvaluatedAt: z.date().optional()
});

/**
 * Utility types for security operations
 */
export type CreateAuthTokenInput = Omit<AuthToken, 'id' | 'tokenHash' | 'usage' | 'createdAt' | 'updatedAt' | 'lastUsedAt'>;
export type UpdateAuthTokenInput = Partial<Pick<AuthToken, 'status' | 'scope' | 'metadata'>>;

export type CreateAuditLogEntryInput = Omit<AuditLogEntry, 'id' | 'timestamp'>;

export type CreateSecurityPolicyInput = Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt' | 'lastEvaluatedAt'>;
export type UpdateSecurityPolicyInput = Partial<Pick<SecurityPolicy, 'name' | 'description' | 'scope' | 'rules' | 'enforcement' | 'status' | 'priority' | 'metadata'>>;

/**
 * Security dashboard metrics
 */
export interface SecurityMetrics {
  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
  /** Authentication metrics */
  authentication: {
    /** Total login attempts */
    totalLogins: number;
    /** Successful logins */
    successfulLogins: number;
    /** Failed logins */
    failedLogins: number;
    /** Login success rate */
    successRate: number;
    /** MFA usage rate */
    mfaUsageRate: number;
  };
  /** Security events */
  events: {
    /** Total security events */
    total: number;
    /** Events by severity */
    bySeverity: Record<string, number>;
    /** Events by type */
    byType: Record<SecurityEventType, number>;
    /** High risk events */
    highRisk: number;
  };
  /** Threat detection */
  threats: {
    /** Blocked threats */
    blocked: number;
    /** Active incidents */
    activeIncidents: number;
    /** False positives */
    falsePositives: number;
    /** Threat sources */
    topSources: Array<{
      source: string;
      count: number;
    }>;
  };
  /** Policy compliance */
  compliance: {
    /** Policy violations */
    violations: number;
    /** Compliance rate */
    rate: number;
    /** Top violated policies */
    topViolations: Array<{
      policyId: string;
      policyName: string;
      violations: number;
    }>;
  };
}

/**
 * Session management
 */
export interface UserSession {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Organization ID */
  organizationId?: string;
  /** Session status */
  status: 'active' | 'expired' | 'terminated' | 'suspicious';
  /** Device information */
  device: DeviceInfo;
  /** Location information */
  location: LocationInfo;
  /** Session metadata */
  metadata: {
    /** Login method */
    loginMethod: 'password' | 'sso' | 'mfa' | 'api_key';
    /** Client application */
    clientApp: string;
    /** User agent */
    userAgent: string;
    /** Remember me */
    rememberMe: boolean;
  };
  /** Session activity */
  activity: {
    /** Last activity timestamp */
    lastActivity: Date;
    /** Activity count */
    activityCount: number;
    /** Idle time (minutes) */
    idleTime: number;
  };
  /** Session security */
  security: {
    /** Risk score */
    riskScore: number;
    /** Security flags */
    flags: string[];
    /** Anomalies detected */
    anomalies: string[];
  };
  /** Session times */
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  terminatedAt?: Date;
}

/**
 * IP address reputation
 */
export interface IPReputation {
  /** IP address */
  ipAddress: string;
  /** Reputation score (0-100) */
  score: number;
  /** Reputation category */
  category: 'clean' | 'suspicious' | 'malicious' | 'unknown';
  /** Threat indicators */
  indicators: Array<{
    type: string;
    value: string;
    confidence: number;
    source: string;
  }>;
  /** Geographic info */
  geo: {
    country: string;
    region: string;
    city: string;
    isp: string;
    asn: string;
  };
  /** Network flags */
  flags: {
    isVPN: boolean;
    isTor: boolean;
    isProxy: boolean;
    isHosting: boolean;
    isMobile: boolean;
  };
  /** Last update */
  lastUpdated: Date;
  /** Data sources */
  sources: string[];
}