/**
 * @fileoverview Application Configuration Management System
 * 
 * Centralized configuration management for Flow Desk with environment-based
 * settings, validation, and hot-reloading capabilities.
 * 
 * Features:
 * - Environment-based configuration
 * - Type-safe configuration schemas
 * - Runtime validation
 * - Configuration hot-reloading
 * - Default value fallbacks
 * - Configuration file merging
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { z } from 'zod';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { EventEmitter } from 'events';
import log from 'electron-log';

/**
 * Memory management configuration schema
 */
const MemoryConfigSchema = z.object({
  /** Maximum number of WebContentsViews per workspace */
  maxWebContentsViews: z.number().min(1).max(50).default(10),
  
  /** Maximum memory usage before triggering cleanup (MB) */
  memoryThresholdMB: z.number().min(50).max(2000).default(500),
  
  /** Interval for memory monitoring (ms) */
  memoryMonitorInterval: z.number().min(1000).max(60000).default(30000),
  
  /** Time before inactive services are cleaned up (ms) */
  inactiveCleanupDelay: z.number().min(60000).max(3600000).default(1800000), // 30 minutes
  
  /** Enable automatic memory cleanup */
  enableAutoCleanup: z.boolean().default(true),
  
  /** Enable memory usage monitoring */
  enableMemoryMonitoring: z.boolean().default(true),
});

/**
 * Performance monitoring configuration schema
 */
const PerformanceConfigSchema = z.object({
  /** Enable performance monitoring */
  enabled: z.boolean().default(true),
  
  /** Sampling rate for performance metrics (0.0 to 1.0) */
  samplingRate: z.number().min(0).max(1).default(0.1),
  
  /** Performance metrics collection interval (ms) */
  metricsInterval: z.number().min(1000).max(60000).default(10000),
  
  /** Enable React profiler in development */
  enableReactProfiler: z.boolean().default(false),
  
  /** Enable bundle analyzer */
  enableBundleAnalysis: z.boolean().default(false),
  
  /** Maximum number of performance entries to keep */
  maxPerformanceEntries: z.number().min(100).max(10000).default(1000),
});

/**
 * Error handling configuration schema
 */
const ErrorHandlingConfigSchema = z.object({
  /** Enable automatic error recovery */
  enableAutoRecovery: z.boolean().default(true),
  
  /** Maximum number of retry attempts */
  maxRetryAttempts: z.number().min(1).max(10).default(3),
  
  /** Base delay for exponential backoff (ms) */
  retryBaseDelay: z.number().min(100).max(10000).default(1000),
  
  /** Maximum delay for exponential backoff (ms) */
  retryMaxDelay: z.number().min(1000).max(60000).default(30000),
  
  /** Enable error reporting */
  enableErrorReporting: z.boolean().default(false),
  
  /** Error reporting endpoint */
  errorReportingEndpoint: z.string().url().optional(),
});

/**
 * Workspace configuration schema
 */
const WorkspaceConfigSchema = z.object({
  /** Default workspace browser isolation */
  defaultBrowserIsolation: z.enum(['shared', 'isolated']).default('shared'),
  
  /** Maximum number of workspaces */
  maxWorkspaces: z.number().min(1).max(100).default(20),
  
  /** Maximum number of services per workspace */
  maxServicesPerWorkspace: z.number().min(1).max(50).default(15),
  
  /** Enable workspace preloading */
  enablePreloading: z.boolean().default(true),
  
  /** Maximum number of services to preload */
  maxPreloadServices: z.number().min(1).max(10).default(5),
  
  /** Auto-save interval for workspace data (ms) */
  autoSaveInterval: z.number().min(1000).max(300000).default(30000),
});

/**
 * Security configuration schema
 */
