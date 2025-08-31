/**
 * Error handling utilities for automation actions
 */

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return 'An unknown error occurred';
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(action: string, error: unknown): never {
  const message = getErrorMessage(error);
  throw new Error(`${action}: ${message}`);
}