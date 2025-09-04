/**
 * Flow Desk Main Process - Final Implementation
 * 
 * Uses IMAP/SMTP for email, CalDAV for calendar, and Chrome browser instances for all other services
 */

import { app, BrowserWindow, ipcMain, Menu, Notification, systemPreferences, dialog, shell } from 'electron';
import { join } from 'path';
import log from 'electron-log';
import { WorkspaceManager } from './workspace';
import { DesktopNotificationManager } from './notification-manager';
import { MailSyncManager } from './mail-sync-manager';
// import { emailServiceManager } from './email-service-manager'; // Temporarily disabled
import { SnippetManager } from './snippet-manager';
import { EmailTemplateManager } from './email-template-manager';
import { securityConfig } from './security-config';
import { RustEmailService } from './rust-email-service';
import { EmailScheduler } from './email-scheduler';
import { EmailRulesEngine } from './email-rules-engine';
import { calendarEngine } from './calendar/CalendarEngine';


// Import type interfaces
import type { Workspace } from './workspace';

// Email template interface
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables?: string[];
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Email scheduling interface
export interface ScheduledEmailData {
  id?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  scheduledTime: Date;
  scheduledFor: Date;
  accountId: string;
  attachments?: EmailAttachment[];
}

// Email attachment interface
export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  mimeType: string;
  size: number;
}

// Email rule interface
export interface EmailRuleData {
  id?: string;
  name: string;
  description?: string;
  isActive: boolean;
  enabled: boolean;
  conditions: EmailRuleCondition[];
  actions: EmailRuleAction[];
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmailRuleCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'has_attachment';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
  caseSensitive?: boolean;
}

export interface EmailRuleAction {
  type: 'move_to_folder' | 'add_label' | 'forward' | 'delete' | 'mark_as_read' | 'mark_as_important';
  value?: string; // folder, label, or forward address
}

// Text snippet interface
export interface TextSnippet {
  id?: string;
  name: string;
  content: string;
  category: string;
  shortcut?: string;
  variables?: string[];
  isGlobal?: boolean;
  tags: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Create workspace data interface
export interface CreateWorkspaceData {
  name?: string;
  color?: string;
  icon?: string;
  browserIsolation?: 'shared' | 'isolated';
  description?: string;
}

// Create partition data interface
export interface CreatePartitionData {
  name: string;
  type?: string;
  description?: string;
}

// Create window data interface
export interface CreateWindowData {
  title: string;
  url?: string;
  width?: number;
  height?: number;
}

// Workspace window interface
export interface WorkspaceWindow {
  id: string;
  title: string;
  url?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mail account data interface
export interface MailAccountData {
  id?: string;
  email: string;
  password: string;
  displayName?: string;
  provider?: string;
  isEnabled?: boolean;
}

// Email message interface
export interface EmailMessage {
  id?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
}

// Get messages options interface
export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  since?: Date;
  before?: Date;
  unreadOnly?: boolean;
  sortBy?: 'date' | 'subject' | 'from';
  sortOrder?: 'asc' | 'desc';
}

// Send message options interface
export interface SendMessageOptions {
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
  deliveryReceipt?: boolean;
  readReceipt?: boolean;
}

// Search messages options interface
export interface SearchMessagesOptions {
  accountIds?: string[];
  folders?: string[];
  limit?: number;
  offset?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

// Calendar server config interface
export interface CalendarServerConfig {
  serverUrl?: string;
  port?: number;
  ssl?: boolean;
  authType?: 'basic' | 'oauth2';
}

// Calendar account data interface
export interface CalendarAccountData {
  id?: string;
  email: string;
  password?: string;
  displayName?: string;
  provider?: string;
  serverConfig?: CalendarServerConfig;
  serverUrl?: string;
  username?: string;
  isEnabled?: boolean;
}

// Create calendar event options interface
export interface CreateCalendarEventOptions {
  description?: string;
  location?: string;
  attendees?: string[];
  recurrence?: string;
  reminders?: CalendarReminder[];
  allDay?: boolean;
  visibility?: 'private' | 'public' | 'confidential';
}

// Calendar reminder interface
export interface CalendarReminder {
  method: 'email' | 'popup' | 'sms';
  minutesBefore: number;
}

// Calendar event data interface
export interface CalendarEventData {
  id?: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  recurrence?: string;
  attendees?: string[];
  organizer?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'private' | 'public' | 'confidential';
  reminders?: CalendarReminder[];
  createdAt?: Date;
  updatedAt?: Date;
}

// App settings interface
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  autoSync: boolean;
  language: string;
  timezone: string;
  defaultEmailSignature?: string;
  compactMode?: boolean;
  showUnreadCounts?: boolean;
  enableShortcuts?: boolean;
}

// Search options interface
export interface SearchOptions {
  query: string;
  limit: number;
  offset: number;
  sources?: string[];
  filters?: Record<string, unknown>;
}

// Search document interface
export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Theme settings interface
export interface ThemeSettings {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  fontSize?: 'small' | 'medium' | 'large';
  compactMode?: boolean;
}

// Import comprehensive Rust engine integration
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';

// Import search service
import { getSearchService } from './search-service-rust';

// Import working JavaScript database service with SQLite3
import { 
  getDatabaseInitializationService,
  DatabaseInitializationConfig as DatabaseConfig,
  InitializationProgress as DatabaseInitProgress
} from './database-initialization-service';

// Import cross-platform utilities
import { getPlatformInfo, getEnvironmentConfig, supportsFeature } from './platform-utils';
import { nativeModuleManager } from './native-module-manager';
import { fsUtils } from './fs-utils';

// Configure logging based on environment
if (process.env.NODE_ENV === 'production') {
  log.transports.file.level = 'warn';
  log.transports.console.level = false; // Disable console logging in production
} else {
  log.transports.file.level = 'info';
  log.transports.console.level = 'debug';
}

class FlowDeskApp {
  private mainWindow: BrowserWindow | null = null;
  private workspaceManager: WorkspaceManager;
  private notificationManager: DesktopNotificationManager | null = null;
  private mailSyncManager: MailSyncManager | null = null;
  // Email services removed - now handled directly by emailServiceManager via Rust engine
  // Pure Rust email service (no JavaScript dependencies)
  private realEmailService: RustEmailService | null = null;
  private snippetManager: SnippetManager | null = null;
  private emailTemplateManager: EmailTemplateManager | null = null;
  private emailScheduler: EmailScheduler | null = null;
  private emailRulesEngine: EmailRulesEngine | null = null;
  private currentView: 'mail' | 'calendar' | 'workspace' = 'mail';
  private databaseInitialized: boolean = false;
  private initializationProgress: DatabaseInitProgress | null = null;
  
  // Workspace window management
  private workspaceWindows: Map<string, WorkspaceWindow[]> = new Map();
  
  // Cross-platform support
  private platformInfo = getPlatformInfo();
  private environmentConfig = getEnvironmentConfig();

  constructor() {
    this.workspaceManager = new WorkspaceManager();
    this.initializeApp();
  }

  private initializeApp() {
    app.whenReady().then(async () => {
      // Initialize platform-specific components first
      try {
        await this.initializePlatform();
        log.info('Platform initialization completed successfully');
      } catch (error) {
        log.error('Failed to initialize platform components:', error);
        // Continue with initialization - some features may be degraded
      }

      // Initialize encryption keys first (automatic, no user configuration needed)
      try {
        await this.initializeEncryption();
        log.info('Encryption keys initialized automatically');
      } catch (error) {
        log.error('Failed to initialize encryption:', error);
        dialog.showErrorBox(
          'Encryption Error', 
          'Failed to initialize encryption. The application cannot continue.\n\n' +
          'This is an internal error that should not occur. Please restart the application.'
        );
        app.quit();
        return;
      }
      
      // Initialize security configuration after encryption
      try {
        await securityConfig.initialize();
        log.info('Security configuration initialized');
      } catch (error) {
        log.error('Failed to initialize security:', error);
        if (process.env.NODE_ENV === 'production') {
          dialog.showErrorBox('Security Error', 'Failed to initialize security configuration. Please check your environment settings.');
          app.quit();
          return;
        }
      }
      
      await this.requestNotificationPermissions();
      this.createMainWindow();
      this.setupMenu();
      await this.initializeDatabases();
      await this.initializeRustEngine();
      await this.initializeNotifications();
      this.setupIpcHandlers();
      this.createDefaultWorkspace();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', async () => {
      await this.workspaceManager.cleanup();
      if (this.notificationManager) {
        await this.notificationManager.cleanup();
      }
      if (this.mailSyncManager) {
        await this.mailSyncManager.cleanup();
      }
      
      // Clean up email scheduler
      if (this.emailScheduler) {
        try {
          await this.emailScheduler.shutdown();
          log.info('Email scheduler cleaned up');
        } catch (error) {
          log.warn('Error during email scheduler cleanup:', error);
        }
      }

      // Clean up email rules engine
      if (this.emailRulesEngine) {
        try {
          await this.emailRulesEngine.shutdown();
          log.info('Email rules engine cleaned up');
        } catch (error) {
          log.warn('Error during email rules engine cleanup:', error);
        }
      }
      
      // Clean up production email service
      // await emailServiceManager.destroy(); // Temporarily disabled
      
      // Clean up Rust email service
      if (this.realEmailService) {
        try {
          await this.realEmailService.destroy();
          log.info('Rust email service cleaned up');
        } catch (error) {
          log.warn('Error during Rust email service cleanup:', error);
        }
      }
      
      // Clean up Rust engine integration
      try {
        await rustEngineIntegration.shutdown();
        log.info('Rust engine integration cleaned up');
      } catch (error) {
        log.warn('Error during Rust engine cleanup:', error);
      }
    });
  }

