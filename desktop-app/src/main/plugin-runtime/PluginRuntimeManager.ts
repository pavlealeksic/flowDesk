/**
 * Plugin Runtime Manager - Core orchestrator for the plugin system
 * 
 * Manages plugin lifecycle, security, sandboxing, and provides the main
 * interface between the application and plugins.
 */

import { EventEmitter } from 'events';
import { BrowserWindow, webContents, ipcMain, WebContents, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  PluginManifest, 
  PluginInstallation, 
  PluginRuntimeContext, 
  PluginAPI,
  PluginInstallationStatus,
  Platform
} from '@flow-desk/shared';
import { PluginSandboxManager } from './sandbox/PluginSandboxManager';
import { PluginSecurityManager } from './security/PluginSecurityManager';
import { PluginLifecycleManager } from './lifecycle/PluginLifecycleManager';
import { PluginStorageManager } from './storage/PluginStorageManager';
import { PluginEventBus } from './events/PluginEventBus';
import { PluginAPIProvider } from './api/PluginAPIProvider';
import { PluginRegistry } from './registry/PluginRegistry';
import { PluginLogger } from './utils/PluginLogger';
import { PluginMonitor } from './monitoring/PluginMonitor';
import { PluginExecutionContext } from './sandbox/PluginExecutionContext';

export interface PluginRuntimeConfig {
  /** Plugin installation directory */
  pluginDir: string;
  /** User data directory */
  userDataDir: string;
  /** Whether to enable development mode */
  developmentMode: boolean;
  /** Maximum number of concurrent plugins */
  maxConcurrentPlugins: number;
  /** Plugin execution timeout in ms */
  executionTimeout: number;
  /** Security settings */
  security: {
    /** Enable strict CSP */
    strictCSP: boolean;
    /** Allowed origins for network requests */
    allowedOrigins: string[];
    /** Enable signature verification */
    verifySignatures: boolean;
  };
}

/**
 * Main Plugin Runtime Manager class
 * 
 * This is the central coordinator for all plugin operations. It manages:
 * - Plugin discovery and loading
 * - Security and sandboxing
 * - Lifecycle management
 * - Inter-plugin communication
 * - API provisioning
 */
export class PluginRuntimeManager extends EventEmitter {
  private readonly config: PluginRuntimeConfig;
  private readonly sandboxManager: PluginSandboxManager;
  private readonly securityManager: PluginSecurityManager;
  private readonly lifecycleManager: PluginLifecycleManager;
  private readonly storageManager: PluginStorageManager;
  private readonly eventBus: PluginEventBus;
  private readonly apiProvider: PluginAPIProvider;
  private readonly registry: PluginRegistry;
  private readonly logger: PluginLogger;
  private readonly monitor: PluginMonitor;
  
  private readonly activePlugins = new Map<string, PluginExecutionContext>();
  private readonly pluginInstallations = new Map<string, PluginInstallation>();
  private isInitialized = false;
  private mainWindow?: BrowserWindow;

  constructor(config: PluginRuntimeConfig) {
    super();
    this.config = config;
    this.logger = new PluginLogger('PluginRuntimeManager');
    
    // Initialize core components
    this.eventBus = new PluginEventBus();
    this.securityManager = new PluginSecurityManager(config.security);
    this.storageManager = new PluginStorageManager(config.userDataDir);
    this.sandboxManager = new PluginSandboxManager(this.securityManager);
    this.lifecycleManager = new PluginLifecycleManager(
      config.pluginDir,
      this.storageManager,
      this.securityManager
    );
    this.apiProvider = new PluginAPIProvider(
      this.eventBus,
      this.storageManager,
      this.securityManager
    );
    this.registry = new PluginRegistry(config.pluginDir);
    this.monitor = new PluginMonitor();

    this.setupIPCHandlers();
    this.setupEventListeners();
  }

