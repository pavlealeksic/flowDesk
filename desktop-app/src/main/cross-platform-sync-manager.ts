/**
 * Desktop Cross-Platform Sync Manager
 * 
 * Manages cross-platform synchronization of workspace settings,
 * plugin configurations, and preferences for the desktop application.
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import { machineId } from 'node-machine-id';
import { CrossPlatformSyncCoordinator, SyncCoordinatorConfig } from '@flow-desk/shared/sync/CrossPlatformSyncCoordinator';
import { DeviceInfo, BaseSyncTransport } from '@flow-desk/shared/types';
import { CloudStorageTransport } from './transports/CloudStorageTransport';
import { LANSyncTransport } from './transports/LANSyncTransport';
import { ImportExportTransport } from './transports/ImportExportTransport';
import Store from 'electron-store';
import os from 'os';

export class DesktopCrossPlatformSyncManager {
  private syncCoordinator: CrossPlatformSyncCoordinator | null = null;
  private electronStore: any; // Store
  private mainWindow: BrowserWindow | null = null;
  private initialized = false;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null;
    
    this.electronStore = new Store({
      name: 'cross-platform-sync-config',
      defaults: {
        autoSync: true,
        syncInterval: 300000, // 5 minutes
        conflictResolution: 'manual',
        enabledTransports: ['icloud', 'lan', 'import-export'],
        lastSyncTime: null,
      },
    });

    this.setupIPC();
  }

  /**
   * Initialize the cross-platform sync manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const deviceInfo = await this.generateDeviceInfo();
      const transports = await this.setupTransports();
      
      const config: SyncCoordinatorConfig = {
        deviceInfo,
        transports,
        syncInterval: this.electronStore.get('syncInterval') as number,
        autoSync: this.electronStore.get('autoSync') as boolean,
        conflictResolution: this.electronStore.get('conflictResolution') as any,
        retryAttempts: 3,
        retryDelay: 5000,
      };

      this.syncCoordinator = new CrossPlatformSyncCoordinator(config);
      this.setupSyncEventListeners();
      
      await this.syncCoordinator.initialize();
      
      this.initialized = true;
      this.broadcastToRenderer('cross-platform-sync:initialized');
      
    } catch (error) {
      console.error('Failed to initialize cross-platform sync manager:', error);
      throw error;
    }
  }

  /**
   * Perform a full cross-platform synchronization
   */
  async performFullSync(): Promise<any> {
    if (!this.syncCoordinator) {
      throw new Error('Sync coordinator not initialized');
    }

    try {
      const result = await this.syncCoordinator.performFullSync();
      
      // Update last sync time
      this.electronStore.set('lastSyncTime', new Date().toISOString());
      
      return result;
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync workspace settings
   */
  async syncWorkspaceSettings(workspaceId?: string): Promise<any> {
    if (!this.syncCoordinator) {
      throw new Error('Sync coordinator not initialized');
    }

    return await this.syncCoordinator.syncWorkspaceSettings(workspaceId);
  }

  /**
   * Sync plugin configurations
   */
  async syncPluginConfigurations(pluginIds?: string[]): Promise<any> {
    if (!this.syncCoordinator) {
      throw new Error('Sync coordinator not initialized');
    }

    return await this.syncCoordinator.syncPluginConfigurations(pluginIds);
  }

  /**
   * Sync user preferences
   */
  async syncUserPreferences(): Promise<any> {
    if (!this.syncCoordinator) {
      throw new Error('Sync coordinator not initialized');
    }

    return await this.syncCoordinator.syncUserPreferences();
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(updates: any): Promise<void> {
    if (!this.syncCoordinator) {
      throw new Error('Sync coordinator not initialized');
    }

    // Update electron store
    for (const [key, value] of Object.entries(updates)) {
      this.electronStore.set(key, value);
    }

    // Update sync coordinator
    await this.syncCoordinator.updateSyncConfig(updates);
    
    this.broadcastToRenderer('cross-platform-sync:config-updated', updates);
  }

  /**
   * Get sync status
   */
  getSyncStatus(): any {
    if (!this.syncCoordinator) {
      return {
        initialized: false,
        state: 'not_initialized',
      };
    }

    return {
      ...this.syncCoordinator.getStatus(),
      initialized: this.initialized,
      lastSyncTime: this.electronStore.get('lastSyncTime'),
    };
  }

  /**
   * Get sync history
   */
  getSyncHistory(limit?: number): any[] {
    if (!this.syncCoordinator) {
      return [];
    }

    return this.syncCoordinator.getSyncHistory(limit);
  }

  /**
   * Resolve conflicts
   */
  async resolveConflicts(resolutions: any[]): Promise<void> {
    if (!this.syncCoordinator) {
      throw new Error('Sync coordinator not initialized');
    }

    await this.syncCoordinator.resolveConflicts(resolutions);
  }

  /**
   * Handle configuration changes from the application
   */
  async onConfigurationChanged(changeType: 'workspace' | 'plugin' | 'preferences', data: any): Promise<void> {
    if (this.syncCoordinator) {
      await this.syncCoordinator.onConfigurationChanged(changeType, data);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.syncCoordinator) {
      await this.syncCoordinator.cleanup();
    }
  }

  // Private methods

  private async generateDeviceInfo(): Promise<DeviceInfo> {
    const deviceId = await machineId();
    
    return {
      deviceId,
      fingerprint: await this.generateDeviceFingerprint(),
      name: os.hostname() || `${os.userInfo().username}'s Desktop`,
      type: 'desktop',
      os: process.platform,
      osVersion: os.release(),
      browser: 'Electron',
      browserVersion: process.versions.electron || '0.0.0',
      trustLevel: 'trusted',
      lastSeenAt: new Date(),
    };
  }

  private async generateDeviceFingerprint(): Promise<string> {
    const machineId = require('node-machine-id').machineId;
    const deviceId = await machineId();
    const osInfo = `${process.platform}-${os.release()}-${process.arch}`;
    return `${deviceId}-${Buffer.from(osInfo).toString('base64')}`;
  }

  private async setupTransports(): Promise<BaseSyncTransport[]> {
    const transports: BaseSyncTransport[] = [];
    const enabledTransports = this.electronStore.get('enabledTransports') as string[];

    if (enabledTransports.includes('icloud') && process.platform === 'darwin') {
      transports.push(new CloudStorageTransport('icloud'));
    }

    if (enabledTransports.includes('onedrive') && process.platform === 'win32') {
      transports.push(new CloudStorageTransport('onedrive'));
    }

    if (enabledTransports.includes('lan')) {
      transports.push(new LANSyncTransport());
    }

    if (enabledTransports.includes('import-export')) {
      transports.push(new ImportExportTransport());
    }

    return transports;
  }

  private setupSyncEventListeners(): void {
    if (!this.syncCoordinator) return;

    this.syncCoordinator.on('syncStarted', (data) => {
      this.broadcastToRenderer('cross-platform-sync:sync-started', data);
    });

    this.syncCoordinator.on('syncCompleted', (data) => {
      this.broadcastToRenderer('cross-platform-sync:sync-completed', data);
    });

    this.syncCoordinator.on('syncFailed', (data) => {
      this.broadcastToRenderer('cross-platform-sync:sync-failed', data);
    });

    this.syncCoordinator.on('conflictsDetected', (conflicts) => {
      this.broadcastToRenderer('cross-platform-sync:conflicts-detected', conflicts);
    });

    this.syncCoordinator.on('conflictResolved', (resolution) => {
      this.broadcastToRenderer('cross-platform-sync:conflict-resolved', resolution);
    });

    this.syncCoordinator.on('configurationUpdated', (config) => {
      this.broadcastToRenderer('cross-platform-sync:configuration-updated', config);
    });

    this.syncCoordinator.on('autoSyncStarted', (data) => {
      this.broadcastToRenderer('cross-platform-sync:auto-sync-started', data);
    });

    this.syncCoordinator.on('autoSyncStopped', () => {
      this.broadcastToRenderer('cross-platform-sync:auto-sync-stopped');
    });

    this.syncCoordinator.on('error', (error) => {
      this.broadcastToRenderer('cross-platform-sync:error', error);
    });
  }

  private setupIPC(): void {
    ipcMain.handle('cross-platform-sync:get-status', () => {
      return this.getSyncStatus();
    });

    ipcMain.handle('cross-platform-sync:perform-full-sync', async () => {
      return await this.performFullSync();
    });

    ipcMain.handle('cross-platform-sync:sync-workspace-settings', async (_, workspaceId?: string) => {
      return await this.syncWorkspaceSettings(workspaceId);
    });

    ipcMain.handle('cross-platform-sync:sync-plugin-configurations', async (_, pluginIds?: string[]) => {
      return await this.syncPluginConfigurations(pluginIds);
    });

    ipcMain.handle('cross-platform-sync:sync-user-preferences', async () => {
      return await this.syncUserPreferences();
    });

    ipcMain.handle('cross-platform-sync:update-config', async (_, updates: any) => {
      await this.updateSyncConfig(updates);
    });

    ipcMain.handle('cross-platform-sync:get-history', (_, limit?: number) => {
      return this.getSyncHistory(limit);
    });

    ipcMain.handle('cross-platform-sync:resolve-conflicts', async (_, resolutions: any[]) => {
      await this.resolveConflicts(resolutions);
    });

    // Handle configuration change notifications from renderer
    ipcMain.on('cross-platform-sync:config-changed', async (_, changeType, data) => {
      await this.onConfigurationChanged(changeType, data);
    });
  }

  private broadcastToRenderer(channel: string, ...args: any[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }
}