/**
 * IPC Error Handler for Flow Desk
 * 
 * Specialized error handling for IPC communication between main and renderer processes
 * with proper error serialization, user-friendly messages, and recovery mechanisms.
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @ @since 2024-01-01
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { BaseAppError, ErrorCode, ErrorCategory, ErrorSeverity, errorManager } from './AppError';
import { retryHandler, RetryStrategy } from './RetryHandler';
import { configManager } from '../config/AppConfig';
import log from 'electron-log';

/**
 * IPC error response format
 */
export interface IPCErrorResponse {
  success: false;
  error: {
    id: string;
    code: ErrorCode;
    category: ErrorCategory;
    severity: ErrorSeverity;
    userMessage: string;
    technicalMessage: string;
    isRetryable: boolean;
    recoveryActions: Array<{
      id: string;
      label: string;
      primary?: boolean;
      destructive?: boolean;
    }>;
    context: {
      operation?: string;
      component?: string;
      timestamp: string;
    };
    retryCount: number;
    maxRetries: number;
  };
}

/**
 * IPC operation context
 */
export interface IPCOperationContext {
  channel: string;
  operationName: string;
  requiresAuth?: boolean;
  rateLimitKey?: string;
  timeoutMs?: number;
  retryStrategy?: RetryStrategy;
  circuitBreaker?: boolean;
  sanitizeInput?: boolean;
  validateOutput?: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (event: IpcMainInvokeEvent, ...args: any[]) => string;
}

/**
 * IPC Error Handler with comprehensive error management
 */
export class IPCErrorHandler {
  private static instance: IPCErrorHandler;
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private operationConfigs: Map<string, IPCOperationContext> = new Map();

  constructor() {
    this.setupGlobalErrorHandling();
  }

  static getInstance(): IPCErrorHandler {
    if (!IPCErrorHandler.instance) {
      IPCErrorHandler.instance = new IPCErrorHandler();
    }
    return IPCErrorHandler.instance;
  }

