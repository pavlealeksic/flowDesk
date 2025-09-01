/**
 * Email Service Error Handler
 * 
 * Comprehensive error handling system for email operations with
 * retry logic, error categorization, and user-friendly error messages
 */

import log from 'electron-log'
import { EventEmitter } from 'events'

export interface EmailError {
  id: string
  type: EmailErrorType
  category: EmailErrorCategory
  message: string
  originalError: any
  context: EmailErrorContext
  timestamp: Date
  isRetryable: boolean
  retryCount: number
  maxRetries: number
}

export type EmailErrorType = 
  | 'connection'
  | 'authentication'
  | 'authorization'
  | 'network'
  | 'server'
  | 'client'
  | 'quota'
  | 'rate_limit'
  | 'timeout'
  | 'unknown'

export type EmailErrorCategory = 
  | 'temporary'    // Temporary issues that might resolve themselves
  | 'permanent'    // Permanent issues requiring user intervention
  | 'configuration' // Configuration or setup issues
  | 'critical'     // Critical system errors

export interface EmailErrorContext {
  accountId?: string
  provider?: string
  operation?: string
  messageId?: string
  folderId?: string
  additional?: Record<string, any>
}

export interface RetryPolicy {
  maxRetries: number
  baseDelay: number // in milliseconds
  maxDelay: number
  backoffMultiplier: number
  jitterRange: number // 0-1, adds randomness to prevent thundering herd
}