const SecurityConfigSchema = z.object({
  /** Enable Content Security Policy */
  enableCSP: z.boolean().default(true),
  
  /** Enable HTTPS-only mode */
  httpsOnly: z.boolean().default(true),
  
  /** Maximum URL length */
  maxUrlLength: z.number().min(100).max(10000).default(2000),
  
  /** Allowed URL protocols */
  allowedProtocols: z.array(z.string()).default(['https:', 'http:']),
  
  /** Enable iframe sandboxing */
  enableIframeSandbox: z.boolean().default(true),
  
  /** Rate limiting configuration */
  rateLimiting: z.object({
    enabled: z.boolean().default(true),
    maxRequestsPerMinute: z.number().min(10).max(1000).default(100),
    windowSizeMs: z.number().min(1000).max(300000).default(60000),
  }).default(() => ({ enabled: true, maxRequestsPerMinute: 100, windowSizeMs: 60000 })),
});

/**
 * Development configuration schema
 */
const DevelopmentConfigSchema = z.object({
  /** Enable development tools */
  enableDevTools: z.boolean().default(false),
  
  /** Enable hot reload */
  enableHotReload: z.boolean().default(false),
  
  /** Enable debug logging */
  enableDebugLogging: z.boolean().default(false),
  
  /** Mock external services */
  mockExternalServices: z.boolean().default(false),
  
  /** Development server port */
  devServerPort: z.number().min(1000).max(65535).default(5173),
});

/**
 * UI Layout configuration schema
 */
const UILayoutConfigSchema = z.object({
  /** Primary sidebar width (pixels) */
  primarySidebarWidth: z.number().min(32).max(128).default(64),
  
  /** Services sidebar width (pixels) */
  servicesSidebarWidth: z.number().min(128).max(512).default(256),
  
  /** Docked panel width (pixels) */
  dockedPanelWidth: z.number().min(128).max(512).default(280),
  
  /** Minimum panel width (pixels) */
  minPanelWidth: z.number().min(100).max(300).default(200),
  
  /** Maximum panel width (pixels) */
  maxPanelWidth: z.number().min(300).max(800).default(500),
  
  /** Top bar height (pixels) */
  topBarHeight: z.number().min(0).max(100).default(0),
  
  /** Content padding (pixels) */
  contentPadding: z.number().min(8).max(32).default(16),
  
  /** Panel padding (pixels) */
  panelPadding: z.number().min(8).max(24).default(12),
});

/**
 * Z-Index configuration schema
 */
const ZIndexConfigSchema = z.object({
  /** Base layer z-index */
  base: z.number().min(1).max(100).default(1),
  
  /** Browser view z-index */
  browserView: z.number().min(1).max(100).default(5),
  
  /** Main content z-index */
  mainContent: z.number().min(1).max(100).default(10),
  
  /** Sidebar z-index */
  sidebar: z.number().min(1).max(100).default(20),
  
  /** Navigation z-index */
  navigation: z.number().min(1).max(100).default(30),
  
  /** Dropdown z-index */
  dropdown: z.number().min(50).max(500).default(100),
  
  /** Tooltip z-index */
  tooltip: z.number().min(100).max(1000).default(200),
  
  /** Popover z-index */
  popover: z.number().min(200).max(2000).default(300),
  
  /** Overlay z-index */
  overlay: z.number().min(300).max(3000).default(500),
  
  /** Search overlay z-index */
  searchOverlay: z.number().min(400).max(4000).default(600),
  
  /** Notifications z-index */
  notifications: z.number().min(500).max(5000).default(700),
  
  /** Modal backdrop z-index */
  modalBackdrop: z.number().min(800).max(8000).default(1000),
  
  /** Modal z-index */
  modal: z.number().min(900).max(9000).default(1100),
  
  /** Alert modal z-index */
  alertModal: z.number().min(1000).max(10000).default(1200),
  
  /** Loading overlay z-index */
  loadingOverlay: z.number().min(1500).max(15000).default(2000),
  
  /** Error boundary z-index */
  errorBoundary: z.number().min(1800).max(18000).default(2100),
  
  /** Accessibility overlay z-index */
  accessibilityOverlay: z.number().min(2000).max(20000).default(2200),
  
  /** Maximum z-index */
  maximum: z.number().min(5000).max(99999).default(9999),
});

/**
 * Network configuration schema
 */
