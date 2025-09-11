/**
 * Flow Desk Main Process - Workspace-Only Implementation
 * 
 * Focused only on workspace management with browser views
 */

import { app, BaseWindow, WebContentsView, ipcMain, Menu, systemPreferences, dialog, shell } from 'electron';
import { join } from 'path';
import log from 'electron-log';
import { WorkspaceManager } from './workspace';
import { DesktopNotificationManager } from './notification-manager';
import { securityConfig } from './security-config';
import { mainLoggingService, mainLogger } from './logging/LoggingService';
import { configManager } from './config/AppConfig';
import { 
  errorManager, 
  ipcErrorHandler, 
  ErrorFactory, 
  retryHandler,
  safeFileOperation,
  safeNetworkRequest,
  withErrorHandling 
} from './error-handling';

// Import type interfaces
import type { Workspace } from './workspace';

// Configure legacy electron-log (for backwards compatibility)
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

class FlowDeskApp {
  private mainWindow: BaseWindow | null = null;
  private mainWebContents: WebContentsView | null = null;
  private workspaceManager: WorkspaceManager;
  private notificationManager: DesktopNotificationManager;
  private logger = mainLoggingService.createLogger('FlowDeskApp');

  constructor() {
    this.workspaceManager = new WorkspaceManager();
    this.notificationManager = new DesktopNotificationManager();
    
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    // Initialize error handling first
    try {
      this.logger.info('Initializing error handling system');
      
      // Initialize error manager
      errorManager.on('error', (error) => {
        this.logger.error('Error manager caught error:', error);
      });

      // Initialize retry handler
      retryHandler.on('retry', (event) => {
        this.logger.debug('Retry event:', event);
      });

      this.logger.info('Error handling system initialized');
    } catch (error) {
      this.logger.error('Failed to initialize error handling', error as Error);
      if (process.env.NODE_ENV === 'production') {
        app.quit();
        return;
      }
    }

    // Initialize configuration manager
    try {
      const config = configManager.getConfig();
      this.logger.info('Configuration manager initialized', {
        environment: config.environment,
        maxWebContentsViews: config.memory.maxWebContentsViews,
        enableMemoryMonitoring: config.memory.enableMemoryMonitoring,
        enableDevTools: config.development.enableDevTools
      });

      // Validate configuration
      const validation = configManager.validateConfig();
      if (!validation.isValid) {
        const configError = ErrorFactory.configLoadFailed(
          `Configuration validation failed: ${validation.errors?.join(', ') || 'Unknown errors'}`
        );
        errorManager.handleError(configError);
        
        if (process.env.NODE_ENV === 'production') {
          app.quit();
          return;
        }
      }
    } catch (error) {
      const configError = ErrorFactory.configLoadFailed(
        error instanceof Error ? error.message : String(error)
      );
      errorManager.handleError(configError);
      
      if (process.env.NODE_ENV === 'production') {
        app.quit();
        return;
      }
    }

    // Initialize security configuration
    try {
      await securityConfig.initialize();
      securityConfig.configureProtocolSecurity();
      this.logger.info('Security configuration initialized');
    } catch (error) {
      const securityError = ErrorFactory.securityViolation(
        `Failed to initialize security: ${error instanceof Error ? error.message : String(error)}`
      );
      errorManager.handleError(securityError);
      
      // In production, fail fast if security cannot be initialized
      if (process.env.NODE_ENV === 'production') {
        app.quit();
        return;
      }
    }

    // Configure app security
    app.setAboutPanelOptions({
      applicationName: 'Flow Desk',
      applicationVersion: app.getVersion(),
      version: app.getVersion(),
      copyright: '© 2024 Flow Desk'
    });

    // Handle app events
    app.whenReady().then(async () => {
      try {
        // Set up additional security headers after app is ready
        securityConfig.setSecurityHeaders();
        
        await this.createMainWindow();
        this.setupIpcHandlers();
        this.setupMenu();
        
        // Start periodic cleanup of rate limits
        setInterval(() => {
          securityConfig.clearExpiredRateLimits();
        }, 60000); // Clean up every minute
        
        this.logger.info('Application ready successfully');
      } catch (error) {
        const appError = ErrorFactory.unknownError(
          `Failed to initialize application: ${error instanceof Error ? error.message : String(error)}`,
          'app.whenReady'
        );
        errorManager.handleError(appError);
        
        // In production, we might want to exit if initialization fails
        if (process.env.NODE_ENV === 'production') {
          app.quit();
        }
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BaseWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
    });
  }

  private async createMainWindow(): Promise<void> {
    try {
      // Create BaseWindow for the main application window
      this.mainWindow = new BaseWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        show: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
      });

      // Create WebContentsView for the React app
      this.mainWebContents = new WebContentsView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: join(__dirname, '../preload/preload.js'),
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false
        }
      });

      // Add the main WebContentsView to the BaseWindow
      this.mainWindow.contentView.addChildView(this.mainWebContents);

      // Position the main WebContentsView to fill the entire window
      const bounds = this.mainWindow.getBounds();
      this.mainWebContents.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });

      // Load the renderer with error handling
      await this.loadRenderer();

      this.mainWebContents.webContents.once('dom-ready', () => {
        this.mainWindow?.show();
      });

      // Handle window resize for main WebContentsView
      this.mainWindow.on('resized', () => {
        if (this.mainWebContents && this.mainWindow) {
          const bounds = this.mainWindow.getBounds();
          this.mainWebContents.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
        }
      });

      this.mainWindow.on('closed', () => {
        this.mainWindow = null;
        this.mainWebContents = null;
      });

      // Initialize workspace manager with main window
      if (this.mainWindow) {
        this.workspaceManager.setMainWindow(this.mainWindow);
      }

      this.logger.info('Main window created successfully');
    } catch (error) {
      const windowError = ErrorFactory.unknownError(
        `Failed to create main window: ${error instanceof Error ? error.message : String(error)}`,
        'createMainWindow'
      );
      errorManager.handleError(windowError);
      throw windowError;
    }
  }

  private async loadRenderer(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        await this.mainWebContents!.webContents.loadURL('http://localhost:5173');
        this.mainWebContents!.webContents.openDevTools();
      } else {
        await this.mainWebContents!.webContents.loadFile(join(__dirname, '../renderer/index.html'));
      }
      this.logger.info('Renderer loaded successfully');
    } catch (error) {
      const loadError = ErrorFactory.networkUnreachable(
        'Failed to load renderer',
        error instanceof Error ? error : undefined
      );
      errorManager.handleError(loadError);
      throw loadError;
    }
  }

  private setupIpcHandlers(): void {
    // Workspace Management
    ipcErrorHandler.registerOperation(
      'workspace:create',
      async (event, workspaceData: any) => {
        const workspace = await this.workspaceManager.createWorkspace(workspaceData);
        this.logger.info('Workspace created successfully', { workspaceId: workspace.id });
        return workspace.id;
      },
      {
        operationName: 'Create workspace',
        timeoutMs: 10000,
        retryStrategy: {
          maxAttempts: 2,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitterRange: 0.1,
          retryableErrors: [],
          nonRetryableErrors: []
        }
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:list',
      async () => {
        const workspaces = await this.workspaceManager.getWorkspaces();
        this.logger.debug('Workspaces listed successfully', { count: workspaces.length });
        return workspaces;
      },
      {
        operationName: 'List workspaces',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:get-all',
      async () => {
        return this.workspaceManager.getWorkspaces();
      },
      {
        operationName: 'Get all workspaces',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:get-active',
      async () => {
        const workspaces = await this.workspaceManager.getWorkspaces();
        return workspaces.find(w => w.isActive) || null;
      },
      {
        operationName: 'Get active workspace',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:get',
      async (event, workspaceId: string) => {
        const workspace = await this.workspaceManager.getWorkspace(workspaceId);
        if (!workspace) {
          throw new Error(`Workspace ${workspaceId} not found`);
        }
        return workspace;
      },
      {
        operationName: 'Get workspace',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:delete',
      async (event, workspaceId: string) => {
        await this.workspaceManager.deleteWorkspace(workspaceId);
        this.logger.info('Workspace deleted successfully', { workspaceId });
        return true;
      },
      {
        operationName: 'Delete workspace',
        timeoutMs: 15000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:addService',
      async (event, workspaceId: string, name: string, type: string, url: string) => {
        const serviceId = await this.workspaceManager.createService(workspaceId, name, type, url);
        this.logger.info('Service added to workspace', { workspaceId, serviceId }, { name, type, url });
        return serviceId;
      },
      {
        operationName: 'Add service',
        timeoutMs: 15000,
        sanitizeInput: true
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:removeService',
      async (event, workspaceId: string, serviceId: string) => {
        await this.workspaceManager.deleteService(workspaceId, serviceId);
        this.logger.info('Service removed from workspace', { workspaceId, serviceId });
        return true;
      },
      {
        operationName: 'Remove service',
        timeoutMs: 10000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:loadService',
      async (event, workspaceId: string, serviceId: string) => {
        await this.workspaceManager.loadService(workspaceId, serviceId);
        this.logger.info('Service loaded successfully', { workspaceId, serviceId });
        return true;
      },
      {
        operationName: 'Load service',
        timeoutMs: 30000,
        retryStrategy: {
          maxAttempts: 3,
          baseDelay: 2000,
          maxDelay: 15000,
          backoffMultiplier: 2,
          jitterRange: 0.2,
          retryableErrors: [],
          nonRetryableErrors: []
        }
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:switch',
      async (event, workspaceId: string) => {
        await this.workspaceManager.switchWorkspace(workspaceId);
        this.logger.userAction('workspace-switch', { workspaceId });
        return true;
      },
      {
        operationName: 'Switch workspace',
        timeoutMs: 10000
      }
    );

    ipcErrorHandler.registerOperation(
      'workspace:update',
      async (event, workspaceId: string, updates: Partial<Workspace>) => {
        await this.workspaceManager.updateWorkspace(workspaceId, updates);
        this.logger.info('Workspace updated', { workspaceId }, { updates });
        return true;
      },
      {
        operationName: 'Update workspace',
        timeoutMs: 10000,
        sanitizeInput: true
      }
    );

    // Browser view visibility control
    ipcErrorHandler.registerOperation(
      'browser-view:hide',
      async () => {
        this.workspaceManager.hideBrowserView();
        return true;
      },
      {
        operationName: 'Hide browser view',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'browser-view:show',
      async () => {
        this.workspaceManager.showBrowserView();
        return true;
      },
      {
        operationName: 'Show browser view',
        timeoutMs: 5000
      }
    );

    // System Integration
    ipcErrorHandler.registerOperation(
      'system:showNotification',
      async (event, options: { title: string; body?: string; icon?: string; silent?: boolean }) => {
        this.notificationManager.showNotification({
          ...options,
          body: options.body || ''
        });
        return true;
      },
      {
        operationName: 'Show notification',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'system:showDialog',
      async (event, options: Record<string, unknown>) => {
        const dialogOptions = {
          message: typeof options.message === 'string' ? options.message : 'Dialog',
          ...options
        } as Electron.MessageBoxOptions;
        const result = await dialog.showMessageBox(this.mainWindow!, dialogOptions);
        return result;
      },
      {
        operationName: 'Show dialog',
        timeoutMs: 10000
      }
    );

    ipcErrorHandler.registerOperation(
      'system:openExternal',
      async (event, url: string) => {
        shell.openExternal(url);
        return true;
      },
      {
        operationName: 'Open external URL',
        timeoutMs: 5000,
        sanitizeInput: true
      }
    );

    // Configuration Management
    ipcErrorHandler.registerOperation(
      'config:get',
      async () => {
        return configManager.getConfig();
      },
      {
        operationName: 'Get configuration',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'config:validate',
      async () => {
        const validation = configManager.validateConfig();
        return { isValid: validation.isValid, errors: validation.errors || [] };
      },
      {
        operationName: 'Validate configuration',
        timeoutMs: 5000
      }
    );

    ipcErrorHandler.registerOperation(
      'config:update',
      async (event, updates: Record<string, unknown>) => {
        await configManager.updateConfig(updates as any);
        this.logger.info('Configuration updated', { updates });
        return true;
      },
      {
        operationName: 'Update configuration',
        timeoutMs: 10000,
        sanitizeInput: true
      }
    );

    ipcErrorHandler.registerOperation(
      'config:reload',
      async () => {
        const success = configManager.reloadConfig();
        return { success };
      },
      {
        operationName: 'Reload configuration',
        timeoutMs: 10000
      }
    );

    // Legacy handlers for backward compatibility
    ipcMain.handle('workspace:list-partitions', async () => {
      return [];
    });

    ipcMain.handle('settings:get', async () => {
      return {
        theme: 'system',
        fontSize: 14,
        accentColor: '#007acc'
      };
    });

    ipcMain.handle('theme:get', () => {
      return {
        theme: 'system',
        accentColor: '#007acc',
        fontSize: 14
      };
    });

    ipcMain.handle('theme:set', (event, themeData: Record<string, unknown>) => {
      this.logger.info('Theme updated', undefined, { themeData });
    });

    // Additional utility handlers
    ipcMain.handle('workspace:create-partition', async (event, config: Record<string, unknown>) => {
      this.logger.info('Partition configuration updated', undefined, { config });
      return true;
    });

    ipcMain.handle('workspace:update-partition', async (event, workspaceId: string, updates: Record<string, unknown>) => {
      this.logger.info('Partition updated for workspace', { workspaceId }, { updates });
      return true;
    });

    ipcMain.handle('workspace:clear-data', async (event, workspaceId: string) => {
      await this.workspaceManager.clearWorkspaceData(workspaceId);
      return true;
    });

    ipcMain.handle('workspace:get-windows', async (event, workspaceId: string) => {
      return [];
    });

    ipcMain.handle('workspace:create-window', async (event, options: Record<string, unknown>) => {
      return Math.floor(Math.random() * 1000000);
    });

    // Memory and performance handlers
    ipcMain.handle('memory:getStats', async () => {
      return {
        threshold: configManager.getMemoryConfig().memoryThresholdMB,
        maxWebContentsViews: configManager.getMemoryConfig().maxWebContentsViews,
        enableAutoCleanup: configManager.getMemoryConfig().enableAutoCleanup,
        enableMemoryMonitoring: configManager.getMemoryConfig().enableMemoryMonitoring,
        interval: configManager.getMemoryConfig().memoryMonitorInterval
      };
    });

    ipcMain.handle('memory:update', async (event, updates: Record<string, unknown>) => {
      await configManager.updateConfig({ memory: updates } as any);
      return true;
    });

    ipcMain.handle('performance:getConfig', async () => {
      return configManager.getPerformanceConfig();
    });

    ipcMain.handle('performance:enable', async (event, enabled: boolean) => {
      await configManager.updateConfig({ performance: { enabled } } as any);
      return true;
    });

    ipcMain.handle('development:getConfig', async () => {
      return configManager.getDevelopmentConfig();
    });

    ipcMain.handle('development:toggleDevTools', async () => {
      const config = configManager.getDevelopmentConfig();
      await configManager.updateConfig({ development: { enableDevTools: !config.enableDevTools } } as any);
      return true;
    });

    ipcMain.handle('error-handling:getConfig', async () => {
      return configManager.getErrorHandlingConfig();
    });

    ipcMain.handle('error-handling:update', async (event, updates: Record<string, unknown>) => {
      await configManager.updateConfig({ errorHandling: updates } as any);
      return true;
    });

    this.logger.info('IPC handlers registered successfully');
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Workspace',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWebContents?.webContents.send('menu:newWorkspace');
            }
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' as const }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });

      // Window menu
      template[4].submenu = [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

// Initialize the logging service first
mainLogger.info('Starting Flow Desk application', { version: app.getVersion(), platform: process.platform });

// Initialize the application with error handling
try {
  new FlowDeskApp();
  
  // Log application startup completion
  app.whenReady().then(() => {
    mainLogger.info('Flow Desk application ready');
  }).catch((error) => {
    mainLogger.error('Failed to start application:', error);
    if (process.env.NODE_ENV === 'production') {
      app.quit();
    }
  });
} catch (error) {
  mainLogger.error('Failed to initialize application:', error as Error);
  if (process.env.NODE_ENV === 'production') {
    app.quit();
  }
}