export class EmailErrorHandler extends EventEmitter {
  private retryPolicies: Map<EmailErrorType, RetryPolicy> = new Map()
  private defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterRange: 0.1
  }

  constructor() {
    super()
    this.setupRetryPolicies()
  }

  private setupRetryPolicies(): void {
    // Connection errors - more aggressive retry
    this.retryPolicies.set('connection', {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitterRange: 0.2
    })

    // Authentication errors - limited retry
    this.retryPolicies.set('authentication', {
      maxRetries: 2,
      baseDelay: 5000,
      maxDelay: 10000,
      backoffMultiplier: 1.5,
      jitterRange: 0.1
    })

    // Network errors - standard retry
    this.retryPolicies.set('network', {
      maxRetries: 4,
      baseDelay: 1500,
      maxDelay: 45000,
      backoffMultiplier: 2.5,
      jitterRange: 0.15
    })

    // Rate limit errors - longer delays
    this.retryPolicies.set('rate_limit', {
      maxRetries: 3,
      baseDelay: 10000,
      maxDelay: 300000, // 5 minutes
      backoffMultiplier: 3,
      jitterRange: 0.1
    })

    // Server errors - moderate retry
    this.retryPolicies.set('server', {
      maxRetries: 3,
      baseDelay: 3000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterRange: 0.1
    })

    // Timeout errors - quick retry
    this.retryPolicies.set('timeout', {
      maxRetries: 4,
      baseDelay: 1000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitterRange: 0.2
    })
  }

  /**
   * Process and categorize an error
   */
  processError(error: any, context: EmailErrorContext): EmailError {
    const emailError: EmailError = {
      id: this.generateErrorId(),
      type: this.categorizeErrorType(error),
      category: this.categorizeErrorCategory(error),
      message: this.extractUserFriendlyMessage(error),
      originalError: error,
      context,
      timestamp: new Date(),
      isRetryable: this.isRetryableError(error),
      retryCount: 0,
      maxRetries: this.getMaxRetries(this.categorizeErrorType(error))
    }

    // Log the error
    this.logError(emailError)

    // Emit error event
    this.emit('error', emailError)

    return emailError
  }

  /**
   * Determine if an operation should be retried
   */
  shouldRetry(emailError: EmailError): boolean {
    return emailError.isRetryable && 
           emailError.retryCount < emailError.maxRetries &&
           emailError.category !== 'permanent'
  }

  /**
   * Calculate delay for next retry
   */
  calculateRetryDelay(emailError: EmailError): number {
    const policy = this.retryPolicies.get(emailError.type) || this.defaultRetryPolicy
    
    // Exponential backoff
    let delay = policy.baseDelay * Math.pow(policy.backoffMultiplier, emailError.retryCount)
    
    // Apply maximum delay
    delay = Math.min(delay, policy.maxDelay)
    
    // Add jitter to prevent thundering herd
    const jitter = delay * policy.jitterRange * (Math.random() - 0.5)
    delay = Math.max(0, delay + jitter)
    
    return Math.round(delay)
  }

  /**
   * Increment retry count
   */
  incrementRetryCount(emailError: EmailError): void {
    emailError.retryCount++
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private categorizeErrorType(error: any): EmailErrorType {
    const errorMessage = (error.message || error.toString()).toLowerCase()
    const errorCode = error.code || ''

    // Connection errors
    if (errorCode.includes('ECONNRESET') || 
        errorCode.includes('ECONNREFUSED') ||
        errorCode.includes('ENOTFOUND') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('connect')) {
      return 'connection'
    }

    // Authentication errors
    if (errorCode.includes('AUTHENTICATIONFAILED') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('invalid credentials') ||
        errorMessage.includes('login failed') ||
        errorMessage.includes('password') ||
        errorMessage.includes('unauthorized')) {
      return 'authentication'
    }

    // Authorization errors
    if (errorCode.includes('PERMISSION') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('access denied') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('insufficient privileges')) {
      return 'authorization'
    }

    // Network errors
    if (errorCode.includes('ETIMEDOUT') ||
        errorCode.includes('ENETDOWN') ||
        errorCode.includes('ENETUNREACH') ||
        errorCode.includes('EHOSTDOWN') ||
        errorCode.includes('EHOSTUNREACH') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout')) {
      return 'network'
    }

    // Server errors
    if (error.responseCode >= 500 ||
        errorMessage.includes('server error') ||
        errorMessage.includes('internal server') ||
        errorMessage.includes('service unavailable') ||
        errorMessage.includes('bad gateway')) {
      return 'server'
    }

    // Rate limit errors
    if (error.responseCode === 429 ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('too many requests')) {
      return 'rate_limit'
    }

    // Quota errors
    if (errorMessage.includes('quota') ||
        errorMessage.includes('limit exceeded') ||
        errorMessage.includes('storage full')) {
      return 'quota'
    }

    // Timeout errors
    if (errorMessage.includes('timeout') ||
        errorCode.includes('TIMEOUT')) {
      return 'timeout'
    }

    // Client errors
    if (error.responseCode >= 400 && error.responseCode < 500) {
      return 'client'
    }

    return 'unknown'
  }

  private categorizeErrorCategory(error: any): EmailErrorCategory {
    const errorType = this.categorizeErrorType(error)

    switch (errorType) {
      case 'connection':
      case 'network':
      case 'server':
      case 'timeout':
        return 'temporary'

      case 'authentication':
      case 'authorization':
      case 'quota':
        return 'permanent'

      case 'rate_limit':
        return 'temporary'

      case 'client':
        return 'configuration'

      default:
        return 'critical'
    }
  }

  private extractUserFriendlyMessage(error: any): string {
    const errorType = this.categorizeErrorType(error)
    const originalMessage = error.message || error.toString()

    const friendlyMessages: Record<EmailErrorType, string> = {
      connection: 'Unable to connect to email server. Please check your internet connection and try again.',
      authentication: 'Email login failed. Please check your username and password.',
      authorization: 'Access denied. Please check your account permissions.',
      network: 'Network connection problem. Please check your internet connection.',
      server: 'Email server is currently experiencing issues. Please try again later.',
      client: 'There was a problem with your request. Please check your settings.',
      quota: 'Storage quota exceeded. Please free up space in your account.',
      rate_limit: 'Too many requests. Please wait a moment before trying again.',
      timeout: 'The operation timed out. Please try again.',
      unknown: 'An unexpected error occurred. Please try again.'
    }

    let friendlyMessage = friendlyMessages[errorType] || friendlyMessages.unknown

    // Add specific context for certain errors
    if (errorType === 'authentication' && originalMessage.includes('app password')) {
      friendlyMessage += ' You may need to generate an app-specific password.'
    }

    if (errorType === 'connection' && originalMessage.includes('port')) {
      friendlyMessage += ' Please verify your server settings.'
    }

    return friendlyMessage
  }

  private isRetryableError(error: any): boolean {
    const errorType = this.categorizeErrorType(error)
    const errorCategory = this.categorizeErrorCategory(error)

    // Don't retry permanent errors
    if (errorCategory === 'permanent') {
      return false
    }

    // Don't retry certain authentication errors
    if (errorType === 'authentication' && 
        (error.message || '').toLowerCase().includes('invalid credentials')) {
      return false
    }

    // Don't retry quota errors
    if (errorType === 'quota') {
      return false
    }

    // Most other errors are retryable
    return true
  }

  private getMaxRetries(errorType: EmailErrorType): number {
    const policy = this.retryPolicies.get(errorType) || this.defaultRetryPolicy
    return policy.maxRetries
  }

  private logError(emailError: EmailError): void {
    const logLevel = this.getLogLevel(emailError.category)
    
    const logMessage = `Email ${emailError.type} error in ${emailError.context.operation || 'unknown operation'}` +
      (emailError.context.accountId ? ` for account ${emailError.context.accountId}` : '') +
      `: ${emailError.message}`

    const logContext = {
      errorId: emailError.id,
      type: emailError.type,
      category: emailError.category,
      retryable: emailError.isRetryable,
      retryCount: emailError.retryCount,
      context: emailError.context,
      originalError: emailError.originalError?.message || emailError.originalError
    }

    switch (logLevel) {
      case 'error':
        log.error(logMessage, logContext)
        break
      case 'warn':
        log.warn(logMessage, logContext)
        break
      case 'info':
        log.info(logMessage, logContext)
        break
      default:
        log.debug(logMessage, logContext)
    }
  }

  private getLogLevel(category: EmailErrorCategory): 'error' | 'warn' | 'info' | 'debug' {
    switch (category) {
      case 'critical':
        return 'error'
      case 'permanent':
        return 'error'
      case 'configuration':
        return 'warn'
      case 'temporary':
        return 'info'
      default:
        return 'debug'
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    // This would maintain error statistics in a production implementation
    return {}
  }

  /**
   * Clear old errors (cleanup)
   */
  clearOldErrors(olderThanMs: number): void {
    // This would clear old errors from any persistent storage
    const cutoffTime = Date.now() - olderThanMs
    log.info(`Clearing errors older than ${new Date(cutoffTime)}`)
  }
}

/**
 * Utility function to wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: EmailErrorContext,
  errorHandler: EmailErrorHandler
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const emailError = errorHandler.processError(error, context)
    throw emailError
  }
}

/**
 * Utility function for retryable operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: EmailErrorContext,
  errorHandler: EmailErrorHandler,
  onRetry?: (attempt: number, error: EmailError) => void
): Promise<T> {
  let lastError: EmailError | null = null
  
  for (let attempt = 0; attempt <= (lastError?.maxRetries || 3); attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? 
        errorHandler.processError(error, context) : 
        error as EmailError

      // If this is not the first attempt, increment retry count
      if (attempt > 0) {
        errorHandler.incrementRetryCount(lastError)
      }

      // Check if we should retry
      if (!errorHandler.shouldRetry(lastError) || attempt >= lastError.maxRetries) {
        throw lastError
      }

      // Calculate delay and wait
      const delay = errorHandler.calculateRetryDelay(lastError)
      log.info(`Retrying operation after ${delay}ms (attempt ${attempt + 1}/${lastError.maxRetries + 1})`)
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but just in case
  throw lastError
}

export default EmailErrorHandler