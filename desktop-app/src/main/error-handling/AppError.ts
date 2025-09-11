/**
 * Application Error System for Flow Desk
 * 
 * Comprehensive error handling system with typed errors, recovery mechanisms,
 * and proper error propagation throughout the application.
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { configManager } from '../config/AppConfig';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',           // Non-critical errors that don't affect functionality
  MEDIUM = 'medium',     // Errors that partially affect functionality
  HIGH = 'high',         // Critical errors that significantly impact functionality
  CRITICAL = 'critical'  // Errors that cause application failure
}

/**
 * Error categories for classification and handling
 */
export enum ErrorCategory {
  // Workspace and service errors
  WORKSPACE = 'workspace',
  SERVICE = 'service',
  
  // System errors
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  DATABASE = 'database',
  
  // Security errors
  SECURITY = 'security',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  
  // Configuration errors
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  
  // External service errors
  EXTERNAL_SERVICE = 'external_service',
  PLUGIN = 'plugin',
  
  // User interface errors
  UI = 'ui',
  RENDERER = 'renderer',
  
  // System errors
  SYSTEM = 'system',
  MEMORY = 'memory',
  PERFORMANCE = 'performance',
  
  // Unknown errors
  UNKNOWN = 'unknown'
}

/**
 * Error codes for specific error types
 */
export enum ErrorCode {
  // Workspace errors
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  WORKSPACE_CREATION_FAILED = 'WORKSPACE_CREATION_FAILED',
  WORKSPACE_DELETION_FAILED = 'WORKSPACE_DELETION_FAILED',
  WORKSPACE_SWITCH_FAILED = 'WORKSPACE_SWITCH_FAILED',
  WORKSPACE_UPDATE_FAILED = 'WORKSPACE_UPDATE_FAILED',
  WORKSPACE_LOAD_FAILED = 'WORKSPACE_LOAD_FAILED',
  WORKSPACE_DATA_CORRUPTED = 'WORKSPACE_DATA_CORRUPTED',
  WORKSPACE_LIMIT_EXCEEDED = 'WORKSPACE_LIMIT_EXCEEDED',
  
  // Service errors
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  SERVICE_CREATION_FAILED = 'SERVICE_CREATION_FAILED',
  SERVICE_LOAD_FAILED = 'SERVICE_LOAD_FAILED',
  SERVICE_DELETE_FAILED = 'SERVICE_DELETE_FAILED',
  SERVICE_UPDATE_FAILED = 'SERVICE_UPDATE_FAILED',
  SERVICE_URL_INVALID = 'SERVICE_URL_INVALID',
  SERVICE_NETWORK_ERROR = 'SERVICE_NETWORK_ERROR',
  SERVICE_TIMEOUT = 'SERVICE_TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_LIMIT_EXCEEDED = 'SERVICE_LIMIT_EXCEEDED',
  
  // Network errors
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  SSL_ERROR = 'SSL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  STORAGE_FULL = 'STORAGE_FULL',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  PATH_INVALID = 'PATH_INVALID',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',
  DATABASE_INTEGRITY_ERROR = 'DATABASE_INTEGRITY_ERROR',
  
  // Security errors
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SANITIZATION_ERROR = 'SANITIZATION_ERROR',
  
  // Configuration errors
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',
  CONFIG_UPDATE_FAILED = 'CONFIG_UPDATE_FAILED',
  CONFIG_MISSING = 'CONFIG_MISSING',
  
  // Plugin errors
  PLUGIN_LOAD_FAILED = 'PLUGIN_LOAD_FAILED',
  PLUGIN_EXECUTION_FAILED = 'PLUGIN_EXECUTION_FAILED',
  PLUGIN_TIMEOUT = 'PLUGIN_TIMEOUT',
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_INCOMPATIBLE = 'PLUGIN_INCOMPATIBLE',
  
  // System errors
  MEMORY_EXHAUSTED = 'MEMORY_EXHAUSTED',
  PROCESS_CRASHED = 'PROCESS_CRASHED',
  SYSTEM_RESOURCE_EXHAUSTED = 'SYSTEM_RESOURCE_EXHAUSTED',
  PERFORMANCE_DEGRADED = 'PERFORMANCE_DEGRADED',
  
