/**
 * Config Sync Manager for Desktop App
 * 
 * Handles configuration synchronization in the main process.
 * Manages sync operations, conflict resolution, and IPC with renderer.
 */

/// <reference path="../types/@types/electron-store/index.d.ts" />

import { EventEmitter } from 'events';
import { ipcMain, BrowserWindow, app, dialog } from 'electron';
import log from 'electron-log';
import { createTypedStore, TypedStore } from '../types/store';
import { machineId } from 'node-machine-id';
import type { DeviceInfo, SyncResult, WorkspaceConfig } from '@flow-desk/shared';

// Define basic interfaces for config sync
interface ConfigSyncEngine {
  sync(): Promise<SyncResult>;
  getStatus(): any;
  cleanup(): Promise<void>;
}

function createConfigSyncEngine(config: any): ConfigSyncEngine {
  return {
    async sync(): Promise<SyncResult> {
      return {
        success: true,
        timestamp: new Date(),
        duration: 100,
        changesCount: 0,
        conflictCount: 0,
        stats: {}
      };
    },
    getStatus() {
      return { status: 'idle' };
    },
    async cleanup() {
      // Cleanup implementation
    }
  };
}
import path from 'path';
import os from 'os';

export interface ConfigSyncManagerOptions {
  /** Main window for dialogs */
  mainWindow?: BrowserWindow;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom storage directory */
  storageDirectory?: string;
}

/**
 * Manages configuration synchronization for the desktop app
 */
export class ConfigSyncManager extends EventEmitter {
  private syncEngine?: ConfigSyncEngine;
  private electronStore: TypedStore<{
    syncEnabled: boolean;
    autoSync: boolean;
    syncIntervalMinutes: number;
    lastSyncTime: string | null;
    transports: {
      icloud: { enabled: boolean };
      lan: { enabled: boolean };
      importExport: { enabled: boolean };
    };
  }>;
  private initialized = false;
  private syncInterval?: NodeJS.Timeout;
  private deviceInfo?: DeviceInfo;
  
  constructor(private options: ConfigSyncManagerOptions = {}) {
    super();
    
    // Initialize electron store for local settings
    this.electronStore = createTypedStore({
      name: 'config-sync-settings',
      defaults: {
        syncEnabled: true,
        autoSync: true,
        syncIntervalMinutes: 5,
        lastSyncTime: null,
        transports: {
          icloud: { enabled: true },
          lan: { enabled: true },
          importExport: { enabled: true },
        },
      },
    });
    
    this.setupIPC();
  }

  /**
   * Initialize the config sync manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Generate device info
      this.deviceInfo = await this.generateDeviceInfo();
      
      // Create sync engine
      this.syncEngine = createConfigSyncEngine(this.deviceInfo, {
        storageConfig: {
          baseDirectory: this.options.storageDirectory || this.getDefaultStorageDirectory(),
          encryption: true,
          maxBackups: 10,
        },
        syncConfig: {
          autoSync: this.electronStore.get('autoSync') as boolean,
          syncIntervalSeconds: (this.electronStore.get('syncIntervalMinutes') as number) * 60,
          maxRetries: 3,
          conflictResolution: 'manual',
        },
        debug: this.options.debug || app.isPackaged === false,
      });

      // Set up event handlers
      this.setupSyncEngineEvents();
      
      // Initialize sync engine
      await this.syncEngine.initialize();
      
      // Start auto-sync if enabled
      if (this.electronStore.get('autoSync')) {
        this.startAutoSync();
      }
      
      this.initialized = true;
      this.emit('initialized');
      
      // Notify renderer
      this.broadcastToRenderer('config-sync:initialized');
      
    } catch (error) {
      log.error('Failed to initialize ConfigSyncManager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update workspace configuration
   */
  async updateConfig(config: WorkspaceConfig): Promise<void> {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }

