/**
 * Comprehensive Error Type System for Flow Desk
 * 
 * This module defines all error types, categories, and classification
 * for consistent error handling throughout the application.
 */

// Base error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories for different handling strategies
export type ErrorCategory = 
  | 'user'        // User-caused errors (invalid input, permissions, etc.)
  | 'system'      // System-level errors (filesystem, memory, etc.)
  | 'network'     // Network-related errors (connectivity, timeouts, etc.)
  | 'security'    // Security-related errors (unauthorized access, etc.)
  | 'validation'  // Data validation errors
  | 'business'    // Business logic errors
  | 'integration' // Third-party integration errors
  | 'unknown';    // Unclassified errors

// Specific error domains within the application
export type ErrorDomain = 
  | 'workspace'
  | 'service'
  | 'ipc'
  | 'storage'
  | 'ui'
  | 'plugin'
  | 'auth'
  | 'search'
  | 'notification'
  | 'theme'
  | 'browserView'
  | 'general';

// Error codes for programmatic handling
export type ErrorCode =
  // Workspace errors
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_CREATION_FAILED'
  | 'WORKSPACE_DELETION_FAILED'
  | 'WORKSPACE_SWITCH_FAILED'
  | 'WORKSPACE_UPDATE_FAILED'
  | 'WORKSPACE_DATA_CORRUPTED'
  | 'WORKSPACE_PERMISSION_DENIED'
  
  // Service errors
  | 'SERVICE_NOT_FOUND'
  | 'SERVICE_CREATION_FAILED'
  | 'SERVICE_LOAD_FAILED'
  | 'SERVICE_URL_INVALID'
  | 'SERVICE_PERMISSION_DENIED'
  | 'SERVICE_TIMEOUT'
  | 'SERVICE_NETWORK_ERROR'
  
  // IPC errors
  | 'IPC_HANDLER_NOT_FOUND'
  | 'IPC_COMMUNICATION_FAILED'
  | 'IPC_TIMEOUT'
  | 'IPC_SERIALIZATION_ERROR'
  | 'IPC_PERMISSION_DENIED'
  
  // Storage errors
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_PERMISSION_DENIED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_CORRUPTED'
  | 'STORAGE_NOT_FOUND'
  
  // UI errors
  | 'UI_COMPONENT_CRASHED'
  | 'UI_RENDER_FAILED'
  | 'UI_EVENT_HANDLER_FAILED'
  | 'UI_VALIDATION_FAILED'
  | 'UI_ACCESSIBILITY_ERROR'
  
  // Plugin errors
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_EXECUTION_FAILED'
  | 'PLUGIN_SECURITY_VIOLATION'
  | 'PLUGIN_VERSION_INCOMPATIBLE'
  
  // Browser view errors
  | 'BROWSER_VIEW_CREATION_FAILED'
  | 'BROWSER_VIEW_LOAD_FAILED'
  | 'BROWSER_VIEW_NAVIGATION_BLOCKED'
  | 'BROWSER_VIEW_SECURITY_ERROR'
  
  // System errors
  | 'SYSTEM_RESOURCE_EXHAUSTED'
  | 'SYSTEM_PERMISSION_DENIED'
  | 'SYSTEM_SERVICE_UNAVAILABLE'
  | 'SYSTEM_CONFIGURATION_INVALID'
  
  // Network errors
  | 'NETWORK_UNREACHABLE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_DNS_FAILED'
  | 'NETWORK_SSL_ERROR'
  | 'NETWORK_RATE_LIMITED'
  
  // Generic errors
  | 'UNKNOWN_ERROR'
  | 'INITIALIZATION_FAILED'
  | 'OPERATION_CANCELLED'
  | 'OPERATION_TIMEOUT'
  | 'INVALID_ARGUMENT'
  | 'PRECONDITION_FAILED';

// Recovery actions that can be suggested to users
export type RecoveryAction = 
  | 'retry'
  | 'refresh'
  | 'restart_app'
  | 'clear_cache'
  | 'check_network'
  | 'contact_support'
  | 'ignore'
  | 'update_app'
  | 'change_settings'
  | 'login_again'
  | 'free_disk_space'
  | 'check_permissions';

// Context information attached to errors
export interface ErrorContext {
  // Core identification
  domain: ErrorDomain;
  operation?: string;
  timestamp: string;
  
  // User context
  userId?: string;
  sessionId?: string;
  
  // Workspace context
  workspaceId?: string;
  serviceId?: string;
  
  // Technical context
  component?: string;
  function?: string;
  line?: number;
  
  // System context
  platform?: string;
  version?: string;
  memory?: number;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
}

// User-friendly error information
export interface ErrorMessage {
  title: string;
  description: string;
  details?: string;
  helpUrl?: string;
  recoveryInstructions?: string[];
}

// Retry configuration for retryable operations
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// Main error interface
export interface AppError extends Error {
  // Core properties
  readonly id: string;
  readonly code: ErrorCode;
  readonly domain: ErrorDomain;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly timestamp: string;
  
  // Error chain
  readonly cause?: Error | AppError;
  readonly originalError?: Error;
  
  // Context and metadata
  readonly context: ErrorContext;
  readonly userMessage: ErrorMessage;
  
  // Recovery information
  readonly isRetryable: boolean;
  readonly retryConfig?: RetryConfig;
  readonly recoveryActions: RecoveryAction[];
  
  // Tracking
  readonly reportable: boolean;
  readonly logged: boolean;
  
  // Additional data
  readonly metadata?: Record<string, unknown>;
}

