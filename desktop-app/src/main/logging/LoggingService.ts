/**
 * Main Process Logging Service for Flow Desk
 * 
 * Centralized logging system that handles file writing, log rotation, and IPC communication
 */

import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, unlinkSync, readdirSync } from 'fs';
import type { 
  LogEntry, 
  LogContext, 
  LoggerConfig, 
  LogLevel, 
  ILogger, 
  LoggerFactory,
  LogMessage,
  PerformanceMetrics 
} from '../../types/logging';

class MainProcessLogger implements ILogger {
  private config: LoggerConfig;
  private component: string;
  private baseContext: Partial<LogContext>;
  private performanceTimers: Map<string, { start: number; context?: LogContext }> = new Map();
  
  constructor(
    component: string, 
    config: LoggerConfig,
    baseContext: Partial<LogContext> = {}
  ) {
    this.component = component;
    this.config = config;
    this.baseContext = { ...baseContext, component };
  }

  error(message: string, errorOrContext?: Error | LogContext, contextOrMetadata?: LogContext | Record<string, unknown>, metadata?: Record<string, unknown>): void {
    if (errorOrContext instanceof Error) {
      this.log('error', message, contextOrMetadata as LogContext, metadata, errorOrContext);
    } else {
      this.log('error', message, errorOrContext, contextOrMetadata as Record<string, unknown>);
    }
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

  time(label: string, context?: LogContext): void {
    this.performanceTimers.set(label, {
      start: performance.now(),
      context: { ...this.baseContext, ...context }
    });
  }

  timeEnd(label: string, context?: LogContext): void {
    const timer = this.performanceTimers.get(label);
    if (timer) {
      const duration = performance.now() - timer.start;
      this.performanceTimers.delete(label);
      
      const fullContext = { ...timer.context, ...context };
      this.log('debug', `Performance: ${label}`, fullContext, { 
        duration: Math.round(duration * 100) / 100,
        performanceMarker: true
      });
    }
  }

  userAction(action: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    if (!this.config.enableUserActions) return;
    
    this.log('info', `User Action: ${action}`, 
      { ...context, action }, 
      { ...metadata, userAction: true }
    );
  }

  structured(level: LogLevel, message: string, data: Record<string, unknown>, context?: LogContext): void {
    this.log(level, message, context, { ...data, structured: true });
  }

  child(context: Partial<LogContext>): ILogger {
    return new MainProcessLogger(
      this.component,
      this.config,
      { ...this.baseContext, ...context }
    );
  }

  private log(
    level: LogLevel, 
    message: string, 
    context?: LogContext, 
    metadata?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.sanitizeMessage(message),
      context: { 
        process: 'main' as const,
        ...this.baseContext, 
        ...context 
      },
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.writeLog(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    return levels[level] <= levels[this.config.level];
  }

  private writeLog(entry: LogEntry): void {
    // Console output (development only or when explicitly enabled)
    if (this.config.enableConsole) {
      const consoleMessage = this.formatConsoleMessage(entry);
      
      switch (entry.level) {
        case 'error':
          console.error(consoleMessage);
          break;
        case 'warn':
          console.warn(consoleMessage);
          break;
        case 'info':
          console.info(consoleMessage);
          break;
        case 'debug':
        case 'trace':
          console.log(consoleMessage);
          break;
      }
    }

    // File output
    if (this.config.enableFile) {
      this.writeToFile(entry);
    }

    // Electron-log for system-level logging
    const electronLogMessage = this.formatElectronLogMessage(entry);
    switch (entry.level) {
      case 'error':
        log.error(electronLogMessage);
        break;
      case 'warn':
        log.warn(electronLogMessage);
        break;
      case 'info':
        log.info(electronLogMessage);
        break;
      case 'debug':
        log.debug(electronLogMessage);
        break;
      case 'trace':
        log.verbose(electronLogMessage);
        break;
    }
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.config.fileSettings) return;

    const logDir = this.config.fileSettings.directory;
    const logFile = join(logDir, 'flowdesk-main.log');

    // Ensure directory exists
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Check file size and rotate if necessary
    this.rotateLogFileIfNeeded(logFile);

    // Write log entry
    const logLine = JSON.stringify(entry) + '\n';
    try {
      writeFileSync(logFile, logLine, { flag: 'a' });
    } catch (error) {
      // Fallback to electron-log if file writing fails
      log.error('Failed to write to log file:', error);
    }
  }

  private rotateLogFileIfNeeded(logFile: string): void {
    if (!this.config.fileSettings) return;

    try {
      if (!existsSync(logFile)) return;
      
      const stats = statSync(logFile);
      if (stats.size > this.config.fileSettings.maxFileSize) {
        // Rotate files
        for (let i = this.config.fileSettings.maxFiles - 1; i > 0; i--) {
          const oldFile = `${logFile}.${i}`;
          const newFile = `${logFile}.${i + 1}`;
          
          if (existsSync(oldFile)) {
            if (existsSync(newFile)) {
              unlinkSync(newFile);
            }
            writeFileSync(newFile, readFileSync(oldFile));
            unlinkSync(oldFile);
          }
        }
        
        // Move current file to .1
        const rotatedFile = `${logFile}.1`;
        if (existsSync(rotatedFile)) {
          unlinkSync(rotatedFile);
        }
        writeFileSync(rotatedFile, readFileSync(logFile));
        unlinkSync(logFile);
      }
    } catch (error) {
      log.error('Failed to rotate log file:', error);
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.context?.component || 'UNKNOWN';
    
    let message = `[${timestamp}] ${level} [${component}] ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }
    
    if (entry.error) {
      message += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n${entry.error.stack}`;
      }
    }
    
    return message;
  }

