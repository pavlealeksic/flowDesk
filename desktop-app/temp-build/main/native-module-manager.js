"use strict";
/**
 * Cross-Platform Native Module Manager
 *
 * Handles loading and management of native modules across Windows, macOS, and Linux
 * Provides fallbacks and compatibility layers for different platforms
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
exports.nativeModuleManager = exports.NativeModuleManager = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const platform_utils_1 = require("./platform-utils");
/**
 * Native Module Manager for cross-platform compatibility
 */
class NativeModuleManager {
    constructor() {
        this.modules = new Map();
        this.platformInfo = (0, platform_utils_1.getPlatformInfo)();
    }
    /**
     * Register and load a native module with platform-specific handling
     */
    async loadModule(config) {
        const { name, required, fallback, loadAsync = false, platforms } = config;
        // Check if module is supported on current platform
        if (platforms && !platforms.includes(this.platformInfo.platform)) {
            const notSupported = {
                name,
                loaded: false,
                error: new Error(`Module ${name} not supported on ${this.platformInfo.platform}`),
                fallback: fallback?.()
            };
            this.modules.set(name, notSupported);
            electron_log_1.default.warn(`Native module ${name} not supported on ${this.platformInfo.platform}`);
            return notSupported;
        }
        if (loadAsync) {
            return this.loadModuleAsync(name, required, fallback);
        }
        else {
            return this.loadModuleSync(name, required, fallback);
        }
    }
    /**
     * Load native module synchronously
     */
    loadModuleSync(name, required, fallback) {
        const moduleInfo = { name, loaded: false };
        try {
            // Try to load the module
            moduleInfo.module = require(name);
            moduleInfo.loaded = true;
            electron_log_1.default.info(`Successfully loaded native module: ${name}`);
        }
        catch (error) {
            moduleInfo.error = error instanceof Error ? error : new Error(String(error));
            if (fallback) {
                moduleInfo.fallback = fallback();
                electron_log_1.default.warn(`Native module ${name} failed to load, using fallback:`, error);
            }
            else if (required) {
                electron_log_1.default.error(`Required native module ${name} failed to load:`, error);
                throw error;
            }
            else {
                electron_log_1.default.warn(`Optional native module ${name} failed to load:`, error);
            }
        }
        this.modules.set(name, moduleInfo);
        return moduleInfo;
    }
    /**
     * Load native module asynchronously
     */
    async loadModuleAsync(name, required, fallback) {
        const moduleInfo = { name, loaded: false };
        try {
            // Use dynamic import for async loading
            moduleInfo.module = await Promise.resolve(`${name}`).then(s => __importStar(require(s)));
            moduleInfo.loaded = true;
            electron_log_1.default.info(`Successfully loaded native module (async): ${name}`);
        }
        catch (error) {
            moduleInfo.error = error instanceof Error ? error : new Error(String(error));
            if (fallback) {
                moduleInfo.fallback = fallback();
                electron_log_1.default.warn(`Native module ${name} failed to load async, using fallback:`, error);
            }
            else if (required) {
                electron_log_1.default.error(`Required native module ${name} failed to load async:`, error);
                throw error;
            }
            else {
                electron_log_1.default.warn(`Optional native module ${name} failed to load async:`, error);
            }
        }
        this.modules.set(name, moduleInfo);
        return moduleInfo;
    }
    /**
     * Get loaded module or fallback
     */
    getModule(name) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} not registered`);
        }
        if (moduleInfo.loaded && moduleInfo.module) {
            return moduleInfo.module;
        }
        if (moduleInfo.fallback) {
            return moduleInfo.fallback;
        }
        if (moduleInfo.error) {
            throw moduleInfo.error;
        }
        throw new Error(`Module ${name} not available`);
    }
    /**
     * Check if module is available
     */
    isModuleAvailable(name) {
        const moduleInfo = this.modules.get(name);
        return !!(moduleInfo && (moduleInfo.loaded || moduleInfo.fallback));
    }
    /**
     * Get module status
     */
    getModuleStatus(name) {
        return this.modules.get(name);
    }
    /**
     * Get all module statuses
     */
    getAllModuleStatuses() {
        return new Map(this.modules);
    }
    /**
     * Initialize all platform-specific native modules
     */
    async initializePlatformModules() {
        electron_log_1.default.info('Initializing platform-specific native modules...');
        // SQLite3 - Required for database operations
        await this.loadModule({
            name: 'sqlite3',
            required: true,
            fallback: () => this.createSQLiteFallback(),
            platforms: ['win32', 'darwin', 'linux']
        });
        // Better SQLite3 - Preferred SQLite implementation
        await this.loadModule({
            name: 'better-sqlite3',
            required: false,
            fallback: () => this.getModule('sqlite3'),
            platforms: ['win32', 'darwin', 'linux']
        });
        // Keytar - Secure credential storage
        await this.loadModule({
            name: 'keytar',
            required: false,
            fallback: () => this.createKeytarFallback(),
            platforms: ['win32', 'darwin', 'linux']
        });
        // Node machine ID
        await this.loadModule({
            name: 'node-machine-id',
            required: false,
            fallback: () => this.createMachineIdFallback(),
            platforms: ['win32', 'darwin', 'linux']
        });
        // Native TLS - For secure email connections
        await this.loadModule({
            name: 'native-tls',
            required: false,
            platforms: ['win32', 'darwin', 'linux']
        });
        // WebSocket native bindings
        await this.loadModule({
            name: 'ws',
            required: true,
            platforms: ['win32', 'darwin', 'linux']
        });
        electron_log_1.default.info('Platform module initialization complete');
    }
    /**
     * Create SQLite fallback implementation
     */
    createSQLiteFallback() {
        electron_log_1.default.warn('Using SQLite fallback - some features may be limited');
        return {
            Database: class MockDatabase {
                constructor(path) {
                    throw new Error('SQLite not available - please install sqlite3 or better-sqlite3');
                }
            },
            OPEN_READONLY: 1,
            verbose: () => this
        };
    }
    /**
     * Create keytar fallback using file-based storage
     */
    createKeytarFallback() {
        electron_log_1.default.warn('Keytar not available, using encrypted file storage fallback');
        return {
            setPassword: async (service, account, password) => {
                // This would integrate with the encryption key manager
                electron_log_1.default.warn(`Keytar fallback: would store ${service}:${account}`);
                throw new Error('Keytar fallback not fully implemented - credentials not stored');
            },
            getPassword: async (service, account) => {
                electron_log_1.default.warn(`Keytar fallback: would retrieve ${service}:${account}`);
                return null;
            },
            deletePassword: async (service, account) => {
                electron_log_1.default.warn(`Keytar fallback: would delete ${service}:${account}`);
                return false;
            }
        };
    }
    /**
     * Create machine ID fallback
     */
    createMachineIdFallback() {
        const { randomBytes } = require('crypto');
        return {
            machineId: () => {
                // Generate a consistent fallback ID based on platform info
                const platformString = `${this.platformInfo.platform}-${this.platformInfo.arch}`;
                return randomBytes(16).toString('hex');
            }
        };
    }
    /**
     * Check native module compilation status
     */
    checkNativeCompilation() {
        const issues = [];
        let success = true;
        // Check SQLite availability
        if (!this.isModuleAvailable('sqlite3') && !this.isModuleAvailable('better-sqlite3')) {
            issues.push('No SQLite implementation available - database operations will fail');
            success = false;
        }
        // Check credential storage
        if (!this.isModuleAvailable('keytar')) {
            issues.push('Keytar not available - using fallback credential storage');
        }
        // Platform-specific checks
        if (this.platformInfo.isWindows) {
            // Check Windows-specific modules
            issues.push(...this.checkWindowsModules());
        }
        else if (this.platformInfo.isDarwin) {
            // Check macOS-specific modules
            issues.push(...this.checkMacOSModules());
        }
        else if (this.platformInfo.isLinux) {
            // Check Linux-specific modules
            issues.push(...this.checkLinuxModules());
        }
        return { success, issues };
    }
    /**
     * Check Windows-specific module compilation
     */
    checkWindowsModules() {
        const issues = [];
        // Check if native modules were compiled with correct Visual Studio version
        try {
            const sqlite3 = this.getModuleStatus('sqlite3');
            if (sqlite3?.error?.message.includes('MODULE_NOT_FOUND')) {
                issues.push('SQLite3 may need recompilation with node-gyp for Windows');
            }
        }
        catch (error) {
            // Module not loaded, already handled above
        }
        return issues;
    }
    /**
     * Check macOS-specific module compilation
     */
    checkMacOSModules() {
        const issues = [];
        // Check for architecture mismatches (Intel vs ARM64)
        const nodeArch = process.arch;
        const systemArch = this.platformInfo.arch;
        if (nodeArch !== systemArch) {
            issues.push(`Architecture mismatch: Node.js (${nodeArch}) vs System (${systemArch})`);
        }
        return issues;
    }
    /**
     * Check Linux-specific module compilation
     */
    checkLinuxModules() {
        const issues = [];
        // Check for missing system dependencies
        const keytar = this.getModuleStatus('keytar');
        if (keytar?.error?.message.includes('libsecret')) {
            issues.push('libsecret-1-dev may be required for keytar on Linux');
        }
        return issues;
    }
    /**
     * Rebuild native modules for current platform
     */
    async rebuildNativeModules() {
        const { spawn } = require('child_process');
        return new Promise((resolve) => {
            electron_log_1.default.info('Rebuilding native modules for current platform...');
            const child = spawn('npm', ['rebuild'], {
                stdio: 'pipe',
                shell: true
            });
            let output = '';
            child.stdout?.on('data', (data) => {
                output += data.toString();
            });
            child.stderr?.on('data', (data) => {
                output += data.toString();
            });
            child.on('close', (code) => {
                const success = code === 0;
                if (success) {
                    electron_log_1.default.info('Native modules rebuilt successfully');
                }
                else {
                    electron_log_1.default.error('Failed to rebuild native modules');
                }
                resolve({ success, output });
            });
        });
    }
    /**
     * Clean and rebuild specific module
     */
    async rebuildModule(moduleName) {
        const { spawn } = require('child_process');
        return new Promise((resolve) => {
            electron_log_1.default.info(`Rebuilding specific module: ${moduleName}`);
            const child = spawn('npm', ['rebuild', moduleName], {
                stdio: 'pipe',
                shell: true
            });
            let output = '';
            child.stdout?.on('data', (data) => {
                output += data.toString();
            });
            child.stderr?.on('data', (data) => {
                output += data.toString();
            });
            child.on('close', (code) => {
                const success = code === 0;
                if (success) {
                    electron_log_1.default.info(`Module ${moduleName} rebuilt successfully`);
                }
                else {
                    electron_log_1.default.error(`Failed to rebuild module ${moduleName}`);
                }
                resolve({ success, output });
            });
        });
    }
}
exports.NativeModuleManager = NativeModuleManager;
// Export singleton instance
exports.nativeModuleManager = new NativeModuleManager();
