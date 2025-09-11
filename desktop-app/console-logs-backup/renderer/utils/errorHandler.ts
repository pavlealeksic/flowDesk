/**
 * User-Friendly Error Handler for Flow Desk
 * 
 * This utility provides user-friendly error messages and recovery options
 * for common application operations like workspace and service management.
 */

// Simple error interface focused on user experience
export interface AppError extends Error {
  userMessage: string;
  code: string;
  canRetry: boolean;
  details?: string;
  recoveryActions?: RecoveryAction[];
  cause?: Error;
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export type ErrorCode = 
  // Workspace errors
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_CREATION_FAILED'
  | 'WORKSPACE_DELETION_FAILED'
  | 'WORKSPACE_SWITCH_FAILED'
  | 'WORKSPACE_UPDATE_FAILED'
  | 'WORKSPACE_LOAD_FAILED'
  
  // Service errors
  | 'SERVICE_NOT_FOUND'
  | 'SERVICE_CREATION_FAILED'
  | 'SERVICE_LOAD_FAILED'
  | 'SERVICE_DELETE_FAILED'
  | 'SERVICE_UPDATE_FAILED'
  | 'SERVICE_URL_INVALID'
  | 'SERVICE_NETWORK_ERROR'
  | 'SERVICE_TIMEOUT'
  
  // Network/Connection errors
  | 'NETWORK_UNREACHABLE'
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_REFUSED'
  
  // File/Storage errors
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'STORAGE_FULL'
  | 'DATA_CORRUPTED'
  
  // General errors
  | 'UNKNOWN_ERROR'
  | 'OPERATION_CANCELLED'
  | 'INVALID_INPUT';

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<ErrorCode, { title: string; message: string; canRetry: boolean }> = {
  // Workspace errors
  WORKSPACE_NOT_FOUND: {
    title: 'Workspace Not Found',
    message: 'The workspace you\'re trying to access no longer exists or has been moved.',
    canRetry: false
  },
  WORKSPACE_CREATION_FAILED: {
    title: 'Failed to Create Workspace',
    message: 'We couldn\'t create your new workspace. Please try again with a different name.',
    canRetry: true
  },
  WORKSPACE_DELETION_FAILED: {
    title: 'Failed to Delete Workspace',
    message: 'We couldn\'t delete this workspace. It might still be in use.',
    canRetry: true
  },
  WORKSPACE_SWITCH_FAILED: {
    title: 'Failed to Switch Workspace',
    message: 'We couldn\'t switch to the selected workspace. Please try selecting it again.',
    canRetry: true
  },
  WORKSPACE_UPDATE_FAILED: {
    title: 'Failed to Update Workspace',
    message: 'Your workspace changes couldn\'t be saved. Please try again.',
    canRetry: true
  },
  WORKSPACE_LOAD_FAILED: {
    title: 'Failed to Load Workspaces',
    message: 'We couldn\'t load your workspaces. Please restart the application.',
    canRetry: true
  },

  // Service errors
  SERVICE_NOT_FOUND: {
    title: 'Service Not Found',
    message: 'The service you\'re looking for doesn\'t exist or has been removed.',
    canRetry: false
  },
  SERVICE_CREATION_FAILED: {
    title: 'Failed to Add Service',
    message: 'We couldn\'t add this service to your workspace. Please check the URL and try again.',
    canRetry: true
  },
  SERVICE_LOAD_FAILED: {
    title: 'Service Failed to Load',
    message: 'The service couldn\'t be loaded. This might be due to network issues or the service being unavailable.',
    canRetry: true
  },
  SERVICE_DELETE_FAILED: {
    title: 'Failed to Remove Service',
    message: 'We couldn\'t remove this service from your workspace.',
    canRetry: true
  },
  SERVICE_UPDATE_FAILED: {
    title: 'Failed to Update Service',
    message: 'Your service changes couldn\'t be saved.',
    canRetry: true
  },
  SERVICE_URL_INVALID: {
    title: 'Invalid Service URL',
    message: 'The URL you entered is not valid. Please check it and try again.',
    canRetry: false
  },
  SERVICE_NETWORK_ERROR: {
    title: 'Network Connection Error',
    message: 'We couldn\'t connect to this service. Please check your internet connection.',
    canRetry: true
  },
  SERVICE_TIMEOUT: {
    title: 'Service Timed Out',
    message: 'The service took too long to respond. Please try again.',
    canRetry: true
  },

  // Network errors
  NETWORK_UNREACHABLE: {
    title: 'No Internet Connection',
    message: 'Please check your internet connection and try again.',
    canRetry: true
  },
  CONNECTION_TIMEOUT: {
    title: 'Connection Timed Out',
    message: 'The connection took too long. Please try again.',
    canRetry: true
  },
  CONNECTION_REFUSED: {
    title: 'Connection Failed',
    message: 'The server refused the connection. Please try again later.',
    canRetry: true
  },

  // File/Storage errors
  FILE_NOT_FOUND: {
    title: 'File Not Found',
    message: 'The requested file doesn\'t exist or has been moved.',
    canRetry: false
  },
  PERMISSION_DENIED: {
    title: 'Permission Denied',
    message: 'You don\'t have permission to perform this action.',
    canRetry: false
  },
  STORAGE_FULL: {
    title: 'Storage Full',
    message: 'There\'s not enough space available. Please free up some space and try again.',
    canRetry: false
  },
  DATA_CORRUPTED: {
    title: 'Data Corrupted',
    message: 'The data appears to be corrupted. Please restart the application.',
    canRetry: false
  },

  // General errors
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
    canRetry: true
  },
  OPERATION_CANCELLED: {
    title: 'Operation Cancelled',
    message: 'The operation was cancelled.',
    canRetry: false
  },
  INVALID_INPUT: {
    title: 'Invalid Input',
    message: 'Please check your input and try again.',
    canRetry: false
  }
};

