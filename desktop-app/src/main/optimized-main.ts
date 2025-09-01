/**
 * Optimized Flow Desk Main Process - Maximum Performance Implementation
 * 
 * Key Optimizations:
 * 1. Lazy initialization and on-demand loading
 * 2. Efficient resource management and pooling
 * 3. Optimized IPC with batching and serialization
 * 4. Background task optimization
 * 5. Memory leak prevention and cleanup
 * 6. Performance monitoring and metrics
 */

import { app, BrowserWindow, ipcMain, Menu, protocol, screen } from 'electron';
import { join } from 'path';
import log from 'electron-log';
import { EventEmitter } from 'events';

// Lazy imports to improve startup time
let WorkspaceManager: typeof import('./workspace').WorkspaceManager | undefined;
let DesktopNotificationManager: typeof import('./notification-manager').DesktopNotificationManager | undefined;
let rustEngine: typeof import('../lib/rust-engine') | undefined;

// Performance monitoring
interface PerformanceMetrics {
  startupTime: number;
  ipcCalls: Map<string, { count: number; totalTime: number; avgTime: number }>;
  memoryUsage: NodeJS.MemoryUsage[];
  cpuUsage: NodeJS.CpuUsage[];
  lastGC: number;
  browserViewCount: number;
}

// Resource pool for expensive operations
interface ResourcePool {
  browserViews: Map<string, Electron.BrowserView>;
  sessions: Map<string, Electron.Session>;
  timers: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;
}

