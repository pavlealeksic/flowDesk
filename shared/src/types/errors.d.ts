/**
 * Error Types for Flow Desk
 *
 * Defines comprehensive error classes, error codes, and error handling
 * utilities with proper inheritance and type safety.
 */
import { z } from 'zod';
/**
 * Base error categories
 */
export type ErrorCategory = 'validation' | 'authentication' | 'authorization' | 'not_found' | 'conflict' | 'rate_limit' | 'external' | 'internal' | 'network' | 'timeout' | 'sync' | 'plugin' | 'billing' | 'license' | 'security' | 'quota' | 'maintenance' | 'unknown';
/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
/**
 * Base error interface
 */
export interface BaseErrorInfo {
    /** Error code */
    code: string;
    /** Error category */
    category: ErrorCategory;
    /** Error severity */
    severity: ErrorSeverity;
    /** Human-readable error message */
    message: string;
    /** Detailed error description */
    description?: string;
    /** Additional error context */
    context?: Record<string, any>;
    /** Timestamp when error occurred */
    timestamp: Date;
    /** Correlation ID for tracing */
    correlationId?: string;
    /** Stack trace (in development) */
    stack?: string;
    /** Suggested actions for resolution */
    suggestions?: string[];
    /** Help documentation URL */
    helpUrl?: string;
    /** Whether error is retryable */
    retryable: boolean;
    /** Retry delay in milliseconds */
    retryDelay?: number;
    /** Maximum retry attempts */
    maxRetries?: number;
}
/**
 * Base FlowDesk error class
 */
export declare class FlowDeskError extends Error {
    readonly code: string;
    readonly category: ErrorCategory;
    readonly severity: ErrorSeverity;
    readonly context?: Record<string, any>;
    readonly timestamp: Date;
    readonly correlationId?: string;
    readonly suggestions?: string[];
    readonly helpUrl?: string;
    readonly retryable: boolean;
    readonly retryDelay?: number;
    readonly maxRetries?: number;
    constructor(info: BaseErrorInfo);
    /**
     * Convert error to JSON representation
     */
    toJSON(): BaseErrorInfo;
    /**
     * Check if error is of a specific category
     */
    isCategory(category: ErrorCategory): boolean;
    /**
     * Check if error is retryable
     */
    isRetryable(): boolean;
    /**
     * Get retry delay in milliseconds
     */
    getRetryDelay(): number;
}
/**
 * Validation error
 */
export declare class ValidationError extends FlowDeskError {
    readonly field?: string;
    readonly value?: any;
    readonly constraint?: string;
    constructor(code: string, message: string, field?: string, value?: any, constraint?: string, context?: Record<string, any>);
}
/**
 * Authentication error
 */
export declare class AuthenticationError extends FlowDeskError {
    readonly authenticationType?: string;
    constructor(code: string, message: string, authenticationType?: string, context?: Record<string, any>);
}
/**
 * Authorization error
 */
export declare class AuthorizationError extends FlowDeskError {
    readonly requiredPermission?: string;
    readonly userPermissions?: string[];
    constructor(code: string, message: string, requiredPermission?: string, userPermissions?: string[], context?: Record<string, any>);
}
/**
 * Not found error
 */
export declare class NotFoundError extends FlowDeskError {
    readonly resourceType?: string;
    readonly resourceId?: string;
    constructor(code: string, message: string, resourceType?: string, resourceId?: string, context?: Record<string, any>);
}
/**
 * Conflict error
 */
export declare class ConflictError extends FlowDeskError {
    readonly conflictReason?: string;
    readonly conflictingResource?: string;
    constructor(code: string, message: string, conflictReason?: string, conflictingResource?: string, context?: Record<string, any>);
}
/**
 * Rate limit error
 */
export declare class RateLimitError extends FlowDeskError {
    readonly limit?: number;
    readonly remaining?: number;
    readonly resetTime?: Date;
    constructor(code: string, message: string, limit?: number, remaining?: number, resetTime?: Date, context?: Record<string, any>);
}
/**
 * External service error
 */
