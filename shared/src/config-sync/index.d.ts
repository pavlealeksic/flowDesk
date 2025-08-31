/**
 * Config Sync TypeScript API
 *
 * Provides TypeScript bindings for the Rust-based config sync system.
 * This module handles the bridge between the TypeScript frontend and Rust backend.
 */
import { EventEmitter } from 'events';
import type { WorkspaceConfig, SyncState, SyncDevice, ConfigValidationResult } from '../types/config';
export interface ConfigSyncOptions {
    /** Device information */
    deviceInfo: DeviceInfo;
    /** Storage configuration */
    storageConfig: StorageConfig;
    /** Sync configuration */
    syncConfig: SyncConfiguration;
    /** Enable debug logging */
    debug?: boolean;
}
export interface DeviceInfo {
    /** Unique device identifier */
    deviceId: string;
    /** Human-readable device name */
    deviceName: string;
    /** Device type */
    deviceType: 'desktop' | 'mobile' | 'web';
    /** Platform information */
    platform: {
        os: string;
        version: string;
        arch: string;
    };
}
export interface StorageConfig {
    /** Base storage directory */
    baseDirectory: string;
    /** Enable encryption */
    encryption: boolean;
    /** Maximum backup count */
    maxBackups: number;
}
export interface SyncConfiguration {
    /** Enable automatic sync */
    autoSync: boolean;
    /** Sync interval in seconds */
    syncIntervalSeconds: number;
    /** Maximum retry attempts */
    maxRetries: number;
    /** Conflict resolution strategy */
    conflictResolution: 'manual' | 'latest' | 'merge';
}
export interface TransportConfig {
    /** Transport type */
    type: 'cloud' | 'lan' | 'import_export';
    /** Transport-specific configuration */
    config: any;
    /** Transport enabled */
    enabled: boolean;
}
export interface SyncProgress {
    /** Transport ID */
    transportId: string;
    /** Current operation */
    operation: string;
    /** Progress percentage (0-100) */
    progress: number;
    /** Bytes transferred */
    bytesTransferred: number;
    /** Estimated time remaining in ms */
    estimatedTimeRemaining?: number;
}
export interface SyncResult {
    /** Transport ID */
    transportId: string;
    /** Operation successful */
    success: boolean;
    /** Operation duration in ms */
    durationMs: number;
    /** Bytes transferred */
    bytesTransferred: number;
    /** Number of conflicts detected */
    conflictsDetected: number;
    /** Error message if failed */
    error?: string;
}
/**
 * Main config sync engine class
 */
export declare class ConfigSyncEngine extends EventEmitter {
    private options;
    private initialized;
    private rustHandle?;
    private currentConfig?;
    private syncState;
    constructor(options: ConfigSyncOptions);
    /**
     * Initialize the config sync engine
     */
    initialize(): Promise<void>;
    /**
     * Get current configuration
     */
    getConfig(): Promise<WorkspaceConfig | null>;
    /**
     * Update configuration
     */
    updateConfig(config: WorkspaceConfig): Promise<void>;
    /**
     * Perform full synchronization
     */
    sync(): Promise<SyncResult>;
    /**
     * Add sync transport
     */
    addTransport(transportConfig: TransportConfig): Promise<void>;
    /**
     * Remove sync transport
     */
    removeTransport(transportId: string): Promise<void>;
    /**
     * Get current sync state
     */
    getSyncState(): SyncState;
    /**
     * Get discovered devices (for LAN sync)
     */
    getDiscoveredDevices(): Promise<SyncDevice[]>;
    /**
     * Pair with device using QR code
     */
    pairWithDevice(qrData: string): Promise<SyncDevice>;
    /**
     * Generate QR code for device pairing
     */
    generatePairingQR(): Promise<string>;
    /**
     * Resolve configuration conflict
     */
    resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge'): Promise<void>;
    /**
     * Create configuration backup
     */
    createBackup(description?: string): Promise<string>;
    /**
     * List available backups
     */
    listBackups(): Promise<any[]>;
    /**
     * Restore from backup
     */
    restoreBackup(backupId: string): Promise<void>;
    /**
     * Export configuration as encrypted archive
     */
    exportConfig(filePath: string, description?: string): Promise<void>;
    /**
     * Import configuration from encrypted archive
     */
    importConfig(filePath: string): Promise<WorkspaceConfig>;
    /**
     * Validate configuration
     */
    validateConfig(config: WorkspaceConfig): Promise<ConfigValidationResult>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    private ensureInitialized;
    private loadConfig;
    private initializeTransports;
    private createRustEngine;
    private rustUpdateConfig;
    private rustSync;
    private rustLoadConfig;
    private rustAddTransport;
    private rustRemoveTransport;
    private rustGetDiscoveredDevices;
    private rustPairWithDevice;
    private rustGeneratePairingQR;
    private rustResolveConflict;
    private rustCreateBackup;
    private rustListBackups;
    private rustRestoreBackup;
    private rustExportConfig;
    private rustImportConfig;
    private rustValidateConfig;
    private rustCleanup;
}
/**
 * Create a config sync engine with default settings
 */
export declare function createConfigSyncEngine(deviceInfo: DeviceInfo, options?: Partial<ConfigSyncOptions>): ConfigSyncEngine;
//# sourceMappingURL=index.d.ts.map