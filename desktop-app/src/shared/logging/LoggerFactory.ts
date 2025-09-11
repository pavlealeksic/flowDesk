/**
 * Centralized Logging Factory for Flow Desk
 * 
 * Provides consistent logging across all processes (main, renderer, preload)
 * with proper environment-based configuration and structured output
 */

import type { LogLevel, LogContext, LoggerConfig, ILogger } from '../../types/logging';

// Development detection
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.defaultApp || 
                     /node_modules[\\/]electron[\\/]/.test(process.execPath);

// Default configuration
const defaultConfig: LoggerConfig = {
  level: isDevelopment ? 'debug' : 'info',
  enableConsole: isDevelopment,
  enableFile: true,
  fileSettings: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    directory: '' // Will be set based on process
  },
  enablePerformance: isDevelopment,
  enableUserActions: true,
  sensitiveDataPatterns: [
    /password=[\w\d]+/gi,
    /token=[\w\d\-_]+/gi,
    /key=[\w\d\-_]+/gi,
    /secret=[\w\d\-_]+/gi,
    /authorization:\s*bearer\s+[\w\d\-_]+/gi,
    /api[_-]?key[\s=:]+[\w\d\-_]+/gi,
    /client[_-]?secret[\s=:]+[\w\d\-_]+/gi,
    /refresh[_-]?token[\s=:]+[\w\d\-_]+/gi,
    /access[_-]?token[\s=:]+[\w\d\-_]+/gi
  ]
};

/**
 * Main Process Logger Factory
 */
export class MainLoggerFactory {
  private static instance: MainLoggerFactory;
  private config: LoggerConfig;
  
  constructor() {
    this.config = { ...defaultConfig };
    this.setupMainProcessConfig();
  }
  
  static getInstance(): MainLoggerFactory {
    if (!MainLoggerFactory.instance) {
      MainLoggerFactory.instance = new MainLoggerFactory();
    }
    return MainLoggerFactory.instance;
  }

  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
    // Import dynamically to avoid circular dependencies
    const { MainProcessLogger } = require('../../main/logging/LoggingService');
    return new MainProcessLogger(component, this.config, baseContext);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private setupMainProcessConfig(): void {
    const { app } = require('electron');
    const { join } = require('path');
    
    this.config.fileSettings!.directory = join(app.getPath('userData'), 'logs');
  }
}

/**
 * Renderer Process Logger Factory
 */
export class RendererLoggerFactory {
  private static instance: RendererLoggerFactory;
  private config: LoggerConfig;
  private initialized = false;
  
  constructor() {
    this.config = { ...defaultConfig };
    this.setupRendererProcessConfig();
  }
  
  static getInstance(): RendererLoggerFactory {
    if (!RendererLoggerFactory.instance) {
      RendererLoggerFactory.instance = new RendererLoggerFactory();
    }
    return RendererLoggerFactory.instance;
  }

  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
    // Import dynamically to avoid circular dependencies
    const { RendererProcessLogger } = require('../../renderer/logging/RendererLoggingService');
    const { RendererLoggerIPC } = require('../../renderer/logging/RendererLoggingService');
    
    return new RendererProcessLogger(
      component, 
      this.config, 
      new RendererLoggerIPC(), 
      baseContext
    );
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private setupRendererProcessConfig(): void {
    // Renderer process config is mostly the same
    // File logging is handled by main process via IPC
    this.config.enableFile = false;
  }
}

/**
 * Preload Process Logger Factory
 */
export class PreloadLoggerFactory {
  private static instance: PreloadLoggerFactory;
  private config: LoggerConfig;
  
  constructor() {
    this.config = { ...defaultConfig };
    this.setupPreloadProcessConfig();
  }
  
  static getInstance(): PreloadLoggerFactory {
    if (!PreloadLoggerFactory.instance) {
      PreloadLoggerFactory.instance = new PreloadLoggerFactory();
    }
    return PreloadLoggerFactory.instance;
  }

  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
    // Import dynamically to avoid circular dependencies
    const { PreloadLogger } = require('../../preload/PreloadLogger');
    return new PreloadLogger(component, baseContext);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private setupPreloadProcessConfig(): void {
    // Preload process logs through main process
    this.config.enableFile = false;
  }
}

/**
 * Universal logger factory that detects the current process
 */
export class UniversalLoggerFactory {
  private static instance: UniversalLoggerFactory;
  
  constructor() {
    // Initialize all logger factories
    MainLoggerFactory.getInstance();
    RendererLoggerFactory.getInstance();
    PreloadLoggerFactory.getInstance();
  }
  
  static getInstance(): UniversalLoggerFactory {
    if (!UniversalLoggerFactory.instance) {
      UniversalLoggerFactory.instance = new UniversalLoggerFactory();
    }
    return UniversalLoggerFactory.instance;
  }

  createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
    // Detect current process
    if (process.type === 'browser') {
      return MainLoggerFactory.getInstance().createLogger(component, baseContext);
    } else if (process.type === 'renderer') {
      return RendererLoggerFactory.getInstance().createLogger(component, baseContext);
    } else {
      return PreloadLoggerFactory.getInstance().createLogger(component, baseContext);
    }
  }

  getConfig(): LoggerConfig {
    if (process.type === 'browser') {
      return MainLoggerFactory.getInstance().getConfig();
    } else if (process.type === 'renderer') {
      return RendererLoggerFactory.getInstance().getConfig();
    } else {
      return PreloadLoggerFactory.getInstance().getConfig();
    }
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    if (process.type === 'browser') {
      MainLoggerFactory.getInstance().updateConfig(updates);
    } else if (process.type === 'renderer') {
      RendererLoggerFactory.getInstance().updateConfig(updates);
    } else {
      PreloadLoggerFactory.getInstance().updateConfig(updates);
    }
  }
}

// Convenience exports
export const universalLoggerFactory = UniversalLoggerFactory.getInstance();

/**
 * Create a logger for the current process
 */
export function createLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
  return universalLoggerFactory.createLogger(component, baseContext);
}

/**
 * Get the current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return universalLoggerFactory.getConfig();
}

/**
 * Update logger configuration
 */
export function updateLoggerConfig(updates: Partial<LoggerConfig>): void {
  universalLoggerFactory.updateConfig(updates);
}

/**
 * React hook for component-specific logging (renderer process only)
 */
export function useLogger(component: string, baseContext?: Partial<LogContext>): ILogger {
  if (process.type === 'renderer') {
    // Use React hook for renderer process
    const { useLogger: useReactLogger } = require('../../renderer/logging/RendererLoggingService');
    return useReactLogger(component, baseContext);
  } else {
    // For non-renderer processes, return a regular logger
    return createLogger(component, baseContext);
  }
}