export declare class ExternalServiceError extends FlowDeskError {
    readonly service?: string;
    readonly serviceError?: string;
    readonly statusCode?: number;
    constructor(code: string, message: string, service?: string, serviceError?: string, statusCode?: number, context?: Record<string, any>);
}
/**
 * Network error
 */
export declare class NetworkError extends FlowDeskError {
    readonly networkCode?: string;
    readonly url?: string;
    constructor(code: string, message: string, networkCode?: string, url?: string, context?: Record<string, any>);
}
/**
 * Timeout error
 */
export declare class TimeoutError extends FlowDeskError {
    readonly operation?: string;
    readonly timeout?: number;
    constructor(code: string, message: string, operation?: string, timeout?: number, context?: Record<string, any>);
}
/**
 * Sync error
 */
export declare class SyncError extends FlowDeskError {
    readonly syncType?: string;
    readonly conflictDetails?: any;
    constructor(code: string, message: string, syncType?: string, conflictDetails?: any, context?: Record<string, any>);
}
/**
 * Plugin error
 */
export declare class PluginError extends FlowDeskError {
    readonly pluginId?: string;
    readonly pluginVersion?: string;
    readonly errorCode?: string;
    constructor(code: string, message: string, pluginId?: string, pluginVersion?: string, errorCode?: string, context?: Record<string, any>);
}
/**
 * Billing error
 */
export declare class BillingError extends FlowDeskError {
    readonly paymentMethod?: string;
    readonly transactionId?: string;
    constructor(code: string, message: string, paymentMethod?: string, transactionId?: string, context?: Record<string, any>);
}
/**
 * License error
 */
export declare class LicenseError extends FlowDeskError {
    readonly licenseKey?: string;
    readonly feature?: string;
    constructor(code: string, message: string, licenseKey?: string, feature?: string, context?: Record<string, any>);
}
/**
 * Security error
 */
export declare class SecurityError extends FlowDeskError {
    readonly securityEvent?: string;
    readonly threatLevel?: string;
    constructor(code: string, message: string, securityEvent?: string, threatLevel?: string, context?: Record<string, any>);
}
/**
 * Quota error
 */
export declare class QuotaError extends FlowDeskError {
    readonly quotaType?: string;
    readonly currentUsage?: number;
    readonly limit?: number;
    constructor(code: string, message: string, quotaType?: string, currentUsage?: number, limit?: number, context?: Record<string, any>);
}
/**
 * Error result for operations that can fail
 */
export type Result<T, E = FlowDeskError> = {
    success: true;
    data: T;
    error?: never;
} | {
    success: false;
    data?: never;
    error: E;
};
/**
 * Create a successful result
 */
export declare function Ok<T>(data: T): Result<T>;
/**
 * Create an error result
 */
export declare function Err<E extends FlowDeskError>(error: E): Result<never, E>;
/**
 * Error codes enum for common errors
 */