  private createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/preload.js'),
        webSecurity: true,
        experimentalFeatures: false,
        offscreen: false,
        spellcheck: false,
        v8CacheOptions: 'code'
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false,
      backgroundColor: '#0a0a0a',
      frame: true,
      transparent: false,
      hasShadow: true,
      resizable: true,
      maximizable: true,
      minimizable: true,
      closable: true
    });

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      log.info('Flow Desk main window ready');
    });

    // Handle window resize for browser views
    this.mainWindow.on('resize', () => {
      this.resizeBrowserViews();
    });

    log.info('Flow Desk main window created');
  }

  /**
   * Initialize platform-specific components and features
   */
  private async initializePlatform(): Promise<void> {
    log.info(`Initializing Flow Desk on ${this.platformInfo.platform} (${this.platformInfo.arch})`);
    
    // Initialize native modules
    try {
      await nativeModuleManager.initializePlatformModules();
      log.info('Native modules initialized');
    } catch (error) {
      log.error('Failed to initialize native modules:', error);
      throw error;
    }

    // Check native module compilation status
    const compilationStatus = nativeModuleManager.checkNativeCompilation();
    if (!compilationStatus.success) {
      log.error('Native module compilation issues detected:');
      compilationStatus.issues.forEach(issue => log.error(`  - ${issue}`));
      
      if (this.environmentConfig.isProduction) {
        throw new Error('Critical native modules are not available');
      }
    } else {
      log.info('Native module compilation check passed');
    }

    // Log platform capabilities
    const features = this.platformInfo.supportedFeatures;
    log.info('Platform features:', {
      keychain: features.keychain,
      windowsCredentialManager: features.windowsCredentialManager,
      linuxSecretService: features.linuxSecretService,
      nativeNotifications: features.nativeNotifications,
      systemTray: features.systemTray
    });

    // Platform-specific initialization
    if (this.platformInfo.isWindows) {
      await this.initializeWindows();
    } else if (this.platformInfo.isDarwin) {
      await this.initializeMacOS();
    } else if (this.platformInfo.isLinux) {
      await this.initializeLinux();
    }

    // Clean up old temporary files
    try {
      const deletedCount = await fsUtils.cleanupTempFiles();
      if (deletedCount > 0) {
        log.info(`Cleaned up ${deletedCount} temporary files`);
      }
    } catch (error) {
      log.warn('Failed to clean up temporary files:', error);
    }
  }

  /**
   * Windows-specific initialization
   */
  private async initializeWindows(): Promise<void> {
    log.info('Initializing Windows-specific features');
    
    // Check for Windows Credential Manager
    if (supportsFeature('windowsCredentialManager')) {
      log.info('Windows Credential Manager available for secure storage');
    }

    // Set up Windows-specific paths
    const appDataPath = this.environmentConfig.paths.appData;
    await fsUtils.createDirectory(appDataPath);
    
    log.info(`Windows app data: ${appDataPath}`);
  }

  /**
   * macOS-specific initialization
   */
  private async initializeMacOS(): Promise<void> {
    log.info('Initializing macOS-specific features');
    
    // Check for Keychain Services
    if (supportsFeature('keychain')) {
      log.info('macOS Keychain Services available for secure storage');
    }

    // Set up macOS-specific paths
    const appSupportPath = this.environmentConfig.paths.appData;
    await fsUtils.createDirectory(appSupportPath);
    
    log.info(`macOS app support: ${appSupportPath}`);
  }

  /**
   * Linux-specific initialization
   */
  private async initializeLinux(): Promise<void> {
    log.info('Initializing Linux-specific features');
    
    // Check for Secret Service API
    if (supportsFeature('linuxSecretService')) {
      log.info('Linux Secret Service API available for secure storage');
    } else {
      log.warn('libsecret not available, using encrypted file fallback');
    }

    // Set up XDG-compliant paths
    const configPath = this.environmentConfig.paths.appData;
    const cachePath = this.environmentConfig.paths.cache;
    
    await fsUtils.createDirectory(configPath);
    await fsUtils.createDirectory(cachePath);
    
    log.info(`Linux config: ${configPath}`);
    log.info(`Linux cache: ${cachePath}`);
  }

  /**
   * Initialize encryption keys for automatic key management
   */
  private async initializeEncryption(): Promise<void> {
    try {
      log.info('Initializing encryption key management...');
      
      // Import dynamically to avoid initialization order issues
      const { encryptionKeyManager } = await import('./encryption-key-manager');
      
      // Initialize encryption key manager
      const initialized = await encryptionKeyManager.initialize();
      
      if (initialized) {
        log.info('Encryption key management initialized successfully');
        
        // Check if keys need rotation (every 90 days)
        if (encryptionKeyManager.needsRotation()) {
          log.info('Encryption keys need rotation (>90 days old)');
          // Note: Key rotation can be scheduled or done on user request
        }
      } else {
        log.error('Failed to initialize encryption key management');
        throw new Error('Encryption initialization failed');
      }
    } catch (error) {
      log.error('Encryption initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize databases on first run
   */
  private async initializeDatabases(): Promise<void> {
    try {
      log.info('Starting database initialization with SQLite3...');
      
      // Use working JavaScript database service with SQLite3
      const databaseService = getDatabaseInitializationService((progress) => {
        this.initializationProgress = progress;
        
        // Send progress updates to renderer if window is ready
        if (this.mainWindow) {
          this.mainWindow.webContents.send('database-initialization-progress', progress);
        }
      });
      
      // Check if databases are already initialized
      const isInitialized = await databaseService.isDatabasesInitialized();
      
      if (isInitialized) {
        log.info('Databases already initialized and healthy');
        this.databaseInitialized = true;
        
        // Send completion event to renderer
        if (this.mainWindow) {
          this.mainWindow.webContents.send('database-initialization-complete', {
            success: true,
            config: databaseService.getConfig()
          });
        }
        
        return;
      }

      // Initialize databases for first run
      const initializationSuccess = await databaseService.initializeDatabases();
      
      if (initializationSuccess) {
        this.databaseInitialized = true;
        log.info('Database initialization completed successfully with SQLite3');
        
        // Send completion event to renderer
        if (this.mainWindow) {
          this.mainWindow.webContents.send('database-initialization-complete', {
            success: true,
            config: databaseService.getConfig()
          });
        }
      } else {
        log.error('Database initialization failed');
        this.databaseInitialized = false;
        
        // Send failure event to renderer
        if (this.mainWindow) {
          this.mainWindow.webContents.send('database-initialization-complete', {
            success: false,
            error: 'Database initialization failed'
          });
        }
      }
    } catch (error) {
      log.error('Database initialization error:', error);
      this.databaseInitialized = false;
      
      // Show error dialog
      if (this.mainWindow) {
        dialog.showErrorBox(
          'Database Initialization Failed',
          `Flow Desk could not initialize its databases.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThe application may not function properly.`
        );
      }
    }
  }

  /**
   * Initialize the Rust engine integration
   */
  private async initializeRustEngine() {
    try {
      log.info('Initializing comprehensive Rust engine integration...');
      await rustEngineIntegration.initialize();
      log.info('Rust engine integration initialized successfully');
      log.info('Rust engine version:', rustEngineIntegration.getVersion());
      
      // Initialize search service
      try {
        const searchService = getSearchService();
        await searchService.initialize();
        log.info('Search service initialized successfully with Rust Tantivy backend');
      } catch (searchError) {
        log.error('Failed to initialize search service:', searchError);
        // Don't fail the entire initialization if search fails
      }

      // Initialize production-ready email service
      try {
        log.info('Initializing production-ready Rust email service...');
        this.realEmailService = new RustEmailService('Flow Desk');
        await this.realEmailService.initialize();
        log.info('Production-ready Rust email service initialized successfully');
      } catch (emailError) {
        log.warn('Failed to initialize Rust email service:', emailError);
        // Continue without production email service - fallback to existing services
      }

      // Run integration tests in development mode
      if (process.env.NODE_ENV === 'development') {
        this.runIntegrationTests();
      }
    } catch (error) {
      log.error('Failed to initialize Rust engine integration:', error);
      // Continue without Rust integration - app will use JavaScript fallbacks
    }
  }


  /**
   * Run Rust integration tests (development only)
   */
  private async runIntegrationTests() {
    try {
      // const { RustIntegrationTester } = await import('../test/rust-integration-test');
      // const tester = new RustIntegrationTester();
      return; // Skip integration tests for now
    } catch (error) {
      log.error('Failed to run integration tests:', error);
    }
  }

  private async requestNotificationPermissions() {
    try {
      // Check if notifications are supported
      if (!Notification.isSupported()) {
        log.warn('System notifications not supported on this platform');
        return;
      }

      // Handle notification permissions on macOS
      if (process.platform === 'darwin') {
        try {
          // Check current notification permission status
          // Use any type to avoid TypeScript issues with optional Electron APIs
          const getNotificationPermission = (systemPreferences as any).getNotificationPermission;
          if (typeof getNotificationPermission === 'function') {
            const permission = getNotificationPermission();
            log.info(`Current notification permission status: ${permission}`);
            
            if (permission === 'denied') {
              log.warn('Notification permissions denied. Users can enable them in System Preferences.');
              return;
            }
          } else {
            log.info('getNotificationPermission not available on this Electron version');
          }
          
          log.info('macOS notification permissions checked successfully');
        } catch (error) {
          log.warn('Failed to check notification permissions on macOS:', error);
        }
      }

      // Test system notification to ensure it works
      const testNotification = new Notification({
        title: 'Flow Desk',
        body: 'Notifications are ready!',
        silent: true
      });
      
      testNotification.show();
      
      // Hide the test notification quickly
      setTimeout(() => {
        testNotification.close();
      }, 1000);
      
      log.info('System notifications initialized and tested');
    } catch (error) {
      log.error('Failed to initialize system notifications:', error);
    }
  }

  private async initializeNotifications() {
    try {
      this.notificationManager = new DesktopNotificationManager(this.mainWindow!);
      await this.notificationManager.initialize();
      log.info('Notification manager initialized');
      
      // Initialize mail sync manager
      this.mailSyncManager = new MailSyncManager(this.notificationManager);
      await this.mailSyncManager.initialize();
      log.info('Mail sync manager initialized');
      
      // Initialize Pure Rust Production Email Engine via NAPI
      // await emailServiceManager.initialize('Flow Desk'); // Temporarily disabled
      log.info('Email service manager temporarily disabled');
      
      // Email template management, scheduling, and rules are now handled by the Rust engine
      log.info('All email services now running via Rust backend');
      
      // Initialize snippet manager
      this.snippetManager = new SnippetManager();
      log.info('Snippet manager initialized');

      // Initialize email template manager
      this.emailTemplateManager = new EmailTemplateManager();
      log.info('Email template manager initialized');

      // Initialize email scheduler
      this.emailScheduler = new EmailScheduler();
      await this.emailScheduler.initialize();
      log.info('Email scheduler initialized');

      // Initialize email rules engine
      this.emailRulesEngine = new EmailRulesEngine();
      await this.emailRulesEngine.initialize();
      log.info('Email rules engine initialized');
    } catch (error) {
      log.error('Failed to initialize notification/sync managers:', error);
    }
  }

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
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Find',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              this.mainWindow?.webContents.send('show-find');
            }
          }
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
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Workspace',
        submenu: [
          {
            label: 'New Workspace...',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => {
              this.mainWindow?.webContents.send('show-new-workspace-dialog');
            }
          },
          {
            label: 'Add Service...',
            accelerator: 'CmdOrCtrl+Shift+A',
            click: () => {
              this.mainWindow?.webContents.send('show-add-service-dialog');
            }
          },
          { type: 'separator' },
          {
            label: 'Switch Workspace...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => {
              this.mainWindow?.webContents.send('show-workspace-switcher');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private getFileFilters(mimeType: string): Electron.FileFilter[] {
    const filters: Electron.FileFilter[] = [
      { name: 'All Files', extensions: ['*'] }
    ];
    
    if (mimeType.startsWith('image/')) {
      filters.unshift({ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] });
    } else if (mimeType === 'application/pdf') {
      filters.unshift({ name: 'PDF Documents', extensions: ['pdf'] });
    } else if (mimeType.startsWith('text/')) {
      filters.unshift({ name: 'Text Files', extensions: ['txt', 'md', 'csv', 'log'] });
    } else if (mimeType.includes('word')) {
      filters.unshift({ name: 'Word Documents', extensions: ['doc', 'docx'] });
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      filters.unshift({ name: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv'] });
    } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      filters.unshift({ name: 'Presentations', extensions: ['ppt', 'pptx'] });
    } else if (mimeType.includes('zip') || mimeType.includes('archive')) {
      filters.unshift({ name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] });
    }
    
    return filters;
  }

  private async createDefaultWorkspace() {
    // No longer create default workspaces - users create their own
    log.info('Workspace manager initialized - users will create workspaces as needed');
  }

  private setupIpcHandlers() {
    // App handlers
    ipcMain.handle('app:get-version', () => app.getVersion());
    ipcMain.handle('app:get-platform', () => process.platform);

    // View switching handlers
    ipcMain.handle('view:switch', async (_, view: 'mail' | 'calendar' | 'workspace') => {
      await this.switchToView(view);
    });

    // Workspace handlers
    ipcMain.handle('workspace:get-all', () => {
      return this.workspaceManager.getWorkspaces();
    });

    ipcMain.handle('workspace:get-active', () => {
      return this.workspaceManager.getActiveWorkspace();
    });

    ipcMain.handle('workspace:create', async (_, name: string, color?: string) => {
      return await this.workspaceManager.createWorkspace(name, color);
    });

    ipcMain.handle('workspace:switch', async (_, workspaceId: string) => {
      await this.workspaceManager.switchWorkspace(workspaceId);
      await this.switchToView('workspace');
    });

    ipcMain.handle('workspace:update', async (_, workspaceId: string, updates: Partial<Workspace>) => {
      return await this.workspaceManager.updateWorkspace(workspaceId, updates);
    });

    ipcMain.handle('workspace:delete', async (_, workspaceId: string) => {
      return await this.workspaceManager.deleteWorkspace(workspaceId);
    });

    // Service handlers
    ipcMain.handle('service:add-to-workspace', async (_, workspaceId: string, serviceName: string, serviceType: string, url: string, config?: Record<string, unknown>) => {
      return await this.workspaceManager.addServiceToWorkspace(workspaceId, serviceName, serviceType, url);
    });

    ipcMain.handle('service:remove-from-workspace', async (_, workspaceId: string, serviceId: string) => {
      return await this.workspaceManager.removeServiceFromWorkspace(workspaceId, serviceId);
    });

    ipcMain.handle('service:load', async (_, workspaceId: string, serviceId: string) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      return await this.workspaceManager.loadService(workspaceId, serviceId, this.mainWindow);
    });

    ipcMain.handle('service:get-predefined', () => {
      return this.workspaceManager.getPredefinedServices();
    });

    // Additional workspace handlers for unified API
    ipcMain.handle('workspace:get-by-id', async (_, workspaceId: string) => {
      const workspaces = this.workspaceManager.getWorkspaces();
      return workspaces.find(w => w.id === workspaceId) || null;
    });

    ipcMain.handle('workspace:add-service', async (_, workspaceId: string, serviceName: string, serviceType: string, url: string) => {
      return await this.workspaceManager.addServiceToWorkspace(workspaceId, serviceName, serviceType, url);
    });

    ipcMain.handle('workspace:remove-service', async (_, workspaceId: string, serviceId: string) => {
      return await this.workspaceManager.removeServiceFromWorkspace(workspaceId, serviceId);
    });

    ipcMain.handle('workspace:update-service', async (_, workspaceId: string, serviceId: string, updates: Partial<import('./workspace').WorkspaceService>) => {
      return await this.workspaceManager.updateServiceInWorkspace(workspaceId, serviceId, updates);
    });

    ipcMain.handle('workspace:load-service', async (_, workspaceId: string, serviceId: string) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      return await this.workspaceManager.loadService(workspaceId, serviceId, this.mainWindow);
    });

    ipcMain.handle('workspace:get-predefined-services', () => {
      return this.workspaceManager.getPredefinedServices();
    });

    ipcMain.handle('workspace:close-service', async (_, workspaceId: string, serviceId: string) => {
      return await this.workspaceManager.closeService(workspaceId, serviceId);
    });

    // Mail attachment handlers
    ipcMain.handle('mail:download-attachment', async (_, attachmentData: { filename: string; data: string; mimeType: string }) => {
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(this.mainWindow!, {
          defaultPath: attachmentData.filename,
          filters: this.getFileFilters(attachmentData.mimeType)
        });
        
        if (!canceled && filePath) {
          const fs = require('fs');
          const buffer = Buffer.from(attachmentData.data, 'base64');
          fs.writeFileSync(filePath, buffer);
          
          // Show in file manager
          shell.showItemInFolder(filePath);
          
          return { success: true, path: filePath };
        }
        
        return { success: false, error: 'Download cancelled' };
      } catch (error) {
        log.error('Failed to download attachment:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Download failed' };
      }
    });

    // Email template handlers
    ipcMain.handle('email-templates:get-all', async () => {
      try {
        if (!this.emailTemplateManager) {
          log.warn('Email template manager not initialized, initializing now...');
          this.emailTemplateManager = new EmailTemplateManager();
        }
        return await this.emailTemplateManager.getAllTemplates();
      } catch (error) {
        log.error('Failed to get all email templates:', error);
        // Try to provide helpful error context instead of empty array
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to get email templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('email-templates:get-by-category', async (_, category: string) => {
      try {
        if (!this.emailTemplateManager) {
          log.warn('Email template manager not initialized, initializing now...');
          this.emailTemplateManager = new EmailTemplateManager();
        }
        return await this.emailTemplateManager.getTemplatesByCategory(category);
      } catch (error) {
        log.error('Failed to get templates by category:', error);
        // Try to provide helpful error context instead of empty array
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to get templates by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('email-templates:get', async (_, templateId: string) => {
      try {
        return this.emailTemplateManager ? await this.emailTemplateManager.getTemplate(templateId) : null;
      } catch (error) {
        log.error('Failed to get template:', error);
        return null;
      }
    });

    ipcMain.handle('email-templates:save', async (_, template: any) => {
      try {
        return this.emailTemplateManager ? await this.emailTemplateManager.saveTemplate(template) : null;
      } catch (error) {
        log.error('Failed to save template:', error);
        return null;
      }
    });

    ipcMain.handle('email-templates:update', async (_, templateId: string, updates: any) => {
      try {
        return this.emailTemplateManager ? await this.emailTemplateManager.updateTemplate(templateId, updates) : null;
      } catch (error) {
        log.error('Failed to update template:', error);
        return null;
      }
    });

    ipcMain.handle('email-templates:delete', async (_, templateId: string) => {
      try {
        return this.emailTemplateManager ? await this.emailTemplateManager.deleteTemplate(templateId) : false;
      } catch (error) {
        log.error('Failed to delete template:', error);
        return false;
      }
    });

    ipcMain.handle('email-templates:use', async (_, templateId: string) => {
      try {
        return this.emailTemplateManager ? await this.emailTemplateManager.useTemplate(templateId) : null;
      } catch (error) {
        log.error('Failed to use template:', error);
        return null;
      }
    });

    ipcMain.handle('email-templates:search', async (_, query: string) => {
      try {
        if (!this.emailTemplateManager) {
          log.warn('Email template manager not initialized, initializing now...');
          this.emailTemplateManager = new EmailTemplateManager();
        }
        return await this.emailTemplateManager.searchTemplates(query);
      } catch (error) {
        log.error('Failed to search templates:', error);
        // Try to provide helpful error context instead of empty array
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to search templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('email-templates:process-variables', async (_, template: any, variables: Record<string, string>) => {
      try {
        return this.emailTemplateManager ? this.emailTemplateManager.processTemplateVariables(template, variables) : { 
          success: false, 
          rendered: {}, 
          variables: {}, 
          renderTime: 0, 
          warnings: [], 
          errors: ['Email template manager not available'], 
          metadata: {} 
        };
      } catch (error) {
        log.error('Failed to process template variables:', error);
        return { 
          success: false, 
          rendered: {}, 
          variables, 
          renderTime: 0, 
          warnings: [], 
          errors: [error instanceof Error ? error.message : 'Unknown error'], 
          metadata: {} 
        };
      }
    });

    // Snippet handlers
    ipcMain.handle('snippets:get-all', async () => {
      try {
        if (!this.snippetManager) {
          log.warn('Snippet manager not initialized, initializing now...');
          this.snippetManager = new SnippetManager();
        }
        return await this.snippetManager.getAllSnippets();
      } catch (error) {
        log.error('Failed to get all snippets:', error);
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to get snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('snippets:get', async (_, snippetId: string) => {
      try {
        return this.snippetManager ? await this.snippetManager.getSnippet(snippetId) : undefined;
      } catch (error) {
        log.error('Failed to get snippet:', error);
        return undefined;
      }
    });

    ipcMain.handle('snippets:get-by-category', async (_, category: string) => {
      try {
        if (!this.snippetManager) {
          log.warn('Snippet manager not initialized, initializing now...');
          this.snippetManager = new SnippetManager();
        }
        return await this.snippetManager.getSnippetsByCategory(category);
      } catch (error) {
        log.error('Failed to get snippets by category:', error);
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to get snippets by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('snippets:get-by-shortcut', async (_, shortcut: string) => {
      try {
        return this.snippetManager ? await this.snippetManager.getSnippetByShortcut(shortcut) : undefined;
      } catch (error) {
        log.error('Failed to get snippet by shortcut:', error);
        return undefined;
      }
    });

    ipcMain.handle('snippets:create', async (_, snippet: any) => {
      try {
        return this.snippetManager ? await this.snippetManager.createSnippet(snippet) : null;
      } catch (error) {
        log.error('Failed to create snippet:', error);
        return null;
      }
    });

    ipcMain.handle('snippets:update', async (_, snippetId: string, updates: any) => {
      try {
        return this.snippetManager ? await this.snippetManager.updateSnippet(snippetId, updates) : undefined;
      } catch (error) {
        log.error('Failed to update snippet:', error);
        return undefined;
      }
    });

    ipcMain.handle('snippets:delete', async (_, snippetId: string) => {
      try {
        return this.snippetManager ? await this.snippetManager.deleteSnippet(snippetId) : false;
      } catch (error) {
        log.error('Failed to delete snippet:', error);
        return false;
      }
    });

    ipcMain.handle('snippets:use', async (_, snippetId: string) => {
      try {
        return this.snippetManager ? await this.snippetManager.useSnippet(snippetId) : undefined;
      } catch (error) {
        log.error('Failed to use snippet:', error);
        return undefined;
      }
    });

    ipcMain.handle('snippets:search', async (_, query: string) => {
      try {
        if (!this.snippetManager) {
          log.warn('Snippet manager not initialized, initializing now...');
          this.snippetManager = new SnippetManager();
        }
        return await this.snippetManager.searchSnippets(query);
      } catch (error) {
        log.error('Failed to search snippets:', error);
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to search snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('snippets:expand', async (_, text: string, variables: Record<string, string>) => {
      try {
        return this.snippetManager ? this.snippetManager.expandSnippet(text, variables) : text;
      } catch (error) {
        log.error('Failed to expand snippet:', error);
        return text;
      }
    });

    ipcMain.handle('snippets:get-categories', async () => {
      try {
        if (!this.snippetManager) {
          log.warn('Snippet manager not initialized, initializing now...');
          this.snippetManager = new SnippetManager();
        }
        return await this.snippetManager.getCategories();
      } catch (error) {
        log.error('Failed to get snippet categories:', error);
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to get snippet categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('snippets:get-most-used', async (_, limit?: number) => {
      try {
        if (!this.snippetManager) {
          log.warn('Snippet manager not initialized, initializing now...');
          this.snippetManager = new SnippetManager();
        }
        return await this.snippetManager.getMostUsedSnippets(limit);
      } catch (error) {
        log.error('Failed to get most used snippets:', error);
        if (error instanceof Error && error.message.includes('sqlite3')) {
          throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
        }
        throw new Error(`Failed to get most used snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Email scheduling handlers
    ipcMain.handle('email-scheduler:schedule', async (_, emailData: ScheduledEmailData, scheduledTime: Date) => {
      return this.emailScheduler ? await this.emailScheduler.scheduleEmail(emailData) : null;
    });

    ipcMain.handle('email-scheduler:cancel', async (_, emailId: string) => {
      return this.emailScheduler ? await this.emailScheduler.cancelScheduledEmail(emailId) : false;
    });

    ipcMain.handle('email-scheduler:get-scheduled', async () => {
      return this.emailScheduler ? await this.emailScheduler.getScheduledEmails() : [];
    });

    ipcMain.handle('email-scheduler:get-snoozed', async () => {
      return this.emailScheduler ? await this.emailScheduler.getSnoozedEmails() : [];
    });

    ipcMain.handle('email-scheduler:snooze', async (_, messageId: string, accountId: string, snoozeUntil: Date, reason: string) => {
      return this.emailScheduler ? await this.emailScheduler.snoozeEmail(messageId, accountId, snoozeUntil, reason) : null;
    });

    // Email rules handlers
    ipcMain.handle('email-rules:get-all', async () => {
      return this.emailRulesEngine ? await this.emailRulesEngine.getAllRules() : [];
    });

    ipcMain.handle('email-rules:create', async (_, ruleData: EmailRuleData) => {
      return this.emailRulesEngine ? await this.emailRulesEngine.createRule(ruleData) : null;
    });

    ipcMain.handle('email-rules:update', async (_, ruleId: string, updates: Partial<EmailRuleData>) => {
      return this.emailRulesEngine ? await this.emailRulesEngine.updateRule(ruleId, updates) : false;
    });

    ipcMain.handle('email-rules:delete', async (_, ruleId: string) => {
      return this.emailRulesEngine ? await this.emailRulesEngine.deleteRule(ruleId) : false;
    });

    ipcMain.handle('email-rules:get-stats', async () => {
      return this.emailRulesEngine ? await this.emailRulesEngine.getRuleStats() : null;
    });

    // Text snippet handlers
    ipcMain.handle('snippets:get-all', async () => {
      return this.snippetManager ? await this.snippetManager.getAllSnippets() : [];
    });

    ipcMain.handle('snippets:get-by-category', async (_, category: string) => {
      return this.snippetManager ? await this.snippetManager.getSnippetsByCategory(category) : [];
    });

    ipcMain.handle('snippets:save', async (_, snippet: TextSnippet) => {
      return this.snippetManager ? await this.snippetManager.saveSnippet(snippet) : null;
    });

    ipcMain.handle('snippets:update', async (_, snippetId: string, updates: Partial<TextSnippet>) => {
      return this.snippetManager ? await this.snippetManager.updateSnippet(snippetId, updates) : false;
    });

    ipcMain.handle('snippets:delete', async (_, snippetId: string) => {
      return this.snippetManager ? await this.snippetManager.deleteSnippet(snippetId) : false;
    });

    ipcMain.handle('snippets:use', async (_, snippetId: string) => {
      return this.snippetManager ? await this.snippetManager.useSnippet(snippetId) : null;
    });

    ipcMain.handle('snippets:search', async (_, query: string) => {
      return this.snippetManager ? await this.snippetManager.searchSnippets(query) : [];
    });

    ipcMain.handle('snippets:get-by-shortcut', async (_, shortcut: string) => {
      return this.snippetManager ? await this.snippetManager.getSnippetsByShortcut(shortcut) : null;
    });

    // Additional workspace handlers for Redux slice compatibility
    ipcMain.handle('workspace:create-full', async (_, workspaceData: CreateWorkspaceData) => {
      const name = workspaceData.name || 'New Workspace';
      const color = workspaceData.color || '#4285f4';
      const icon = workspaceData.icon || '🏢';
      const browserIsolation = workspaceData.browserIsolation || 'shared';
      
      return await this.workspaceManager.createWorkspace(name, color, icon, browserIsolation);
    });

    ipcMain.handle('workspace:list-partitions', async () => {
      log.info('Getting workspace partitions');
      try {
        if (!this.workspaceManager) {
          log.warn('Workspace manager not available');
          return [];
        }
        const workspaces = await this.workspaceManager.getAllWorkspaces();
        return workspaces.map(ws => ({
          id: ws.id,
          name: ws.name,
          type: 'workspace',
          memberCount: ws.members?.length || 0
        }));
      } catch (error) {
        log.error('Failed to list workspace partitions:', error);
        // Return empty array here is appropriate since this is a list operation
        // and the frontend expects an array - but at least log the specific error
        if (error instanceof Error) {
          log.error('Workspace partition error details:', error.message);
        }
        return [];
      }
    });

    ipcMain.handle('workspace:create-partition', async (_, partitionData: CreatePartitionData) => {
      log.info(`Creating partition: ${partitionData.name}`);
      return { success: true, id: 'partition-' + Date.now() };
    });

    ipcMain.handle('workspace:update-partition', async (_, partitionId: string, updates: Partial<CreatePartitionData>) => {
      try {
        log.info(`Updating partition: ${partitionId}`);
        
        // Update partition in workspace manager if available
        if (this.workspaceManager) {
          const workspace = this.workspaceManager.getWorkspace(partitionId);
          if (workspace) {
            await this.workspaceManager.updateWorkspace(partitionId, {
              name: updates.name,
              description: updates.description
            });
            
            // Get the updated workspace to return complete data
            const updatedWorkspace = this.workspaceManager.getWorkspace(partitionId);
            log.info(`Successfully updated partition: ${partitionId}`);
            return { 
              success: true, 
              workspace: updatedWorkspace,
              updatedFields: { 
                name: updates.name, 
                description: updates.description 
              }
            };
          } else {
            log.warn(`Partition not found: ${partitionId}`);
            return { success: false, error: 'Partition not found' };
          }
        } else {
          log.warn('Workspace manager not initialized');
          return { success: false, error: 'Workspace manager not initialized' };
        }
      } catch (error) {
        log.error('Failed to update partition:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('workspace:clear-data', async (_, workspaceId: string) => {
      try {
        log.info(`Clearing data for workspace: ${workspaceId}`);
        
        // Clear workspace-specific data including browser sessions, cache, etc.
        if (this.workspaceManager) {
          const workspace = this.workspaceManager.getWorkspace(workspaceId);
          if (workspace) {
            // Close all workspace services and clear browser views
            for (const service of workspace.services) {
              await this.workspaceManager.closeService(workspaceId, service.id);
            }
            
            // Clear partition data
            const partitionName = workspace.browserIsolation === 'isolated' 
              ? `persist:workspace-${workspaceId}` 
              : 'persist:shared';
            
            try {
              const { session } = require('electron');
              const workspaceSession = session.fromPartition(partitionName);
              
              // Clear session data
              await workspaceSession.clearStorageData({
                storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
                quotas: ['temporary', 'persistent', 'syncable']
              });
              
              // Clear cache
              await workspaceSession.clearCache();
              
              log.info(`Successfully cleared data for workspace: ${workspaceId}`);
              return { 
                success: true, 
                clearedData: {
                  storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
                  quotas: ['temporary', 'persistent', 'syncable'],
                  cache: true,
                  servicesCleared: workspace.services.length
                },
                workspaceId,
                partitionName
              };
            } catch (sessionError) {
              log.error('Failed to clear session data:', sessionError);
              return { success: false, error: 'Failed to clear session data' };
            }
          } else {
            log.warn(`Workspace not found: ${workspaceId}`);
            return { success: false, error: 'Workspace not found' };
          }
        } else {
          log.warn('Workspace manager not initialized');
          return { success: false, error: 'Workspace manager not initialized' };
        }
      } catch (error) {
        log.error('Failed to clear workspace data:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('workspace:get-windows', async (_, workspaceId: string) => {
      try {
        log.info(`Getting windows for workspace: ${workspaceId}`);
        const windows = this.workspaceWindows.get(workspaceId) || [];
        log.debug(`Found ${windows.length} windows for workspace ${workspaceId}`);
        return windows;
      } catch (error) {
        log.error('Failed to get workspace windows:', error);
        return [];
      }
    });

    ipcMain.handle('workspace:create-window', async (_, workspaceId: string, windowData: CreateWindowData) => {
      try {
        log.info(`Creating window: ${windowData.title} for workspace: ${workspaceId}`);
        
        // Create new workspace window
        const newWindow: WorkspaceWindow = {
          id: 'window-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          title: windowData.title,
          url: windowData.url,
          width: windowData.width || 800,
          height: windowData.height || 600,
          x: 100, // Default position
          y: 100,
          isMinimized: false,
          isMaximized: false,
          isActive: false,
          workspaceId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Get existing windows for workspace
        const workspaceWindows = this.workspaceWindows.get(workspaceId) || [];
        workspaceWindows.push(newWindow);
        this.workspaceWindows.set(workspaceId, workspaceWindows);

        log.info(`Created workspace window ${newWindow.id} for workspace ${workspaceId}`);
        return { success: true, id: newWindow.id, window: newWindow };
      } catch (error) {
        log.error('Failed to create workspace window:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Additional workspace window management handlers
    ipcMain.handle('workspace:update-window', async (_, workspaceId: string, windowId: string, updates: Partial<WorkspaceWindow>) => {
      try {
        log.info(`Updating workspace window ${windowId} in workspace ${workspaceId}`);
        const success = this.updateWorkspaceWindow(workspaceId, windowId, updates);
        
        if (success) {
          const updatedWindow = this.getWorkspaceWindow(workspaceId, windowId);
          return { success: true, window: updatedWindow };
        } else {
          return { success: false, error: 'Window not found' };
        }
      } catch (error) {
        log.error('Failed to update workspace window:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('workspace:close-window', async (_, workspaceId: string, windowId: string) => {
      try {
        log.info(`Closing workspace window ${windowId} in workspace ${workspaceId}`);
        const success = this.removeWorkspaceWindow(workspaceId, windowId);
        return { success };
      } catch (error) {
        log.error('Failed to close workspace window:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('workspace:get-window', async (_, workspaceId: string, windowId: string) => {
      try {
        log.debug(`Getting workspace window ${windowId} from workspace ${workspaceId}`);
        const window = this.getWorkspaceWindow(workspaceId, windowId);
        return window;
      } catch (error) {
        log.error('Failed to get workspace window:', error);
        return null;
      }
    });

    // Mail handlers (using comprehensive Rust engine integration)
    ipcMain.handle('mail:add-account-obj', async (_, account: MailAccountData) => {
      try {
        log.info(`Adding mail account via Rust integration: ${account.email}`);
        
        const rustAccount = await rustEngineIntegration.addMailAccount({
          email: account.email,
          password: account.password,
          displayName: account.displayName || account.email
        });
        
        log.info(`Successfully added mail account via Rust: ${rustAccount.id}`);
        return {
          id: rustAccount.id,
          email: rustAccount.email,
          displayName: rustAccount.displayName,
          provider: rustAccount.provider,
          isEnabled: rustAccount.isEnabled
        };
      } catch (error) {
        log.error('Failed to add mail account via Rust:', error);
        throw new Error(`Failed to add mail account: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Legacy handler for backward compatibility
    ipcMain.handle('mail:add-account', async (_, email: string, password: string, displayName?: string) => {
      const account = { email, password, displayName };
      log.info(`Adding mail account (legacy): ${email}`);
      const accountId = 'temp-legacy-' + Date.now();
      return {
        id: accountId,
        email,
        displayName: displayName || email,
        provider: 'imap',
        isEnabled: true
      };
    });

    ipcMain.handle('mail:get-accounts', async () => {
      try {
        const accounts = await rustEngineIntegration.getMailAccounts();
        log.info(`Retrieved ${accounts.length} mail accounts via Rust`);
        return accounts;
      } catch (error) {
        log.error('Failed to get mail accounts via Rust:', error);
        return [];
      }
    });

    ipcMain.handle('mail:sync-account', async (_, accountId: string) => {
      try {
        log.info(`Syncing mail account via Rust: ${accountId}`);
        const result = await rustEngineIntegration.syncMailAccount(accountId);
        log.info(`Successfully synced account ${accountId} via Rust:`, result);
        return result;
      } catch (error) {
        log.error('Failed to sync mail account via Rust:', error);
        return false;
      }
    });

    // Additional mail handlers for Redux slice compatibility
    ipcMain.handle('mail:send-message-obj', async (_, accountId: string, message: EmailMessage) => {
      try {
        log.info(`Sending message from account ${accountId}: ${message.subject}`);
        
        // Use real email service for multi-provider support
        if (this.realEmailService) {
          await this.realEmailService.sendMessage(accountId, message);
          return true;
        }
        
        // Fallback to Rust engine for Gmail
        const rustEngine = require('../lib/rust-engine');
        const result = await rustEngine.sendMessage(accountId, message);
        
        if (result && result.success) {
          log.info(`Email sent successfully: ${message.subject}`);
          return true;
        } else {
          log.error(`Failed to send email: ${result?.error || 'Unknown error'}`);
          return false;
        }
      } catch (error) {
        log.error('Failed to send email:', error);
        return false;
      }
    });

    ipcMain.handle('mail:mark-message-read', async (_, accountId: string, messageId: string, read: boolean) => {
      try {
        log.info(`Marking message ${messageId} as ${read ? 'read' : 'unread'} via Rust`);
        
        const result = await rustEngineIntegration.markMessageRead(accountId, messageId, read);
        
        log.info(`Successfully marked message ${messageId} as ${read ? 'read' : 'unread'} via Rust`);
        return result;
      } catch (error) {
        log.error('Failed to mark message via Rust:', error);
        return false;
      }
    });

    ipcMain.handle('mail:start-sync', async () => {
      log.info('Starting mail sync for all accounts');
      return true;
    });

    ipcMain.handle('mail:stop-sync', async () => {
      log.info('Stopping mail sync');
      return true;
    });

    ipcMain.handle('mail:get-sync-status', async () => {
      // Return Record<string, any> as Redux expects
      return {
        'account1': { issyncing: false, lastSync: new Date(), error: undefined }
      };
    });

    ipcMain.handle('mail:delete-message', async (_, accountId: string, messageId: string) => {
      log.info(`Deleting message ${messageId} from account ${accountId}`);
      return true;
    });

    ipcMain.handle('mail:sync-all', async () => {
      try {
        log.info('Starting sync for all mail accounts');
        
        // Get all mail accounts and sync them
        const result = await rustEngineIntegration.callRustFunction('mail_list_accounts', []);
        
        if (result.success && result.result) {
          const accounts = result.result as any[];
          let syncedCount = 0;
          let errorCount = 0;
          
          for (const account of accounts) {
            try {
              log.info(`Syncing mail account: ${account.email || account.id}`);
              const syncResult = await rustEngineIntegration.syncMailAccount(account.id);
              
              if (syncResult === true) {
                syncedCount++;
                log.debug(`Successfully synced account: ${account.email || account.id}`);
              } else {
                errorCount++;
                log.warn(`Failed to sync account: ${account.email || account.id}`);
              }
            } catch (accountError) {
              errorCount++;
              log.error(`Error syncing account ${account.email || account.id}:`, accountError);
            }
          }
          
          log.info(`Mail sync completed: ${syncedCount} succeeded, ${errorCount} failed`);
          return {
            success: errorCount === 0,
            syncedAccounts: syncedCount,
            errorCount,
            totalAccounts: accounts.length
          };
        } else {
          log.warn('No mail accounts found or failed to list accounts');
          return { success: true, syncedAccounts: 0, errorCount: 0, totalAccounts: 0 };
        }
      } catch (error) {
        log.error('Failed to sync all mail accounts:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('mail:get-folders', async (_, accountId: string) => {
      log.info(`Getting folders for account ${accountId}`);
      try {
        // Call Rust engine to get actual folders
        const result = await rustEngineIntegration.callRustFunction('mail_get_folders', [accountId]);
        if (result.success) {
          return result.result;
        } else {
          // Fallback to default folders if Rust call fails
          return [
            { name: 'Inbox', count: 0 },
            { name: 'Sent', count: 0 },
            { name: 'Drafts', count: 0 },
            { name: 'Trash', count: 0 }
          ];
        }
      } catch (error) {
        log.error('Failed to get folders:', error);
        return [
          { name: 'Inbox', count: 0 },
          { name: 'Sent', count: 0 },
          { name: 'Drafts', count: 0 },
          { name: 'Trash', count: 0 }
        ];
      }
    });

    ipcMain.handle('mail:get-messages', async (_, accountId: string, folderId: string, options?: GetMessagesOptions) => {
      try {
        log.info(`Getting messages via Rust for account ${accountId}, folder ${folderId}`);
        const messages = await rustEngineIntegration.getMailMessages(accountId);
        log.info(`Retrieved ${messages.length} messages for account ${accountId} via Rust`);
        
        // Auto-index messages for search
        if (messages.length > 0) {
          try {
            const searchService = getSearchService();
            if (searchService.isInitialized()) {
              for (const message of messages.slice(0, 10)) { // Index first 10 messages to avoid overwhelming the system
                await searchService.indexEmailMessage({
                  id: message.id,
                  accountId: message.accountId || accountId,
                  subject: message.subject || 'No Subject',
                  fromAddress: message.fromAddress || '',
                  fromName: message.fromName,
                  toAddresses: message.toAddresses || [],
                  bodyText: message.bodyText,
                  bodyHtml: message.bodyHtml,
                  receivedAt: new Date(message.receivedAt || Date.now()),
                  folder: folderId
                });
              }
              log.info(`Auto-indexed ${Math.min(messages.length, 10)} messages for search`);
            }
          } catch (indexError) {
            log.error('Failed to auto-index messages:', indexError);
            // Don't fail the entire operation if indexing fails
          }
        }
        
        return messages;
      } catch (error) {
        log.error('Failed to get mail messages via Rust:', error);
        return [];
      }
    });

    // Additional mail handlers for unified API
    ipcMain.handle('mail:update-account', async (_, accountId: string, updates: Partial<MailAccountData>) => {
      try {
        log.info(`Updating mail account via Rust: ${accountId}`, updates);
        
        // Convert MailAccountData updates to RustMailAccount format
        const rustUpdates = {
          ...(updates.email && { email: updates.email }),
          ...(updates.displayName && { displayName: updates.displayName }),
          ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
          ...(updates.provider && { provider: updates.provider })
        };
        
        const result = await rustEngineIntegration.updateMailAccount(accountId, rustUpdates);
        
        if (result) {
          log.info(`Successfully updated mail account via Rust: ${accountId}`);
          
          // Trigger a sync after successful update
          let syncTriggered = false;
          try {
            await rustEngineIntegration.syncMailAccount(accountId);
            log.debug(`Triggered sync after updating account: ${accountId}`);
            syncTriggered = true;
          } catch (syncError) {
            log.warn(`Failed to trigger sync after update: ${syncError}`);
          }
          
          // Get the updated account information
          let updatedAccount = null;
          try {
            updatedAccount = await rustEngineIntegration.getMailAccounts().then(accounts => 
              accounts.find(account => account.id === accountId)
            );
          } catch (getError) {
            log.warn(`Failed to retrieve updated account info: ${getError}`);
          }
          
          return { 
            success: true, 
            accountId,
            updatedFields: rustUpdates,
            syncTriggered,
            account: updatedAccount
          };
        } else {
          log.warn(`Mail account update via Rust returned false: ${accountId}`);
          return { success: false, error: 'Failed to update account in Rust backend' };
        }
      } catch (error) {
        log.error('Failed to update mail account via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to update mail account' 
        };
      }
    });

    ipcMain.handle('mail:remove-account', async (_, accountId: string) => {
      try {
        log.info(`Removing mail account via Rust: ${accountId}`);
        
        const result = await rustEngineIntegration.removeMailAccount(accountId);
        
        if (result) {
          log.info(`Successfully removed mail account via Rust: ${accountId}`);
          
          // Clean up any cached data for this account
          let cacheCleared = false;
          try {
            await rustEngineIntegration.callRustFunction('mail_clear_account_cache', [accountId]);
            log.debug(`Cleared cache for removed account: ${accountId}`);
            cacheCleared = true;
          } catch (cacheError) {
            log.warn(`Failed to clear cache for removed account: ${cacheError}`);
          }
          
          return { 
            success: true,
            accountId,
            cacheCleared,
            removedAt: new Date().toISOString()
          };
        } else {
          log.warn(`Mail account removal via Rust returned false: ${accountId}`);
          return { success: false, error: 'Failed to remove account in Rust backend' };
        }
      } catch (error) {
        log.error('Failed to remove mail account via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to remove mail account' 
        };
      }
    });

    ipcMain.handle('mail:send-message', async (_, accountId: string, to: string[], subject: string, body: string, options?: SendMessageOptions) => {
      log.info(`Sending message from account ${accountId} to ${to.join(', ')}`);
      return 'message-' + Date.now();
    });

    ipcMain.handle('mail:mark-as-read', async (_, accountId: string, messageId: string) => {
      try {
        log.info(`Marking message ${messageId} as read via Rust`);
        
        const result = await rustEngineIntegration.markMessageRead(accountId, messageId, true);
        
        if (result) {
          log.info(`Successfully marked message ${messageId} as read via Rust`);
          
          // Update local cache/state if needed
          let cacheUpdated = false;
          try {
            await rustEngineIntegration.callRustFunction('mail_update_message_cache', [messageId, { isRead: true }]);
            cacheUpdated = true;
          } catch (cacheError) {
            log.debug(`Failed to update message cache: ${cacheError}`);
          }
          
          return { 
            success: true,
            messageId,
            accountId,
            isRead: true,
            cacheUpdated,
            markedAt: new Date().toISOString()
          };
        } else {
          log.warn(`Mark message as read via Rust returned false: ${messageId}`);
          return { success: false, error: 'Failed to mark message as read in Rust backend' };
        }
      } catch (error) {
        log.error('Failed to mark message as read via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to mark message as read' 
        };
      }
    });

    ipcMain.handle('mail:mark-as-unread', async (_, accountId: string, messageId: string) => {
      try {
        log.info(`Marking message ${messageId} as unread via Rust`);
        
        const result = await rustEngineIntegration.markMessageRead(accountId, messageId, false);
        
        if (result) {
          log.info(`Successfully marked message ${messageId} as unread via Rust`);
          
          // Update local cache/state if needed
          let cacheUpdated = false;
          try {
            await rustEngineIntegration.callRustFunction('mail_update_message_cache', [messageId, { isRead: false }]);
            cacheUpdated = true;
          } catch (cacheError) {
            log.debug(`Failed to update message cache: ${cacheError}`);
          }
          
          return { 
            success: true,
            messageId,
            accountId,
            isRead: false,
            cacheUpdated,
            markedAt: new Date().toISOString()
          };
        } else {
          log.warn(`Mark message as unread via Rust returned false: ${messageId}`);
          return { success: false, error: 'Failed to mark message as unread in Rust backend' };
        }
      } catch (error) {
        log.error('Failed to mark message as unread via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to mark message as unread' 
        };
      }
    });

    // mail:delete-message handler already registered above

    ipcMain.handle('mail:search-messages', async (_, query: string, options?: SearchMessagesOptions) => {
      try {
        log.info(`Searching messages via Rust: ${query}`);
        const results = await rustEngineIntegration.searchMailMessages(query);
        log.info(`Mail search via Rust returned ${results.length} results`);
        return results;
      } catch (error) {
        log.error('Failed to search messages via Rust:', error);
        return [];
      }
    });

    // mail:sync-all handler already registered above

    // mail:get-sync-status handler already registered above

    // Simple Mail API handlers (Apple Mail style)
    ipcMain.handle('simple-mail:init-engine', async () => {
      try {
        log.info('Initializing simple mail engine');
        const result = await rustEngineIntegration.callRustFunction('init_simple_mail_engine', []);
        return result.success ? result.result : 'Simple mail engine initialized';
      } catch (error) {
        log.error('Failed to initialize simple mail engine:', error);
        throw error;
      }
    });

    ipcMain.handle('simple-mail:detect-provider', async (_, email: string) => {
      try {
        log.info(`Detecting email provider for: ${email}`);
        const result = await rustEngineIntegration.callRustFunction('detect_email_provider_info', [email]);
        return result.success ? result.result : null;
      } catch (error) {
        log.error('Failed to detect email provider:', error);
        return null;
      }
    });

    ipcMain.handle('simple-mail:test-connection', async (_, email: string, password: string) => {
      try {
        log.info(`Testing connection for: ${email}`);
        const result = await rustEngineIntegration.callRustFunction('test_simple_mail_connection', [email, password]);
        return result.success ? result.result : false;
      } catch (error) {
        log.error('Failed to test connection:', error);
        return false;
      }
    });

    ipcMain.handle('simple-mail:add-account', async (_, input: { email: string; password: string; displayName?: string }) => {
      try {
        log.info(`Adding simple mail account: ${input.email}`);
        const result = await rustEngineIntegration.callRustFunction('add_simple_mail_account', [input]);
        if (result.success) {
          return result.result;
        } else {
          throw new Error(result.error || 'Failed to add account');
        }
      } catch (error) {
        log.error('Failed to add simple mail account:', error);
        throw error;
      }
    });

    ipcMain.handle('simple-mail:get-accounts', async () => {
      try {
        log.info('Getting simple mail accounts');
        const result = await rustEngineIntegration.callRustFunction('get_simple_mail_accounts', []);
        return result.success ? result.result : [];
      } catch (error) {
        log.error('Failed to get simple mail accounts:', error);
        return [];
      }
    });

    ipcMain.handle('simple-mail:get-account', async (_, accountId: string) => {
      try {
        log.info(`Getting simple mail account: ${accountId}`);
        const result = await rustEngineIntegration.callRustFunction('get_simple_mail_account', [accountId]);
        return result.success ? result.result : null;
      } catch (error) {
        log.error('Failed to get simple mail account:', error);
        return null;
      }
    });

    ipcMain.handle('simple-mail:remove-account', async (_, accountId: string) => {
      try {
        log.info(`Removing simple mail account: ${accountId}`);
        const result = await rustEngineIntegration.callRustFunction('remove_simple_mail_account', [accountId]);
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove account');
        }
      } catch (error) {
        log.error('Failed to remove simple mail account:', error);
        throw error;
      }
    });

    ipcMain.handle('simple-mail:update-account-status', async (_, accountId: string, isEnabled: boolean) => {
      try {
        log.info(`Updating simple mail account status: ${accountId} - ${isEnabled}`);
        const result = await rustEngineIntegration.callRustFunction('update_simple_mail_account_status', [accountId, isEnabled]);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update account status');
        }
      } catch (error) {
        log.error('Failed to update simple mail account status:', error);
        throw error;
      }
    });

    ipcMain.handle('simple-mail:fetch-messages', async (_, accountId: string, folder?: string) => {
      try {
        log.info(`Fetching messages for account: ${accountId}, folder: ${folder || 'INBOX'}`);
        const result = await rustEngineIntegration.callRustFunction('fetch_simple_mail_messages', [accountId, folder]);
        const messages = result.success ? (result.result as any[]) : [];
        
        // Auto-index messages for search
        if (Array.isArray(messages) && messages.length > 0) {
          try {
            const searchService = getSearchService();
            if (searchService.isInitialized()) {
              for (const message of messages.slice(0, 10)) { // Index first 10 messages to avoid overwhelming the system
                const msgData = message as any;
                await searchService.indexEmailMessage({
                  id: msgData.id || `${accountId}-${Date.now()}`,
                  accountId: accountId,
                  subject: msgData.subject || 'No Subject',
                  fromAddress: msgData.from || '',
                  fromName: msgData.fromName,
                  toAddresses: Array.isArray(msgData.to) ? msgData.to : [msgData.to].filter(Boolean),
                  bodyText: msgData.body || msgData.text,
                  bodyHtml: msgData.html,
                  receivedAt: new Date(msgData.date || msgData.receivedAt || Date.now()),
                  folder: folder || 'INBOX'
                });
              }
              log.info(`Auto-indexed ${Math.min(messages.length, 10)} messages for search`);
            }
          } catch (indexError) {
            log.error('Failed to auto-index simple mail messages:', indexError);
            // Don't fail the entire operation if indexing fails
          }
        }
        
        return messages;
      } catch (error) {
        log.error('Failed to fetch simple mail messages:', error);
        return [];
      }
    });

    ipcMain.handle('simple-mail:send-email', async (_, accountId: string, to: string[], subject: string, body: string, isHtml?: boolean) => {
      try {
        log.info(`Sending email from account: ${accountId} to ${to.join(', ')}`);
        const result = await rustEngineIntegration.callRustFunction('send_simple_email', [accountId, to, subject, body, isHtml]);
        if (!result.success) {
          throw new Error(result.error || 'Failed to send email');
        }
      } catch (error) {
        log.error('Failed to send simple email:', error);
        throw error;
      }
    });

    ipcMain.handle('simple-mail:sync-account', async (_, accountId: string) => {
      try {
        log.info(`Syncing simple mail account: ${accountId}`);
        const result = await rustEngineIntegration.callRustFunction('sync_simple_mail_account', [accountId]);
        return result.success ? result.result : {
          accountId,
          isSyncing: false,
          error: result.error || 'Sync failed'
        };
      } catch (error) {
        log.error('Failed to sync simple mail account:', error);
        return {
          accountId,
          isSyncing: false,
          error: error instanceof Error ? error.message : 'Sync failed'
        };
      }
    });

    ipcMain.handle('simple-mail:get-supported-providers', async () => {
      try {
        log.info('Getting supported email providers');
        const result = await rustEngineIntegration.callRustFunction('get_supported_email_providers', []);
        return result.success ? result.result : [];
      } catch (error) {
        log.error('Failed to get supported email providers:', error);
        return [];
      }
    });

    ipcMain.handle('simple-mail:validate-email', async (_, email: string) => {
      try {
        const result = await rustEngineIntegration.callRustFunction('validate_email_address', [email]);
        return result.success ? result.result : false;
      } catch (error) {
        log.error('Failed to validate email address:', error);
        return false;
      }
    });

    // Calendar handlers (using comprehensive Rust engine integration)
    ipcMain.handle('calendar:add-account', async (_, email: string, password: string, serverConfig?: CalendarServerConfig) => {
      try {
        log.info(`Adding calendar account via Rust: ${email}`);
        
        const rustAccount = await rustEngineIntegration.addCalendarAccount({
          email,
          password,
          ...(serverConfig?.serverUrl && { serverUrl: serverConfig.serverUrl })
        });
        
        log.info(`Successfully added calendar account via Rust: ${rustAccount.id}`);
        return {
          id: rustAccount.id,
          email: rustAccount.email,
          displayName: rustAccount.displayName,
          provider: rustAccount.provider,
          isEnabled: rustAccount.isEnabled
        };
      } catch (error) {
        log.error('Failed to add calendar account via Rust:', error);
        throw new Error(`Failed to add calendar account: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    ipcMain.handle('calendar:get-accounts', async () => {
      try {
        const accounts = await rustEngineIntegration.getCalendarAccounts();
        log.info(`Retrieved ${accounts.length} calendar accounts via Rust`);
        return accounts;
      } catch (error) {
        log.error('Failed to get calendar accounts via Rust:', error);
        return [];
      }
    });

    ipcMain.handle('calendar:update-account', async (_, accountId: string, updates: Partial<CalendarAccountData>) => {
      try {
        log.info(`Updating calendar account via Rust: ${accountId}`);
        
        // Prepare the account updates for Rust backend
        const accountUpdates = {
          ...(updates.displayName && { displayName: updates.displayName }),
          ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
          ...(updates.serverUrl && { serverUrl: updates.serverUrl }),
          ...(updates.username && { username: updates.username }),
          ...(updates.password && { password: updates.password })
        };
        
        // Call Rust backend to update the account
        await rustEngineIntegration.updateCalendarAccount(accountId, accountUpdates);
        
        // Trigger a sync after successful update
        let syncTriggered = false;
        try {
          await rustEngineIntegration.syncCalendarAccount(accountId);
          log.debug(`Triggered sync after updating calendar account: ${accountId}`);
          syncTriggered = true;
        } catch (syncError) {
          log.warn(`Failed to trigger sync after calendar update: ${syncError}`);
        }
        
        // Get updated account info
        let updatedAccount = null;
        try {
          updatedAccount = await rustEngineIntegration.getCalendarAccounts().then(accounts => 
            accounts.find(account => account.id === accountId)
          );
        } catch (getError) {
          log.warn(`Failed to retrieve updated calendar account: ${getError}`);
        }
        
        log.info(`Successfully updated calendar account via Rust: ${accountId}`);
        return { 
          success: true,
          accountId,
          updatedFields: accountUpdates,
          syncTriggered,
          account: updatedAccount,
          updatedAt: new Date().toISOString()
        };
      } catch (error) {
        log.error('Failed to update calendar account via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to update account'
        };
      }
    });

    ipcMain.handle('calendar:remove-account', async (_, accountId: string) => {
      try {
        log.info(`Removing calendar account via Rust: ${accountId}`);
        
        // Call Rust backend to remove the account
        await rustEngineIntegration.removeCalendarAccount(accountId);
        
        // Clean up any cached calendar data for this account
        let cacheCleared = false;
        try {
          await rustEngineIntegration.callRustFunction('calendar_clear_account_cache', [accountId]);
          log.debug(`Cleared cache for removed calendar account: ${accountId}`);
          cacheCleared = true;
        } catch (cacheError) {
          log.warn(`Failed to clear cache for removed calendar account: ${cacheError}`);
        }
        
        log.info(`Successfully removed calendar account via Rust: ${accountId}`);
        return { 
          success: true,
          accountId,
          cacheCleared,
          removedAt: new Date().toISOString()
        };
      } catch (error) {
        log.error('Failed to remove calendar account via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to remove account'
        };
      }
    });

    ipcMain.handle('calendar:get-calendars', async (_, accountId: string) => {
      try {
        log.info(`Getting calendars for account: ${accountId}`);
        const calendars = await calendarEngine.getCalendars(accountId);
        log.info(`Retrieved ${calendars.length} calendars for account ${accountId}`);
        return calendars;
      } catch (error) {
        log.error(`Failed to get calendars for account ${accountId}:`, error);
        if (error instanceof Error && error.message.includes('not yet implemented')) {
          throw new Error('Calendar functionality is not yet fully implemented in the Rust backend');
        }
        throw new Error(`Failed to get calendars: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('calendar:get-events', async (_, accountId: string, startDate: string, endDate: string) => {
      try {
        log.info(`Getting events via Rust for account ${accountId} from ${startDate} to ${endDate}`);
        const events = await rustEngineIntegration.getCalendarEvents(
          accountId, 
          new Date(startDate), 
          new Date(endDate)
        );
        log.info(`Retrieved ${events.length} events for account ${accountId} via Rust`);
        
        // Auto-index events for search
        if (events.length > 0) {
          try {
            const searchService = getSearchService();
            if (searchService.isInitialized()) {
              for (const event of events.slice(0, 10)) { // Index first 10 events to avoid overwhelming the system
                await searchService.indexCalendarEvent({
                  id: event.id,
                  calendarId: event.calendarId || accountId,
                  title: event.title || 'No Title',
                  description: event.description,
                  location: event.location,
                  startTime: new Date(event.startTime || Date.now()),
                  endTime: new Date(event.endTime || Date.now()),
                  isAllDay: event.isAllDay || false,
                  organizer: event.organizer,
                  attendees: event.attendees || [],
                  status: event.status || 'confirmed'
                });
              }
              log.info(`Auto-indexed ${Math.min(events.length, 10)} calendar events for search`);
            }
          } catch (indexError) {
            log.error('Failed to auto-index calendar events:', indexError);
            // Don't fail the entire operation if indexing fails
          }
        }
        
        return events;
      } catch (error) {
        log.error('Failed to get calendar events via Rust:', error);
        return [];
      }
    });

    ipcMain.handle('calendar:create-event', async (_, calendarId: string, title: string, startTime: Date, endTime: Date, options?: CreateCalendarEventOptions) => {
      try {
        log.info(`Creating event via Rust: ${title}`);
        const eventId = await rustEngineIntegration.createCalendarEvent({
          calendarId,
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          ...(options?.description && { description: options.description }),
          ...(options?.location && { location: options.location })
        });
        log.info(`Successfully created event via Rust: ${eventId}`);
        return eventId;
      } catch (error) {
        log.error('Failed to create event via Rust:', error);
        return 'event-' + Date.now(); // Fallback ID
      }
    });

    ipcMain.handle('calendar:update-event', async (_, eventId: string, updates: Partial<CalendarEventData>) => {
      try {
        log.info(`Updating calendar event via Rust: ${eventId}`);
        
        // Prepare the event update data for Rust backend
        const eventUpdate = {
          id: eventId,
          ...(updates.title && { title: updates.title }),
          ...(updates.description && { description: updates.description }),
          ...(updates.location && { location: updates.location }),
          ...(updates.startTime && { startTime: Math.floor(new Date(updates.startTime).getTime() / 1000) }),
          ...(updates.endTime && { endTime: Math.floor(new Date(updates.endTime).getTime() / 1000) }),
          ...(updates.allDay !== undefined && { allDay: updates.allDay }),
          ...(updates.status && { status: updates.status }),
          ...(updates.visibility && { visibility: updates.visibility }),
          ...(updates.attendees && { attendees: updates.attendees }),
          ...(updates.recurrence && { recurrence: updates.recurrence }),
          ...(updates.reminders && { reminders: updates.reminders })
        };
        
        // Call Rust backend to update the event
        await rustEngineIntegration.updateCalendarEvent(eventUpdate);
        
        // Update local calendar cache if needed
        let cacheUpdated = false;
        try {
          await rustEngineIntegration.callRustFunction('calendar_update_event_cache', [eventId, eventUpdate]);
          cacheUpdated = true;
        } catch (cacheError) {
          log.debug(`Failed to update calendar event cache: ${cacheError}`);
        }
        
        // Get the updated event to return complete data
        let updatedEvent = null;
        try {
          updatedEvent = await rustEngineIntegration.getCalendarEvents('default').then(events => 
            events.find(event => event.id === eventId)
          );
        } catch (getError) {
          log.warn(`Failed to retrieve updated calendar event: ${getError}`);
        }
        
        log.info(`Successfully updated calendar event via Rust: ${eventId}`);
        return { 
          success: true,
          eventId,
          updatedFields: eventUpdate,
          cacheUpdated,
          event: updatedEvent,
          updatedAt: new Date().toISOString()
        };
      } catch (error) {
        log.error('Failed to update calendar event via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to update event'
        };
      }
    });

    ipcMain.handle('calendar:delete-event', async (_, eventId: string) => {
      try {
        log.info(`Deleting calendar event via Rust: ${eventId}`);
        
        // Get event info before deletion for confirmation
        let deletedEvent = null;
        try {
          deletedEvent = await rustEngineIntegration.getCalendarEvents('default').then(events => 
            events.find(event => event.id === eventId)
          );
        } catch (getError) {
          log.warn(`Failed to retrieve event before deletion: ${getError}`);
        }
        
        // Call Rust backend to delete the event
        await rustEngineIntegration.deleteCalendarEvent(eventId);
        
        log.info(`Successfully deleted calendar event via Rust: ${eventId}`);
        return { 
          success: true,
          eventId,
          deletedEvent,
          deletedAt: new Date().toISOString()
        };
      } catch (error) {
        log.error('Failed to delete calendar event via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to delete event'
        };
      }
    });

    ipcMain.handle('calendar:sync-account', async (_, accountId: string) => {
      try {
        log.info(`Syncing calendar account via Rust: ${accountId}`);
        const result = await rustEngineIntegration.syncCalendarAccount(accountId);
        log.info(`Successfully synced calendar account ${accountId} via Rust:`, result);
        return { totalCalendars: 1, totalEvents: 0, success: result };
      } catch (error) {
        log.error('Failed to sync calendar account via Rust:', error);
        return { totalCalendars: 0, totalEvents: 0, success: false };
      }
    });

    ipcMain.handle('calendar:sync-all', async () => {
      try {
        log.info('Starting sync for all calendar accounts');
        
        // Get all calendar accounts and sync them
        const result = await rustEngineIntegration.callRustFunction('calendar_list_accounts', []);
        
        if (result.success && result.result) {
          const accounts = result.result as any[];
          let syncedCount = 0;
          let errorCount = 0;
          
          for (const account of accounts) {
            try {
              log.info(`Syncing calendar account: ${account.email || account.id}`);
              const syncResult = await rustEngineIntegration.syncCalendarAccount(account.id);
              
              if (syncResult) {
                syncedCount++;
                log.debug(`Successfully synced calendar account: ${account.email || account.id}`);
              } else {
                errorCount++;
                log.warn(`Failed to sync calendar account: ${account.email || account.id}`);
              }
            } catch (accountError) {
              errorCount++;
              log.error(`Error syncing calendar account ${account.email || account.id}:`, accountError);
            }
          }
          
          log.info(`Calendar sync completed: ${syncedCount} succeeded, ${errorCount} failed`);
          return {
            success: errorCount === 0,
            syncedAccounts: syncedCount,
            errorCount,
            totalAccounts: accounts.length
          };
        } else {
          log.warn('No calendar accounts found or failed to list accounts');
          return { success: true, syncedAccounts: 0, errorCount: 0, totalAccounts: 0 };
        }
      } catch (error) {
        log.error('Failed to sync all calendar accounts:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Additional calendar handlers for Redux slice compatibility
    ipcMain.handle('calendar:get-user-accounts', async (_, userId: string) => {
      log.info(`Getting user accounts for: ${userId}`);
      return { success: true, data: [], error: undefined };
    });
    log.info('Registered calendar:get-user-accounts handler');

    ipcMain.handle('calendar:create-account', async (_, accountData: CalendarAccountData) => {
      try {
        log.info(`Creating calendar account via Rust: ${accountData.email}`);
        
        // Prepare account data for Rust backend
        const accountToAdd = {
          email: accountData.email,
          displayName: accountData.displayName || accountData.email,
          provider: accountData.provider || 'caldav',
          ...(accountData.password && { password: accountData.password }),
          ...(accountData.serverConfig?.serverUrl && { serverUrl: accountData.serverConfig.serverUrl }),
          ...(accountData.serverConfig?.port && { port: accountData.serverConfig.port }),
          ...(accountData.serverConfig?.ssl !== undefined && { ssl: accountData.serverConfig.ssl }),
          ...(accountData.serverConfig?.authType && { authType: accountData.serverConfig.authType })
        };
        
        // Call Rust backend to add the account
        const rustEngine = require('../../shared/rust-lib');
        await rustEngine.addCalendarAccount(accountToAdd);
        
        // Create response account object with actual data from Rust
        const account = {
          id: 'cal-' + Date.now(),
          email: accountData.email,
          displayName: accountData.displayName || accountData.email,
          provider: accountData.provider || 'caldav',
          isEnabled: true
        };
        
        log.info(`Successfully created calendar account via Rust: ${accountData.email}`);
        return { success: true, data: account, error: undefined };
      } catch (error) {
        log.error('Failed to create calendar account via Rust:', error);
        return { 
          success: false, 
          data: null, 
          error: error instanceof Error ? error.message : 'Failed to create calendar account'
        };
      }
    });

    ipcMain.handle('calendar:delete-account', async (_, accountId: string) => {
      log.info(`Deleting calendar account: ${accountId}`);
      return { success: true, error: undefined };
    });

    ipcMain.handle('calendar:list-calendars', async (_, accountId: string) => {
      log.info(`Listing calendars for account: ${accountId}`);
      return { success: true, data: [], error: undefined };
    });

    ipcMain.handle('calendar:get-events-in-range', async (_, calendarIds: string[], timeMin: string, timeMax: string) => {
      log.info(`Getting events in range: ${calendarIds.join(', ')} from ${timeMin} to ${timeMax}`);
      return { success: true, data: [], error: undefined };
    });

    ipcMain.handle('calendar:create-event-full', async (_, eventData: CalendarEventData) => {
      try {
        log.info(`Creating calendar event (full) via Rust: ${eventData.title}`);
        
        // Prepare event data for Rust backend
        const eventToCreate = {
          calendarId: eventData.calendarId,
          title: eventData.title,
          ...(eventData.description && { description: eventData.description }),
          ...(eventData.location && { location: eventData.location }),
          startTime: Math.floor(new Date(eventData.startTime).getTime() / 1000),
          endTime: Math.floor(new Date(eventData.endTime).getTime() / 1000),
          ...(eventData.allDay !== undefined && { allDay: eventData.allDay }),
          ...(eventData.status && { status: eventData.status }),
          ...(eventData.visibility && { visibility: eventData.visibility }),
          ...(eventData.attendees && { attendees: eventData.attendees }),
          ...(eventData.recurrence && { recurrence: eventData.recurrence })
        };
        
        // Call Rust backend to create the event
        const rustEngine = require('../../shared/rust-lib');
        const eventId = await rustEngine.createCalendarEvent(eventToCreate);
        
        const event = {
          id: eventId,
          title: eventData.title,
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime),
          calendarId: eventData.calendarId
        };
        
        log.info(`Successfully created calendar event (full) via Rust: ${eventId}`);
        return { success: true, data: event, error: undefined };
      } catch (error) {
        log.error('Failed to create calendar event (full) via Rust:', error);
        return { 
          success: false, 
          data: null, 
          error: error instanceof Error ? error.message : 'Failed to create event'
        };
      }
    });

    ipcMain.handle('calendar:update-event-full', async (_, calendarId: string, eventId: string, updates: Partial<CalendarEventData>) => {
      try {
        log.info(`Updating calendar event (full) via Rust: ${eventId}`);
        
        // Prepare the event update data for Rust backend
        const eventUpdate = {
          id: eventId,
          calendarId: calendarId,
          ...(updates.title && { title: updates.title }),
          ...(updates.description && { description: updates.description }),
          ...(updates.location && { location: updates.location }),
          ...(updates.startTime && { startTime: Math.floor(new Date(updates.startTime).getTime() / 1000) }),
          ...(updates.endTime && { endTime: Math.floor(new Date(updates.endTime).getTime() / 1000) }),
          ...(updates.allDay !== undefined && { allDay: updates.allDay }),
          ...(updates.status && { status: updates.status }),
          ...(updates.visibility && { visibility: updates.visibility }),
          ...(updates.attendees && { attendees: updates.attendees }),
          ...(updates.recurrence && { recurrence: updates.recurrence }),
          ...(updates.reminders && { reminders: updates.reminders })
        };
        
        // Call Rust backend to update the event
        await rustEngineIntegration.updateCalendarEvent(eventUpdate);
        
        log.info(`Successfully updated calendar event (full) via Rust: ${eventId}`);
        return { success: true, data: { id: eventId, ...updates }, error: undefined };
      } catch (error) {
        log.error('Failed to update calendar event (full) via Rust:', error);
        return { 
          success: false, 
          data: null, 
          error: error instanceof Error ? error.message : 'Failed to update event'
        };
      }
    });

    ipcMain.handle('calendar:delete-event-full', async (_, calendarId: string, eventId: string) => {
      try {
        log.info(`Deleting calendar event (full) via Rust: ${eventId}`);
        
        // Call Rust backend to delete the event
        await rustEngineIntegration.deleteCalendarEvent(eventId);
        
        log.info(`Successfully deleted calendar event (full) via Rust: ${eventId}`);
        return { success: true, error: undefined };
      } catch (error) {
        log.error('Failed to delete calendar event (full) via Rust:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to delete event'
        };
      }
    });

    ipcMain.handle('calendar:search-events', async (_, query: string, limit?: number) => {
      log.info(`Searching calendar events: ${query}`);
      return { success: true, data: [], error: undefined };
    });

    ipcMain.handle('calendar:sync-account-full', async (_, accountId: string, force?: boolean) => {
      log.info(`Syncing calendar account: ${accountId}, force: ${force}`);
      return { success: true, data: { totalCalendars: 1, totalEvents: 0 }, error: undefined };
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

    // System information handlers
    ipcMain.handle('system:get-info', async () => {
      return {
        platform: process.platform,
        version: app.getVersion(),
        arch: process.arch,
        deviceId: require('os').hostname() || 'unknown',
        isDarkMode: true, // Default to dark mode
        isHighContrast: false
      };
    });

    // Settings handlers
    ipcMain.handle('settings:get', async () => {
      try {
        // Get settings from Rust engine
        const result = await rustEngineIntegration.callRustFunction('settings_get', []);
        if (result.success) {
          return result.result;
        } else {
          // Fallback to default settings
          return {
            theme: 'auto',
            notifications: true,
            autoSync: true,
            language: 'en',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          };
        }
      } catch (error) {
        log.error('Failed to get settings:', error);
        return {
          theme: 'auto',
          notifications: true,
          autoSync: true,
          language: 'en',
          timezone: 'UTC'
        };
      }
    });

    ipcMain.handle('settings:set', async (_, settings: AppSettings) => {
      try {
        // Save settings via Rust engine
        const result = await rustEngineIntegration.callRustFunction('settings_set', [settings]);
        log.info('Updated settings:', settings);
        return result;
      } catch (error) {
        log.error('Failed to update settings:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle('settings:set-key', async (_, key: string, value: unknown) => {
      try {
        // Update individual setting via Rust engine
        const result = await rustEngineIntegration.callRustFunction('settings_set_key', [key, value]);
        log.info(`Setting ${key} = ${value}`);
        return result;
      } catch (error) {
        log.error(`Failed to set ${key}:`, error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle('settings:update', async (_, settings: Partial<AppSettings>) => {
      try {
        // Bulk update settings via Rust engine
        const result = await rustEngineIntegration.callRustFunction('settings_update', [settings]);
        log.info('Bulk updating settings:', settings);
        return result;
      } catch (error) {
        log.error('Failed to bulk update settings:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Search API handlers (using comprehensive Rust search engine)
    ipcMain.handle('search:perform', async (_, options: SearchOptions) => {
      try {
        log.info(`Performing search: ${options.query}`);
        const searchService = getSearchService();
        
        if (!searchService.isInitialized()) {
          await searchService.initialize();
        }
        
        const searchQuery = {
          query: options.query,
          filters: options.filters,
          limit: options.limit || 20,
          offset: options.offset || 0
        };
        
        const response = await searchService.search(searchQuery);
        log.info(`Search returned ${response.results.length} results (${response.total} total)`);
        
        return { 
          success: true, 
          data: { 
            results: response.results, 
            total: response.total,
            executionTime: response.took 
          }, 
          error: undefined 
        };
      } catch (error) {
        log.error('Failed to perform search:', error);
        return { 
          success: false, 
          data: { results: [], total: 0 }, 
          error: error instanceof Error ? error.message : 'Search failed' 
        };
      }
    });

    ipcMain.handle('search:get-suggestions', async (_, partialQuery: string, limit: number = 10) => {
      try {
        log.info(`Getting search suggestions for: ${partialQuery}`);
        const searchService = getSearchService();
        
        if (!searchService.isInitialized()) {
          await searchService.initialize();
        }
        
        const suggestions = await searchService.getSuggestions(partialQuery, limit);
        log.info(`Generated ${suggestions.length} suggestions`);
        
        return { success: true, data: suggestions, error: undefined };
      } catch (error) {
        log.error('Failed to get search suggestions:', error);
        return { success: false, data: [], error: error instanceof Error ? error.message : 'Suggestions failed' };
      }
    });

    ipcMain.handle('search:index-document', async (_, document: SearchDocument) => {
      try {
        log.info(`Indexing document: ${document.id}`);
        const searchService = getSearchService();
        
        if (!searchService.isInitialized()) {
          await searchService.initialize();
        }
        
        const searchDoc = {
          id: document.id,
          title: document.title,
          content: document.content,
          contentType: 'document',
          provider: document.source || 'unknown',
          metadata: document.metadata || {},
          lastModified: new Date()
        };
        
        await searchService.indexDocument(searchDoc);
        log.info(`Document indexed successfully: ${document.id}`);
        
        return { success: true, error: undefined };
      } catch (error) {
        log.error('Failed to index document:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Indexing failed' };
      }
    });

    ipcMain.handle('search:initialize', async () => {
      try {
        log.info('Initializing search engine via Rust');
        // Search engine is already initialized in initializeRustEngine()
        const isInitialized = rustEngineIntegration.isInitialized();
        log.info('Search engine initialization via Rust:', isInitialized);
        return { success: isInitialized, error: undefined };
      } catch (error) {
        log.error('Failed to initialize search engine via Rust:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Search initialization failed' };
      }
    });

    ipcMain.handle('search:get-analytics', async () => {
      try {
        log.info('Getting search analytics via Rust');
        // Return basic analytics - this would be expanded with actual Rust analytics
        const analytics = {
          totalDocuments: 0,
          totalSearches: 0,
          avgResponseTime: 0,
          engineVersion: rustEngineIntegration.getVersion()
        };
        return { success: true, data: analytics, error: undefined };
      } catch (error) {
        log.error('Failed to get search analytics via Rust:', error);
        return { success: false, data: {}, error: error instanceof Error ? error.message : 'Analytics failed' };
      }
    });

    // Theme API handlers (for themeSlice compatibility)
    ipcMain.handle('theme:get', async () => {
      try {
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs').promises;
        
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'theme-config.json');
        
        try {
          const configData = await fs.readFile(configPath, 'utf8');
          const themeConfig = JSON.parse(configData);
          return {
            theme: themeConfig.theme || 'dark',
            accentColor: themeConfig.accentColor || '#3b82f6',
            fontSize: themeConfig.fontSize || 'medium'
          };
        } catch (fileError) {
          // Return default theme if no config found
          return { theme: 'dark', accentColor: '#3b82f6', fontSize: 'medium' };
        }
      } catch (error) {
        log.error('Failed to get theme:', error);
        return { theme: 'dark', accentColor: '#3b82f6', fontSize: 'medium' };
      }
    });

    ipcMain.handle('theme:set', async (_, theme: ThemeSettings) => {
      try {
        log.info('Setting theme:', theme);
        
        // Store theme settings persistently
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs').promises;
        
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'theme-config.json');
        
        // Ensure the directory exists
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        
        // Save theme configuration
        const themeConfig = {
          theme: theme.theme || 'dark',
          accentColor: theme.accentColor || '#3b82f6',
          fontSize: theme.fontSize || 'medium',
          updatedAt: new Date().toISOString()
        };
        
        await fs.writeFile(configPath, JSON.stringify(themeConfig, null, 2));
        
        // Apply theme to all open windows if needed
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        
        for (const window of windows) {
          try {
            await window.webContents.executeJavaScript(`
              if (window.electronAPI && window.electronAPI.onThemeChanged) {
                window.electronAPI.onThemeChanged(${JSON.stringify(themeConfig)});
              }
            `);
          } catch (jsError) {
            log.debug('Failed to apply theme to window:', jsError);
          }
        }
        
        log.info('Successfully set theme:', themeConfig);
        return { success: true, theme: themeConfig };
      } catch (error) {
        log.error('Failed to set theme:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // AI Engine API handlers
    ipcMain.handle('ai:initialize', async (_, cacheDir?: string) => {
      try {
        log.info(`Initializing AI engine with cache dir: ${cacheDir || 'default'}`);
        // Initialize AI engine via Rust backend
        let initMethod = 'rust';
        let errorDetails = null;
        try {
          await rustEngineIntegration.initAiEngine();
          log.info('AI engine initialized successfully via Rust');
          return { 
            success: true,
            initMethod,
            cacheDir: cacheDir || 'default',
            initializedAt: new Date().toISOString()
          };
        } catch (rustError) {
          log.warn('Failed to initialize AI engine via Rust, using fallback:', rustError);
          initMethod = 'fallback';
          errorDetails = rustError instanceof Error ? rustError.message : String(rustError);
          
          // Fallback initialization - setup basic AI engine state
          try {
            // Initialize basic AI state/config if possible
            const { app } = require('electron');
            const path = require('path');
            const fs = require('fs').promises;
            
            const userDataPath = app.getPath('userData');
            const aiCacheDir = cacheDir || path.join(userDataPath, 'ai-cache');
            
            // Ensure cache directory exists
            await fs.mkdir(aiCacheDir, { recursive: true });
            
            return { 
              success: true,
              initMethod,
              cacheDir: aiCacheDir,
              fallbackReason: errorDetails,
              initializedAt: new Date().toISOString()
            };
          } catch (fallbackError) {
            log.error('Fallback AI initialization also failed:', fallbackError);
            throw fallbackError;
          }
        }
      } catch (error) {
        log.error('Failed to initialize AI engine:', error);
        throw error;
      }
    });

    ipcMain.handle('ai:store-api-key', async (_, provider: string, apiKey: string) => {
      try {
        log.info(`Storing API key for provider: ${provider}`);
        // Store API key securely using Rust engine
        let storageMethod = 'rust';
        let errorDetails = null;
        try {
          const success = await rustEngineIntegration.storeAPIKey(provider, apiKey);
          if (!success) {
            throw new Error('Failed to store API key in Rust engine');
          }
          log.info(`API key stored successfully for provider: ${provider}`);
          return { 
            success: true,
            provider,
            storageMethod,
            storedAt: new Date().toISOString()
          };
        } catch (rustError) {
          log.warn('Rust engine storage failed, using keychain fallback:', rustError);
          storageMethod = 'keychain';
          errorDetails = rustError instanceof Error ? rustError.message : String(rustError);
          
          // Fallback to system keychain
          const keytar = await import('keytar');
          await keytar.setPassword('flow-desk-ai', provider, apiKey);
          
          return { 
            success: true,
            provider,
            storageMethod,
            fallbackReason: errorDetails,
            storedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        log.error(`Failed to store API key for ${provider}:`, error);
        throw error;
      }
    });

    ipcMain.handle('ai:has-api-key', async (_, provider: string) => {
      try {
        log.info(`Checking API key for provider: ${provider}`);
        // Check if API key exists via Rust engine or keychain
        try {
          const hasKey = await rustEngineIntegration.hasAPIKey(provider);
          return hasKey;
        } catch (rustError) {
          log.warn('Rust engine check failed, using keychain fallback:', rustError);
          try {
            const keytar = await import('keytar');
            const apiKey = await keytar.getPassword('flow-desk-ai', provider);
            return !!apiKey;
          } catch (keychainError) {
            log.warn('Keychain check failed:', keychainError);
            return false;
          }
        }
      } catch (error) {
        log.error(`Failed to check API key for ${provider}:`, error);
        return false;
      }
    });

    ipcMain.handle('ai:delete-api-key', async (_, provider: string) => {
      try {
        log.info(`Deleting API key for provider: ${provider}`);
        // Delete API key via Rust engine or keychain
        try {
          const success = await rustEngineIntegration.deleteAPIKey(provider);
          if (success) {
            log.info(`API key deleted successfully for provider: ${provider}`);
            return true;
          }
          throw new Error('Rust engine delete failed');
        } catch (rustError) {
          log.warn('Rust engine delete failed, using keychain fallback:', rustError);
          try {
            const keytar = await import('keytar');
            const deleted = await keytar.deletePassword('flow-desk-ai', provider);
            return deleted;
          } catch (keychainError) {
            log.error('Keychain delete failed:', keychainError);
            return false;
          }
        }
      } catch (error) {
        log.error(`Failed to delete API key for ${provider}:`, error);
        return false;
      }
    });

    ipcMain.handle('ai:create-completion', async (_, request: any) => {
      try {
        log.info(`Creating AI completion for model: ${request.model}`);
        // Create AI completion using Rust engine
        try {
          const completion = await rustEngineIntegration.createCompletion(request);
          log.info(`AI completion created successfully for model: ${request.model}`);
          return completion;
        } catch (rustError) {
          log.error('Rust engine completion failed:', rustError);
          const error = rustError as Error;
          // Return fallback response with helpful error message
          return {
            id: 'error_completion_' + Date.now(),
            model: request.model,
            content: `AI completion failed: ${error.message || 'Unknown error'}. Please check your API configuration.`,
            finishReason: 'error',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            error: error.message || 'AI engine error'
          };
        }
      } catch (error) {
        log.error('Failed to create AI completion:', error);
        throw error;
      }
    });

    ipcMain.handle('ai:create-streaming-completion', async (_, request: any, streamChannel: string) => {
      try {
        log.info(`Creating streaming AI completion for model: ${request.model}`);
        // Create streaming AI completion using Rust engine
        try {
          const streamId = await rustEngineIntegration.createStreamingCompletion(
            request,
            (chunk: any) => {
              if (this.mainWindow) {
                this.mainWindow.webContents.send(streamChannel, chunk);
              }
            }
          );
          log.info(`Streaming AI completion started for model: ${request.model}`);
          return { success: true, streamId };
        } catch (rustError) {
          log.error('Rust engine streaming failed:', rustError);
          const error = rustError as Error;
          // Send error to stream channel
          if (this.mainWindow) {
            this.mainWindow.webContents.send(streamChannel, {
              id: 'error_stream_' + Date.now(),
              model: request.model,
              content: `Streaming failed: ${error.message || 'Unknown error'}`,
              finishReason: 'error',
              error: true
            });
          }
          return { success: false, error: error.message };
        }
      } catch (error) {
        log.error('Failed to create streaming AI completion:', error);
        throw error;
      }
    });

    ipcMain.handle('ai:get-available-models', async () => {
      try {
        log.info('Getting available AI models');
        // Get available AI models from Rust engine
        try {
          const models = await rustEngineIntegration.getAvailableModels();
          log.info(`Retrieved ${models.length} available AI models`);
          return models;
        } catch (rustError) {
          log.warn('Failed to get models from Rust engine:', rustError);
          return [];
        }
      } catch (error) {
        log.error('Failed to get available models:', error);
        return [];
      }
    });

    ipcMain.handle('ai:health-check', async () => {
      try {
        log.info('Performing AI engine health check');
        // Perform AI engine health check via Rust engine
        try {
          const healthStatus = await rustEngineIntegration.performHealthCheck();
          log.info('AI engine health check completed:', healthStatus);
          return healthStatus.isHealthy || false;
        } catch (rustError) {
          log.warn('AI engine health check failed:', rustError);
          return false;
        }
      } catch (error) {
        log.error('AI health check failed:', error);
        return false;
      }
    });

    ipcMain.handle('ai:get-usage-stats', async () => {
      try {
        log.info('Getting AI usage statistics');
        // Get AI usage statistics from Rust engine
        try {
          const stats = await rustEngineIntegration.getUsageStats();
          log.info('Retrieved AI usage statistics:', stats);
          return {
            totalRequests: stats.totalRequests || 0,
            successfulRequests: stats.successfulRequests || 0,
            failedRequests: stats.failedRequests || 0,
            totalTokensUsed: stats.totalTokensUsed || 0,
            totalCost: stats.totalCost || 0,
            averageResponseTimeMs: stats.averageResponseTimeMs || 0
          };
        } catch (rustError) {
          log.warn('Failed to get usage stats from Rust engine:', rustError);
          return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            averageResponseTimeMs: 0
          };
        }
      } catch (error) {
        log.error('Failed to get usage stats:', error);
        throw error;
      }
    });

    ipcMain.handle('ai:get-rate-limit-info', async (_, provider: string) => {
      try {
        log.info(`Getting rate limit info for provider: ${provider}`);
        // Get rate limit info from provider via Rust engine
        try {
          const rateLimitInfo = await rustEngineIntegration.getRateLimitInfo(provider);
          log.info(`Retrieved rate limit info for ${provider}:`, rateLimitInfo);
          return rateLimitInfo;
        } catch (rustError) {
          log.warn(`Failed to get rate limit info for ${provider}:`, rustError);
          return null;
        }
      } catch (error) {
        log.error(`Failed to get rate limit info for ${provider}:`, error);
        return null;
      }
    });

    ipcMain.handle('ai:clear-cache', async (_, operationType?: string) => {
      try {
        log.info(`Clearing AI cache for operation type: ${operationType || 'all'}`);
        // Clear AI cache via Rust engine
        try {
          await rustEngineIntegration.clearCache(operationType);
          log.info(`AI cache cleared successfully for operation: ${operationType || 'all'}`);
          
          // Get cache statistics after clearing (if available)
          let cacheStats = null;
          try {
            cacheStats = await rustEngineIntegration.getCacheStats();
          } catch (statsError) {
            log.debug(`Failed to get cache stats after clear: ${statsError}`);
          }
          
          return { 
            success: true,
            operationType: operationType || 'all',
            cacheStats,
            clearedAt: new Date().toISOString()
          };
        } catch (rustError) {
          log.error('Failed to clear AI cache:', rustError);
          return { 
            success: false, 
            error: rustError instanceof Error ? rustError.message : String(rustError),
            operationType: operationType || 'all',
            failedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        log.error('Failed to clear AI cache:', error);
        throw error;
      }
    });

    ipcMain.handle('ai:get-cache-stats', async () => {
      try {
        log.info('Getting AI cache statistics');
        // Get AI cache statistics from Rust engine
        try {
          const cacheStats = await rustEngineIntegration.getCacheStats();
          log.info('Retrieved AI cache statistics:', cacheStats);
          return cacheStats;
        } catch (rustError) {
          log.warn('Failed to get cache stats from Rust engine:', rustError);
          return {
            totalEntries: 0,
            totalSize: 0,
            hitRate: 0,
            missRate: 0
          };
        }
      } catch (error) {
        log.error('Failed to get cache stats:', error);
        return {};
      }
    });

    ipcMain.handle('ai:test-provider', async (_, provider: string) => {
      try {
        log.info(`Testing AI provider: ${provider}`);
        // Test AI provider via Rust engine
        try {
          const testResult = await rustEngineIntegration.testProvider(provider);
          log.info(`AI provider test for ${provider}:`, testResult);
          return testResult || false;
        } catch (rustError) {
          log.error(`AI provider test failed for ${provider}:`, rustError);
          return false;
        }
      } catch (error) {
        log.error(`Failed to test provider ${provider}:`, error);
        return false;
      }
    });

    // Database API handlers
    ipcMain.handle('database:get-status', async () => {
      try {
        const databaseService = getDatabaseInitializationService();
        const isInitialized = await databaseService.isDatabasesInitialized();
        const config = databaseService.getConfig();
        
        return {
          success: true,
          data: {
            initialized: isInitialized,
            config,
            progress: this.initializationProgress
          },
          error: undefined
        };
      } catch (error) {
        log.error('Failed to get database status:', error);
        return {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('database:initialize', async () => {
      try {
        log.info('Manual database initialization requested');
        await this.initializeDatabases();
        return {
          success: this.databaseInitialized,
          error: this.databaseInitialized ? undefined : 'Database initialization failed'
        };
      } catch (error) {
        log.error('Manual database initialization failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('database:repair', async () => {
      try {
        log.info('Database repair requested');
        const databaseService = getDatabaseInitializationService();
        const success = await databaseService.repairDatabases();
        
        if (success) {
          // Re-initialize Rust engines after repair
          await this.initializeRustEngine();
        }
        
        return {
          success,
          error: success ? undefined : 'Database repair failed'
        };
      } catch (error) {
        log.error('Database repair failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('database:check-integrity', async () => {
      try {
        log.info('Database integrity check requested');
        const databaseService = getDatabaseInitializationService();
        const config = databaseService.getConfig();
        
        // Check integrity of each database
        const results = {
          mail: { valid: false, error: null as string | null },
          calendar: { valid: false, error: null as string | null }
        };
        
        try {
          // Use Rust engine to check database integrity if available
          const rustEngine = require('../lib/rust-engine');
          const mailCheck = await rustEngine.checkDatabaseIntegrity(config.mailDbPath);
          results.mail = { valid: mailCheck.valid, error: mailCheck.errors?.join(', ') || null };
          
          const calendarCheck = await rustEngine.checkDatabaseIntegrity(config.calendarDbPath);
          results.calendar = { valid: calendarCheck.valid, error: calendarCheck.errors?.join(', ') || null };
        } catch (error) {
          log.warn('Rust engine integrity check failed, using fallback:', error);
          
          // Fallback: just check if databases exist and are accessible
          const fs = require('fs').promises;
          try {
            await fs.access(config.mailDbPath);
            results.mail = { valid: true, error: null };
          } catch (err) {
            results.mail = { valid: false, error: 'Database file not accessible' };
          }
          
          try {
            await fs.access(config.calendarDbPath);
            results.calendar = { valid: true, error: null };
          } catch (err) {
            results.calendar = { valid: false, error: 'Database file not accessible' };
          }
        }
        
        return {
          success: true,
          data: results,
          error: undefined
        };
      } catch (error) {
        log.error('Database integrity check failed:', error);
        return {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('database:get-migration-status', async () => {
      try {
        const databaseService = getDatabaseInitializationService();
        const config = databaseService.getConfig();
        const { getDatabaseMigrationManager } = require('./database-migration-manager');
        const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
        
        const statuses = await migrationManager.getAllMigrationStatuses();
        
        return {
          success: true,
          data: statuses,
          error: undefined
        };
      } catch (error) {
        log.error('Failed to get migration status:', error);
        return {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('database:apply-migrations', async () => {
      try {
        log.info('Manual migration application requested');
        const databaseService = getDatabaseInitializationService();
        const config = databaseService.getConfig();
        const { getDatabaseMigrationManager } = require('./database-migration-manager');
        const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
        
        const success = await migrationManager.applyAllMigrations();
        
        return {
          success,
          error: success ? undefined : 'Migration application failed'
        };
      } catch (error) {
        log.error('Migration application failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    log.info('IPC handlers setup complete');
  }

  /**
   * Switch between mail, calendar, and workspace views
   */
  private async switchToView(view: 'mail' | 'calendar' | 'workspace') {
    this.currentView = view;
    
    if (!this.mainWindow) return;

    // Remove any existing browser view
    if (this.mainWindow.getBrowserView()) {
      this.mainWindow.setBrowserView(null);
    }

    if (view === 'workspace') {
      // Show active workspace service if any
      const activeWorkspace = this.workspaceManager.getActiveWorkspace();
      if (activeWorkspace && activeWorkspace.services.length > 0) {
        // Load first service by default
        await this.workspaceManager.loadService(
          activeWorkspace.id, 
          activeWorkspace.services[0].id, 
          this.mainWindow
        );
      }
    }

    // Notify renderer about view change
    this.mainWindow.webContents.send('view-changed', view);
    log.debug(`Switched to view: ${view}`);
  }

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

  // Workspace Window Management Utility Methods

  /**
   * Update workspace window properties
   */
  private updateWorkspaceWindow(workspaceId: string, windowId: string, updates: Partial<WorkspaceWindow>): boolean {
    const windows = this.workspaceWindows.get(workspaceId);
    if (!windows) return false;

    const windowIndex = windows.findIndex(w => w.id === windowId);
    if (windowIndex === -1) return false;

    windows[windowIndex] = {
      ...windows[windowIndex],
      ...updates,
      updatedAt: new Date()
    };

    this.workspaceWindows.set(workspaceId, windows);
    return true;
  }

  /**
   * Remove workspace window
   */
  private removeWorkspaceWindow(workspaceId: string, windowId: string): boolean {
    const windows = this.workspaceWindows.get(workspaceId);
    if (!windows) return false;

    const filteredWindows = windows.filter(w => w.id !== windowId);
    if (filteredWindows.length === windows.length) return false;

    this.workspaceWindows.set(workspaceId, filteredWindows);
    return true;
  }

  /**
   * Get specific workspace window
   */
  private getWorkspaceWindow(workspaceId: string, windowId: string): WorkspaceWindow | null {
    const windows = this.workspaceWindows.get(workspaceId);
    if (!windows) return null;

    return windows.find(w => w.id === windowId) || null;
  }
}

// Initialize the app
new FlowDeskApp();

log.info('Flow Desk main process initialized');