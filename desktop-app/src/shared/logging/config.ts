/**
 * Logging Configuration for Flow Desk
 * 
 * Centralized configuration for the logging system with environment-based
 * settings and sensible defaults for development and production
 */

import type { LoggerConfig, LogLevel } from '../../types/logging';

/**
 * Environment-based logging configuration
 */
export function getLoggingConfig(overrides: Partial<LoggerConfig> = {}): LoggerConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine log level based on environment
  let level: LogLevel = 'info';
  if (isDevelopment) level = 'debug';
  if (isTest) level = 'warn'; // Reduce noise in tests
  if (process.env.LOG_LEVEL) level = process.env.LOG_LEVEL as LogLevel;

  // Base configuration
  const baseConfig: LoggerConfig = {
    level,
    enableConsole: isDevelopment || process.env.ENABLE_CONSOLE_LOGS === 'true',
    enableFile: isProduction || process.env.ENABLE_FILE_LOGS !== 'false',
    fileSettings: {
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB default
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      directory: process.env.LOG_DIRECTORY || ''
    },
    enablePerformance: isDevelopment || process.env.ENABLE_PERFORMANCE_LOGS === 'true',
    enableUserActions: process.env.ENABLE_USER_ACTION_LOGS !== 'false',
    sensitiveDataPatterns: [
      // Default sensitive data patterns
      /password=[\w\d]+/gi,
      /token=[\w\d\-_]+/gi,
      /key=[\w\d\-_]+/gi,
      /secret=[\w\d\-_]+/gi,
      /authorization:\s*bearer\s+[\w\d\-_]+/gi,
      /api[_-]?key[\s=:]+[\w\d\-_]+/gi,
      /client[_-]?secret[\s=:]+[\w\d\-_]+/gi,
      /refresh[_-]?token[\s=:]+[\w\d\-_]+/gi,
      /access[_-]?token[\s=:]+[\w\d\-_]+/gi,
      /session[_-]?token[\s=:]+[\w\d\-_]+/gi,
      /bearer\s+[\w\d\-_]+/gi,
      /basic\s+[\w\d\-_]+/gi
    ]
  };

  // Set log directory based on process type
  if (!baseConfig.fileSettings?.directory) {
    try {
      if (process.type === 'browser') {
        // Main process
        const { app } = require('electron');
        const { join } = require('path');
        baseConfig.fileSettings!.directory = join(app.getPath('userData'), 'logs');
      } else {
        // Renderer or preload process - logs will be handled by main process via IPC
        baseConfig.enableFile = false;
      }
    } catch {
      // Electron not available, use default location
      const { join } = require('path');
      const { homedir } = require('os');
      baseConfig.fileSettings!.directory = join(homedir(), '.flowdesk', 'logs');
    }
  }

  // Apply overrides
  return { ...baseConfig, ...overrides };
}

/**
 * Development-specific configuration
 */
export function getDevelopmentConfig(): LoggerConfig {
  return getLoggingConfig({
    level: 'debug',
    enableConsole: true,
    enablePerformance: true,
    enableUserActions: true
  });
}

/**
 * Production-specific configuration
 */
export function getProductionConfig(): LoggerConfig {
  return getLoggingConfig({
    level: 'info',
    enableConsole: false,
    enablePerformance: false,
    enableUserActions: true
  });
}

/**
 * Test-specific configuration
 */
export function getTestConfig(): LoggerConfig {
  return getLoggingConfig({
    level: 'warn',
    enableConsole: false,
    enableFile: false,
    enablePerformance: false,
    enableUserActions: false
  });
}

/**
 * Component-specific logging configurations
 */
export const componentConfigs: Record<string, Partial<LoggerConfig>> = {
  // Performance-sensitive components
  PerformanceMonitor: {
    level: 'warn',
    enablePerformance: true
  },
  
  // Security-sensitive components
  AuthManager: {
    level: 'info',
    enableUserActions: true
  },
  
  // Error handling components
  ErrorHandler: {
    level: 'error',
    enableConsole: true // Always show errors in console
  },
  
  // Network components
  NetworkManager: {
    level: 'info',
    enablePerformance: true
  },
  
  // Plugin system
  PluginManager: {
    level: 'debug',
    enableUserActions: true
  }
};

/**
 * Get configuration for a specific component
 */
export function getComponentConfig(componentName: string): LoggerConfig {
  const baseConfig = getLoggingConfig();
  const componentConfig = componentConfigs[componentName] || {};
  
  return {
    ...baseConfig,
    ...componentConfig,
    // Component-specific settings take precedence
    sensitiveDataPatterns: [
      ...baseConfig.sensitiveDataPatterns!,
      ...(componentConfig.sensitiveDataPatterns || [])
    ]
  };
}

/**
 * Validate logging configuration
 */
export function validateConfig(config: LoggerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate log level
  const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];
  if (!validLevels.includes(config.level)) {
    errors.push(`Invalid log level: ${config.level}`);
  }

  // Validate file settings if enabled
  if (config.enableFile && config.fileSettings) {
    if (config.fileSettings.maxFileSize <= 0) {
      errors.push('Max file size must be positive');
    }
    if (config.fileSettings.maxFiles <= 0) {
      errors.push('Max files must be positive');
    }
    if (!config.fileSettings.directory) {
      errors.push('Log directory is required when file logging is enabled');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Environment variable helpers
 */
export const env = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  isProduction: process.env.NODE_ENV === 'production',
  
  logLevel: process.env.LOG_LEVEL as LogLevel || undefined,
  enableConsoleLogs: process.env.ENABLE_CONSOLE_LOGS === 'true',
  enableFileLogs: process.env.ENABLE_FILE_LOGS !== 'false',
  enablePerformanceLogs: process.env.ENABLE_PERFORMANCE_LOGS === 'true',
  enableUserActionLogs: process.env.ENABLE_USER_ACTION_LOGS !== 'false',
  
  logMaxFileSize: process.env.LOG_MAX_FILE_SIZE,
  logMaxFiles: process.env.LOG_MAX_FILES,
  logDirectory: process.env.LOG_DIRECTORY
};

/**
 * Default export
 */
export default getLoggingConfig;