export declare const ErrorCodes: {
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD";
    readonly INVALID_FORMAT: "INVALID_FORMAT";
    readonly VALUE_OUT_OF_RANGE: "VALUE_OUT_OF_RANGE";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly TOKEN_INVALID: "TOKEN_INVALID";
    readonly MFA_REQUIRED: "MFA_REQUIRED";
    readonly ACCOUNT_LOCKED: "ACCOUNT_LOCKED";
    readonly SESSION_EXPIRED: "SESSION_EXPIRED";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly ACCESS_DENIED: "ACCESS_DENIED";
    readonly ORGANIZATION_ACCESS_DENIED: "ORGANIZATION_ACCESS_DENIED";
    readonly WORKSPACE_ACCESS_DENIED: "WORKSPACE_ACCESS_DENIED";
    readonly RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
    readonly RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS";
    readonly RESOURCE_IN_USE: "RESOURCE_IN_USE";
    readonly RESOURCE_DELETED: "RESOURCE_DELETED";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS";
    readonly API_LIMIT_EXCEEDED: "API_LIMIT_EXCEEDED";
    readonly EXTERNAL_SERVICE_UNAVAILABLE: "EXTERNAL_SERVICE_UNAVAILABLE";
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
    readonly THIRD_PARTY_API_ERROR: "THIRD_PARTY_API_ERROR";
    readonly OAUTH_ERROR: "OAUTH_ERROR";
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly CONNECTION_FAILED: "CONNECTION_FAILED";
    readonly DNS_RESOLUTION_FAILED: "DNS_RESOLUTION_FAILED";
    readonly SSL_ERROR: "SSL_ERROR";
    readonly OPERATION_TIMEOUT: "OPERATION_TIMEOUT";
    readonly REQUEST_TIMEOUT: "REQUEST_TIMEOUT";
    readonly DATABASE_TIMEOUT: "DATABASE_TIMEOUT";
    readonly SYNC_FAILED: "SYNC_FAILED";
    readonly SYNC_CONFLICT: "SYNC_CONFLICT";
    readonly SYNC_VERSION_MISMATCH: "SYNC_VERSION_MISMATCH";
    readonly SYNC_ENCRYPTION_ERROR: "SYNC_ENCRYPTION_ERROR";
    readonly PLUGIN_NOT_FOUND: "PLUGIN_NOT_FOUND";
    readonly PLUGIN_DISABLED: "PLUGIN_DISABLED";
    readonly PLUGIN_ERROR: "PLUGIN_ERROR";
    readonly PLUGIN_PERMISSION_DENIED: "PLUGIN_PERMISSION_DENIED";
    readonly PLUGIN_INCOMPATIBLE: "PLUGIN_INCOMPATIBLE";
    readonly PAYMENT_FAILED: "PAYMENT_FAILED";
    readonly PAYMENT_DECLINED: "PAYMENT_DECLINED";
    readonly SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED";
    readonly BILLING_ADDRESS_INVALID: "BILLING_ADDRESS_INVALID";
    readonly LICENSE_INVALID: "LICENSE_INVALID";
    readonly LICENSE_EXPIRED: "LICENSE_EXPIRED";
    readonly LICENSE_DEVICE_LIMIT_EXCEEDED: "LICENSE_DEVICE_LIMIT_EXCEEDED";
    readonly FEATURE_NOT_LICENSED: "FEATURE_NOT_LICENSED";
    readonly SECURITY_VIOLATION: "SECURITY_VIOLATION";
    readonly SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY";
    readonly IP_BLOCKED: "IP_BLOCKED";
    readonly SECURITY_POLICY_VIOLATION: "SECURITY_POLICY_VIOLATION";
    readonly QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    readonly STORAGE_QUOTA_EXCEEDED: "STORAGE_QUOTA_EXCEEDED";
    readonly USER_LIMIT_EXCEEDED: "USER_LIMIT_EXCEEDED";
    readonly API_QUOTA_EXCEEDED: "API_QUOTA_EXCEEDED";
    readonly INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly MAINTENANCE_MODE: "MAINTENANCE_MODE";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly CONFIGURATION_ERROR: "CONFIGURATION_ERROR";
};
/**
 * Error factory functions for common error patterns
 */
export declare const Errors: {
    validation: (field: string, message: string, constraint?: string) => ValidationError;
    notFound: (resourceType: string, resourceId: string) => NotFoundError;
    unauthorized: (message?: string) => AuthenticationError;
    forbidden: (permission?: string) => AuthorizationError;
    conflict: (message: string, reason?: string) => ConflictError;
    rateLimit: (limit: number, resetTime: Date) => RateLimitError;
    external: (service: string, error: string) => ExternalServiceError;
    network: (message: string) => NetworkError;
    timeout: (operation: string, timeout: number) => TimeoutError;
    plugin: (pluginId: string, message: string) => PluginError;
    billing: (message: string) => BillingError;
    license: (message: string, feature?: string) => LicenseError;
    security: (message: string, event?: string) => SecurityError;
    quota: (quotaType: string, currentUsage: number, limit: number) => QuotaError;
};
/**
 * Error handler utility
 */
export declare class ErrorHandler {
    private static handlers;
    /**
     * Register error handler for specific error code
     */
    static register(code: string, handler: (error: FlowDeskError) => void): void;
    /**
     * Handle error with registered handler
     */
    static handle(error: FlowDeskError): boolean;
    /**
     * Get retry delay with exponential backoff
     */
    static getRetryDelay(error: FlowDeskError, attempt: number): number;
    /**
     * Check if error should be retried
     */
    static shouldRetry(error: FlowDeskError, attempt: number): boolean;
}
/**
 * Error logging utility
 */
