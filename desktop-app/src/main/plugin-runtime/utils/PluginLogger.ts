/**
 * Plugin Logger - Centralized logging system for plugin runtime
 * 
 * Provides structured logging with context awareness for debugging
 * and monitoring plugin operations.
 */

import * as log from 'electron-log';

export type LogLevel = 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error';

export interface LogContext {
  pluginId?: string;
  installationId?: string;
  userId?: string;
  workspaceId?: string;
  component?: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Plugin Logger
 * 
 * Provides structured logging for plugin system components.
 */
export class PluginLogger {
  private readonly component: string;
  private readonly context: LogContext;

  constructor(component: string, context: LogContext = {}) {
    this.component = component;
    this.context = { component, ...context };
    
    // Configure electron-log if not already configured
    this.configureElectronLog();
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): PluginLogger {
    return new PluginLogger(this.component, { ...this.context, ...context });
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any): void {
    this.log('error', message, error);
  }

  /**
   * Log verbose message
   */
  verbose(message: string, data?: any): void {
    this.log('verbose', message, data);
  }

  /**
   * Log silly message
   */
  silly(message: string, data?: any): void {
    this.log('silly', message, data);
  }

  /**
   * Log at specified level
   */
  log(level: LogLevel, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      context: this.context,
      ...(data && { data: this.sanitizeLogData(data) })
    };

    // Use electron-log for actual logging
    switch (level) {
      case 'silly':
        log.silly(`[${this.component}] ${message}`, data);
        break;
      case 'debug':
        log.debug(`[${this.component}] ${message}`, data);
        break;
      case 'verbose':
        log.verbose(`[${this.component}] ${message}`, data);
        break;
      case 'info':
        log.info(`[${this.component}] ${message}`, data);
        break;
      case 'warn':
        log.warn(`[${this.component}] ${message}`, data);
        break;
      case 'error':
        if (data instanceof Error) {
          log.error(`[${this.component}] ${message}`, {
            error: data.message,
            stack: data.stack,
            ...this.context
          });
        } else {
          log.error(`[${this.component}] ${message}`, data);
        }
        break;
    }

    // Emit structured log event for monitoring/analytics
    this.emitLogEvent(logEntry);
  }

  /**
   * Log method execution time
   */
  async logExecution<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    const logger = context ? this.child(context) : this;
    
    logger.debug(`Starting operation: ${operation}`);
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      logger.info(`Operation completed: ${operation}`, { duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Operation failed: ${operation}`, { 
        error: error.message,
        duration 
      });
      
      throw error;
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string, 
    metrics: {
      duration: number;
      memoryUsage?: number;
      cpuUsage?: number;
      [key: string]: any;
    }
  ): void {
    this.info(`Performance: ${operation}`, {
      type: 'performance',
      ...metrics
    });
  }

  /**
   * Log security event
   */
  logSecurity(
    event: string, 
    details: {
      pluginId?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      action?: string;
      [key: string]: any;
    }
  ): void {
    this.warn(`Security event: ${event}`, {
      type: 'security',
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Log audit event
   */
  logAudit(
    action: string,
    details: {
      pluginId?: string;
      userId?: string;
      success: boolean;
      [key: string]: any;
    }
  ): void {
    this.info(`Audit: ${action}`, {
      type: 'audit',
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Private: Configure electron-log
   */
  private configureElectronLog(): void {
    // Configure log levels
    log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    log.transports.file.level = 'info';
    
    // Configure log format
    log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    
    // Configure file rotation
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    log.transports.file.archiveLog = (oldLogFile) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return `${oldLogFile}.${timestamp}`;
    };

    // Configure log file location
    log.transports.file.fileName = 'plugin-runtime.log';
    log.transports.file.resolvePathFn = () => {
      const path = require('path');
      const os = require('os');
      return path.join(os.homedir(), '.flowdesk', 'logs', 'plugin-runtime.log');
    };
  }

  /**
   * Private: Sanitize log data to remove sensitive information
   */
  private sanitizeLogData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack
      };
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeLogData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]';
          continue;
        }

        sanitized[key] = this.sanitizeLogData(value);
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Private: Check if field contains sensitive information
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /private/i,
      /email/i, // Email addresses can be PII
      /phone/i,
      /address/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(fieldName));
  }

  /**
   * Private: Emit structured log event
   */
  private emitLogEvent(logEntry: any): void {
    // In a full implementation, you might emit to:
    // - Analytics service
    // - Monitoring system
    // - External logging service
    // - Event bus for real-time monitoring

    // For now, we'll just emit a Node.js event
    process.emit('plugin-log', logEntry);
  }

  /**
   * Static method to create logger with plugin context
   */
  static forPlugin(pluginId: string, installationId?: string): PluginLogger {
    return new PluginLogger(`Plugin:${pluginId}`, {
      pluginId,
      installationId
    });
  }

  /**
   * Static method to create logger with component context
   */
  static forComponent(componentName: string): PluginLogger {
    return new PluginLogger(componentName);
  }
}