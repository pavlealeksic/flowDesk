"use strict";
/**
 * Error Types for Flow Desk
 *
 * Defines comprehensive error classes, error codes, and error handling
 * utilities with proper inheritance and type safety.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowDeskErrorSchema = exports.ErrorHandler = exports.Errors = exports.ErrorCodes = exports.QuotaError = exports.SecurityError = exports.LicenseError = exports.BillingError = exports.PluginError = exports.SyncError = exports.TimeoutError = exports.NetworkError = exports.ExternalServiceError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.FlowDeskError = void 0;
exports.Ok = Ok;
exports.Err = Err;
exports.isFlowDeskError = isFlowDeskError;
exports.toFlowDeskError = toFlowDeskError;
exports.wrapAsync = wrapAsync;
exports.withRetry = withRetry;
const zod_1 = require("zod");
/**
 * Base FlowDesk error class
 */
class FlowDeskError extends Error {
    constructor(info) {
        super(info.message);
        this.name = this.constructor.name;
        this.code = info.code;
        this.category = info.category;
        this.severity = info.severity;
        this.context = info.context;
        this.timestamp = info.timestamp;
        this.correlationId = info.correlationId;
        this.suggestions = info.suggestions;
        this.helpUrl = info.helpUrl;
        this.retryable = info.retryable;
        this.retryDelay = info.retryDelay;
        this.maxRetries = info.maxRetries;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Convert error to JSON representation
     */
    toJSON() {
        return {
            code: this.code,
            category: this.category,
            severity: this.severity,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            correlationId: this.correlationId,
            stack: this.stack,
            suggestions: this.suggestions,
            helpUrl: this.helpUrl,
            retryable: this.retryable,
            retryDelay: this.retryDelay,
            maxRetries: this.maxRetries
        };
    }
    /**
     * Check if error is of a specific category
     */
    isCategory(category) {
        return this.category === category;
    }
    /**
     * Check if error is retryable
     */
    isRetryable() {
        return this.retryable;
    }
    /**
     * Get retry delay in milliseconds
     */
    getRetryDelay() {
        return this.retryDelay || 1000;
    }
}
exports.FlowDeskError = FlowDeskError;
/**
 * Validation error
 */
class ValidationError extends FlowDeskError {
    constructor(code, message, field, value, constraint, context) {
        super({
            code,
            category: 'validation',
            severity: 'medium',
            message,
            context: { field, value, constraint, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Check the input data format and constraints',
                'Refer to the API documentation for valid input formats'
            ]
        });
        this.field = field;
        this.value = value;
        this.constraint = constraint;
    }
}
exports.ValidationError = ValidationError;
/**
 * Authentication error
 */
class AuthenticationError extends FlowDeskError {
    constructor(code, message, authenticationType, context) {
        super({
            code,
            category: 'authentication',
            severity: 'high',
            message,
            context: { authenticationType, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Check your credentials and try again',
                'Ensure your session has not expired',
                'Contact support if the issue persists'
            ]
        });
        this.authenticationType = authenticationType;
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Authorization error
 */
class AuthorizationError extends FlowDeskError {
    constructor(code, message, requiredPermission, userPermissions, context) {
        super({
            code,
            category: 'authorization',
            severity: 'high',
            message,
            context: { requiredPermission, userPermissions, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Contact your administrator to request the required permissions',
                'Ensure you are accessing resources within your organization'
            ]
        });
        this.requiredPermission = requiredPermission;
        this.userPermissions = userPermissions;
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Not found error
 */
class NotFoundError extends FlowDeskError {
    constructor(code, message, resourceType, resourceId, context) {
        super({
            code,
            category: 'not_found',
            severity: 'medium',
            message,
            context: { resourceType, resourceId, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Verify the resource ID is correct',
                'Check if the resource has been deleted or moved',
                'Ensure you have access to the resource'
            ]
        });
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Conflict error
 */
class ConflictError extends FlowDeskError {
    constructor(code, message, conflictReason, conflictingResource, context) {
        super({
            code,
            category: 'conflict',
            severity: 'medium',
            message,
            context: { conflictReason, conflictingResource, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Resolve the resource conflict before retrying',
                'Check for existing resources with the same identifier',
                'Use a different identifier or update the existing resource'
            ]
        });
        this.conflictReason = conflictReason;
        this.conflictingResource = conflictingResource;
    }
}
exports.ConflictError = ConflictError;
/**
 * Rate limit error
 */
class RateLimitError extends FlowDeskError {
    constructor(code, message, limit, remaining, resetTime, context) {
        const retryDelay = resetTime ? resetTime.getTime() - Date.now() : 60000;
        super({
            code,
            category: 'rate_limit',
            severity: 'medium',
            message,
            context: { limit, remaining, resetTime, ...context },
            timestamp: new Date(),
            retryable: true,
            retryDelay: Math.max(retryDelay, 1000),
            maxRetries: 3,
            suggestions: [
                'Wait for the rate limit to reset before retrying',
                'Implement exponential backoff in your application',
                'Consider upgrading your plan for higher rate limits'
            ]
        });
        this.limit = limit;
        this.remaining = remaining;
        this.resetTime = resetTime;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * External service error
 */
class ExternalServiceError extends FlowDeskError {
    constructor(code, message, service, serviceError, statusCode, context) {
        const isRetryable = statusCode ? statusCode >= 500 || statusCode === 429 : true;
        super({
            code,
            category: 'external',
            severity: 'high',
            message,
            context: { service, serviceError, statusCode, ...context },
            timestamp: new Date(),
            retryable: isRetryable,
            retryDelay: 5000,
            maxRetries: 3,
            suggestions: [
                'Check the external service status',
                'Retry the operation after a short delay',
                'Contact support if the service continues to be unavailable'
            ]
        });
        this.service = service;
        this.serviceError = serviceError;
        this.statusCode = statusCode;
    }
}
exports.ExternalServiceError = ExternalServiceError;
/**
 * Network error
 */
class NetworkError extends FlowDeskError {
    constructor(code, message, networkCode, url, context) {
        super({
            code,
            category: 'network',
            severity: 'high',
            message,
            context: { networkCode, url, ...context },
            timestamp: new Date(),
            retryable: true,
            retryDelay: 2000,
            maxRetries: 3,
            suggestions: [
                'Check your internet connection',
                'Retry the operation after a short delay',
                'Contact your network administrator if issues persist'
            ]
        });
        this.networkCode = networkCode;
        this.url = url;
    }
}
exports.NetworkError = NetworkError;
/**
 * Timeout error
 */
class TimeoutError extends FlowDeskError {
    constructor(code, message, operation, timeout, context) {
        super({
            code,
            category: 'timeout',
            severity: 'medium',
            message,
            context: { operation, timeout, ...context },
            timestamp: new Date(),
            retryable: true,
            retryDelay: 1000,
            maxRetries: 2,
            suggestions: [
                'Retry the operation with a longer timeout',
                'Check if the operation can be broken into smaller parts',
                'Contact support if timeouts persist'
            ]
        });
        this.operation = operation;
        this.timeout = timeout;
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Sync error
 */
class SyncError extends FlowDeskError {
    constructor(code, message, syncType, conflictDetails, context) {
        super({
            code,
            category: 'sync',
            severity: 'medium',
            message,
            context: { syncType, conflictDetails, ...context },
            timestamp: new Date(),
            retryable: true,
            retryDelay: 3000,
            maxRetries: 3,
            suggestions: [
                'Resolve any sync conflicts before retrying',
                'Check your network connection',
                'Ensure all devices are using the latest version'
            ]
        });
        this.syncType = syncType;
        this.conflictDetails = conflictDetails;
    }
}
exports.SyncError = SyncError;
/**
 * Plugin error
 */
class PluginError extends FlowDeskError {
    constructor(code, message, pluginId, pluginVersion, errorCode, context) {
        super({
            code,
            category: 'plugin',
            severity: 'medium',
            message,
            context: { pluginId, pluginVersion, errorCode, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Check if the plugin needs to be updated',
                'Try disabling and re-enabling the plugin',
                'Contact the plugin author for support'
            ]
        });
        this.pluginId = pluginId;
        this.pluginVersion = pluginVersion;
        this.errorCode = errorCode;
    }
}
exports.PluginError = PluginError;
/**
 * Billing error
 */
class BillingError extends FlowDeskError {
    constructor(code, message, paymentMethod, transactionId, context) {
        super({
            code,
            category: 'billing',
            severity: 'high',
            message,
            context: { paymentMethod, transactionId, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Check your payment method details',
                'Contact your bank if payment was declined',
                'Contact billing support for assistance'
            ]
        });
        this.paymentMethod = paymentMethod;
        this.transactionId = transactionId;
    }
}
exports.BillingError = BillingError;
/**
 * License error
 */
class LicenseError extends FlowDeskError {
    constructor(code, message, licenseKey, feature, context) {
        super({
            code,
            category: 'license',
            severity: 'high',
            message,
            context: { licenseKey, feature, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Check if your license is still valid',
                'Contact billing to upgrade your license',
                'Ensure you have the required permissions'
            ]
        });
        this.licenseKey = licenseKey;
        this.feature = feature;
    }
}
exports.LicenseError = LicenseError;
/**
 * Security error
 */
class SecurityError extends FlowDeskError {
    constructor(code, message, securityEvent, threatLevel, context) {
        super({
            code,
            category: 'security',
            severity: 'critical',
            message,
            context: { securityEvent, threatLevel, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Review your account security settings',
                'Change your password if compromised',
                'Contact security support immediately'
            ]
        });
        this.securityEvent = securityEvent;
        this.threatLevel = threatLevel;
    }
}
exports.SecurityError = SecurityError;
/**
 * Quota error
 */
class QuotaError extends FlowDeskError {
    constructor(code, message, quotaType, currentUsage, limit, context) {
        super({
            code,
            category: 'quota',
            severity: 'medium',
            message,
            context: { quotaType, currentUsage, limit, ...context },
            timestamp: new Date(),
            retryable: false,
            suggestions: [
                'Upgrade your plan for higher limits',
                'Clean up unused resources to free up quota',
                'Contact support to discuss your usage needs'
            ]
        });
        this.quotaType = quotaType;
        this.currentUsage = currentUsage;
        this.limit = limit;
    }
}
exports.QuotaError = QuotaError;
/**
 * Create a successful result
 */
function Ok(data) {
    return { success: true, data };
}
/**
 * Create an error result
 */
function Err(error) {
    return { success: false, error };
}
/**
 * Error codes enum for common errors
 */
exports.ErrorCodes = {
    // Validation errors
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
    // Authentication errors
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    MFA_REQUIRED: 'MFA_REQUIRED',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    // Authorization errors
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    ACCESS_DENIED: 'ACCESS_DENIED',
    ORGANIZATION_ACCESS_DENIED: 'ORGANIZATION_ACCESS_DENIED',
    WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
    // Resource errors
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
    RESOURCE_IN_USE: 'RESOURCE_IN_USE',
    RESOURCE_DELETED: 'RESOURCE_DELETED',
    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
    API_LIMIT_EXCEEDED: 'API_LIMIT_EXCEEDED',
    // External service errors
    EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    THIRD_PARTY_API_ERROR: 'THIRD_PARTY_API_ERROR',
    OAUTH_ERROR: 'OAUTH_ERROR',
    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    DNS_RESOLUTION_FAILED: 'DNS_RESOLUTION_FAILED',
    SSL_ERROR: 'SSL_ERROR',
    // Timeout errors
    OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    DATABASE_TIMEOUT: 'DATABASE_TIMEOUT',
    // Sync errors
    SYNC_FAILED: 'SYNC_FAILED',
    SYNC_CONFLICT: 'SYNC_CONFLICT',
    SYNC_VERSION_MISMATCH: 'SYNC_VERSION_MISMATCH',
    SYNC_ENCRYPTION_ERROR: 'SYNC_ENCRYPTION_ERROR',
    // Plugin errors
    PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
    PLUGIN_DISABLED: 'PLUGIN_DISABLED',
    PLUGIN_ERROR: 'PLUGIN_ERROR',
    PLUGIN_PERMISSION_DENIED: 'PLUGIN_PERMISSION_DENIED',
    PLUGIN_INCOMPATIBLE: 'PLUGIN_INCOMPATIBLE',
    // Billing errors
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    PAYMENT_DECLINED: 'PAYMENT_DECLINED',
    SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
    BILLING_ADDRESS_INVALID: 'BILLING_ADDRESS_INVALID',
    // License errors
    LICENSE_INVALID: 'LICENSE_INVALID',
    LICENSE_EXPIRED: 'LICENSE_EXPIRED',
    LICENSE_DEVICE_LIMIT_EXCEEDED: 'LICENSE_DEVICE_LIMIT_EXCEEDED',
    FEATURE_NOT_LICENSED: 'FEATURE_NOT_LICENSED',
    // Security errors
    SECURITY_VIOLATION: 'SECURITY_VIOLATION',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    IP_BLOCKED: 'IP_BLOCKED',
    SECURITY_POLICY_VIOLATION: 'SECURITY_POLICY_VIOLATION',
    // Quota errors
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
    USER_LIMIT_EXCEEDED: 'USER_LIMIT_EXCEEDED',
    API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
    // System errors
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    MAINTENANCE_MODE: 'MAINTENANCE_MODE',
    DATABASE_ERROR: 'DATABASE_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
};
/**
 * Error factory functions for common error patterns
 */
exports.Errors = {
    validation: (field, message, constraint) => new ValidationError(exports.ErrorCodes.VALIDATION_FAILED, message, field, undefined, constraint),
    notFound: (resourceType, resourceId) => new NotFoundError(exports.ErrorCodes.RESOURCE_NOT_FOUND, `${resourceType} not found`, resourceType, resourceId),
    unauthorized: (message = 'Authentication required') => new AuthenticationError(exports.ErrorCodes.INVALID_CREDENTIALS, message),
    forbidden: (permission) => new AuthorizationError(exports.ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', permission),
    conflict: (message, reason) => new ConflictError(exports.ErrorCodes.RESOURCE_ALREADY_EXISTS, message, reason),
    rateLimit: (limit, resetTime) => new RateLimitError(exports.ErrorCodes.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', limit, 0, resetTime),
    external: (service, error) => new ExternalServiceError(exports.ErrorCodes.EXTERNAL_SERVICE_ERROR, `${service} error: ${error}`, service, error),
    network: (message) => new NetworkError(exports.ErrorCodes.NETWORK_ERROR, message),
    timeout: (operation, timeout) => new TimeoutError(exports.ErrorCodes.OPERATION_TIMEOUT, `${operation} timed out`, operation, timeout),
    plugin: (pluginId, message) => new PluginError(exports.ErrorCodes.PLUGIN_ERROR, message, pluginId),
    billing: (message) => new BillingError(exports.ErrorCodes.PAYMENT_FAILED, message),
    license: (message, feature) => new LicenseError(exports.ErrorCodes.LICENSE_INVALID, message, undefined, feature),
    security: (message, event) => new SecurityError(exports.ErrorCodes.SECURITY_VIOLATION, message, event),
    quota: (quotaType, currentUsage, limit) => new QuotaError(exports.ErrorCodes.QUOTA_EXCEEDED, `${quotaType} quota exceeded`, quotaType, currentUsage, limit)
};
/**
 * Error handler utility
 */
class ErrorHandler {
    /**
     * Register error handler for specific error code
     */
    static register(code, handler) {
        this.handlers.set(code, handler);
    }
    /**
     * Handle error with registered handler
     */
    static handle(error) {
        const handler = this.handlers.get(error.code);
        if (handler) {
            handler(error);
            return true;
        }
        return false;
    }
    /**
     * Get retry delay with exponential backoff
     */
    static getRetryDelay(error, attempt) {
        const baseDelay = error.getRetryDelay();
        return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
    }
    /**
     * Check if error should be retried
     */
    static shouldRetry(error, attempt) {
        return error.isRetryable() && attempt <= (error.maxRetries || 3);
    }
}
exports.ErrorHandler = ErrorHandler;
ErrorHandler.handlers = new Map();
// Zod schema for error validation
exports.FlowDeskErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    category: zod_1.z.enum(['validation', 'authentication', 'authorization', 'not_found', 'conflict', 'rate_limit', 'external', 'internal', 'network', 'timeout', 'sync', 'plugin', 'billing', 'license', 'security', 'quota', 'maintenance', 'unknown']),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    message: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    context: zod_1.z.record(zod_1.z.any()).optional(),
    timestamp: zod_1.z.date(),
    correlationId: zod_1.z.string().optional(),
    stack: zod_1.z.string().optional(),
    suggestions: zod_1.z.array(zod_1.z.string()).optional(),
    helpUrl: zod_1.z.string().url().optional(),
    retryable: zod_1.z.boolean(),
    retryDelay: zod_1.z.number().optional(),
    maxRetries: zod_1.z.number().optional()
});
/**
 * Type guard to check if an error is a FlowDeskError
 */
function isFlowDeskError(error) {
    return error instanceof FlowDeskError;
}
/**
 * Convert unknown error to FlowDeskError
 */
function toFlowDeskError(error, correlationId) {
    if (isFlowDeskError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new FlowDeskError({
            code: exports.ErrorCodes.INTERNAL_SERVER_ERROR,
            category: 'internal',
            severity: 'high',
            message: error.message,
            context: { originalError: error.name },
            timestamp: new Date(),
            correlationId,
            stack: error.stack,
            retryable: false
        });
    }
    return new FlowDeskError({
        code: exports.ErrorCodes.INTERNAL_SERVER_ERROR,
        category: 'unknown',
        severity: 'high',
        message: 'An unknown error occurred',
        context: { originalError: String(error) },
        timestamp: new Date(),
        correlationId,
        retryable: false
    });
}
/**
 * Wrap async function to return Result instead of throwing
 */
async function wrapAsync(fn) {
    try {
        const data = await fn();
        return Ok(data);
    }
    catch (error) {
        return Err(toFlowDeskError(error));
    }
}
/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = toFlowDeskError(error);
            if (!ErrorHandler.shouldRetry(lastError, attempt)) {
                throw lastError;
            }
            if (attempt < maxRetries) {
                const delay = ErrorHandler.getRetryDelay(lastError, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=errors.js.map