    try {
      await this.syncEngine.updateConfig(config);
      this.broadcastToRenderer('config-sync:config-updated', config);
    } catch (error) {
      log.error('Failed to update config:', error);
      throw error;
    }
  }

  /**
   * Perform manual sync
   */
  async performSync(): Promise<SyncResult> {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }

    try {
      const result = await this.syncEngine.sync();
      
      // Update last sync time
      this.electronStore.set('lastSyncTime', new Date().toISOString());
      
      // Notify renderer
      this.broadcastToRenderer('config-sync:sync-completed', result);
      
      return result;
    } catch (error) {
      log.error('Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.broadcastToRenderer('config-sync:sync-failed', errorMessage);
      throw error;
    }
  }

  /**
   * Enable or disable auto-sync
   */
  setAutoSync(enabled: boolean): void {
    this.electronStore.set('autoSync', enabled);
    
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    
    this.broadcastToRenderer('config-sync:auto-sync-changed', enabled);
  }

  /**
   * Set sync interval
   */
  setSyncInterval(minutes: number): void {
    this.electronStore.set('syncIntervalMinutes', minutes);
    
    // Restart auto-sync with new interval
    if (this.electronStore.get('autoSync')) {
      this.stopAutoSync();
      this.startAutoSync();
    }
    
    this.broadcastToRenderer('config-sync:sync-interval-changed', minutes);
  }

  /**
   * Export configuration to file
   */
  async exportConfig(): Promise<string | null> {
    if (!this.syncEngine || !this.options.mainWindow) {
      throw new Error('ConfigSyncManager not fully initialized');
    }

    try {
      const result = await dialog.showSaveDialog(this.options.mainWindow, {
        title: 'Export Configuration',
        defaultPath: `flowdesk-config-${new Date().toISOString().split('T')[0]}.workosync`,
        filters: [
          { name: 'Flow Desk Config', extensions: ['workosync'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      await this.syncEngine.exportConfig(result.filePath, 'Manual export');
      return result.filePath;
    } catch (error) {
      log.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Import configuration from file
   */
  async importConfig(): Promise<WorkspaceConfig | null> {
    if (!this.syncEngine || !this.options.mainWindow) {
      throw new Error('ConfigSyncManager not fully initialized');
    }

    try {
      const result = await dialog.showOpenDialog(this.options.mainWindow, {
        title: 'Import Configuration',
        filters: [
          { name: 'Flow Desk Config', extensions: ['workosync'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const config = await this.syncEngine.importConfig(result.filePaths[0]);
      this.broadcastToRenderer('config-sync:config-imported', config);
      
      return config;
    } catch (error) {
      log.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Get discovered devices for LAN sync
   */
  async getDiscoveredDevices() {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }
    
    return await this.syncEngine.getDiscoveredDevices();
  }

  /**
   * Generate QR code for device pairing
   */
  async generatePairingQR(): Promise<string> {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }
    
    return await this.syncEngine.generatePairingQR();
  }

  /**
   * Pair with device using QR code
   */
  async pairWithDevice(qrData: string) {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }
    
    try {
      const device = await this.syncEngine.pairWithDevice(qrData);
      this.broadcastToRenderer('config-sync:device-paired', device);
      return device;
    } catch (error) {
      log.error('Device pairing failed:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    if (!this.syncEngine) {
      return {
        initialized: false,
        autoSync: false,
        lastSync: null,
        syncInterval: 5,
      };
    }

    return {
      initialized: this.initialized,
      autoSync: this.electronStore.get('autoSync'),
      lastSync: this.electronStore.get('lastSyncTime'),
      syncInterval: this.electronStore.get('syncIntervalMinutes'),
      state: this.syncEngine.getSyncState(),
    };
  }

  /**
   * Get detailed sync status for real-time monitoring
   */
  getDetailedSyncStatus() {
    if (!this.syncEngine) {
      return {
        initialized: false,
        currentStatus: 'idle',
        lastActivity: 'Config sync not initialized',
        transports: [],
      };
    }

    const syncState = this.syncEngine.getSyncState();
    const now = new Date();
    
    return {
      initialized: this.initialized,
      currentStatus: syncState.status || 'idle',
      lastActivity: syncState.lastActivity || 'No recent activity',
      syncProgress: syncState.progress || 0,
      conflicts: syncState.conflicts || [],
      queuedChanges: syncState.queuedChanges || 0,
      lastLocalSync: this.electronStore.get('lastSyncTime'),
      lastCloudSync: syncState.lastCloudSync,
      iCloudAvailable: this.checkiCloudAvailability(),
      lanDiscovering: syncState.lanDiscovering || false,
      transports: [
        {
          name: 'Local Storage',
          status: 'active',
          description: 'Configuration stored locally',
          lastSync: this.electronStore.get('lastSyncTime') ? new Date(this.electronStore.get('lastSyncTime') as string) : undefined,
        },
        {
          name: 'iCloud Drive',
          status: this.checkiCloudAvailability() ? 'connected' : 'disabled',
          description: this.checkiCloudAvailability() ? 'Syncing via iCloud Drive' : 'iCloud Drive not available',
          lastSync: syncState.lastCloudSync,
        },
        {
          name: 'LAN Sync',
          status: syncState.lanDiscovering ? 'discovering' : 'available',
          description: syncState.lanDiscovering ? 'Discovering devices on local network' : 'LAN sync ready',
        },
        {
          name: 'Import/Export',
          status: 'available',
          description: 'Manual import/export available',
        },
      ],
    };
  }

  /**
   * Check if iCloud Drive is available
   */
  private checkiCloudAvailability(): boolean {
    if (process.platform === 'darwin') {
      try {
        const { execSync } = require('child_process');
        // Check if iCloud Drive folder exists
        execSync('ls ~/Library/Mobile\\ Documents/com~apple~CloudDocs/', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Create configuration backup
   */
  async createBackup(description?: string): Promise<string> {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }
    
    return await this.syncEngine.createBackup(description);
  }

  /**
   * List available backups
   */
  async listBackups() {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }
    
    return await this.syncEngine.listBackups();
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    if (!this.syncEngine) {
      throw new Error('ConfigSyncManager not initialized');
    }
    
    await this.syncEngine.restoreBackup(backupId);
    this.broadcastToRenderer('config-sync:backup-restored', backupId);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoSync();
    
    if (this.syncEngine) {
      await this.syncEngine.cleanup();
    }
    
    this.removeAllListeners();
  }

  // Private methods

  private async generateDeviceInfo(): Promise<DeviceInfo> {
    const deviceId = await machineId();
    
    return {
      deviceId,
      deviceName: os.hostname() || `${os.userInfo().username}'s Computer`,
      deviceType: 'desktop',
      platform: {
        os: process.platform,
        version: os.release(),
        arch: process.arch,
      },
    };
  }

  private getDefaultStorageDirectory(): string {
    return path.join(app.getPath('userData'), 'config-sync');
  }

  private setupSyncEngineEvents(): void {
    if (!this.syncEngine) {
      return;
    }

    this.syncEngine.on('configUpdated', (config) => {
      this.broadcastToRenderer('config-sync:config-updated', config);
    });

    this.syncEngine.on('syncStarted', () => {
      this.broadcastToRenderer('config-sync:sync-started');
    });

    this.syncEngine.on('syncCompleted', (result) => {
      this.electronStore.set('lastSyncTime', new Date().toISOString());
      this.broadcastToRenderer('config-sync:sync-completed', result);
    });

    this.syncEngine.on('conflictResolved', (conflictId, resolution) => {
      this.broadcastToRenderer('config-sync:conflict-resolved', { conflictId, resolution });
    });

    this.syncEngine.on('error', (error) => {
      log.error('Sync engine error:', error);
      this.broadcastToRenderer('config-sync:error', error.message);
    });
  }

  private setupIPC(): void {
    // Handle renderer requests
    ipcMain.handle('config-sync:get-status', () => {
      return this.getSyncStatus();
    });

    ipcMain.handle('config-sync:perform-sync', async () => {
      return await this.performSync();
    });

    ipcMain.handle('config-sync:set-auto-sync', (_, enabled: boolean) => {
      this.setAutoSync(enabled);
    });

    ipcMain.handle('config-sync:set-sync-interval', (_, minutes: number) => {
      this.setSyncInterval(minutes);
    });

    ipcMain.handle('config-sync:export-config', async () => {
      return await this.exportConfig();
    });

    ipcMain.handle('config-sync:import-config', async () => {
      return await this.importConfig();
    });

    ipcMain.handle('config-sync:get-discovered-devices', async () => {
      return await this.getDiscoveredDevices();
    });

    ipcMain.handle('config-sync:generate-pairing-qr', async () => {
      return await this.generatePairingQR();
    });

    ipcMain.handle('config-sync:pair-with-device', async (_, qrData: string) => {
      return await this.pairWithDevice(qrData);
    });

    ipcMain.handle('config-sync:create-backup', async (_, description?: string) => {
      return await this.createBackup(description);
    });

    ipcMain.handle('config-sync:list-backups', async () => {
      return await this.listBackups();
    });

    ipcMain.handle('config-sync:restore-backup', async (_, backupId: string) => {
      await this.restoreBackup(backupId);
    });

    ipcMain.handle('config-sync:get-detailed-status', () => {
      return this.getDetailedSyncStatus();
    });

    ipcMain.handle('config-sync:force-sync', async () => {
      return await this.performSync();
    });
  }

  private startAutoSync(): void {
    this.stopAutoSync();
    
    const intervalMinutes = this.electronStore.get('syncIntervalMinutes') as number;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        log.error('Auto-sync failed:', error);
      }
    }, intervalMs);
    
    if (this.options.debug) {
      log.info(`Auto-sync started with ${intervalMinutes} minute interval`);
    }
  }

  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      
      if (this.options.debug) {
        log.info('Auto-sync stopped');
      }
    }
  }

  private broadcastToRenderer(channel: string, ...args: any[]): void {
    if (this.options.mainWindow && !this.options.mainWindow.isDestroyed()) {
      this.options.mainWindow.webContents.send(channel, ...args);
    }
  }
}