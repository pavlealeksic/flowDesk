/**
 * Plugin Execution Context - Manages individual plugin execution environment
 * 
 * This class provides the isolated runtime environment for a single plugin,
 * handling code execution, API access, and security boundaries.
 */

import { BrowserWindow, BrowserView, webContents, ipcMain } from 'electron';
import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { PluginManifest, PluginInstallation, PluginRuntimeContext } from '@flow-desk/shared';
import { PluginSecurityManager } from '../security/PluginSecurityManager';
import { PluginLogger } from '../utils/PluginLogger';
import { SandboxConfig } from './PluginSandboxManager';

export interface PluginExecutionState {
  status: 'initializing' | 'running' | 'paused' | 'stopped' | 'error';
  startTime: Date;
  lastActivity: Date;
  memoryUsage: number;
  executionCount: number;
  errorCount: number;
}

/**
 * Plugin Execution Context
 * 
 * Provides secure, isolated execution environment for plugin code with
 * controlled access to system APIs and resources.
 */
export class PluginExecutionContext extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly installation: PluginInstallation;
  private readonly manifest: PluginManifest;
  private readonly runtimeContext: PluginRuntimeContext;
  private readonly sandboxConfig: SandboxConfig;
  private readonly sandboxSession: Electron.Session;
  private readonly securityManager: PluginSecurityManager;

  private vmContext?: vm.Context;
  private browserView?: BrowserView;
  private pluginWindow?: BrowserWindow;
  private executionState: PluginExecutionState;
  private pluginCode?: string;
  private isInitialized = false;
  private executionTimeouts = new Set<NodeJS.Timeout>();
  private readonly actionHandlers = new Map<string, Function>();

  constructor(
    installation: PluginInstallation,
    manifest: PluginManifest,
    runtimeContext: PluginRuntimeContext,
    sandboxConfig: SandboxConfig,
    sandboxSession: Electron.Session,
    securityManager: PluginSecurityManager
  ) {
    super();
    this.installation = installation;
    this.manifest = manifest;
    this.runtimeContext = runtimeContext;
    this.sandboxConfig = sandboxConfig;
    this.sandboxSession = sandboxSession;
    this.securityManager = securityManager;
    this.logger = new PluginLogger(`PluginExecutionContext:${installation.pluginId}`);

    this.executionState = {
      status: 'initializing',
      startTime: new Date(),
      lastActivity: new Date(),
      memoryUsage: 0,
      executionCount: 0,
      errorCount: 0
    };
  }

  /**
   * Initialize the plugin execution context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Plugin execution context already initialized');
    }

    this.logger.info('Initializing plugin execution context');

    try {
      // Load plugin code
      await this.loadPluginCode();

      // Create execution environment
      await this.createExecutionEnvironment();

      // Execute plugin initialization
      await this.executePluginInit();

      this.executionState.status = 'running';
      this.isInitialized = true;

      this.logger.info('Plugin execution context initialized successfully');
    } catch (error) {
      this.executionState.status = 'error';
      this.executionState.errorCount++;
      this.logger.error('Failed to initialize plugin execution context', error);
      throw error;
    }
  }

  /**
   * Destroy the execution context
   */
  async destroy(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Destroying plugin execution context');

    try {
      this.executionState.status = 'stopped';

      // Clear all timeouts
      this.executionTimeouts.forEach(timeout => clearTimeout(timeout));
      this.executionTimeouts.clear();

      // Execute plugin cleanup if available
      try {
        await this.executePluginCleanup();
      } catch (error) {
        this.logger.warn('Error during plugin cleanup', error);
      }

      // Cleanup browser resources
      if (this.browserView) {
        this.browserView.webContents.close();
        this.browserView = undefined;
      }

      if (this.pluginWindow) {
        this.pluginWindow.destroy();
        this.pluginWindow = undefined;
      }

      // Cleanup VM context
      if (this.vmContext) {
        this.vmContext = undefined;
      }

      this.isInitialized = false;
      this.logger.info('Plugin execution context destroyed');
    } catch (error) {
      this.logger.error('Error destroying plugin execution context', error);
      throw error;
    }
  }

  /**
   * Execute plugin action
   */
  async executeAction(action: string, params: any = {}): Promise<any> {
    if (!this.isInitialized || this.executionState.status !== 'running') {
      throw new Error('Plugin execution context not ready');
    }

    this.logger.debug(`Executing action: ${action}`);

    try {
      this.updateActivity();
      this.executionState.executionCount++;

      const handler = this.actionHandlers.get(action);
      if (!handler) {
        throw new Error(`Action handler '${action}' not found`);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => handler.call(this.vmContext, params),
        this.sandboxConfig.timeoutMs
      );

      this.logger.debug(`Action ${action} executed successfully`);
      return result;
    } catch (error) {
      this.executionState.errorCount++;
      this.logger.error(`Failed to execute action ${action}`, error);
      throw error;
    }
  }

  /**
   * Get plugin installation
   */
  getInstallation(): PluginInstallation {
    return this.installation;
  }

  /**
   * Get plugin manifest
   */
  getManifest(): PluginManifest {
    return this.manifest;
  }

  /**
   * Get execution state
   */
  getExecutionState(): PluginExecutionState {
    return { ...this.executionState };
  }

  /**
   * Pause plugin execution
   */
  pause(): void {
    if (this.executionState.status === 'running') {
      this.executionState.status = 'paused';
      this.logger.info('Plugin execution paused');
    }
  }

  /**
   * Resume plugin execution
   */
  resume(): void {
    if (this.executionState.status === 'paused') {
      this.executionState.status = 'running';
      this.updateActivity();
      this.logger.info('Plugin execution resumed');
    }
  }

  /**
   * Private: Load plugin code from disk
   */
  private async loadPluginCode(): Promise<void> {
    const mainEntrypoint = this.manifest.entrypoints.find(ep => ep.type === 'main');
    if (!mainEntrypoint) {
      throw new Error('No main entrypoint found in plugin manifest');
    }

    const pluginDir = path.join(
      process.cwd(),
      'plugins',
      this.installation.pluginId,
      this.installation.version
    );
    const entryFile = path.join(pluginDir, mainEntrypoint.file);

    try {
      this.pluginCode = await fs.readFile(entryFile, 'utf-8');
      this.logger.debug(`Loaded plugin code from ${entryFile}`);
    } catch (error) {
      this.logger.error(`Failed to load plugin code from ${entryFile}`, error);
      throw new Error(`Failed to load plugin main file: ${mainEntrypoint.file}`);
    }
  }

  /**
   * Private: Create secure execution environment
   */
  private async createExecutionEnvironment(): Promise<void> {
    // Create sandboxed VM context
    this.vmContext = vm.createContext({
      // Provide safe globals
      console: this.createSafeConsole(),
      setTimeout: this.createSafeSetTimeout(),
      setInterval: this.createSafeSetInterval(),
      clearTimeout: (id: NodeJS.Timeout) => {
        clearTimeout(id);
        this.executionTimeouts.delete(id);
      },
      clearInterval: (id: NodeJS.Timeout) => {
        clearInterval(id);
        this.executionTimeouts.delete(id);
      },
      
      // Plugin API
      FlowDeskAPI: this.runtimeContext.api,
      
      // Plugin metadata
      PluginManifest: this.manifest,
      PluginConfig: this.installation.config,
      
      // Event system
      addEventListener: this.createEventListener(),
      removeEventListener: this.createEventRemover(),
      
      // Global plugin registration
      registerAction: this.createActionRegistrar(),
      
      // Restricted globals (no direct access to Node.js or Electron APIs)
      process: {
        env: {},
        platform: process.platform,
        arch: process.arch,
        versions: {
          node: process.versions.node,
          electron: process.versions.electron
        }
      }
    });

    // Create browser view for UI plugins
    if (this.manifest.type === 'panel' || this.manifest.type === 'view') {
      await this.createBrowserView();
    }
  }

  /**
   * Private: Execute plugin initialization
   */
  private async executePluginInit(): Promise<void> {
    if (!this.pluginCode || !this.vmContext) {
      throw new Error('Plugin execution environment not ready');
    }

    try {
      // Execute plugin code in sandboxed context
      const script = new vm.Script(this.pluginCode, {
        filename: `${this.installation.pluginId}-main.js`
      });

      await script.runInContext(this.vmContext, {
        timeout: this.sandboxConfig.timeoutMs,
        breakOnSigint: true
      });

      // Call plugin init function if available
      const initFn = (this.vmContext as any).initialize;
      if (typeof initFn === 'function') {
        await this.executeWithTimeout(
          () => initFn.call(this.vmContext, this.runtimeContext),
          this.sandboxConfig.timeoutMs
        );
      }

      this.logger.debug('Plugin code executed successfully');
    } catch (error) {
      this.logger.error('Failed to execute plugin code', error);
      throw error;
    }
  }

  /**
   * Private: Execute plugin cleanup
   */
  private async executePluginCleanup(): Promise<void> {
    if (!this.vmContext) return;

    const cleanupFn = (this.vmContext as any).cleanup;
    if (typeof cleanupFn === 'function') {
      await this.executeWithTimeout(
        () => cleanupFn.call(this.vmContext),
        5000 // 5 second timeout for cleanup
      );
    }
  }

  /**
   * Private: Create browser view for UI plugins
   */
  private async createBrowserView(): Promise<void> {
    this.browserView = new BrowserView({
      webPreferences: {
        session: this.sandboxSession,
        nodeIntegration: false,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        webSecurity: true,
        sandbox: true,
        preload: path.join(__dirname, '..', 'preload', 'plugin-preload.js')
      }
    });

    // Setup communication channel
    const webContents = this.browserView.webContents;
    
    webContents.on('dom-ready', () => {
      this.logger.debug('Plugin UI DOM ready');
    });

    (webContents as any).on('crashed', () => {
      this.logger.error('Plugin UI crashed');
      this.executionState.status = 'error';
      this.executionState.errorCount++;
    });
  }

  /**
   * Private: Create safe console object
   */
  private createSafeConsole(): Console {
    return {
      log: (...args) => this.logger.info(args.join(' ')),
      info: (...args) => this.logger.info(args.join(' ')),
      warn: (...args) => this.logger.warn(args.join(' ')),
      error: (...args) => this.logger.error(args.join(' ')),
      debug: (...args) => this.logger.debug(args.join(' ')),
      trace: (...args) => this.logger.debug(args.join(' ')),
      // Disable other console methods for security
      assert: () => {},
      clear: () => {},
      count: () => {},
      countReset: () => {},
      dir: () => {},
      dirxml: () => {},
      group: () => {},
      groupCollapsed: () => {},
      groupEnd: () => {},
      table: () => {},
      time: () => {},
      timeEnd: () => {},
      timeLog: () => {},
      profile: () => {},
      profileEnd: () => {}
    } as Console;
  }

  /**
   * Private: Create safe setTimeout
   */
  private createSafeSetTimeout(): any {
    return (callback: Function, ms: number = 0): NodeJS.Timeout => {
      const timeout = setTimeout(() => {
        this.executionTimeouts.delete(timeout);
        try {
          callback();
        } catch (error) {
          this.logger.error('Error in setTimeout callback', error);
        }
      }, Math.min(ms, this.sandboxConfig.timeoutMs));
      
      this.executionTimeouts.add(timeout);
      return timeout;
    };
  }

  /**
   * Private: Create safe setInterval
   */
  private createSafeSetInterval(): any {
    return (callback: Function, ms: number = 0): NodeJS.Timeout => {
      const interval = setInterval(() => {
        try {
          callback();
        } catch (error) {
          this.logger.error('Error in setInterval callback', error);
          clearInterval(interval);
          this.executionTimeouts.delete(interval);
        }
      }, Math.max(ms, 100)); // Minimum 100ms interval
      
      this.executionTimeouts.add(interval);
      return interval;
    };
  }

  /**
   * Private: Create event listener
   */
  private createEventListener(): (event: string, callback: Function) => void {
    return (event: string, callback: Function) => {
      this.on(event, callback as (...args: any[]) => void);
    };
  }

  /**
   * Private: Create event remover
   */
  private createEventRemover(): (event: string, callback: Function) => void {
    return (event: string, callback: Function) => {
      this.off(event, callback as (...args: any[]) => void);
    };
  }

  /**
   * Private: Create action registrar
   */
  private createActionRegistrar(): (action: string, handler: Function) => void {
    return (action: string, handler: Function) => {
      if (typeof handler !== 'function') {
        throw new Error('Action handler must be a function');
      }
      this.actionHandlers.set(action, handler);
      this.logger.debug(`Registered action: ${action}`);
    };
  }

  /**
   * Private: Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve()
        .then(() => fn())
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Private: Update last activity timestamp
   */
  private updateActivity(): void {
    this.executionState.lastActivity = new Date();
  }
}