/**
 * Comprehensive Error Handling for Rust Communication
 * 
 * This module provides a robust error handling system for all TypeScript-Rust
 * communication, including retry mechanisms, circuit breakers, and graceful degradation.
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

// Error Types from Rust
export interface FlowDeskErrorInfo {
  error_type: string;
  message: string;
  operation: string;
  component: string;
  is_retryable: boolean;
  requires_user_action: boolean;
  retry_delay_seconds?: number;
  recovery_suggestion?: string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  auth_url?: string;
  provider?: string;
  account_id?: string;
}

export interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  fallback_config?: any;
  timestamp: string;
}

export type RecoveryStrategy = 'retry' | 'circuit_breaker' | 'graceful_degradation' | 'user_intervention' | 'fail_fast';

// Circuit Breaker States
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error('Circuit breaker is HALF_OPEN with max calls exceeded');
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
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }
  }

  public getState(): CircuitState {
    return this.state;
  }

  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.halfOpenCalls = 0;
  }
}

// Retry Configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryIf?: (error: any) => boolean;
}

// Error Recovery System
export class RustErrorHandler extends EventEmitter {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private degradedServices: Set<string> = new Set();
  private fallbackConfigs: Map<string, any> = new Map();
  private errorStats: Map<string, { count: number; lastError: Date }> = new Map();

  constructor() {
    super();
    this.setupGlobalErrorHandling();
  }

  private setupGlobalErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception in Rust communication:', error);
      this.emit('critical-error', {
        type: 'uncaught_exception',
        error: error.message,
        stack: error.stack
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled rejection in Rust communication:', reason);
      this.emit('critical-error', {
        type: 'unhandled_rejection',
        error: reason,
        promise
      });
    });
  }

  /**
   * Execute a Rust operation with comprehensive error handling
   */
  public async executeWithErrorHandling<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: {
      strategy?: RecoveryStrategy;
      retryConfig?: RetryConfig;
      circuitBreakerConfig?: CircuitBreakerConfig;
      fallbackOperation?: () => Promise<T>;
      userNotification?: boolean;
    } = {}
  ): Promise<T> {
    const {
      strategy = 'retry',
      retryConfig = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      circuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        halfOpenMaxCalls: 3
      },
      fallbackOperation,
      userNotification = true
    } = options;

    try {
      let result: T;

      switch (strategy) {
        case 'retry':
          result = await this.executeWithRetry(operationName, operation, retryConfig);
          break;
        
        case 'circuit_breaker':
          result = await this.executeWithCircuitBreaker(operationName, operation, circuitBreakerConfig);
          break;
        
        case 'graceful_degradation':
          result = await this.executeWithGracefulDegradation(operationName, operation, fallbackOperation);
          break;
        
        case 'fail_fast':
        default:
          result = await operation();
          break;
      }

      // Operation successful - update stats and clear degradation if needed
      this.updateSuccessStats(operationName);
      return result;

    } catch (error) {
      const flowDeskError = this.parseFlowDeskError(error);
      this.updateErrorStats(operationName, flowDeskError);

      if (userNotification) {
        this.emit('error', {
          operationName,
          error: flowDeskError,
          timestamp: new Date().toISOString()
        });
      }

      // Check if we should degrade the service
      if (this.shouldDegradeService(operationName, flowDeskError)) {
        await this.degradeService(operationName);
      }

      // Re-throw the error for upstream handling
      throw this.enhanceErrorForUI(flowDeskError);
    }
  }

  private async executeWithRetry<T>(
    operationName: string,
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const flowDeskError = this.parseFlowDeskError(error);

        if (attempt === config.maxAttempts || !this.isRetryable(flowDeskError, config.retryIf)) {
          break;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        log.warn(`Operation ${operationName} failed on attempt ${attempt}/${config.maxAttempts}, retrying in ${delay}ms:`, error);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private async executeWithCircuitBreaker<T>(
    operationName: string,
    operation: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(operationName, new CircuitBreaker(config));
    }

    const circuitBreaker = this.circuitBreakers.get(operationName)!;
    return await circuitBreaker.execute(operation);
  }

  private async executeWithGracefulDegradation<T>(
    operationName: string,
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    try {
      if (this.degradedServices.has(operationName)) {
        if (fallbackOperation) {
          log.info(`Using fallback for degraded service: ${operationName}`);
          return await fallbackOperation();
        } else {
          throw new Error(`Service ${operationName} is degraded and no fallback available`);
        }
      }

      return await operation();
    } catch (error) {
      if (fallbackOperation) {
        log.warn(`Primary operation failed, falling back for ${operationName}:`, error);
        await this.degradeService(operationName);
        return await fallbackOperation();
      }
      throw error;
    }
  }

  private parseFlowDeskError(error: any): FlowDeskErrorInfo {
    if (typeof error === 'string') {
      try {
        return JSON.parse(error) as FlowDeskErrorInfo;
      } catch {
        return {
          error_type: 'unknown',
          message: error,
          operation: 'unknown',
          component: 'unknown',
          is_retryable: false,
          requires_user_action: false,
          context: '{}',
          severity: 'medium'
        };
      }
    }

    if (error?.message && typeof error.message === 'string') {
      try {
        return JSON.parse(error.message) as FlowDeskErrorInfo;
      } catch {
        return {
          error_type: 'unknown',
          message: error.message,
          operation: 'unknown',
          component: 'unknown',
          is_retryable: false,
          requires_user_action: false,
          context: JSON.stringify({ stack: error.stack }),
          severity: 'medium'
        };
      }
    }

    return {
      error_type: 'unknown',
      message: error?.toString() || 'Unknown error',
      operation: 'unknown',
      component: 'unknown',
      is_retryable: false,
      requires_user_action: false,
      context: JSON.stringify({ originalError: error }),
      severity: 'medium'
    };
  }

  private isRetryable(error: FlowDeskErrorInfo, customRetryIf?: (error: any) => boolean): boolean {
    if (customRetryIf) {
      return customRetryIf(error);
    }

    return error.is_retryable || 
           error.error_type === 'network' || 
           error.error_type === 'rate_limit' ||
           error.error_type === 'service_unavailable';
  }

  private shouldDegradeService(operationName: string, error: FlowDeskErrorInfo): boolean {
    const stats = this.errorStats.get(operationName);
    if (!stats) return false;

    // Degrade if we have too many consecutive failures
    return stats.count >= 5 && error.severity === 'high';
  }

  private async degradeService(serviceName: string): Promise<void> {
    if (this.degradedServices.has(serviceName)) return;

    log.warn(`Degrading service: ${serviceName}`);
    this.degradedServices.add(serviceName);

    // Set fallback configuration
    const fallbackConfig = {
      offlineMode: true,
      reducedFunctionality: true,
      cacheOnly: true
    };
    this.fallbackConfigs.set(serviceName, fallbackConfig);

    // Emit degradation event
    this.emit('service-degraded', {
      service: serviceName,
      timestamp: new Date().toISOString(),
      fallbackConfig
    });

    // Try to restore service after some time
    setTimeout(() => {
      this.restoreService(serviceName);
    }, 5 * 60 * 1000); // 5 minutes
  }

  private restoreService(serviceName: string): void {
    if (!this.degradedServices.has(serviceName)) return;

    log.info(`Restoring service: ${serviceName}`);
    this.degradedServices.delete(serviceName);
    this.fallbackConfigs.delete(serviceName);

    // Reset circuit breaker if exists
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }

    // Emit restoration event
    this.emit('service-restored', {
      service: serviceName,
      timestamp: new Date().toISOString()
    });
  }

  private updateErrorStats(operationName: string, error: FlowDeskErrorInfo): void {
    const current = this.errorStats.get(operationName) || { count: 0, lastError: new Date() };
    current.count++;
    current.lastError = new Date();
    this.errorStats.set(operationName, current);
  }

  private updateSuccessStats(operationName: string): void {
    // Reset error count on successful operation
    const current = this.errorStats.get(operationName);
    if (current) {
      current.count = 0;
      this.errorStats.set(operationName, current);
    }
  }

  private enhanceErrorForUI(error: FlowDeskErrorInfo): Error {
    const enhancedError = new Error(error.message);
    (enhancedError as any).flowDeskError = error;
    (enhancedError as any).isFlowDeskError = true;
    return enhancedError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API for service management
  public isServiceDegraded(serviceName: string): boolean {
    return this.degradedServices.has(serviceName);
  }

  public getServiceHealth(serviceName: string): ServiceHealthStatus {
    return {
      service: serviceName,
      status: this.degradedServices.has(serviceName) ? 'degraded' : 'healthy',
      message: this.degradedServices.has(serviceName) 
        ? 'Service is running in degraded mode' 
        : 'Service is operating normally',
      fallback_config: this.fallbackConfigs.get(serviceName),
      timestamp: new Date().toISOString()
    };
  }

  public getErrorStatistics(): { [key: string]: { count: number; lastError: string } } {
    const stats: { [key: string]: { count: number; lastError: string } } = {};
    this.errorStats.forEach((value, key) => {
      stats[key] = {
        count: value.count,
        lastError: value.lastError.toISOString()
      };
    });
    return stats;
  }

  public clearErrorStatistics(): void {
    this.errorStats.clear();
  }

  public forceRestoreService(serviceName: string): void {
    this.restoreService(serviceName);
  }
}