const NetworkConfigSchema = z.object({
  /** Default timeout for network requests (ms) */
  defaultTimeout: z.number().min(1000).max(300000).default(30000),
  
  /** Service load timeout (ms) */
  serviceLoadTimeout: z.number().min(5000).max(120000).default(10000),
  
  /** Database operation timeout (ms) */
  databaseTimeout: z.number().min(5000).max(120000).default(30000),
  
  /** Plugin execution timeout (ms) */
  pluginExecutionTimeout: z.number().min(10000).max(300000).default(30000),
  
  /** Search query timeout (ms) */
  searchTimeout: z.number().min(1000).max(60000).default(5000),
  
  /** Retry base delay for exponential backoff (ms) */
  retryBaseDelay: z.number().min(100).max(10000).default(1000),
  
  /** Retry maximum delay (ms) */
  retryMaxDelay: z.number().min(1000).max(60000).default(30000),
  
  /** Default bind address for network services */
  defaultBindAddress: z.string().default('127.0.0.1'),
  
  /** Maximum URL length */
  maxUrlLength: z.number().min(100).max(10000).default(2000),
});

/**
 * Encryption configuration schema
 */
const EncryptionConfigSchema = z.object({
  /** Key derivation iterations */
  keyDerivationIterations: z.number().min(10000).max(1000000).default(100000),
  
  /** Encryption key length (bytes) */
  keyLength: z.number().min(16).max(64).default(32),
  
  /** Service name for key storage */
  serviceName: z.string().default('FlowDeskEncryption'),
  
  /** Account prefix for key storage */
  accountPrefix: z.string().default('flowdesk_'),
  
  /** Key rotation interval (days) */
  keyRotationIntervalDays: z.number().min(30).max(365).default(90),
});

/**
 * Plugin configuration schema
 */
const PluginConfigSchema = z.object({
  /** Maximum number of plugins */
  maxPlugins: z.number().min(10).max(200).default(100),
  
  /** Plugin sandbox timeout (ms) */
  sandboxTimeout: z.number().min(5000).max(60000).default(30000),
  
  /** Maximum event history size */
  maxEventHistorySize: z.number().min(100).max(10000).default(1000),
  
  /** Maximum listeners per event emitter */
  maxListeners: z.number().min(100).max(5000).default(1000),
  
  /** Health check interval (ms) */
  healthCheckInterval: z.number().min(10000).max(300000).default(60000),
  
  /** Alert cleanup interval (ms) */
  alertCleanupInterval: z.number().min(30000).max(600000).default(300000),
  
  /** Plugin preload timeout (ms) */
  preloadTimeout: z.number().min(1000).max(10000).default(3000),
});

/**
 * Database configuration schema
 */
const DatabaseConfigSchema = z.object({
  /** Busy timeout (ms) */
  busyTimeout: z.number().min(10000).max(120000).default(30000),
  
  /** Maximum query stats history */
  maxQueryStatsHistory: z.number().min(100).max(10000).default(1000),
  
  /** Journal mode */
  journalMode: z.enum(['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL']).default('WAL'),
  
  /** Synchronous mode */
  synchronousMode: z.enum(['OFF', 'NORMAL', 'FULL', 'EXTRA']).default('NORMAL'),
  
  /** Cache size (KB) */
  cacheSize: z.number().min(1000).max(100000).default(20000),
  
  /** Enable foreign key constraints */
  enableForeignKeys: z.boolean().default(true),
});

/**
 * Service configuration schema
 */
