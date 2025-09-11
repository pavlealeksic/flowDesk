/**
 * Error Handling Utilities for Flow Desk
 * 
 * Utility functions for error handling, validation, and recovery
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { BaseAppError, ErrorCode, ErrorCategory, ErrorSeverity, RecoveryAction, ErrorContext, ErrorFactory } from './AppError';
import { retryHandler } from './RetryHandler';
import { configManager } from '../config/AppConfig';
import log from 'electron-log';

/**
 * Result type for operations that can fail
 */
export type Result<T, E extends BaseAppError = BaseAppError> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Wrap an operation with comprehensive error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    operation?: string;
    component?: string;
    timeoutMs?: number;
    retryable?: boolean;
    onError?: (error: BaseAppError) => void;
  } = {}
): Promise<Result<T>> {
  try {
    const timeoutMs = context.timeoutMs || configManager.getNetworkConfig().defaultTimeout;
    
    const result = await withTimeout(operation, timeoutMs);
    return { success: true, data: result };
  } catch (error) {
    const appError = error instanceof BaseAppError ? error : createGenericError(error, context);
    
    if (context.onError) {
      context.onError(appError);
    }
    
    return { success: false, error: appError };
  }
}

/**
 * Wrap an operation with timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Create a generic error from unknown error
 */
export function createGenericError(
  error: unknown,
  context: {
    operation?: string;
    component?: string;
  } = {}
): BaseAppError {
  if (error instanceof BaseAppError) {
    return error;
  }

  if (error instanceof Error) {
    return {
      name: 'GenericError',
      message: error.message,
      id: generateErrorId(),
      code: ErrorCode.UNKNOWN_ERROR,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      isRetryable: true,
      recoveryActions: [
        {
          id: 'retry',
          label: 'Try Again',
          primary: true,
          action: async () => {}
        }
      ],
      context: {
        timestamp: new Date(),
        ...context
      },
      cause: error,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: configManager.getErrorHandlingConfig().maxRetryAttempts,
      retry: async function(): Promise<void> {
        this.retryCount++;
        if (this.retryCount > this.maxRetries) {
          throw new Error('Maximum retry attempts exceeded');
        }
      },
      addRecoveryAction: function(action: RecoveryAction): void {
        this.recoveryActions.push(action);
      },
      toJSON: function(): Record<string, unknown> {
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
    };
  }

  return {
    name: 'GenericError',
    message: String(error),
    id: generateErrorId(),
    code: ErrorCode.UNKNOWN_ERROR,
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.HIGH,
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: String(error),
    isRetryable: true,
    recoveryActions: [
      {
        id: 'retry',
        label: 'Try Again',
        primary: true,
        action: async () => {}
      }
    ],
    context: {
      timestamp: new Date(),
      ...context
    },
    timestamp: new Date(),
    retryCount: 0,
    maxRetries: configManager.getErrorHandlingConfig().maxRetryAttempts,
    retry: async function(): Promise<void> {
      this.retryCount++;
      if (this.retryCount > this.maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }
    },
    addRecoveryAction: function(action: RecoveryAction): void {
      this.recoveryActions.push(action);
    },
    toJSON: function(): Record<string, unknown> {
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
        timestamp: this.timestamp.toISOString(),
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      };
    }
  };
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate input data with error handling
 */
export function validateInput<T>(
  data: unknown,
  validator: (data: unknown) => data is T,
  errorMessage: string = 'Invalid input data'
): T {
  if (!validator(data)) {
    throw new Error(errorMessage);
  }
  return data;
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    log.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * Safe JSON stringifying with error handling
 */
export function safeJsonStringify(data: unknown, defaultValue: string): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    log.warn('Failed to stringify JSON:', error);
    return defaultValue;
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: BaseAppError) => void;
  } = {}
): Promise<T> {
  const errorConfig = configManager.getErrorHandlingConfig();
  const maxAttempts = options.maxAttempts || errorConfig.maxRetryAttempts;
  const baseDelay = options.baseDelay || errorConfig.retryBaseDelay;
  const maxDelay = options.maxDelay || errorConfig.retryMaxDelay;

  let lastError: BaseAppError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = createGenericError(error);
      
      if (attempt === maxAttempts || !lastError.isRetryable) {
        throw lastError;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        maxDelay
      );

      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold: number = 5, timeout: number = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Error boundary for async operations
 */
export class AsyncErrorBoundary {
  private errorHandler?: (error: BaseAppError) => void;

  constructor(errorHandler?: (error: BaseAppError) => void) {
    this.errorHandler = errorHandler;
  }

  async execute<T>(operation: () => Promise<T>): Promise<Result<T>> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const appError = createGenericError(error);
      
      if (this.errorHandler) {
        this.errorHandler(appError);
      }
      
      return { success: false, error: appError };
    }
  }
}

/**
 * Debounce function to prevent rapid repeated calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit call frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
  private threshold: number;
  private callback?: (usage: NodeJS.MemoryUsage) => void;

  constructor(threshold: number = 0.9) {
    this.threshold = threshold;
  }

  startMonitoring(callback?: (usage: NodeJS.MemoryUsage) => void): void {
    this.callback = callback;
    
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedRatio = usage.heapUsed / usage.heapTotal;
      
      if (heapUsedRatio > this.threshold) {
        log.warn('Memory usage threshold exceeded:', {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          ratio: Math.round(heapUsedRatio * 100)
        });
        
        if (this.callback) {
          this.callback(usage);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
}

/**
 * Safe file operation wrapper
 */
export async function safeFileOperation<T>(
  operation: () => Promise<T>,
  context: {
    operation: string;
    filePath?: string;
  }
): Promise<Result<T>> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    let errorCode = ErrorCode.UNKNOWN_ERROR;
    let userMessage = 'File operation failed';

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('enoent') || message.includes('not found')) {
        errorCode = ErrorCode.FILE_NOT_FOUND;
        userMessage = 'File not found';
      } else if (message.includes('eacces') || message.includes('permission')) {
        errorCode = ErrorCode.PERMISSION_DENIED;
        userMessage = 'Permission denied';
      } else if (message.includes('enospc') || message.includes('no space')) {
        errorCode = ErrorCode.STORAGE_FULL;
        userMessage = 'Storage full';
      }
    }

    const appError = createGenericError(error, {
      operation: context.operation,
      component: 'FileSystem'
    });

    return { success: false, error: appError };
  }
}

/**
 * Network request wrapper with error handling
 */
export async function safeNetworkRequest<T>(
  request: () => Promise<T>,
  context: {
    operation: string;
    url?: string;
    timeoutMs?: number;
  }
): Promise<Result<T>> {
  try {
    const timeoutMs = context.timeoutMs || configManager.getNetworkConfig().defaultTimeout;
    const result = await withTimeout(request, timeoutMs);
    return { success: true, data: result };
  } catch (error) {
    let errorCode = ErrorCode.UNKNOWN_ERROR;
    let userMessage = 'Network request failed';

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout')) {
        errorCode = ErrorCode.CONNECTION_TIMEOUT;
        userMessage = 'Request timed out';
      } else if (message.includes('network') || message.includes('fetch')) {
        errorCode = ErrorCode.NETWORK_UNREACHABLE;
        userMessage = 'Network unreachable';
      } else if (message.includes('refused') || message.includes('econnrefused')) {
        errorCode = ErrorCode.CONNECTION_REFUSED;
        userMessage = 'Connection refused';
      }
    }

    const appError = createGenericError(error, {
      operation: context.operation,
      component: 'Network'
    });

    return { success: false, error: appError };
  }
}