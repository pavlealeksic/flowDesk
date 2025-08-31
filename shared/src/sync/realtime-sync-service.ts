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
  ttl?: number; // Time to live in milliseconds
}

export type SyncMessageType =
  | 'device_register'
  | 'device_unregister'
  | 'heartbeat'
  | 'data_sync'
  | 'data_update'
  | 'data_delete'
  | 'conflict_resolution'
  | 'workspace_switch'
  | 'notification_sync'
  | 'settings_sync'
  | 'plugin_sync'
  | 'auth_sync'
  | 'bulk_sync'
  | 'presence_update'
  | 'typing_indicator'
  | 'ack';

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

export type ConflictResolutionStrategy = 
  | 'last_write_wins' 
  | 'merge' 
  | 'manual' 
  | 'device_priority';

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
    sent: number; // bytes
    received: number; // bytes
  };
}

export class RealtimeSyncService extends EventEmitter {
  private static instance: RealtimeSyncService | null = null;
  private config: SyncConfig;
  private websocket: WebSocket | null = null;
  private state: SyncState;
  private reconnectAttempts: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: SyncMessage[] = [];
  private messageHandlers: Map<SyncMessageType, Function[]> = new Map();
  private pendingAcks: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private compressionWorker: any = null; // For compression in web workers
  private encryptionKey: CryptoKey | null = null;

