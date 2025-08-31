/**
 * Sync Store Slice - Manages E2E encrypted config sync
 */

import { StateCreator } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type SyncProvider = 'icloud' | 'onedrive' | 'dropbox' | 'googledrive' | 'local';

export interface SyncConfig {
  provider: SyncProvider;
  isEnabled: boolean;
  autoSync: boolean;
  syncInterval: number; // minutes
  lastSyncTime?: Date;
  syncError?: string;
  encryptionEnabled: boolean;
  deviceId: string;
  conflictResolution: 'local_wins' | 'remote_wins' | 'manual';
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime?: Date;
  syncProgress: number; // 0-100
  pendingChanges: number;
  conflictsCount: number;
}

export interface SyncConflict {
  id: string;
  type: 'workspace' | 'settings' | 'plugin_config';
  localValue: any;
  remoteValue: any;
  timestamp: Date;
  isResolved: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'mobile' | 'desktop';
  lastSeen: Date;
  isCurrentDevice: boolean;
}

export interface SyncSlice {
  // State
  config: SyncConfig;
  status: SyncStatus;
  conflicts: SyncConflict[];
  devices: DeviceInfo[];
  isLoading: boolean;
  error: string | null;
  
  // Config management
  initializeSync: () => Promise<void>;
  updateSyncConfig: (updates: Partial<SyncConfig>) => Promise<void>;
  setupProvider: (provider: SyncProvider, credentials: Record<string, any>) => Promise<void>;
  disconnectProvider: () => Promise<void>;
  
  // Sync operations
  syncNow: () => Promise<void>;
  enableAutoSync: () => void;
  disableAutoSync: () => void;
  
  // Conflict resolution
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => Promise<void>;
  resolveAllConflicts: (resolution: 'local' | 'remote') => Promise<void>;
  
  // Device management
  registerDevice: (deviceName: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
  
  // Encryption
  generateEncryptionKey: () => Promise<string>;
  rotateEncryptionKey: () => Promise<void>;
  
  // Utility functions
  getLastSyncTime: () => Date | null;
  hasConflicts: () => boolean;
  canSync: () => boolean;
}

// Mock sync service
class SyncService {
  static async uploadConfig(provider: SyncProvider, data: any): Promise<void> {
    // Mock upload
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`Uploaded config to ${provider}`);
  }
  
