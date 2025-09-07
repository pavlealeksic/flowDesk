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
    // Initialize security configuration first
    try {
      await securityConfig.initialize();
      securityConfig.configureProtocolSecurity();
      this.logger.info('Security configuration initialized');
    } catch (error) {
      this.logger.error('Failed to initialize security', error as Error);
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
      // Set up additional security headers after app is ready
      securityConfig.setSecurityHeaders();
      
      this.createMainWindow();
      this.setupIpcHandlers();
      this.setupMenu();
      
      // Start periodic cleanup of rate limits
      setInterval(() => {
        securityConfig.clearExpiredRateLimits();
      }, 60000); // Clean up every minute
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

  private createMainWindow(): void {
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

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWebContents.webContents.loadURL('http://localhost:5173');
      this.mainWebContents.webContents.openDevTools();
    } else {
      this.mainWebContents.webContents.loadFile(join(__dirname, '../renderer/index.html'));
    }

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
  }

  private setupIpcHandlers(): void {
    // Helper function to create user-friendly error responses
    const createIpcError = (code: string, message: string, canRetry: boolean = true, details?: string) => ({
      code,
      userMessage: message,
      canRetry,
      details,
      isIpcError: true
    });

    // Helper function to handle IPC operations with user-friendly error handling
    const handleIpcOperation = async <T>(
      operation: () => Promise<T>,
      context: {
        operationName: string;
        successCode?: string;
        failureCode: string;
        failureMessage: string;
        canRetry?: boolean;
      }
    ): Promise<T> => {
      try {
        const result = await operation();
        if (context.successCode) {
          this.logger.info(context.operationName + ' succeeded');
        }
        return result;
      } catch (error) {
        this.logger.error(context.operationName + ' failed', error as Error);
        
        // Create user-friendly error based on the original error
        let userMessage = context.failureMessage;
        let details = '';
        let canRetry = context.canRetry !== false;
        
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          details = error.message;
          
          // Customize message based on error type
          if (errorMsg.includes('permission') || errorMsg.includes('access denied')) {
            userMessage = 'Permission denied. Please check your access rights and try again.';
            canRetry = false;
          } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
            userMessage = 'Network error. Please check your connection and try again.';
          } else if (errorMsg.includes('not found') || errorMsg.includes('enoent')) {
            userMessage = 'The requested item was not found.';
            canRetry = false;
          } else if (errorMsg.includes('already exists')) {
            userMessage = 'An item with this name already exists. Please choose a different name.';
            canRetry = false;
          } else if (errorMsg.includes('invalid') || errorMsg.includes('malformed')) {
            userMessage = 'Invalid data provided. Please check your input and try again.';
            canRetry = false;
          }
        }
        
        throw createIpcError(context.failureCode, userMessage, canRetry, details);
      }
    };

    // Workspace Management
    ipcMain.handle('workspace:create', async (event, workspaceData: any) => {
      return handleIpcOperation(
        () => this.workspaceManager.createWorkspace(workspaceData).then(workspace => workspace.id),
        {
          operationName: 'Create workspace',
          failureCode: 'WORKSPACE_CREATION_FAILED',
          failureMessage: 'Failed to create workspace. Please try a different name or try again later.',
        }
      );
    });

    ipcMain.handle('workspace:list', async () => {
      return handleIpcOperation(
        () => this.workspaceManager.getWorkspaces(),
        {
          operationName: 'List workspaces',
          failureCode: 'WORKSPACE_LOAD_FAILED',
          failureMessage: 'Failed to load workspaces. Please restart the application.',
        }
      );
    });

    ipcMain.handle('workspace:get-all', async () => {
      return handleIpcOperation(
        () => this.workspaceManager.getWorkspaces(),
        {
          operationName: 'Get all workspaces',
          failureCode: 'WORKSPACE_LOAD_FAILED',
          failureMessage: 'Failed to load workspaces. Please restart the application.',
        }
      );
    });

    ipcMain.handle('workspace:get-active', async () => {
      return handleIpcOperation(
        async () => {
          const workspaces = await this.workspaceManager.getWorkspaces();
          return workspaces.find(w => w.isActive) || null;
        },
        {
          operationName: 'Get active workspace',
          failureCode: 'WORKSPACE_LOAD_FAILED',
          failureMessage: 'Failed to get active workspace. Please try again.',
        }
      );
    });

    ipcMain.handle('workspace:list-partitions', async () => {
      return handleIpcOperation(
        () => Promise.resolve([]),
        {
          operationName: 'List partitions',
          failureCode: 'WORKSPACE_LOAD_FAILED',
          failureMessage: 'Failed to load partition information.',
        }
      );
    });

    ipcMain.handle('settings:get', async () => {
      return handleIpcOperation(
        () => Promise.resolve({
          theme: 'system',
          fontSize: 14,
          accentColor: '#007acc'
        }),
        {
          operationName: 'Get settings',
          failureCode: 'SETTINGS_LOAD_FAILED',
          failureMessage: 'Failed to load application settings.',
        }
      );
    });

    ipcMain.handle('workspace:get', async (event, workspaceId: string) => {
      return handleIpcOperation(
        () => this.workspaceManager.getWorkspace(workspaceId),
        {
          operationName: `Get workspace ${workspaceId}`,
          failureCode: 'WORKSPACE_NOT_FOUND',
          failureMessage: 'The requested workspace could not be found.',
          canRetry: false
        }
      );
    });

    ipcMain.handle('workspace:delete', async (event, workspaceId: string) => {
      return handleIpcOperation(
        () => this.workspaceManager.deleteWorkspace(workspaceId),
        {
          operationName: `Delete workspace ${workspaceId}`,
          failureCode: 'WORKSPACE_DELETION_FAILED',
          failureMessage: 'Failed to delete workspace. It might still be in use.',
        }
      );
    });

    ipcMain.handle('workspace:addService', async (event, workspaceId: string, name: string, type: string, url: string) => {
      return handleIpcOperation(
        async () => {
          const serviceId = await this.workspaceManager.createService(workspaceId, name, type, url);
          this.logger.info('Service added to workspace', { workspaceId, serviceId }, { name, type, url });
          return serviceId;
        },
        {
          operationName: `Add service ${name}`,
          failureCode: 'SERVICE_CREATION_FAILED',
          failureMessage: 'Failed to add service. Please check the URL and try again.',
        }
      );
    });

    ipcMain.handle('workspace:removeService', async (event, workspaceId: string, serviceId: string) => {
      return handleIpcOperation(
        () => this.workspaceManager.deleteService(workspaceId, serviceId),
        {
          operationName: `Remove service ${serviceId}`,
          failureCode: 'SERVICE_DELETE_FAILED',
          failureMessage: 'Failed to remove service from workspace.',
        }
      );
    });

    ipcMain.handle('workspace:loadService', async (event, workspaceId: string, serviceId: string) => {
      return handleIpcOperation(
        () => this.workspaceManager.loadService(workspaceId, serviceId),
        {
          operationName: `Load service ${serviceId}`,
          failureCode: 'SERVICE_LOAD_FAILED',
          failureMessage: 'Failed to load service. Please check your connection and try again.',
        }
      );
    });

    ipcMain.handle('workspace:switch', async (event, workspaceId: string) => {
      return handleIpcOperation(
        async () => {
          await this.workspaceManager.switchWorkspace(workspaceId);
          this.logger.userAction('workspace-switch', { workspaceId });
        },
        {
          operationName: `Switch to workspace ${workspaceId}`,
          failureCode: 'WORKSPACE_SWITCH_FAILED',
          failureMessage: 'Failed to switch workspace. Please try selecting it again.',
        }
      );
    });

    ipcMain.handle('workspace:update', async (event, workspaceId: string, updates: Partial<Workspace>) => {
      return handleIpcOperation(
        async () => {
          await this.workspaceManager.updateWorkspace(workspaceId, updates);
          this.logger.info('Workspace updated', { workspaceId }, { updates });
        },
        {
          operationName: `Update workspace ${workspaceId}`,
          failureCode: 'WORKSPACE_UPDATE_FAILED',
          failureMessage: 'Failed to save workspace changes. Please try again.',
        }
      );
    });

    ipcMain.handle('workspace:create-partition', async (event, config: Record<string, unknown>) => {
      return handleIpcOperation(
        () => {
          this.logger.info('Partition configuration updated', undefined, { config });
          return Promise.resolve();
        },
        {
          operationName: 'Create partition',
          failureCode: 'PARTITION_CREATION_FAILED',
          failureMessage: 'Failed to create partition configuration.',
        }
      );
    });

    ipcMain.handle('workspace:update-partition', async (event, workspaceId: string, updates: Record<string, unknown>) => {
      return handleIpcOperation(
        () => {
          this.logger.info('Partition updated for workspace', { workspaceId }, { updates });
          return Promise.resolve();
        },
        {
          operationName: `Update partition for workspace ${workspaceId}`,
          failureCode: 'PARTITION_UPDATE_FAILED',
          failureMessage: 'Failed to update partition settings.',
        }
      );
    });

    ipcMain.handle('workspace:clear-data', async (event, workspaceId: string) => {
      return handleIpcOperation(
        () => this.workspaceManager.clearWorkspaceData(workspaceId),
        {
          operationName: `Clear data for workspace ${workspaceId}`,
          failureCode: 'WORKSPACE_CLEAR_FAILED',
          failureMessage: 'Failed to clear workspace data.',
        }
      );
    });

    ipcMain.handle('workspace:get-windows', async (event, workspaceId: string) => {
      return handleIpcOperation(
        () => Promise.resolve([]),
        {
          operationName: `Get windows for workspace ${workspaceId}`,
          failureCode: 'WORKSPACE_WINDOWS_FAILED',
          failureMessage: 'Failed to get workspace windows.',
        }
      );
    });

    ipcMain.handle('workspace:create-window', async (event, options: Record<string, unknown>) => {
      return handleIpcOperation(
        () => Promise.resolve(Math.floor(Math.random() * 1000000)),
        {
          operationName: 'Create window',
          failureCode: 'WINDOW_CREATION_FAILED',
          failureMessage: 'Failed to create new window.',
        }
      );
    });

    // Browser view visibility control
    ipcMain.handle('browser-view:hide', async () => {
      return handleIpcOperation(
        () => {
          this.workspaceManager.hideBrowserView();
          return Promise.resolve();
        },
        {
          operationName: 'Hide browser view',
          failureCode: 'BROWSER_VIEW_FAILED',
          failureMessage: 'Failed to hide browser view.',
        }
      );
    });

    ipcMain.handle('browser-view:show', async () => {
      return handleIpcOperation(
        () => {
          this.workspaceManager.showBrowserView();
          return Promise.resolve();
        },
        {
          operationName: 'Show browser view',
          failureCode: 'BROWSER_VIEW_FAILED',
          failureMessage: 'Failed to show browser view.',
        }
      );
    });

    // Theme Management
    ipcMain.handle('theme:get', () => {
      return {
        theme: 'system',
        accentColor: '#007acc',
        fontSize: 14
      };
    });

    ipcMain.handle('theme:set', (event, themeData: Record<string, unknown>) => {
      // Store theme preferences
      this.logger.info('Theme updated', undefined, { themeData });
    });

    // System Integration
    ipcMain.handle('system:showNotification', (event, options: { title: string; body?: string; icon?: string; silent?: boolean }) => {
      // Ensure body is always a string for the notification manager
      this.notificationManager.showNotification({
        ...options,
        body: options.body || ''
      });
    });

    ipcMain.handle('system:showDialog', async (event, options: Record<string, unknown>) => {
      // Ensure required message property exists
      const dialogOptions = {
        message: typeof options.message === 'string' ? options.message : 'Dialog',
        ...options
      } as Electron.MessageBoxOptions;
      const result = await dialog.showMessageBox(this.mainWindow!, dialogOptions);
      return result;
    });

    ipcMain.handle('system:openExternal', (event, url: string) => {
      shell.openExternal(url);
    });
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

// Initialize the application
new FlowDeskApp();

// Log application startup completion
app.whenReady().then(() => {
  mainLogger.info('Flow Desk application ready');
});