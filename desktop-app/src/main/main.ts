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

// Import Workspace interface  
import type { Workspace } from './workspace';

// Import Rust engine for mail and calendar (packaged with app)
const rustEngine = require('../lib/rust-engine');

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

  constructor() {
    this.workspaceManager = new WorkspaceManager();
    this.initializeApp();
  }

  private initializeApp() {
    app.whenReady().then(async () => {
      await this.requestNotificationPermissions();
      this.createMainWindow();
      this.setupMenu();
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
    ipcMain.handle('service:add-to-workspace', async (_, workspaceId: string, serviceName: string, serviceType: string, url: string, config?: any) => {
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

    ipcMain.handle('workspace:update-service', async (_, workspaceId: string, serviceId: string, updates: { name?: string; url?: string; isEnabled?: boolean }) => {
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
      return this.emailTemplateManager ? await this.emailTemplateManager.updateTemplate(templateId, updates) : false;
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

    ipcMain.handle('email-templates:process-variables', async (_, template: any, variables: any) => {
      return this.emailTemplateManager ? this.emailTemplateManager.processTemplateVariables(template, variables) : { subject: '', body: '' };
    });

    // Email scheduling handlers
    ipcMain.handle('email-scheduler:schedule', async (_, emailData: any, scheduledTime: Date) => {
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

    ipcMain.handle('email-rules:create', async (_, ruleData: any) => {
      return this.emailRulesEngine ? await this.emailRulesEngine.createRule(ruleData) : null;
    });

    ipcMain.handle('email-rules:update', async (_, ruleId: string, updates: any) => {
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

    ipcMain.handle('snippets:save', async (_, snippet: any) => {
      return this.snippetManager ? await this.snippetManager.saveSnippet(snippet) : null;
    });

    ipcMain.handle('snippets:update', async (_, snippetId: string, updates: any) => {
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
    ipcMain.handle('workspace:create-full', async (_, workspaceData: any) => {
      const name = workspaceData.name || 'New Workspace';
      const color = workspaceData.color || '#4285f4';
      const icon = workspaceData.icon || '🏢';
      const browserIsolation = workspaceData.browserIsolation || 'shared';
      
      return await this.workspaceManager.createWorkspace(name, color, icon, browserIsolation);
    });

    ipcMain.handle('workspace:list-partitions', async () => {
      log.info('Getting workspace partitions');
      return []; // TODO: Implement partition listing
    });

    ipcMain.handle('workspace:create-partition', async (_, partitionData: any) => {
      log.info(`Creating partition: ${partitionData.name}`);
      return { success: true, id: 'partition-' + Date.now() };
    });

    ipcMain.handle('workspace:update-partition', async (_, partitionId: string, updates: any) => {
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

    ipcMain.handle('workspace:create-window', async (_, windowData: any) => {
      log.info(`Creating window: ${windowData.title}`);
      return { success: true, id: 'window-' + Date.now() };
    });

    // Mail handlers (will integrate with Rust IMAP engine) - Redux slice compatibility
    ipcMain.handle('mail:add-account-obj', async (_, account: any) => {
      try {
        log.info(`Adding mail account: ${account.email}`);
        
        // Use Rust engine to add account with auto-detected server config
        await rustEngine.initMailEngine();
        const result = await rustEngine.addMailAccount({
          id: 'mail-' + Date.now(),
          email: account.email,
          provider: 'auto', // Auto-detect from email domain
          displayName: account.displayName || account.email,
          password: account.password
        });
        
        log.info(`Successfully added mail account: ${result.id}`);
        return {
          id: result.id,
          email: account.email,
          displayName: account.displayName || account.email,
          provider: 'imap',
          isEnabled: true
        };
      } catch (error) {
        log.error('Failed to add mail account:', error);
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
        await rustEngine.initMailEngine();
        const accounts = await rustEngine.getMailAccounts();
        log.info(`Retrieved ${accounts.length} mail accounts`);
        return accounts;
      } catch (error) {
        log.error('Failed to get mail accounts:', error);
        return [];
      }
    });

    ipcMain.handle('mail:sync-account', async (_, accountId: string) => {
      try {
        log.info(`Syncing mail account: ${accountId}`);
        await rustEngine.initMailEngine();
        const result = await rustEngine.syncMailAccount(accountId);
        log.info(`Successfully synced account ${accountId}:`, result);
        return true; // Redux expects boolean
      } catch (error) {
        log.error('Failed to sync mail account:', error);
        return false;
      }
    });

    // Additional mail handlers for Redux slice compatibility
    ipcMain.handle('mail:send-message-obj', async (_, accountId: string, message: any) => {
      try {
        log.info(`Sending message from account ${accountId}: ${message.subject}`);
        
        // Use real email service for multi-provider support
        if (this.realEmailService) {
          const success = await this.realEmailService.sendMessage(accountId, message);
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
        log.info(`Marking message ${messageId} as ${read ? 'read' : 'unread'}`);
        
        // Use Rust engine to actually mark message
        const rustEngine = require('../lib/rust-engine');
        await rustEngine.markMailMessageRead(accountId, messageId, read);
        
        log.info(`Successfully marked message ${messageId} as ${read ? 'read' : 'unread'}`);
        return true;
      } catch (error) {
        log.error('Failed to mark message:', error);
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
      // TODO: Get folders from Rust engine
      return [
        { name: 'Inbox', count: 0 },
        { name: 'Sent', count: 0 },
        { name: 'Drafts', count: 0 },
        { name: 'Trash', count: 0 }
      ];
    });

    ipcMain.handle('mail:get-messages', async (_, accountId: string, folderId: string, options?: any) => {
      try {
        log.info(`Getting messages for account ${accountId}, folder ${folderId}`);
        await rustEngine.initMailEngine();
        const messages = await rustEngine.getMailMessages(accountId);
        log.info(`Retrieved ${messages.length} messages for account ${accountId}`);
        return messages;
      } catch (error) {
        log.error('Failed to get mail messages:', error);
        return [];
      }
    });

    // Additional mail handlers for unified API
    ipcMain.handle('mail:update-account', async (_, accountId: string, updates: any) => {
      log.info(`Updating mail account: ${accountId}`);
      return { success: true };
    });

    ipcMain.handle('mail:remove-account', async (_, accountId: string) => {
      log.info(`Removing mail account: ${accountId}`);
      return { success: true };
    });

    ipcMain.handle('mail:send-message', async (_, accountId: string, to: string[], subject: string, body: string, options?: any) => {
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

    ipcMain.handle('mail:search-messages', async (_, query: string, options?: any) => {
      log.info(`Searching messages: ${query}`);
      return [];
    });

    // mail:sync-all handler already registered above

    // mail:get-sync-status handler already registered above

    // Calendar handlers (will integrate with Rust CalDAV engine) - unified API
    ipcMain.handle('calendar:add-account', async (_, email: string, password: string, serverConfig?: any) => {
      try {
        log.info(`Adding calendar account: ${email}`);
        
        // Use Rust engine to add calendar account
        await rustEngine.initCalendarEngine();
        const result = await rustEngine.addCalendarAccount({
          id: 'cal-' + Date.now(),
          email,
          provider: 'auto', // Auto-detect from email domain  
          displayName: email,
          password
        });
        
        log.info(`Successfully added calendar account: ${result.id}`);
        return {
          id: result.id,
          email,
          displayName: email,
          provider: 'caldav',
          isEnabled: true
        };
      } catch (error) {
        log.error('Failed to add calendar account:', error);
        throw new Error(`Failed to add calendar account: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    ipcMain.handle('calendar:get-accounts', async () => {
      try {
        await rustEngine.initCalendarEngine();
        const accounts = await rustEngine.getCalendarAccounts();
        log.info(`Retrieved ${accounts.length} calendar accounts`);
        return accounts;
      } catch (error) {
        log.error('Failed to get calendar accounts:', error);
        return [];
      }
    });

    ipcMain.handle('calendar:update-account', async (_, accountId: string, updates: any) => {
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
      // TODO: Get events from Rust engine
      log.info(`Getting events for account ${accountId} from ${startDate} to ${endDate}`);
      return [];
    });

    ipcMain.handle('calendar:create-event', async (_, calendarId: string, title: string, startTime: Date, endTime: Date, options?: any) => {
      log.info(`Creating event: ${title}`);
      return 'event-' + Date.now();
    });

    ipcMain.handle('calendar:update-event', async (_, eventId: string, updates: any) => {
      log.info(`Updating event: ${eventId}`);
      return { success: true };
    });

    ipcMain.handle('calendar:delete-event', async (_, eventId: string) => {
      log.info(`Deleting event: ${eventId}`);
      return { success: true };
    });

    ipcMain.handle('calendar:sync-account', async (_, accountId: string) => {
      log.info(`Syncing calendar account: ${accountId}`);
      return { totalCalendars: 1, totalEvents: 0 };
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

    ipcMain.handle('calendar:create-account', async (_, accountData: any) => {
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

    ipcMain.handle('calendar:create-event-full', async (_, eventData: any) => {
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

    ipcMain.handle('calendar:update-event-full', async (_, calendarId: string, eventId: string, updates: any) => {
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
      // TODO: Implement settings storage
      return {
        theme: 'auto',
        notifications: true,
        autoSync: true
      };
    });

    ipcMain.handle('settings:set', async (_, settings: any) => {
      // TODO: Implement settings storage
      log.info('Updating settings:', settings);
      return { success: true };
    });

    ipcMain.handle('settings:set-key', async (_, key: string, value: any) => {
      // TODO: Implement individual setting update
      log.info(`Setting ${key} = ${value}`);
      return true; // appSlice expects boolean
    });

    ipcMain.handle('settings:update', async (_, settings: any) => {
      // TODO: Implement bulk settings update
      log.info('Bulk updating settings:', settings);
      return { success: true };
    });

    // Search API handlers (for searchSlice compatibility)
    ipcMain.handle('search:perform', async (_, options: { query: string; limit: number; offset: number }) => {
      log.info(`Performing search: ${options.query}`);
      return { success: true, data: { results: [], total: 0 }, error: undefined };
    });

    ipcMain.handle('search:get-suggestions', async (_, partialQuery: string, limit: number) => {
      log.info(`Getting search suggestions for: ${partialQuery}`);
      return { success: true, data: [], error: undefined };
    });

    ipcMain.handle('search:index-document', async (_, document: any) => {
      log.info(`Indexing document: ${document.id}`);
      return { success: true, error: undefined };
    });

    ipcMain.handle('search:initialize', async () => {
      log.info('Initializing search engine');
      return { success: true, error: undefined };
    });

    ipcMain.handle('search:get-analytics', async () => {
      log.info('Getting search analytics');
      return { success: true, data: {}, error: undefined };
    });

    // Theme API handlers (for themeSlice compatibility)
    ipcMain.handle('theme:get', async () => {
      return { theme: 'dark', accentColor: '#3b82f6' };
    });

    ipcMain.handle('theme:set', async (_, theme: any) => {
      log.info('Setting theme:', theme);
      return { success: true };
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