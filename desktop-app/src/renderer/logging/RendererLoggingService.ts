/**
 * Renderer Process Logging Service for Flow Desk
 * 
 * Client-side logging that communicates with the main process via IPC
 */

import type { 
  LogEntry, 
  LogContext, 
  LoggerConfig, 
  LogLevel, 
  ILogger, 
  LoggerFactory,
  LoggerIPC 
} from '../../types/logging';

class RendererProcessLogger implements ILogger {
  private config: LoggerConfig;
  private component: string;
  private baseContext: Partial<LogContext>;
  private performanceTimers: Map<string, { start: number; context?: LogContext }> = new Map();
  private ipc: LoggerIPC;
  
  constructor(
    component: string, 
    config: LoggerConfig,
    ipc: LoggerIPC,
    baseContext: Partial<LogContext> = {}
  ) {
    this.component = component;
    this.config = config;
    this.ipc = ipc;
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
      
      const fullContext = { 
        ...timer.context, 
        ...context,
        performanceMarker: { duration: Math.round(duration * 100) / 100 }
      };
      
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
    return new RendererProcessLogger(
      this.component,
      this.config,
      this.ipc,
      { ...this.baseContext, ...context }
    );
  }

  private async log(
    level: LogLevel, 
    message: string, 
    context?: LogContext, 
    metadata?: Record<string, unknown>,
    error?: Error
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.sanitizeMessage(message),
      context: { 
        process: 'renderer' as const,
        ...this.baseContext, 
        ...context,
        sessionId: this.getSessionId(),
        userId: this.getUserId()
      },
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    // Console output for development
    if (this.config.enableConsole) {
      this.writeConsole(entry);
    }

    // Send to main process
    try {
      await this.ipc.log(entry);
    } catch (ipcError) {
      // Fallback to console if IPC fails
      console.error('[LOGGING] Failed to send log to main process:', ipcError);
      this.writeConsole(entry);
    }
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

  private writeConsole(entry: LogEntry): void {
    const message = this.formatConsoleMessage(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'debug':
      case 'trace':
        console.log(message);
        break;
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.context?.component || 'UNKNOWN';
    
    let message = `[${timestamp}] ${level} [${component}] ${entry.message}`;
    
    if (entry.context?.workspaceId) {
      message += ` (workspace: ${entry.context.workspaceId})`;
    }
    
    if (entry.context?.action) {
      message += ` (action: ${entry.context.action})`;
    }
    
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

  private getSessionId(): string {
    // Generate or retrieve session ID
    const sessionKey = 'flowdesk_session_id';
    let sessionId = sessionStorage.getItem(sessionKey);
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(sessionKey, sessionId);
    }
    
    return sessionId;
  }

  private getUserId(): string | undefined {
    // Try to get user ID from Redux store or other sources
    try {
      const state = (window as any)?.__REDUX_STORE__?.getState();
      return state?.user?.id || state?.auth?.userId;
    } catch {
      return undefined;
    }
  }
}

class RendererLoggerIPC implements LoggerIPC {
  async log(entry: LogEntry): Promise<void> {
    if (!window.flowDesk) {
      throw new Error('FlowDesk API not available');
    }
    
    // Use IPC to send log entry to main process
    return (window as any).flowDesk.logging?.log(entry) || Promise.resolve();
  }

  async flush(): Promise<void> {
    if (!window.flowDesk) return;
    return (window as any).flowDesk.logging?.flush() || Promise.resolve();
  }

  async getConfig(): Promise<LoggerConfig> {
    if (!window.flowDesk) {
      throw new Error('FlowDesk API not available');
    }
    
    return (window as any).flowDesk.logging?.getConfig() || this.getDefaultConfig();
  }

  async updateConfig(config: Partial<LoggerConfig>): Promise<void> {
    if (!window.flowDesk) return;
    return (window as any).flowDesk.logging?.updateConfig(config) || Promise.resolve();
  }

  private getDefaultConfig(): LoggerConfig {
    return {
      level: 'info',
      enableConsole: process.env.NODE_ENV === 'development',
      enableFile: true,
      enablePerformance: false,
      enableUserActions: true,
      sensitiveDataPatterns: [
        /password=[\w\d]+/gi,
        /token=[\w\d\-_]+/gi,
        /key=[\w\d\-_]+/gi,
        /secret=[\w\d\-_]+/gi
      ]
    };
  }
}

export class RendererLoggingService implements LoggerFactory {
  private static instance: RendererLoggingService;
  private config: LoggerConfig;
  private ipc: LoggerIPC;
  private configInitialized: boolean = false;
  
  constructor() {
    this.ipc = new RendererLoggerIPC();
    this.config = this.getDefaultConfig();
    this.initializeConfig();
  }
  
  static getInstance(): RendererLoggingService {
    if (!RendererLoggingService.instance) {
      RendererLoggingService.instance = new RendererLoggingService();
    }
    return RendererLoggingService.instance;
  }

  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
    return new RendererProcessLogger(component, this.config, this.ipc, baseContext);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.ipc.updateConfig(updates).catch(error => {
      console.error('[LOGGING] Failed to update config in main process:', error);
    });
  }

  private async initializeConfig(): Promise<void> {
    if (this.configInitialized) return;
    
    try {
      this.config = await this.ipc.getConfig();
      this.configInitialized = true;
    } catch (error) {
      console.warn('[LOGGING] Failed to get config from main process, using defaults:', error);
    }
  }

  private getDefaultConfig(): LoggerConfig {
    return {
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      enableConsole: process.env.NODE_ENV === 'development',
      enableFile: true,
      enablePerformance: process.env.NODE_ENV === 'development',
      enableUserActions: true,
      sensitiveDataPatterns: [
        /password=[\w\d]+/gi,
        /token=[\w\d\-_]+/gi,
        /key=[\w\d\-_]+/gi,
        /secret=[\w\d\-_]+/gi
      ]
    };
  }
}

// Convenience functions for easy logging
export const rendererLoggingService = RendererLoggingService.getInstance();
export const rendererLogger = rendererLoggingService.createLogger('Renderer');

// React Hook for component-specific logging
export function useLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
  return rendererLoggingService.createLogger(component, baseContext);
}

// Error boundary logger
export function logError(error: Error, errorInfo?: { componentStack: string }, context?: LogContext): void {
  const logger = rendererLoggingService.createLogger('ErrorBoundary');
  logger.error('React Error Boundary caught error', error, {
    ...context,
    component: 'ErrorBoundary'
  }, {
    componentStack: errorInfo?.componentStack,
    timestamp: new Date().toISOString()
  });
}

// Redux middleware logger
export function createReduxLoggerMiddleware() {
  const logger = rendererLoggingService.createLogger('Redux');
  
  return (store: any) => (next: any) => (action: any) => {
    if (rendererLoggingService.getConfig().level === 'trace') {
      logger.trace('Redux Action', { action: action.type }, {
        action: action,
        state: store.getState()
      });
    }
    
    return next(action);
  };
}