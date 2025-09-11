/**
 * Retry Handler for Flow Desk
 * 
 * Comprehensive retry system with exponential backoff, circuit breakers,
 * and configurable retry policies for different error types.
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { EventEmitter } from 'events';
import { AppError, ErrorCode, ErrorCategory, ErrorSeverity, errorManager } from './AppError';
import { configManager } from '../config/AppConfig';
import log from 'electron-log';

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
  jitterRange: number; // 0-1, adds randomness to prevent thundering herd
  retryableErrors: ErrorCode[];
  nonRetryableErrors: ErrorCode[];
}

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'closed',      // Normal operation, requests flow through
  OPEN = 'open',         // Circuit is open, requests are blocked
  HALF_OPEN = 'half_open' // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  recoveryTimeout: number;     // Time in milliseconds to wait before trying again
  expectedException?: (error: AppError) => boolean;
}

/**
 * Retry event types
 */
export enum RetryEventType {
  ATTEMPT_STARTED = 'attempt_started',
  ATTEMPT_FAILED = 'attempt_failed',
  ATTEMPT_SUCCEEDED = 'attempt_succeeded',
  RETRY_EXHAUSTED = 'retry_exhausted',
  DELAY_STARTED = 'delay_started',
  CIRCUIT_OPENED = 'circuit_opened',
  CIRCUIT_CLOSED = 'circuit_closed',
  CIRCUIT_HALF_OPENED = 'circuit_half_opened'
}

/**
 * Retry event data
 */
export interface RetryEvent {
  type: RetryEventType;
  attempt: number;
  error?: AppError;
  delay?: number;
  timestamp: Date;
  operationId: string;
}

/**
 * Retry context for tracking retry state
 */
export interface RetryContext {
  operationId: string;
  attempt: number;
  lastError?: AppError;
  startTime: Date;
  delays: number[];
}

/**
 * Comprehensive retry handler with circuit breaker pattern
 */
export class RetryHandler extends EventEmitter {
  private static instance: RetryHandler;
  private activeRetries: Map<string, RetryContext> = new Map();
  private circuitStates: Map<string, { state: CircuitState; failures: number; lastFailure: Date }> = new Map();
  
  // Default retry strategies for different error categories
  private retryStrategies: Map<ErrorCategory, RetryStrategy> = new Map();

  constructor() {
    super();
    this.initializeDefaultStrategies();
    this.setupCleanupInterval();
  }

  static getInstance(): RetryHandler {
    if (!RetryHandler.instance) {
      RetryHandler.instance = new RetryHandler();
    }
    return RetryHandler.instance;
  }

