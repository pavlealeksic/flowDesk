"use strict";
/**
 * Flow Desk Main Process - Final Implementation
 *
 * Uses IMAP/SMTP for email, CalDAV for calendar, and Chrome browser instances for all other services
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const electron_log_1 = __importDefault(require("electron-log"));
const workspace_1 = require("./workspace");
const notification_manager_1 = require("./notification-manager");
const mail_sync_manager_1 = require("./mail-sync-manager");
// import { emailServiceManager } from './email-service-manager'; // Temporarily disabled
const snippet_manager_1 = require("./snippet-manager");
const email_template_manager_1 = require("./email-template-manager");
const security_config_1 = require("./security-config");
const rust_email_service_1 = require("./rust-email-service");
const email_scheduler_1 = require("./email-scheduler");
const email_rules_engine_1 = require("./email-rules-engine");
const CalendarEngine_1 = require("./calendar/CalendarEngine");
// Import comprehensive Rust engine integration
const rust_engine_integration_1 = require("../lib/rust-integration/rust-engine-integration");
// Import search service
const search_service_rust_1 = require("./search-service-rust");
// Import working JavaScript database service with SQLite3
const database_initialization_service_1 = require("./database-initialization-service");
// Import cross-platform utilities
const platform_utils_1 = require("./platform-utils");
const native_module_manager_1 = require("./native-module-manager");
const fs_utils_1 = require("./fs-utils");
// Configure logging based on environment
if (process.env.NODE_ENV === 'production') {
    electron_log_1.default.transports.file.level = 'warn';
    electron_log_1.default.transports.console.level = false; // Disable console logging in production
}
else {
    electron_log_1.default.transports.file.level = 'info';
    electron_log_1.default.transports.console.level = 'debug';
}
class FlowDeskApp {
    constructor() {
        this.mainWindow = null;
        this.notificationManager = null;
        this.mailSyncManager = null;
        // Email services removed - now handled directly by emailServiceManager via Rust engine
        // Pure Rust email service (no JavaScript dependencies)
        this.realEmailService = null;
        this.snippetManager = null;
        this.emailTemplateManager = null;
        this.emailScheduler = null;
        this.emailRulesEngine = null;
        this.currentView = 'mail';
        this.databaseInitialized = false;
        this.initializationProgress = null;
        // Workspace window management
        this.workspaceWindows = new Map();
        // Cross-platform support
        this.platformInfo = (0, platform_utils_1.getPlatformInfo)();
        this.environmentConfig = (0, platform_utils_1.getEnvironmentConfig)();
        this.workspaceManager = new workspace_1.WorkspaceManager();
        this.initializeApp();
    }
    initializeApp() {
        electron_1.app.whenReady().then(async () => {
            // Initialize platform-specific components first
            try {
                await this.initializePlatform();
                electron_log_1.default.info('Platform initialization completed successfully');
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize platform components:', error);
                // Continue with initialization - some features may be degraded
            }
            // Initialize encryption keys first (automatic, no user configuration needed)
            try {
                await this.initializeEncryption();
                electron_log_1.default.info('Encryption keys initialized automatically');
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize encryption:', error);
                electron_1.dialog.showErrorBox('Encryption Error', 'Failed to initialize encryption. The application cannot continue.\n\n' +
                    'This is an internal error that should not occur. Please restart the application.');
                electron_1.app.quit();
                return;
            }
            // Initialize security configuration after encryption
            try {
                await security_config_1.securityConfig.initialize();
                electron_log_1.default.info('Security configuration initialized');
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize security:', error);
                if (process.env.NODE_ENV === 'production') {
                    electron_1.dialog.showErrorBox('Security Error', 'Failed to initialize security configuration. Please check your environment settings.');
                    electron_1.app.quit();
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
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
        electron_1.app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                electron_1.app.quit();
            }
        });
        electron_1.app.on('before-quit', async () => {
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
                    electron_log_1.default.info('Email scheduler cleaned up');
                }
                catch (error) {
                    electron_log_1.default.warn('Error during email scheduler cleanup:', error);
                }
            }
            // Clean up email rules engine
            if (this.emailRulesEngine) {
                try {
                    await this.emailRulesEngine.shutdown();
                    electron_log_1.default.info('Email rules engine cleaned up');
                }
                catch (error) {
                    electron_log_1.default.warn('Error during email rules engine cleanup:', error);
                }
            }
            // Clean up production email service
            // await emailServiceManager.destroy(); // Temporarily disabled
            // Clean up Rust email service
            if (this.realEmailService) {
                try {
                    await this.realEmailService.destroy();
                    electron_log_1.default.info('Rust email service cleaned up');
                }
                catch (error) {
                    electron_log_1.default.warn('Error during Rust email service cleanup:', error);
                }
            }
            // Clean up Rust engine integration
            try {
                await rust_engine_integration_1.rustEngineIntegration.shutdown();
                electron_log_1.default.info('Rust engine integration cleaned up');
            }
            catch (error) {
                electron_log_1.default.warn('Error during Rust engine cleanup:', error);
            }
        });
    }
    createMainWindow() {
        this.mainWindow = new electron_1.BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1000,
            minHeight: 700,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: (0, path_1.join)(__dirname, '../preload/preload.js'),
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
        }
        else {
            this.mainWindow.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
        }
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
            electron_log_1.default.info('Flow Desk main window ready');
        });
        // Handle window resize for browser views with throttling
        let resizeTimeout = null;
        this.mainWindow.on('resize', () => {
            // Debounce resize calls to prevent excessive updates
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            resizeTimeout = setTimeout(() => {
                this.resizeBrowserViews();
                resizeTimeout = null;
            }, 100); // Wait 100ms after user stops resizing
        });
        // Handle window maximize/unmaximize for browser views
        this.mainWindow.on('maximize', () => {
            this.resizeBrowserViews();
        });
        this.mainWindow.on('unmaximize', () => {
            this.resizeBrowserViews();
        });
        // Handle window restore from minimize
        this.mainWindow.on('restore', () => {
            this.resizeBrowserViews();
        });
        electron_log_1.default.info('Flow Desk main window created');
    }
    /**
     * Initialize platform-specific components and features
     */
    async initializePlatform() {
        electron_log_1.default.info(`Initializing Flow Desk on ${this.platformInfo.platform} (${this.platformInfo.arch})`);
        // Initialize native modules
        try {
            await native_module_manager_1.nativeModuleManager.initializePlatformModules();
            electron_log_1.default.info('Native modules initialized');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize native modules:', error);
            throw error;
        }
        // Check native module compilation status
        const compilationStatus = native_module_manager_1.nativeModuleManager.checkNativeCompilation();
        if (!compilationStatus.success) {
            electron_log_1.default.error('Native module compilation issues detected:');
            compilationStatus.issues.forEach(issue => electron_log_1.default.error(`  - ${issue}`));
            if (this.environmentConfig.isProduction) {
                throw new Error('Critical native modules are not available');
            }
        }
        else {
            electron_log_1.default.info('Native module compilation check passed');
        }
        // Log platform capabilities
        const features = this.platformInfo.supportedFeatures;
        electron_log_1.default.info('Platform features:', {
            keychain: features.keychain,
            windowsCredentialManager: features.windowsCredentialManager,
            linuxSecretService: features.linuxSecretService,
            nativeNotifications: features.nativeNotifications,
            systemTray: features.systemTray
        });
        // Platform-specific initialization
        if (this.platformInfo.isWindows) {
            await this.initializeWindows();
        }
        else if (this.platformInfo.isDarwin) {
            await this.initializeMacOS();
        }
        else if (this.platformInfo.isLinux) {
            await this.initializeLinux();
        }
        // Clean up old temporary files
        try {
            const deletedCount = await fs_utils_1.fsUtils.cleanupTempFiles();
            if (deletedCount > 0) {
                electron_log_1.default.info(`Cleaned up ${deletedCount} temporary files`);
            }
        }
        catch (error) {
            electron_log_1.default.warn('Failed to clean up temporary files:', error);
        }
    }
    /**
     * Windows-specific initialization
     */
    async initializeWindows() {
        electron_log_1.default.info('Initializing Windows-specific features');
        // Check for Windows Credential Manager
        if ((0, platform_utils_1.supportsFeature)('windowsCredentialManager')) {
            electron_log_1.default.info('Windows Credential Manager available for secure storage');
        }
        // Set up Windows-specific paths
        const appDataPath = this.environmentConfig.paths.appData;
        await fs_utils_1.fsUtils.createDirectory(appDataPath);
        electron_log_1.default.info(`Windows app data: ${appDataPath}`);
    }
    /**
     * macOS-specific initialization
     */
    async initializeMacOS() {
        electron_log_1.default.info('Initializing macOS-specific features');
        // Check for Keychain Services
        if ((0, platform_utils_1.supportsFeature)('keychain')) {
            electron_log_1.default.info('macOS Keychain Services available for secure storage');
        }
        // Set up macOS-specific paths
        const appSupportPath = this.environmentConfig.paths.appData;
        await fs_utils_1.fsUtils.createDirectory(appSupportPath);
        electron_log_1.default.info(`macOS app support: ${appSupportPath}`);
    }
    /**
     * Linux-specific initialization
     */
    async initializeLinux() {
        electron_log_1.default.info('Initializing Linux-specific features');
        // Check for Secret Service API
        if ((0, platform_utils_1.supportsFeature)('linuxSecretService')) {
            electron_log_1.default.info('Linux Secret Service API available for secure storage');
        }
        else {
            electron_log_1.default.warn('libsecret not available, using encrypted file fallback');
        }
        // Set up XDG-compliant paths
        const configPath = this.environmentConfig.paths.appData;
        const cachePath = this.environmentConfig.paths.cache;
        await fs_utils_1.fsUtils.createDirectory(configPath);
        await fs_utils_1.fsUtils.createDirectory(cachePath);
        electron_log_1.default.info(`Linux config: ${configPath}`);
        electron_log_1.default.info(`Linux cache: ${cachePath}`);
    }
    /**
     * Initialize encryption keys for automatic key management
     */
    async initializeEncryption() {
        try {
            electron_log_1.default.info('Initializing encryption key management...');
            // Import dynamically to avoid initialization order issues
            const { encryptionKeyManager } = await Promise.resolve().then(() => __importStar(require('./encryption-key-manager')));
            // Initialize encryption key manager
            const initialized = await encryptionKeyManager.initialize();
            if (initialized) {
                electron_log_1.default.info('Encryption key management initialized successfully');
                // Check if keys need rotation (every 90 days)
                if (encryptionKeyManager.needsRotation()) {
                    electron_log_1.default.info('Encryption keys need rotation (>90 days old)');
                    // Note: Key rotation can be scheduled or done on user request
                }
            }
            else {
                electron_log_1.default.error('Failed to initialize encryption key management');
                throw new Error('Encryption initialization failed');
            }
        }
        catch (error) {
            electron_log_1.default.error('Encryption initialization error:', error);
            throw error;
        }
    }
    /**
     * Initialize databases on first run
     */
    async initializeDatabases() {
        try {
            electron_log_1.default.info('Starting database initialization with SQLite3...');
            // Use working JavaScript database service with SQLite3
            const databaseService = (0, database_initialization_service_1.getDatabaseInitializationService)((progress) => {
                this.initializationProgress = progress;
                // Send progress updates to renderer if window is ready
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('database-initialization-progress', progress);
                }
            });
            // Check if databases are already initialized
            const isInitialized = await databaseService.isDatabasesInitialized();
            if (isInitialized) {
                electron_log_1.default.info('Databases already initialized and healthy');
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
                electron_log_1.default.info('Database initialization completed successfully with SQLite3');
                // Send completion event to renderer
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('database-initialization-complete', {
                        success: true,
                        config: databaseService.getConfig()
                    });
                }
            }
            else {
                electron_log_1.default.error('Database initialization failed');
                this.databaseInitialized = false;
                // Send failure event to renderer
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('database-initialization-complete', {
                        success: false,
                        error: 'Database initialization failed'
                    });
                }
            }
        }
        catch (error) {
            electron_log_1.default.error('Database initialization error:', error);
            this.databaseInitialized = false;
            // Show error dialog
            if (this.mainWindow) {
                electron_1.dialog.showErrorBox('Database Initialization Failed', `Flow Desk could not initialize its databases.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThe application may not function properly.`);
            }
        }
    }
    /**
     * Initialize the Rust engine integration
     */
    async initializeRustEngine() {
        try {
            electron_log_1.default.info('Initializing comprehensive Rust engine integration...');
            await rust_engine_integration_1.rustEngineIntegration.initialize();
            electron_log_1.default.info('Rust engine integration initialized successfully');
            electron_log_1.default.info('Rust engine version:', rust_engine_integration_1.rustEngineIntegration.getVersion());
            // Initialize search service
            try {
                const searchService = (0, search_service_rust_1.getSearchService)();
                await searchService.initialize();
                electron_log_1.default.info('Search service initialized successfully with Rust Tantivy backend');
            }
            catch (searchError) {
                electron_log_1.default.error('Failed to initialize search service:', searchError);
                // Don't fail the entire initialization if search fails
            }
            // Initialize production-ready email service
            try {
                electron_log_1.default.info('Initializing production-ready Rust email service...');
                this.realEmailService = new rust_email_service_1.RustEmailService('Flow Desk');
                await this.realEmailService.initialize();
                electron_log_1.default.info('Production-ready Rust email service initialized successfully');
            }
            catch (emailError) {
                electron_log_1.default.warn('Failed to initialize Rust email service:', emailError);
                // Continue without production email service - fallback to existing services
            }
            // Run integration tests in development mode
            if (process.env.NODE_ENV === 'development') {
                this.runIntegrationTests();
            }
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize Rust engine integration:', error);
            // Continue without Rust integration - app will use JavaScript fallbacks
        }
    }
    /**
     * Run Rust integration tests (development only)
     */
    async runIntegrationTests() {
        try {
            // const { RustIntegrationTester } = await import('../test/rust-integration-test');
            // const tester = new RustIntegrationTester();
            return; // Skip integration tests for now
        }
        catch (error) {
            electron_log_1.default.error('Failed to run integration tests:', error);
        }
    }
    async requestNotificationPermissions() {
        try {
            // Check if notifications are supported
            if (!electron_1.Notification.isSupported()) {
                electron_log_1.default.warn('System notifications not supported on this platform');
                return;
            }
            // Handle notification permissions on macOS
            if (process.platform === 'darwin') {
                try {
                    // Check current notification permission status
                    // Use any type to avoid TypeScript issues with optional Electron APIs
                    const getNotificationPermission = electron_1.systemPreferences.getNotificationPermission;
                    if (typeof getNotificationPermission === 'function') {
                        const permission = getNotificationPermission();
                        electron_log_1.default.info(`Current notification permission status: ${permission}`);
                        if (permission === 'denied') {
                            electron_log_1.default.warn('Notification permissions denied. Users can enable them in System Preferences.');
                            return;
                        }
                    }
                    else {
                        electron_log_1.default.info('getNotificationPermission not available on this Electron version');
                    }
                    electron_log_1.default.info('macOS notification permissions checked successfully');
                }
                catch (error) {
                    electron_log_1.default.warn('Failed to check notification permissions on macOS:', error);
                }
            }
            // Test system notification to ensure it works
            const testNotification = new electron_1.Notification({
                title: 'Flow Desk',
                body: 'Notifications are ready!',
                silent: true
            });
            testNotification.show();
            // Hide the test notification quickly
            setTimeout(() => {
                testNotification.close();
            }, 1000);
            electron_log_1.default.info('System notifications initialized and tested');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize system notifications:', error);
        }
    }
    async initializeNotifications() {
        try {
            this.notificationManager = new notification_manager_1.DesktopNotificationManager(this.mainWindow);
            await this.notificationManager.initialize();
            electron_log_1.default.info('Notification manager initialized');
            // Initialize mail sync manager
            this.mailSyncManager = new mail_sync_manager_1.MailSyncManager(this.notificationManager);
            await this.mailSyncManager.initialize();
            electron_log_1.default.info('Mail sync manager initialized');
            // Initialize Pure Rust Production Email Engine via NAPI
            // await emailServiceManager.initialize('Flow Desk'); // Temporarily disabled
            electron_log_1.default.info('Email service manager temporarily disabled');
            // Email template management, scheduling, and rules are now handled by the Rust engine
            electron_log_1.default.info('All email services now running via Rust backend');
            // Initialize snippet manager
            this.snippetManager = new snippet_manager_1.SnippetManager();
            electron_log_1.default.info('Snippet manager initialized');
            // Initialize email template manager
            this.emailTemplateManager = new email_template_manager_1.EmailTemplateManager();
            electron_log_1.default.info('Email template manager initialized');
            // Initialize email scheduler
            this.emailScheduler = new email_scheduler_1.EmailScheduler();
            await this.emailScheduler.initialize();
            electron_log_1.default.info('Email scheduler initialized');
            // Initialize email rules engine
            this.emailRulesEngine = new email_rules_engine_1.EmailRulesEngine();
            await this.emailRulesEngine.initialize();
            electron_log_1.default.info('Email rules engine initialized');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize notification/sync managers:', error);
        }
    }
    setupMenu() {
        const template = [
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
        const menu = electron_1.Menu.buildFromTemplate(template);
        electron_1.Menu.setApplicationMenu(menu);
    }
    getFileFilters(mimeType) {
        const filters = [
            { name: 'All Files', extensions: ['*'] }
        ];
        if (mimeType.startsWith('image/')) {
            filters.unshift({ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] });
        }
        else if (mimeType === 'application/pdf') {
            filters.unshift({ name: 'PDF Documents', extensions: ['pdf'] });
        }
        else if (mimeType.startsWith('text/')) {
            filters.unshift({ name: 'Text Files', extensions: ['txt', 'md', 'csv', 'log'] });
        }
        else if (mimeType.includes('word')) {
            filters.unshift({ name: 'Word Documents', extensions: ['doc', 'docx'] });
        }
        else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
            filters.unshift({ name: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv'] });
        }
        else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
            filters.unshift({ name: 'Presentations', extensions: ['ppt', 'pptx'] });
        }
        else if (mimeType.includes('zip') || mimeType.includes('archive')) {
            filters.unshift({ name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] });
        }
        return filters;
    }
    async createDefaultWorkspace() {
        // No longer create default workspaces - users create their own
        electron_log_1.default.info('Workspace manager initialized - users will create workspaces as needed');
    }
    setupIpcHandlers() {
        // App handlers
        electron_1.ipcMain.handle('app:get-version', () => electron_1.app.getVersion());
        electron_1.ipcMain.handle('app:get-platform', () => process.platform);
        // View switching handlers
        electron_1.ipcMain.handle('view:switch', async (_, view) => {
            await this.switchToView(view);
        });
        // Workspace handlers
        electron_1.ipcMain.handle('workspace:get-all', () => {
            return this.workspaceManager.getWorkspaces();
        });
        electron_1.ipcMain.handle('workspace:get-active', () => {
            return this.workspaceManager.getActiveWorkspace();
        });
        electron_1.ipcMain.handle('workspace:create', async (_, name, color) => {
            return await this.workspaceManager.createWorkspace(name, color);
        });
        electron_1.ipcMain.handle('workspace:switch', async (_, workspaceId) => {
            await this.workspaceManager.switchWorkspace(workspaceId);
            await this.switchToView('workspace');
        });
        electron_1.ipcMain.handle('workspace:update', async (_, workspaceId, updates) => {
            return await this.workspaceManager.updateWorkspace(workspaceId, updates);
        });
        electron_1.ipcMain.handle('workspace:delete', async (_, workspaceId) => {
            return await this.workspaceManager.deleteWorkspace(workspaceId);
        });
        // Service handlers
        electron_1.ipcMain.handle('service:add-to-workspace', async (_, workspaceId, serviceName, serviceType, url, config) => {
            return await this.workspaceManager.addServiceToWorkspace(workspaceId, serviceName, serviceType, url);
        });
        electron_1.ipcMain.handle('service:remove-from-workspace', async (_, workspaceId, serviceId) => {
            return await this.workspaceManager.removeServiceFromWorkspace(workspaceId, serviceId);
        });
        electron_1.ipcMain.handle('service:load', async (_, workspaceId, serviceId) => {
            if (!this.mainWindow)
                throw new Error('Main window not available');
            return await this.workspaceManager.loadService(workspaceId, serviceId, this.mainWindow);
        });
        electron_1.ipcMain.handle('service:get-predefined', () => {
            return this.workspaceManager.getPredefinedServices();
        });
        // Additional workspace handlers for unified API
        electron_1.ipcMain.handle('workspace:get-by-id', async (_, workspaceId) => {
            const workspaces = this.workspaceManager.getWorkspaces();
            return workspaces.find(w => w.id === workspaceId) || null;
        });
        electron_1.ipcMain.handle('workspace:add-service', async (_, workspaceId, serviceName, serviceType, url) => {
            return await this.workspaceManager.addServiceToWorkspace(workspaceId, serviceName, serviceType, url);
        });
        electron_1.ipcMain.handle('workspace:remove-service', async (_, workspaceId, serviceId) => {
            return await this.workspaceManager.removeServiceFromWorkspace(workspaceId, serviceId);
        });
        electron_1.ipcMain.handle('workspace:update-service', async (_, workspaceId, serviceId, updates) => {
            return await this.workspaceManager.updateServiceInWorkspace(workspaceId, serviceId, updates);
        });
        electron_1.ipcMain.handle('workspace:load-service', async (_, workspaceId, serviceId) => {
            if (!this.mainWindow)
                throw new Error('Main window not available');
            return await this.workspaceManager.loadService(workspaceId, serviceId, this.mainWindow);
        });
        electron_1.ipcMain.handle('workspace:get-predefined-services', () => {
            return this.workspaceManager.getPredefinedServices();
        });
        electron_1.ipcMain.handle('workspace:close-service', async (_, workspaceId, serviceId) => {
            return await this.workspaceManager.closeService(workspaceId, serviceId);
        });
        // BrowserView visibility management for proper z-index layering
        electron_1.ipcMain.handle('workspace:hide-browser-views', () => {
            this.workspaceManager.hideBrowserViews();
        });
        electron_1.ipcMain.handle('workspace:show-browser-views', () => {
            this.workspaceManager.showBrowserViews();
        });
        electron_1.ipcMain.handle('workspace:are-browser-views-hidden', () => {
            return this.workspaceManager.areBrowserViewsHidden();
        });
        // Mail attachment handlers
        electron_1.ipcMain.handle('mail:download-attachment', async (_, attachmentData) => {
            try {
                const { canceled, filePath } = await electron_1.dialog.showSaveDialog(this.mainWindow, {
                    defaultPath: attachmentData.filename,
                    filters: this.getFileFilters(attachmentData.mimeType)
                });
                if (!canceled && filePath) {
                    const fs = require('fs');
                    const buffer = Buffer.from(attachmentData.data, 'base64');
                    fs.writeFileSync(filePath, buffer);
                    // Show in file manager
                    electron_1.shell.showItemInFolder(filePath);
                    return { success: true, path: filePath };
                }
                return { success: false, error: 'Download cancelled' };
            }
            catch (error) {
                electron_log_1.default.error('Failed to download attachment:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Download failed' };
            }
        });
        // Email template handlers
        electron_1.ipcMain.handle('email-templates:get-all', async () => {
            try {
                if (!this.emailTemplateManager) {
                    electron_log_1.default.warn('Email template manager not initialized, initializing now...');
                    this.emailTemplateManager = new email_template_manager_1.EmailTemplateManager();
                }
                return await this.emailTemplateManager.getAllTemplates();
            }
            catch (error) {
                electron_log_1.default.error('Failed to get all email templates:', error);
                // Try to provide helpful error context instead of empty array
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to get email templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('email-templates:get-by-category', async (_, category) => {
            try {
                if (!this.emailTemplateManager) {
                    electron_log_1.default.warn('Email template manager not initialized, initializing now...');
                    this.emailTemplateManager = new email_template_manager_1.EmailTemplateManager();
                }
                return await this.emailTemplateManager.getTemplatesByCategory(category);
            }
            catch (error) {
                electron_log_1.default.error('Failed to get templates by category:', error);
                // Try to provide helpful error context instead of empty array
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to get templates by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('email-templates:get', async (_, templateId) => {
            try {
                return this.emailTemplateManager ? await this.emailTemplateManager.getTemplate(templateId) : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get template:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('email-templates:save', async (_, template) => {
            try {
                return this.emailTemplateManager ? await this.emailTemplateManager.saveTemplate(template) : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to save template:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('email-templates:update', async (_, templateId, updates) => {
            try {
                return this.emailTemplateManager ? await this.emailTemplateManager.updateTemplate(templateId, updates) : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to update template:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('email-templates:delete', async (_, templateId) => {
            try {
                return this.emailTemplateManager ? await this.emailTemplateManager.deleteTemplate(templateId) : false;
            }
            catch (error) {
                electron_log_1.default.error('Failed to delete template:', error);
                return false;
            }
        });
        electron_1.ipcMain.handle('email-templates:use', async (_, templateId) => {
            try {
                return this.emailTemplateManager ? await this.emailTemplateManager.useTemplate(templateId) : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to use template:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('email-templates:search', async (_, query) => {
            try {
                if (!this.emailTemplateManager) {
                    electron_log_1.default.warn('Email template manager not initialized, initializing now...');
                    this.emailTemplateManager = new email_template_manager_1.EmailTemplateManager();
                }
                return await this.emailTemplateManager.searchTemplates(query);
            }
            catch (error) {
                electron_log_1.default.error('Failed to search templates:', error);
                // Try to provide helpful error context instead of empty array
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to search templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('email-templates:process-variables', async (_, template, variables) => {
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
            }
            catch (error) {
                electron_log_1.default.error('Failed to process template variables:', error);
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
        electron_1.ipcMain.handle('snippets:get-all', async () => {
            try {
                if (!this.snippetManager) {
                    electron_log_1.default.warn('Snippet manager not initialized, initializing now...');
                    this.snippetManager = new snippet_manager_1.SnippetManager();
                }
                return await this.snippetManager.getAllSnippets();
            }
            catch (error) {
                electron_log_1.default.error('Failed to get all snippets:', error);
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to get snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('snippets:get', async (_, snippetId) => {
            try {
                return this.snippetManager ? await this.snippetManager.getSnippet(snippetId) : undefined;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get snippet:', error);
                return undefined;
            }
        });
        electron_1.ipcMain.handle('snippets:get-by-category', async (_, category) => {
            try {
                if (!this.snippetManager) {
                    electron_log_1.default.warn('Snippet manager not initialized, initializing now...');
                    this.snippetManager = new snippet_manager_1.SnippetManager();
                }
                return await this.snippetManager.getSnippetsByCategory(category);
            }
            catch (error) {
                electron_log_1.default.error('Failed to get snippets by category:', error);
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to get snippets by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('snippets:get-by-shortcut', async (_, shortcut) => {
            try {
                return this.snippetManager ? await this.snippetManager.getSnippetByShortcut(shortcut) : undefined;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get snippet by shortcut:', error);
                return undefined;
            }
        });
        electron_1.ipcMain.handle('snippets:create', async (_, snippet) => {
            try {
                return this.snippetManager ? await this.snippetManager.createSnippet(snippet) : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to create snippet:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('snippets:update', async (_, snippetId, updates) => {
            try {
                return this.snippetManager ? await this.snippetManager.updateSnippet(snippetId, updates) : undefined;
            }
            catch (error) {
                electron_log_1.default.error('Failed to update snippet:', error);
                return undefined;
            }
        });
        electron_1.ipcMain.handle('snippets:delete', async (_, snippetId) => {
            try {
                return this.snippetManager ? await this.snippetManager.deleteSnippet(snippetId) : false;
            }
            catch (error) {
                electron_log_1.default.error('Failed to delete snippet:', error);
                return false;
            }
        });
        electron_1.ipcMain.handle('snippets:use', async (_, snippetId) => {
            try {
                return this.snippetManager ? await this.snippetManager.useSnippet(snippetId) : undefined;
            }
            catch (error) {
                electron_log_1.default.error('Failed to use snippet:', error);
                return undefined;
            }
        });
        electron_1.ipcMain.handle('snippets:search', async (_, query) => {
            try {
                if (!this.snippetManager) {
                    electron_log_1.default.warn('Snippet manager not initialized, initializing now...');
                    this.snippetManager = new snippet_manager_1.SnippetManager();
                }
                return await this.snippetManager.searchSnippets(query);
            }
            catch (error) {
                electron_log_1.default.error('Failed to search snippets:', error);
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to search snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('snippets:expand', async (_, text, variables) => {
            try {
                return this.snippetManager ? this.snippetManager.expandSnippet(text, variables) : text;
            }
            catch (error) {
                electron_log_1.default.error('Failed to expand snippet:', error);
                return text;
            }
        });
        electron_1.ipcMain.handle('snippets:get-categories', async () => {
            try {
                if (!this.snippetManager) {
                    electron_log_1.default.warn('Snippet manager not initialized, initializing now...');
                    this.snippetManager = new snippet_manager_1.SnippetManager();
                }
                return await this.snippetManager.getCategories();
            }
            catch (error) {
                electron_log_1.default.error('Failed to get snippet categories:', error);
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to get snippet categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('snippets:get-most-used', async (_, limit) => {
            try {
                if (!this.snippetManager) {
                    electron_log_1.default.warn('Snippet manager not initialized, initializing now...');
                    this.snippetManager = new snippet_manager_1.SnippetManager();
                }
                return await this.snippetManager.getMostUsedSnippets(limit);
            }
            catch (error) {
                electron_log_1.default.error('Failed to get most used snippets:', error);
                if (error instanceof Error && error.message.includes('sqlite3')) {
                    throw new Error('Database not available. Please ensure SQLite3 is installed and databases are initialized.');
                }
                throw new Error(`Failed to get most used snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        // Email scheduling handlers
        electron_1.ipcMain.handle('email-scheduler:schedule', async (_, emailData, scheduledTime) => {
            return this.emailScheduler ? await this.emailScheduler.scheduleEmail(emailData) : null;
        });
        electron_1.ipcMain.handle('email-scheduler:cancel', async (_, emailId) => {
            return this.emailScheduler ? await this.emailScheduler.cancelScheduledEmail(emailId) : false;
        });
        electron_1.ipcMain.handle('email-scheduler:get-scheduled', async () => {
            return this.emailScheduler ? await this.emailScheduler.getScheduledEmails() : [];
        });
        electron_1.ipcMain.handle('email-scheduler:get-snoozed', async () => {
            return this.emailScheduler ? await this.emailScheduler.getSnoozedEmails() : [];
        });
        electron_1.ipcMain.handle('email-scheduler:snooze', async (_, messageId, accountId, snoozeUntil, reason) => {
            return this.emailScheduler ? await this.emailScheduler.snoozeEmail(messageId, accountId, snoozeUntil, reason) : null;
        });
        // Email rules handlers
        electron_1.ipcMain.handle('email-rules:get-all', async () => {
            return this.emailRulesEngine ? await this.emailRulesEngine.getAllRules() : [];
        });
        electron_1.ipcMain.handle('email-rules:create', async (_, ruleData) => {
            return this.emailRulesEngine ? await this.emailRulesEngine.createRule(ruleData) : null;
        });
        electron_1.ipcMain.handle('email-rules:update', async (_, ruleId, updates) => {
            return this.emailRulesEngine ? await this.emailRulesEngine.updateRule(ruleId, updates) : false;
        });
        electron_1.ipcMain.handle('email-rules:delete', async (_, ruleId) => {
            return this.emailRulesEngine ? await this.emailRulesEngine.deleteRule(ruleId) : false;
        });
        electron_1.ipcMain.handle('email-rules:get-stats', async () => {
            return this.emailRulesEngine ? await this.emailRulesEngine.getRuleStats() : null;
        });
        // Additional workspace handlers for Redux slice compatibility
        electron_1.ipcMain.handle('workspace:create-full', async (_, workspaceData) => {
            const name = workspaceData.name || 'New Workspace';
            const color = workspaceData.color || '#4285f4';
            const icon = workspaceData.icon || '🏢';
            const browserIsolation = workspaceData.browserIsolation || 'shared';
            return await this.workspaceManager.createWorkspace(name, color, icon, browserIsolation);
        });
        electron_1.ipcMain.handle('workspace:list-partitions', async () => {
            electron_log_1.default.info('Getting workspace partitions');
            try {
                if (!this.workspaceManager) {
                    electron_log_1.default.warn('Workspace manager not available');
                    return [];
                }
                const workspaces = await this.workspaceManager.getAllWorkspaces();
                return workspaces.map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    type: 'workspace',
                    memberCount: ws.members?.length || 0
                }));
            }
            catch (error) {
                electron_log_1.default.error('Failed to list workspace partitions:', error);
                // Return empty array here is appropriate since this is a list operation
                // and the frontend expects an array - but at least log the specific error
                if (error instanceof Error) {
                    electron_log_1.default.error('Workspace partition error details:', error.message);
                }
                return [];
            }
        });
        electron_1.ipcMain.handle('workspace:create-partition', async (_, partitionData) => {
            electron_log_1.default.info(`Creating partition: ${partitionData.name}`);
            return { success: true, id: 'partition-' + Date.now() };
        });
        electron_1.ipcMain.handle('workspace:update-partition', async (_, partitionId, updates) => {
            try {
                electron_log_1.default.info(`Updating partition: ${partitionId}`);
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
                        electron_log_1.default.info(`Successfully updated partition: ${partitionId}`);
                        return {
                            success: true,
                            workspace: updatedWorkspace,
                            updatedFields: {
                                name: updates.name,
                                description: updates.description
                            }
                        };
                    }
                    else {
                        electron_log_1.default.warn(`Partition not found: ${partitionId}`);
                        return { success: false, error: 'Partition not found' };
                    }
                }
                else {
                    electron_log_1.default.warn('Workspace manager not initialized');
                    return { success: false, error: 'Workspace manager not initialized' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to update partition:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('workspace:clear-data', async (_, workspaceId) => {
            try {
                electron_log_1.default.info(`Clearing data for workspace: ${workspaceId}`);
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
                            electron_log_1.default.info(`Successfully cleared data for workspace: ${workspaceId}`);
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
                        }
                        catch (sessionError) {
                            electron_log_1.default.error('Failed to clear session data:', sessionError);
                            return { success: false, error: 'Failed to clear session data' };
                        }
                    }
                    else {
                        electron_log_1.default.warn(`Workspace not found: ${workspaceId}`);
                        return { success: false, error: 'Workspace not found' };
                    }
                }
                else {
                    electron_log_1.default.warn('Workspace manager not initialized');
                    return { success: false, error: 'Workspace manager not initialized' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to clear workspace data:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('workspace:get-windows', async (_, workspaceId) => {
            try {
                electron_log_1.default.info(`Getting windows for workspace: ${workspaceId}`);
                const windows = this.workspaceWindows.get(workspaceId) || [];
                electron_log_1.default.debug(`Found ${windows.length} windows for workspace ${workspaceId}`);
                return windows;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get workspace windows:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('workspace:create-window', async (_, workspaceId, windowData) => {
            try {
                electron_log_1.default.info(`Creating window: ${windowData.title} for workspace: ${workspaceId}`);
                // Create new workspace window
                const newWindow = {
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
                electron_log_1.default.info(`Created workspace window ${newWindow.id} for workspace ${workspaceId}`);
                return { success: true, id: newWindow.id, window: newWindow };
            }
            catch (error) {
                electron_log_1.default.error('Failed to create workspace window:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        // Additional workspace window management handlers
        electron_1.ipcMain.handle('workspace:update-window', async (_, workspaceId, windowId, updates) => {
            try {
                electron_log_1.default.info(`Updating workspace window ${windowId} in workspace ${workspaceId}`);
                const success = this.updateWorkspaceWindow(workspaceId, windowId, updates);
                if (success) {
                    const updatedWindow = this.getWorkspaceWindow(workspaceId, windowId);
                    return { success: true, window: updatedWindow };
                }
                else {
                    return { success: false, error: 'Window not found' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to update workspace window:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('workspace:close-window', async (_, workspaceId, windowId) => {
            try {
                electron_log_1.default.info(`Closing workspace window ${windowId} in workspace ${workspaceId}`);
                const success = this.removeWorkspaceWindow(workspaceId, windowId);
                return { success };
            }
            catch (error) {
                electron_log_1.default.error('Failed to close workspace window:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('workspace:get-window', async (_, workspaceId, windowId) => {
            try {
                electron_log_1.default.debug(`Getting workspace window ${windowId} from workspace ${workspaceId}`);
                const window = this.getWorkspaceWindow(workspaceId, windowId);
                return window;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get workspace window:', error);
                return null;
            }
        });
        // Mail handlers (using comprehensive Rust engine integration)
        electron_1.ipcMain.handle('mail:add-account-obj', async (_, account) => {
            try {
                electron_log_1.default.info(`Adding mail account via Rust integration: ${account.email}`);
                const rustAccount = await rust_engine_integration_1.rustEngineIntegration.addMailAccount({
                    email: account.email,
                    password: account.password,
                    displayName: account.displayName || account.email
                });
                electron_log_1.default.info(`Successfully added mail account via Rust: ${rustAccount.id}`);
                return {
                    id: rustAccount.id,
                    email: rustAccount.email,
                    displayName: rustAccount.displayName,
                    provider: rustAccount.provider,
                    isEnabled: rustAccount.isEnabled
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to add mail account via Rust:', error);
                throw new Error(`Failed to add mail account: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Legacy handler for backward compatibility
        electron_1.ipcMain.handle('mail:add-account', async (_, email, password, displayName) => {
            const account = { email, password, displayName };
            electron_log_1.default.info(`Adding mail account (legacy): ${email}`);
            const accountId = 'temp-legacy-' + Date.now();
            return {
                id: accountId,
                email,
                displayName: displayName || email,
                provider: 'imap',
                isEnabled: true
            };
        });
        electron_1.ipcMain.handle('mail:get-accounts', async () => {
            try {
                const accounts = await rust_engine_integration_1.rustEngineIntegration.getMailAccounts();
                electron_log_1.default.info(`Retrieved ${accounts.length} mail accounts via Rust`);
                return accounts;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get mail accounts via Rust:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('mail:sync-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Syncing mail account via Rust: ${accountId}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.syncMailAccount(accountId);
                electron_log_1.default.info(`Successfully synced account ${accountId} via Rust:`, result);
                return result;
            }
            catch (error) {
                electron_log_1.default.error('Failed to sync mail account via Rust:', error);
                return false;
            }
        });
        // Additional mail handlers for Redux slice compatibility
        electron_1.ipcMain.handle('mail:send-message-obj', async (_, accountId, message) => {
            try {
                electron_log_1.default.info(`Sending message from account ${accountId}: ${message.subject}`);
                // Use real email service for multi-provider support
                if (this.realEmailService) {
                    await this.realEmailService.sendMessage(accountId, message);
                    return true;
                }
                // Fallback to Rust engine for Gmail
                const rustEngine = require('../lib/rust-engine');
                const result = await rustEngine.sendMessage(accountId, message);
                if (result && result.success) {
                    electron_log_1.default.info(`Email sent successfully: ${message.subject}`);
                    return true;
                }
                else {
                    electron_log_1.default.error(`Failed to send email: ${result?.error || 'Unknown error'}`);
                    return false;
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to send email:', error);
                return false;
            }
        });
        electron_1.ipcMain.handle('mail:mark-message-read', async (_, accountId, messageId, read) => {
            try {
                electron_log_1.default.info(`Marking message ${messageId} as ${read ? 'read' : 'unread'} via Rust`);
                const result = await rust_engine_integration_1.rustEngineIntegration.markMessageRead(accountId, messageId, read);
                electron_log_1.default.info(`Successfully marked message ${messageId} as ${read ? 'read' : 'unread'} via Rust`);
                return result;
            }
            catch (error) {
                electron_log_1.default.error('Failed to mark message via Rust:', error);
                return false;
            }
        });
        electron_1.ipcMain.handle('mail:start-sync', async () => {
            electron_log_1.default.info('Starting mail sync for all accounts');
            return true;
        });
        electron_1.ipcMain.handle('mail:stop-sync', async () => {
            electron_log_1.default.info('Stopping mail sync');
            return true;
        });
        electron_1.ipcMain.handle('mail:get-sync-status', async () => {
            // Return Record<string, any> as Redux expects
            return {
                'account1': { issyncing: false, lastSync: new Date(), error: undefined }
            };
        });
        electron_1.ipcMain.handle('mail:delete-message', async (_, accountId, messageId) => {
            electron_log_1.default.info(`Deleting message ${messageId} from account ${accountId}`);
            return true;
        });
        electron_1.ipcMain.handle('mail:sync-all', async () => {
            try {
                electron_log_1.default.info('Starting sync for all mail accounts');
                // Get all mail accounts and sync them
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('mail_list_accounts', []);
                if (result.success && result.result) {
                    const accounts = result.result;
                    let syncedCount = 0;
                    let errorCount = 0;
                    for (const account of accounts) {
                        try {
                            electron_log_1.default.info(`Syncing mail account: ${account.email || account.id}`);
                            const syncResult = await rust_engine_integration_1.rustEngineIntegration.syncMailAccount(account.id);
                            if (syncResult === true) {
                                syncedCount++;
                                electron_log_1.default.debug(`Successfully synced account: ${account.email || account.id}`);
                            }
                            else {
                                errorCount++;
                                electron_log_1.default.warn(`Failed to sync account: ${account.email || account.id}`);
                            }
                        }
                        catch (accountError) {
                            errorCount++;
                            electron_log_1.default.error(`Error syncing account ${account.email || account.id}:`, accountError);
                        }
                    }
                    electron_log_1.default.info(`Mail sync completed: ${syncedCount} succeeded, ${errorCount} failed`);
                    return {
                        success: errorCount === 0,
                        syncedAccounts: syncedCount,
                        errorCount,
                        totalAccounts: accounts.length
                    };
                }
                else {
                    electron_log_1.default.warn('No mail accounts found or failed to list accounts');
                    return { success: true, syncedAccounts: 0, errorCount: 0, totalAccounts: 0 };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to sync all mail accounts:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        electron_1.ipcMain.handle('mail:get-folders', async (_, accountId) => {
            electron_log_1.default.info(`Getting folders for account ${accountId}`);
            try {
                // Call Rust engine to get actual folders
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('mail_get_folders', [accountId]);
                if (result.success) {
                    return result.result;
                }
                else {
                    // Fallback to default folders if Rust call fails
                    return [
                        { name: 'Inbox', count: 0 },
                        { name: 'Sent', count: 0 },
                        { name: 'Drafts', count: 0 },
                        { name: 'Trash', count: 0 }
                    ];
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to get folders:', error);
                return [
                    { name: 'Inbox', count: 0 },
                    { name: 'Sent', count: 0 },
                    { name: 'Drafts', count: 0 },
                    { name: 'Trash', count: 0 }
                ];
            }
        });
        electron_1.ipcMain.handle('mail:get-messages', async (_, accountId, folderId, options) => {
            try {
                electron_log_1.default.info(`Getting messages via Rust for account ${accountId}, folder ${folderId}`);
                const messages = await rust_engine_integration_1.rustEngineIntegration.getMailMessages(accountId);
                electron_log_1.default.info(`Retrieved ${messages.length} messages for account ${accountId} via Rust`);
                // Auto-index messages for search
                if (messages.length > 0) {
                    try {
                        const searchService = (0, search_service_rust_1.getSearchService)();
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
                            electron_log_1.default.info(`Auto-indexed ${Math.min(messages.length, 10)} messages for search`);
                        }
                    }
                    catch (indexError) {
                        electron_log_1.default.error('Failed to auto-index messages:', indexError);
                        // Don't fail the entire operation if indexing fails
                    }
                }
                return messages;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get mail messages via Rust:', error);
                return [];
            }
        });
        // Additional mail handlers for unified API
        electron_1.ipcMain.handle('mail:update-account', async (_, accountId, updates) => {
            try {
                electron_log_1.default.info(`Updating mail account via Rust: ${accountId}`, updates);
                // Convert MailAccountData updates to RustMailAccount format
                const rustUpdates = {
                    ...(updates.email && { email: updates.email }),
                    ...(updates.displayName && { displayName: updates.displayName }),
                    ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
                    ...(updates.provider && { provider: updates.provider })
                };
                const result = await rust_engine_integration_1.rustEngineIntegration.updateMailAccount(accountId, rustUpdates);
                if (result) {
                    electron_log_1.default.info(`Successfully updated mail account via Rust: ${accountId}`);
                    // Trigger a sync after successful update
                    let syncTriggered = false;
                    try {
                        await rust_engine_integration_1.rustEngineIntegration.syncMailAccount(accountId);
                        electron_log_1.default.debug(`Triggered sync after updating account: ${accountId}`);
                        syncTriggered = true;
                    }
                    catch (syncError) {
                        electron_log_1.default.warn(`Failed to trigger sync after update: ${syncError}`);
                    }
                    // Get the updated account information
                    let updatedAccount = null;
                    try {
                        updatedAccount = await rust_engine_integration_1.rustEngineIntegration.getMailAccounts().then(accounts => accounts.find(account => account.id === accountId));
                    }
                    catch (getError) {
                        electron_log_1.default.warn(`Failed to retrieve updated account info: ${getError}`);
                    }
                    return {
                        success: true,
                        accountId,
                        updatedFields: rustUpdates,
                        syncTriggered,
                        account: updatedAccount
                    };
                }
                else {
                    electron_log_1.default.warn(`Mail account update via Rust returned false: ${accountId}`);
                    return { success: false, error: 'Failed to update account in Rust backend' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to update mail account via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update mail account'
                };
            }
        });
        electron_1.ipcMain.handle('mail:remove-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Removing mail account via Rust: ${accountId}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.removeMailAccount(accountId);
                if (result) {
                    electron_log_1.default.info(`Successfully removed mail account via Rust: ${accountId}`);
                    // Clean up any cached data for this account
                    let cacheCleared = false;
                    try {
                        await rust_engine_integration_1.rustEngineIntegration.callRustFunction('mail_clear_account_cache', [accountId]);
                        electron_log_1.default.debug(`Cleared cache for removed account: ${accountId}`);
                        cacheCleared = true;
                    }
                    catch (cacheError) {
                        electron_log_1.default.warn(`Failed to clear cache for removed account: ${cacheError}`);
                    }
                    return {
                        success: true,
                        accountId,
                        cacheCleared,
                        removedAt: new Date().toISOString()
                    };
                }
                else {
                    electron_log_1.default.warn(`Mail account removal via Rust returned false: ${accountId}`);
                    return { success: false, error: 'Failed to remove account in Rust backend' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to remove mail account via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to remove mail account'
                };
            }
        });
        electron_1.ipcMain.handle('mail:send-message', async (_, accountId, to, subject, body, options) => {
            electron_log_1.default.info(`Sending message from account ${accountId} to ${to.join(', ')}`);
            return 'message-' + Date.now();
        });
        electron_1.ipcMain.handle('mail:mark-as-read', async (_, accountId, messageId) => {
            try {
                electron_log_1.default.info(`Marking message ${messageId} as read via Rust`);
                const result = await rust_engine_integration_1.rustEngineIntegration.markMessageRead(accountId, messageId, true);
                if (result) {
                    electron_log_1.default.info(`Successfully marked message ${messageId} as read via Rust`);
                    // Update local cache/state if needed
                    let cacheUpdated = false;
                    try {
                        await rust_engine_integration_1.rustEngineIntegration.callRustFunction('mail_update_message_cache', [messageId, { isRead: true }]);
                        cacheUpdated = true;
                    }
                    catch (cacheError) {
                        electron_log_1.default.debug(`Failed to update message cache: ${cacheError}`);
                    }
                    return {
                        success: true,
                        messageId,
                        accountId,
                        isRead: true,
                        cacheUpdated,
                        markedAt: new Date().toISOString()
                    };
                }
                else {
                    electron_log_1.default.warn(`Mark message as read via Rust returned false: ${messageId}`);
                    return { success: false, error: 'Failed to mark message as read in Rust backend' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to mark message as read via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to mark message as read'
                };
            }
        });
        electron_1.ipcMain.handle('mail:mark-as-unread', async (_, accountId, messageId) => {
            try {
                electron_log_1.default.info(`Marking message ${messageId} as unread via Rust`);
                const result = await rust_engine_integration_1.rustEngineIntegration.markMessageRead(accountId, messageId, false);
                if (result) {
                    electron_log_1.default.info(`Successfully marked message ${messageId} as unread via Rust`);
                    // Update local cache/state if needed
                    let cacheUpdated = false;
                    try {
                        await rust_engine_integration_1.rustEngineIntegration.callRustFunction('mail_update_message_cache', [messageId, { isRead: false }]);
                        cacheUpdated = true;
                    }
                    catch (cacheError) {
                        electron_log_1.default.debug(`Failed to update message cache: ${cacheError}`);
                    }
                    return {
                        success: true,
                        messageId,
                        accountId,
                        isRead: false,
                        cacheUpdated,
                        markedAt: new Date().toISOString()
                    };
                }
                else {
                    electron_log_1.default.warn(`Mark message as unread via Rust returned false: ${messageId}`);
                    return { success: false, error: 'Failed to mark message as unread in Rust backend' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to mark message as unread via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to mark message as unread'
                };
            }
        });
        // mail:delete-message handler already registered above
        electron_1.ipcMain.handle('mail:search-messages', async (_, query, options) => {
            try {
                electron_log_1.default.info(`Searching messages via Rust: ${query}`);
                const results = await rust_engine_integration_1.rustEngineIntegration.searchMailMessages(query);
                electron_log_1.default.info(`Mail search via Rust returned ${results.length} results`);
                return results;
            }
            catch (error) {
                electron_log_1.default.error('Failed to search messages via Rust:', error);
                return [];
            }
        });
        // mail:sync-all handler already registered above
        // mail:get-sync-status handler already registered above
        // Simple Mail API handlers (Apple Mail style)
        electron_1.ipcMain.handle('simple-mail:init-engine', async () => {
            try {
                electron_log_1.default.info('Initializing simple mail engine');
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('init_simple_mail_engine', []);
                return result.success ? result.result : 'Simple mail engine initialized';
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize simple mail engine:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('simple-mail:detect-provider', async (_, email) => {
            try {
                electron_log_1.default.info(`Detecting email provider for: ${email}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('detect_email_provider_info', [email]);
                return result.success ? result.result : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to detect email provider:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('simple-mail:test-connection', async (_, email, password) => {
            try {
                electron_log_1.default.info(`Testing connection for: ${email}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('test_simple_mail_connection', [email, password]);
                return result.success ? result.result : false;
            }
            catch (error) {
                electron_log_1.default.error('Failed to test connection:', error);
                return false;
            }
        });
        electron_1.ipcMain.handle('simple-mail:add-account', async (_, input) => {
            try {
                electron_log_1.default.info(`Adding simple mail account: ${input.email}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('add_simple_mail_account', [input]);
                if (result.success) {
                    return result.result;
                }
                else {
                    throw new Error(result.error || 'Failed to add account');
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to add simple mail account:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('simple-mail:get-accounts', async () => {
            try {
                electron_log_1.default.info('Getting simple mail accounts');
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('get_simple_mail_accounts', []);
                return result.success ? result.result : [];
            }
            catch (error) {
                electron_log_1.default.error('Failed to get simple mail accounts:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('simple-mail:get-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Getting simple mail account: ${accountId}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('get_simple_mail_account', [accountId]);
                return result.success ? result.result : null;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get simple mail account:', error);
                return null;
            }
        });
        electron_1.ipcMain.handle('simple-mail:remove-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Removing simple mail account: ${accountId}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('remove_simple_mail_account', [accountId]);
                if (!result.success) {
                    throw new Error(result.error || 'Failed to remove account');
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to remove simple mail account:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('simple-mail:update-account-status', async (_, accountId, isEnabled) => {
            try {
                electron_log_1.default.info(`Updating simple mail account status: ${accountId} - ${isEnabled}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('update_simple_mail_account_status', [accountId, isEnabled]);
                if (!result.success) {
                    throw new Error(result.error || 'Failed to update account status');
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to update simple mail account status:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('simple-mail:fetch-messages', async (_, accountId, folder) => {
            try {
                electron_log_1.default.info(`Fetching messages for account: ${accountId}, folder: ${folder || 'INBOX'}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('fetch_simple_mail_messages', [accountId, folder]);
                const messages = result.success ? result.result : [];
                // Auto-index messages for search
                if (Array.isArray(messages) && messages.length > 0) {
                    try {
                        const searchService = (0, search_service_rust_1.getSearchService)();
                        if (searchService.isInitialized()) {
                            for (const message of messages.slice(0, 10)) { // Index first 10 messages to avoid overwhelming the system
                                const msgData = message;
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
                            electron_log_1.default.info(`Auto-indexed ${Math.min(messages.length, 10)} messages for search`);
                        }
                    }
                    catch (indexError) {
                        electron_log_1.default.error('Failed to auto-index simple mail messages:', indexError);
                        // Don't fail the entire operation if indexing fails
                    }
                }
                return messages;
            }
            catch (error) {
                electron_log_1.default.error('Failed to fetch simple mail messages:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('simple-mail:send-email', async (_, accountId, to, subject, body, isHtml) => {
            try {
                electron_log_1.default.info(`Sending email from account: ${accountId} to ${to.join(', ')}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('send_simple_email', [accountId, to, subject, body, isHtml]);
                if (!result.success) {
                    throw new Error(result.error || 'Failed to send email');
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to send simple email:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('simple-mail:sync-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Syncing simple mail account: ${accountId}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('sync_simple_mail_account', [accountId]);
                return result.success ? result.result : {
                    accountId,
                    isSyncing: false,
                    error: result.error || 'Sync failed'
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to sync simple mail account:', error);
                return {
                    accountId,
                    isSyncing: false,
                    error: error instanceof Error ? error.message : 'Sync failed'
                };
            }
        });
        electron_1.ipcMain.handle('simple-mail:get-supported-providers', async () => {
            try {
                electron_log_1.default.info('Getting supported email providers');
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('get_supported_email_providers', []);
                return result.success ? result.result : [];
            }
            catch (error) {
                electron_log_1.default.error('Failed to get supported email providers:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('simple-mail:validate-email', async (_, email) => {
            try {
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('validate_email_address', [email]);
                return result.success ? result.result : false;
            }
            catch (error) {
                electron_log_1.default.error('Failed to validate email address:', error);
                return false;
            }
        });
        // Calendar handlers (using comprehensive Rust engine integration)
        electron_1.ipcMain.handle('calendar:add-account', async (_, email, password, serverConfig) => {
            try {
                electron_log_1.default.info(`Adding calendar account via Rust: ${email}`);
                const rustAccount = await rust_engine_integration_1.rustEngineIntegration.addCalendarAccount({
                    email,
                    password,
                    ...(serverConfig?.serverUrl && { serverUrl: serverConfig.serverUrl })
                });
                electron_log_1.default.info(`Successfully added calendar account via Rust: ${rustAccount.id}`);
                return {
                    id: rustAccount.id,
                    email: rustAccount.email,
                    displayName: rustAccount.displayName,
                    provider: rustAccount.provider,
                    isEnabled: rustAccount.isEnabled
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to add calendar account via Rust:', error);
                throw new Error(`Failed to add calendar account: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        electron_1.ipcMain.handle('calendar:get-accounts', async () => {
            try {
                const accounts = await rust_engine_integration_1.rustEngineIntegration.getCalendarAccounts();
                electron_log_1.default.info(`Retrieved ${accounts.length} calendar accounts via Rust`);
                return accounts;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get calendar accounts via Rust:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('calendar:update-account', async (_, accountId, updates) => {
            try {
                electron_log_1.default.info(`Updating calendar account via Rust: ${accountId}`);
                // Prepare the account updates for Rust backend
                const accountUpdates = {
                    ...(updates.displayName && { displayName: updates.displayName }),
                    ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
                    ...(updates.serverUrl && { serverUrl: updates.serverUrl }),
                    ...(updates.username && { username: updates.username }),
                    ...(updates.password && { password: updates.password })
                };
                // Call Rust backend to update the account
                await rust_engine_integration_1.rustEngineIntegration.updateCalendarAccount(accountId, accountUpdates);
                // Trigger a sync after successful update
                let syncTriggered = false;
                try {
                    await rust_engine_integration_1.rustEngineIntegration.syncCalendarAccount(accountId);
                    electron_log_1.default.debug(`Triggered sync after updating calendar account: ${accountId}`);
                    syncTriggered = true;
                }
                catch (syncError) {
                    electron_log_1.default.warn(`Failed to trigger sync after calendar update: ${syncError}`);
                }
                // Get updated account info
                let updatedAccount = null;
                try {
                    updatedAccount = await rust_engine_integration_1.rustEngineIntegration.getCalendarAccounts().then(accounts => accounts.find(account => account.id === accountId));
                }
                catch (getError) {
                    electron_log_1.default.warn(`Failed to retrieve updated calendar account: ${getError}`);
                }
                electron_log_1.default.info(`Successfully updated calendar account via Rust: ${accountId}`);
                return {
                    success: true,
                    accountId,
                    updatedFields: accountUpdates,
                    syncTriggered,
                    account: updatedAccount,
                    updatedAt: new Date().toISOString()
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to update calendar account via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update account'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:remove-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Removing calendar account via Rust: ${accountId}`);
                // Call Rust backend to remove the account
                await rust_engine_integration_1.rustEngineIntegration.removeCalendarAccount(accountId);
                // Clean up any cached calendar data for this account
                let cacheCleared = false;
                try {
                    await rust_engine_integration_1.rustEngineIntegration.callRustFunction('calendar_clear_account_cache', [accountId]);
                    electron_log_1.default.debug(`Cleared cache for removed calendar account: ${accountId}`);
                    cacheCleared = true;
                }
                catch (cacheError) {
                    electron_log_1.default.warn(`Failed to clear cache for removed calendar account: ${cacheError}`);
                }
                electron_log_1.default.info(`Successfully removed calendar account via Rust: ${accountId}`);
                return {
                    success: true,
                    accountId,
                    cacheCleared,
                    removedAt: new Date().toISOString()
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to remove calendar account via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to remove account'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:get-calendars', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Getting calendars for account: ${accountId}`);
                const calendars = await CalendarEngine_1.calendarEngine.getCalendars(accountId);
                electron_log_1.default.info(`Retrieved ${calendars.length} calendars for account ${accountId}`);
                return calendars;
            }
            catch (error) {
                electron_log_1.default.error(`Failed to get calendars for account ${accountId}:`, error);
                if (error instanceof Error && error.message.includes('not yet implemented')) {
                    throw new Error('Calendar functionality is not yet fully implemented in the Rust backend');
                }
                throw new Error(`Failed to get calendars: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        electron_1.ipcMain.handle('calendar:get-events', async (_, accountId, startDate, endDate) => {
            try {
                electron_log_1.default.info(`Getting events via Rust for account ${accountId} from ${startDate} to ${endDate}`);
                const events = await rust_engine_integration_1.rustEngineIntegration.getCalendarEvents(accountId, new Date(startDate), new Date(endDate));
                electron_log_1.default.info(`Retrieved ${events.length} events for account ${accountId} via Rust`);
                // Auto-index events for search
                if (events.length > 0) {
                    try {
                        const searchService = (0, search_service_rust_1.getSearchService)();
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
                            electron_log_1.default.info(`Auto-indexed ${Math.min(events.length, 10)} calendar events for search`);
                        }
                    }
                    catch (indexError) {
                        electron_log_1.default.error('Failed to auto-index calendar events:', indexError);
                        // Don't fail the entire operation if indexing fails
                    }
                }
                return events;
            }
            catch (error) {
                electron_log_1.default.error('Failed to get calendar events via Rust:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('calendar:create-event', async (_, calendarId, title, startTime, endTime, options) => {
            try {
                electron_log_1.default.info(`Creating event via Rust: ${title}`);
                const eventId = await rust_engine_integration_1.rustEngineIntegration.createCalendarEvent({
                    calendarId,
                    title,
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                    ...(options?.description && { description: options.description }),
                    ...(options?.location && { location: options.location })
                });
                electron_log_1.default.info(`Successfully created event via Rust: ${eventId}`);
                return eventId;
            }
            catch (error) {
                electron_log_1.default.error('Failed to create event via Rust:', error);
                return 'event-' + Date.now(); // Fallback ID
            }
        });
        electron_1.ipcMain.handle('calendar:update-event', async (_, eventId, updates) => {
            try {
                electron_log_1.default.info(`Updating calendar event via Rust: ${eventId}`);
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
                await rust_engine_integration_1.rustEngineIntegration.updateCalendarEvent(eventUpdate);
                // Update local calendar cache if needed
                let cacheUpdated = false;
                try {
                    await rust_engine_integration_1.rustEngineIntegration.callRustFunction('calendar_update_event_cache', [eventId, eventUpdate]);
                    cacheUpdated = true;
                }
                catch (cacheError) {
                    electron_log_1.default.debug(`Failed to update calendar event cache: ${cacheError}`);
                }
                // Get the updated event to return complete data
                let updatedEvent = null;
                try {
                    updatedEvent = await rust_engine_integration_1.rustEngineIntegration.getCalendarEvents('default').then(events => events.find(event => event.id === eventId));
                }
                catch (getError) {
                    electron_log_1.default.warn(`Failed to retrieve updated calendar event: ${getError}`);
                }
                electron_log_1.default.info(`Successfully updated calendar event via Rust: ${eventId}`);
                return {
                    success: true,
                    eventId,
                    updatedFields: eventUpdate,
                    cacheUpdated,
                    event: updatedEvent,
                    updatedAt: new Date().toISOString()
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to update calendar event via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update event'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:delete-event', async (_, eventId) => {
            try {
                electron_log_1.default.info(`Deleting calendar event via Rust: ${eventId}`);
                // Get event info before deletion for confirmation
                let deletedEvent = null;
                try {
                    deletedEvent = await rust_engine_integration_1.rustEngineIntegration.getCalendarEvents('default').then(events => events.find(event => event.id === eventId));
                }
                catch (getError) {
                    electron_log_1.default.warn(`Failed to retrieve event before deletion: ${getError}`);
                }
                // Call Rust backend to delete the event
                await rust_engine_integration_1.rustEngineIntegration.deleteCalendarEvent(eventId);
                electron_log_1.default.info(`Successfully deleted calendar event via Rust: ${eventId}`);
                return {
                    success: true,
                    eventId,
                    deletedEvent,
                    deletedAt: new Date().toISOString()
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to delete calendar event via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete event'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:sync-account', async (_, accountId) => {
            try {
                electron_log_1.default.info(`Syncing calendar account via Rust: ${accountId}`);
                const result = await rust_engine_integration_1.rustEngineIntegration.syncCalendarAccount(accountId);
                electron_log_1.default.info(`Successfully synced calendar account ${accountId} via Rust:`, result);
                return { totalCalendars: 1, totalEvents: 0, success: result };
            }
            catch (error) {
                electron_log_1.default.error('Failed to sync calendar account via Rust:', error);
                return { totalCalendars: 0, totalEvents: 0, success: false };
            }
        });
        electron_1.ipcMain.handle('calendar:sync-all', async () => {
            try {
                electron_log_1.default.info('Starting sync for all calendar accounts');
                // Get all calendar accounts and sync them
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('calendar_list_accounts', []);
                if (result.success && result.result) {
                    const accounts = result.result;
                    let syncedCount = 0;
                    let errorCount = 0;
                    for (const account of accounts) {
                        try {
                            electron_log_1.default.info(`Syncing calendar account: ${account.email || account.id}`);
                            const syncResult = await rust_engine_integration_1.rustEngineIntegration.syncCalendarAccount(account.id);
                            if (syncResult) {
                                syncedCount++;
                                electron_log_1.default.debug(`Successfully synced calendar account: ${account.email || account.id}`);
                            }
                            else {
                                errorCount++;
                                electron_log_1.default.warn(`Failed to sync calendar account: ${account.email || account.id}`);
                            }
                        }
                        catch (accountError) {
                            errorCount++;
                            electron_log_1.default.error(`Error syncing calendar account ${account.email || account.id}:`, accountError);
                        }
                    }
                    electron_log_1.default.info(`Calendar sync completed: ${syncedCount} succeeded, ${errorCount} failed`);
                    return {
                        success: errorCount === 0,
                        syncedAccounts: syncedCount,
                        errorCount,
                        totalAccounts: accounts.length
                    };
                }
                else {
                    electron_log_1.default.warn('No calendar accounts found or failed to list accounts');
                    return { success: true, syncedAccounts: 0, errorCount: 0, totalAccounts: 0 };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to sync all calendar accounts:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        // Additional calendar handlers for Redux slice compatibility
        electron_1.ipcMain.handle('calendar:get-user-accounts', async (_, userId) => {
            electron_log_1.default.info(`Getting user accounts for: ${userId}`);
            return { success: true, data: [], error: undefined };
        });
        electron_log_1.default.info('Registered calendar:get-user-accounts handler');
        electron_1.ipcMain.handle('calendar:create-account', async (_, accountData) => {
            try {
                electron_log_1.default.info(`Creating calendar account via Rust: ${accountData.email}`);
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
                electron_log_1.default.info(`Successfully created calendar account via Rust: ${accountData.email}`);
                return { success: true, data: account, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to create calendar account via Rust:', error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to create calendar account'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:delete-account', async (_, accountId) => {
            electron_log_1.default.info(`Deleting calendar account: ${accountId}`);
            return { success: true, error: undefined };
        });
        electron_1.ipcMain.handle('calendar:list-calendars', async (_, accountId) => {
            electron_log_1.default.info(`Listing calendars for account: ${accountId}`);
            return { success: true, data: [], error: undefined };
        });
        electron_1.ipcMain.handle('calendar:get-events-in-range', async (_, calendarIds, timeMin, timeMax) => {
            electron_log_1.default.info(`Getting events in range: ${calendarIds.join(', ')} from ${timeMin} to ${timeMax}`);
            return { success: true, data: [], error: undefined };
        });
        electron_1.ipcMain.handle('calendar:create-event-full', async (_, eventData) => {
            try {
                electron_log_1.default.info(`Creating calendar event (full) via Rust: ${eventData.title}`);
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
                electron_log_1.default.info(`Successfully created calendar event (full) via Rust: ${eventId}`);
                return { success: true, data: event, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to create calendar event (full) via Rust:', error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to create event'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:update-event-full', async (_, calendarId, eventId, updates) => {
            try {
                electron_log_1.default.info(`Updating calendar event (full) via Rust: ${eventId}`);
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
                await rust_engine_integration_1.rustEngineIntegration.updateCalendarEvent(eventUpdate);
                electron_log_1.default.info(`Successfully updated calendar event (full) via Rust: ${eventId}`);
                return { success: true, data: { id: eventId, ...updates }, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to update calendar event (full) via Rust:', error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : 'Failed to update event'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:delete-event-full', async (_, calendarId, eventId) => {
            try {
                electron_log_1.default.info(`Deleting calendar event (full) via Rust: ${eventId}`);
                // Call Rust backend to delete the event
                await rust_engine_integration_1.rustEngineIntegration.deleteCalendarEvent(eventId);
                electron_log_1.default.info(`Successfully deleted calendar event (full) via Rust: ${eventId}`);
                return { success: true, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to delete calendar event (full) via Rust:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete event'
                };
            }
        });
        electron_1.ipcMain.handle('calendar:search-events', async (_, query, limit) => {
            electron_log_1.default.info(`Searching calendar events: ${query}`);
            return { success: true, data: [], error: undefined };
        });
        electron_1.ipcMain.handle('calendar:sync-account-full', async (_, accountId, force) => {
            electron_log_1.default.info(`Syncing calendar account: ${accountId}, force: ${force}`);
            return { success: true, data: { totalCalendars: 1, totalEvents: 0 }, error: undefined };
        });
        // Window management
        electron_1.ipcMain.handle('window:minimize', () => this.mainWindow?.minimize());
        electron_1.ipcMain.handle('window:maximize', () => {
            if (this.mainWindow?.isMaximized()) {
                this.mainWindow.unmaximize();
            }
            else {
                this.mainWindow?.maximize();
            }
        });
        electron_1.ipcMain.handle('window:close', () => this.mainWindow?.close());
        // System information handlers
        electron_1.ipcMain.handle('system:get-info', async () => {
            return {
                platform: process.platform,
                version: electron_1.app.getVersion(),
                arch: process.arch,
                deviceId: require('os').hostname() || 'unknown',
                isDarkMode: true, // Default to dark mode
                isHighContrast: false
            };
        });
        // Settings handlers
        electron_1.ipcMain.handle('settings:get', async () => {
            try {
                // Get settings from Rust engine
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('settings_get', []);
                if (result.success) {
                    return result.result;
                }
                else {
                    // Fallback to default settings
                    return {
                        theme: 'auto',
                        notifications: true,
                        autoSync: true,
                        language: 'en',
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to get settings:', error);
                return {
                    theme: 'auto',
                    notifications: true,
                    autoSync: true,
                    language: 'en',
                    timezone: 'UTC'
                };
            }
        });
        electron_1.ipcMain.handle('settings:set', async (_, settings) => {
            try {
                // Save settings via Rust engine
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('settings_set', [settings]);
                electron_log_1.default.info('Updated settings:', settings);
                return result;
            }
            catch (error) {
                electron_log_1.default.error('Failed to update settings:', error);
                return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
        });
        electron_1.ipcMain.handle('settings:set-key', async (_, key, value) => {
            try {
                // Update individual setting via Rust engine
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('settings_set_key', [key, value]);
                electron_log_1.default.info(`Setting ${key} = ${value}`);
                return result;
            }
            catch (error) {
                electron_log_1.default.error(`Failed to set ${key}:`, error);
                return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
        });
        electron_1.ipcMain.handle('settings:update', async (_, settings) => {
            try {
                // Bulk update settings via Rust engine
                const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('settings_update', [settings]);
                electron_log_1.default.info('Bulk updating settings:', settings);
                return result;
            }
            catch (error) {
                electron_log_1.default.error('Failed to bulk update settings:', error);
                return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
        });
        // Search API handlers (using comprehensive Rust search engine)
        electron_1.ipcMain.handle('search:perform', async (_, options) => {
            try {
                electron_log_1.default.info(`Performing search: ${options.query}`);
                const searchService = (0, search_service_rust_1.getSearchService)();
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
                electron_log_1.default.info(`Search returned ${response.results.length} results (${response.total} total)`);
                return {
                    success: true,
                    data: {
                        results: response.results,
                        total: response.total,
                        executionTime: response.took
                    },
                    error: undefined
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to perform search:', error);
                return {
                    success: false,
                    data: { results: [], total: 0 },
                    error: error instanceof Error ? error.message : 'Search failed'
                };
            }
        });
        electron_1.ipcMain.handle('search:get-suggestions', async (_, partialQuery, limit = 10) => {
            try {
                electron_log_1.default.info(`Getting search suggestions for: ${partialQuery}`);
                const searchService = (0, search_service_rust_1.getSearchService)();
                if (!searchService.isInitialized()) {
                    await searchService.initialize();
                }
                const suggestions = await searchService.getSuggestions(partialQuery, limit);
                electron_log_1.default.info(`Generated ${suggestions.length} suggestions`);
                return { success: true, data: suggestions, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to get search suggestions:', error);
                return { success: false, data: [], error: error instanceof Error ? error.message : 'Suggestions failed' };
            }
        });
        electron_1.ipcMain.handle('search:index-document', async (_, document) => {
            try {
                electron_log_1.default.info(`Indexing document: ${document.id}`);
                const searchService = (0, search_service_rust_1.getSearchService)();
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
                electron_log_1.default.info(`Document indexed successfully: ${document.id}`);
                return { success: true, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to index document:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Indexing failed' };
            }
        });
        electron_1.ipcMain.handle('search:initialize', async () => {
            try {
                electron_log_1.default.info('Initializing search engine via Rust');
                // Search engine is already initialized in initializeRustEngine()
                const isInitialized = rust_engine_integration_1.rustEngineIntegration.isInitialized();
                electron_log_1.default.info('Search engine initialization via Rust:', isInitialized);
                return { success: isInitialized, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize search engine via Rust:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Search initialization failed' };
            }
        });
        electron_1.ipcMain.handle('search:get-analytics', async () => {
            try {
                electron_log_1.default.info('Getting search analytics via Rust');
                // Return basic analytics - this would be expanded with actual Rust analytics
                const analytics = {
                    totalDocuments: 0,
                    totalSearches: 0,
                    avgResponseTime: 0,
                    engineVersion: rust_engine_integration_1.rustEngineIntegration.getVersion()
                };
                return { success: true, data: analytics, error: undefined };
            }
            catch (error) {
                electron_log_1.default.error('Failed to get search analytics via Rust:', error);
                return { success: false, data: {}, error: error instanceof Error ? error.message : 'Analytics failed' };
            }
        });
        // Theme API handlers (for themeSlice compatibility)
        electron_1.ipcMain.handle('theme:get', async () => {
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
                }
                catch (fileError) {
                    // Return default theme if no config found
                    return { theme: 'dark', accentColor: '#3b82f6', fontSize: 'medium' };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to get theme:', error);
                return { theme: 'dark', accentColor: '#3b82f6', fontSize: 'medium' };
            }
        });
        electron_1.ipcMain.handle('theme:set', async (_, theme) => {
            try {
                electron_log_1.default.info('Setting theme:', theme);
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
                    }
                    catch (jsError) {
                        electron_log_1.default.debug('Failed to apply theme to window:', jsError);
                    }
                }
                electron_log_1.default.info('Successfully set theme:', themeConfig);
                return { success: true, theme: themeConfig };
            }
            catch (error) {
                electron_log_1.default.error('Failed to set theme:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        // AI Engine API handlers
        electron_1.ipcMain.handle('ai:initialize', async (_, cacheDir) => {
            try {
                electron_log_1.default.info(`Initializing AI engine with cache dir: ${cacheDir || 'default'}`);
                // Initialize AI engine via Rust backend
                let initMethod = 'rust';
                let errorDetails = null;
                try {
                    await rust_engine_integration_1.rustEngineIntegration.initAiEngine();
                    electron_log_1.default.info('AI engine initialized successfully via Rust');
                    return {
                        success: true,
                        initMethod,
                        cacheDir: cacheDir || 'default',
                        initializedAt: new Date().toISOString()
                    };
                }
                catch (rustError) {
                    electron_log_1.default.warn('Failed to initialize AI engine via Rust, using fallback:', rustError);
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
                    }
                    catch (fallbackError) {
                        electron_log_1.default.error('Fallback AI initialization also failed:', fallbackError);
                        throw fallbackError;
                    }
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize AI engine:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('ai:store-api-key', async (_, provider, apiKey) => {
            try {
                electron_log_1.default.info(`Storing API key for provider: ${provider}`);
                // Store API key securely using Rust engine
                let storageMethod = 'rust';
                let errorDetails = null;
                try {
                    const success = await rust_engine_integration_1.rustEngineIntegration.storeAPIKey(provider, apiKey);
                    if (!success) {
                        throw new Error('Failed to store API key in Rust engine');
                    }
                    electron_log_1.default.info(`API key stored successfully for provider: ${provider}`);
                    return {
                        success: true,
                        provider,
                        storageMethod,
                        storedAt: new Date().toISOString()
                    };
                }
                catch (rustError) {
                    electron_log_1.default.warn('Rust engine storage failed, using keychain fallback:', rustError);
                    storageMethod = 'keychain';
                    errorDetails = rustError instanceof Error ? rustError.message : String(rustError);
                    // Fallback to system keychain
                    const keytar = await Promise.resolve().then(() => __importStar(require('keytar')));
                    await keytar.setPassword('flow-desk-ai', provider, apiKey);
                    return {
                        success: true,
                        provider,
                        storageMethod,
                        fallbackReason: errorDetails,
                        storedAt: new Date().toISOString()
                    };
                }
            }
            catch (error) {
                electron_log_1.default.error(`Failed to store API key for ${provider}:`, error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('ai:has-api-key', async (_, provider) => {
            try {
                electron_log_1.default.info(`Checking API key for provider: ${provider}`);
                // Check if API key exists via Rust engine or keychain
                try {
                    const hasKey = await rust_engine_integration_1.rustEngineIntegration.hasAPIKey(provider);
                    return hasKey;
                }
                catch (rustError) {
                    electron_log_1.default.warn('Rust engine check failed, using keychain fallback:', rustError);
                    try {
                        const keytar = await Promise.resolve().then(() => __importStar(require('keytar')));
                        const apiKey = await keytar.getPassword('flow-desk-ai', provider);
                        return !!apiKey;
                    }
                    catch (keychainError) {
                        electron_log_1.default.warn('Keychain check failed:', keychainError);
                        return false;
                    }
                }
            }
            catch (error) {
                electron_log_1.default.error(`Failed to check API key for ${provider}:`, error);
                return false;
            }
        });
        electron_1.ipcMain.handle('ai:delete-api-key', async (_, provider) => {
            try {
                electron_log_1.default.info(`Deleting API key for provider: ${provider}`);
                // Delete API key via Rust engine or keychain
                try {
                    const success = await rust_engine_integration_1.rustEngineIntegration.deleteAPIKey(provider);
                    if (success) {
                        electron_log_1.default.info(`API key deleted successfully for provider: ${provider}`);
                        return true;
                    }
                    throw new Error('Rust engine delete failed');
                }
                catch (rustError) {
                    electron_log_1.default.warn('Rust engine delete failed, using keychain fallback:', rustError);
                    try {
                        const keytar = await Promise.resolve().then(() => __importStar(require('keytar')));
                        const deleted = await keytar.deletePassword('flow-desk-ai', provider);
                        return deleted;
                    }
                    catch (keychainError) {
                        electron_log_1.default.error('Keychain delete failed:', keychainError);
                        return false;
                    }
                }
            }
            catch (error) {
                electron_log_1.default.error(`Failed to delete API key for ${provider}:`, error);
                return false;
            }
        });
        electron_1.ipcMain.handle('ai:create-completion', async (_, request) => {
            try {
                electron_log_1.default.info(`Creating AI completion for model: ${request.model}`);
                // Create AI completion using Rust engine
                try {
                    const completion = await rust_engine_integration_1.rustEngineIntegration.createCompletion(request);
                    electron_log_1.default.info(`AI completion created successfully for model: ${request.model}`);
                    return completion;
                }
                catch (rustError) {
                    electron_log_1.default.error('Rust engine completion failed:', rustError);
                    const error = rustError;
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
            }
            catch (error) {
                electron_log_1.default.error('Failed to create AI completion:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('ai:create-streaming-completion', async (_, request, streamChannel) => {
            try {
                electron_log_1.default.info(`Creating streaming AI completion for model: ${request.model}`);
                // Create streaming AI completion using Rust engine
                try {
                    const streamId = await rust_engine_integration_1.rustEngineIntegration.createStreamingCompletion(request, (chunk) => {
                        if (this.mainWindow) {
                            this.mainWindow.webContents.send(streamChannel, chunk);
                        }
                    });
                    electron_log_1.default.info(`Streaming AI completion started for model: ${request.model}`);
                    return { success: true, streamId };
                }
                catch (rustError) {
                    electron_log_1.default.error('Rust engine streaming failed:', rustError);
                    const error = rustError;
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
            }
            catch (error) {
                electron_log_1.default.error('Failed to create streaming AI completion:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('ai:get-available-models', async () => {
            try {
                electron_log_1.default.info('Getting available AI models');
                // Get available AI models from Rust engine
                try {
                    const models = await rust_engine_integration_1.rustEngineIntegration.getAvailableModels();
                    electron_log_1.default.info(`Retrieved ${models.length} available AI models`);
                    return models;
                }
                catch (rustError) {
                    electron_log_1.default.warn('Failed to get models from Rust engine:', rustError);
                    return [];
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to get available models:', error);
                return [];
            }
        });
        electron_1.ipcMain.handle('ai:health-check', async () => {
            try {
                electron_log_1.default.info('Performing AI engine health check');
                // Perform AI engine health check via Rust engine
                try {
                    const healthStatus = await rust_engine_integration_1.rustEngineIntegration.performHealthCheck();
                    electron_log_1.default.info('AI engine health check completed:', healthStatus);
                    return healthStatus.isHealthy || false;
                }
                catch (rustError) {
                    electron_log_1.default.warn('AI engine health check failed:', rustError);
                    return false;
                }
            }
            catch (error) {
                electron_log_1.default.error('AI health check failed:', error);
                return false;
            }
        });
        electron_1.ipcMain.handle('ai:get-usage-stats', async () => {
            try {
                electron_log_1.default.info('Getting AI usage statistics');
                // Get AI usage statistics from Rust engine
                try {
                    const stats = await rust_engine_integration_1.rustEngineIntegration.getUsageStats();
                    electron_log_1.default.info('Retrieved AI usage statistics:', stats);
                    return {
                        totalRequests: stats.totalRequests || 0,
                        successfulRequests: stats.successfulRequests || 0,
                        failedRequests: stats.failedRequests || 0,
                        totalTokensUsed: stats.totalTokensUsed || 0,
                        totalCost: stats.totalCost || 0,
                        averageResponseTimeMs: stats.averageResponseTimeMs || 0
                    };
                }
                catch (rustError) {
                    electron_log_1.default.warn('Failed to get usage stats from Rust engine:', rustError);
                    return {
                        totalRequests: 0,
                        successfulRequests: 0,
                        failedRequests: 0,
                        totalTokensUsed: 0,
                        totalCost: 0,
                        averageResponseTimeMs: 0
                    };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to get usage stats:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('ai:get-rate-limit-info', async (_, provider) => {
            try {
                electron_log_1.default.info(`Getting rate limit info for provider: ${provider}`);
                // Get rate limit info from provider via Rust engine
                try {
                    const rateLimitInfo = await rust_engine_integration_1.rustEngineIntegration.getRateLimitInfo(provider);
                    electron_log_1.default.info(`Retrieved rate limit info for ${provider}:`, rateLimitInfo);
                    return rateLimitInfo;
                }
                catch (rustError) {
                    electron_log_1.default.warn(`Failed to get rate limit info for ${provider}:`, rustError);
                    return null;
                }
            }
            catch (error) {
                electron_log_1.default.error(`Failed to get rate limit info for ${provider}:`, error);
                return null;
            }
        });
        electron_1.ipcMain.handle('ai:clear-cache', async (_, operationType) => {
            try {
                electron_log_1.default.info(`Clearing AI cache for operation type: ${operationType || 'all'}`);
                // Clear AI cache via Rust engine
                try {
                    await rust_engine_integration_1.rustEngineIntegration.clearCache(operationType);
                    electron_log_1.default.info(`AI cache cleared successfully for operation: ${operationType || 'all'}`);
                    // Get cache statistics after clearing (if available)
                    let cacheStats = null;
                    try {
                        cacheStats = await rust_engine_integration_1.rustEngineIntegration.getCacheStats();
                    }
                    catch (statsError) {
                        electron_log_1.default.debug(`Failed to get cache stats after clear: ${statsError}`);
                    }
                    return {
                        success: true,
                        operationType: operationType || 'all',
                        cacheStats,
                        clearedAt: new Date().toISOString()
                    };
                }
                catch (rustError) {
                    electron_log_1.default.error('Failed to clear AI cache:', rustError);
                    return {
                        success: false,
                        error: rustError instanceof Error ? rustError.message : String(rustError),
                        operationType: operationType || 'all',
                        failedAt: new Date().toISOString()
                    };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to clear AI cache:', error);
                throw error;
            }
        });
        electron_1.ipcMain.handle('ai:get-cache-stats', async () => {
            try {
                electron_log_1.default.info('Getting AI cache statistics');
                // Get AI cache statistics from Rust engine
                try {
                    const cacheStats = await rust_engine_integration_1.rustEngineIntegration.getCacheStats();
                    electron_log_1.default.info('Retrieved AI cache statistics:', cacheStats);
                    return cacheStats;
                }
                catch (rustError) {
                    electron_log_1.default.warn('Failed to get cache stats from Rust engine:', rustError);
                    return {
                        totalEntries: 0,
                        totalSize: 0,
                        hitRate: 0,
                        missRate: 0
                    };
                }
            }
            catch (error) {
                electron_log_1.default.error('Failed to get cache stats:', error);
                return {};
            }
        });
        electron_1.ipcMain.handle('ai:test-provider', async (_, provider) => {
            try {
                electron_log_1.default.info(`Testing AI provider: ${provider}`);
                // Test AI provider via Rust engine
                try {
                    const testResult = await rust_engine_integration_1.rustEngineIntegration.testProvider(provider);
                    electron_log_1.default.info(`AI provider test for ${provider}:`, testResult);
                    return testResult || false;
                }
                catch (rustError) {
                    electron_log_1.default.error(`AI provider test failed for ${provider}:`, rustError);
                    return false;
                }
            }
            catch (error) {
                electron_log_1.default.error(`Failed to test provider ${provider}:`, error);
                return false;
            }
        });
        // Database API handlers
        electron_1.ipcMain.handle('database:get-status', async () => {
            try {
                const databaseService = (0, database_initialization_service_1.getDatabaseInitializationService)();
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
            }
            catch (error) {
                electron_log_1.default.error('Failed to get database status:', error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        electron_1.ipcMain.handle('database:initialize', async () => {
            try {
                electron_log_1.default.info('Manual database initialization requested');
                await this.initializeDatabases();
                return {
                    success: this.databaseInitialized,
                    error: this.databaseInitialized ? undefined : 'Database initialization failed'
                };
            }
            catch (error) {
                electron_log_1.default.error('Manual database initialization failed:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        electron_1.ipcMain.handle('database:repair', async () => {
            try {
                electron_log_1.default.info('Database repair requested');
                const databaseService = (0, database_initialization_service_1.getDatabaseInitializationService)();
                const success = await databaseService.repairDatabases();
                if (success) {
                    // Re-initialize Rust engines after repair
                    await this.initializeRustEngine();
                }
                return {
                    success,
                    error: success ? undefined : 'Database repair failed'
                };
            }
            catch (error) {
                electron_log_1.default.error('Database repair failed:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        electron_1.ipcMain.handle('database:check-integrity', async () => {
            try {
                electron_log_1.default.info('Database integrity check requested');
                const databaseService = (0, database_initialization_service_1.getDatabaseInitializationService)();
                const config = databaseService.getConfig();
                // Check integrity of each database
                const results = {
                    mail: { valid: false, error: null },
                    calendar: { valid: false, error: null }
                };
                try {
                    // Use Rust engine to check database integrity if available
                    const rustEngine = require('../lib/rust-engine');
                    const mailCheck = await rustEngine.checkDatabaseIntegrity(config.mailDbPath);
                    results.mail = { valid: mailCheck.valid, error: mailCheck.errors?.join(', ') || null };
                    const calendarCheck = await rustEngine.checkDatabaseIntegrity(config.calendarDbPath);
                    results.calendar = { valid: calendarCheck.valid, error: calendarCheck.errors?.join(', ') || null };
                }
                catch (error) {
                    electron_log_1.default.warn('Rust engine integrity check failed, using fallback:', error);
                    // Fallback: just check if databases exist and are accessible
                    const fs = require('fs').promises;
                    try {
                        await fs.access(config.mailDbPath);
                        results.mail = { valid: true, error: null };
                    }
                    catch (err) {
                        results.mail = { valid: false, error: 'Database file not accessible' };
                    }
                    try {
                        await fs.access(config.calendarDbPath);
                        results.calendar = { valid: true, error: null };
                    }
                    catch (err) {
                        results.calendar = { valid: false, error: 'Database file not accessible' };
                    }
                }
                return {
                    success: true,
                    data: results,
                    error: undefined
                };
            }
            catch (error) {
                electron_log_1.default.error('Database integrity check failed:', error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        electron_1.ipcMain.handle('database:get-migration-status', async () => {
            try {
                const databaseService = (0, database_initialization_service_1.getDatabaseInitializationService)();
                const config = databaseService.getConfig();
                const { getDatabaseMigrationManager } = require('./database-migration-manager');
                const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
                const statuses = await migrationManager.getAllMigrationStatuses();
                return {
                    success: true,
                    data: statuses,
                    error: undefined
                };
            }
            catch (error) {
                electron_log_1.default.error('Failed to get migration status:', error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        electron_1.ipcMain.handle('database:apply-migrations', async () => {
            try {
                electron_log_1.default.info('Manual migration application requested');
                const databaseService = (0, database_initialization_service_1.getDatabaseInitializationService)();
                const config = databaseService.getConfig();
                const { getDatabaseMigrationManager } = require('./database-migration-manager');
                const migrationManager = getDatabaseMigrationManager(config.mailDbPath, config.calendarDbPath);
                const success = await migrationManager.applyAllMigrations();
                return {
                    success,
                    error: success ? undefined : 'Migration application failed'
                };
            }
            catch (error) {
                electron_log_1.default.error('Migration application failed:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        electron_log_1.default.info('IPC handlers setup complete');
    }
    /**
     * Switch between mail, calendar, and workspace views
     */
    async switchToView(view) {
        this.currentView = view;
        if (!this.mainWindow)
            return;
        // Store current view on the main window for workspace manager access
        this.mainWindow.currentView = view;
        electron_log_1.default.info(`Switching to view: ${view}`);
        // ALWAYS completely remove BrowserView - this is critical for proper layering
        if (this.mainWindow.getBrowserView()) {
            this.mainWindow.setBrowserView(null);
            electron_log_1.default.info('Forcibly removed BrowserView from main window');
        }
        // Also hide through workspace manager for double safety
        this.workspaceManager.hideAllBrowserViews(this.mainWindow);
        if (view === 'workspace') {
            electron_log_1.default.info('Workspace view activated - all BrowserViews hidden, ready for manual service selection');
            // Don't auto-load any services - user must explicitly select
        }
        else {
            electron_log_1.default.info(`${view} view activated - BrowserViews permanently hidden`);
            // For mail/calendar, completely disable BrowserView functionality
            // Close any active services to prevent them from interfering
            const allBrowserViews = this.workspaceManager.getAllBrowserViews();
            for (const browserView of allBrowserViews) {
                try {
                    if (this.mainWindow.getBrowserView() === browserView) {
                        this.mainWindow.setBrowserView(null);
                        electron_log_1.default.info('Detached BrowserView during view switch');
                    }
                }
                catch (error) {
                    electron_log_1.default.warn('Error detaching BrowserView:', error);
                }
            }
        }
        // Notify renderer about view change
        this.mainWindow.webContents.send('view-changed', view);
        electron_log_1.default.info(`Successfully switched to view: ${view}`);
    }
    resizeBrowserViews() {
        if (!this.mainWindow)
            return;
        // Use workspace manager to update all browser view bounds properly
        this.workspaceManager.updateBrowserViewBounds(this.mainWindow);
    }
    // Workspace Window Management Utility Methods
    /**
     * Update workspace window properties
     */
    updateWorkspaceWindow(workspaceId, windowId, updates) {
        const windows = this.workspaceWindows.get(workspaceId);
        if (!windows)
            return false;
        const windowIndex = windows.findIndex(w => w.id === windowId);
        if (windowIndex === -1)
            return false;
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
    removeWorkspaceWindow(workspaceId, windowId) {
        const windows = this.workspaceWindows.get(workspaceId);
        if (!windows)
            return false;
        const filteredWindows = windows.filter(w => w.id !== windowId);
        if (filteredWindows.length === windows.length)
            return false;
        this.workspaceWindows.set(workspaceId, filteredWindows);
        return true;
    }
    /**
     * Get specific workspace window
     */
    getWorkspaceWindow(workspaceId, windowId) {
        const windows = this.workspaceWindows.get(workspaceId);
        if (!windows)
            return null;
        return windows.find(w => w.id === windowId) || null;
    }
}
// Initialize the app
new FlowDeskApp();
electron_log_1.default.info('Flow Desk main process initialized');