const ServiceConfigSchema = z.object({
  /** Maximum preloaded services per workspace */
  maxPreloadedServices: z.number().min(1).max(20).default(5),
  
  /** Service cleanup delay (ms) */
  serviceCleanupDelay: z.number().min(300000).max(7200000).default(1800000),
  
  /** Icon mapping for service types */
  iconMapping: z.record(z.string(), z.string()).default({
    slack: '/service-icons/slack.svg',
    notion: '/service-icons/notion.svg',
    github: '/service-icons/github.svg',
    jira: '/service-icons/jira.svg',
    teams: '/service-icons/teams.svg',
    discord: '/service-icons/discord.svg',
    trello: '/service-icons/trello.svg',
    asana: '/service-icons/asana.svg',
    linear: '/service-icons/linear.svg',
    clickup: '/service-icons/clickup.png',
    monday: '/service-icons/monday.svg',
    gitlab: '/service-icons/gitlab.svg',
    bitbucket: '/service-icons/bitbucket.png',
    googledrive: '/service-icons/googledrive.svg',
    onedrive: '/service-icons/onedrive.svg',
    dropbox: '/service-icons/dropbox.png',
    figma: '/service-icons/figma.ico',
    miro: '/service-icons/miro.svg',
    salesforce: '/service-icons/salesforce.svg',
    hubspot: '/service-icons/hubspot.svg',
    zendesk: '/service-icons/zendesk.svg',
    intercom: '/service-icons/intercom.svg',
    evernote: '/service-icons/evernote.svg',
    canva: '/service-icons/canva.svg',
    adobe: '/service-icons/adobe.svg',
    analytics: '/service-icons/analytics.svg',
    confluence: '/service-icons/confluence.svg',
  }),
  
  /** Default service validation rules */
  validation: z.object({
    maxNameLength: z.number().min(10).max(200).default(100),
    maxTypeLength: z.number().min(10).max(100).default(50),
    minNameLength: z.number().min(1).max(10).default(1),
    minTypeLength: z.number().min(1).max(10).default(1),
  }).default(() => ({
    maxNameLength: 100,
    maxTypeLength: 50,
    minNameLength: 1,
    minTypeLength: 1
  })),
});

/**
 * Main application configuration schema
 */
const AppConfigSchema = z.object({
  /** Application version */
  version: z.string().default('1.0.0'),
  
  /** Environment (development, production, test) */
  environment: z.enum(['development', 'production', 'test']).default('production'),
  
  /** Memory management settings */
  memory: MemoryConfigSchema,
  
  /** Performance monitoring settings */
  performance: PerformanceConfigSchema,
  
  /** Error handling settings */
  errorHandling: ErrorHandlingConfigSchema,
  
  /** Workspace settings */
  workspace: WorkspaceConfigSchema,
  
  /** Security settings */
  security: SecurityConfigSchema,
  
  /** Development settings */
  development: DevelopmentConfigSchema,
  
  /** UI Layout settings */
  uiLayout: UILayoutConfigSchema,
  
  /** Z-Index settings */
  zIndex: ZIndexConfigSchema,
  
  /** Network settings */
  network: NetworkConfigSchema,
  
  /** Encryption settings */
  encryption: EncryptionConfigSchema,
  
  /** Plugin settings */
  plugin: PluginConfigSchema,
  
  /** Database settings */
  database: DatabaseConfigSchema,
  
  /** Service settings */
  service: ServiceConfigSchema,
  
  /** Application data directory */
  dataDirectory: z.string().default('data'),
  
  /** Logging configuration */
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableFileLogging: z.boolean().default(true),
    maxLogFiles: z.number().min(1).max(10).default(5),
    maxLogSizeMB: z.number().min(1).max(100).default(10),
  }).default(() => ({ level: 'info' as const, enableFileLogging: true, maxLogFiles: 5, maxLogSizeMB: 10 })),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type ErrorHandlingConfig = z.infer<typeof ErrorHandlingConfigSchema>;
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;
export type UILayoutConfig = z.infer<typeof UILayoutConfigSchema>;
export type ZIndexConfig = z.infer<typeof ZIndexConfigSchema>;
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;
export type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

/**
 * Configuration Manager Class
 */
export class ConfigManager extends EventEmitter {
  private config: AppConfig;
  private configPath: string;
  private watchEnabled = false;
  
  constructor(configPath?: string) {
    super();
    
    // Determine config path
    this.configPath = configPath || join(process.cwd(), 'config.json');
    
    // Load initial configuration
    this.config = this.loadConfig();
    
    // Set up file watching in development
    if (this.config.environment === 'development') {
      this.enableConfigWatch();
    }
    
    log.info('Configuration manager initialized', {
      environment: this.config.environment,
      configPath: this.configPath,
      memoryLimit: this.config.memory.maxWebContentsViews,
    });
  }

