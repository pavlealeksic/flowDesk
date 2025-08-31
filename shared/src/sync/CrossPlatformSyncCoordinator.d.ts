/**
 * Cross-Platform Sync Coordinator
 *
 * Orchestrates synchronization of workspace settings, plugin configurations,
 * and user preferences across desktop and mobile platforms.
 */
import { EventEmitter } from 'events';
import { DeviceInfo, BaseSyncTransport, SyncResult, SyncConflict, SyncState } from '../types';
export interface SyncCoordinatorConfig {
    deviceInfo: DeviceInfo;
    transports: BaseSyncTransport[];
    syncInterval: number;
    autoSync: boolean;
    conflictResolution: 'manual' | 'auto_local' | 'auto_remote';
    retryAttempts: number;
    retryDelay: number;
}
export interface SyncSession {
    id: string;
    startTime: number;
    endTime?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    changes: number;
    conflicts: number;
    errors: string[];
}
export interface SyncStatistics {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    totalConflicts: number;
    resolvedConflicts: number;
    lastSyncTime: number;
    averageSyncDuration: number;
    dataTransferred: number;
}
export declare class CrossPlatformSyncCoordinator extends EventEmitter {
    private workspaceSyncEngine;
    private config;
    private currentState;
    private syncInterval;
    private activeSessions;
    private statistics;
    constructor(config: SyncCoordinatorConfig);
    /**
     * Initialize the sync coordinator
     */
    initialize(): Promise<void>;
    /**
     * Perform a full cross-platform synchronization
     */
    performFullSync(): Promise<SyncResult>;
    /**
     * Sync with a specific transport
     */
    private syncWithTransport;
    /**
     * Sync specific configuration types
     */
    syncWorkspaceSettings(workspaceId?: string): Promise<SyncResult>;
    syncPluginConfigurations(pluginIds?: string[]): Promise<SyncResult>;
    syncUserPreferences(): Promise<SyncResult>;
    /**
     * Perform configuration sync with conflict detection and resolution
     */
    private performConfigSync;
    /**
     * Auto-resolve conflicts based on configuration
     */
    private autoResolveConflicts;
    /**
     * Handle real-time configuration changes
     */
    onConfigurationChanged(changeType: 'workspace' | 'plugin' | 'preferences', data: any): Promise<void>;
    /**
     * Start automatic synchronization
     */
    startAutoSync(): void;
    /**
     * Stop automatic synchronization
     */
    stopAutoSync(): void;
    /**
     * Update sync configuration
     */
    updateSyncConfig(updates: Partial<SyncCoordinatorConfig>): Promise<void>;
    /**
     * Get current synchronization status
     */
    getStatus(): {
        state: SyncState;
        activeSessions: SyncSession[];
        conflicts: SyncConflict[];
        statistics: SyncStatistics;
        config: SyncCoordinatorConfig;
    };
    /**
     * Get sync history
     */
    getSyncHistory(limit?: number): SyncSession[];
    /**
     * Force conflict resolution
     */
    resolveConflicts(resolutions: {
        conflictId: string;
        resolution: 'local' | 'remote' | 'merge';
        mergedValue?: any;
    }[]): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    private setupEventListeners;
    private gatherCurrentConfiguration;
    private generateSessionId;
    private generateVersion;
    private estimateConfigSize;
    private updateStatistics;
}
//# sourceMappingURL=CrossPlatformSyncCoordinator.d.ts.map