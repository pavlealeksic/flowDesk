/**
 * Console Statement Replacer Utility
 * 
 * Provides utilities to systematically replace console statements
 * with proper logging calls throughout the codebase
 */

import { createLogger } from './LoggerFactory';

/**
 * Mapping of console methods to log levels
 */
const consoleToLogLevel = {
  log: 'debug',
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'trace'
} as const;

/**
 * Enhanced console replacement that provides both console output and structured logging
 */
export class EnhancedConsole {
  private logger: any;
  private component: string;
  
  constructor(component: string) {
    this.component = component;
    this.logger = createLogger(component);
  }

  /**
   * Replace console.log with structured logging
   */
  log = (...args: any[]): void => {
    // Forward to original console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
    
    // Log with proper structure
    this.logger.debug(
      this.formatMessage(args),
      { method: 'console.log' },
      { originalArgs: this.sanitizeArgs(args) }
    );
  };

  /**
   * Replace console.error with structured logging
   */
  error = (...args: any[]): void => {
    // Forward to original console for development
    if (process.env.NODE_ENV === 'development') {
      console.error(...args);
    }
    
    // Check if first argument is an Error object
    const error = args[0] instanceof Error ? args[0] : undefined;
    const message = error ? error.message : this.formatMessage(args);
    
    this.logger.error(
      message,
      error,
      { method: 'console.error' },
      { originalArgs: this.sanitizeArgs(args) }
    );
  };

  /**
   * Replace console.warn with structured logging
   */
  warn = (...args: any[]): void => {
    // Forward to original console for development
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
    
    this.logger.warn(
      this.formatMessage(args),
      { method: 'console.warn' },
      { originalArgs: this.sanitizeArgs(args) }
    );
  };

  /**
   * Replace console.info with structured logging
   */
  info = (...args: any[]): void => {
    // Forward to original console for development
    if (process.env.NODE_ENV === 'development') {
      console.info(...args);
    }
    
    this.logger.info(
      this.formatMessage(args),
      { method: 'console.info' },
      { originalArgs: this.sanitizeArgs(args) }
    );
  };

  /**
   * Replace console.debug with structured logging
   */
  debug = (...args: any[]): void => {
    // Forward to original console for development
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args);
    }
    
    this.logger.debug(
      this.formatMessage(args),
      { method: 'console.debug' },
      { originalArgs: this.sanitizeArgs(args) }
    );
  };

  /**
   * Replace console.trace with structured logging
   */
  trace = (...args: any[]): void => {
    // Forward to original console for development
    if (process.env.NODE_ENV === 'development') {
      console.trace(...args);
    }
    
    this.logger.trace(
      this.formatMessage(args),
      { method: 'console.trace' },
      { originalArgs: this.sanitizeArgs(args) }
    );
  };

  /**
   * Format console arguments into a message string
   */
  private formatMessage(args: any[]): string {
    return args
      .map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  /**
   * Sanitize arguments for logging metadata
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Remove sensitive data
          const sanitized = JSON.parse(JSON.stringify(arg));
          this.removeSensitiveData(sanitized);
          return sanitized;
        } catch {
          return '[Object]';
        }
      }
      return arg;
    });
  }

  /**
   * Remove sensitive data from objects
   */
  private removeSensitiveData(obj: any): void {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization',
      'api_key', 'client_secret', 'refresh_token', 'access_token'
    ];
    
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const key in obj) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.removeSensitiveData(obj[key]);
      }
    }
  }
}

/**
 * Create enhanced console for a specific component
 */
export function createEnhancedConsole(component: string): EnhancedConsole {
  return new EnhancedConsole(component);
}

/**
 * Global enhanced console instance
 */
export const enhancedConsole = createEnhancedConsole('Global');

/**
 * Replace global console with enhanced version (use with caution)
 */
export function replaceGlobalConsole(): void {
  if (process.env.NODE_ENV !== 'development') {
    // Only replace in production or when explicitly enabled
    const globalEnhancedConsole = createEnhancedConsole('Global');
    
    // Replace console methods
    console.log = globalEnhancedConsole.log;
    console.error = globalEnhancedConsole.error;
    console.warn = globalEnhancedConsole.warn;
    console.info = globalEnhancedConsole.info;
    console.debug = globalEnhancedConsole.debug;
    console.trace = globalEnhancedConsole.trace;
  }
}

/**
 * Utility to help migrate console statements to proper logging
 */
export class ConsoleMigrationHelper {
  /**
   * Generate replacement code for console statements
   */
  static generateReplacement(
    consoleMethod: keyof typeof consoleToLogLevel,
    component: string,
    args: string[] = []
  ): string {
    const logLevel = consoleToLogLevel[consoleMethod];
    const argsString = args.join(', ');
    
    if (consoleMethod === 'error' && args.length > 0) {
      // Check if first argument might be an error
      return `logger.error(${argsString}, ${args.length > 1 ? '{ method: \'console.error\' }' : 'undefined'});`;
    } else {
      return `logger.${logLevel}(${argsString}, { method: 'console.${consoleMethod}' });`;
    }
  }

  /**
   * Generate import statement for logger
   */
  static generateImportStatement(): string {
    return `import { createLogger } from '../shared/logging/LoggerFactory';`;
  }

  /**
   * Generate logger creation statement
   */
  static generateLoggerCreation(component: string): string {
    return `const logger = createLogger('${component}');`;
  }
}