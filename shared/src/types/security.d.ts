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
export type TokenType = 'access_token' | 'refresh_token' | 'id_token' | 'api_token' | 'session_token' | 'device_token' | 'verification_token' | 'password_reset_token' | 'invitation_token';
/**
 * Token status
 */
export type TokenStatus = 'active' | 'expired' | 'revoked' | 'blacklisted' | 'suspended';
/**
 * Security event types
 */
export type SecurityEventType = 'login_success' | 'login_failure' | 'logout' | 'token_issued' | 'token_refreshed' | 'token_revoked' | 'mfa_enabled' | 'mfa_disabled' | 'mfa_challenge' | 'password_changed' | 'password_reset_requested' | 'password_reset_completed' | 'permission_granted' | 'permission_denied' | 'role_assigned' | 'role_removed' | 'access_denied' | 'account_created' | 'account_updated' | 'account_deleted' | 'account_locked' | 'account_unlocked' | 'account_suspended' | 'device_registered' | 'device_deregistered' | 'device_trusted' | 'device_blocked' | 'suspicious_device' | 'data_access' | 'data_export' | 'data_deletion' | 'sensitive_data_access' | 'security_policy_violation' | 'brute_force_attempt' | 'suspicious_activity' | 'rate_limit_exceeded' | 'ip_blocked' | 'geo_anomaly' | 'system_access' | 'admin_action' | 'configuration_changed' | 'backup_created' | 'backup_restored';
/**
 * Risk level
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
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
export type SecurityPolicyType = 'authentication' | 'authorization' | 'password' | 'session' | 'device' | 'location' | 'rate_limiting' | 'data_access' | 'encryption' | 'compliance' | 'custom';
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
export type SecurityIncidentType = 'unauthorized_access' | 'data_breach' | 'malware_detection' | 'phishing_attempt' | 'brute_force_attack' | 'privilege_escalation' | 'suspicious_activity' | 'policy_violation' | 'system_compromise' | 'insider_threat' | 'ddos_attack' | 'social_engineering' | 'account_takeover' | 'other';
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
export type MFAMethodConfig = TOTPConfig | SMSConfig | EmailConfig | HardwareKeyConfig | PushConfig;
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
export declare const AuthTokenSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["access_token", "refresh_token", "id_token", "api_token", "session_token", "device_token", "verification_token", "password_reset_token", "invitation_token"]>;
    tokenHash: z.ZodString;
    scope: z.ZodArray<z.ZodString, "many">;
    status: z.ZodEnum<["active", "expired", "revoked", "blacklisted", "suspended"]>;
    metadata: z.ZodObject<{
        clientId: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodString;
        userAgent: z.ZodString;
        sessionId: z.ZodOptional<z.ZodString>;
        oauthState: z.ZodOptional<z.ZodString>;
        purpose: z.ZodOptional<z.ZodString>;
        custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        ipAddress: string;
        userAgent: string;
        custom?: Record<string, any> | undefined;
        clientId?: string | undefined;
        sessionId?: string | undefined;
        oauthState?: string | undefined;
        purpose?: string | undefined;
    }, {
        ipAddress: string;
        userAgent: string;
        custom?: Record<string, any> | undefined;
        clientId?: string | undefined;
        sessionId?: string | undefined;
        oauthState?: string | undefined;
        purpose?: string | undefined;
    }>;
    expiresAt: z.ZodDate;
    usage: z.ZodObject<{
        useCount: z.ZodNumber;
        firstUsedAt: z.ZodOptional<z.ZodDate>;
        lastUsedAt: z.ZodOptional<z.ZodDate>;
        uniqueIPs: z.ZodNumber;
        uniqueDevices: z.ZodNumber;
        rateLimit: z.ZodOptional<z.ZodObject<{
            currentCount: z.ZodNumber;
            windowStart: z.ZodDate;
            exceeded: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            currentCount: number;
            windowStart: Date;
            exceeded: boolean;
        }, {
            currentCount: number;
            windowStart: Date;
            exceeded: boolean;
        }>>;
    }, "strip", z.ZodTypeAny, {
        useCount: number;
        uniqueIPs: number;
        uniqueDevices: number;
        lastUsedAt?: Date | undefined;
        rateLimit?: {
            currentCount: number;
            windowStart: Date;
            exceeded: boolean;
        } | undefined;
        firstUsedAt?: Date | undefined;
    }, {
        useCount: number;
        uniqueIPs: number;
        uniqueDevices: number;
        lastUsedAt?: Date | undefined;
        rateLimit?: {
            currentCount: number;
            windowStart: Date;
            exceeded: boolean;
        } | undefined;
        firstUsedAt?: Date | undefined;
    }>;
    device: z.ZodOptional<z.ZodObject<{
        fingerprint: z.ZodString;
        type: z.ZodEnum<["desktop", "mobile", "tablet", "unknown"]>;
        os: z.ZodString;
        osVersion: z.ZodString;
        browser: z.ZodString;
        browserVersion: z.ZodString;
        trustLevel: z.ZodEnum<["trusted", "known", "unknown", "suspicious"]>;
        registeredAt: z.ZodOptional<z.ZodDate>;
        lastSeenAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    }, {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    }>>;
    location: z.ZodOptional<z.ZodObject<{
        ipAddress: z.ZodString;
        country: z.ZodString;
        region: z.ZodString;
        city: z.ZodString;
        timezone: z.ZodString;
        isp: z.ZodOptional<z.ZodString>;
        vpnDetected: z.ZodBoolean;
        torDetected: z.ZodBoolean;
        accuracy: z.ZodEnum<["high", "medium", "low"]>;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    }, {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    }>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastUsedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    expiresAt: Date;
    scope: string[];
    createdAt: Date;
    updatedAt: Date;
    type: "refresh_token" | "access_token" | "id_token" | "api_token" | "session_token" | "device_token" | "verification_token" | "password_reset_token" | "invitation_token";
    usage: {
        useCount: number;
        uniqueIPs: number;
        uniqueDevices: number;
        lastUsedAt?: Date | undefined;
        rateLimit?: {
            currentCount: number;
            windowStart: Date;
            exceeded: boolean;
        } | undefined;
        firstUsedAt?: Date | undefined;
    };
    status: "active" | "suspended" | "expired" | "revoked" | "blacklisted";
    userId: string;
    metadata: {
        ipAddress: string;
        userAgent: string;
        custom?: Record<string, any> | undefined;
        clientId?: string | undefined;
        sessionId?: string | undefined;
        oauthState?: string | undefined;
        purpose?: string | undefined;
    };
    tokenHash: string;
    location?: {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    } | undefined;
    organizationId?: string | undefined;
    lastUsedAt?: Date | undefined;
    device?: {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    } | undefined;
}, {
    id: string;
    expiresAt: Date;
    scope: string[];
    createdAt: Date;
    updatedAt: Date;
    type: "refresh_token" | "access_token" | "id_token" | "api_token" | "session_token" | "device_token" | "verification_token" | "password_reset_token" | "invitation_token";
    usage: {
        useCount: number;
        uniqueIPs: number;
        uniqueDevices: number;
        lastUsedAt?: Date | undefined;
        rateLimit?: {
            currentCount: number;
            windowStart: Date;
            exceeded: boolean;
        } | undefined;
        firstUsedAt?: Date | undefined;
    };
    status: "active" | "suspended" | "expired" | "revoked" | "blacklisted";
    userId: string;
    metadata: {
        ipAddress: string;
        userAgent: string;
        custom?: Record<string, any> | undefined;
        clientId?: string | undefined;
        sessionId?: string | undefined;
        oauthState?: string | undefined;
        purpose?: string | undefined;
    };
    tokenHash: string;
    location?: {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    } | undefined;
    organizationId?: string | undefined;
    lastUsedAt?: Date | undefined;
    device?: {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    } | undefined;
}>;
export declare const AuditLogEntrySchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    organizationId: z.ZodOptional<z.ZodString>;
    eventType: z.ZodString;
    category: z.ZodEnum<["authentication", "authorization", "data", "system", "security"]>;
    severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
    riskLevel: z.ZodEnum<["low", "medium", "high", "critical"]>;
    description: z.ZodString;
    details: z.ZodObject<{
        resource: z.ZodOptional<z.ZodObject<{
            type: z.ZodString;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            type: string;
            name?: string | undefined;
        }, {
            id: string;
            type: string;
            name?: string | undefined;
        }>>;
        action: z.ZodString;
        oldValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        newValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        error: z.ZodOptional<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            details: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            message: string;
            details?: any;
        }, {
            code: string;
            message: string;
            details?: any;
        }>>;
        additional: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        action: string;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        resource?: {
            id: string;
            type: string;
            name?: string | undefined;
        } | undefined;
        oldValues?: Record<string, any> | undefined;
        newValues?: Record<string, any> | undefined;
        additional?: Record<string, any> | undefined;
    }, {
        action: string;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        resource?: {
            id: string;
            type: string;
            name?: string | undefined;
        } | undefined;
        oldValues?: Record<string, any> | undefined;
        newValues?: Record<string, any> | undefined;
        additional?: Record<string, any> | undefined;
    }>;
    context: z.ZodObject<{
        sessionId: z.ZodOptional<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
        apiEndpoint: z.ZodOptional<z.ZodString>;
        httpMethod: z.ZodOptional<z.ZodString>;
        clientApp: z.ZodOptional<z.ZodString>;
        userRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        correlationId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        permissions?: string[] | undefined;
        correlationId?: string | undefined;
        requestId?: string | undefined;
        sessionId?: string | undefined;
        apiEndpoint?: string | undefined;
        httpMethod?: string | undefined;
        clientApp?: string | undefined;
        userRoles?: string[] | undefined;
    }, {
        permissions?: string[] | undefined;
        correlationId?: string | undefined;
        requestId?: string | undefined;
        sessionId?: string | undefined;
        apiEndpoint?: string | undefined;
        httpMethod?: string | undefined;
        clientApp?: string | undefined;
        userRoles?: string[] | undefined;
    }>;
    result: z.ZodEnum<["success", "failure", "partial", "denied"]>;
    device: z.ZodOptional<z.ZodObject<{
        fingerprint: z.ZodString;
        type: z.ZodEnum<["desktop", "mobile", "tablet", "unknown"]>;
        os: z.ZodString;
        osVersion: z.ZodString;
        browser: z.ZodString;
        browserVersion: z.ZodString;
        trustLevel: z.ZodEnum<["trusted", "known", "unknown", "suspicious"]>;
        registeredAt: z.ZodOptional<z.ZodDate>;
        lastSeenAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    }, {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    }>>;
    location: z.ZodOptional<z.ZodObject<{
        ipAddress: z.ZodString;
        country: z.ZodString;
        region: z.ZodString;
        city: z.ZodString;
        timezone: z.ZodString;
        isp: z.ZodOptional<z.ZodString>;
        vpnDetected: z.ZodBoolean;
        torDetected: z.ZodBoolean;
        accuracy: z.ZodEnum<["high", "medium", "low"]>;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    }, {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    }>>;
    timestamp: z.ZodDate;
    relatedEvents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    result: "success" | "denied" | "failure" | "partial";
    description: string;
    category: "data" | "authentication" | "authorization" | "system" | "security";
    details: {
        action: string;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        resource?: {
            id: string;
            type: string;
            name?: string | undefined;
        } | undefined;
        oldValues?: Record<string, any> | undefined;
        newValues?: Record<string, any> | undefined;
        additional?: Record<string, any> | undefined;
    };
    context: {
        permissions?: string[] | undefined;
        correlationId?: string | undefined;
        requestId?: string | undefined;
        sessionId?: string | undefined;
        apiEndpoint?: string | undefined;
        httpMethod?: string | undefined;
        clientApp?: string | undefined;
        userRoles?: string[] | undefined;
    };
    severity: "error" | "info" | "warning" | "critical";
    timestamp: Date;
    eventType: string;
    riskLevel: "high" | "low" | "critical" | "medium";
    location?: {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    } | undefined;
    userId?: string | undefined;
    metadata?: Record<string, any> | undefined;
    organizationId?: string | undefined;
    device?: {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    } | undefined;
    relatedEvents?: string[] | undefined;
}, {
    id: string;
    result: "success" | "denied" | "failure" | "partial";
    description: string;
    category: "data" | "authentication" | "authorization" | "system" | "security";
    details: {
        action: string;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        resource?: {
            id: string;
            type: string;
            name?: string | undefined;
        } | undefined;
        oldValues?: Record<string, any> | undefined;
        newValues?: Record<string, any> | undefined;
        additional?: Record<string, any> | undefined;
    };
    context: {
        permissions?: string[] | undefined;
        correlationId?: string | undefined;
        requestId?: string | undefined;
        sessionId?: string | undefined;
        apiEndpoint?: string | undefined;
        httpMethod?: string | undefined;
        clientApp?: string | undefined;
        userRoles?: string[] | undefined;
    };
    severity: "error" | "info" | "warning" | "critical";
    timestamp: Date;
    eventType: string;
    riskLevel: "high" | "low" | "critical" | "medium";
    location?: {
        timezone: string;
        city: string;
        country: string;
        ipAddress: string;
        region: string;
        vpnDetected: boolean;
        torDetected: boolean;
        accuracy: "high" | "low" | "medium";
        isp?: string | undefined;
    } | undefined;
    userId?: string | undefined;
    metadata?: Record<string, any> | undefined;
    organizationId?: string | undefined;
    device?: {
        browser: string;
        type: "unknown" | "desktop" | "mobile" | "tablet";
        os: string;
        lastSeenAt: Date;
        fingerprint: string;
        osVersion: string;
        browserVersion: string;
        trustLevel: "unknown" | "trusted" | "known" | "suspicious";
        registeredAt?: Date | undefined;
    } | undefined;
    relatedEvents?: string[] | undefined;
}>;
export declare const SecurityPolicySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    type: z.ZodEnum<["authentication", "authorization", "password", "session", "device", "location", "rate_limiting", "data_access", "encryption", "compliance", "custom"]>;
    scope: z.ZodObject<{
        global: z.ZodBoolean;
        organizationIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        teamIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        userIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        roles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        resourceTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodEnum<["equals", "not_equals", "in", "not_in", "contains", "regex", "greater_than", "less_than"]>;
            value: z.ZodAny;
            logic: z.ZodOptional<z.ZodEnum<["AND", "OR"]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            operator: "contains" | "equals" | "regex" | "greater_than" | "less_than" | "not_equals" | "in" | "not_in";
            value?: any;
            logic?: "AND" | "OR" | undefined;
        }, {
            field: string;
            operator: "contains" | "equals" | "regex" | "greater_than" | "less_than" | "not_equals" | "in" | "not_in";
            value?: any;
            logic?: "AND" | "OR" | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        global: boolean;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "regex" | "greater_than" | "less_than" | "not_equals" | "in" | "not_in";
            value?: any;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        organizationIds?: string[] | undefined;
        teamIds?: string[] | undefined;
        userIds?: string[] | undefined;
        roles?: string[] | undefined;
        resourceTypes?: string[] | undefined;
    }, {
        global: boolean;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "regex" | "greater_than" | "less_than" | "not_equals" | "in" | "not_in";
            value?: any;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        organizationIds?: string[] | undefined;
        teamIds?: string[] | undefined;
        userIds?: string[] | undefined;
        roles?: string[] | undefined;
        resourceTypes?: string[] | undefined;
    }>;
    rules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        condition: z.ZodObject<{
            type: z.ZodString;
            parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
            conditions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
            logic: z.ZodOptional<z.ZodEnum<["AND", "OR", "NOT"]>>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            parameters: Record<string, any>;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | "NOT" | undefined;
        }, {
            type: string;
            parameters: Record<string, any>;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | "NOT" | undefined;
        }>;
        action: z.ZodObject<{
            type: z.ZodEnum<["allow", "deny", "require_mfa", "log", "alert", "block_ip", "quarantine", "custom"]>;
            parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
            message: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "deny" | "allow" | "custom" | "log" | "require_mfa" | "alert" | "block_ip" | "quarantine";
            parameters: Record<string, any>;
            message?: string | undefined;
        }, {
            type: "deny" | "allow" | "custom" | "log" | "require_mfa" | "alert" | "block_ip" | "quarantine";
            parameters: Record<string, any>;
            message?: string | undefined;
        }>;
        enabled: z.ZodBoolean;
        priority: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        action: {
            type: "deny" | "allow" | "custom" | "log" | "require_mfa" | "alert" | "block_ip" | "quarantine";
            parameters: Record<string, any>;
            message?: string | undefined;
        };
        priority: number;
        enabled: boolean;
        condition: {
            type: string;
            parameters: Record<string, any>;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | "NOT" | undefined;
        };
        description?: string | undefined;
    }, {
        id: string;
        name: string;
        action: {
            type: "deny" | "allow" | "custom" | "log" | "require_mfa" | "alert" | "block_ip" | "quarantine";
            parameters: Record<string, any>;
            message?: string | undefined;
        };
        priority: number;
        enabled: boolean;
        condition: {
            type: string;
            parameters: Record<string, any>;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | "NOT" | undefined;
        };
        description?: string | undefined;
    }>, "many">;
    enforcement: z.ZodObject<{
        mode: z.ZodEnum<["enforce", "monitor", "test"]>;
        blockOnViolation: z.ZodBoolean;
        alertOnViolation: z.ZodBoolean;
        logViolations: z.ZodBoolean;
        gracePeriod: z.ZodOptional<z.ZodObject<{
            duration: z.ZodNumber;
            unit: z.ZodEnum<["minutes", "hours", "days"]>;
        }, "strip", z.ZodTypeAny, {
            unit: "minutes" | "hours" | "days";
            duration: number;
        }, {
            unit: "minutes" | "hours" | "days";
            duration: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        mode: "test" | "enforce" | "monitor";
        blockOnViolation: boolean;
        alertOnViolation: boolean;
        logViolations: boolean;
        gracePeriod?: {
            unit: "minutes" | "hours" | "days";
            duration: number;
        } | undefined;
    }, {
        mode: "test" | "enforce" | "monitor";
        blockOnViolation: boolean;
        alertOnViolation: boolean;
        logViolations: boolean;
        gracePeriod?: {
            unit: "minutes" | "hours" | "days";
            duration: number;
        } | undefined;
    }>;
    status: z.ZodEnum<["active", "inactive", "draft"]>;
    priority: z.ZodNumber;
    metadata: z.ZodRecord<z.ZodString, z.ZodAny>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastEvaluatedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    scope: {
        global: boolean;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "regex" | "greater_than" | "less_than" | "not_equals" | "in" | "not_in";
            value?: any;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        organizationIds?: string[] | undefined;
        teamIds?: string[] | undefined;
        userIds?: string[] | undefined;
        roles?: string[] | undefined;
        resourceTypes?: string[] | undefined;
    };
    name: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    type: "session" | "custom" | "location" | "password" | "authentication" | "authorization" | "encryption" | "data_access" | "device" | "rate_limiting" | "compliance";
    priority: number;
    status: "active" | "draft" | "inactive";
    metadata: Record<string, any>;
    rules: {
        id: string;
        name: string;
        action: {
            type: "deny" | "allow" | "custom" | "log" | "require_mfa" | "alert" | "block_ip" | "quarantine";
            parameters: Record<string, any>;
            message?: string | undefined;
        };
        priority: number;
        enabled: boolean;
        condition: {
            type: string;
            parameters: Record<string, any>;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | "NOT" | undefined;
        };
        description?: string | undefined;
    }[];
    enforcement: {
        mode: "test" | "enforce" | "monitor";
        blockOnViolation: boolean;
        alertOnViolation: boolean;
        logViolations: boolean;
        gracePeriod?: {
            unit: "minutes" | "hours" | "days";
            duration: number;
        } | undefined;
    };
    lastEvaluatedAt?: Date | undefined;
}, {
    id: string;
    scope: {
        global: boolean;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "regex" | "greater_than" | "less_than" | "not_equals" | "in" | "not_in";
            value?: any;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        organizationIds?: string[] | undefined;
        teamIds?: string[] | undefined;
        userIds?: string[] | undefined;
        roles?: string[] | undefined;
        resourceTypes?: string[] | undefined;
    };
    name: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    type: "session" | "custom" | "location" | "password" | "authentication" | "authorization" | "encryption" | "data_access" | "device" | "rate_limiting" | "compliance";
    priority: number;
    status: "active" | "draft" | "inactive";
    metadata: Record<string, any>;
    rules: {
        id: string;
        name: string;
        action: {
            type: "deny" | "allow" | "custom" | "log" | "require_mfa" | "alert" | "block_ip" | "quarantine";
            parameters: Record<string, any>;
            message?: string | undefined;
        };
        priority: number;
        enabled: boolean;
        condition: {
            type: string;
            parameters: Record<string, any>;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | "NOT" | undefined;
        };
        description?: string | undefined;
    }[];
    enforcement: {
        mode: "test" | "enforce" | "monitor";
        blockOnViolation: boolean;
        alertOnViolation: boolean;
        logViolations: boolean;
        gracePeriod?: {
            unit: "minutes" | "hours" | "days";
            duration: number;
        } | undefined;
    };
    lastEvaluatedAt?: Date | undefined;
}>;
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
//# sourceMappingURL=security.d.ts.map