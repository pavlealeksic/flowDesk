/**
 * Preload Process Logger for Flow Desk
 * 
 * Simple logging implementation for the preload process that forwards logs to main process
 */

import { ipcRenderer } from 'electron';
import type { LogEntry, LogContext, LogLevel } from '../types/logging';
import { createLogger } from '../shared/logging/LoggerFactory';

// Create logger for this component
const logger = createLogger('PreloadLogger');

export class PreloadLogger {
  private component: string;
  private baseContext: Partial<LogContext>;

  constructor(component: string, baseContext: Partial<LogContext> = {}) {
    this.component = component;
    this.baseContext = { ...baseContext, component, process: 'preload' as const };
  }

  error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('error', message, context, metadata, error);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('warn', message, context, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('info', message, context, metadata);
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('debug', message, context, metadata);
  }

  trace(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('trace', message, context, metadata);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.baseContext, ...context },
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    // Send to main process for handling
    try {
      ipcRenderer.invoke('logging:log', entry).catch((err) => {
        // Fallback to console if IPC fails
        logger.error('Failed to send log to main process', err, { method: 'console.error' });
        this.fallbackConsoleLog(entry);
      });
    } catch (ipcError) {
      // IPC not available, fallback to console
      this.fallbackConsoleLog(entry);
    }
  }

  private fallbackConsoleLog(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase();
    const component = entry.context?.component || 'UNKNOWN';
    
    let message = `[${timestamp}] ${level} [PRELOAD:${component}] ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }
    
    switch (entry.level) {
      case 'error':
        logger.error('Fallback console error', new Error(message), { method: 'console.error' });
        if (entry.error?.stack) {
          logger.error('Fallback console error stack', new Error(entry.error.stack), { method: 'console.error' });
        }
        break;
      case 'warn':
        logger.warn('Fallback console warning', undefined, { method: 'console.warn' });
        break;
      case 'info':
        logger.info('Fallback console info', undefined, { method: 'console.info' });
        break;
      case 'debug':
      case 'trace':
        logger.debug('Fallback console log', undefined, { method: 'console.log' });
        break;
    }
  }

  child(context: Partial<LogContext>): PreloadLogger {
    return new PreloadLogger(this.component, { ...this.baseContext, ...context });
  }
}

// Create default preload logger
export const preloadLogger = new PreloadLogger('PreloadScript');