  // UI errors
  RENDERER_CRASHED = 'RENDERER_CRASHED',
  UI_UNRESPONSIVE = 'UI_UNRESPONSIVE',
  COMPONENT_ERROR = 'COMPONENT_ERROR',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  id: string;
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
  destructive?: boolean;
  requiresConfirmation?: boolean;
}

/**
 * Context information for errors
 */
export interface ErrorContext {
  operation?: string;
  component?: string;
  workspaceId?: string;
  serviceId?: string;
  userId?: string;
  timestamp: Date;
  additionalData?: Record<string, unknown>;
}

/**
 * Main application error interface
 */
export interface AppError extends Error {
  readonly id: string;
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly context: ErrorContext;
  readonly isRetryable: boolean;
  readonly recoveryActions: RecoveryAction[];
  readonly cause?: Error;
  readonly stackTrace?: string;
  readonly timestamp: Date;
  readonly retryCount: number;
  readonly maxRetries: number;
  
  // Methods
  retry(): Promise<void>;
  addRecoveryAction(action: RecoveryAction): void;
  toJSON(): Record<string, unknown>;
}

/**
 * Base implementation of AppError
 */
export class BaseAppError extends Error implements AppError {
  readonly id: string;
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly context: ErrorContext;
  readonly isRetryable: boolean;
  readonly recoveryActions: RecoveryAction[];
  readonly cause?: Error;
  readonly stackTrace?: string;
  readonly timestamp: Date;
  retryCount: number;
  readonly maxRetries: number;

  constructor(
    code: ErrorCode,
    userMessage: string,
    technicalMessage: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: Partial<ErrorContext> = {},
    isRetryable: boolean = true,
    cause?: Error,
    recoveryActions: RecoveryAction[] = []
  ) {
    super(technicalMessage);
    
    this.id = generateErrorId();
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.userMessage = userMessage;
    this.technicalMessage = technicalMessage;
    this.context = {
      timestamp: new Date(),
      ...context
    };
    this.isRetryable = isRetryable;
    this.recoveryActions = [...recoveryActions];
    this.cause = cause;
    this.timestamp = new Date();
    this.retryCount = 0;
    
    // Get max retries from config
    const errorConfig = configManager.getErrorHandlingConfig();
    this.maxRetries = errorConfig.maxRetryAttempts;
    
    // Set stack trace
    this.stackTrace = this.stack;
    
    // Set name
    this.name = 'AppError';
  }

  async retry(): Promise<void> {
    if (!this.isRetryable) {
      throw new Error(`Error ${this.code} is not retryable`);
    }
    
    if (this.retryCount >= this.maxRetries) {
      throw new Error(`Maximum retry attempts (${this.maxRetries}) exceeded for error ${this.code}`);
    }
    
    this.retryCount++;
    
    // Execute retry logic if available
    const retryAction = this.recoveryActions.find(action => action.id === 'retry');
    if (retryAction) {
      await retryAction.action();
    }
  }

  addRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.push(action);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      code: this.code,
      category: this.category,
      severity: this.severity,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      context: this.context,
      isRetryable: this.isRetryable,
      recoveryActions: this.recoveryActions,
      cause: this.cause?.message,
      timestamp: this.timestamp.toISOString(),
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }
}

/**
 * Error factory functions for creating specific error types
 */