/**
 * Create a user-friendly AppError from a raw error
 */
export function createAppError(
  code: ErrorCode,
  originalError?: Error | unknown,
  details?: string,
  recoveryActions?: RecoveryAction[]
): AppError {
  const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
  
  const appError = new Error(errorInfo.message) as AppError;
  appError.name = 'AppError';
  appError.userMessage = errorInfo.message;
  appError.code = code;
  appError.canRetry = errorInfo.canRetry;
  appError.details = details;
  appError.recoveryActions = recoveryActions;

  // Preserve original error information
  if (originalError instanceof Error) {
    appError.stack = originalError.stack;
    appError.cause = originalError;
  }

  return appError;
}

/**
 * Classify an unknown error and convert it to an AppError
 */
export function classifyError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network-related errors
    if (message.includes('network') || message.includes('fetch')) {
      return createAppError('NETWORK_UNREACHABLE', error);
    }
    
    if (message.includes('timeout')) {
      return createAppError('CONNECTION_TIMEOUT', error);
    }
    
    if (message.includes('refused') || message.includes('econnrefused')) {
      return createAppError('CONNECTION_REFUSED', error);
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('eacces')) {
      return createAppError('PERMISSION_DENIED', error);
    }
    
    // File system errors
    if (message.includes('enoent') || message.includes('not found')) {
      return createAppError('FILE_NOT_FOUND', error);
    }
    
    // Storage errors
    if (message.includes('enospc') || message.includes('no space')) {
      return createAppError('STORAGE_FULL', error);
    }
    
    // URL validation errors
    if (message.includes('invalid url') || message.includes('malformed')) {
      return createAppError('SERVICE_URL_INVALID', error);
    }
    
    // Default to unknown error
    return createAppError('UNKNOWN_ERROR', error, error.message);
  }
  
  // Handle non-Error objects
  const errorMessage = typeof error === 'string' ? error : 'An unexpected error occurred';
  return createAppError('UNKNOWN_ERROR', undefined, errorMessage);
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && 
         'userMessage' in error && 
         'code' in error && 
         'canRetry' in error;
}

/**
 * Get user-friendly error title for display
 */
export function getErrorTitle(error: AppError): string {
  const errorInfo = ERROR_MESSAGES[error.code as ErrorCode];
  return errorInfo?.title || 'Error';
}