  /**
   * Load configuration from file with fallback to defaults
   */
  private loadConfig(): AppConfig {
    try {
      let configData: Record<string, unknown> = {};
      
      // Load from file if it exists
      if (existsSync(this.configPath)) {
        const fileContent = readFileSync(this.configPath, 'utf8');
        configData = JSON.parse(fileContent);
        log.info('Loaded configuration from file:', this.configPath);
      } else {
        log.info('No configuration file found, using defaults');
      }
      
      // Merge with environment variables
      const envOverrides = this.loadEnvironmentOverrides();
      const mergedConfig = this.deepMerge(configData, envOverrides);
      
      // Validate and parse with schema
      const result = AppConfigSchema.safeParse(mergedConfig);
      
      if (!result.success) {
        log.error('Configuration validation failed:', result.error.flatten());
        log.info('Using default configuration');
        return AppConfigSchema.parse({}); // Use defaults
      }
      
      return result.data;
      
    } catch (error) {
      log.error('Failed to load configuration:', error);
      log.info('Using default configuration');
      return AppConfigSchema.parse({});
    }
  }

  /**
   * Load configuration overrides from environment variables
   */
  private loadEnvironmentOverrides(): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};
    
    // Environment detection
    if (process.env.NODE_ENV) {
      overrides.environment = process.env.NODE_ENV;
    }
    
    // Memory configuration
    if (process.env.FLOWDESK_MAX_WEBCONTENTS) {
      overrides.memory = {
        maxWebContentsViews: parseInt(process.env.FLOWDESK_MAX_WEBCONTENTS, 10),
      };
    }
    
    if (process.env.FLOWDESK_MEMORY_THRESHOLD) {
      if (!overrides.memory) overrides.memory = {};
      (overrides.memory as Record<string, unknown>).memoryThresholdMB = 
        parseInt(process.env.FLOWDESK_MEMORY_THRESHOLD, 10);
    }
    
    // Performance configuration
    if (process.env.FLOWDESK_ENABLE_PERFORMANCE_MONITORING) {
      overrides.performance = {
        enabled: process.env.FLOWDESK_ENABLE_PERFORMANCE_MONITORING === 'true',
      };
    }
    
    // Security configuration
    if (process.env.FLOWDESK_HTTPS_ONLY) {
      overrides.security = {
        httpsOnly: process.env.FLOWDESK_HTTPS_ONLY === 'true',
      };
    }
    
    // Development configuration
    if (process.env.FLOWDESK_ENABLE_DEVTOOLS) {
      overrides.development = {
        enableDevTools: process.env.FLOWDESK_ENABLE_DEVTOOLS === 'true',
      };
    }
    
    if (process.env.FLOWDESK_DEV_PORT) {
      if (!overrides.development) overrides.development = {};
      (overrides.development as Record<string, unknown>).devServerPort = 
        parseInt(process.env.FLOWDESK_DEV_PORT, 10);
    }
    
    // UI Layout configuration
    if (process.env.FLOWDESK_PRIMARY_SIDEBAR_WIDTH) {
      overrides.uiLayout = {
        primarySidebarWidth: parseInt(process.env.FLOWDESK_PRIMARY_SIDEBAR_WIDTH, 10),
      };
    }
    
    if (process.env.FLOWDESK_SERVICES_SIDEBAR_WIDTH) {
      if (!overrides.uiLayout) overrides.uiLayout = {};
      (overrides.uiLayout as Record<string, unknown>).servicesSidebarWidth = 
        parseInt(process.env.FLOWDESK_SERVICES_SIDEBAR_WIDTH, 10);
    }
    
    // Network configuration
    if (process.env.FLOWDESK_DEFAULT_TIMEOUT) {
      overrides.network = {
        defaultTimeout: parseInt(process.env.FLOWDESK_DEFAULT_TIMEOUT, 10),
      };
    }
    
    if (process.env.FLOWDESK_SERVICE_LOAD_TIMEOUT) {
      if (!overrides.network) overrides.network = {};
      (overrides.network as Record<string, unknown>).serviceLoadTimeout = 
        parseInt(process.env.FLOWDESK_SERVICE_LOAD_TIMEOUT, 10);
    }
    
    if (process.env.FLOWDESK_BIND_ADDRESS) {
      if (!overrides.network) overrides.network = {};
      (overrides.network as Record<string, unknown>).defaultBindAddress = 
        process.env.FLOWDESK_BIND_ADDRESS;
    }
    
    // Encryption configuration
    if (process.env.FLOWDESK_KEY_ITERATIONS) {
      overrides.encryption = {
        keyDerivationIterations: parseInt(process.env.FLOWDESK_KEY_ITERATIONS, 10),
      };
    }
    
    if (process.env.FLOWDESK_KEY_LENGTH) {
      if (!overrides.encryption) overrides.encryption = {};
      (overrides.encryption as Record<string, unknown>).keyLength = 
        parseInt(process.env.FLOWDESK_KEY_LENGTH, 10);
    }
    
    // Plugin configuration
    if (process.env.FLOWDESK_MAX_PLUGINS) {
      overrides.plugin = {
        maxPlugins: parseInt(process.env.FLOWDESK_MAX_PLUGINS, 10),
      };
    }
    
    if (process.env.FLOWDESK_PLUGIN_TIMEOUT) {
      if (!overrides.plugin) overrides.plugin = {};
      (overrides.plugin as Record<string, unknown>).sandboxTimeout = 
        parseInt(process.env.FLOWDESK_PLUGIN_TIMEOUT, 10);
    }
    
    // Database configuration
    if (process.env.FLOWDESK_DB_TIMEOUT) {
      overrides.database = {
        busyTimeout: parseInt(process.env.FLOWDESK_DB_TIMEOUT, 10),
      };
    }
    
    if (process.env.FLOWDESK_DB_CACHE_SIZE) {
      if (!overrides.database) overrides.database = {};
      (overrides.database as Record<string, unknown>).cacheSize = 
        parseInt(process.env.FLOWDESK_DB_CACHE_SIZE, 10);
    }
    
    // Service configuration
    if (process.env.FLOWDESK_MAX_PRELOADED_SERVICES) {
      overrides.service = {
        maxPreloadedServices: parseInt(process.env.FLOWDESK_MAX_PRELOADED_SERVICES, 10),
      };
    }
    
    return overrides;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          result[key] = this.deepMerge(
            result[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
          );
        } else {
          result[key] = source[key];
        }
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Enable configuration file watching for hot reload
   */
  private enableConfigWatch(): void {
    if (this.watchEnabled) return;
    
    try {
      const fs = require('fs');
      
      if (existsSync(this.configPath)) {
        fs.watchFile(this.configPath, { interval: 1000 }, () => {
          log.info('Configuration file changed, reloading...');
          this.reloadConfig();
        });
        
        this.watchEnabled = true;
        log.info('Configuration file watching enabled');
      }
    } catch (error) {
      log.warn('Failed to enable configuration watching:', error);
    }
  }

  /**
   * Reload configuration from file
   */
  public reloadConfig(): boolean {
    try {
      const newConfig = this.loadConfig();
      const oldConfig = this.config;
      
      this.config = newConfig;
      
      this.emit('config-changed', {
        oldConfig,
        newConfig,
        changes: this.getConfigChanges(oldConfig, newConfig),
      });
      
      log.info('Configuration reloaded successfully');
      return true;
      
    } catch (error) {
      log.error('Failed to reload configuration:', error);
      return false;
    }
  }

  /**
   * Get configuration changes between old and new config
   */
  private getConfigChanges(oldConfig: AppConfig, newConfig: AppConfig): string[] {
    const changes: string[] = [];
    
    // Memory configuration changes
    if (oldConfig.memory.maxWebContentsViews !== newConfig.memory.maxWebContentsViews) {
      changes.push(`memory.maxWebContentsViews: ${oldConfig.memory.maxWebContentsViews} → ${newConfig.memory.maxWebContentsViews}`);
    }
    
    if (oldConfig.memory.memoryThresholdMB !== newConfig.memory.memoryThresholdMB) {
      changes.push(`memory.memoryThresholdMB: ${oldConfig.memory.memoryThresholdMB} → ${newConfig.memory.memoryThresholdMB}`);
    }
    
    // Performance configuration changes
    if (oldConfig.performance.enabled !== newConfig.performance.enabled) {
      changes.push(`performance.enabled: ${oldConfig.performance.enabled} → ${newConfig.performance.enabled}`);
    }
    
    // More change detection can be added as needed
    
    return changes;
  }

  /**
   * Save current configuration to file
   */
  public saveConfig(): boolean {
    try {
      // Ensure config directory exists
      const configDir = require('path').dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      // Write configuration to file
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      
      log.info('Configuration saved to file:', this.configPath);
      return true;
      
    } catch (error) {
      log.error('Failed to save configuration:', error);
      return false;
    }
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(updates: Partial<AppConfig>): boolean {
    try {
      const mergedConfig = this.deepMerge(this.config as Record<string, unknown>, updates as Record<string, unknown>);
      const validationResult = AppConfigSchema.safeParse(mergedConfig);
      
      if (!validationResult.success) {
        log.error('Configuration update validation failed:', validationResult.error.flatten());
        return false;
      }
      
      const oldConfig = this.config;
      this.config = validationResult.data;
      
      this.emit('config-updated', {
        oldConfig,
        newConfig: this.config,
        updates,
      });
      
      log.info('Configuration updated successfully');
      return true;
      
    } catch (error) {
      log.error('Failed to update configuration:', error);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<AppConfig> {
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  public getMemoryConfig(): Readonly<MemoryConfig> {
    return this.config.memory;
  }

  public getPerformanceConfig(): Readonly<PerformanceConfig> {
    return this.config.performance;
  }

  public getErrorHandlingConfig(): Readonly<ErrorHandlingConfig> {
    return this.config.errorHandling;
  }

  public getWorkspaceConfig(): Readonly<WorkspaceConfig> {
    return this.config.workspace;
  }

  public getSecurityConfig(): Readonly<SecurityConfig> {
    return this.config.security;
  }

  public getDevelopmentConfig(): Readonly<DevelopmentConfig> {
    return this.config.development;
  }

  public getUILayoutConfig(): Readonly<UILayoutConfig> {
    return this.config.uiLayout;
  }

  public getZIndexConfig(): Readonly<ZIndexConfig> {
    return this.config.zIndex;
  }

  public getNetworkConfig(): Readonly<NetworkConfig> {
    return this.config.network;
  }

  public getEncryptionConfig(): Readonly<EncryptionConfig> {
    return this.config.encryption;
  }

  public getPluginConfig(): Readonly<PluginConfig> {
    return this.config.plugin;
  }

  public getDatabaseConfig(): Readonly<DatabaseConfig> {
    return this.config.database;
  }

  public getServiceConfig(): Readonly<ServiceConfig> {
    return this.config.service;
  }

  /**
   * Validate configuration
   */
  public validateConfig(): { isValid: boolean; errors?: string[] } {
    const result = AppConfigSchema.safeParse(this.config);
    
    if (result.success) {
      return { isValid: true };
    } else {
      return {
        isValid: false,
        errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
      };
    }
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    const oldConfig = this.config;
    this.config = AppConfigSchema.parse({});
    
    this.emit('config-reset', {
      oldConfig,
      newConfig: this.config,
    });
    
    log.info('Configuration reset to defaults');
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.watchEnabled) {
      try {
        const fs = require('fs');
        fs.unwatchFile(this.configPath);
        this.watchEnabled = false;
      } catch (error) {
        log.warn('Failed to cleanup configuration watching:', error);
      }
    }
    
    this.removeAllListeners();
    log.info('Configuration manager destroyed');
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

// Export default configuration for testing and documentation
export const defaultConfig = AppConfigSchema.parse({});

export default configManager;