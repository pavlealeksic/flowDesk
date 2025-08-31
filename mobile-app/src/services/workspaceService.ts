/**
 * Mobile Workspace Service - Handles app containerization and workspace switching
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { useStore } from '../store';
import NetInfo from '@react-native-community/netinfo';

export interface WorkspaceConfig {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  apps: AppConfig[];
  settings: WorkspaceSettings;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  syncEnabled: boolean;
}

export interface AppConfig {
  id: string;
  name: string;
  type: 'builtin' | 'plugin' | 'webview';
  url?: string;
  pluginId?: string;
  settings: AppSettings;
  enabled: boolean;
  position: number;
  notifications: AppNotificationConfig;
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    enabled: boolean;
    quiet: boolean;
    schedules: QuietSchedule[];
  };
  security: {
    requireAuth: boolean;
    lockTimeout: number; // minutes
    biometricAuth: boolean;
  };
  sync: {
    enabled: boolean;
    autoSync: boolean;
    syncInterval: number; // minutes
    conflicts: 'local' | 'remote' | 'merge';
  };
  privacy: {
    clearDataOnSwitch: boolean;
    isolateStorage: boolean;
    trackingProtection: boolean;
  };
}

export interface AppSettings {
  [key: string]: any;
  customUserAgent?: string;
  cookies?: boolean;
  javascript?: boolean;
  localStorage?: boolean;
  permissions?: string[];
}

export interface AppNotificationConfig {
  enabled: boolean;
  showBadge: boolean;
  sound: boolean;
  vibrate: boolean;
  priority: 'low' | 'normal' | 'high';
  categories: string[];
}

export interface QuietSchedule {
  id: string;
  name: string;
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
  days: number[]; // 0-6 (Sunday-Saturday)
  exceptions: string[]; // App IDs that can break through
}

export interface WorkspaceSyncData {
  workspaceId: string;
  deviceId: string;
  timestamp: number;
  settings: WorkspaceSettings;
  apps: AppConfig[];
  checksum: string;
}

export class WorkspaceService {
  private static instance: WorkspaceService | null = null;
  private currentWorkspace: WorkspaceConfig | null = null;
  private workspaces: Map<string, WorkspaceConfig> = new Map();
  private appData: Map<string, Map<string, any>> = new Map(); // workspaceId -> appId -> data
  private syncInterval: NodeJS.Timeout | null = null;
  private webSocketConnection: WebSocket | null = null;
  private isOnline: boolean = true;
  
  static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }
  
  async initialize(): Promise<void> {
    try {
      // Load workspaces from storage
      await this.loadWorkspaces();
      
      // Load current workspace
      await this.loadCurrentWorkspace();
      
      // Set up network monitoring
      this.setupNetworkMonitoring();
      
      // Initialize sync if enabled
      if (this.currentWorkspace?.syncEnabled) {
        await this.initializeSync();
      }
      
      console.log('WorkspaceService initialized');
    } catch (error) {
      console.error('Failed to initialize WorkspaceService:', error);
      throw error;
    }
  }
  
  private async loadWorkspaces(): Promise<void> {
    try {
      const workspacesJson = await AsyncStorage.getItem('workspaces');
      if (workspacesJson) {
        const workspacesArray: WorkspaceConfig[] = JSON.parse(workspacesJson);
        this.workspaces = new Map(workspacesArray.map(ws => [ws.id, ws]));
      } else {
        // Create default workspace
        await this.createDefaultWorkspace();
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      await this.createDefaultWorkspace();
    }
  }
  
  private async createDefaultWorkspace(): Promise<void> {
    const defaultWorkspace: WorkspaceConfig = {
      id: 'default',
      name: 'Default Workspace',
      description: 'Your main workspace',
      color: '#3B82F6',
      icon: 'briefcase',
      apps: [
        {
          id: 'mail',
          name: 'Mail',
          type: 'builtin',
          settings: {},
          enabled: true,
          position: 0,
          notifications: {
            enabled: true,
            showBadge: true,
            sound: true,
            vibrate: false,
            priority: 'high',
            categories: ['email', 'inbox']
          }
        },
        {
          id: 'calendar',
          name: 'Calendar',
          type: 'builtin',
          settings: {},
          enabled: true,
          position: 1,
          notifications: {
            enabled: true,
            showBadge: true,
            sound: true,
            vibrate: true,
            priority: 'high',
            categories: ['calendar', 'meetings']
          }
        },
        {
          id: 'notifications',
          name: 'Notifications',
          type: 'builtin',
          settings: {},
          enabled: true,
          position: 2,
          notifications: {
            enabled: true,
            showBadge: false,
            sound: false,
            vibrate: false,
            priority: 'normal',
            categories: []
          }
        }
      ],
      settings: {
        theme: 'auto',
        notifications: {
          enabled: true,
          quiet: false,
          schedules: []
        },
        security: {
          requireAuth: false,
          lockTimeout: 15,
          biometricAuth: false
        },
        sync: {
          enabled: false,
          autoSync: true,
          syncInterval: 5,
          conflicts: 'merge'
        },
        privacy: {
          clearDataOnSwitch: false,
          isolateStorage: true,
          trackingProtection: true
        }
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
      syncEnabled: false
    };
    
    this.workspaces.set('default', defaultWorkspace);
    await this.saveWorkspaces();
  }
  
  private async loadCurrentWorkspace(): Promise<void> {
    try {
      const currentWorkspaceId = await AsyncStorage.getItem('currentWorkspaceId') || 'default';
      this.currentWorkspace = this.workspaces.get(currentWorkspaceId) || null;
      
      if (!this.currentWorkspace && this.workspaces.size > 0) {
        // Fall back to first available workspace
        this.currentWorkspace = Array.from(this.workspaces.values())[0];
      }
    } catch (error) {
      console.error('Failed to load current workspace:', error);
    }
  }
  
  async createWorkspace(config: Omit<WorkspaceConfig, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<string> {
    const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const workspace: WorkspaceConfig = {
      ...config,
      id: workspaceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: false
    };
    
    this.workspaces.set(workspaceId, workspace);
    await this.saveWorkspaces();
    
    // Initialize app data storage for this workspace
    this.appData.set(workspaceId, new Map());
    
    console.log(`Created workspace: ${workspace.name} (${workspaceId})`);
    return workspaceId;
  }
  
  async updateWorkspace(workspaceId: string, updates: Partial<WorkspaceConfig>): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    const updatedWorkspace = {
      ...workspace,
      ...updates,
      updatedAt: Date.now()
    };
    
    this.workspaces.set(workspaceId, updatedWorkspace);
    await this.saveWorkspaces();
    
    // Update current workspace if it's the one being updated
    if (this.currentWorkspace?.id === workspaceId) {
      this.currentWorkspace = updatedWorkspace;
    }
    
    // Sync changes if enabled
    if (updatedWorkspace.syncEnabled) {
      await this.syncWorkspaceToDevices(workspaceId);
    }
  }
  
  async deleteWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === 'default') {
      throw new Error('Cannot delete default workspace');
    }
    
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    // Clear app data for this workspace
    await this.clearWorkspaceData(workspaceId);
    
    // Remove from memory
    this.workspaces.delete(workspaceId);
    this.appData.delete(workspaceId);
    
    // If this was the current workspace, switch to default
    if (this.currentWorkspace?.id === workspaceId) {
      await this.switchToWorkspace('default');
    }
    
    await this.saveWorkspaces();
    
    console.log(`Deleted workspace: ${workspace.name} (${workspaceId})`);
  }
  
  async switchToWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    // Save current workspace state
    if (this.currentWorkspace) {
      await this.saveWorkspaceState(this.currentWorkspace.id);
      this.currentWorkspace.isActive = false;
    }
    
    // Clear data from previous workspace if configured
    if (this.currentWorkspace?.settings.privacy.clearDataOnSwitch) {
      await this.clearCurrentWorkspaceData();
    }
    
    // Switch to new workspace
    this.currentWorkspace = workspace;
    this.currentWorkspace.isActive = true;
    
    // Save current workspace ID
    await AsyncStorage.setItem('currentWorkspaceId', workspaceId);
    
    // Load workspace state
    await this.loadWorkspaceState(workspaceId);
    
    // Update store
    useStore.getState().setCurrentWorkspace?.(workspace);
    
    // Apply workspace settings
    await this.applyWorkspaceSettings(workspace);
    
    console.log(`Switched to workspace: ${workspace.name} (${workspaceId})`);
  }
  
  private async saveWorkspaceState(workspaceId: string): Promise<void> {
    try {
      const store = useStore.getState();
      const state = {
        timestamp: Date.now(),
        // Save relevant app state data
        mailState: store.mail,
        calendarState: store.calendar,
        notificationState: store.notifications,
        // Add other state as needed
      };
      
      await AsyncStorage.setItem(
        `workspace_state_${workspaceId}`,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error('Failed to save workspace state:', error);
    }
  }
  
  private async loadWorkspaceState(workspaceId: string): Promise<void> {
    try {
      const stateJson = await AsyncStorage.getItem(`workspace_state_${workspaceId}`);
      if (stateJson) {
        const state = JSON.parse(stateJson);
        const store = useStore.getState();
        
        // Restore state
        if (state.mailState) store.setMail?.(state.mailState);
        if (state.calendarState) store.setCalendar?.(state.calendarState);
        if (state.notificationState) store.setNotifications?.(state.notificationState);
      }
    } catch (error) {
      console.error('Failed to load workspace state:', error);
    }
  }
  
  private async applyWorkspaceSettings(workspace: WorkspaceConfig): Promise<void> {
    const store = useStore.getState();
    
    // Apply theme
    store.setTheme?.(workspace.settings.theme);
    
    // Configure notifications
    if (workspace.settings.notifications.enabled) {
      // Enable notifications based on workspace settings
      for (const app of workspace.apps) {
        if (app.notifications.enabled) {
          // Configure app-specific notifications
          // This would integrate with the notification service
        }
      }
    }
    
    // Apply security settings
    if (workspace.settings.security.requireAuth) {
      // Lock workspace after timeout
      // This would integrate with authentication service
    }
  }
  
  async getWorkspaceData(workspaceId: string, appId: string, key: string): Promise<any> {
    const workspaceData = this.appData.get(workspaceId);
    if (!workspaceData) return null;
    
    const appData = workspaceData.get(appId);
    if (!appData) return null;
    
    return appData[key] || null;
  }
  
  async setWorkspaceData(workspaceId: string, appId: string, key: string, value: any): Promise<void> {
    let workspaceData = this.appData.get(workspaceId);
    if (!workspaceData) {
      workspaceData = new Map();
      this.appData.set(workspaceId, workspaceData);
    }
    
    let appData = workspaceData.get(appId);
    if (!appData) {
      appData = {};
      workspaceData.set(appId, appData);
    }
    
    appData[key] = value;
    
    // Persist to secure storage if sensitive data
    if (this.isSensitiveKey(key)) {
      await SecureStore.setItemAsync(
        `workspace_${workspaceId}_${appId}_${key}`,
        JSON.stringify(value)
      );
    } else {
      await AsyncStorage.setItem(
        `workspace_${workspaceId}_${appId}_${key}`,
        JSON.stringify(value)
      );
    }
  }
  
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = ['token', 'password', 'secret', 'credential', 'auth'];
    return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive));
  }
  
  private async clearWorkspaceData(workspaceId: string): Promise<void> {
    try {
      // Get all keys for this workspace
      const allKeys = await AsyncStorage.getAllKeys();
      const workspaceKeys = allKeys.filter(key => key.startsWith(`workspace_${workspaceId}_`));
      
      // Clear from AsyncStorage
      await AsyncStorage.multiRemove(workspaceKeys);
      
      // Clear from SecureStore
      for (const key of workspaceKeys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          // Key might not exist in SecureStore, ignore
        }
      }
      
      // Clear from memory
      this.appData.delete(workspaceId);
      
      console.log(`Cleared data for workspace: ${workspaceId}`);
    } catch (error) {
      console.error('Failed to clear workspace data:', error);
    }
  }
  
  private async clearCurrentWorkspaceData(): Promise<void> {
    if (this.currentWorkspace) {
      await this.clearWorkspaceData(this.currentWorkspace.id);
    }
  }
  
  private async saveWorkspaces(): Promise<void> {
    try {
      const workspacesArray = Array.from(this.workspaces.values());
      await AsyncStorage.setItem('workspaces', JSON.stringify(workspacesArray));
    } catch (error) {
      console.error('Failed to save workspaces:', error);
    }
  }
  
  // Cross-platform sync methods
  
  private async initializeSync(): Promise<void> {
    try {
      const syncEndpoint = await AsyncStorage.getItem('workspaceSyncEndpoint');
      if (syncEndpoint && this.isOnline) {
        this.connectToSyncService(syncEndpoint);
        
        // Start auto sync if enabled
        if (this.currentWorkspace?.settings.sync.autoSync) {
          this.startAutoSync();
        }
      }
    } catch (error) {
      console.error('Failed to initialize workspace sync:', error);
    }
  }
  
  private connectToSyncService(endpoint: string): void {
    if (this.webSocketConnection) {
      this.webSocketConnection.close();
    }
    
    this.webSocketConnection = new WebSocket(endpoint);
    
    this.webSocketConnection.onopen = () => {
      console.log('Connected to workspace sync service');
      // Register device
      this.webSocketConnection?.send(JSON.stringify({
        type: 'register_workspace',
        payload: {
          deviceId: Platform.OS,
          workspaceId: this.currentWorkspace?.id,
          platform: Platform.OS
        }
      }));
    };
    
    this.webSocketConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSyncMessage(data);
      } catch (error) {
        console.error('Failed to parse workspace sync message:', error);
      }
    };
    
    this.webSocketConnection.onclose = () => {
      console.log('Disconnected from workspace sync service');
      // Attempt reconnection
      setTimeout(() => {
        if (this.isOnline) {
          this.connectToSyncService(endpoint);
        }
      }, 5000);
    };
  }
  
  private async handleSyncMessage(data: any): Promise<void> {
    switch (data.type) {
      case 'workspace_updated':
        await this.handleRemoteWorkspaceUpdate(data.payload);
        break;
      case 'workspace_deleted':
        await this.handleRemoteWorkspaceDelete(data.payload);
        break;
      case 'sync_request':
        await this.handleSyncRequest(data.payload);
        break;
    }
  }
  
  private async handleRemoteWorkspaceUpdate(payload: WorkspaceSyncData): Promise<void> {
    const workspace = this.workspaces.get(payload.workspaceId);
    if (workspace) {
      // Merge changes based on conflict resolution strategy
      const strategy = workspace.settings.sync.conflicts;
      
      if (strategy === 'remote' || payload.timestamp > workspace.updatedAt) {
        workspace.settings = payload.settings;
        workspace.apps = payload.apps;
        workspace.updatedAt = payload.timestamp;
        
        this.workspaces.set(payload.workspaceId, workspace);
        await this.saveWorkspaces();
        
        // Update current workspace if it's the one being synced
        if (this.currentWorkspace?.id === payload.workspaceId) {
          this.currentWorkspace = workspace;
          await this.applyWorkspaceSettings(workspace);
        }
      }
    }
  }
  
  private async handleRemoteWorkspaceDelete(payload: { workspaceId: string }): Promise<void> {
    if (payload.workspaceId !== 'default') {
      await this.deleteWorkspace(payload.workspaceId);
    }
  }
  
  private async handleSyncRequest(payload: { workspaceId: string }): Promise<void> {
    const workspace = this.workspaces.get(payload.workspaceId);
    if (workspace && workspace.syncEnabled) {
      await this.syncWorkspaceToDevices(payload.workspaceId);
    }
  }
  
  private async syncWorkspaceToDevices(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !this.webSocketConnection || this.webSocketConnection.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const syncData: WorkspaceSyncData = {
      workspaceId,
      deviceId: Platform.OS,
      timestamp: workspace.updatedAt,
      settings: workspace.settings,
      apps: workspace.apps,
      checksum: this.calculateChecksum(workspace)
    };
    
    this.webSocketConnection.send(JSON.stringify({
      type: 'workspace_sync',
      payload: syncData
    }));
  }
  
  private calculateChecksum(workspace: WorkspaceConfig): string {
    const data = JSON.stringify({
      settings: workspace.settings,
      apps: workspace.apps,
      timestamp: workspace.updatedAt
    });
    
    // Simple checksum - in production, use a proper hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    const interval = (this.currentWorkspace?.settings.sync.syncInterval || 5) * 60 * 1000;
    
    this.syncInterval = setInterval(async () => {
      if (this.currentWorkspace?.syncEnabled && this.isOnline) {
        await this.syncWorkspaceToDevices(this.currentWorkspace.id);
      }
    }, interval);
  }
  
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (!wasOnline && this.isOnline && this.currentWorkspace?.syncEnabled) {
        // Reconnect and sync
        this.initializeSync();
      }
    });
  }
  
  // Public API methods
  
  getCurrentWorkspace(): WorkspaceConfig | null {
    return this.currentWorkspace;
  }
  
  getWorkspaces(): WorkspaceConfig[] {
    return Array.from(this.workspaces.values());
  }
  
  getWorkspace(workspaceId: string): WorkspaceConfig | null {
    return this.workspaces.get(workspaceId) || null;
  }
  
  async addAppToWorkspace(workspaceId: string, appConfig: AppConfig): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    // Check if app already exists
    const existingApp = workspace.apps.find(app => app.id === appConfig.id);
    if (existingApp) {
      throw new Error(`App already exists in workspace: ${appConfig.id}`);
    }
    
    workspace.apps.push(appConfig);
    workspace.apps.sort((a, b) => a.position - b.position);
    
    await this.updateWorkspace(workspaceId, { apps: workspace.apps });
  }
  
  async removeAppFromWorkspace(workspaceId: string, appId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    workspace.apps = workspace.apps.filter(app => app.id !== appId);
    
    // Clear app data
    const workspaceData = this.appData.get(workspaceId);
    if (workspaceData) {
      workspaceData.delete(appId);
    }
    
    await this.updateWorkspace(workspaceId, { apps: workspace.apps });
  }
  
  async updateAppInWorkspace(workspaceId: string, appId: string, updates: Partial<AppConfig>): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    const appIndex = workspace.apps.findIndex(app => app.id === appId);
    if (appIndex === -1) {
      throw new Error(`App not found in workspace: ${appId}`);
    }
    
    workspace.apps[appIndex] = { ...workspace.apps[appIndex], ...updates };
    
    await this.updateWorkspace(workspaceId, { apps: workspace.apps });
  }
  
  async exportWorkspace(workspaceId: string): Promise<string> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    
    const exportData = {
      workspace,
      exportedAt: Date.now(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  async importWorkspace(exportData: string): Promise<string> {
    try {
      const data = JSON.parse(exportData);
      const workspace = data.workspace;
      
      // Generate new ID to avoid conflicts
      const newId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      workspace.id = newId;
      workspace.name = `${workspace.name} (Imported)`;
      workspace.createdAt = Date.now();
      workspace.updatedAt = Date.now();
      workspace.isActive = false;
      
      this.workspaces.set(newId, workspace);
      await this.saveWorkspaces();
      
      return newId;
    } catch (error) {
      throw new Error('Invalid workspace export data');
    }
  }
  
  // Cleanup
  
  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.webSocketConnection) {
      this.webSocketConnection.close();
      this.webSocketConnection = null;
    }
  }
}

// Helper functions
export const initializeWorkspaceService = async () => {
  const service = WorkspaceService.getInstance();
  await service.initialize();
  return service;
};

export const getCurrentWorkspace = () => {
  return WorkspaceService.getInstance().getCurrentWorkspace();
};

export const switchWorkspace = (workspaceId: string) => {
  return WorkspaceService.getInstance().switchToWorkspace(workspaceId);
};

export const createWorkspace = (config: Omit<WorkspaceConfig, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => {
  return WorkspaceService.getInstance().createWorkspace(config);
};

export const getWorkspaces = () => {
  return WorkspaceService.getInstance().getWorkspaces();
};