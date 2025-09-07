/**
 * Logging Types and Interfaces for Flow Desk
 * 
 * Centralized logging system types that work across main, renderer, and preload processes
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogContext {
  process?: 'main' | 'renderer' | 'preload';
  component?: string;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  action?: string;
  performanceMarker?: {
    duration?: number;
    memory?: number;
  };
  [key: string]: unknown;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  fileSettings?: {
    maxFileSize: number; // in bytes
    maxFiles: number;
    directory: string;
  };
  enablePerformance: boolean;
  enableUserActions: boolean;
  sensitiveDataPatterns?: RegExp[];
}

export interface ILogger {
  error(message: string, context?: LogContext, metadata?: Record<string, unknown>): void;
  error(message: string, error: Error, context?: LogContext, metadata?: Record<string, unknown>): void;
  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void;
  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void;
  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void;
  trace(message: string, context?: LogContext, metadata?: Record<string, unknown>): void;
  
  // Performance logging
  time(label: string, context?: LogContext): void;
  timeEnd(label: string, context?: LogContext): void;
  
  // User action logging
  userAction(action: string, context?: LogContext, metadata?: Record<string, unknown>): void;
  
  // Structured logging
  structured(level: LogLevel, message: string, data: Record<string, unknown>, context?: LogContext): void;
  
  // Child logger with inherited context
  child(context: Partial<LogContext>): ILogger;
}

export interface LoggerFactory {
  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger;
  getConfig(): LoggerConfig;
  updateConfig(config: Partial<LoggerConfig>): void;
}

// Preload-specific interfaces for IPC communication
export interface LogMessage {
  entry: LogEntry;
  timestamp: number;
}

export interface LoggerIPC {
  log(entry: LogEntry): Promise<void>;
  flush(): Promise<void>;
  getConfig(): Promise<LoggerConfig>;
  updateConfig(config: Partial<LoggerConfig>): Promise<void>;
}

// Performance monitoring types
export interface PerformanceMetrics {
  component: string;
  action: string;
  duration: number;
  memory?: number;
  timestamp: string;
  context?: LogContext;
}

// User action types for logging
export interface UserActionEvent {
  action: string;
  target?: string;
  value?: unknown;
  timestamp: string;
  context?: LogContext;
}