// Error builder pattern for creating errors
export interface ErrorBuilder {
  code(code: ErrorCode): ErrorBuilder;
  domain(domain: ErrorDomain): ErrorBuilder;
  category(category: ErrorCategory): ErrorBuilder;
  severity(severity: ErrorSeverity): ErrorBuilder;
  cause(error: Error | AppError): ErrorBuilder;
  context(context: Partial<ErrorContext>): ErrorBuilder;
  message(title: string, description?: string): ErrorBuilder;
  retryable(config?: Partial<RetryConfig>): ErrorBuilder;
  recoveryActions(...actions: RecoveryAction[]): ErrorBuilder;
  metadata(data: Record<string, unknown>): ErrorBuilder;
  reportable(report?: boolean): ErrorBuilder;
  build(): AppError;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  // Logging configuration
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // User notification configuration
  showUserNotifications: boolean;
  notificationThreshold: ErrorSeverity;
  
  // Retry configuration defaults
  defaultRetryConfig: RetryConfig;
  
  // Recovery configuration
  enableAutoRecovery: boolean;
  autoRecoveryActions: RecoveryAction[];
  
  // Reporting configuration
  enableErrorReporting: boolean;
  reportingEndpoint?: string;
  reportingThreshold: ErrorSeverity;
  
  // Development configuration
  developmentMode: boolean;
  showStackTraces: boolean;
  enableDebugInfo: boolean;
}

// Error statistics and metrics
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByDomain: Record<ErrorDomain, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: AppError[];
  topErrors: Array<{ code: ErrorCode; count: number }>;
}

// Error handler interface
export interface IErrorHandler {
  // Core error processing
  handleError(error: Error | AppError, context?: Partial<ErrorContext>): Promise<AppError>;
  
  // Classification
  classifyError(error: Error): { code: ErrorCode; category: ErrorCategory; domain: ErrorDomain };
  
  // Recovery
  shouldRetry(error: AppError): boolean;
  getRecoveryActions(error: AppError): RecoveryAction[];
  executeRecovery(error: AppError, action: RecoveryAction): Promise<boolean>;
  
  // User interaction
  notifyUser(error: AppError): Promise<void>;
  getUserChoice(error: AppError, actions: RecoveryAction[]): Promise<RecoveryAction | null>;
  
  // Statistics and monitoring
  getStats(): ErrorStats;
  clearStats(): void;
  
  // Configuration
  updateConfig(config: Partial<ErrorHandlerConfig>): void;
  getConfig(): ErrorHandlerConfig;
}

// Factory function type for creating AppErrors
export type ErrorFactory = {
  workspace: {
    notFound(id: string, context?: Partial<ErrorContext>): AppError;
    creationFailed(reason: string, context?: Partial<ErrorContext>): AppError;
    switchFailed(id: string, reason: string, context?: Partial<ErrorContext>): AppError;
    updateFailed(id: string, reason: string, context?: Partial<ErrorContext>): AppError;
    permissionDenied(id: string, action: string, context?: Partial<ErrorContext>): AppError;
  };
  
  service: {
    notFound(id: string, context?: Partial<ErrorContext>): AppError;
    loadFailed(id: string, reason: string, context?: Partial<ErrorContext>): AppError;
    invalidUrl(url: string, context?: Partial<ErrorContext>): AppError;
    timeout(id: string, timeoutMs: number, context?: Partial<ErrorContext>): AppError;
    networkError(id: string, networkError: Error, context?: Partial<ErrorContext>): AppError;
  };
  
  ipc: {
    handlerNotFound(channel: string, context?: Partial<ErrorContext>): AppError;
    communicationFailed(channel: string, reason: string, context?: Partial<ErrorContext>): AppError;
    timeout(channel: string, timeoutMs: number, context?: Partial<ErrorContext>): AppError;
    serializationError(channel: string, data: unknown, context?: Partial<ErrorContext>): AppError;
  };
  
  ui: {
    componentCrashed(component: string, error: Error, context?: Partial<ErrorContext>): AppError;
    renderFailed(component: string, reason: string, context?: Partial<ErrorContext>): AppError;
    validationFailed(field: string, value: unknown, rule: string, context?: Partial<ErrorContext>): AppError;
  };
  
  system: {
    resourceExhausted(resource: string, current: number, limit: number, context?: Partial<ErrorContext>): AppError;
    permissionDenied(operation: string, resource: string, context?: Partial<ErrorContext>): AppError;
    configurationInvalid(setting: string, value: unknown, context?: Partial<ErrorContext>): AppError;
  };
  
  network: {
    unreachable(url: string, context?: Partial<ErrorContext>): AppError;
    timeout(url: string, timeoutMs: number, context?: Partial<ErrorContext>): AppError;
    sslError(url: string, sslError: Error, context?: Partial<ErrorContext>): AppError;
  };
  
  // Generic error creation
  create(code: ErrorCode, message: string, context?: Partial<ErrorContext>): AppError;
  fromError(error: Error, context?: Partial<ErrorContext>): AppError;
};

// Event types for error system
export type ErrorEvent = 
  | 'error-occurred'
  | 'error-resolved'
  | 'error-dismissed'
  | 'recovery-attempted'
  | 'recovery-succeeded'
  | 'recovery-failed'
  | 'user-action-taken';

export interface ErrorEventData {
  error: AppError;
  action?: RecoveryAction;
  success?: boolean;
  userChoice?: string;
  timestamp: string;
}

// Error system event emitter interface
export interface IErrorEventEmitter {
  on(event: ErrorEvent, handler: (data: ErrorEventData) => void): void;
  off(event: ErrorEvent, handler: (data: ErrorEventData) => void): void;
  emit(event: ErrorEvent, data: ErrorEventData): void;
}