  constructor(config: SyncConfig) {
    super();
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

  static getInstance(config?: SyncConfig): RealtimeSyncService {
    if (!RealtimeSyncService.instance && config) {
      RealtimeSyncService.instance = new RealtimeSyncService(config);
    } else if (!RealtimeSyncService.instance) {
      throw new Error('RealtimeSyncService must be initialized with config first');
    }
    return RealtimeSyncService.instance;
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to initialize RealtimeSyncService:', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
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
          } catch (error) {
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
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a sync message
   */
  async sendMessage(message: SyncMessage): Promise<void> {
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
        } else {
          resolve();
        }
        
      } catch (error) {
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
  async syncData(dataType: string, data: any, workspaceId?: string): Promise<void> {
    const message: SyncMessage = {
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
  async syncWorkspaceSwitch(workspaceId: string): Promise<void> {
    const message: SyncMessage = {
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
  async syncNotification(notificationData: any): Promise<void> {
    const message: SyncMessage = {
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
  async updatePresence(status: 'online' | 'away' | 'busy' | 'offline', workspaceId?: string): Promise<void> {
    const message: SyncMessage = {
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
  async sendTypingIndicator(location: string, isTyping: boolean): Promise<void> {
    const message: SyncMessage = {
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
  onMessage(type: SyncMessageType, handler: Function): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Remove message handler
   */
  offMessage(type: SyncMessageType, handler: Function): void {
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
  getSyncState(): SyncState {
    return { ...this.state };
  }

  /**
   * Get connected devices
   */
  getConnectedDevices(): ConnectedDevice[] {
    return [...this.state.deviceList];
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge', mergedData?: any): Promise<void> {
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
    const message: SyncMessage = {
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
  async forceFullSync(workspaceId?: string): Promise<void> {
    const message: SyncMessage = {
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

  private async handleMessage(event: MessageEvent): Promise<void> {
    let message: SyncMessage;
    
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
    } catch (error) {
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
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      }
    }
  }

  private async processMessage(message: SyncMessage): Promise<void> {
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

  private async handleDataSync(message: SyncMessage): Promise<void> {
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
    } else {
      // No conflict, apply changes
      await this.applyDataSync(dataType, data, message.workspaceId);
      this.emit('dataSync', { dataType, data, workspaceId: message.workspaceId });
    }
  }

  private async handleDataUpdate(message: SyncMessage): Promise<void> {
    const { dataType, updates } = message.payload;
    await this.applyDataUpdates(dataType, updates, message.workspaceId);
    this.emit('dataUpdate', { dataType, updates, workspaceId: message.workspaceId });
  }

  private async handleDataDelete(message: SyncMessage): Promise<void> {
    const { dataType, ids } = message.payload;
    await this.applyDataDeletes(dataType, ids, message.workspaceId);
    this.emit('dataDelete', { dataType, ids, workspaceId: message.workspaceId });
  }

  private async handleConflict(message: SyncMessage, localData: any, remoteData: any): Promise<void> {
    const conflictId = this.generateMessageId();
    
    const conflict: ConflictItem = {
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

  private handlePresenceUpdate(message: SyncMessage): void {
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

  private handleAcknowledgment(message: SyncMessage): void {
    const pendingAck = this.pendingAcks.get(message.payload.messageId);
    if (pendingAck) {
      clearTimeout(pendingAck.timeout);
      pendingAck.resolve();
      this.pendingAcks.delete(message.payload.messageId);
    }
  }

  private async sendAcknowledgment(messageId: string): Promise<void> {
    const ackMessage: SyncMessage = {
      id: this.generateMessageId(),
      type: 'ack' as SyncMessageType,
      deviceId: this.config.deviceId,
      userId: this.config.userId,
      timestamp: Date.now(),
      priority: 'low',
      payload: { messageId }
    };
    
    await this.sendMessage(ackMessage);
  }

  private queueMessage(message: SyncMessage): void {
    this.messageQueue.push(message);
    this.savePendingMessages();
  }

  private async processPendingMessages(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          await this.sendMessage(message);
        } catch (error) {
          console.error('Failed to send pending message:', error);
          // Re-queue if send failed
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
    
    this.savePendingMessages();
  }

  private attemptReconnection(): void {
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

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      if (this.state.connected) {
        const heartbeatMessage: SyncMessage = {
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
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private setupMessageHandlers(): void {
    // Set up default message handlers
    this.onMessage('device_register', (message: SyncMessage) => {
      if (message.deviceId !== this.config.deviceId) {
        const device: ConnectedDevice = {
          deviceId: message.deviceId,
          platform: message.payload.platform,
          lastSeen: message.timestamp,
          online: true,
          version: message.payload.version
        };
        
        const existingIndex = this.state.deviceList.findIndex(d => d.deviceId === message.deviceId);
        if (existingIndex >= 0) {
          this.state.deviceList[existingIndex] = device;
        } else {
          this.state.deviceList.push(device);
        }
        
        this.emit('deviceConnected', device);
      }
    });
    
    this.onMessage('device_unregister', (message: SyncMessage) => {
      this.state.deviceList = this.state.deviceList.filter(d => d.deviceId !== message.deviceId);
      this.emit('deviceDisconnected', { deviceId: message.deviceId });
    });
  }

  private generateMessageId(): string {
    return `${this.config.deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private calculateChecksum(data: any): string {
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

  private hasConflict(localData: any, remoteData: any): boolean {
    // Implement conflict detection logic
    return localData.timestamp !== remoteData.timestamp;
  }

  private mergeData(localData: any, remoteData: any): any {
    // Implement data merging logic
    // This is a simple example - in practice, you'd have more sophisticated merging
    return {
      ...localData,
      ...remoteData,
      mergedAt: Date.now()
    };
  }

  private getDeviceCapabilities(): string[] {
    return ['sync', 'notifications', 'workspaces', 'encryption'];
  }

  private async initializeEncryption(): Promise<void> {
    // Initialize encryption key - this should be derived from user credentials
    // For demonstration purposes, generating a key here
    this.encryptionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async initializeCompression(): Promise<void> {
    // Initialize compression worker if available
    // This would be platform-specific implementation
  }

  private async encryptMessage(message: SyncMessage): Promise<SyncMessage> {
    if (!this.encryptionKey) return message;
    
    const messageStr = JSON.stringify(message.payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(messageStr);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );
    
    return {
      ...message,
      payload: {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
      }
    };
  }

  private async decryptMessage(message: SyncMessage): Promise<SyncMessage> {
    if (!this.encryptionKey || !message.payload.encrypted) return message;
    
    const encrypted = new Uint8Array(message.payload.encrypted);
    const iv = new Uint8Array(message.payload.iv);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const decryptedStr = decoder.decode(decrypted);
    
    return {
      ...message,
      payload: JSON.parse(decryptedStr)
    };
  }

  private async compressMessage(message: SyncMessage): Promise<SyncMessage> {
    // Implement compression - this would use a compression library
    return message;
  }

  private async decompressMessage(message: SyncMessage): Promise<SyncMessage> {
    // Implement decompression
    return message;
  }

  private savePendingMessages(): void {
    // Save pending messages to storage for offline capability
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pendingSync', JSON.stringify(this.messageQueue));
    }
  }

  private loadPendingMessages(): void {
    // Load pending messages from storage
    if (typeof localStorage !== 'undefined') {
      const pending = localStorage.getItem('pendingSync');
      if (pending) {
        this.messageQueue = JSON.parse(pending);
      }
    }
  }

  // Placeholder methods for data operations - these would be implemented based on your data layer
  private async getLocalData(dataType: string, workspaceId?: string): Promise<any> {
    // Get local data for conflict detection
    return null;
  }

  private async applyDataSync(dataType: string, data: any, workspaceId?: string): Promise<void> {
    // Apply synced data to local store
  }

  private async applyDataUpdates(dataType: string, updates: any, workspaceId?: string): Promise<void> {
    // Apply data updates to local store
  }

  private async applyDataDeletes(dataType: string, ids: string[], workspaceId?: string): Promise<void> {
    // Apply data deletions to local store
  }

  private async handleConflictResolution(message: SyncMessage): Promise<void> {
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
  disconnect(): void {
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
  dispose(): void {
    this.disconnect();
    this.removeAllListeners();
    this.messageHandlers.clear();
    
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }
  }
}

// Helper functions
export const createSyncService = (config: SyncConfig) => {
  return new RealtimeSyncService(config);
};

export const getSyncService = () => {
  return RealtimeSyncService.getInstance();
};