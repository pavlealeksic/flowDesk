/**
 * Real-time WebSocket Sync Infrastructure for Flow Desk
 * Handles real-time data synchronization, conflict resolution, and offline sync
 */
import { EventEmitter } from 'events';
export interface SyncMessage {
    id: string;
    type: SyncMessageType;
    deviceId: string;
    userId: string;
    workspaceId?: string;
    timestamp: number;
    payload: any;
    checksum?: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    retryCount?: number;
    ttl?: number;
}
export type SyncMessageType = 'device_register' | 'device_unregister' | 'heartbeat' | 'data_sync' | 'data_update' | 'data_delete' | 'conflict_resolution' | 'workspace_switch' | 'notification_sync' | 'settings_sync' | 'plugin_sync' | 'auth_sync' | 'bulk_sync' | 'presence_update' | 'typing_indicator' | 'ack';
export interface SyncConfig {
    endpoint: string;
    userId: string;
    deviceId: string;
    platform: 'desktop' | 'mobile' | 'web';
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
    messageTimeout: number;
    batchSize: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    conflictResolutionStrategy: ConflictResolutionStrategy;
}
export type ConflictResolutionStrategy = 'last_write_wins' | 'merge' | 'manual' | 'device_priority';
export interface SyncState {
    connected: boolean;
    lastSyncTime: number;
    pendingMessages: SyncMessage[];
    conflictQueue: ConflictItem[];
    deviceList: ConnectedDevice[];
    syncStats: SyncStats;
}
export interface ConflictItem {
    id: string;
    localData: any;
    remoteData: any;
    timestamp: number;
    dataType: string;
    resolved: boolean;
}
export interface ConnectedDevice {
    deviceId: string;
    platform: string;
    lastSeen: number;
    online: boolean;
    version: string;
}
export interface SyncStats {
    messagesSent: number;
    messagesReceived: number;
    syncErrors: number;
    conflictsResolved: number;
    lastError?: string;
    bandwidth: {
        sent: number;
        received: number;
    };
}
export declare class RealtimeSyncService extends EventEmitter {
    private static instance;
    private config;
    private websocket;
    private state;
    private reconnectAttempts;
    private heartbeatInterval;
    private messageQueue;
    private messageHandlers;
    private pendingAcks;
    private compressionWorker;
    private encryptionKey;
    constructor(config: SyncConfig);
    static getInstance(config?: SyncConfig): RealtimeSyncService;
    /**
     * Initialize the sync service
     */
    initialize(): Promise<void>;
    /**
     * Connect to WebSocket server
     */
    connect(): Promise<void>;
    /**
     * Send a sync message
     */
    sendMessage(message: SyncMessage): Promise<void>;
    /**
     * Send data update
     */
    syncData(dataType: string, data: any, workspaceId?: string): Promise<void>;
    /**
     * Sync workspace switch
     */
    syncWorkspaceSwitch(workspaceId: string): Promise<void>;
    /**
     * Sync notifications
     */
    syncNotification(notificationData: any): Promise<void>;
    /**
     * Update presence status
     */
    updatePresence(status: 'online' | 'away' | 'busy' | 'offline', workspaceId?: string): Promise<void>;
    /**
     * Send typing indicator
     */
    sendTypingIndicator(location: string, isTyping: boolean): Promise<void>;
    /**
     * Register message handler
     */
    onMessage(type: SyncMessageType, handler: Function): void;
    /**
     * Remove message handler
     */
    offMessage(type: SyncMessageType, handler: Function): void;
    /**
     * Get current sync state
     */
    getSyncState(): SyncState;
    /**
     * Get connected devices
     */
    getConnectedDevices(): ConnectedDevice[];
    /**
     * Resolve conflict manually
     */
    resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge', mergedData?: any): Promise<void>;
    /**
     * Force full sync
     */
    forceFullSync(workspaceId?: string): Promise<void>;
    private handleMessage;
    private processMessage;
    private handleDataSync;
    private handleDataUpdate;
    private handleDataDelete;
    private handleConflict;
    private handlePresenceUpdate;
    private handleAcknowledgment;
    private sendAcknowledgment;
    private queueMessage;
    private processPendingMessages;
    private attemptReconnection;
    private startHeartbeat;
    private setupMessageHandlers;
    private generateMessageId;
    private calculateChecksum;
    private hasConflict;
    private mergeData;
    private getDeviceCapabilities;
    private initializeEncryption;
    private initializeCompression;
    private encryptMessage;
    private decryptMessage;
    private compressMessage;
    private decompressMessage;
    private savePendingMessages;
    private loadPendingMessages;
    private getLocalData;
    private applyDataSync;
    private applyDataUpdates;
    private applyDataDeletes;
    private handleConflictResolution;
    /**
     * Disconnect from sync service
     */
    disconnect(): void;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
export declare const createSyncService: (config: SyncConfig) => RealtimeSyncService;
export declare const getSyncService: () => RealtimeSyncService;
//# sourceMappingURL=realtime-sync-service.d.ts.map