export class ErrorFactory {
  // Workspace errors
  static workspaceNotFound(workspaceId: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.WORKSPACE_NOT_FOUND,
      `The workspace you're looking for doesn't exist or has been removed.`,
      `Workspace not found: ${workspaceId}`,
      ErrorCategory.WORKSPACE,
      ErrorSeverity.MEDIUM,
      { workspaceId },
      false,
      cause
    );
  }

  static workspaceCreationFailed(name: string, reason?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.WORKSPACE_CREATION_FAILED,
      `Failed to create workspace "${name}". Please try a different name or try again later.`,
      `Workspace creation failed for "${name}": ${reason || 'Unknown reason'}`,
      ErrorCategory.WORKSPACE,
      ErrorSeverity.HIGH,
      { operation: 'createWorkspace', additionalData: { name } },
      true,
      cause,
      [
        {
          id: 'retry',
          label: 'Try Again',
          action: () => { /* Retry logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  static workspaceDeletionFailed(workspaceId: string, reason?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.WORKSPACE_DELETION_FAILED,
      `Failed to delete workspace. It might still be in use.`,
      `Workspace deletion failed: ${workspaceId} - ${reason || 'Unknown reason'}`,
      ErrorCategory.WORKSPACE,
      ErrorSeverity.HIGH,
      { workspaceId, operation: 'deleteWorkspace' },
      true,
      cause
    );
  }

  // Service errors
  static serviceNotFound(serviceId: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.SERVICE_NOT_FOUND,
      `The service you're looking for doesn't exist or has been removed.`,
      `Service not found: ${serviceId}`,
      ErrorCategory.SERVICE,
      ErrorSeverity.MEDIUM,
      { serviceId },
      false,
      cause
    );
  }

  static serviceCreationFailed(name: string, url: string, reason?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.SERVICE_CREATION_FAILED,
      `Failed to add service "${name}". Please check the URL and try again.`,
      `Service creation failed for "${name}" (${url}): ${reason || 'Unknown reason'}`,
      ErrorCategory.SERVICE,
      ErrorSeverity.HIGH,
      { operation: 'createService', additionalData: { name, url } },
      true,
      cause,
      [
        {
          id: 'retry',
          label: 'Try Again',
          action: () => { /* Retry logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  static serviceLoadFailed(name: string, reason?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.SERVICE_LOAD_FAILED,
      `Failed to load service "${name}". Please check your connection and try again.`,
      `Service load failed for "${name}": ${reason || 'Unknown reason'}`,
      ErrorCategory.SERVICE,
      ErrorSeverity.HIGH,
      { operation: 'loadService', additionalData: { name } },
      true,
      cause,
      [
        {
          id: 'retry',
          label: 'Retry Connection',
          action: () => { /* Retry logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  static serviceUrlInvalid(url: string, reason?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.SERVICE_URL_INVALID,
      `The URL you entered is not valid. Please check it and try again.`,
      `Invalid service URL: ${url} - ${reason || 'Unknown reason'}`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.MEDIUM,
      { additionalData: { url } },
      false,
      cause
    );
  }

  // Network errors
  static networkUnreachable(operation: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.NETWORK_UNREACHABLE,
      `No internet connection. Please check your network connection and try again.`,
      `Network unreachable during ${operation}`,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      { operation },
      true,
      cause,
      [
        {
          id: 'retry',
          label: 'Try Again',
          action: () => { /* Retry logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  static connectionTimeout(operation: string, timeoutMs: number, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.CONNECTION_TIMEOUT,
      `Connection timed out after ${timeoutMs}ms. Please try again.`,
      `Connection timeout during ${operation}`,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      { operation, additionalData: { timeoutMs } },
      true,
      cause,
      [
        {
          id: 'retry',
          label: 'Try Again',
          action: () => { /* Retry logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  // File system errors
  static fileNotFound(path: string, operation?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.FILE_NOT_FOUND,
      `The requested file doesn't exist or has been moved.`,
      `File not found: ${path}`,
      ErrorCategory.FILESYSTEM,
      ErrorSeverity.MEDIUM,
      { operation, additionalData: { path } },
      false,
      cause
    );
  }

  static permissionDenied(operation: string, path?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.PERMISSION_DENIED,
      `You don't have permission to perform this action.`,
      `Permission denied for ${operation}${path ? ` on ${path}` : ''}`,
      ErrorCategory.SECURITY,
      ErrorSeverity.HIGH,
      { operation, additionalData: { path } },
      false,
      cause
    );
  }

  // Configuration errors
  static configLoadFailed(reason?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.CONFIG_LOAD_FAILED,
      `Failed to load application configuration. Please restart the application.`,
      `Configuration load failed: ${reason || 'Unknown reason'}`,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.CRITICAL,
      { operation: 'loadConfig' },
      false,
      cause,
      [
        {
          id: 'restart',
          label: 'Restart Application',
          action: () => { /* Restart logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  // Security errors
  static authenticationFailed(provider?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.AUTHENTICATION_FAILED,
      `Authentication failed. Please check your credentials and try again.`,
      `Authentication failed${provider ? ` for ${provider}` : ''}`,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      { operation: 'authenticate', additionalData: { provider } },
      true,
      cause
    );
  }

  static securityViolation(message: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.SECURITY_VIOLATION,
      `A security violation was detected. The operation was blocked for your protection.`,
      `Security violation: ${message}`,
      ErrorCategory.SECURITY,
      ErrorSeverity.CRITICAL,
      { operation: 'security_check' },
      false,
      cause
    );
  }

  // System errors
  static memoryExhausted(operation: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.MEMORY_EXHAUSTED,
      `System memory is exhausted. Please close other applications and try again.`,
      `Memory exhausted during ${operation}`,
      ErrorCategory.MEMORY,
      ErrorSeverity.CRITICAL,
      { operation },
      false,
      cause,
      [
        {
          id: 'cleanup',
          label: 'Clear Memory Cache',
          action: () => { /* Memory cleanup logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }

  // Generic errors
  static unknownError(message: string, operation?: string, cause?: Error): AppError {
    return new BaseAppError(
      ErrorCode.UNKNOWN_ERROR,
      `An unexpected error occurred. Please try again.`,
      `Unknown error during ${operation || 'unknown operation'}: ${message}`,
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      { operation },
      true,
      cause,
      [
        {
          id: 'retry',
          label: 'Try Again',
          action: () => { /* Retry logic will be implemented by caller */ },
          primary: true
        }
      ]
    );
  }
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error manager for handling errors throughout the application
 */
