"use strict";
/**
 * Real-time WebSocket Sync Infrastructure for Flow Desk
 * Handles real-time data synchronization, conflict resolution, and offline sync
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncService = exports.createSyncService = exports.RealtimeSyncService = void 0;
const events_1 = require("events");
class RealtimeSyncService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.heartbeatInterval = null;
        this.messageQueue = [];
        this.messageHandlers = new Map();
        this.pendingAcks = new Map();
        this.compressionWorker = null; // For compression in web workers
        this.encryptionKey = null;
        this.config = config;
        this.state = {
            connected: false,
            lastSyncTime: 0,
            pendingMessages: [],
            conflictQueue: [],
            deviceList: [],
            syncStats: {
                messagesSent: 0,
                messagesReceived: 0,
                syncErrors: 0,
                conflictsResolved: 0,
                bandwidth: { sent: 0, received: 0 }
            }
        };
        this.setupMessageHandlers();
        this.loadPendingMessages();
    }
    static getInstance(config) {
        if (!RealtimeSyncService.instance && config) {
            RealtimeSyncService.instance = new RealtimeSyncService(config);
        }
        else if (!RealtimeSyncService.instance) {
            throw new Error('RealtimeSyncService must be initialized with config first');
        }
        return RealtimeSyncService.instance;
    }
    /**
     * Initialize the sync service
     */
    async initialize() {
        try {
            // Initialize encryption if enabled
            if (this.config.encryptionEnabled) {
                await this.initializeEncryption();
            }
            // Initialize compression if enabled
            if (this.config.compressionEnabled) {
                await this.initializeCompression();
            }
            // Connect to sync service
            await this.connect();
            // Start heartbeat
            this.startHeartbeat();
            console.log('RealtimeSyncService initialized');
        }
        catch (error) {
            console.error('Failed to initialize RealtimeSyncService:', error);
            throw error;
        }
    }
    /**
     * Connect to WebSocket server
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.websocket = new WebSocket(this.config.endpoint);
                this.websocket.onopen = () => {
                    console.log('WebSocket connected');
                    this.state.connected = true;
                    this.reconnectAttempts = 0;
                    // Register device
                    this.sendMessage({
                        id: this.generateMessageId(),
                        type: 'device_register',
                        deviceId: this.config.deviceId,
                        userId: this.config.userId,
                        timestamp: Date.now(),
                        priority: 'high',
                        payload: {
                            platform: this.config.platform,
                            version: process.env.APP_VERSION || '1.0.0',
                            capabilities: this.getDeviceCapabilities()
                        }
                    });
                    // Process pending messages
                    this.processPendingMessages();
                    this.emit('connected');
                    resolve();
                };
                this.websocket.onmessage = async (event) => {
                    try {
                        await this.handleMessage(event);
                    }
                    catch (error) {
                        console.error('Error handling WebSocket message:', error);
                        this.state.syncStats.syncErrors++;
                    }
                };
                this.websocket.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    this.state.connected = false;
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    // Attempt reconnection if not a clean close
                    if (event.code !== 1000) {
                        this.attemptReconnection();
                    }
                };
                this.websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.state.syncStats.syncErrors++;
                    this.state.syncStats.lastError = 'WebSocket error';
                    this.emit('error', error);
                    reject(error);
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Send a sync message
     */
    async sendMessage(message) {
        return new Promise(async (resolve, reject) => {
            try {
                // Add to pending queue if not connected
                if (!this.state.connected || !this.websocket) {
                    this.queueMessage(message);
                    resolve();
                    return;
                }
                // Encrypt message if enabled
                let payload = message;
                if (this.config.encryptionEnabled && this.encryptionKey) {
                    payload = await this.encryptMessage(message);
                }
                // Compress message if enabled
                if (this.config.compressionEnabled) {
                    payload = await this.compressMessage(payload);
                }
                // Send message
                const messageStr = JSON.stringify(payload);
                this.websocket.send(messageStr);
                // Update stats
                this.state.syncStats.messagesSent++;
                this.state.syncStats.bandwidth.sent += messageStr.length;
                // Set up acknowledgment timeout for critical messages
                if (message.priority === 'critical') {
                    const timeout = setTimeout(() => {
                        this.pendingAcks.delete(message.id);
                        reject(new Error(`Message acknowledgment timeout: ${message.id}`));
                    }, this.config.messageTimeout);
                    this.pendingAcks.set(message.id, { resolve, reject, timeout });
                }
                else {
                    resolve();
                }
            }
            catch (error) {
                console.error('Failed to send sync message:', error);
                this.state.syncStats.syncErrors++;
                this.queueMessage(message);
                reject(error);
            }
        });
    }
    /**
     * Send data update
     */
    async syncData(dataType, data, workspaceId) {
        const message = {
            id: this.generateMessageId(),
            type: 'data_sync',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            workspaceId,
            timestamp: Date.now(),
            priority: 'normal',
            payload: {
                dataType,
                data,
                checksum: this.calculateChecksum(data)
            }
        };
        await this.sendMessage(message);
    }
    /**
     * Sync workspace switch
     */
    async syncWorkspaceSwitch(workspaceId) {
        const message = {
            id: this.generateMessageId(),
            type: 'workspace_switch',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            workspaceId,
            timestamp: Date.now(),
            priority: 'high',
            payload: { newWorkspaceId: workspaceId }
        };
        await this.sendMessage(message);
    }
    /**
     * Sync notifications
     */
    async syncNotification(notificationData) {
        const message = {
            id: this.generateMessageId(),
            type: 'notification_sync',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            timestamp: Date.now(),
            priority: 'high',
            payload: notificationData
        };
        await this.sendMessage(message);
    }
    /**
     * Update presence status
     */
    async updatePresence(status, workspaceId) {
        const message = {
            id: this.generateMessageId(),
            type: 'presence_update',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            workspaceId,
            timestamp: Date.now(),
            priority: 'low',
            payload: { status }
        };
        await this.sendMessage(message);
    }
    /**
     * Send typing indicator
     */
    async sendTypingIndicator(location, isTyping) {
        const message = {
            id: this.generateMessageId(),
            type: 'typing_indicator',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            timestamp: Date.now(),
            priority: 'low',
            ttl: 5000, // 5 seconds
            payload: { location, isTyping }
        };
        await this.sendMessage(message);
    }
    /**
     * Register message handler
     */
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }
    /**
     * Remove message handler
     */
    offMessage(type, handler) {
        const handlers = this.messageHandlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    /**
     * Get current sync state
     */
    getSyncState() {
        return { ...this.state };
    }
    /**
     * Get connected devices
     */
    getConnectedDevices() {
        return [...this.state.deviceList];
    }
    /**
     * Resolve conflict manually
     */
    async resolveConflict(conflictId, resolution, mergedData) {
        const conflict = this.state.conflictQueue.find(c => c.id === conflictId);
        if (!conflict) {
            throw new Error(`Conflict not found: ${conflictId}`);
        }
        let resolvedData;
        switch (resolution) {
            case 'local':
                resolvedData = conflict.localData;
                break;
            case 'remote':
                resolvedData = conflict.remoteData;
                break;
            case 'merge':
                resolvedData = mergedData || this.mergeData(conflict.localData, conflict.remoteData);
                break;
        }
        // Send conflict resolution
        const message = {
            id: this.generateMessageId(),
            type: 'conflict_resolution',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            timestamp: Date.now(),
            priority: 'high',
            payload: {
                conflictId,
                resolution,
                resolvedData,
                dataType: conflict.dataType
            }
        };
        await this.sendMessage(message);
        // Remove from conflict queue
        this.state.conflictQueue = this.state.conflictQueue.filter(c => c.id !== conflictId);
        this.state.syncStats.conflictsResolved++;
        this.emit('conflictResolved', { conflictId, resolution, resolvedData });
    }
    /**
     * Force full sync
     */
    async forceFullSync(workspaceId) {
        const message = {
            id: this.generateMessageId(),
            type: 'bulk_sync',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            workspaceId,
            timestamp: Date.now(),
            priority: 'critical',
            payload: { fullSync: true }
        };
        await this.sendMessage(message);
    }
    // Private methods
    async handleMessage(event) {
        let message;
        try {
            // Parse message
            let parsedMessage = JSON.parse(event.data);
            // Decompress if needed
            if (this.config.compressionEnabled) {
                parsedMessage = await this.decompressMessage(parsedMessage);
            }
            // Decrypt if needed
            if (this.config.encryptionEnabled && this.encryptionKey) {
                parsedMessage = await this.decryptMessage(parsedMessage);
            }
            message = parsedMessage;
        }
        catch (error) {
            console.error('Failed to parse sync message:', error);
            this.state.syncStats.syncErrors++;
            return;
        }
        // Update stats
        this.state.syncStats.messagesReceived++;
        this.state.syncStats.bandwidth.received += event.data.length;
        // Handle acknowledgments
        if (message.type === 'ack') {
            this.handleAcknowledgment(message);
            return;
        }
        // Send acknowledgment for critical messages
        if (message.priority === 'critical') {
            await this.sendAcknowledgment(message.id);
        }
        // Handle message based on type
        await this.processMessage(message);
        // Call registered handlers
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    await handler(message);
                }
                catch (error) {
                    console.error('Error in message handler:', error);
                }
            }
        }
    }
    async processMessage(message) {
        switch (message.type) {
            case 'data_sync':
                await this.handleDataSync(message);
                break;
            case 'data_update':
                await this.handleDataUpdate(message);
                break;
            case 'data_delete':
                await this.handleDataDelete(message);
                break;
            case 'conflict_resolution':
                await this.handleConflictResolution(message);
                break;
            case 'workspace_switch':
                this.emit('workspaceSwitch', message.payload);
                break;
            case 'notification_sync':
                this.emit('notificationSync', message.payload);
                break;
            case 'settings_sync':
                this.emit('settingsSync', message.payload);
                break;
            case 'presence_update':
                this.handlePresenceUpdate(message);
                break;
            case 'heartbeat':
                // Heartbeat received, update last sync time
                this.state.lastSyncTime = Date.now();
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    async handleDataSync(message) {
        const { dataType, data, checksum } = message.payload;
        // Verify checksum
        if (checksum && this.calculateChecksum(data) !== checksum) {
            console.error('Data checksum mismatch, requesting resync');
            this.state.syncStats.syncErrors++;
            return;
        }
        // Check for conflicts
        const localData = await this.getLocalData(dataType, message.workspaceId);
        if (localData && this.hasConflict(localData, data)) {
            await this.handleConflict(message, localData, data);
        }
        else {
            // No conflict, apply changes
            await this.applyDataSync(dataType, data, message.workspaceId);
            this.emit('dataSync', { dataType, data, workspaceId: message.workspaceId });
        }
    }
    async handleDataUpdate(message) {
        const { dataType, updates } = message.payload;
        await this.applyDataUpdates(dataType, updates, message.workspaceId);
        this.emit('dataUpdate', { dataType, updates, workspaceId: message.workspaceId });
    }
    async handleDataDelete(message) {
        const { dataType, ids } = message.payload;
        await this.applyDataDeletes(dataType, ids, message.workspaceId);
        this.emit('dataDelete', { dataType, ids, workspaceId: message.workspaceId });
    }
    async handleConflict(message, localData, remoteData) {
        const conflictId = this.generateMessageId();
        const conflict = {
            id: conflictId,
            localData,
            remoteData,
            timestamp: Date.now(),
            dataType: message.payload.dataType,
            resolved: false
        };
        this.state.conflictQueue.push(conflict);
        // Auto-resolve based on strategy
        switch (this.config.conflictResolutionStrategy) {
            case 'last_write_wins':
                const resolution = message.timestamp > localData.timestamp ? 'remote' : 'local';
                await this.resolveConflict(conflictId, resolution);
                break;
            case 'merge':
                const merged = this.mergeData(localData, remoteData);
                await this.resolveConflict(conflictId, 'merge', merged);
                break;
            case 'manual':
                this.emit('conflict', conflict);
                break;
            case 'device_priority':
                // Implement device priority logic
                break;
        }
    }
    handlePresenceUpdate(message) {
        const device = this.state.deviceList.find(d => d.deviceId === message.deviceId);
        if (device) {
            device.lastSeen = message.timestamp;
            device.online = message.payload.status !== 'offline';
        }
        this.emit('presenceUpdate', {
            deviceId: message.deviceId,
            status: message.payload.status,
            timestamp: message.timestamp
        });
    }
    handleAcknowledgment(message) {
        const pendingAck = this.pendingAcks.get(message.payload.messageId);
        if (pendingAck) {
            clearTimeout(pendingAck.timeout);
            pendingAck.resolve();
            this.pendingAcks.delete(message.payload.messageId);
        }
    }
    async sendAcknowledgment(messageId) {
        const ackMessage = {
            id: this.generateMessageId(),
            type: 'ack',
            deviceId: this.config.deviceId,
            userId: this.config.userId,
            timestamp: Date.now(),
            priority: 'low',
            payload: { messageId }
        };
        await this.sendMessage(ackMessage);
    }
    queueMessage(message) {
        this.messageQueue.push(message);
        this.savePendingMessages();
    }
    async processPendingMessages() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                try {
                    await this.sendMessage(message);
                }
                catch (error) {
                    console.error('Failed to send pending message:', error);
                    // Re-queue if send failed
                    this.messageQueue.unshift(message);
                    break;
                }
            }
        }
        this.savePendingMessages();
    }
    attemptReconnection() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('reconnectFailed');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
        setTimeout(() => {
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
                this.attemptReconnection();
            });
        }, delay);
    }
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(async () => {
            if (this.state.connected) {
                const heartbeatMessage = {
                    id: this.generateMessageId(),
                    type: 'heartbeat',
                    deviceId: this.config.deviceId,
                    userId: this.config.userId,
                    timestamp: Date.now(),
                    priority: 'low',
                    payload: { stats: this.state.syncStats }
                };
                try {
                    await this.sendMessage(heartbeatMessage);
                }
                catch (error) {
                    console.error('Failed to send heartbeat:', error);
                }
            }
        }, this.config.heartbeatInterval);
    }
    setupMessageHandlers() {
        // Set up default message handlers
        this.onMessage('device_register', (message) => {
            if (message.deviceId !== this.config.deviceId) {
                const device = {
                    deviceId: message.deviceId,
                    platform: message.payload.platform,
                    lastSeen: message.timestamp,
                    online: true,
                    version: message.payload.version
                };
                const existingIndex = this.state.deviceList.findIndex(d => d.deviceId === message.deviceId);
                if (existingIndex >= 0) {
                    this.state.deviceList[existingIndex] = device;
                }
                else {
                    this.state.deviceList.push(device);
                }
                this.emit('deviceConnected', device);
            }
        });
        this.onMessage('device_unregister', (message) => {
            this.state.deviceList = this.state.deviceList.filter(d => d.deviceId !== message.deviceId);
            this.emit('deviceDisconnected', { deviceId: message.deviceId });
        });
    }
    generateMessageId() {
        return `${this.config.deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    calculateChecksum(data) {
        // Simple checksum - in production, use a proper hash function
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    hasConflict(localData, remoteData) {
        // Implement conflict detection logic
        return localData.timestamp !== remoteData.timestamp;
    }
    mergeData(localData, remoteData) {
        // Implement data merging logic
        // This is a simple example - in practice, you'd have more sophisticated merging
        return {
            ...localData,
            ...remoteData,
            mergedAt: Date.now()
        };
    }
    getDeviceCapabilities() {
        return ['sync', 'notifications', 'workspaces', 'encryption'];
    }
    async initializeEncryption() {
        // Initialize encryption key - this should be derived from user credentials
        // For demonstration purposes, generating a key here
        this.encryptionKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async initializeCompression() {
        // Initialize compression worker if available
        // This would be platform-specific implementation
    }
    async encryptMessage(message) {
        if (!this.encryptionKey)
            return message;
        const messageStr = JSON.stringify(message.payload);
        const encoder = new TextEncoder();
        const data = encoder.encode(messageStr);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.encryptionKey, data);
        return {
            ...message,
            payload: {
                encrypted: Array.from(new Uint8Array(encrypted)),
                iv: Array.from(iv)
            }
        };
    }
    async decryptMessage(message) {
        if (!this.encryptionKey || !message.payload.encrypted)
            return message;
        const encrypted = new Uint8Array(message.payload.encrypted);
        const iv = new Uint8Array(message.payload.iv);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.encryptionKey, encrypted);
        const decoder = new TextDecoder();
        const decryptedStr = decoder.decode(decrypted);
        return {
            ...message,
            payload: JSON.parse(decryptedStr)
        };
    }
    async compressMessage(message) {
        // Implement compression - this would use a compression library
        return message;
    }
    async decompressMessage(message) {
        // Implement decompression
        return message;
    }
    savePendingMessages() {
        // Save pending messages to storage for offline capability
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('pendingSync', JSON.stringify(this.messageQueue));
        }
    }
    loadPendingMessages() {
        // Load pending messages from storage
        if (typeof localStorage !== 'undefined') {
            const pending = localStorage.getItem('pendingSync');
            if (pending) {
                this.messageQueue = JSON.parse(pending);
            }
        }
    }
    // Placeholder methods for data operations - these would be implemented based on your data layer
    async getLocalData(dataType, workspaceId) {
        // Get local data for conflict detection
        return null;
    }
    async applyDataSync(dataType, data, workspaceId) {
        // Apply synced data to local store
    }
    async applyDataUpdates(dataType, updates, workspaceId) {
        // Apply data updates to local store
    }
    async applyDataDeletes(dataType, ids, workspaceId) {
        // Apply data deletions to local store
    }
    async handleConflictResolution(message) {
        // Handle conflict resolution from other devices
        const { conflictId, resolution, resolvedData, dataType } = message.payload;
        // Apply resolved data
        await this.applyDataSync(dataType, resolvedData, message.workspaceId);
        // Remove from local conflict queue
        this.state.conflictQueue = this.state.conflictQueue.filter(c => c.id !== conflictId);
        this.emit('conflictResolvedRemotely', { conflictId, resolution, resolvedData });
    }
    /**
     * Disconnect from sync service
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close(1000, 'Client disconnect');
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        // Clear pending acknowledgments
        for (const { timeout, reject } of this.pendingAcks.values()) {
            clearTimeout(timeout);
            reject(new Error('Service disconnected'));
        }
        this.pendingAcks.clear();
        this.state.connected = false;
        this.emit('disconnected');
    }
    /**
     * Cleanup resources
     */
    dispose() {
        this.disconnect();
        this.removeAllListeners();
        this.messageHandlers.clear();
        if (this.compressionWorker) {
            this.compressionWorker.terminate();
        }
    }
}
exports.RealtimeSyncService = RealtimeSyncService;
RealtimeSyncService.instance = null;
// Helper functions
const createSyncService = (config) => {
    return new RealtimeSyncService(config);
};
exports.createSyncService = createSyncService;
const getSyncService = () => {
    return RealtimeSyncService.getInstance();
};
exports.getSyncService = getSyncService;
//# sourceMappingURL=realtime-sync-service.js.map