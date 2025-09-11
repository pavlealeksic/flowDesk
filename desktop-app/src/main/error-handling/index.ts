/**
 * Error Handling System Exports
 * 
 * Central export point for all error handling components
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

// Core error types and interfaces
export type {
  AppError,
  ErrorContext,
  RecoveryAction
} from './AppError';
export {
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  ErrorFactory
} from './AppError';
export {
  BaseAppError,
  ErrorManager,
  errorManager
} from './AppError';

// Retry handling
export type {
  RetryStrategy,
  CircuitBreakerConfig,
  CircuitState,
  RetryEventType,
  RetryContext
} from './RetryHandler';
export type {
  RetryHandler,
  RetryEvent
} from './RetryHandler';
export {
  retryHandler
} from './RetryHandler';

// IPC error handling
export type {
  IPCErrorResponse,
  IPCOperationContext,
  RateLimitConfig
} from './IPCErrorHandler';
export {
  IPCErrorHandler,
  ipcErrorHandler
} from './IPCErrorHandler';

// Utility functions
export type * from './utils';

// Global instances (already exported above)
// Note: errorManager, retryHandler, and ipcErrorHandler are already exported in their respective sections