export class ErrorManager extends EventEmitter {
  private static instance: ErrorManager;
  private errorHistory: AppError[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.setupErrorHandling();
  }

  static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  private setupErrorHandling(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      const appError = ErrorFactory.unknownError(
        error.message,
        'uncaughtException',
        error
      );
      this.handleError(appError);
      
      // In production, we might want to exit on uncaught exceptions
      if (process.env.NODE_ENV === 'production') {
        log.error('Uncaught exception, shutting down gracefully');
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const appError = ErrorFactory.unknownError(
        error.message,
        'unhandledRejection',
        error
      );
      this.handleError(appError);
    });
  }

  /**
   * Handle an error
   */
  handleError(error: AppError | Error | unknown): AppError {
    let appError: AppError;

    if (error instanceof BaseAppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = this.classifyError(error);
    } else {
      appError = ErrorFactory.unknownError(String(error));
    }

    // Add to history
    this.addToHistory(appError);

    // Log the error
    this.logError(appError);

    // Emit error event
    this.emit('error', appError);

    return appError;
  }

  /**
   * Classify a generic error into an AppError
   */
  private classifyError(error: Error): AppError {
    const message = error.message.toLowerCase();
    
    // Network-related errors
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorFactory.networkUnreachable('unknown', error);
    }
    
    if (message.includes('timeout')) {
      return ErrorFactory.connectionTimeout('unknown', 0, error);
    }
    
    if (message.includes('refused') || message.includes('econnrefused')) {
      return ErrorFactory.connectionTimeout('unknown', 0, error);
    }

    // Permission errors
    if (message.includes('permission') || message.includes('eacces')) {
      return ErrorFactory.permissionDenied('unknown', undefined, error);
    }
    
    // File system errors
    if (message.includes('enoent') || message.includes('not found')) {
      return ErrorFactory.fileNotFound('unknown', undefined, error);
    }
    
    // Memory errors
    if (message.includes('memory') || message.includes('heap')) {
      return ErrorFactory.memoryExhausted('unknown', error);
    }

    // Default to unknown error
    return ErrorFactory.unknownError(error.message, 'unknown', error);
  }

  /**
   * Add error to history
   */
  private addToHistory(error: AppError): void {
    this.errorHistory.push(error);
    
    // Keep history size limited
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: AppError): void {
    const logData = {
      errorId: error.id,
      code: error.code,
      category: error.category,
      severity: error.severity,
      operation: error.context.operation,
      workspaceId: error.context.workspaceId,
      serviceId: error.context.serviceId,
      retryCount: error.retryCount,
      timestamp: error.timestamp.toISOString()
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        log.error(`[CRITICAL] ${error.userMessage}`, logData);
        break;
      case ErrorSeverity.HIGH:
        log.error(`[HIGH] ${error.userMessage}`, logData);
        break;
      case ErrorSeverity.MEDIUM:
        log.warn(`[MEDIUM] ${error.userMessage}`, logData);
        break;
      case ErrorSeverity.LOW:
        log.info(`[LOW] ${error.userMessage}`, logData);
        break;
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(limit?: number): AppError[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: AppError[];
  } {
    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    this.errorHistory.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    // Get recent errors (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneHourAgo);

    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }
}

// Export singleton instance
export const errorManager = ErrorManager.getInstance();

// Export default
export default ErrorManager;