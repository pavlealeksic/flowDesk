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
export type ErrorCategory = 
  | 'validation'      // Input validation errors
  | 'authentication' // Auth-related errors
  | 'authorization'  // Permission/access errors
  | 'not_found'      // Resource not found errors
  | 'conflict'       // Resource conflict errors
  | 'rate_limit'     // Rate limiting errors
  | 'external'       // External service errors
  | 'internal'       // Internal server errors
  | 'network'        // Network-related errors
  | 'timeout'        // Operation timeout errors
  | 'sync'           // Synchronization errors
  | 'plugin'         // Plugin-related errors
  | 'billing'        // Billing/payment errors
  | 'license'        // License validation errors
  | 'security'       // Security-related errors
  | 'quota'          // Quota/limit errors
  | 'maintenance'    // Maintenance mode errors
  | 'unknown';       // Unknown/unclassified errors

/**
 * Error severity levels
 */
export type ErrorSeverity = 
  | 'low'       // Minor issues, can continue
  | 'medium'    // Moderate issues, some functionality affected
  | 'high'      // Major issues, significant functionality affected
  | 'critical'; // Critical issues, system unusable

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
export class FlowDeskError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly correlationId?: string;
  public readonly suggestions?: string[];
  public readonly helpUrl?: string;
  public readonly retryable: boolean;
  public readonly retryDelay?: number;
  public readonly maxRetries?: number;

  constructor(info: BaseErrorInfo) {
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
  toJSON(): BaseErrorInfo {
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
  isCategory(category: ErrorCategory): boolean {
    return this.category === category;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    return this.retryDelay || 1000;
  }
}

/**
 * Validation error
 */
export class ValidationError extends FlowDeskError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly constraint?: string;

  constructor(
    code: string,
    message: string,
    field?: string,
    value?: any,
    constraint?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Authentication error
 */
export class AuthenticationError extends FlowDeskError {
  public readonly authenticationType?: string;

  constructor(
    code: string,
    message: string,
    authenticationType?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Authorization error
 */
export class AuthorizationError extends FlowDeskError {
  public readonly requiredPermission?: string;
  public readonly userPermissions?: string[];

  constructor(
    code: string,
    message: string,
    requiredPermission?: string,
    userPermissions?: string[],
    context?: Record<string, any>
  ) {
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

/**
 * Not found error
 */
export class NotFoundError extends FlowDeskError {
  public readonly resourceType?: string;
  public readonly resourceId?: string;

  constructor(
    code: string,
    message: string,
    resourceType?: string,
    resourceId?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Conflict error
 */
export class ConflictError extends FlowDeskError {
  public readonly conflictReason?: string;
  public readonly conflictingResource?: string;

  constructor(
    code: string,
    message: string,
    conflictReason?: string,
    conflictingResource?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Rate limit error
 */
export class RateLimitError extends FlowDeskError {
  public readonly limit?: number;
  public readonly remaining?: number;
  public readonly resetTime?: Date;

  constructor(
    code: string,
    message: string,
    limit?: number,
    remaining?: number,
    resetTime?: Date,
    context?: Record<string, any>
  ) {
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

/**
 * External service error
 */
export class ExternalServiceError extends FlowDeskError {
  public readonly service?: string;
  public readonly serviceError?: string;
  public readonly statusCode?: number;

  constructor(
    code: string,
    message: string,
    service?: string,
    serviceError?: string,
    statusCode?: number,
    context?: Record<string, any>
  ) {
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

/**
 * Network error
 */
export class NetworkError extends FlowDeskError {
  public readonly networkCode?: string;
  public readonly url?: string;

  constructor(
    code: string,
    message: string,
    networkCode?: string,
    url?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Timeout error
 */
export class TimeoutError extends FlowDeskError {
  public readonly operation?: string;
  public readonly timeout?: number;

  constructor(
    code: string,
    message: string,
    operation?: string,
    timeout?: number,
    context?: Record<string, any>
  ) {
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

/**
 * Sync error
 */
export class SyncError extends FlowDeskError {
  public readonly syncType?: string;
  public readonly conflictDetails?: any;

  constructor(
    code: string,
    message: string,
    syncType?: string,
    conflictDetails?: any,
    context?: Record<string, any>
  ) {
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

/**
 * Plugin error
 */
export class PluginError extends FlowDeskError {
  public readonly pluginId?: string;
  public readonly pluginVersion?: string;
  public readonly errorCode?: string;

  constructor(
    code: string,
    message: string,
    pluginId?: string,
    pluginVersion?: string,
    errorCode?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Billing error
 */
export class BillingError extends FlowDeskError {
  public readonly paymentMethod?: string;
  public readonly transactionId?: string;

  constructor(
    code: string,
    message: string,
    paymentMethod?: string,
    transactionId?: string,
    context?: Record<string, any>
  ) {
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

/**
 * License error
 */
export class LicenseError extends FlowDeskError {
  public readonly licenseKey?: string;
  public readonly feature?: string;

  constructor(
    code: string,
    message: string,
    licenseKey?: string,
    feature?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Security error
 */
export class SecurityError extends FlowDeskError {
  public readonly securityEvent?: string;
  public readonly threatLevel?: string;

  constructor(
    code: string,
    message: string,
    securityEvent?: string,
    threatLevel?: string,
    context?: Record<string, any>
  ) {
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

/**
 * Quota error
 */
export class QuotaError extends FlowDeskError {
  public readonly quotaType?: string;
  public readonly currentUsage?: number;
  public readonly limit?: number;

  constructor(
    code: string,
    message: string,
    quotaType?: string,
    currentUsage?: number,
    limit?: number,
    context?: Record<string, any>
  ) {
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

/**
 * Error result for operations that can fail
 */
export type Result<T, E = FlowDeskError> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Create a successful result
 */
export function Ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create an error result
 */
export function Err<E extends FlowDeskError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Error codes enum for common errors
 */
export const ErrorCodes = {
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
} as const;

/**
 * Error factory functions for common error patterns
 */
export const Errors = {
  validation: (field: string, message: string, constraint?: string) => 
    new ValidationError(ErrorCodes.VALIDATION_FAILED, message, field, undefined, constraint),

  notFound: (resourceType: string, resourceId: string) => 
    new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, `${resourceType} not found`, resourceType, resourceId),

  unauthorized: (message: string = 'Authentication required') => 
    new AuthenticationError(ErrorCodes.INVALID_CREDENTIALS, message),

  forbidden: (permission?: string) => 
    new AuthorizationError(ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', permission),

  conflict: (message: string, reason?: string) => 
    new ConflictError(ErrorCodes.RESOURCE_ALREADY_EXISTS, message, reason),

  rateLimit: (limit: number, resetTime: Date) => 
    new RateLimitError(ErrorCodes.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', limit, 0, resetTime),

  external: (service: string, error: string) => 
    new ExternalServiceError(ErrorCodes.EXTERNAL_SERVICE_ERROR, `${service} error: ${error}`, service, error),

  network: (message: string) => 
    new NetworkError(ErrorCodes.NETWORK_ERROR, message),

  timeout: (operation: string, timeout: number) => 
    new TimeoutError(ErrorCodes.OPERATION_TIMEOUT, `${operation} timed out`, operation, timeout),

  plugin: (pluginId: string, message: string) => 
    new PluginError(ErrorCodes.PLUGIN_ERROR, message, pluginId),

  billing: (message: string) => 
    new BillingError(ErrorCodes.PAYMENT_FAILED, message),

  license: (message: string, feature?: string) => 
    new LicenseError(ErrorCodes.LICENSE_INVALID, message, undefined, feature),

  security: (message: string, event?: string) => 
    new SecurityError(ErrorCodes.SECURITY_VIOLATION, message, event),

  quota: (quotaType: string, currentUsage: number, limit: number) => 
    new QuotaError(ErrorCodes.QUOTA_EXCEEDED, `${quotaType} quota exceeded`, quotaType, currentUsage, limit)
};

/**
 * Error handler utility
 */
export class ErrorHandler {
  private static handlers: Map<string, (error: FlowDeskError) => void> = new Map();

  /**
   * Register error handler for specific error code
   */
  static register(code: string, handler: (error: FlowDeskError) => void): void {
    this.handlers.set(code, handler);
  }

  /**
   * Handle error with registered handler
   */
  static handle(error: FlowDeskError): boolean {
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
  static getRetryDelay(error: FlowDeskError, attempt: number): number {
    const baseDelay = error.getRetryDelay();
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }

  /**
   * Check if error should be retried
   */
  static shouldRetry(error: FlowDeskError, attempt: number): boolean {
    return error.isRetryable() && attempt <= (error.maxRetries || 3);
  }
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

// Zod schema for error validation
export const FlowDeskErrorSchema = z.object({
  code: z.string(),
  category: z.enum(['validation', 'authentication', 'authorization', 'not_found', 'conflict', 'rate_limit', 'external', 'internal', 'network', 'timeout', 'sync', 'plugin', 'billing', 'license', 'security', 'quota', 'maintenance', 'unknown']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string(),
  description: z.string().optional(),
  context: z.record(z.any()).optional(),
  timestamp: z.date(),
  correlationId: z.string().optional(),
  stack: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  helpUrl: z.string().url().optional(),
  retryable: z.boolean(),
  retryDelay: z.number().optional(),
  maxRetries: z.number().optional()
});

/**
 * Type guard to check if an error is a FlowDeskError
 */
export function isFlowDeskError(error: unknown): error is FlowDeskError {
  return error instanceof FlowDeskError;
}

/**
 * Convert unknown error to FlowDeskError
 */
export function toFlowDeskError(error: unknown, correlationId?: string): FlowDeskError {
  if (isFlowDeskError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new FlowDeskError({
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
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
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
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
export async function wrapAsync<T>(fn: () => Promise<T>): Promise<Result<T, FlowDeskError>> {
  try {
    const data = await fn();
    return Ok(data);
  } catch (error) {
    return Err(toFlowDeskError(error));
  }
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: FlowDeskError | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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

  throw lastError!;
}