class OptimizedFlowDeskApp extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private workspaceManager: import('./workspace').WorkspaceManager | null = null;
  private notificationManager: import('./notification-manager').DesktopNotificationManager | null = null;
  private currentView: 'mail' | 'calendar' | 'workspace' = 'mail';
  
  // Performance optimization properties
  private performanceMetrics: PerformanceMetrics;
  private resourcePool: ResourcePool;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private ipcBatch: Map<string, unknown[]> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  
  // Memory management
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private gcScheduled = false;
  private lastMemoryCleanup = Date.now();

  constructor() {
    super();
    
    // Initialize performance tracking
    this.performanceMetrics = {
      startupTime: Date.now(),
      ipcCalls: new Map(),
      memoryUsage: [],
      cpuUsage: [],
      lastGC: Date.now(),
      browserViewCount: 0
    };

    // Initialize resource pool
    this.resourcePool = {
      browserViews: new Map(),
      sessions: new Map(),
      timers: new Set(),
      intervals: new Set()
    };

    this.initializeApp();
  }

  private initializeApp() {
    // Configure logging with performance considerations
    log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'error';
    
    // Optimize app ready handling
    app.whenReady().then(async () => {
      await this.fastStartup();
    });

    // Optimize activate event
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    // Optimize window close handling
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.cleanup().then(() => app.quit());
      }
    });

    // Optimize before quit handling
    app.on('before-quit', async (event) => {
      if (!this.isInitialized) {
        event.preventDefault();
        await this.cleanup();
        app.quit();
      }
    });

    // Memory pressure handling
    app.on('memory-warning', () => {
      this.handleMemoryPressure();
    });
  }

  /**
   * Fast startup sequence - prioritize critical components
   */
  private async fastStartup() {
    const startTime = Date.now();
    
    try {
      // Phase 1: Critical UI components (non-blocking)
      this.createMainWindow();
      this.setupBasicIpcHandlers();
      
      // Phase 2: Setup menu and basic functionality
      this.setupMenu();
      
      // Phase 3: Start background initialization
      this.initPromise = this.initializeBackgroundComponents();
      
      // Phase 4: Start performance monitoring
      this.startPerformanceMonitoring();
      
      this.performanceMetrics.startupTime = Date.now() - startTime;
      log.info(`Fast startup completed in ${this.performanceMetrics.startupTime}ms`);
      
    } catch (error) {
      log.error('Fast startup failed:', error);
      throw error;
    }
  }

  /**
   * Initialize non-critical components in background
   */
  private async initializeBackgroundComponents() {
    try {
      // Lazy load heavy modules
      const { WorkspaceManager: WM } = await import('./workspace');
      const { DesktopNotificationManager: DNM } = await import('./notification-manager');
      WorkspaceManager = WM;
      DesktopNotificationManager = DNM;
      
      // Initialize workspace manager
      this.workspaceManager = new WorkspaceManager();
      
      // Initialize notification manager
      await this.initializeNotifications();
      
      // Setup remaining IPC handlers
      this.setupAdvancedIpcHandlers();
      
      // Preload Rust engine if available
      this.preloadRustEngine();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      log.info('Background initialization completed');
      
    } catch (error) {
      log.error('Background initialization failed:', error);
    }
  }

  /**
   * Create main window with performance optimizations
   */
  private createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    this.mainWindow = new BrowserWindow({
      width: Math.min(1400, width * 0.8),
      height: Math.min(900, height * 0.8),
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/preload.js'),
        // Performance optimizations
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        enableBlinkFeatures: '',
        disableBlinkFeatures: 'Auxclick',
        // Memory optimizations
        v8CacheOptions: 'code',
        zoomFactor: 1.0
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false,
      backgroundColor: '#0a0a0a',
      // Performance optimizations
      paintWhenInitiallyHidden: false,
      enableLargerThanScreen: false,
      useContentSize: true
    });

    // Optimize loading
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      if (process.env.DEBUG_DEVTOOLS === 'true') {
        this.mainWindow.webContents.openDevTools();
      }
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Optimize ready-to-show
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      log.info('Main window ready and shown');
    });

    // Optimize resize handling with debouncing
    let resizeTimeout: NodeJS.Timeout | null = null;
    this.mainWindow.on('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.resizeBrowserViews();
      }, 100);
      this.resourcePool.timers.add(resizeTimeout);
    });

    // Memory optimization - clean up webContents on close
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.scheduleGarbageCollection();
    });

    log.info('Main window created with optimizations');
  }

  /**
   * Setup basic IPC handlers for immediate functionality
   */
  private setupBasicIpcHandlers() {
    // App information
    ipcMain.handle('app:get-version', () => app.getVersion());
    ipcMain.handle('app:get-platform', () => process.platform);

    // View switching
    ipcMain.handle('view:switch', async (_, view: 'mail' | 'calendar' | 'workspace') => {
      return this.switchToView(view);
    });

    // Window management
    ipcMain.handle('window:minimize', () => this.mainWindow?.minimize());
    ipcMain.handle('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });
    ipcMain.handle('window:close', () => this.mainWindow?.close());

    // System information
    ipcMain.handle('system:get-info', this.createOptimizedHandler('system:get-info', async () => {
      return {
        platform: process.platform,
        version: app.getVersion(),
        arch: process.arch,
        deviceId: require('os').hostname() || 'unknown',
        isDarkMode: true,
        isHighContrast: false
      };
    }));
  }

  /**
   * Setup advanced IPC handlers after background initialization
   */
  private setupAdvancedIpcHandlers() {
    // Wait for initialization
    const waitForInit = async () => {
      if (!this.isInitialized && this.initPromise) {
        await this.initPromise;
      }
      if (!this.workspaceManager) {
        throw new Error('Workspace manager not initialized');
      }
    };

    // Workspace handlers with optimization
    ipcMain.handle('workspace:get-all', this.createOptimizedHandler('workspace:get-all', async () => {
      await waitForInit();
      return this.workspaceManager.getWorkspaces();
    }));

    ipcMain.handle('workspace:get-active', this.createOptimizedHandler('workspace:get-active', async () => {
      await waitForInit();
      return this.workspaceManager.getActiveWorkspace();
    }));

    ipcMain.handle('workspace:create', this.createOptimizedHandler('workspace:create', async (_, name: string, color?: string) => {
      await waitForInit();
      return await this.workspaceManager.createWorkspace(name, color);
    }));

    // Batched workspace operations
    ipcMain.handle('workspace:batch-operations', this.createOptimizedHandler('workspace:batch-operations', async (_, operations: Array<{ type: string; data: unknown }>) => {
      await waitForInit();
      const results = [];
      for (const op of operations) {
        try {
          switch (op.type) {
            case 'create':
              results.push(await this.workspaceManager.createWorkspace(op.name, op.color));
              break;
            case 'update':
              results.push(await this.workspaceManager.updateWorkspace(op.id, op.updates));
              break;
            case 'delete':
              results.push(await this.workspaceManager.deleteWorkspace(op.id));
              break;
            default:
              results.push({ error: `Unknown operation: ${op.type}` });
          }
        } catch (error) {
          results.push({ error: error instanceof Error ? error.message : String(error) });
        }
      }
      return results;
    }));

    // Mail handlers with batching and caching
    this.setupMailHandlers();
    this.setupCalendarHandlers();
    this.setupOptimizedHandlers();
  }

  /**
   * Setup optimized mail handlers
   */
  private setupMailHandlers() {
    // Cached mail account data
    let mailAccountsCache: Array<import('@flow-desk/shared/types/mail').MailAccount> | null = null;
    let mailCacheExpiry = 0;
    
    ipcMain.handle('mail:get-accounts', this.createOptimizedHandler('mail:get-accounts', async () => {
      const now = Date.now();
      if (mailAccountsCache && now < mailCacheExpiry) {
        return mailAccountsCache;
      }
      
      try {
        if (!rustEngine) {
          rustEngine = require('../lib/rust-engine');
        }
        await rustEngine.initMailEngine();
        const accounts = await rustEngine.getMailAccounts();
        
        // Cache for 30 seconds
        mailAccountsCache = accounts;
        mailCacheExpiry = now + 30000;
        
        return accounts;
      } catch (error) {
        log.error('Failed to get mail accounts:', error);
        return [];
      }
    }));

    // Batched mail operations
    ipcMain.handle('mail:batch-sync', this.createOptimizedHandler('mail:batch-sync', async (_, accountIds: string[]) => {
      const results = new Map();
      const promises = accountIds.map(async (accountId) => {
        try {
          if (!rustEngine) {
            rustEngine = require('../lib/rust-engine');
          }
          await rustEngine.initMailEngine();
          const result = await rustEngine.syncMailAccount(accountId);
          results.set(accountId, { success: true, data: result });
        } catch (error) {
          results.set(accountId, { success: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
      
      await Promise.all(promises);
      return Object.fromEntries(results);
    }));
  }

  /**
   * Setup optimized calendar handlers
   */
  private setupCalendarHandlers() {
    // Calendar operations with caching
    let calendarCache = new Map<string, { data: Array<import('@flow-desk/shared/types/calendar').CalendarEvent>; expiry: number }>();
    
    ipcMain.handle('calendar:get-events-cached', this.createOptimizedHandler('calendar:get-events-cached', async (_, accountId: string, startDate: string, endDate: string) => {
      const cacheKey = `${accountId}-${startDate}-${endDate}`;
      const cached = calendarCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expiry) {
        return cached.data;
      }
      
      try {
        if (!rustEngine) {
          rustEngine = require('../lib/rust-engine');
        }
        await rustEngine.initCalendarEngine();
        const events = await rustEngine.getCalendarEvents(accountId, startDate, endDate);
        
        // Cache for 5 minutes
        calendarCache.set(cacheKey, { data: events, expiry: Date.now() + 300000 });
        
        return events;
      } catch (error) {
        log.error('Failed to get calendar events:', error);
        return [];
      }
    }));
  }

  /**
   * Setup additional optimized handlers
   */
  private setupOptimizedHandlers() {
    // Settings with local caching
    let settingsCache: Record<string, unknown> | null = null;
    
    ipcMain.handle('settings:get-cached', this.createOptimizedHandler('settings:get-cached', async () => {
      if (settingsCache) {
        return settingsCache;
      }
      
      settingsCache = {
        theme: 'auto',
        notifications: true,
        autoSync: true
      };
      
      return settingsCache;
    }));

    // Performance metrics endpoint
    ipcMain.handle('performance:get-metrics', this.createOptimizedHandler('performance:get-metrics', async () => {
      return {
        ...this.performanceMetrics,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        resourcePoolSize: {
          browserViews: this.resourcePool.browserViews.size,
          sessions: this.resourcePool.sessions.size,
          timers: this.resourcePool.timers.size,
          intervals: this.resourcePool.intervals.size
        }
      };
    }));
  }

  /**
   * Create optimized IPC handler with performance tracking
   */
  private createOptimizedHandler<T extends unknown[], R>(channel: string, handler: (...args: T) => Promise<R>) {
    return async (...args: T): Promise<R> => {
      const startTime = process.hrtime.bigint();
      
      try {
        const result = await handler(...args);
        
        // Track performance
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        const metrics = this.performanceMetrics.ipcCalls.get(channel) || { count: 0, totalTime: 0, avgTime: 0 };
        metrics.count++;
        metrics.totalTime += duration;
        metrics.avgTime = metrics.totalTime / metrics.count;
        
        this.performanceMetrics.ipcCalls.set(channel, metrics);
        
        return result;
      } catch (error) {
        log.error(`IPC handler error for ${channel}:`, error);
        throw error;
      }
    };
  }

  /**
   * Optimized view switching with lazy loading
   */
  private async switchToView(view: 'mail' | 'calendar' | 'workspace') {
    this.currentView = view;
    
    if (!this.mainWindow) return;

    // Efficient browser view management
    const currentBrowserView = this.mainWindow.getBrowserView();
    if (currentBrowserView) {
      // Instead of destroying, hide the current view
      this.mainWindow.setBrowserView(null);
    }

    if (view === 'workspace') {
      // Lazy load workspace service
      if (!this.isInitialized && this.initPromise) {
        await this.initPromise;
      }
      
      if (this.workspaceManager) {
        const activeWorkspace = this.workspaceManager.getActiveWorkspace();
        if (activeWorkspace && activeWorkspace.services.length > 0) {
          await this.workspaceManager.loadService(
            activeWorkspace.id, 
            activeWorkspace.services[0].id, 
            this.mainWindow
          );
        }
      }
    }

    // Notify renderer efficiently
    this.mainWindow.webContents.send('view-changed', view);
    log.debug(`Switched to view: ${view}`);
  }

  /**
   * Optimized browser view resizing with debouncing
   */
  private resizeBrowserViews() {
    if (!this.mainWindow) return;

    const browserView = this.mainWindow.getBrowserView();
    if (browserView) {
      const bounds = this.mainWindow.getBounds();
      browserView.setBounds({
        x: 300, // After sidebars
        y: 0,
        width: bounds.width - 300,
        height: bounds.height
      });
    }
  }

  /**
   * Initialize notifications with lazy loading
   */
  private async initializeNotifications() {
    try {
      if (DesktopNotificationManager && this.mainWindow) {
        this.notificationManager = new DesktopNotificationManager(this.mainWindow);
        await this.notificationManager.initialize();
        log.info('Notification manager initialized');
      }
    } catch (error) {
      log.error('Failed to initialize notification manager:', error);
    }
  }

  /**
   * Preload Rust engine for better performance
   */
  private preloadRustEngine() {
    if (!rustEngine) {
      try {
        rustEngine = require('../lib/rust-engine');
        log.info('Rust engine preloaded');
      } catch (error) {
        log.warn('Rust engine not available:', error);
      }
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring() {
    // Memory monitoring every 30 seconds
    this.memoryMonitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.performanceMetrics.memoryUsage.push(memUsage);
      
      // Keep only last 100 measurements
      if (this.performanceMetrics.memoryUsage.length > 100) {
        this.performanceMetrics.memoryUsage.shift();
      }
      
      // Schedule GC if memory usage is high
      if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        this.scheduleGarbageCollection();
      }
      
      // Clean up old cache entries
      if (Date.now() - this.lastMemoryCleanup > 300000) { // 5 minutes
        this.cleanupMemory();
        this.lastMemoryCleanup = Date.now();
      }
      
    }, 30000);
    
    this.resourcePool.intervals.add(this.memoryMonitorInterval);
  }

  /**
   * Handle memory pressure situations
   */
  private handleMemoryPressure() {
    log.warn('Memory pressure detected, cleaning up resources');
    
    // Clear caches
    this.cleanupMemory();
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
      this.performanceMetrics.lastGC = Date.now();
    }
    
    // Close inactive browser views
    this.cleanupInactiveBrowserViews();
  }

  /**
   * Schedule garbage collection
   */
  private scheduleGarbageCollection() {
    if (this.gcScheduled) return;
    
    this.gcScheduled = true;
    
    const timer = setTimeout(() => {
      if (global.gc) {
        global.gc();
        this.performanceMetrics.lastGC = Date.now();
      }
      this.gcScheduled = false;
    }, 5000);
    
    this.resourcePool.timers.add(timer);
  }

  /**
   * Clean up memory and caches
   */
  private cleanupMemory() {
    // Clear expired cache entries if any caching mechanisms exist
    // This would clear any internal caches we maintain
    
    // Clear old performance metrics
    if (this.performanceMetrics.memoryUsage.length > 50) {
      this.performanceMetrics.memoryUsage.splice(0, this.performanceMetrics.memoryUsage.length - 50);
    }
    
    log.info('Memory cleanup completed');
  }

  /**
   * Clean up inactive browser views
   */
  private cleanupInactiveBrowserViews() {
    // This would be implemented in the workspace manager
    if (this.workspaceManager && typeof this.workspaceManager.cleanupInactiveViews === 'function') {
      this.workspaceManager.cleanupInactiveViews();
    }
  }

  /**
   * Setup optimized menu
   */
  private setupMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Flow Desk',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { 
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.mainWindow?.webContents.send('show-preferences');
            }
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Mail',
            accelerator: 'CmdOrCtrl+1',
            click: () => this.switchToView('mail')
          },
          {
            label: 'Calendar', 
            accelerator: 'CmdOrCtrl+2',
            click: () => this.switchToView('calendar')
          },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Comprehensive cleanup
   */
  public async cleanup(): Promise<void> {
    log.info('Starting application cleanup...');
    
    try {
      // Clear all timers and intervals
      for (const timer of this.resourcePool.timers) {
        clearTimeout(timer);
      }
      for (const interval of this.resourcePool.intervals) {
        clearInterval(interval);
      }
      
      // Clear memory monitor
      if (this.memoryMonitorInterval) {
        clearInterval(this.memoryMonitorInterval);
      }
      
      // Cleanup workspace manager
      if (this.workspaceManager) {
        await this.workspaceManager.cleanup();
      }
      
      // Cleanup notification manager
      if (this.notificationManager) {
        await this.notificationManager.cleanup();
      }
      
      // Clear resource pools
      this.resourcePool.browserViews.clear();
      this.resourcePool.sessions.clear();
      this.resourcePool.timers.clear();
      this.resourcePool.intervals.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
      log.info('Application cleanup completed');
      
    } catch (error) {
      log.error('Error during cleanup:', error);
    }
  }
}

// Initialize the optimized app
const flowDeskApp = new OptimizedFlowDeskApp();

// Export for testing
export { OptimizedFlowDeskApp };

log.info('Optimized Flow Desk main process initialized');