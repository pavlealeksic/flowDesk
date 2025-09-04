/**
 * Centralized Logging System
 * 
 * Production-ready logging with proper security controls
 * - Environment-based log levels
 * - No sensitive data exposure
 * - Structured logging for production
 */

import log from 'electron-log';
import { app } from 'electron';
import * as path from 'path';

// Configure log levels based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// Set log file location
if (app) {
  const logPath = path.join(app.getPath('userData'), 'logs');
  log.transports.file.resolvePathFn = () => path.join(logPath, 'main.log');
}

// Configure transport levels
if (isProduction) {
  // Production: Only log warnings and errors
  log.transports.console.level = false; // Disable console in production
  log.transports.file.level = 'warn';
  log.transports.ipc.level = 'warn';
} else if (isTest) {
  // Test: Log everything to file, disable console
  log.transports.console.level = false;
  log.transports.file.level = 'debug';
  log.transports.ipc.level = false;
} else {
  // Development: Log everything
  log.transports.console.level = 'debug';
  log.transports.file.level = 'debug';
  log.transports.ipc.level = 'debug';
}

// Configure log format
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s} [{level}] {text}';

// Add security filters to prevent sensitive data leakage
const sensitivePatterns = [
  /password["\s:=]+["']?[^"'\s]+/gi,
  /token["\s:=]+["']?[^"'\s]+/gi,
  /api[_-]?key["\s:=]+["']?[^"'\s]+/gi,
  /secret["\s:=]+["']?[^"'\s]+/gi,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  /client[_-]?secret["\s:=]+["']?[^"'\s]+/gi,
  /refresh[_-]?token["\s:=]+["']?[^"'\s]+/gi,
];

// Create secure logging functions that filter sensitive data
function filterSensitiveData(message: any): any {
  if (typeof message === 'string') {
    let filtered = message;
    sensitivePatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '[REDACTED]');
    });
    return filtered;
  }
  
  if (typeof message === 'object' && message !== null) {
    const filtered: any = Array.isArray(message) ? [] : {};
    for (const key in message) {
      if (message.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('password') || 
            lowerKey.includes('token') || 
            lowerKey.includes('secret') ||
            lowerKey.includes('key') ||
            lowerKey.includes('credential')) {
          filtered[key] = '[REDACTED]';
        } else {
          filtered[key] = filterSensitiveData(message[key]);
        }
      }
    }
    return filtered;
  }
  
  return message;
}

// Export secure logger wrapper
export const logger = {
  debug: (...args: any[]) => {
    if (!isProduction) {
      log.debug(...args.map(filterSensitiveData));
    }
  },
  
  info: (...args: any[]) => {
    log.info(...args.map(filterSensitiveData));
  },
  
  warn: (...args: any[]) => {
    log.warn(...args.map(filterSensitiveData));
  },
  
  error: (...args: any[]) => {
    // Always log errors, but filter sensitive data
    log.error(...args.map(arg => {
      if (arg instanceof Error) {
        // Preserve error stack traces but filter the message
        const filteredError = new Error(filterSensitiveData(arg.message));
        filteredError.stack = arg.stack;
        return filteredError;
      }
      return filterSensitiveData(arg);
    }));
  },
  
  // Security-specific logging
  security: (event: string, details?: any) => {
    const sanitizedDetails = filterSensitiveData(details);
    log.warn(`[SECURITY] ${event}`, sanitizedDetails);
  },
  
  // Audit logging for compliance
  audit: (action: string, user?: string, details?: any) => {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      user: user || 'system',
      details: filterSensitiveData(details),
    };
    log.info('[AUDIT]', auditEntry);
  },
};

// Export the underlying electron-log instance for special cases
export { log as electronLog };

export default logger;