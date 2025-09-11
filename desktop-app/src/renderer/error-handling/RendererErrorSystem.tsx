/**
 * Renderer Process Error Handling System for Flow Desk
 * 
 * Comprehensive error handling for the React renderer process with
 * error boundaries, error recovery, and user-friendly error displays.
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, ErrorCode, ErrorCategory, ErrorSeverity, RecoveryAction } from '../../main/error-handling';

/**
 * Error boundary component for catching React errors
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log the error
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Send error to main process for handling
    if (window.flowDesk?.logging) {
      try {
        window.flowDesk.logging.log({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Renderer error caught',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        });
      } catch (err) {
        console.error('Failed to log error to main process:', err);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error context for global error state management
 */
export interface ErrorContextType {
  currentError: AppError | null;
  showError: (error: AppError) => void;
  hideError: () => void;
  retryLastError: () => Promise<void>;
  errorHistory: AppError[];
}

export const ErrorContext = React.createContext<ErrorContextType>({
  currentError: null,
  showError: () => {},
  hideError: () => {},
  retryLastError: async () => {},
  errorHistory: []
});

/**
 * Error provider component
 */
export class ErrorProvider extends Component<{ children: ReactNode }, ErrorContextType> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      currentError: null,
      showError: this.showError.bind(this),
      hideError: this.hideError.bind(this),
      retryLastError: this.retryLastError.bind(this),
      errorHistory: []
    };
  }

  showError(error: AppError): void {
    this.setState(prevState => ({
      currentError: error,
      errorHistory: [...prevState.errorHistory.slice(-99), error] // Keep last 100 errors
    }));
  }

  hideError(): void {
    this.setState({ currentError: null });
  }

  async retryLastError(): Promise<void> {
    if (this.state.currentError) {
      try {
        await this.state.currentError.retry();
        this.setState({ currentError: null });
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }
  }

  render() {
    return (
      <ErrorContext.Provider value={this.state}>
        {this.props.children}
      </ErrorContext.Provider>
    );
  }
}

/**
 * Hook for using error context
 */
