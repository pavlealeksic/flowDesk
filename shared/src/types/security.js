"use strict";
/**
 * Security Types for Flow Desk
 *
 * Defines comprehensive types for authentication, authorization, audit logs,
 * security policies, and threat detection following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityPolicySchema = exports.AuditLogEntrySchema = exports.AuthTokenSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.AuthTokenSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    organizationId: zod_1.z.string().optional(),
    type: zod_1.z.enum(['access_token', 'refresh_token', 'id_token', 'api_token', 'session_token', 'device_token', 'verification_token', 'password_reset_token', 'invitation_token']),
    tokenHash: zod_1.z.string(),
    scope: zod_1.z.array(zod_1.z.string()),
    status: zod_1.z.enum(['active', 'expired', 'revoked', 'blacklisted', 'suspended']),
    metadata: zod_1.z.object({
        clientId: zod_1.z.string().optional(),
        ipAddress: zod_1.z.string(),
        userAgent: zod_1.z.string(),
        sessionId: zod_1.z.string().optional(),
        oauthState: zod_1.z.string().optional(),
        purpose: zod_1.z.string().optional(),
        custom: zod_1.z.record(zod_1.z.any()).optional()
    }),
    expiresAt: zod_1.z.date(),
    usage: zod_1.z.object({
        useCount: zod_1.z.number(),
        firstUsedAt: zod_1.z.date().optional(),
        lastUsedAt: zod_1.z.date().optional(),
        uniqueIPs: zod_1.z.number(),
        uniqueDevices: zod_1.z.number(),
        rateLimit: zod_1.z.object({
            currentCount: zod_1.z.number(),
            windowStart: zod_1.z.date(),
            exceeded: zod_1.z.boolean()
        }).optional()
    }),
    device: zod_1.z.object({
        fingerprint: zod_1.z.string(),
        type: zod_1.z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
        os: zod_1.z.string(),
        osVersion: zod_1.z.string(),
        browser: zod_1.z.string(),
        browserVersion: zod_1.z.string(),
        trustLevel: zod_1.z.enum(['trusted', 'known', 'unknown', 'suspicious']),
        registeredAt: zod_1.z.date().optional(),
        lastSeenAt: zod_1.z.date()
    }).optional(),
    location: zod_1.z.object({
        ipAddress: zod_1.z.string(),
        country: zod_1.z.string(),
        region: zod_1.z.string(),
        city: zod_1.z.string(),
        timezone: zod_1.z.string(),
        isp: zod_1.z.string().optional(),
        vpnDetected: zod_1.z.boolean(),
        torDetected: zod_1.z.boolean(),
        accuracy: zod_1.z.enum(['high', 'medium', 'low'])
    }).optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastUsedAt: zod_1.z.date().optional()
});
exports.AuditLogEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    organizationId: zod_1.z.string().optional(),
    eventType: zod_1.z.string(),
    category: zod_1.z.enum(['authentication', 'authorization', 'data', 'system', 'security']),
    severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']),
    riskLevel: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    description: zod_1.z.string(),
    details: zod_1.z.object({
        resource: zod_1.z.object({
            type: zod_1.z.string(),
            id: zod_1.z.string(),
            name: zod_1.z.string().optional()
        }).optional(),
        action: zod_1.z.string(),
        oldValues: zod_1.z.record(zod_1.z.any()).optional(),
        newValues: zod_1.z.record(zod_1.z.any()).optional(),
        error: zod_1.z.object({
            code: zod_1.z.string(),
            message: zod_1.z.string(),
            details: zod_1.z.any().optional()
        }).optional(),
        additional: zod_1.z.record(zod_1.z.any()).optional()
    }),
    context: zod_1.z.object({
        sessionId: zod_1.z.string().optional(),
        requestId: zod_1.z.string().optional(),
        apiEndpoint: zod_1.z.string().optional(),
        httpMethod: zod_1.z.string().optional(),
        clientApp: zod_1.z.string().optional(),
        userRoles: zod_1.z.array(zod_1.z.string()).optional(),
        permissions: zod_1.z.array(zod_1.z.string()).optional(),
        correlationId: zod_1.z.string().optional()
    }),
    result: zod_1.z.enum(['success', 'failure', 'partial', 'denied']),
    device: zod_1.z.object({
        fingerprint: zod_1.z.string(),
        type: zod_1.z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
        os: zod_1.z.string(),
        osVersion: zod_1.z.string(),
        browser: zod_1.z.string(),
        browserVersion: zod_1.z.string(),
        trustLevel: zod_1.z.enum(['trusted', 'known', 'unknown', 'suspicious']),
        registeredAt: zod_1.z.date().optional(),
        lastSeenAt: zod_1.z.date()
    }).optional(),
    location: zod_1.z.object({
        ipAddress: zod_1.z.string(),
        country: zod_1.z.string(),
        region: zod_1.z.string(),
        city: zod_1.z.string(),
        timezone: zod_1.z.string(),
        isp: zod_1.z.string().optional(),
        vpnDetected: zod_1.z.boolean(),
        torDetected: zod_1.z.boolean(),
        accuracy: zod_1.z.enum(['high', 'medium', 'low'])
    }).optional(),
    timestamp: zod_1.z.date(),
    relatedEvents: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional()
});
exports.SecurityPolicySchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    type: zod_1.z.enum(['authentication', 'authorization', 'password', 'session', 'device', 'location', 'rate_limiting', 'data_access', 'encryption', 'compliance', 'custom']),
    scope: zod_1.z.object({
        global: zod_1.z.boolean(),
        organizationIds: zod_1.z.array(zod_1.z.string()).optional(),
        teamIds: zod_1.z.array(zod_1.z.string()).optional(),
        userIds: zod_1.z.array(zod_1.z.string()).optional(),
        roles: zod_1.z.array(zod_1.z.string()).optional(),
        resourceTypes: zod_1.z.array(zod_1.z.string()).optional(),
        conditions: zod_1.z.array(zod_1.z.object({
            field: zod_1.z.string(),
            operator: zod_1.z.enum(['equals', 'not_equals', 'in', 'not_in', 'contains', 'regex', 'greater_than', 'less_than']),
            value: zod_1.z.any(),
            logic: zod_1.z.enum(['AND', 'OR']).optional()
        })).optional()
    }),
    rules: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        condition: zod_1.z.object({
            type: zod_1.z.string(),
            parameters: zod_1.z.record(zod_1.z.any()),
            conditions: zod_1.z.array(zod_1.z.any()).optional(),
            logic: zod_1.z.enum(['AND', 'OR', 'NOT']).optional()
        }),
        action: zod_1.z.object({
            type: zod_1.z.enum(['allow', 'deny', 'require_mfa', 'log', 'alert', 'block_ip', 'quarantine', 'custom']),
            parameters: zod_1.z.record(zod_1.z.any()),
            message: zod_1.z.string().optional()
        }),
        enabled: zod_1.z.boolean(),
        priority: zod_1.z.number()
    })),
    enforcement: zod_1.z.object({
        mode: zod_1.z.enum(['enforce', 'monitor', 'test']),
        blockOnViolation: zod_1.z.boolean(),
        alertOnViolation: zod_1.z.boolean(),
        logViolations: zod_1.z.boolean(),
        gracePeriod: zod_1.z.object({
            duration: zod_1.z.number(),
            unit: zod_1.z.enum(['minutes', 'hours', 'days'])
        }).optional()
    }),
    status: zod_1.z.enum(['active', 'inactive', 'draft']),
    priority: zod_1.z.number(),
    metadata: zod_1.z.record(zod_1.z.any()),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastEvaluatedAt: zod_1.z.date().optional()
});
//# sourceMappingURL=security.js.map