  private initializeDefaultStrategies(): void {
    const errorConfig = configManager.getErrorHandlingConfig();

    // Network errors - aggressive retry with longer delays
    this.retryStrategies.set(ErrorCategory.NETWORK, {
      maxAttempts: errorConfig.maxRetryAttempts + 2,
      baseDelay: errorConfig.retryBaseDelay,
      maxDelay: errorConfig.retryMaxDelay,
      backoffMultiplier: 2.5,
      jitterRange: 0.3,
      retryableErrors: [
        ErrorCode.NETWORK_UNREACHABLE,
        ErrorCode.CONNECTION_TIMEOUT,
        ErrorCode.CONNECTION_REFUSED,
        ErrorCode.DNS_RESOLUTION_FAILED,
        ErrorCode.SSL_ERROR
      ],
      nonRetryableErrors: [
        ErrorCode.RATE_LIMIT_EXCEEDED
      ]
    });

    // Service errors - moderate retry
    this.retryStrategies.set(ErrorCategory.SERVICE, {
      maxAttempts: errorConfig.maxRetryAttempts + 1,
      baseDelay: errorConfig.retryBaseDelay * 1.5,
      maxDelay: errorConfig.retryMaxDelay,
      backoffMultiplier: 2,
      jitterRange: 0.2,
      retryableErrors: [
        ErrorCode.SERVICE_LOAD_FAILED,
        ErrorCode.SERVICE_TIMEOUT,
        ErrorCode.SERVICE_UNAVAILABLE
      ],
      nonRetryableErrors: [
        ErrorCode.SERVICE_NOT_FOUND,
        ErrorCode.SERVICE_URL_INVALID,
        ErrorCode.SERVICE_LIMIT_EXCEEDED
      ]
    });

    // File system errors - limited retry
    this.retryStrategies.set(ErrorCategory.FILESYSTEM, {
      maxAttempts: 2,
      baseDelay: errorConfig.retryBaseDelay * 0.5,
      maxDelay: errorConfig.retryBaseDelay * 2,
      backoffMultiplier: 1.5,
      jitterRange: 0.1,
      retryableErrors: [
        ErrorCode.PERMISSION_DENIED
      ],
      nonRetryableErrors: [
        ErrorCode.FILE_NOT_FOUND,
        ErrorCode.STORAGE_FULL,
        ErrorCode.FILE_CORRUPTED
      ]
    });

    // Database errors - moderate retry
    this.retryStrategies.set(ErrorCategory.DATABASE, {
      maxAttempts: errorConfig.maxRetryAttempts,
      baseDelay: errorConfig.retryBaseDelay,
      maxDelay: errorConfig.retryMaxDelay,
      backoffMultiplier: 2,
      jitterRange: 0.2,
      retryableErrors: [
        ErrorCode.DATABASE_CONNECTION_FAILED,
        ErrorCode.DATABASE_TIMEOUT,
        ErrorCode.DATABASE_QUERY_FAILED
      ],
      nonRetryableErrors: [
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        ErrorCode.DATABASE_INTEGRITY_ERROR
      ]
    });

    // Configuration errors - no retry
    this.retryStrategies.set(ErrorCategory.CONFIGURATION, {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterRange: 0,
      retryableErrors: [],
      nonRetryableErrors: [
        ErrorCode.CONFIG_LOAD_FAILED,
        ErrorCode.CONFIG_VALIDATION_FAILED,
        ErrorCode.CONFIG_MISSING
      ]
    });

    // Security errors - no retry for most cases
    this.retryStrategies.set(ErrorCategory.SECURITY, {
      maxAttempts: 1,
      baseDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      jitterRange: 0,
      retryableErrors: [],
      nonRetryableErrors: [
        ErrorCode.AUTHENTICATION_FAILED,
        ErrorCode.AUTHORIZATION_FAILED,
        ErrorCode.SECURITY_VIOLATION
      ]
    });

    // System errors - limited retry
    this.retryStrategies.set(ErrorCategory.SYSTEM, {
      maxAttempts: 2,
      baseDelay: errorConfig.retryBaseDelay * 2,
      maxDelay: errorConfig.retryMaxDelay,
      backoffMultiplier: 1.5,
      jitterRange: 0.3,
      retryableErrors: [
        ErrorCode.MEMORY_EXHAUSTED,
        ErrorCode.SYSTEM_RESOURCE_EXHAUSTED
      ],
      nonRetryableErrors: [
        ErrorCode.PROCESS_CRASHED
      ]
    });
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      operationId?: string;
      strategy?: RetryStrategy;
      circuitBreaker?: CircuitBreakerConfig;
      onRetry?: (attempt: number, error: AppError, delay: number) => void;
      onSuccess?: (result: T, attempts: number) => void;
      onFailure?: (error: AppError) => void;
    } = {}
  ): Promise<T> {
    const operationId = options.operationId || this.generateOperationId();
    const strategy = options.strategy || this.getDefaultStrategy();
    const circuitBreaker = options.circuitBreaker;

    // Check circuit breaker if configured
    if (circuitBreaker) {
      const circuitState = this.getCircuitState(operationId);
      if (circuitState.state === CircuitState.OPEN) {
        const timeSinceFailure = Date.now() - circuitState.lastFailure.getTime();
        if (timeSinceFailure < circuitBreaker.recoveryTimeout) {
          throw new Error(`Circuit breaker is open for operation ${operationId}. Service unavailable.`);
        } else {
          // Move to half-open state
          this.setCircuitState(operationId, CircuitState.HALF_OPEN);
          this.emitEvent({
            type: RetryEventType.CIRCUIT_HALF_OPENED,
            attempt: 0,
            timestamp: new Date(),
            operationId
          });
        }
      }
    }

    const context: RetryContext = {
      operationId,
      attempt: 0,
      startTime: new Date(),
      delays: []
    };

    this.activeRetries.set(operationId, context);

    try {
      const result = await this.executeWithRetryInternal<T>(
        operation,
        context,
        strategy,
        circuitBreaker,
        options
      );

      // Clear circuit breaker failures on success
      if (circuitBreaker) {
        this.clearCircuitFailures(operationId);
      }

      options.onSuccess?.(result, context.attempt);
      return result;
    } finally {
      this.activeRetries.delete(operationId);
    }
  }

  private async executeWithRetryInternal<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    strategy: RetryStrategy,
    circuitBreaker?: CircuitBreakerConfig,
    options?: {
      onRetry?: (attempt: number, error: AppError, delay: number) => void;
      onSuccess?: (result: T, attempts: number) => void;
      onFailure?: (error: AppError) => void;
    }
  ): Promise<T> {
    context.attempt++;

    this.emitEvent({
      type: RetryEventType.ATTEMPT_STARTED,
      attempt: context.attempt,
      timestamp: new Date(),
      operationId: context.operationId
    });

    try {
      const result = await operation();

      this.emitEvent({
        type: RetryEventType.ATTEMPT_SUCCEEDED,
        attempt: context.attempt,
        timestamp: new Date(),
        operationId: context.operationId
      });

      return result;
    } catch (error) {
      const appError = errorManager.handleError(error);
      context.lastError = appError;

      this.emitEvent({
        type: RetryEventType.ATTEMPT_FAILED,
        attempt: context.attempt,
        error: appError,
        timestamp: new Date(),
        operationId: context.operationId
      });

      // Check if we should retry
      if (!this.shouldRetry(appError, strategy, context.attempt)) {
        if (circuitBreaker) {
          this.recordCircuitFailure(context.operationId, circuitBreaker);
        }

        this.emitEvent({
          type: RetryEventType.RETRY_EXHAUSTED,
          attempt: context.attempt,
          error: appError,
          timestamp: new Date(),
          operationId: context.operationId
        });

        options?.onFailure?.(appError);
        throw appError;
      }

      // Calculate delay
      const delay = this.calculateDelay(strategy, context.attempt);
      context.delays.push(delay);

      this.emitEvent({
        type: RetryEventType.DELAY_STARTED,
        attempt: context.attempt,
        delay,
        timestamp: new Date(),
        operationId: context.operationId
      });

      // Notify callback
      options?.onRetry?.(context.attempt, appError, delay);

      // Wait before retrying
      await this.delay(delay);

      // Retry the operation
      return this.executeWithRetryInternal(
        operation,
        context,
        strategy,
        circuitBreaker,
        options
      );
    }
  }

  /**
   * Check if an error should be retried
   */
  private shouldRetry(error: AppError, strategy: RetryStrategy, attempt: number): boolean {
    // Check max attempts
    if (attempt >= strategy.maxAttempts) {
      return false;
    }

    // Check if error is explicitly non-retryable
    if (strategy.nonRetryableErrors.includes(error.code)) {
      return false;
    }

    // Check if error is retryable
    if (strategy.retryableErrors.length > 0) {
      return strategy.retryableErrors.includes(error.code);
    }

    // Default to error's retryable flag
    return error.isRetryable;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(strategy: RetryStrategy, attempt: number): number {
    // Exponential backoff
    let delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay
    delay = Math.min(delay, strategy.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * strategy.jitterRange * (Math.random() - 0.5);
    delay = Math.max(0, delay + jitter);
    
    return Math.round(delay);
  }

  /**
   * Get circuit breaker state
   */
  private getCircuitState(operationId: string): { state: CircuitState; failures: number; lastFailure: Date } {
    if (!this.circuitStates.has(operationId)) {
      this.circuitStates.set(operationId, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailure: new Date()
      });
    }
    return this.circuitStates.get(operationId)!;
  }

  /**
   * Set circuit breaker state
   */
  private setCircuitState(operationId: string, state: CircuitState): void {
    const circuitState = this.getCircuitState(operationId);
    circuitState.state = state;
    
    this.emitEvent({
      type: state === CircuitState.OPEN ? RetryEventType.CIRCUIT_OPENED : RetryEventType.CIRCUIT_CLOSED,
      attempt: 0,
      timestamp: new Date(),
      operationId
    });
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitFailure(operationId: string, config: CircuitBreakerConfig): void {
    const circuitState = this.getCircuitState(operationId);
    circuitState.failures++;
    circuitState.lastFailure = new Date();

    if (circuitState.failures >= config.failureThreshold) {
      this.setCircuitState(operationId, CircuitState.OPEN);
    }
  }

  /**
   * Clear circuit breaker failures
   */
  private clearCircuitFailures(operationId: string): void {
    const circuitState = this.getCircuitState(operationId);
    circuitState.failures = 0;
    this.setCircuitState(operationId, CircuitState.CLOSED);
  }

  /**
   * Get default retry strategy
   */
  private getDefaultStrategy(): RetryStrategy {
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
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit retry event
   */
  private emitEvent(event: RetryEvent): void {
    this.emit('retry', event);
    
    // Log important events
    switch (event.type) {
      case RetryEventType.CIRCUIT_OPENED:
        log.warn(`Circuit breaker opened for operation ${event.operationId}`);
        break;
      case RetryEventType.RETRY_EXHAUSTED:
        log.warn(`Retry exhausted for operation ${event.operationId} after ${event.attempt} attempts`);
        break;
      case RetryEventType.ATTEMPT_FAILED:
        if (event.attempt > 1) {
          log.info(`Retry attempt ${event.attempt} failed for operation ${event.operationId}: ${event.error?.userMessage}`);
        }
        break;
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup cleanup interval for old retries
   */
  private setupCleanupInterval(): void {
    // Clean up old retry contexts every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutes

      for (const [operationId, context] of Array.from(this.activeRetries.entries())) {
        if (now - context.startTime.getTime() > maxAge) {
          this.activeRetries.delete(operationId);
          log.debug(`Cleaned up old retry context: ${operationId}`);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): {
    activeRetries: number;
    circuitBreakers: { total: number; open: number; closed: number; halfOpen: number };
    retryStrategies: number;
  } {
    const circuitStats = {
      total: this.circuitStates.size,
      open: 0,
      closed: 0,
      halfOpen: 0
    };

    this.circuitStates.forEach(state => {
      switch (state.state) {
        case CircuitState.OPEN:
          circuitStats.open++;
          break;
        case CircuitState.CLOSED:
          circuitStats.closed++;
          break;
        case CircuitState.HALF_OPEN:
          circuitStats.halfOpen++;
          break;
      }
    });

    return {
      activeRetries: this.activeRetries.size,
      circuitBreakers: circuitStats,
      retryStrategies: this.retryStrategies.size
    };
  }

  /**
   * Get active retry contexts
   */
  getActiveRetries(): RetryContext[] {
    return Array.from(this.activeRetries.values());
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, { state: CircuitState; failures: number; lastFailure: Date }> {
    return new Map(this.circuitStates);
  }

  /**
   * Reset circuit breaker for an operation
   */
  resetCircuitBreaker(operationId: string): void {
    this.circuitStates.delete(operationId);
  }

  /**
   * Clear all circuit breakers
   */
  clearAllCircuitBreakers(): void {
    this.circuitStates.clear();
  }
}

// Export singleton instance
export const retryHandler = RetryHandler.getInstance();

// Export default
export default RetryHandler;