  private formatElectronLogMessage(entry: LogEntry): string {
    const component = entry.context?.component || 'UNKNOWN';
    let message = `[${component}] ${entry.message}`;
    
    if (entry.context?.workspaceId) {
      message += ` (workspace: ${entry.context.workspaceId})`;
    }
    
    if (entry.context?.action) {
      message += ` (action: ${entry.context.action})`;
    }
    
    return message;
  }

  private sanitizeMessage(message: string): string {
    if (!this.config.sensitiveDataPatterns) return message;
    
    let sanitized = message;
    for (const pattern of this.config.sensitiveDataPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    if (!this.config.sensitiveDataPatterns) return metadata;
    
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

export class MainLoggingService implements LoggerFactory {
  private static instance: MainLoggingService;
  private config: LoggerConfig;
  
  constructor() {
    this.config = this.getDefaultConfig();
    this.setupIpcHandlers();
  }
  
  static getInstance(): MainLoggingService {
    if (!MainLoggingService.instance) {
      MainLoggingService.instance = new MainLoggingService();
    }
    return MainLoggingService.instance;
  }

  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
    return new MainProcessLogger(component, this.config, baseContext);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private getDefaultConfig(): LoggerConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logsDir = join(app.getPath('userData'), 'logs');
    
    return {
      level: isDevelopment ? 'debug' : 'info',
      enableConsole: isDevelopment,
      enableFile: true,
      fileSettings: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        directory: logsDir
      },
      enablePerformance: isDevelopment,
      enableUserActions: true,
      sensitiveDataPatterns: [
        /password=[\w\d]+/gi,
        /token=[\w\d\-_]+/gi,
        /key=[\w\d\-_]+/gi,
        /secret=[\w\d\-_]+/gi,
        /authorization:\s*bearer\s+[\w\d\-_]+/gi
      ]
    };
  }

  private setupIpcHandlers(): void {
    // Handle log messages from renderer and preload processes
    ipcMain.handle('logging:log', async (event: IpcMainInvokeEvent, entry: LogEntry) => {
      this.writeLogEntry(entry);
    });

    ipcMain.handle('logging:get-config', async () => {
      return this.getConfig();
    });

    ipcMain.handle('logging:update-config', async (event: IpcMainInvokeEvent, updates: Partial<LoggerConfig>) => {
      this.updateConfig(updates);
      return this.getConfig();
    });

    ipcMain.handle('logging:flush', async () => {
      // Force flush all pending log operations
      return Promise.resolve();
    });
  }

  private writeLogEntry(entry: LogEntry): void {
    // Create a temporary logger to write the entry
    const logger = new MainProcessLogger('IPC', this.config);
    (logger as any).writeLog(entry);
  }
}

// Initialize the main logging service
export const mainLoggingService = MainLoggingService.getInstance();

// Create a default logger for the main process
export const mainLogger = mainLoggingService.createLogger('MainProcess');