export function useError(): ErrorContextType {
  const context = React.useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

/**
 * Error display component
 */
export function ErrorDisplay(): ReactNode {
  const { currentError, hideError, retryLastError } = useError();

  if (!currentError) {
    return null;
  }

  return (
    <div className="error-modal-overlay">
      <div className="error-modal">
        <div className="error-header">
          <h3>{getErrorTitle(currentError)}</h3>
          <button onClick={hideError} className="error-close">×</button>
        </div>
        
        <div className="error-content">
          <p className="error-message">{currentError.userMessage}</p>
          
          {currentError.details && (
            <details className="error-details">
              <summary>Technical Details</summary>
              <pre>{currentError.details}</pre>
            </details>
          )}
          
          <div className="error-actions">
            {currentError.recoveryActions.map((action: any, index: number) => (
              <button
                key={index}
                onClick={() => {
                  action.action();
                  hideError();
                }}
                className={`error-action ${action.primary ? 'primary' : ''} ${action.destructive ? 'destructive' : ''}`}
              >
                {action.label}
              </button>
            ))}
            
            {currentError.isRetryable && !currentError.recoveryActions.some((a: any) => a.id === 'retry') && (
              <button onClick={retryLastError} className="error-action primary">
                Try Again
              </button>
            )}
            
            <button onClick={hideError} className="error-action">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get user-friendly error title
 */
function getErrorTitle(error: AppError): string {
  const titles: Record<ErrorCode, string> = {
    [ErrorCode.WORKSPACE_NOT_FOUND]: 'Workspace Not Found',
    [ErrorCode.WORKSPACE_CREATION_FAILED]: 'Failed to Create Workspace',
    [ErrorCode.WORKSPACE_DELETION_FAILED]: 'Failed to Delete Workspace',
    [ErrorCode.WORKSPACE_SWITCH_FAILED]: 'Failed to Switch Workspace',
    [ErrorCode.WORKSPACE_UPDATE_FAILED]: 'Failed to Update Workspace',
    [ErrorCode.WORKSPACE_LOAD_FAILED]: 'Failed to Load Workspaces',
    [ErrorCode.WORKSPACE_DATA_CORRUPTED]: 'Workspace Data Corrupted',
    [ErrorCode.WORKSPACE_LIMIT_EXCEEDED]: 'Workspace Limit Exceeded',
    [ErrorCode.SERVICE_NOT_FOUND]: 'Service Not Found',
    [ErrorCode.SERVICE_CREATION_FAILED]: 'Failed to Add Service',
    [ErrorCode.SERVICE_LOAD_FAILED]: 'Service Failed to Load',
    [ErrorCode.SERVICE_DELETE_FAILED]: 'Failed to Remove Service',
    [ErrorCode.SERVICE_UPDATE_FAILED]: 'Failed to Update Service',
    [ErrorCode.SERVICE_URL_INVALID]: 'Invalid Service URL',
    [ErrorCode.SERVICE_NETWORK_ERROR]: 'Network Connection Error',
    [ErrorCode.SERVICE_TIMEOUT]: 'Service Timed Out',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    [ErrorCode.SERVICE_LIMIT_EXCEEDED]: 'Service Limit Exceeded',
    [ErrorCode.NETWORK_UNREACHABLE]: 'No Internet Connection',
    [ErrorCode.CONNECTION_TIMEOUT]: 'Connection Timed Out',
    [ErrorCode.CONNECTION_REFUSED]: 'Connection Failed',
    [ErrorCode.DNS_RESOLUTION_FAILED]: 'DNS Resolution Failed',
    [ErrorCode.SSL_ERROR]: 'SSL Error',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate Limit Exceeded',
    [ErrorCode.FILE_NOT_FOUND]: 'File Not Found',
    [ErrorCode.PERMISSION_DENIED]: 'Permission Denied',
    [ErrorCode.STORAGE_FULL]: 'Storage Full',
    [ErrorCode.FILE_CORRUPTED]: 'File Corrupted',
    [ErrorCode.PATH_INVALID]: 'Invalid Path',
    [ErrorCode.ACCESS_DENIED]: 'Access Denied',
    [ErrorCode.UNKNOWN_ERROR]: 'Something Went Wrong',
    [ErrorCode.OPERATION_CANCELLED]: 'Operation Cancelled',
    [ErrorCode.INVALID_INPUT]: 'Invalid Input',
    [ErrorCode.CONFIG_LOAD_FAILED]: 'Configuration Load Failed',
    [ErrorCode.CONFIG_VALIDATION_FAILED]: 'Configuration Validation Failed',
    [ErrorCode.CONFIG_UPDATE_FAILED]: 'Configuration Update Failed',
    [ErrorCode.CONFIG_MISSING]: 'Configuration Missing',
    [ErrorCode.AUTHENTICATION_FAILED]: 'Authentication Failed',
    [ErrorCode.SECURITY_VIOLATION]: 'Security Violation',
    [ErrorCode.AUTHORIZATION_FAILED]: 'Authorization Failed',
    [ErrorCode.ENCRYPTION_ERROR]: 'Encryption Error',
    [ErrorCode.VALIDATION_ERROR]: 'Validation Error',
    [ErrorCode.SANITIZATION_ERROR]: 'Sanitization Error',
    [ErrorCode.MEMORY_EXHAUSTED]: 'Memory Exhausted',
    [ErrorCode.PROCESS_CRASHED]: 'Process Crashed',
    [ErrorCode.SYSTEM_RESOURCE_EXHAUSTED]: 'System Resource Exhausted',
    [ErrorCode.PERFORMANCE_DEGRADED]: 'Performance Degraded',
    [ErrorCode.DATABASE_CONNECTION_FAILED]: 'Database Connection Failed',
    [ErrorCode.DATABASE_QUERY_FAILED]: 'Database Query Failed',
    [ErrorCode.DATABASE_TIMEOUT]: 'Database Timeout',
    [ErrorCode.DATABASE_CONSTRAINT_VIOLATION]: 'Database Constraint Violation',
    [ErrorCode.DATABASE_INTEGRITY_ERROR]: 'Database Integrity Error',
    [ErrorCode.PLUGIN_LOAD_FAILED]: 'Plugin Load Failed',
    [ErrorCode.PLUGIN_EXECUTION_FAILED]: 'Plugin Execution Failed',
    [ErrorCode.PLUGIN_TIMEOUT]: 'Plugin Timeout',
    [ErrorCode.PLUGIN_NOT_FOUND]: 'Plugin Not Found',
    [ErrorCode.PLUGIN_INCOMPATIBLE]: 'Plugin Incompatible',
    [ErrorCode.RENDERER_CRASHED]: 'Application Error',
    [ErrorCode.UI_UNRESPONSIVE]: 'UI Unresponsive',
    [ErrorCode.COMPONENT_ERROR]: 'Component Error',
    [ErrorCode.TIMEOUT]: 'Timeout',
    [ErrorCode.INTERNAL_ERROR]: 'Internal Error'
  };

  return titles[error.code] || 'Error';
}

/**
 * Hook for handling async operations with error handling
 */
export function useAsyncOperation<T, E = AppError>() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<E | null>(null);
  const [data, setData] = React.useState<T | null>(null);
  const { showError } = useError();

  const execute = React.useCallback(async (
    operation: () => Promise<T>,
    options: {
      errorMessage?: string;
      showUserError?: boolean;
      retryable?: boolean;
    } = {}
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      const appError = err as E;
      setError(appError);
      
      if (options.showUserError !== false) {
        if (appError instanceof AppError) {
          showError(appError);
        } else {
          showError({
            name: 'AsyncError',
            message: options.errorMessage || 'Operation failed',
            id: `async_${Date.now()}`,
            code: ErrorCode.UNKNOWN_ERROR,
            category: ErrorCategory.UNKNOWN,
            severity: ErrorSeverity.HIGH,
            userMessage: options.errorMessage || 'Operation failed',
            technicalMessage: String(appError),
            isRetryable: options.retryable !== false,
            recoveryActions: [],
            context: {
              timestamp: new Date()
            },
            timestamp: new Date(),
            retryCount: 0,
            maxRetries: 3,
            retry: async function() { this.retryCount++; },
            addRecoveryAction: function(action: RecoveryAction) { this.recoveryActions.push(action); },
            toJSON: function() { return { error: this.message }; }
          });
        }
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  return { execute, loading, error, data };
}

/**
 * Hook for handling form validation errors
 */
export function useFormValidation<T extends Record<string, any>>() {
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({});
  const [isValid, setIsValid] = React.useState(false);

  const validate = React.useCallback((data: T, rules: Record<keyof T, (value: any) => string | null>) => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let valid = true;

    Object.entries(rules).forEach(([field, validator]) => {
      const error = validator(data[field]);
      if (error) {
        newErrors[field as keyof T] = error;
        valid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(valid);
    return valid;
  }, []);

  const clearErrors = React.useCallback(() => {
    setErrors({});
    setIsValid(true);
  }, []);

  const clearFieldError = React.useCallback((field: keyof T) => {
    setErrors(prev => ({ ...prev, [field]: undefined }));
    setIsValid(Object.keys(errors).length === 0);
  }, [errors]);

  return { errors, isValid, validate, clearErrors, clearFieldError };
}

/**
 * Hook for handling network request errors
 */
export function useNetworkRequest() {
  const { showError } = useError();

  const request = React.useCallback(async function <T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const networkError = {
        name: 'NetworkError',
        message: `Network request failed: ${url}`,
        id: `network_${Date.now()}`,
        code: ErrorCode.NETWORK_UNREACHABLE,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Network request failed. Please check your connection.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        isRetryable: true,
        recoveryActions: [
          {
            id: 'retry',
            label: 'Try Again',
            primary: true,
            action: () => request(url, options)
          }
        ],
        context: {
          operation: 'network_request',
          timestamp: new Date()
        },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        retry: async function() { this.retryCount++; },
        addRecoveryAction: function(action: RecoveryAction) { this.recoveryActions.push(action); },
        toJSON: function() { return { error: this.message }; }
      };

      showError(networkError);
      throw networkError;
    }
  }, [showError]);

  return { request };
}

/**
 * Hook for handling IPC errors
 */
export function useIPCHandler() {
  const { showError } = useError();

  const invoke = React.useCallback(async function <T>(
    channel: string,
    ...args: any[]
  ): Promise<T> {
    try {
      if (!window.flowDesk) {
        throw new Error('FlowDesk API not available');
      }
      
      // Use specific IPC methods available in the API
      if (channel.startsWith('workspace:')) {
        // Handle workspace IPC calls directly using the available methods
        if (channel === 'workspace:list') return window.flowDesk.workspace.list() as Promise<T>;
        if (channel === 'workspace:create') return window.flowDesk.workspace.create(args[0]) as Promise<T>;
        if (channel === 'workspace:get') return window.flowDesk.workspace.get(args[0]) as Promise<T>;
        if (channel === 'workspace:switch') return window.flowDesk.workspace.switch(args[0]) as Promise<T>;
        if (channel === 'workspace:update') return window.flowDesk.workspace.update(args[0], args[1]) as Promise<T>;
        if (channel === 'workspace:delete') return window.flowDesk.workspace.delete(args[0]) as Promise<T>;
        throw new Error(`Unsupported workspace channel: ${channel}`);
      } else if (channel.startsWith('system:')) {
        // Handle system IPC calls directly using the available methods
        if (channel === 'system:showNotification') return window.flowDesk.system.showNotification(args[0]) as Promise<T>;
        if (channel === 'system:showDialog') return window.flowDesk.system.showDialog(args[0]) as Promise<T>;
        if (channel === 'system:openExternal') return window.flowDesk.system.openExternal(args[0]) as Promise<T>;
        throw new Error(`Unsupported system channel: ${channel}`);
      } else {
        throw new Error(`Unsupported IPC channel: ${channel}`);
      }
    } catch (error) {
      const ipcError = {
        name: 'IPCError',
        message: `IPC call failed: ${channel}`,
        id: `ipc_${Date.now()}`,
        code: ErrorCode.UNKNOWN_ERROR,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Communication with main process failed.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        isRetryable: true,
        recoveryActions: [
          {
            id: 'retry',
            label: 'Try Again',
            primary: true,
            action: () => invoke(channel, ...args)
          }
        ],
        context: {
          operation: 'ipc_call',
          timestamp: new Date()
        },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        retry: async function() { this.retryCount++; },
        addRecoveryAction: function(action: RecoveryAction) { this.recoveryActions.push(action); },
        toJSON: function() { return { error: this.message }; }
      };

      showError(ipcError);
      throw ipcError;
    }
  }, [showError]);

  return { invoke };
}

export default {
  ErrorBoundary,
  ErrorProvider,
  useError,
  ErrorDisplay,
  useAsyncOperation,
  useFormValidation,
  useNetworkRequest,
  useIPCHandler
};