  static async downloadConfig(provider: SyncProvider): Promise<any> {
    // Mock download
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      workspaces: [],
      settings: {},
      timestamp: new Date().toISOString(),
    };
  }
  
  static async detectConflicts(local: any, remote: any): Promise<SyncConflict[]> {
    // Mock conflict detection
    if (Math.random() > 0.8) { // 20% chance of conflicts
      return [{
        id: `conflict_${Date.now()}`,
        type: 'settings',
        localValue: { theme: 'dark' },
        remoteValue: { theme: 'light' },
        timestamp: new Date(),
        isResolved: false,
      }];
    }
    return [];
  }
}\n\nexport const createSyncStore: StateCreator<\n  any,\n  [],\n  [],\n  SyncSlice\n> = (set, get) => ({\n  // Initial state\n  config: {\n    provider: 'local',\n    isEnabled: false,\n    autoSync: false,\n    syncInterval: 15,\n    encryptionEnabled: true,\n    deviceId: `device_${Date.now()}`,\n    conflictResolution: 'manual',\n  },\n  status: {\n    isOnline: true,\n    isSyncing: false,\n    syncProgress: 0,\n    pendingChanges: 0,\n    conflictsCount: 0,\n  },\n  conflicts: [],\n  devices: [],\n  isLoading: false,\n  error: null,\n  \n  initializeSync: async () => {\n    set((state: any) => {\n      state.isLoading = true;\n      state.error = null;\n    });\n    \n    try {\n      // Load sync config from secure storage\n      const storedConfig = await SecureStore.getItemAsync('flow_desk_sync_config');\n      if (storedConfig) {\n        const config = JSON.parse(storedConfig);\n        set((state: any) => {\n          state.config = { ...state.config, ...config };\n        });\n      }\n      \n      // Register current device\n      await get().registerDevice('My Mobile Device');\n      \n      set((state: any) => {\n        state.isLoading = false;\n      });\n    } catch (error) {\n      console.error('Sync initialization error:', error);\n      set((state: any) => {\n        state.isLoading = false;\n        state.error = error instanceof Error ? error.message : 'Sync initialization failed';\n      });\n    }\n  },\n  \n  updateSyncConfig: async (updates) => {\n    const newConfig = { ...get().config, ...updates };\n    \n    set((state: any) => {\n      state.config = newConfig;\n    });\n    \n    // Persist to secure storage\n    await SecureStore.setItemAsync('flow_desk_sync_config', JSON.stringify(newConfig));\n  },\n  \n  setupProvider: async (provider, credentials) => {\n    set((state: any) => {\n      state.isLoading = true;\n      state.error = null;\n    });\n    \n    try {\n      // Mock provider setup\n      await new Promise(resolve => setTimeout(resolve, 1000));\n      \n      // Store credentials securely\n      await SecureStore.setItemAsync(\n        `flow_desk_sync_${provider}_creds`,\n        JSON.stringify(credentials)\n      );\n      \n      await get().updateSyncConfig({\n        provider,\n        isEnabled: true,\n      });\n      \n      set((state: any) => {\n        state.isLoading = false;\n      });\n    } catch (error) {\n      console.error('Provider setup error:', error);\n      set((state: any) => {\n        state.isLoading = false;\n        state.error = error instanceof Error ? error.message : 'Provider setup failed';\n      });\n      throw error;\n    }\n  },\n  \n  disconnectProvider: async () => {\n    const currentProvider = get().config.provider;\n    \n    // Remove stored credentials\n    await SecureStore.deleteItemAsync(`flow_desk_sync_${currentProvider}_creds`);\n    \n    await get().updateSyncConfig({\n      provider: 'local',\n      isEnabled: false,\n      autoSync: false,\n    });\n  },\n  \n  syncNow: async () => {\n    const config = get().config;\n    if (!config.isEnabled || !get().status.isOnline) {\n      return;\n    }\n    \n    set((state: any) => {\n      state.status.isSyncing = true;\n      state.status.syncProgress = 0;\n      state.error = null;\n    });\n    \n    try {\n      // Simulate sync progress\n      const progressSteps = [20, 40, 60, 80, 100];\n      for (const step of progressSteps) {\n        await new Promise(resolve => setTimeout(resolve, 200));\n        set((state: any) => {\n          state.status.syncProgress = step;\n        });\n      }\n      \n      // Mock sync operations\n      const localData = {\n        workspaces: get().workspaces || [],\n        settings: get().settings || {},\n      };\n      \n      // Upload local changes\n      await SyncService.uploadConfig(config.provider, localData);\n      \n      // Download remote changes\n      const remoteData = await SyncService.downloadConfig(config.provider);\n      \n      // Check for conflicts\n      const conflicts = await SyncService.detectConflicts(localData, remoteData);\n      \n      const now = new Date();\n      set((state: any) => {\n        state.status.isSyncing = false;\n        state.status.lastSyncTime = now;\n        state.config.lastSyncTime = now;\n        state.conflicts = [...state.conflicts, ...conflicts];\n        state.status.conflictsCount = state.conflicts.filter((c: SyncConflict) => !c.isResolved).length;\n        \n        // Apply remote changes if no conflicts\n        if (conflicts.length === 0) {\n          // This would merge remote data into local state\n          console.log('Applied remote changes');\n        }\n      });\n    } catch (error) {\n      console.error('Sync error:', error);\n      set((state: any) => {\n        state.status.isSyncing = false;\n        state.status.syncProgress = 0;\n        state.error = error instanceof Error ? error.message : 'Sync failed';\n        state.config.syncError = error instanceof Error ? error.message : 'Sync failed';\n      });\n    }\n  },\n  \n  enableAutoSync: () => {\n    get().updateSyncConfig({ autoSync: true });\n  },\n  \n  disableAutoSync: () => {\n    get().updateSyncConfig({ autoSync: false });\n  },\n  \n  resolveConflict: async (conflictId, resolution) => {\n    set((state: any) => {\n      const conflict = state.conflicts.find((c: SyncConflict) => c.id === conflictId);\n      if (conflict) {\n        conflict.isResolved = true;\n        \n        // Apply resolution\n        switch (resolution) {\n          case 'local':\n            // Keep local value\n            console.log('Keeping local value for conflict:', conflictId);\n            break;\n          case 'remote':\n            // Apply remote value\n            console.log('Applying remote value for conflict:', conflictId);\n            break;\n          case 'merge':\n            // Custom merge logic\n            console.log('Merging values for conflict:', conflictId);\n            break;\n        }\n        \n        state.status.conflictsCount = state.conflicts.filter((c: SyncConflict) => !c.isResolved).length;\n      }\n    });\n  },\n  \n  resolveAllConflicts: async (resolution) => {\n    const unresolvedConflicts = get().conflicts.filter(c => !c.isResolved);\n    \n    for (const conflict of unresolvedConflicts) {\n      await get().resolveConflict(conflict.id, resolution);\n    }\n  },\n  \n  registerDevice: async (deviceName) => {\n    const deviceId = get().config.deviceId;\n    const device: DeviceInfo = {\n      id: deviceId,\n      name: deviceName,\n      platform: 'mobile',\n      lastSeen: new Date(),\n      isCurrentDevice: true,\n    };\n    \n    set((state: any) => {\n      const existingIndex = state.devices.findIndex((d: DeviceInfo) => d.id === deviceId);\n      if (existingIndex >= 0) {\n        state.devices[existingIndex] = device;\n      } else {\n        state.devices.push(device);\n      }\n    });\n  },\n  \n  removeDevice: async (deviceId) => {\n    if (deviceId === get().config.deviceId) {\n      throw new Error('Cannot remove current device');\n    }\n    \n    set((state: any) => {\n      state.devices = state.devices.filter((d: DeviceInfo) => d.id !== deviceId);\n    });\n  },\n  \n  refreshDevices: async () => {\n    // Mock device refresh\n    await new Promise(resolve => setTimeout(resolve, 1000));\n    \n    const mockDevices: DeviceInfo[] = [\n      {\n        id: 'device_desktop_123',\n        name: 'MacBook Pro',\n        platform: 'desktop',\n        lastSeen: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago\n        isCurrentDevice: false,\n      },\n    ];\n    \n    set((state: any) => {\n      // Keep current device and add others\n      const currentDevice = state.devices.find((d: DeviceInfo) => d.isCurrentDevice);\n      state.devices = currentDevice ? [currentDevice, ...mockDevices] : mockDevices;\n    });\n  },\n  \n  generateEncryptionKey: async () => {\n    // Mock key generation\n    const key = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n    await SecureStore.setItemAsync('flow_desk_encryption_key', key);\n    return key;\n  },\n  \n  rotateEncryptionKey: async () => {\n    const newKey = await get().generateEncryptionKey();\n    console.log('Encryption key rotated');\n    \n    // Trigger re-encryption of synced data\n    if (get().config.isEnabled) {\n      await get().syncNow();\n    }\n  },\n  \n  // Utility functions\n  getLastSyncTime: () => {\n    return get().status.lastSyncTime || null;\n  },\n  \n  hasConflicts: () => {\n    return get().status.conflictsCount > 0;\n  },\n  \n  canSync: () => {\n    const config = get().config;\n    const status = get().status;\n    return config.isEnabled && status.isOnline && !status.isSyncing;\n  },\n});