export interface ErrorLogEntry {
    /** Error ID */
    id: string;
    /** Error instance */
    error: FlowDeskError;
    /** User ID (if available) */
    userId?: string;
    /** Organization ID (if available) */
    organizationId?: string;
    /** Request ID (if available) */
    requestId?: string;
    /** Additional context */
    context?: Record<string, any>;
    /** Log timestamp */
    timestamp: Date;
}
/**
 * Error metrics for monitoring
 */
export interface ErrorMetrics {
    /** Time period */
    period: {
        start: Date;
        end: Date;
    };
    /** Total errors */
    total: number;
    /** Errors by category */
    byCategory: Record<ErrorCategory, number>;
    /** Errors by code */
    byCode: Record<string, number>;
    /** Errors by severity */
    bySeverity: Record<ErrorSeverity, number>;
    /** Error rate (errors per request) */
    errorRate: number;
    /** Top error codes */
    topErrors: Array<{
        code: string;
        count: number;
        percentage: number;
    }>;
    /** Retry statistics */
    retries: {
        totalRetries: number;
        successfulRetries: number;
        retrySuccessRate: number;
    };
}
export declare const FlowDeskErrorSchema: z.ZodObject<{
    code: z.ZodString;
    category: z.ZodEnum<["validation", "authentication", "authorization", "not_found", "conflict", "rate_limit", "external", "internal", "network", "timeout", "sync", "plugin", "billing", "license", "security", "quota", "maintenance", "unknown"]>;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    message: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodDate;
    correlationId: z.ZodOptional<z.ZodString>;
    stack: z.ZodOptional<z.ZodString>;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    helpUrl: z.ZodOptional<z.ZodString>;
    retryable: z.ZodBoolean;
    retryDelay: z.ZodOptional<z.ZodNumber>;
    maxRetries: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    category: "validation" | "unknown" | "billing" | "license" | "network" | "plugin" | "authentication" | "authorization" | "security" | "not_found" | "conflict" | "rate_limit" | "external" | "internal" | "timeout" | "sync" | "quota" | "maintenance";
    severity: "high" | "low" | "critical" | "medium";
    timestamp: Date;
    retryable: boolean;
    description?: string | undefined;
    context?: Record<string, any> | undefined;
    correlationId?: string | undefined;
    stack?: string | undefined;
    suggestions?: string[] | undefined;
    helpUrl?: string | undefined;
    retryDelay?: number | undefined;
    maxRetries?: number | undefined;
}, {
    code: string;
    message: string;
    category: "validation" | "unknown" | "billing" | "license" | "network" | "plugin" | "authentication" | "authorization" | "security" | "not_found" | "conflict" | "rate_limit" | "external" | "internal" | "timeout" | "sync" | "quota" | "maintenance";
    severity: "high" | "low" | "critical" | "medium";
    timestamp: Date;
    retryable: boolean;
    description?: string | undefined;
    context?: Record<string, any> | undefined;
    correlationId?: string | undefined;
    stack?: string | undefined;
    suggestions?: string[] | undefined;
    helpUrl?: string | undefined;
    retryDelay?: number | undefined;
    maxRetries?: number | undefined;
}>;
/**
 * Type guard to check if an error is a FlowDeskError
 */
export declare function isFlowDeskError(error: unknown): error is FlowDeskError;
/**
 * Convert unknown error to FlowDeskError
 */
export declare function toFlowDeskError(error: unknown, correlationId?: string): FlowDeskError;
/**
 * Utility type for error-first callbacks
 */
export type ErrorCallback<T = any> = (error?: FlowDeskError, result?: T) => void;
/**
 * Utility type for async operations that can throw FlowDeskError
 */
export type AsyncResult<T> = Promise<Result<T, FlowDeskError>>;
/**
 * Wrap async function to return Result instead of throwing
 */
export declare function wrapAsync<T>(fn: () => Promise<T>): Promise<Result<T, FlowDeskError>>;
/**
 * Retry wrapper with exponential backoff
 */
export declare function withRetry<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
//# sourceMappingURL=errors.d.ts.map