  /**
   * Setup global IPC error handling
   */
  private setupGlobalErrorHandling(): void {
    // Handle unhandled IPC promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      log.error('Unhandled IPC rejection:', reason);
    });
  }

  /**
   * Register an IPC operation with error handling
   */
  registerOperation<T extends any[], R>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R>,
    context: Partial<IPCOperationContext> = {}
  ): void {
    const fullContext: IPCOperationContext = {
      channel,
      operationName: channel,
      timeoutMs: configManager.getNetworkConfig().defaultTimeout,
      retryStrategy: this.getDefaultRetryStrategy(),
      circuitBreaker: true,
      sanitizeInput: true,
      validateOutput: false,
      ...context
    };

    this.operationConfigs.set(channel, fullContext);

    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: T): Promise<R> => {
      return this.handleOperation(event, channel, handler, args, fullContext);
    });
  }

  /**
   * Handle an IPC operation with comprehensive error handling
   */
  private async handleOperation<T extends any[], R>(
    event: IpcMainInvokeEvent,
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R>,
    args: T,
    context: IPCOperationContext
  ): Promise<R> {
    const startTime = Date.now();
    
    try {
      // Check rate limiting
      if (context.rateLimitKey) {
        this.checkRateLimit(context.rateLimitKey);
      }

      // Sanitize input if required
      let sanitizedArgs = args;
      if (context.sanitizeInput) {
        sanitizedArgs = this.sanitizeInput(args) as T;
      }

      // Execute with timeout and retry
      const result = await retryHandler.executeWithRetry(
        () => this.executeWithTimeout(
          () => handler(event, ...sanitizedArgs),
          context.timeoutMs || configManager.getNetworkConfig().defaultTimeout
        ),
        {
          operationId: `${channel}_${Date.now()}`,
          strategy: context.retryStrategy,
          circuitBreaker: context.circuitBreaker ? {
            failureThreshold: 3,
            recoveryTimeout: 30000
          } : undefined,
          onRetry: (attempt, error, delay) => {
            log.info(`IPC retry attempt ${attempt} for ${channel} in ${delay}ms: ${error.userMessage}`);
          },
          onFailure: (error) => {
            log.error(`IPC operation failed permanently: ${channel} - ${error.userMessage}`);
          }
        }
      );

      // Validate output if required
      if (context.validateOutput) {
        this.validateOutput(result);
      }

      // Log success
      const duration = Date.now() - startTime;
      log.debug(`IPC operation succeeded: ${channel} (${duration}ms)`);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Convert to AppError if needed
      const appError = error instanceof BaseAppError ? error : this.createIPCError(error, context);
      
      // Log the error
      log.error(`IPC operation failed: ${channel} (${duration}ms) - ${appError.userMessage}`, {
        errorId: appError.id,
        code: appError.code,
        severity: appError.severity,
        retryCount: appError.retryCount
      });

      // Convert to IPC error response format
      const ipcError = this.serializeError(appError);
      
      // Throw to be caught by IPC handler
      throw ipcError;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
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
   * Create an IPC-specific error
   */
  private createIPCError(error: unknown, context: IPCOperationContext): BaseAppError {
    if (error instanceof BaseAppError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Handle common IPC errors
      if (message.includes('timeout')) {
        return errorManager.handleError({
          name: 'TimeoutError',
          message: `IPC operation timed out: ${context.operationName}`,
          code: ErrorCode.CONNECTION_TIMEOUT,
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.HIGH,
          userMessage: 'The operation took too long to complete. Please try again.',
          technicalMessage: `IPC timeout for ${context.operationName}`,
          isRetryable: true,
          context: {
            operation: context.operationName,
            timestamp: new Date()
          },
          recoveryActions: [
            {
              id: 'retry',
              label: 'Try Again',
              primary: true
            }
          ]
        });
      }

      if (message.includes('permission') || message.includes('denied')) {
        return errorManager.handleError({
          name: 'PermissionError',
          message: `Permission denied for IPC operation: ${context.operationName}`,
          code: ErrorCode.PERMISSION_DENIED,
          category: ErrorCategory.SECURITY,
          severity: ErrorSeverity.HIGH,
          userMessage: 'You do not have permission to perform this action.',
          technicalMessage: `IPC permission denied for ${context.operationName}`,
          isRetryable: false,
          context: {
            operation: context.operationName,
            timestamp: new Date()
          }
        });
      }

      if (message.includes('not found') || message.includes('enoent')) {
        return errorManager.handleError({
          name: 'NotFoundError',
          message: `IPC operation not found: ${context.operationName}`,
          code: ErrorCode.FILE_NOT_FOUND,
          category: ErrorCategory.FILESYSTEM,
          severity: ErrorSeverity.MEDIUM,
          userMessage: 'The requested resource was not found.',
          technicalMessage: `IPC not found: ${context.operationName}`,
          isRetryable: false,
          context: {
            operation: context.operationName,
            timestamp: new Date()
          }
        });
      }
    }

    // Default error
    return errorManager.handleError({
      name: 'IPCError',
      message: `Unknown IPC error: ${context.operationName}`,
      code: ErrorCode.UNKNOWN_ERROR,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: `Unknown IPC error for ${context.operationName}`,
      isRetryable: true,
      context: {
        operation: context.operationName,
        timestamp: new Date()
      },
      recoveryActions: [
        {
          id: 'retry',
          label: 'Try Again',
          primary: true
        }
      ]
    });
  }

  /**
   * Serialize AppError to IPC response format
   */
  private serializeError(error: BaseAppError): IPCErrorResponse {
    return {
      success: false,
      error: {
        id: error.id,
        code: error.code,
        category: error.category,
        severity: error.severity,
        userMessage: error.userMessage,
        technicalMessage: error.technicalMessage,
        isRetryable: error.isRetryable,
        recoveryActions: error.recoveryActions.map(action => ({
          id: action.id,
          label: action.label,
          primary: action.primary,
          destructive: action.destructive
        })),
        context: {
          operation: error.context.operation,
          component: error.context.component,
          timestamp: error.context.timestamp.toISOString()
        },
        retryCount: error.retryCount,
        maxRetries: error.maxRetries
      }
    };
  }

  /**
   * Sanitize input arguments
   */
  private sanitizeInput(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // Remove potential script injection
        return arg
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
      return arg;
    });
  }

  /**
   * Validate output data
   */
  private validateOutput(output: any): void {
    if (output === undefined || output === null) {
      throw new Error('Invalid output: undefined or null');
    }

    // Check for potentially dangerous objects
    if (typeof output === 'object' && output !== null) {
      const jsonString = JSON.stringify(output);
      if (jsonString.length > 1024 * 1024) { // 1MB limit
        throw new Error('Output too large');
      }
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(key: string): void {
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit || now > limit.resetTime) {
      // Reset rate limit
      this.rateLimits.set(key, {
        count: 1,
        resetTime: now + 60000 // 1 minute window
      });
      return;
    }

    if (limit.count >= 100) { // Max 100 requests per minute
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    limit.count++;
  }

  /**
   * Get default retry strategy
   */
  private getDefaultRetryStrategy(): RetryStrategy {
    const errorConfig = configManager.getErrorHandlingConfig();
    return {
      maxAttempts: errorConfig.maxRetryAttempts,
      baseDelay: errorConfig.retryBaseDelay,
      maxDelay: errorConfig.retryMaxDelay,
      backoffMultiplier: 2,
      jitterRange: 0.1,
      retryableErrors: [],
      nonRetryableErrors: []
    };
  }

  /**
   * Setup rate limiting for a channel
   */
  setupRateLimit(channel: string, config: RateLimitConfig): void {
    const operationContext = this.operationConfigs.get(channel);
    if (operationContext) {
      operationContext.rateLimitKey = channel;
    }
  }

  /**
   * Get IPC operation statistics
   */
  getIPCStats(): {
    registeredOperations: number;
    activeRateLimits: number;
    rateLimitDetails: Array<{ key: string; count: number; resetTime: Date }>;
  } {
    const rateLimitDetails = Array.from(this.rateLimits.entries()).map(([key, limit]) => ({
      key,
      count: limit.count,
      resetTime: new Date(limit.resetTime)
    }));

    return {
      registeredOperations: this.operationConfigs.size,
      activeRateLimits: this.rateLimits.size,
      rateLimitDetails
    };
  }

  /**
   * Clear rate limits
   */
  clearRateLimits(): void {
    this.rateLimits.clear();
  }

  /**
   * Remove operation registration
   */
  unregisterOperation(channel: string): void {
    this.operationConfigs.delete(channel);
    // Note: We can't easily remove ipcMain handlers in Electron
    // This is more for cleanup tracking
  }

  /**
   * Handle IPC errors in renderer process
   */
  static handleRendererError(error: any): BaseAppError {
    if (error && typeof error === 'object' && 'error' in error) {
      // This is an IPC error response
      const ipcError = error.error;
      return errorManager.handleError({
        name: 'IPCError',
        message: ipcError.technicalMessage,
        code: ipcError.code,
        category: ipcError.category,
        severity: ipcError.severity,
        userMessage: ipcError.userMessage,
        technicalMessage: ipcError.technicalMessage,
        isRetryable: ipcError.isRetryable,
        context: {
          operation: ipcError.context.operation,
          timestamp: new Date(ipcError.context.timestamp)
        },
        recoveryActions: ipcError.recoveryActions,
        retryCount: ipcError.retryCount,
        maxRetries: ipcError.maxRetries
      });
    }

    // Handle regular errors
    return errorManager.handleError(error);
  }
}

// Export singleton instance
export const ipcErrorHandler = IPCErrorHandler.getInstance();

// Export default
export default IPCErrorHandler;