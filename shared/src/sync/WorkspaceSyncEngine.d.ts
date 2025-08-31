/**
 * Workspace Sync Engine
 *
 * Handles cross-platform synchronization of workspace settings,
 * plugin configurations, and user preferences with conflict resolution.
 */
import { EventEmitter } from 'events';
import { WorkspaceConfig, PluginConfig, SyncConflict, SyncResult, DeviceInfo } from '../types';
import type { UserPreferences } from '../types/config';
export interface WorkspaceSyncConfig {
    workspaces: WorkspaceConfig[];
    plugins: Record<string, PluginConfig>;
    preferences: UserPreferences;
    version: string;
    timestamp: number;
    deviceId: string;
}
export interface SyncMetadata {
    lastSync: number;
    version: string;
    checksum: string;
    conflictCount: number;
    deviceCount: number;
}
export interface ConflictResolution {
    conflictId: string;
    resolution: 'local' | 'remote' | 'merge';
    mergedValue?: any;
}
export declare class WorkspaceSyncEngine extends EventEmitter {
    private config;
    private metadata;
    private conflicts;
    private deviceInfo;
    private syncInProgress;
    constructor(deviceInfo: DeviceInfo);
    /**
     * Initialize the sync engine with current workspace configuration
     */
    initialize(config: WorkspaceSyncConfig): Promise<void>;
    /**
     * Sync workspace configuration across platforms
     */
    syncWorkspaceSettings(remoteConfig: WorkspaceSyncConfig): Promise<SyncResult>;
    /**
     * Detect conflicts between local and remote configurations
     */
    private detectConflicts;
    /**
     * Detect conflicts within a specific workspace
     */
    private detectWorkspaceConflicts;
    /**
     * Detect conflicts within plugin configurations
     */
    private detectPluginConflicts;
    /**
     * Detect conflicts within user preferences
     */
    private detectPreferencesConflicts;
    /**
     * Merge two configurations intelligently
     */
    private mergeConfigurations;
    /**
     * Merge workspace configurations
     */
    private mergeWorkspaces;
    /**
     * Merge app configurations within workspaces
     */
    private mergeApps;
    /**
     * Merge plugin configurations
     */
    private mergePlugins;
    /**
     * Merge user preferences
     */
    private mergePreferences;
    /**
     * Resolve a specific conflict
     */
    resolveConflict(resolution: ConflictResolution): Promise<void>;
    /**
     * Apply a conflict resolution to the configuration
     */
    private applyConflictResolution;
    /**
     * Apply workspace conflict resolution
     */
    private applyWorkspaceResolution;
    /**
     * Apply plugin conflict resolution
     */
    private applyPluginResolution;
    /**
     * Apply preferences conflict resolution
     */
    private applyPreferencesResolution;
    /**
     * Automatically merge two values
     */
    private autoMerge;
    /**
     * Calculate configuration checksum
     */
    private calculateChecksum;
    /**
     * Simple hash function
     */
    private hash;
    /**
     * Generate a new version string
     */
    private generateVersion;
    /**
     * Count the number of changes between configurations
     */
    private countChanges;
    /**
     * Get current configuration
     */
    getCurrentConfig(): WorkspaceSyncConfig | null;
    /**
     * Get current metadata
     */
    getMetadata(): SyncMetadata | null;
    /**
     * Get current conflicts
     */
    getConflicts(): SyncConflict[];
    /**
     * Check if sync is in progress
     */
    isSyncing(): boolean;
}
//# sourceMappingURL=WorkspaceSyncEngine.d.ts.map