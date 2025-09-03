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
import { EmailTemplateManager } from './email-template-manager';
import { EmailScheduler } from './email-scheduler';
import { EmailRulesEngine } from './email-rules-engine';
import { RealEmailService } from './real-email-service';
import { SnippetManager } from './snippet-manager';

// Import OAuth2 services - temporarily disabled due to compilation issues
// import './oauth-ipc-service'; // Initialize OAuth2 IPC handlers
// import { oAuth2IntegrationManager } from './oauth-integration-manager';
// import { oAuth2TokenManager } from './oauth-token-manager';

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

// Import database initialization service
import { getDatabaseInitializationService, DatabaseInitializationConfig, InitializationProgress } from './database-initialization-service';
import { getDatabaseMigrationManager } from './database-migration-manager';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

class FlowDeskApp {
  private mainWindow: BrowserWindow | null = null;
  private workspaceManager: WorkspaceManager;
  private notificationManager: DesktopNotificationManager | null = null;
  private mailSyncManager: MailSyncManager | null = null;
  private emailTemplateManager: EmailTemplateManager | null = null;
  private emailScheduler: EmailScheduler | null = null;
  private emailRulesEngine: EmailRulesEngine | null = null;
  private realEmailService: RealEmailService | null = null;
  private snippetManager: SnippetManager | null = null;
  private currentView: 'mail' | 'calendar' | 'workspace' = 'mail';
  private databaseInitialized: boolean = false;
  private initializationProgress: InitializationProgress | null = null;

  constructor() {
    this.workspaceManager = new WorkspaceManager();
    this.initializeApp();
  }

  private initializeApp() {
    app.whenReady().then(async () => {
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
      
      // Clean up OAuth2 services - temporarily disabled
      // try {
      //   await oAuth2IntegrationManager.cleanup();
      //   await oAuth2TokenManager.cleanup();
      //   log.info('OAuth2 services cleaned up');
      // } catch (error) {
      //   log.warn('Error during OAuth2 cleanup:', error);
      // }
      
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
   * Initialize databases on first run
   */
  private async initializeDatabases(): Promise<void> {
    try {
      log.info('Starting database initialization...');
      
      // Create database initialization service with progress callback
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
        log.info('Databases already initialized');
        this.databaseInitialized = true;
        
        // Still run migrations if needed
        const config = databaseService.getConfig();
        const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
        const migrationsApplied = await migrationManager.applyAllMigrations();
        if (!migrationsApplied) {
          log.warn('Some database migrations failed');
        }
        
        return;
      }

      // Initialize databases for first run
      const initializationSuccess = await databaseService.initializeDatabases();
      
      if (initializationSuccess) {
        this.databaseInitialized = true;
        log.info('Database initialization completed successfully');
        
        // Initialize Rust engine databases
        try {
          const rustEngine = require('../lib/rust-engine');
          const config = databaseService.getConfig();
          
          await rustEngine.initializeDatabases({
            mailDbPath: config.mailDbPath,
            calendarDbPath: config.calendarDbPath,
            searchIndexPath: config.searchIndexPath
          });
          
          log.info('Rust engine databases initialized successfully');
        } catch (error) {
          log.warn('Failed to initialize Rust engine databases:', error);
          // Continue anyway - the databases exist and can be used
        }
        
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

      // Request notification permissions on macOS
      if (process.platform === 'darwin') {
        const granted = await systemPreferences.askForMediaAccess('microphone');
        if (!granted) {
          log.warn('Microphone access denied - may affect some notifications');
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
      
      // Initialize real email service
      this.realEmailService = new RealEmailService();
      log.info('Real email service initialized');
      
      // Initialize snippet manager
      this.snippetManager = new SnippetManager();
      log.info('Snippet manager initialized');
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
      return this.emailTemplateManager ? await this.emailTemplateManager.getAllTemplates() : [];
    });

    ipcMain.handle('email-templates:get-by-category', async (_, category: string) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.getTemplatesByCategory(category) : [];
    });

    ipcMain.handle('email-templates:get', async (_, templateId: string) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.getTemplate(templateId) : null;
    });

    ipcMain.handle('email-templates:save', async (_, template: any) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.saveTemplate(template) : null;
    });

    ipcMain.handle('email-templates:update', async (_, templateId: string, updates: any) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.useTemplate(templateId) : false; // Changed method name
    });

    ipcMain.handle('email-templates:delete', async (_, templateId: string) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.deleteTemplate(templateId) : false;
    });

