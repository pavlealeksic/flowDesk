"use strict";
/**
 * Config Sync TypeScript API
 *
 * Provides TypeScript bindings for the Rust-based config sync system.
 * This module handles the bridge between the TypeScript frontend and Rust backend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigSyncEngine = void 0;
exports.createConfigSyncEngine = createConfigSyncEngine;
const events_1 = require("events");
/**
 * Main config sync engine class
 */
class ConfigSyncEngine extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.initialized = false;
        this.syncState = {
            status: 'idle',
            lastSync: null,
            lastError: null,
            stats: {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                lastSyncDuration: 0,
                avgSyncDuration: 0,
            },
            pendingChanges: 0,
            conflicts: 0,
            vectorClock: {},
        };
    }
    /**
     * Initialize the config sync engine
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Initialize Rust backend
            this.rustHandle = await this.createRustEngine();
            // Load existing configuration
            const config = await this.loadConfig();
            if (config) {
                this.currentConfig = config;
            }
            // Initialize transports
            await this.initializeTransports();
            this.initialized = true;
            this.emit('initialized');
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Get current configuration
     */
    async getConfig() {
        this.ensureInitialized();
        return this.currentConfig || null;
    }
    /**
     * Update configuration
     */
    async updateConfig(config) {
        this.ensureInitialized();
        try {
            await this.rustUpdateConfig(config);
            this.currentConfig = config;
            this.emit('configUpdated', config);
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Perform full synchronization
     */
    async sync() {
        this.ensureInitialized();
        try {
            this.syncState.status = 'syncing';
            this.emit('syncStarted');
            const result = await this.rustSync();
            this.syncState.status = result.success ? 'idle' : 'error';
            this.syncState.lastSync = new Date();
            this.syncState.stats.totalSyncs++;
            if (result.success) {
                this.syncState.stats.successfulSyncs++;
            }
            this.emit('syncCompleted', result);
            return result;
        }
        catch (error) {
            this.syncState.status = 'error';
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Add sync transport
     */
    async addTransport(transportConfig) {
        this.ensureInitialized();
        await this.rustAddTransport(transportConfig);
        this.emit('transportAdded', transportConfig);
    }
    /**
     * Remove sync transport
     */
    async removeTransport(transportId) {
        this.ensureInitialized();
        await this.rustRemoveTransport(transportId);
        this.emit('transportRemoved', transportId);
    }
    /**
     * Get current sync state
     */
    getSyncState() {
        return { ...this.syncState };
    }
    /**
     * Get discovered devices (for LAN sync)
     */
    async getDiscoveredDevices() {
        this.ensureInitialized();
        return await this.rustGetDiscoveredDevices();
    }
    /**
     * Pair with device using QR code
     */
    async pairWithDevice(qrData) {
        this.ensureInitialized();
        return await this.rustPairWithDevice(qrData);
    }
    /**
     * Generate QR code for device pairing
     */
    async generatePairingQR() {
        this.ensureInitialized();
        return await this.rustGeneratePairingQR();
    }
    /**
     * Resolve configuration conflict
     */
    async resolveConflict(conflictId, resolution) {
        this.ensureInitialized();
        await this.rustResolveConflict(conflictId, resolution);
        this.emit('conflictResolved', conflictId, resolution);
    }
    /**
     * Create configuration backup
     */
    async createBackup(description) {
        this.ensureInitialized();
        return await this.rustCreateBackup(description);
    }
    /**
     * List available backups
     */
    async listBackups() {
        this.ensureInitialized();
        return await this.rustListBackups();
    }
    /**
     * Restore from backup
     */
    async restoreBackup(backupId) {
        this.ensureInitialized();
        await this.rustRestoreBackup(backupId);
        // Reload configuration after restore
        const config = await this.loadConfig();
        if (config) {
            this.currentConfig = config;
            this.emit('configRestored', config);
        }
    }
    /**
     * Export configuration as encrypted archive
     */
    async exportConfig(filePath, description) {
        this.ensureInitialized();
        await this.rustExportConfig(filePath, description);
    }
    /**
     * Import configuration from encrypted archive
     */
    async importConfig(filePath) {
        this.ensureInitialized();
        const config = await this.rustImportConfig(filePath);
        this.currentConfig = config;
        this.emit('configImported', config);
        return config;
    }
    /**
     * Validate configuration
     */
    async validateConfig(config) {
        return await this.rustValidateConfig(config);
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.rustHandle) {
            await this.rustCleanup();
            this.rustHandle = null;
        }
        this.initialized = false;
    }
    // Private helper methods
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('ConfigSyncEngine not initialized. Call initialize() first.');
        }
    }
    async loadConfig() {
        try {
            return await this.rustLoadConfig();
        }
        catch (error) {
            if (this.options.debug) {
                console.warn('Failed to load config:', error);
            }
            return null;
        }
    }
    async initializeTransports() {
        // Initialize default transports based on platform
        const platform = this.options.deviceInfo.platform.os;
        // Add cloud sync transport based on platform
        if (platform === 'darwin') {
            // macOS - try iCloud
            try {
                await this.addTransport({
                    type: 'cloud',
                    config: { provider: 'icloud' },
                    enabled: true,
                });
            }
            catch (error) {
                if (this.options.debug) {
                    console.warn('Failed to initialize iCloud transport:', error);
                }
            }
        }
        // Add LAN sync transport
        try {
            await this.addTransport({
                type: 'lan',
                config: { discovery: { enabled: true } },
                enabled: true,
            });
        }
        catch (error) {
            if (this.options.debug) {
                console.warn('Failed to initialize LAN transport:', error);
            }
        }
        // Add import/export transport
        try {
            await this.addTransport({
                type: 'import_export',
                config: { format: 'workosync' },
                enabled: true,
            });
        }
        catch (error) {
            if (this.options.debug) {
                console.warn('Failed to initialize import/export transport:', error);
            }
        }
    }
    // Rust binding methods (to be implemented with native bindings)
    async createRustEngine() {
        // This would create the Rust engine instance
        // For now, return a mock handle
        return { mock: true };
    }
    async rustUpdateConfig(config) {
        // Call Rust method to update config
        if (this.options.debug) {
            console.log('Rust: updateConfig', config);
        }
    }
    async rustSync() {
        // Call Rust method to perform sync
        if (this.options.debug) {
            console.log('Rust: sync');
        }
        return {
            transportId: 'all',
            success: true,
            durationMs: 1000,
            bytesTransferred: 1024,
            conflictsDetected: 0,
        };
    }
    async rustLoadConfig() {
        // Call Rust method to load config
        if (this.options.debug) {
            console.log('Rust: loadConfig');
        }
        return null;
    }
    async rustAddTransport(config) {
        // Call Rust method to add transport
        if (this.options.debug) {
            console.log('Rust: addTransport', config);
        }
    }
    async rustRemoveTransport(transportId) {
        // Call Rust method to remove transport
        if (this.options.debug) {
            console.log('Rust: removeTransport', transportId);
        }
    }
    async rustGetDiscoveredDevices() {
        // Call Rust method to get discovered devices
        return [];
    }
    async rustPairWithDevice(qrData) {
        // Call Rust method to pair with device
        throw new Error('Not implemented');
    }
    async rustGeneratePairingQR() {
        // Call Rust method to generate pairing QR
        return JSON.stringify({
            type: 'flowdesk_pairing',
            deviceId: this.options.deviceInfo.deviceId,
            deviceName: this.options.deviceInfo.deviceName,
        });
    }
    async rustResolveConflict(conflictId, resolution) {
        // Call Rust method to resolve conflict
        if (this.options.debug) {
            console.log('Rust: resolveConflict', conflictId, resolution);
        }
    }
    async rustCreateBackup(description) {
        // Call Rust method to create backup
        return 'backup_' + Date.now().toString();
    }
    async rustListBackups() {
        // Call Rust method to list backups
        return [];
    }
    async rustRestoreBackup(backupId) {
        // Call Rust method to restore backup
        if (this.options.debug) {
            console.log('Rust: restoreBackup', backupId);
        }
    }
    async rustExportConfig(filePath, description) {
        // Call Rust method to export config
        if (this.options.debug) {
            console.log('Rust: exportConfig', filePath, description);
        }
    }
    async rustImportConfig(filePath) {
        // Call Rust method to import config
        throw new Error('Not implemented');
    }
    async rustValidateConfig(config) {
        // Call Rust method to validate config
        return {
            valid: true,
            errors: [],
            warnings: [],
        };
    }
    async rustCleanup() {
        // Call Rust method to cleanup resources
        if (this.options.debug) {
            console.log('Rust: cleanup');
        }
    }
}
exports.ConfigSyncEngine = ConfigSyncEngine;
/**
 * Create a config sync engine with default settings
 */
function createConfigSyncEngine(deviceInfo, options) {
    const defaultOptions = {
        deviceInfo,
        storageConfig: {
            baseDirectory: getDefaultStorageDirectory(),
            encryption: true,
            maxBackups: 10,
        },
        syncConfig: {
            autoSync: true,
            syncIntervalSeconds: 300, // 5 minutes
            maxRetries: 3,
            conflictResolution: 'manual',
        },
        debug: process.env.NODE_ENV === 'development',
        ...options,
    };
    return new ConfigSyncEngine(defaultOptions);
}
/**
 * Get default storage directory based on platform
 */
function getDefaultStorageDirectory() {
    const os = require('os');
    const path = require('path');
    switch (process.platform) {
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support', 'FlowDesk');
        case 'win32':
            return path.join(os.homedir(), 'AppData', 'Roaming', 'FlowDesk');
        case 'linux':
            return path.join(os.homedir(), '.local', 'share', 'FlowDesk');
        default:
            return path.join(os.homedir(), '.flowdesk');
    }
}
//# sourceMappingURL=index.js.map