/**
 * Workspace-specific error factory
 */
export const workspaceErrors = {
  notFound: (id: string): AppError => 
    createAppError('WORKSPACE_NOT_FOUND', undefined, `Workspace ID: ${id}`),
  
  creationFailed: (name: string, reason?: string): AppError =>
    createAppError('WORKSPACE_CREATION_FAILED', undefined, 
      reason ? `Failed to create "${name}": ${reason}` : `Failed to create "${name}"`),
  
  switchFailed: (id: string, reason?: string): AppError =>
    createAppError('WORKSPACE_SWITCH_FAILED', undefined, 
      reason ? `Failed to switch to workspace: ${reason}` : undefined),
  
  updateFailed: (id: string, reason?: string): AppError =>
    createAppError('WORKSPACE_UPDATE_FAILED', undefined, reason),
  
  loadFailed: (reason?: string): AppError =>
    createAppError('WORKSPACE_LOAD_FAILED', undefined, reason)
};

/**
 * Service-specific error factory
 */
export const serviceErrors = {
  notFound: (id: string): AppError =>
    createAppError('SERVICE_NOT_FOUND', undefined, `Service ID: ${id}`),
  
  creationFailed: (name: string, url: string, reason?: string): AppError =>
    createAppError('SERVICE_CREATION_FAILED', undefined, 
      `Failed to add "${name}" (${url})${reason ? ': ' + reason : ''}`),
  
  loadFailed: (name: string, reason?: string): AppError =>
    createAppError('SERVICE_LOAD_FAILED', undefined, 
      `Failed to load "${name}"${reason ? ': ' + reason : ''}`),
  
  deleteFailed: (name: string, reason?: string): AppError =>
    createAppError('SERVICE_DELETE_FAILED', undefined, 
      `Failed to remove "${name}"${reason ? ': ' + reason : ''}`),
  
  updateFailed: (name: string, reason?: string): AppError =>
    createAppError('SERVICE_UPDATE_FAILED', undefined, 
      `Failed to update "${name}"${reason ? ': ' + reason : ''}`),
  
  invalidUrl: (url: string): AppError =>
    createAppError('SERVICE_URL_INVALID', undefined, `Invalid URL: ${url}`),
  
  networkError: (name: string, originalError?: Error): AppError =>
    createAppError('SERVICE_NETWORK_ERROR', originalError, 
      `Network error loading "${name}"`),
  
  timeout: (name: string): AppError =>
    createAppError('SERVICE_TIMEOUT', undefined, 
      `"${name}" took too long to respond`)
};

/**
 * Handle an error with optional recovery actions
 */
export async function handleError(
  error: unknown,
  context?: {
    operation?: string;
    component?: string;
    onRetry?: () => void | Promise<void>;
    onDismiss?: () => void;
  }
): Promise<AppError> {
  const appError = classifyError(error);
  
  // Add recovery actions based on error type and context
  const recoveryActions: RecoveryAction[] = [];
  
  if (appError.canRetry && context?.onRetry) {
    recoveryActions.push({
      label: 'Try Again',
      action: context.onRetry,
      primary: true
    });
  }
  
  if (context?.onDismiss) {
    recoveryActions.push({
      label: 'Dismiss',
      action: context.onDismiss
    });
  }
  
  // Add refresh action for certain error types
  if (['WORKSPACE_LOAD_FAILED', 'SERVICE_LOAD_FAILED'].includes(appError.code)) {
    recoveryActions.push({
      label: 'Refresh',
      action: () => window.location.reload()
    });
  }
  
  appError.recoveryActions = recoveryActions;
  
  // Log the error for debugging
  console.error(`[${context?.component || 'Unknown'}] ${context?.operation || 'Operation'} failed:`, {
    code: appError.code,
    message: appError.userMessage,
    details: appError.details,
    originalError: appError.cause
  });
  
  return appError;
}

/**
 * Retry utility with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: AppError) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry
  } = options;
  
  let lastError: AppError | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = classifyError(error);
      
      // Don't retry if error is not retryable or if this is the last attempt
      if (!lastError.canRetry || attempt === maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}