  /**
   * Initialize the plugin runtime system
   */
  async initialize(mainWindow: BrowserWindow): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Plugin runtime already initialized');
    }

    this.mainWindow = mainWindow;
    this.logger.info('Initializing plugin runtime system');

    try {
      // Initialize all subsystems in order
      await this.storageManager.initialize();
      await this.securityManager.initialize();
      await this.lifecycleManager.initialize();
      await this.sandboxManager.initialize();
      await this.registry.initialize();
      await this.monitor.initialize();

      // Discover and load installed plugins
      await this.discoverInstalledPlugins();
      
      // Load enabled plugins
      await this.loadEnabledPlugins();

      this.isInitialized = true;
      this.logger.info('Plugin runtime system initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize plugin runtime', error);
      throw error;
    }
  }

  /**
   * Shutdown the plugin runtime system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Shutting down plugin runtime system');

    try {
      // Stop all active plugins
      await this.stopAllPlugins();

      // Shutdown subsystems
      await this.monitor.shutdown();
      await this.sandboxManager.shutdown();
      await this.lifecycleManager.shutdown();
      await this.storageManager.shutdown();
      await this.securityManager.shutdown();

      this.isInitialized = false;
      this.logger.info('Plugin runtime system shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during plugin runtime shutdown', error);
      throw error;
    }
  }

  /**
   * Install a plugin from a package
   */
  async installPlugin(packagePath: string, userId: string, workspaceId?: string): Promise<PluginInstallation> {
    this.logger.info(`Installing plugin from ${packagePath}`);
    
    try {
      // Validate and install the plugin
      const installation = await this.lifecycleManager.installPlugin(
        packagePath, 
        userId, 
        workspaceId
      );

      // Store installation record
      this.pluginInstallations.set(installation.id, installation);

      // If plugin is enabled, load it
      if (installation.settings.enabled) {
        await this.loadPlugin(installation.id);
      }

      this.logger.info(`Plugin ${installation.pluginId} installed successfully`);
      this.emit('pluginInstalled', installation);
      
      return installation;
    } catch (error) {
      this.logger.error(`Failed to install plugin from ${packagePath}`, error);
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(installationId: string): Promise<void> {
    const installation = this.pluginInstallations.get(installationId);
    if (!installation) {
      throw new Error(`Plugin installation ${installationId} not found`);
    }

    this.logger.info(`Uninstalling plugin ${installation.pluginId}`);

    try {
      // Stop plugin if running
      await this.stopPlugin(installationId);

      // Uninstall the plugin
      await this.lifecycleManager.uninstallPlugin(installationId);

      // Remove from registry
      this.pluginInstallations.delete(installationId);

      this.logger.info(`Plugin ${installation.pluginId} uninstalled successfully`);
      this.emit('pluginUninstalled', installation);
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${installation.pluginId}`, error);
      throw error;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(installationId: string): Promise<void> {
    const installation = this.pluginInstallations.get(installationId);
    if (!installation) {
      throw new Error(`Plugin installation ${installationId} not found`);
    }

    this.logger.info(`Enabling plugin ${installation.pluginId}`);

    try {
      // Update settings
      installation.settings.enabled = true;
      installation.status = 'active';
      installation.updatedAt = new Date();

      // Save updated installation
      await this.storageManager.savePluginInstallation(installation);

      // Load and start the plugin
      await this.loadPlugin(installationId);

      this.logger.info(`Plugin ${installation.pluginId} enabled successfully`);
      this.emit('pluginEnabled', installation);
    } catch (error) {
      this.logger.error(`Failed to enable plugin ${installation.pluginId}`, error);
      installation.status = 'error';
      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(installationId: string): Promise<void> {
    const installation = this.pluginInstallations.get(installationId);
    if (!installation) {
      throw new Error(`Plugin installation ${installationId} not found`);
    }

    this.logger.info(`Disabling plugin ${installation.pluginId}`);

    try {
      // Update settings
      installation.settings.enabled = false;
      installation.status = 'disabled';
      installation.updatedAt = new Date();

      // Save updated installation
      await this.storageManager.savePluginInstallation(installation);

      // Stop the plugin
      await this.stopPlugin(installationId);

      this.logger.info(`Plugin ${installation.pluginId} disabled successfully`);
      this.emit('pluginDisabled', installation);
    } catch (error) {
      this.logger.error(`Failed to disable plugin ${installation.pluginId}`, error);
      throw error;
    }
  }

  /**
   * Get all plugin installations
   */
  getPluginInstallations(): PluginInstallation[] {
    return Array.from(this.pluginInstallations.values());
  }

  /**
   * Get plugin installation by ID
   */
  getPluginInstallation(installationId: string): PluginInstallation | undefined {
    return this.pluginInstallations.get(installationId);
  }

  /**
   * Get active plugin contexts
   */
  getActivePlugins(): PluginExecutionContext[] {
    return Array.from(this.activePlugins.values());
  }

  /**
   * Execute plugin action
   */
  async executePluginAction(
    installationId: string, 
    action: string, 
    params: any = {}
  ): Promise<any> {
    const context = this.activePlugins.get(installationId);
    if (!context) {
      throw new Error(`Plugin ${installationId} is not active`);
    }

    this.logger.debug(`Executing action ${action} on plugin ${installationId}`);
    
    try {
      const result = await context.executeAction(action, params);
      this.monitor.recordActionExecution(installationId, action, true);
      return result;
    } catch (error) {
      this.monitor.recordActionExecution(installationId, action, false);
      this.logger.error(`Failed to execute action ${action} on plugin ${installationId}`, error);
      throw error;
    }
  }

  /**
   * Private: Load a plugin into the runtime
   */
  private async loadPlugin(installationId: string): Promise<void> {
    const installation = this.pluginInstallations.get(installationId);
    if (!installation) {
      throw new Error(`Plugin installation ${installationId} not found`);
    }

    if (this.activePlugins.has(installationId)) {
      this.logger.warn(`Plugin ${installation.pluginId} is already loaded`);
      return;
    }

    this.logger.info(`Loading plugin ${installation.pluginId}`);

    try {
      // Load plugin manifest
      const manifest = await this.lifecycleManager.loadPluginManifest(installationId);
      
      // Create runtime context
      const runtimeContext = await this.createRuntimeContext(installation, manifest);
      
      // Create execution context with sandbox
      const executionContext = await this.sandboxManager.createExecutionContext(
        installation,
        manifest,
        runtimeContext
      );

      // Initialize the plugin
      await executionContext.initialize();

      // Store active plugin
      this.activePlugins.set(installationId, executionContext);

      // Update installation status
      installation.status = 'active';
      installation.lastUsedAt = new Date();
      
      this.logger.info(`Plugin ${installation.pluginId} loaded successfully`);
      this.emit('pluginLoaded', installation);
    } catch (error) {
      installation.status = 'error';
      this.logger.error(`Failed to load plugin ${installation.pluginId}`, error);
      throw error;
    }
  }

  /**
   * Private: Stop a plugin
   */
  private async stopPlugin(installationId: string): Promise<void> {
    const context = this.activePlugins.get(installationId);
    if (!context) return;

    const installation = this.pluginInstallations.get(installationId);
    this.logger.info(`Stopping plugin ${installation?.pluginId || installationId}`);

    try {
      await context.destroy();
      this.activePlugins.delete(installationId);
      
      this.logger.info(`Plugin ${installation?.pluginId || installationId} stopped successfully`);
      this.emit('pluginStopped', installation);
    } catch (error) {
      this.logger.error(`Error stopping plugin ${installation?.pluginId || installationId}`, error);
      throw error;
    }
  }

  /**
   * Private: Discover installed plugins
   */
  private async discoverInstalledPlugins(): Promise<void> {
    this.logger.info('Discovering installed plugins');
    
    try {
      const installations = await this.storageManager.loadPluginInstallations();
      
      for (const installation of installations) {
        this.pluginInstallations.set(installation.id, installation);
      }
      
      this.logger.info(`Discovered ${installations.length} installed plugins`);
    } catch (error) {
      this.logger.error('Failed to discover installed plugins', error);
      throw error;
    }
  }

  /**
   * Private: Load enabled plugins
   */
  private async loadEnabledPlugins(): Promise<void> {
    this.logger.info('Loading enabled plugins');
    
    const enabledPlugins = Array.from(this.pluginInstallations.values())
      .filter(installation => installation.settings.enabled && installation.status !== 'error');

    for (const installation of enabledPlugins) {
      try {
        await this.loadPlugin(installation.id);
      } catch (error) {
        this.logger.error(`Failed to load plugin ${installation.pluginId}`, error);
      }
    }
  }

  /**
   * Private: Stop all plugins
   */
  private async stopAllPlugins(): Promise<void> {
    this.logger.info('Stopping all plugins');
    
    const stopPromises = Array.from(this.activePlugins.keys()).map(
      installationId => this.stopPlugin(installationId)
    );
    
    await Promise.allSettled(stopPromises);
  }

  /**
   * Get user email from user service
   */
  private async getUserEmail(userId: string): Promise<string> {
    try {
      // In a production environment, this would integrate with your user management system
      // For now, we'll use a fallback approach with stored user data
      const userData = await this.storageManager.getUserData(userId);
      return userData?.email || 'user@example.com';
    } catch (error) {
      this.logger.warn(`Failed to get user email for ${userId}`, error);
      return 'user@example.com';
    }
  }

  /**
   * Get user name from user service
   */
  private async getUserName(userId: string): Promise<string> {
    try {
      const userData = await this.storageManager.getUserData(userId);
      return userData?.name || 'User';
    } catch (error) {
      this.logger.warn(`Failed to get user name for ${userId}`, error);
      return 'User';
    }
  }

  /**
   * Get workspace name from workspace service
   */
  private async getWorkspaceName(workspaceId: string | undefined): Promise<string> {
    if (!workspaceId) return 'Default Workspace';
    
    try {
      const workspaceData = await this.storageManager.getWorkspaceData(workspaceId);
      return workspaceData?.name || `Workspace ${workspaceId}`;
    } catch (error) {
      this.logger.warn(`Failed to get workspace name for ${workspaceId}`, error);
      return `Workspace ${workspaceId}`;
    }
  }

  /**
   * Private: Create runtime context for a plugin
   */
  private async createRuntimeContext(
    installation: PluginInstallation, 
    manifest: PluginManifest
  ): Promise<PluginRuntimeContext> {
    return {
      plugin: installation,
      user: {
        id: installation.userId,
        email: await this.getUserEmail(installation.userId),
        name: await this.getUserName(installation.userId)
        preferences: {}
      },
      workspace: installation.workspaceId ? {
        id: installation.workspaceId,
        name: await this.getWorkspaceName(installation.workspaceId)
        settings: {}
      } : undefined,
      platform: {
        type: 'desktop' as Platform,
        version: process.env.npm_package_version || '0.0.0',
        os: process.platform
      },
      api: this.apiProvider.createAPI(installation, manifest)
    };
  }

  /**
   * Private: Setup IPC handlers for renderer communication
   */
  private setupIPCHandlers(): void {
    ipcMain.handle('plugin:install', async (event, packagePath: string, userId: string, workspaceId?: string) => {
      return this.installPlugin(packagePath, userId, workspaceId);
    });

    ipcMain.handle('plugin:uninstall', async (event, installationId: string) => {
      return this.uninstallPlugin(installationId);
    });

    ipcMain.handle('plugin:enable', async (event, installationId: string) => {
      return this.enablePlugin(installationId);
    });

    ipcMain.handle('plugin:disable', async (event, installationId: string) => {
      return this.disablePlugin(installationId);
    });

    ipcMain.handle('plugin:list', async () => {
      return this.getPluginInstallations();
    });

    ipcMain.handle('plugin:execute', async (event, installationId: string, action: string, params: any) => {
      return this.executePluginAction(installationId, action, params);
    });
  }

  /**
   * Private: Setup event listeners
   */
  private setupEventListeners(): void {
    this.eventBus.on('plugin:error', (installationId: string, error: Error) => {
      this.logger.error(`Plugin ${installationId} error`, error);
      const installation = this.pluginInstallations.get(installationId);
      if (installation) {
        installation.status = 'error';
        this.emit('pluginError', installation, error);
      }
    });

    this.eventBus.on('plugin:log', (installationId: string, level: string, message: string) => {
      this.logger.log(level, `[${installationId}] ${message}`);
    });
  }
}