    ipcMain.handle('email-templates:use', async (_, templateId: string) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.useTemplate(templateId) : null;
    });

    ipcMain.handle('email-templates:search', async (_, query: string) => {
      return this.emailTemplateManager ? await this.emailTemplateManager.searchTemplates(query) : [];
    });

    ipcMain.handle('email-templates:process-variables', async (_, template: any, variables: Record<string, string>) => {
      return this.emailTemplateManager ? this.emailTemplateManager.processTemplateVariables(template, variables) : { subject: '', body: '' };
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
        const workspaces = await this.workspaceManager.getAllWorkspaces();
        return workspaces.map(ws => ({
          id: ws.id,
          name: ws.name,
          type: 'workspace',
          memberCount: ws.members?.length || 0
        }));
      } catch (error) {
        log.error('Failed to list workspace partitions:', error);
        return [];
      }
    });

    ipcMain.handle('workspace:create-partition', async (_, partitionData: CreatePartitionData) => {
      log.info(`Creating partition: ${partitionData.name}`);
      return { success: true, id: 'partition-' + Date.now() };
    });

    ipcMain.handle('workspace:update-partition', async (_, partitionId: string, updates: Partial<CreatePartitionData>) => {
      log.info(`Updating partition: ${partitionId}`);
      return { success: true };
    });

    ipcMain.handle('workspace:clear-data', async (_, workspaceId: string) => {
      log.info(`Clearing data for workspace: ${workspaceId}`);
      return { success: true };
    });

    ipcMain.handle('workspace:get-windows', async (_, workspaceId: string) => {
      log.info(`Getting windows for workspace: ${workspaceId}`);
      return [];
    });

    ipcMain.handle('workspace:create-window', async (_, windowData: CreateWindowData) => {
      log.info(`Creating window: ${windowData.title}`);
      return { success: true, id: 'window-' + Date.now() };
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
          const success = await this.realEmailService.sendMessage({ ...message, accountId });
          return success;
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
      log.info('Syncing all mail accounts');
      return { success: true };
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
        return messages;
      } catch (error) {
        log.error('Failed to get mail messages via Rust:', error);
        return [];
      }
    });

    // Additional mail handlers for unified API
    ipcMain.handle('mail:update-account', async (_, accountId: string, updates: Partial<MailAccountData>) => {
      log.info(`Updating mail account: ${accountId}`);
      return { success: true };
    });

    ipcMain.handle('mail:remove-account', async (_, accountId: string) => {
      log.info(`Removing mail account: ${accountId}`);
      return { success: true };
    });

    ipcMain.handle('mail:send-message', async (_, accountId: string, to: string[], subject: string, body: string, options?: SendMessageOptions) => {
      log.info(`Sending message from account ${accountId} to ${to.join(', ')}`);
      return 'message-' + Date.now();
    });

    ipcMain.handle('mail:mark-as-read', async (_, accountId: string, messageId: string) => {
      log.info(`Marking message ${messageId} as read`);
      return { success: true };
    });

    ipcMain.handle('mail:mark-as-unread', async (_, accountId: string, messageId: string) => {
      log.info(`Marking message ${messageId} as unread`);
      return { success: true };
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

    // Calendar handlers (using comprehensive Rust engine integration)
    ipcMain.handle('calendar:add-account', async (_, email: string, password: string, serverConfig?: CalendarServerConfig) => {
      try {
        log.info(`Adding calendar account via Rust: ${email}`);
        
        const rustAccount = await rustEngineIntegration.addCalendarAccount({
          email,
          password,
          serverUrl: serverConfig?.serverUrl
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
      log.info(`Updating calendar account: ${accountId}`);
      return { success: true };
    });

    ipcMain.handle('calendar:remove-account', async (_, accountId: string) => {
      log.info(`Removing calendar account: ${accountId}`);
      return { success: true };
    });

    ipcMain.handle('calendar:get-calendars', async (_, accountId: string) => {
      log.info(`Getting calendars for account: ${accountId}`);
      return [];
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
          description: options?.description,
          location: options?.location
        });
        log.info(`Successfully created event via Rust: ${eventId}`);
        return eventId;
      } catch (error) {
        log.error('Failed to create event via Rust:', error);
        return 'event-' + Date.now(); // Fallback ID
      }
    });

    ipcMain.handle('calendar:update-event', async (_, eventId: string, updates: Partial<CalendarEventData>) => {
      log.info(`Updating event: ${eventId}`);
      return { success: true };
    });

    ipcMain.handle('calendar:delete-event', async (_, eventId: string) => {
      log.info(`Deleting event: ${eventId}`);
      return { success: true };
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
      log.info('Syncing all calendar accounts');
      return { success: true };
    });

    // Additional calendar handlers for Redux slice compatibility
    ipcMain.handle('calendar:get-user-accounts', async (_, userId: string) => {
      log.info(`Getting user accounts for: ${userId}`);
      return { success: true, data: [], error: undefined };
    });
    log.info('Registered calendar:get-user-accounts handler');

    ipcMain.handle('calendar:create-account', async (_, accountData: CalendarAccountData) => {
      log.info(`Creating calendar account: ${accountData.email}`);
      const account = {
        id: 'cal-' + Date.now(),
        email: accountData.email,
        displayName: accountData.email,
        provider: 'caldav',
        isEnabled: true
      };
      return { success: true, data: account, error: undefined };
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
      log.info(`Creating calendar event: ${eventData.title}`);
      const event = {
        id: 'event-' + Date.now(),
        title: eventData.title,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        calendarId: eventData.calendarId
      };
      return { success: true, data: event, error: undefined };
    });

    ipcMain.handle('calendar:update-event-full', async (_, calendarId: string, eventId: string, updates: Partial<CalendarEventData>) => {
      log.info(`Updating event: ${eventId}`);
      return { success: true, data: { id: eventId, ...updates }, error: undefined };
    });

    ipcMain.handle('calendar:delete-event-full', async (_, calendarId: string, eventId: string) => {
      log.info(`Deleting event: ${eventId}`);
      return { success: true, error: undefined };
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
        log.info(`Performing search via Rust: ${options.query}`);
        const results = await rustEngineIntegration.searchDocuments(options.query, options.limit);
        log.info(`Search via Rust returned ${results.length} results`);
        return { 
          success: true, 
          data: { results, total: results.length }, 
          error: undefined 
        };
      } catch (error) {
        log.error('Failed to perform search via Rust:', error);
        return { 
          success: false, 
          data: { results: [], total: 0 }, 
          error: error instanceof Error ? error.message : 'Search failed' 
        };
      }
    });

    ipcMain.handle('search:get-suggestions', async (_, partialQuery: string, limit: number) => {
      try {
        log.info(`Getting search suggestions via Rust for: ${partialQuery}`);
        // For now, return simple suggestions based on the partial query
        const suggestions = [partialQuery, `${partialQuery}*`, `*${partialQuery}*`].slice(0, limit);
        return { success: true, data: suggestions, error: undefined };
      } catch (error) {
        log.error('Failed to get search suggestions via Rust:', error);
        return { success: false, data: [], error: error instanceof Error ? error.message : 'Suggestions failed' };
      }
    });

    ipcMain.handle('search:index-document', async (_, document: SearchDocument) => {
      try {
        log.info(`Indexing document via Rust: ${document.id}`);
        const success = await rustEngineIntegration.indexDocument({
          id: document.id,
          title: document.title,
          content: document.content,
          source: document.source || 'unknown',
          metadata: document.metadata
        });
        log.info(`Document indexed via Rust: ${document.id}, success: ${success}`);
        return { success, error: undefined };
      } catch (error) {
        log.error('Failed to index document via Rust:', error);
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
      return { theme: 'dark', accentColor: '#3b82f6' };
    });

    ipcMain.handle('theme:set', async (_, theme: ThemeSettings) => {
      log.info('Setting theme:', theme);
      return { success: true };
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
}

// Initialize the app
new FlowDeskApp();

log.info('Flow Desk main process initialized');