/**
 * Comprehensive unit tests for main.ts - Flow Desk Main Process
 * Tests application initialization, IPC handlers, and main window management
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';

// Mock modules before importing
const mockApp = {
  quit: jest.fn(),
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  setAboutPanelOptions: jest.fn(),
  whenReady: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  getName: jest.fn().mockReturnValue('Flow Desk')
};

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  show: jest.fn(),
  once: jest.fn(),
  on: jest.fn(),
  webContents: {
    openDevTools: jest.fn(),
    send: jest.fn(),
    on: jest.fn()
  }
}));

mockBrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);

const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockDialog = {
  showMessageBox: jest.fn().mockResolvedValue({ response: 0, checkboxChecked: false }),
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: undefined })
};

const mockShell = {
  openExternal: jest.fn().mockResolvedValue(undefined)
};

const mockMenu = {
  buildFromTemplate: jest.fn().mockReturnValue({}),
  setApplicationMenu: jest.fn()
};

const mockSystemPreferences = {
  isDarkMode: jest.fn().mockReturnValue(false)
};

const mockWorkspaceManager = {
  setMainWindow: jest.fn(),
  createWorkspace: jest.fn().mockResolvedValue({ id: 'test-workspace' }),
  getWorkspaces: jest.fn().mockResolvedValue([]),
  getWorkspace: jest.fn().mockResolvedValue(null),
  deleteWorkspace: jest.fn().mockResolvedValue(undefined),
  createService: jest.fn().mockResolvedValue('test-service-id'),
  deleteService: jest.fn().mockResolvedValue(undefined),
  loadService: jest.fn().mockResolvedValue(undefined),
  switchWorkspace: jest.fn().mockResolvedValue(undefined),
  updateWorkspace: jest.fn().mockResolvedValue(undefined),
  clearWorkspaceData: jest.fn().mockResolvedValue(undefined),
  hideBrowserView: jest.fn(),
  showBrowserView: jest.fn()
};

const mockNotificationManager = {
  showNotification: jest.fn()
};

const mockSecurityConfig = {
  initialize: jest.fn().mockResolvedValue(undefined),
  configureProtocolSecurity: jest.fn(),
  setSecurityHeaders: jest.fn(),
  clearExpiredRateLimits: jest.fn()
};

const mockMainLoggingService = {
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    userAction: jest.fn()
  })
};

const mockMainLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockConfigManager = {
  getConfig: jest.fn().mockReturnValue({
    environment: 'development',
    memory: {
      maxWebContentsViews: 10,
      memoryThresholdMB: 500,
      memoryMonitorInterval: 30000,
      inactiveCleanupDelay: 1800000,
      enableAutoCleanup: true,
      enableMemoryMonitoring: true
    },
    performance: {
      enabled: true,
      samplingRate: 0.1,
      metricsInterval: 10000,
      enableReactProfiler: false,
      enableBundleAnalysis: false,
      maxPerformanceEntries: 1000
    },
    errorHandling: {
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 30000,
      enableErrorReporting: false
    },
    workspace: {
      maxWorkspaces: 20,
      maxServicesPerWorkspace: 15,
      defaultBrowserIsolation: 'shared',
      enablePreloading: true,
      maxPreloadServices: 5,
      autoSaveInterval: 30000
    },
    security: {
      httpsOnly: false,
      maxUrlLength: 2000,
      allowedProtocols: ['https:', 'http:'],
      enableCSP: true,
      enableIframeSandbox: true,
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 100,
        windowSizeMs: 60000
      }
    },
    development: {
      enableDevTools: false,
      enableHotReload: false,
      enableDebugLogging: false,
      mockExternalServices: false,
      devServerPort: 5173
    },
    dataDirectory: 'data',
    logging: {
      level: 'info',
      enableFileLogging: true,
      maxLogFiles: 5,
      maxLogSizeMB: 10
    }
  }),
  validateConfig: jest.fn().mockReturnValue({ isValid: true }),
  getMemoryConfig: jest.fn().mockReturnValue({
    maxWebContentsViews: 10,
    memoryThresholdMB: 500,
    memoryMonitorInterval: 30000,
    inactiveCleanupDelay: 1800000,
    enableAutoCleanup: true,
    enableMemoryMonitoring: true
  }),
  getWorkspaceConfig: jest.fn().mockReturnValue({
    maxWorkspaces: 20,
    maxServicesPerWorkspace: 15,
    defaultBrowserIsolation: 'shared',
    enablePreloading: true,
    maxPreloadServices: 5,
    autoSaveInterval: 30000
  }),
  getSecurityConfig: jest.fn().mockReturnValue({
    httpsOnly: false,
    maxUrlLength: 2000,
    allowedProtocols: ['https:', 'http:'],
    enableCSP: true,
    enableIframeSandbox: true,
    rateLimiting: {
      enabled: true,
      maxRequestsPerMinute: 100,
      windowSizeMs: 60000
    }
  }),
  getDevelopmentConfig: jest.fn().mockReturnValue({
    enableDevTools: false,
    enableHotReload: false,
    enableDebugLogging: false,
    mockExternalServices: false,
    devServerPort: 5173
  }),
  getPerformanceConfig: jest.fn().mockReturnValue({
    enabled: true,
    samplingRate: 0.1,
    metricsInterval: 10000,
    enableReactProfiler: false,
    enableBundleAnalysis: false,
    maxPerformanceEntries: 1000
  }),
  getErrorHandlingConfig: jest.fn().mockReturnValue({
    enableAutoRecovery: true,
    maxRetryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    enableErrorReporting: false
  }),
  updateConfig: jest.fn().mockReturnValue(true),
  reloadConfig: jest.fn().mockReturnValue(true)
};

// Mock electron after setting up all mocks
const mockElectron = {
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  Menu: mockMenu,
  systemPreferences: mockSystemPreferences,
  dialog: mockDialog,
  shell: mockShell
};

// Mock all dependencies
jest.mock('electron', () => mockElectron);
jest.mock('electron/default', () => mockElectron);

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/'))
}));

const mockElectronLog = {
  transports: {
    file: { level: 'info' },
    console: { level: 'debug' }
  },
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock electron-log with a default export
jest.mock('electron-log', () => mockElectronLog);
jest.mock('electron-log/default', () => mockElectronLog);

jest.mock('../../main/workspace', () => ({
  WorkspaceManager: jest.fn().mockImplementation(() => mockWorkspaceManager)
}));

jest.mock('../../main/notification-manager', () => ({
  DesktopNotificationManager: jest.fn().mockImplementation(() => mockNotificationManager)
}));

jest.mock('../../main/security-config', () => ({
  securityConfig: mockSecurityConfig
}));

jest.mock('../../main/logging/LoggingService', () => ({
  mainLoggingService: mockMainLoggingService,
  mainLogger: mockMainLogger
}));

jest.mock('../../main/config/AppConfig', () => ({
  configManager: mockConfigManager
}));

describe('Flow Desk Main Process', () => {
  let FlowDeskApp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset process.env
    process.env.NODE_ENV = 'test';
    
    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Application Initialization', () => {
    test('should initialize security configuration', async () => {
      // Import the main file to trigger initialization
      await import('../../main/main');

      expect(mockSecurityConfig.initialize).toHaveBeenCalled();
      expect(mockSecurityConfig.configureProtocolSecurity).toHaveBeenCalled();
    });

    test('should quit app on security initialization failure in production', async () => {
      process.env.NODE_ENV = 'production';
      mockSecurityConfig.initialize.mockRejectedValueOnce(new Error('Security init failed'));

      await import('../../main/main');

      expect(mockApp.quit).toHaveBeenCalled();
    });

    test('should continue on security failure in development', async () => {
      process.env.NODE_ENV = 'development';
      mockSecurityConfig.initialize.mockRejectedValueOnce(new Error('Security init failed'));

      await import('../../main/main');

      expect(mockApp.quit).not.toHaveBeenCalled();
    });

    test('should set about panel options', async () => {
      await import('../../main/main');

      expect(mockApp.setAboutPanelOptions).toHaveBeenCalledWith({
        applicationName: 'Flow Desk',
        applicationVersion: '1.0.0',
        version: '1.0.0',
        copyright: '© 2024 Flow Desk'
      });
    });

    test('should set up app event listeners', async () => {
      await import('../../main/main');

      expect(mockApp.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
      expect(mockApp.on).toHaveBeenCalledWith('activate', expect.any(Function));
      expect(mockApp.on).toHaveBeenCalledWith('web-contents-created', expect.any(Function));
    });

    test('should set up periodic rate limit cleanup', async () => {
      await import('../../main/main');

      // Trigger app ready
      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      // Fast forward time to trigger setInterval
      jest.advanceTimersByTime(60000);

      expect(mockSecurityConfig.clearExpiredRateLimits).toHaveBeenCalled();
    });
  });

  describe('Main Window Creation', () => {
    test('should create main window with correct configuration', async () => {
      await import('../../main/main');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      expect(mockBrowserWindow).toHaveBeenCalledWith({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        show: false,
        titleBarStyle: expect.any(String),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: expect.stringContaining('preload.js'),
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false
        }
      });
    });

    test('should load development URL in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      await import('../../main/main');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      const windowInstance = mockBrowserWindow.mock.results[0]?.value;
      expect(windowInstance?.loadURL).toHaveBeenCalledWith('http://localhost:5173');
      expect(windowInstance?.webContents.openDevTools).toHaveBeenCalled();
    });

    test('should load file in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      await import('../../main/main');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      const windowInstance = mockBrowserWindow.mock.results[0]?.value;
      expect(windowInstance?.loadFile).toHaveBeenCalledWith(
        expect.stringContaining('renderer/index.html')
      );
    });

    test('should set main window in workspace manager', async () => {
      await import('../../main/main');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      expect(mockWorkspaceManager.setMainWindow).toHaveBeenCalled();
    });
  });

  describe('IPC Handlers', () => {
    beforeEach(async () => {
      await import('../../main/main');
      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }
    });

    describe('Workspace IPC Handlers', () => {
      test('should handle workspace:create', () => {
        const handler = getIpcHandler('workspace:create');
        expect(handler).toBeDefined();
      });

      test('should handle workspace:list', () => {
        const handler = getIpcHandler('workspace:list');
        expect(handler).toBeDefined();
      });

      test('should handle workspace:get', () => {
        const handler = getIpcHandler('workspace:get');
        expect(handler).toBeDefined();
      });

      test('should handle workspace:delete', () => {
        const handler = getIpcHandler('workspace:delete');
        expect(handler).toBeDefined();
      });

      test('should handle workspace:switch', () => {
        const handler = getIpcHandler('workspace:switch');
        expect(handler).toBeDefined();
      });

      test('should handle workspace:update', () => {
        const handler = getIpcHandler('workspace:update');
        expect(handler).toBeDefined();
      });

      test('should handle workspace:addService', async () => {
        const handler = getIpcHandler('workspace:addService');
        expect(handler).toBeDefined();

        // Test the handler
        const result = await handler(
          {} as any,
          'workspace-1',
          'Gmail',
          'email',
          'https://mail.google.com'
        );

        expect(mockWorkspaceManager.createService).toHaveBeenCalledWith(
          'workspace-1',
          'Gmail',
          'email',
          'https://mail.google.com'
        );
        expect(result).toBe('test-service-id');
      });

      test('should handle workspace:removeService', async () => {
        const handler = getIpcHandler('workspace:removeService');
        expect(handler).toBeDefined();

        await handler({} as any, 'workspace-1', 'service-1');

        expect(mockWorkspaceManager.deleteService).toHaveBeenCalledWith(
          'workspace-1',
          'service-1'
        );
      });

      test('should handle workspace:loadService', async () => {
        const handler = getIpcHandler('workspace:loadService');
        expect(handler).toBeDefined();

        await handler({} as any, 'workspace-1', 'service-1');

        expect(mockWorkspaceManager.loadService).toHaveBeenCalledWith(
          'workspace-1',
          'service-1'
        );
      });

      test('should handle workspace:clear-data', async () => {
        const handler = getIpcHandler('workspace:clear-data');
        expect(handler).toBeDefined();

        await handler({} as any, 'workspace-1');

        expect(mockWorkspaceManager.clearWorkspaceData).toHaveBeenCalledWith('workspace-1');
      });
    });

    describe('Browser View IPC Handlers', () => {
      test('should handle browser-view:hide', async () => {
        const handler = getIpcHandler('browser-view:hide');
        expect(handler).toBeDefined();

        await handler({} as any);

        expect(mockWorkspaceManager.hideBrowserView).toHaveBeenCalled();
      });

      test('should handle browser-view:show', async () => {
        const handler = getIpcHandler('browser-view:show');
        expect(handler).toBeDefined();

        await handler({} as any);

        expect(mockWorkspaceManager.showBrowserView).toHaveBeenCalled();
      });
    });

    describe('System IPC Handlers', () => {
      test('should handle system:showNotification', () => {
        const handler = getIpcHandler('system:showNotification');
        expect(handler).toBeDefined();

        const options = {
          title: 'Test Notification',
          body: 'Test body',
          silent: false
        };

        handler({} as any, options);

        expect(mockNotificationManager.showNotification).toHaveBeenCalledWith({
          ...options,
          body: 'Test body'
        });
      });

      test('should handle system:showDialog', async () => {
        const handler = getIpcHandler('system:showDialog');
        expect(handler).toBeDefined();

        const options = { message: 'Test message', type: 'info' };

        const result = await handler({} as any, options);

        expect(mockDialog.showMessageBox).toHaveBeenCalled();
        expect(result).toEqual({ response: 0, checkboxChecked: false });
      });

      test('should handle system:openExternal', () => {
        const handler = getIpcHandler('system:openExternal');
        expect(handler).toBeDefined();

        handler({} as any, 'https://example.com');

        expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com');
      });
    });

    describe('Settings and Theme IPC Handlers', () => {
      test('should handle settings:get', async () => {
        const handler = getIpcHandler('settings:get');
        expect(handler).toBeDefined();

        const result = await handler({} as any);

        expect(result).toEqual({
          theme: 'system',
          fontSize: 14,
          accentColor: '#007acc'
        });
      });

      test('should handle theme:get', () => {
        const handler = getIpcHandler('theme:get');
        expect(handler).toBeDefined();

        const result = handler({} as any);

        expect(result).toEqual({
          theme: 'system',
          accentColor: '#007acc',
          fontSize: 14
        });
      });

      test('should handle theme:set', () => {
        const handler = getIpcHandler('theme:set');
        expect(handler).toBeDefined();

        const themeData = { theme: 'dark', accentColor: '#ff0000' };
        handler({} as any, themeData);

        // Should not throw and should log the theme update
        expect(handler).not.toThrow();
      });
    });

    describe('Error Handling in IPC Handlers', () => {
      test('should handle errors in workspace:create', async () => {
        mockWorkspaceManager.createWorkspace.mockRejectedValueOnce(
          new Error('Failed to create workspace')
        );

        const handler = getIpcHandler('workspace:create');
        
        await expect(handler({} as any, { name: 'Test' }))
          .rejects.toThrow('Failed to create workspace');
      });

      test('should handle errors in workspace:delete', async () => {
        mockWorkspaceManager.deleteWorkspace.mockRejectedValueOnce(
          new Error('Failed to delete workspace')
        );

        const handler = getIpcHandler('workspace:delete');
        
        await expect(handler({} as any, 'workspace-1'))
          .rejects.toThrow('Failed to delete workspace');
      });

      test('should handle errors in service operations', async () => {
        mockWorkspaceManager.createService.mockRejectedValueOnce(
          new Error('Failed to create service')
        );

        const handler = getIpcHandler('workspace:addService');
        
        await expect(handler({} as any, 'workspace-1', 'Test', 'web', 'https://example.com'))
          .rejects.toThrow('Failed to create service');
      });
    });
  });

  describe('Menu Setup', () => {
    test('should create application menu', async () => {
      await import('../../main/main');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      expect(mockMenu.buildFromTemplate).toHaveBeenCalled();
      expect(mockMenu.setApplicationMenu).toHaveBeenCalled();
    });

    test('should include platform-specific menu items for macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      await import('../../main/main');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      if (readyCallback) {
        await readyCallback();
      }

      const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
      expect(menuTemplate).toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: 'Flow Desk'
        })
      ]));

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('Security Configuration', () => {
    test('should configure web contents security', async () => {
      await import('../../main/main');

      // Test web-contents-created handler
      const webContentsHandler = getAppEventHandler('web-contents-created');
      expect(webContentsHandler).toBeDefined();

      const mockWebContents = {
        setWindowOpenHandler: jest.fn()
      };

      webContentsHandler({} as any, mockWebContents);

      expect(mockWebContents.setWindowOpenHandler).toHaveBeenCalled();
    });

    test('should deny window opening and open externally', async () => {
      await import('../../main/main');

      const webContentsHandler = getAppEventHandler('web-contents-created');
      const mockWebContents = {
        setWindowOpenHandler: jest.fn()
      };

      webContentsHandler({} as any, mockWebContents);

      const windowOpenHandler = mockWebContents.setWindowOpenHandler.mock.calls[0][0];
      const result = windowOpenHandler({ url: 'https://example.com' });

      expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com');
      expect(result).toEqual({ action: 'deny' });
    });
  });

  // Helper functions
  function getIpcHandler(channel: string) {
    const handleCall = mockIpcMain.handle.mock.calls.find(call => call[0] === channel);
    return handleCall ? handleCall[1] : undefined;
  }

  function getAppEventHandler(event: string) {
    const eventCall = mockApp.on.mock.calls.find(call => call[0] === event);
    return eventCall ? eventCall[1] : undefined;
  }
});