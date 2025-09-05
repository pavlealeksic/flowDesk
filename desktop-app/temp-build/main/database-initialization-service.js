"use strict";
/**
 * Database Initialization Service
 *
 * Ensures all SQLite databases are created and initialized on first app launch.
 * Handles migration, health checks, and user data directory setup.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseInitializationService = void 0;
exports.getDatabaseInitializationService = getDatabaseInitializationService;
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
const electron_log_1 = __importDefault(require("electron-log"));
const child_process_1 = require("child_process");
const database_migration_manager_1 = require("./database-migration-manager");
/**
 * Main database initialization service
 */
class DatabaseInitializationService {
    constructor(progressCallback) {
        this.progressCallback = progressCallback || undefined;
        this.config = this.generateConfig();
    }
    /**
     * Generate configuration with platform-specific paths
     */
    generateConfig() {
        const userDataPath = this.getUserDataDirectory();
        const databasesPath = (0, path_1.join)(userDataPath, 'databases');
        return {
            userDataPath,
            mailDbPath: (0, path_1.join)(databasesPath, 'mail.db'),
            calendarDbPath: (0, path_1.join)(databasesPath, 'calendar.db'),
            searchIndexPath: (0, path_1.join)(databasesPath, 'search_index'),
            configPath: (0, path_1.join)(userDataPath, 'config.json'),
            schemaVersion: 1 // Current schema version
        };
    }
    /**
     * Get platform-specific user data directory
     */
    getUserDataDirectory() {
        // Use Electron's standard user data path
        const baseUserData = electron_1.app.getPath('userData');
        // Create subdirectory for Flow Desk data
        return (0, path_1.join)(baseUserData, 'FlowDesk');
    }
    /**
     * Initialize all databases on first run
     */
    async initializeDatabases() {
        try {
            this.updateProgress('setup', 0, 'Starting database initialization...');
            // Step 1: Setup directories
            await this.setupDirectories();
            this.updateProgress('directories', 15, 'Directories created');
            // Step 2: Check existing databases
            const databaseStatuses = await this.checkDatabaseStatuses();
            const needsInitialization = Object.values(databaseStatuses).some(status => !status.exists);
            if (!needsInitialization) {
                this.updateProgress('complete', 100, 'All databases already exist and are valid');
                return true;
            }
            // Step 3: Initialize mail database
            await this.initializeMailDatabase();
            this.updateProgress('mail', 40, 'Mail database initialized');
            // Step 4: Initialize calendar database  
            await this.initializeCalendarDatabase();
            this.updateProgress('calendar', 65, 'Calendar database initialized');
            // Step 5: Initialize search index
            await this.initializeSearchIndex();
            this.updateProgress('search', 80, 'Search index initialized');
            // Step 6: Run migrations if needed
            await this.runMigrations();
            this.updateProgress('migrations', 90, 'Database migrations completed');
            // Step 7: Validate all databases
            await this.validateDatabases();
            this.updateProgress('validation', 95, 'Database validation completed');
            // Step 8: Save configuration
            await this.saveConfiguration();
            this.updateProgress('complete', 100, 'Database initialization completed successfully');
            electron_log_1.default.info('Database initialization completed successfully');
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Database initialization failed:', error);
            this.updateProgress('setup', 0, 'Database initialization failed', error instanceof Error ? error.message : 'Unknown error');
            // Show error dialog to user
            await this.showInitializationError(error);
            return false;
        }
    }
    /**
     * Setup required directories with proper permissions
     */
    async setupDirectories() {
        const directories = [
            this.config.userDataPath,
            (0, path_1.dirname)(this.config.mailDbPath),
            (0, path_1.dirname)(this.config.calendarDbPath),
            (0, path_1.dirname)(this.config.searchIndexPath)
        ];
        for (const dir of directories) {
            try {
                await fs_1.promises.access(dir, fs_1.constants.F_OK);
                electron_log_1.default.debug(`Directory already exists: ${dir}`);
            }
            catch {
                await fs_1.promises.mkdir(dir, { recursive: true });
                electron_log_1.default.info(`Created directory: ${dir}`);
            }
        }
        // Set appropriate permissions (read/write for user only)
        if (process.platform !== 'win32') {
            for (const dir of directories) {
                await fs_1.promises.chmod(dir, 0o700);
            }
        }
    }
    /**
     * Check status of all databases
     */
    async checkDatabaseStatuses() {
        const databases = {
            mail: this.config.mailDbPath,
            calendar: this.config.calendarDbPath,
            search: this.config.searchIndexPath
        };
        const statuses = {};
        for (const [name, path] of Object.entries(databases)) {
            try {
                const stats = await fs_1.promises.stat(path);
                statuses[name] = {
                    exists: true,
                    isValid: true, // Will be validated later
                    size: stats.size,
                    lastModified: stats.mtime
                };
            }
            catch {
                statuses[name] = {
                    exists: false,
                    isValid: false,
                    size: 0
                };
            }
        }
        return statuses;
    }
    /**
     * Initialize mail database with proper schema
     */
    async initializeMailDatabase() {
        if ((0, fs_1.existsSync)(this.config.mailDbPath)) {
            electron_log_1.default.debug('Mail database already exists, skipping creation');
            return;
        }
        electron_log_1.default.info('Creating mail database...');
        // Create empty database file first
        try {
            // Create an empty SQLite database - migrations will handle the schema
            const sqlite3 = await this.loadSQLite3();
            await new Promise((resolve, reject) => {
                const db = new sqlite3.Database(this.config.mailDbPath, (err) => {
                    if (err) {
                        reject(new Error(`Failed to create mail database: ${err.message}`));
                    }
                    else {
                        // Just close it immediately - migrations will create the schema
                        db.close((closeErr) => {
                            if (closeErr) {
                                reject(new Error(`Failed to close mail database: ${closeErr.message}`));
                            }
                            else {
                                electron_log_1.default.info('Mail database file created successfully');
                                resolve();
                            }
                        });
                    }
                });
            });
        }
        catch (error) {
            electron_log_1.default.error('Failed to create mail database:', error);
            throw error;
        }
    }
    /**
     * Initialize calendar database with proper schema
     */
    async initializeCalendarDatabase() {
        if ((0, fs_1.existsSync)(this.config.calendarDbPath)) {
            electron_log_1.default.debug('Calendar database already exists, skipping creation');
            return;
        }
        electron_log_1.default.info('Creating calendar database...');
        // Create empty database file first
        try {
            // Create an empty SQLite database - migrations will handle the schema
            const sqlite3 = await this.loadSQLite3();
            await new Promise((resolve, reject) => {
                const db = new sqlite3.Database(this.config.calendarDbPath, (err) => {
                    if (err) {
                        reject(new Error(`Failed to create calendar database: ${err.message}`));
                    }
                    else {
                        // Just close it immediately - migrations will create the schema
                        db.close((closeErr) => {
                            if (closeErr) {
                                reject(new Error(`Failed to close calendar database: ${closeErr.message}`));
                            }
                            else {
                                electron_log_1.default.info('Calendar database file created successfully');
                                resolve();
                            }
                        });
                    }
                });
            });
        }
        catch (error) {
            electron_log_1.default.error('Failed to create calendar database:', error);
            throw error;
        }
    }
    /**
     * Initialize search index
     */
    async initializeSearchIndex() {
        if ((0, fs_1.existsSync)(this.config.searchIndexPath)) {
            electron_log_1.default.debug('Search index already exists, skipping creation');
            return;
        }
        electron_log_1.default.info('Creating search index...');
        try {
            const rustEngine = require('../lib/rust-engine');
            // Create search index
            await this.executeDatabaseCommand('init_search_index', this.config.searchIndexPath);
            electron_log_1.default.info('Search index created successfully');
        }
        catch (error) {
            electron_log_1.default.error('Failed to create search index via Rust:', error);
            // Create basic directory structure for Tantivy index
            await fs_1.promises.mkdir(this.config.searchIndexPath, { recursive: true });
            electron_log_1.default.info('Created search index directory as fallback');
        }
    }
    /**
     * Execute database initialization command via CLI
     */
    async executeDatabaseCommand(command, path) {
        return new Promise((resolve, reject) => {
            // Try to find the Rust CLI binary
            const possiblePaths = [
                (0, path_1.join)(process.cwd(), 'dist/lib/rust-engine/target/release/flow-desk-cli'),
                (0, path_1.join)(process.cwd(), 'dist/lib/rust-engine/target/debug/flow-desk-cli'),
                'flow-desk-cli' // In PATH
            ];
            let binaryPath = null;
            for (const path of possiblePaths) {
                if ((0, fs_1.existsSync)(path) || (0, fs_1.existsSync)(`${path}.exe`)) {
                    binaryPath = path;
                    break;
                }
            }
            if (!binaryPath) {
                reject(new Error('Flow Desk CLI binary not found'));
                return;
            }
            const args = [command, '--database-path', path];
            const child = (0, child_process_1.spawn)(binaryPath, args, {
                stdio: 'pipe',
                timeout: 30000 // 30 second timeout
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('close', (code) => {
                if (code === 0) {
                    electron_log_1.default.debug(`Database command ${command} completed successfully`);
                    resolve();
                }
                else {
                    reject(new Error(`Database command failed with code ${code}: ${stderr}`));
                }
            });
            child.on('error', (error) => {
                reject(new Error(`Failed to execute database command: ${error.message}`));
            });
        });
    }
    /**
     * Load SQLite3 module
     */
    async loadSQLite3() {
        try {
            return require('sqlite3').verbose();
        }
        catch (error) {
            throw new Error('SQLite3 module not available. Please install sqlite3: npm install sqlite3');
        }
    }
    /**
     * Run database migrations
     */
    async runMigrations() {
        electron_log_1.default.info('Running database migrations...');
        try {
            // Get the migration manager
            const migrationManager = (0, database_migration_manager_1.getDatabaseMigrationManager)(this.config.mailDbPath, this.config.calendarDbPath);
            // Apply all pending migrations
            const success = await migrationManager.applyAllMigrations();
            if (success) {
                electron_log_1.default.info('Database migrations completed successfully');
            }
            else {
                throw new Error('Some database migrations failed');
            }
        }
        catch (error) {
            electron_log_1.default.error('Database migration failed:', error);
            throw new Error(`Failed to run database migrations: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validate all databases
     */
    async validateDatabases() {
        electron_log_1.default.info('Validating databases...');
        const databases = [
            { path: this.config.mailDbPath, type: 'mail' },
            { path: this.config.calendarDbPath, type: 'calendar' }
        ];
        for (const db of databases) {
            try {
                await this.validateSQLiteDatabase(db.path);
                electron_log_1.default.debug(`${db.type} database validation passed`);
            }
            catch (error) {
                throw new Error(`${db.type} database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        // Validate search index
        if ((0, fs_1.existsSync)(this.config.searchIndexPath)) {
            electron_log_1.default.debug('Search index validation passed');
        }
        else {
            electron_log_1.default.warn('Search index directory not found, may need recreation');
        }
    }
    /**
     * Validate SQLite database integrity
     */
    async validateSQLiteDatabase(dbPath) {
        const sqlite3 = await this.loadSQLite3();
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    reject(new Error(`Cannot open database ${dbPath}: ${err.message}`));
                    return;
                }
                // Run PRAGMA integrity_check
                db.get('PRAGMA integrity_check', (err, row) => {
                    db.close();
                    if (err) {
                        reject(new Error(`Integrity check failed: ${err.message}`));
                    }
                    else if (row && row.integrity_check === 'ok') {
                        resolve();
                    }
                    else {
                        reject(new Error(`Database integrity check failed: ${JSON.stringify(row)}`));
                    }
                });
            });
        });
    }
    /**
     * Save configuration file
     */
    async saveConfiguration() {
        const config = {
            version: this.config.schemaVersion,
            databases: {
                mail: this.config.mailDbPath,
                calendar: this.config.calendarDbPath,
                searchIndex: this.config.searchIndexPath
            },
            initializedAt: new Date().toISOString(),
            platform: process.platform,
            appVersion: electron_1.app.getVersion()
        };
        await fs_1.promises.writeFile(this.config.configPath, JSON.stringify(config, null, 2), 'utf8');
        electron_log_1.default.info('Configuration saved successfully');
    }
    /**
     * Update progress and notify callback
     */
    updateProgress(stage, progress, message, details) {
        if (this.progressCallback) {
            this.progressCallback({
                stage,
                progress,
                message,
                ...(details && { details })
            });
        }
        electron_log_1.default.debug(`Database initialization: ${stage} (${progress}%) - ${message}`);
    }
    /**
     * Show initialization error dialog
     */
    async showInitializationError(error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during database initialization.';
        const result = await electron_1.dialog.showMessageBox({
            type: 'error',
            title: 'Database Initialization Failed',
            message: 'Flow Desk could not initialize its databases.',
            detail: `${errorMessage}\n\nThe application may not function properly. Would you like to retry initialization?`,
            buttons: ['Retry', 'Continue Anyway', 'Quit'],
            defaultId: 0,
            cancelId: 2
        });
        if (result.response === 0) {
            // Retry initialization
            await this.initializeDatabases();
        }
        else if (result.response === 2) {
            // Quit application
            electron_1.app.quit();
        }
        // Option 1 (Continue Anyway) just returns and lets app continue
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Check if databases are initialized
     */
    async isDatabasesInitialized() {
        try {
            const statuses = await this.checkDatabaseStatuses();
            return Object.values(statuses).every(status => status.exists);
        }
        catch {
            return false;
        }
    }
    /**
     * Repair corrupted databases
     */
    async repairDatabases() {
        try {
            electron_log_1.default.info('Starting database repair...');
            // Backup existing databases
            await this.backupDatabases();
            // Reinitialize databases
            const success = await this.initializeDatabases();
            if (success) {
                electron_log_1.default.info('Database repair completed successfully');
            }
            else {
                electron_log_1.default.error('Database repair failed');
            }
            return success;
        }
        catch (error) {
            electron_log_1.default.error('Database repair failed:', error);
            return false;
        }
    }
    /**
     * Backup existing databases
     */
    async backupDatabases() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = (0, path_1.join)(this.config.userDataPath, 'backups', timestamp);
        await fs_1.promises.mkdir(backupDir, { recursive: true });
        const databases = [
            this.config.mailDbPath,
            this.config.calendarDbPath
        ];
        for (const dbPath of databases) {
            if ((0, fs_1.existsSync)(dbPath)) {
                const filename = (0, path_1.join)(backupDir, `${dbPath.split('/').pop()}.backup`);
                await fs_1.promises.copyFile(dbPath, filename);
                electron_log_1.default.info(`Backed up database: ${dbPath} -> ${filename}`);
            }
        }
    }
}
exports.DatabaseInitializationService = DatabaseInitializationService;
/**
 * Export singleton instance
 */
let databaseInitializationService = null;
function getDatabaseInitializationService(progressCallback) {
    if (!databaseInitializationService) {
        databaseInitializationService = new DatabaseInitializationService(progressCallback);
    }
    return databaseInitializationService;
}