// Global error handler instance
export const rustErrorHandler = new RustErrorHandler();

// Convenience wrapper functions for common operations
export async function safeRustCall<T>(
  operationName: string,
  operation: () => Promise<T>,
  options?: {
    retryAttempts?: number;
    fallback?: () => Promise<T>;
    userNotification?: boolean;
  }
): Promise<T> {
  return rustErrorHandler.executeWithErrorHandling(operationName, operation, {
    strategy: 'retry',
    retryConfig: {
      maxAttempts: options?.retryAttempts || 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    },
    fallbackOperation: options?.fallback,
    userNotification: options?.userNotification ?? true
  });
}

export async function resilientRustCall<T>(
  operationName: string,
  operation: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  return rustErrorHandler.executeWithErrorHandling(operationName, operation, {
    strategy: 'graceful_degradation',
    fallbackOperation: fallback,
    userNotification: true
  });
}

export async function criticalRustCall<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  return rustErrorHandler.executeWithErrorHandling(operationName, operation, {
    strategy: 'circuit_breaker',
    circuitBreakerConfig: {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 2
    },
    userNotification: true
  });
}

// User-friendly error formatting
export function formatErrorForUser(error: any): {
  title: string;
  message: string;
  actions: Array<{ label: string; action: string; url?: string }>;
  severity: string;
} {
  const flowDeskError = error.flowDeskError as FlowDeskErrorInfo;
  
  if (!flowDeskError) {
    return {
      title: 'An error occurred',
      message: error.message || 'Unknown error',
      actions: [{ label: 'OK', action: 'dismiss' }],
      severity: 'medium'
    };
  }

  const title = {
    'authentication': 'Authentication Required',
    'network': 'Connection Issue',
    'rate_limit': 'Rate Limit Exceeded',
    'validation': 'Input Error',
    'configuration': 'Configuration Issue',
    'critical': 'Critical Error',
    'service_unavailable': 'Service Unavailable'
  }[flowDeskError.error_type] || 'An error occurred';

  const actions: Array<{ label: string; action: string; url?: string }> = [];

  if (flowDeskError.requires_user_action) {
    if (flowDeskError.auth_url) {
      actions.push(
        { label: 'Re-authenticate', action: 'open_url', url: flowDeskError.auth_url },
        { label: 'Cancel', action: 'dismiss' }
      );
    } else {
      actions.push({ label: 'OK', action: 'dismiss' });
    }
  } else if (flowDeskError.is_retryable) {
    actions.push(
      { label: 'Retry', action: 'retry' },
      { label: 'Cancel', action: 'dismiss' }
    );
  } else {
    actions.push({ label: 'OK', action: 'dismiss' });
  }

  return {
    title,
    message: flowDeskError.recovery_suggestion || flowDeskError.message,
    actions,
    severity: flowDeskError.severity
  };
}

export default rustErrorHandler;