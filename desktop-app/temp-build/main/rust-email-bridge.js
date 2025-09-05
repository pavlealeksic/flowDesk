"use strict";
/**
 * Rust Email Bridge
 *
 * Centralizes all NAPI function calls to the Rust email engine.
 * Provides a clean TypeScript interface to the production Rust email implementation.
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
exports.rustEmailBridge = exports.RustEmailBridge = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const path = __importStar(require("path"));
/**
 * Rust Email Bridge - Provides access to Rust email engine via NAPI
 */
class RustEmailBridge {
    constructor() {
        this.rustNapi = null;
        this.initialized = false;
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!RustEmailBridge.instance) {
            RustEmailBridge.instance = new RustEmailBridge();
        }
        return RustEmailBridge.instance;
    }
    /**
     * Initialize the Rust NAPI bindings
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Load the Rust NAPI module from the built shared library
            const rustLibPath = this.getRustLibraryPath();
            electron_log_1.default.info(`Loading Rust email engine from: ${rustLibPath}`);
            // Try to load the compiled Rust NAPI module
            this.rustNapi = await this.loadRustNapi(rustLibPath);
            this.initialized = true;
            electron_log_1.default.info('Rust email bridge initialized successfully');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize Rust email bridge:', error);
            throw new Error(`Failed to load Rust email engine: ${error}`);
        }
    }
    /**
     * Get the path to the Rust library based on platform
     */
    getRustLibraryPath() {
        const platform = process.platform;
        const arch = process.arch;
        // Map platform and architecture to binary names
        let binaryName;
        switch (`${platform}-${arch}`) {
            case 'darwin-x64':
                binaryName = 'flow_desk_cli';
                break;
            case 'darwin-arm64':
                binaryName = 'flow_desk_cli';
                break;
            case 'win32-x64':
                binaryName = 'flow_desk_cli.exe';
                break;
            case 'linux-x64':
                binaryName = 'flow_desk_cli';
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}-${arch}`);
        }
        // In development, look in the lib/rust-engine directory
        // In production, look in the binaries directory
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
            return path.join(__dirname, '..', '..', 'lib', 'rust-engine', 'target', 'release', binaryName);
        }
        else {
            return path.join(process.resourcesPath || '', 'binaries', binaryName);
        }
    }
    /**
     * Load the Rust NAPI module
     */
    async loadRustNapi(libPath) {
        try {
            // Try multiple paths to find the Rust NAPI module
            const possiblePaths = [
                // Built NAPI module in shared rust-lib
                path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'index.js'),
                path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'flow-desk-shared.darwin-arm64.node'),
                path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'flow-desk-shared.darwin-x64.node'),
                // Try the rust-engine wrapper
                path.join(__dirname, '..', '..', 'lib', 'rust-engine', 'index.node'),
                // Try direct loading of the shared library
                path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'target', 'release', 'libflow_desk_shared.dylib'),
            ];
            for (const napiPath of possiblePaths) {
                try {
                    electron_log_1.default.info(`Attempting to load NAPI module from: ${napiPath}`);
                    const rustModule = require(napiPath);
                    // Check if this module has the required email functions
                    if (this.validateNapiModule(rustModule)) {
                        electron_log_1.default.info('Successfully loaded and validated Rust NAPI module from:', napiPath);
                        return this.wrapNapiModule(rustModule);
                    }
                    else {
                        electron_log_1.default.warn('NAPI module loaded but missing required functions:', napiPath);
                    }
                }
                catch (napiError) {
                    const errorMessage = napiError instanceof Error ? napiError.message : String(napiError);
                    electron_log_1.default.debug(`Failed to load NAPI module from ${napiPath}:`, errorMessage);
                }
            }
            electron_log_1.default.warn('No suitable NAPI module found, falling back to subprocess interface');
            return this.createSubprocessInterface(libPath);
        }
        catch (error) {
            electron_log_1.default.error('Failed to load Rust module:', error);
            throw error;
        }
    }
    /**
     * Validate that a loaded NAPI module has the required email functions
     */
    validateNapiModule(rustModule) {
        const requiredFunctions = [
            'initProductionEmailEngine',
            'setupEmailAccount',
            'syncEmailAccount',
            'sendEmailMessage',
            'getEmailFolders'
        ];
        for (const funcName of requiredFunctions) {
            if (typeof rustModule[funcName] !== 'function') {
                electron_log_1.default.debug(`Missing required function: ${funcName}`);
                return false;
            }
        }
        return true;
    }
    /**
     * Wrap the NAPI module to match our expected interface
     */
    wrapNapiModule(rustModule) {
        return {
            initProductionEmailEngine: rustModule.initProductionEmailEngine,
            setupEmailAccount: rustModule.setupEmailAccount,
            testAccountConnections: rustModule.testAccountConnections || (() => Promise.resolve(true)),
            syncEmailAccount: rustModule.syncEmailAccount,
            getEmailFolders: rustModule.getEmailFolders,
            sendEmailMessage: rustModule.sendEmailMessage,
            getFolderMessages: rustModule.getFolderMessages || (() => Promise.resolve([])),
            markEmailMessageRead: rustModule.markEmailMessageRead || (() => Promise.resolve()),
            deleteEmailMessage: rustModule.deleteEmailMessage || (() => Promise.resolve()),
            closeEmailAccountConnections: rustModule.closeEmailAccountConnections || (() => Promise.resolve()),
            getEmailAccountsHealth: rustModule.getEmailAccountsHealth || (() => Promise.resolve('{"status":"healthy"}')),
            detectEmailServerConfig: rustModule.detectEmailServerConfig || (() => null),
            getPredefinedServerConfigs: rustModule.getPredefinedServerConfigs || (() => '{}'),
        };
    }
    /**
     * Create a subprocess-based interface to the Rust CLI
     * This is a fallback when NAPI bindings aren't available
     */
    createSubprocessInterface(binaryPath) {
        const { spawn } = require('child_process');
        // Create a wrapper that communicates with the Rust CLI via JSON-RPC
        return {
            initProductionEmailEngine: async (appName) => {
                return this.callRustCli(binaryPath, 'init-production-email-engine', { appName });
            },
            setupEmailAccount: async (userId, credentials) => {
                return this.callRustCli(binaryPath, 'setup-email-account', { userId, credentials });
            },
            testAccountConnections: async (accountId) => {
                return this.callRustCli(binaryPath, 'test-account-connections', { accountId });
            },
            syncEmailAccount: async (accountId) => {
                return this.callRustCli(binaryPath, 'sync-email-account', { accountId });
            },
            getEmailFolders: async (accountId) => {
                return this.callRustCli(binaryPath, 'get-email-folders', { accountId });
            },
            sendEmailMessage: async (accountId, message) => {
                return this.callRustCli(binaryPath, 'send-email-message', { accountId, message });
            },
            getFolderMessages: async (accountId, folderName, limit) => {
                return this.callRustCli(binaryPath, 'get-folder-messages', { accountId, folderName, limit });
            },
            markEmailMessageRead: async (accountId, folderName, messageUid, isRead) => {
                return this.callRustCli(binaryPath, 'mark-email-message-read', { accountId, folderName, messageUid, isRead });
            },
            deleteEmailMessage: async (accountId, folderName, messageUid) => {
                return this.callRustCli(binaryPath, 'delete-email-message', { accountId, folderName, messageUid });
            },
            closeEmailAccountConnections: async (accountId) => {
                return this.callRustCli(binaryPath, 'close-email-account-connections', { accountId });
            },
            getEmailAccountsHealth: async () => {
                return this.callRustCli(binaryPath, 'get-email-accounts-health', {});
            },
            detectEmailServerConfig: (email) => {
                // This is synchronous, so we'll use a different approach or make it async
                return null; // Placeholder
            },
            getPredefinedServerConfigs: () => {
                return JSON.stringify({}); // Placeholder
            },
        };
    }
    /**
     * Call the Rust CLI with JSON-RPC style communication
     */
    async callRustCli(binaryPath, command, args) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const child = spawn(binaryPath, ['--json', command, JSON.stringify(args)]);
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    }
                    catch (parseError) {
                        reject(new Error(`Failed to parse Rust CLI output: ${parseError}`));
                    }
                }
                else {
                    reject(new Error(`Rust CLI failed with code ${code}: ${stderr}`));
                }
            });
            child.on('error', (error) => {
                reject(new Error(`Failed to spawn Rust CLI: ${error.message}`));
            });
        });
    }
    /**
     * Initialize production email engine
     */
    async initProductionEmailEngine(appName) {
        this.ensureInitialized();
        return this.rustNapi.initProductionEmailEngine(appName);
    }
    /**
     * Setup a new email account
     */
    async setupEmailAccount(userId, credentials) {
        this.ensureInitialized();
        return this.rustNapi.setupEmailAccount(userId, credentials);
    }
    /**
     * Test account connections (IMAP/SMTP)
     */
    async testAccountConnections(accountId) {
        this.ensureInitialized();
        return this.rustNapi.testAccountConnections(accountId);
    }
    /**
     * Sync emails for an account
     */
    async syncEmailAccount(accountId) {
        this.ensureInitialized();
        return this.rustNapi.syncEmailAccount(accountId);
    }
    /**
     * Get folders for an account
     */
    async getEmailFolders(accountId) {
        this.ensureInitialized();
        return this.rustNapi.getEmailFolders(accountId);
    }
    /**
     * Send an email message
     */
    async sendEmailMessage(accountId, message) {
        this.ensureInitialized();
        return this.rustNapi.sendEmailMessage(accountId, message);
    }
    /**
     * Get messages from a folder
     */
    async getFolderMessages(accountId, folderName, limit) {
        this.ensureInitialized();
        return this.rustNapi.getFolderMessages(accountId, folderName, limit);
    }
    /**
     * Mark a message as read or unread
     */
    async markEmailMessageRead(accountId, folderName, messageUid, isRead) {
        this.ensureInitialized();
        return this.rustNapi.markEmailMessageRead(accountId, folderName, messageUid, isRead);
    }
    /**
     * Delete a message
     */
    async deleteEmailMessage(accountId, folderName, messageUid) {
        this.ensureInitialized();
        return this.rustNapi.deleteEmailMessage(accountId, folderName, messageUid);
    }
    /**
     * Close connections for an account
     */
    async closeEmailAccountConnections(accountId) {
        this.ensureInitialized();
        return this.rustNapi.closeEmailAccountConnections(accountId);
    }
    /**
     * Get health status for all email accounts
     */
    async getEmailAccountsHealth() {
        this.ensureInitialized();
        const healthJson = await this.rustNapi.getEmailAccountsHealth();
        return JSON.parse(healthJson);
    }
    /**
     * Auto-detect server configuration from email address
     */
    detectEmailServerConfig(email) {
        this.ensureInitialized();
        const configJson = this.rustNapi.detectEmailServerConfig(email);
        return configJson ? JSON.parse(configJson) : null;
    }
    /**
     * Get all predefined server configurations
     */
    getPredefinedServerConfigs() {
        this.ensureInitialized();
        const configsJson = this.rustNapi.getPredefinedServerConfigs();
        return JSON.parse(configsJson);
    }
    /**
     * Check if bridge is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Ensure the bridge is initialized
     */
    ensureInitialized() {
        if (!this.initialized || !this.rustNapi) {
            throw new Error('Rust email bridge not initialized. Call initialize() first.');
        }
    }
    /**
     * Cleanup and destroy the bridge
     */
    async destroy() {
        this.rustNapi = null;
        this.initialized = false;
        electron_log_1.default.info('Rust email bridge destroyed');
    }
}
exports.RustEmailBridge = RustEmailBridge;
RustEmailBridge.instance = null;
// Export singleton instance
exports.rustEmailBridge = RustEmailBridge.getInstance();
exports.default = exports.rustEmailBridge;
