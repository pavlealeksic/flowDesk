/**
 * Mobile Config Sync Service
 * 
 * Provides configuration synchronization functionality for the mobile app,
 * including device pairing, QR code scanning, real-time sync, and cloud storage integration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { EventEmitter } from 'events';
import { NetworkMonitor } from './networkMonitor';
import { generateSecureKey, encryptData, decryptData } from '../utils/crypto';

export interface MobileDeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile';
  platform: {
    os: string;
    version: string;
    model: string;
  };
}

export interface ConfigSyncState {
  initialized: boolean;
  syncing: boolean;
  autoSync: boolean;
  lastSync: Date | null;
  syncInterval: number;
  error: string | null;
  pairedDevices: PairedDevice[];
  transportStatus: TransportStatus[];
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile';
  platform: string;
  pairedAt: Date;
  lastSeen?: Date;
  trusted: boolean;
}

export interface TransportStatus {
  name: string;
  status: 'active' | 'connected' | 'available' | 'error' | 'disabled';
  description: string;
  lastSync?: Date;
}

export interface QRPairingData {
  deviceInfo: MobileDeviceInfo;
  publicKey: string;
  timestamp: number;
  version: string;
}

export interface SyncResult {
  success: boolean;
  changes?: number;
  conflicts?: any[];
  error?: string;
}

class ConfigSyncService extends EventEmitter {
  private initialized = false;
  private syncState: ConfigSyncState;
  private deviceInfo: MobileDeviceInfo | null = null;
  private syncInterval?: NodeJS.Timeout;
  private networkMonitor: NetworkMonitor;

  constructor() {
    super();
    
    this.networkMonitor = new NetworkMonitor();
    this.syncState = {
      initialized: false,
      syncing: false,
      autoSync: true,
      lastSync: null,
      syncInterval: 5, // minutes
      error: null,
      pairedDevices: [],
      transportStatus: [],
    };

    this.setupNetworkMonitoring();
  }

  /**
   * Initialize the config sync service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Generate device info
      this.deviceInfo = await this.generateDeviceInfo();
      
      // Load saved state
      await this.loadSavedState();
      
      // Initialize transport status
      await this.updateTransportStatus();
      
      this.initialized = true;
      this.syncState.initialized = true;
      
      // Start auto-sync if enabled
      if (this.syncState.autoSync) {
        this.startAutoSync();
      }
      
      this.emit('initialized');
      console.log('ConfigSyncService initialized');
      
    } catch (error) {
      console.error('Failed to initialize ConfigSyncService:', error);
      this.syncState.error = error instanceof Error ? error.message : 'Initialization failed';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Generate device pairing QR code data
   */
  async generatePairingQR(): Promise<string> {
    if (!this.deviceInfo) {
      throw new Error('ConfigSyncService not initialized');
    }

    try {
      const publicKey = await generateSecureKey();
      
      const pairingData: QRPairingData = {
        deviceInfo: this.deviceInfo,
        publicKey: publicKey,
        timestamp: Date.now(),
        version: '1.0',
      };

      // Store the pairing session
      await AsyncStorage.setItem(
        'config-sync:pairing-session',
        JSON.stringify({
          publicKey,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        })
      );

      return JSON.stringify(pairingData);
    } catch (error) {
      console.error('Failed to generate pairing QR:', error);
      throw error;
    }
  }

  /**
   * Scan and process pairing QR code
   */
  async processPairingQR(qrData: string): Promise<PairedDevice> {
    try {
      const pairingData: QRPairingData = JSON.parse(qrData);
      
      // Validate pairing data
      if (!pairingData.deviceInfo || !pairingData.publicKey) {
        throw new Error('Invalid QR code data');
      }

      // Check if pairing data is not expired (5 minutes)
      const age = Date.now() - pairingData.timestamp;
      if (age > 5 * 60 * 1000) {
        throw new Error('QR code has expired');
      }

      const pairedDevice: PairedDevice = {
        deviceId: pairingData.deviceInfo.deviceId,
        deviceName: pairingData.deviceInfo.deviceName,
        deviceType: pairingData.deviceInfo.deviceType,
        platform: `${pairingData.deviceInfo.platform.os} ${pairingData.deviceInfo.platform.version}`,
        pairedAt: new Date(),
        trusted: false, // Requires user confirmation
      };

      // Add to paired devices
      this.syncState.pairedDevices.push(pairedDevice);
      await this.savePairedDevices();
      
      this.emit('devicePaired', pairedDevice);
      
      return pairedDevice;
    } catch (error) {
      console.error('Failed to process pairing QR:', error);
      throw error;
    }
  }

  /**
   * Perform configuration sync
   */
  async performSync(): Promise<SyncResult> {
    if (this.syncState.syncing) {
      throw new Error('Sync already in progress');
    }

    this.syncState.syncing = true;
    this.emit('syncStarted');

    try {
      // Check network connectivity
      const isConnected = await this.networkMonitor.isConnected();
      if (!isConnected) {
        throw new Error('No network connectivity');
      }

      let totalChanges = 0;
      const conflicts: any[] = [];

      // Sync with cloud storage (if available)
      if (await this.isCloudStorageAvailable()) {
        const cloudResult = await this.syncWithCloudStorage();
        totalChanges += cloudResult.changes || 0;
        conflicts.push(...(cloudResult.conflicts || []));
      }

      // Sync with paired devices on LAN
      const lanResult = await this.syncWithPairedDevices();
      totalChanges += lanResult.changes || 0;
      conflicts.push(...(lanResult.conflicts || []));

      // Update last sync time
      this.syncState.lastSync = new Date();
      await AsyncStorage.setItem(
        'config-sync:last-sync',
        this.syncState.lastSync.toISOString()
      );

      const result: SyncResult = {
        success: true,
        changes: totalChanges,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };

      this.syncState.syncing = false;
      this.emit('syncCompleted', result);
      
      return result;
    } catch (error) {
      this.syncState.syncing = false;
      this.syncState.error = error instanceof Error ? error.message : 'Sync failed';
      
      const result: SyncResult = {
        success: false,
        error: this.syncState.error,
      };

      this.emit('syncFailed', result);
      return result;
    }
  }

  /**
   * Set auto-sync enabled/disabled
   */
  async setAutoSync(enabled: boolean): Promise<void> {
    this.syncState.autoSync = enabled;
    await AsyncStorage.setItem('config-sync:auto-sync', JSON.stringify(enabled));
    
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    
    this.emit('autoSyncChanged', enabled);
  }

  /**
   * Set sync interval in minutes
   */
  async setSyncInterval(minutes: number): Promise<void> {
    this.syncState.syncInterval = minutes;
    await AsyncStorage.setItem('config-sync:sync-interval', JSON.stringify(minutes));
    
    // Restart auto-sync with new interval
    if (this.syncState.autoSync) {
      this.stopAutoSync();
      this.startAutoSync();
    }
    
    this.emit('syncIntervalChanged', minutes);
  }

  /**
   * Get current sync state
   */
  getSyncState(): ConfigSyncState {
    return { ...this.syncState };
  }

  /**
   * Get detailed sync status for real-time monitoring
   */
  async getDetailedSyncStatus() {
    await this.updateTransportStatus();
    
    return {
      ...this.syncState,
      deviceInfo: this.deviceInfo,
      networkStatus: await this.networkMonitor.getNetworkInfo(),
      transportStatus: this.syncState.transportStatus,
    };
  }

  /**
   * Trust a paired device
   */
  async trustDevice(deviceId: string): Promise<void> {
    const device = this.syncState.pairedDevices.find(d => d.deviceId === deviceId);
    if (device) {
      device.trusted = true;
      await this.savePairedDevices();
      this.emit('deviceTrusted', device);
    }
  }

  /**
   * Remove a paired device
   */
  async removePairedDevice(deviceId: string): Promise<void> {
    this.syncState.pairedDevices = this.syncState.pairedDevices.filter(
      d => d.deviceId !== deviceId
    );
    await this.savePairedDevices();
    this.emit('deviceRemoved', deviceId);
  }

  /**
   * Export configuration
   */
  async exportConfig(): Promise<string> {
    try {
      // Get current configuration from various sources
      const config = await this.gatherCurrentConfig();
      
      // Encrypt the configuration
      const encryptedConfig = await encryptData(JSON.stringify(config));
      
      // Create export package
      const exportPackage = {
        version: '1.0',
        timestamp: Date.now(),
        deviceInfo: this.deviceInfo,
        config: encryptedConfig,
      };

      return JSON.stringify(exportPackage);
    } catch (error) {
      console.error('Failed to export config:', error);
      throw error;
    }
  }

  /**
   * Import configuration
   */
  async importConfig(configData: string): Promise<void> {
    try {
      const importPackage = JSON.parse(configData);
      
      // Validate import package
      if (!importPackage.config || !importPackage.version) {
        throw new Error('Invalid configuration file');
      }

      // Decrypt the configuration
      const decryptedConfig = await decryptData(importPackage.config);
      const config = JSON.parse(decryptedConfig);

      // Apply the configuration
      await this.applyImportedConfig(config);
      
      this.emit('configImported', config);
    } catch (error) {
      console.error('Failed to import config:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoSync();
    this.networkMonitor.cleanup();
    this.removeAllListeners();
  }

  // Private methods

  private async generateDeviceInfo(): Promise<MobileDeviceInfo> {
    const deviceId = await this.getOrCreateDeviceId();
    
    return {
      deviceId,
      deviceName: await this.getDeviceName(),
      deviceType: 'mobile',
      platform: {
        os: Platform.OS,
        version: Platform.Version.toString(),
        model: await this.getDeviceModel(),
      },
    };
  }

  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('config-sync:device-id');
    if (!deviceId) {
      deviceId = generateSecureKey();
      await AsyncStorage.setItem('config-sync:device-id', deviceId);
    }
    return deviceId;
  }

  private async getDeviceName(): Promise<string> {
    // Try to get device name from various sources
    const deviceName = await AsyncStorage.getItem('config-sync:device-name');
    if (deviceName) {
      return deviceName;
    }

    // Generate a default name
    const defaultName = `Flow Desk Mobile (${Platform.OS})`;
    await AsyncStorage.setItem('config-sync:device-name', defaultName);
    return defaultName;
  }

  private async getDeviceModel(): Promise<string> {
    try {
      // This would require a native module or library like react-native-device-info
      return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
    } catch {
      return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
    }
  }

  private async loadSavedState(): Promise<void> {
    try {
      // Load auto-sync setting
      const autoSync = await AsyncStorage.getItem('config-sync:auto-sync');
      if (autoSync !== null) {
        this.syncState.autoSync = JSON.parse(autoSync);
      }

      // Load sync interval
      const syncInterval = await AsyncStorage.getItem('config-sync:sync-interval');
      if (syncInterval !== null) {
        this.syncState.syncInterval = JSON.parse(syncInterval);
      }

      // Load last sync time
      const lastSync = await AsyncStorage.getItem('config-sync:last-sync');
      if (lastSync) {
        this.syncState.lastSync = new Date(lastSync);
      }

      // Load paired devices
      await this.loadPairedDevices();
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }
  }

  private async loadPairedDevices(): Promise<void> {
    try {
      const pairedDevicesJson = await AsyncStorage.getItem('config-sync:paired-devices');
      if (pairedDevicesJson) {
        this.syncState.pairedDevices = JSON.parse(pairedDevicesJson);
      }
    } catch (error) {
      console.error('Failed to load paired devices:', error);
    }
  }

  private async savePairedDevices(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'config-sync:paired-devices',
        JSON.stringify(this.syncState.pairedDevices)
      );
    } catch (error) {
      console.error('Failed to save paired devices:', error);
    }
  }

  private async updateTransportStatus(): Promise<void> {
    const status: TransportStatus[] = [
      {
        name: 'Local Storage',
        status: 'active',
        description: 'Configuration stored locally on device',
      },
      {
        name: 'Cloud Storage',
        status: (await this.isCloudStorageAvailable()) ? 'connected' : 'disabled',
        description: 'iCloud (iOS) or Google Drive (Android) sync',
        lastSync: this.syncState.lastSync || undefined,
      },
      {
        name: 'LAN Sync',
        status: this.syncState.pairedDevices.length > 0 ? 'available' : 'disabled',
        description: 'Sync with paired devices on local network',
      },
      {
        name: 'Import/Export',
        status: 'available',
        description: 'Manual configuration import/export',
      },
    ];

    this.syncState.transportStatus = status;
  }

  private async isCloudStorageAvailable(): Promise<boolean> {
    // Check if cloud storage is available and authorized
    // This would need platform-specific implementation
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  private async syncWithCloudStorage(): Promise<SyncResult> {
    // Implement cloud storage sync
    // This would use iCloud Drive on iOS or Google Drive on Android
    return { success: true, changes: 0 };
  }

  private async syncWithPairedDevices(): Promise<SyncResult> {
    // Implement LAN sync with paired devices
    const trustedDevices = this.syncState.pairedDevices.filter(d => d.trusted);
    
    if (trustedDevices.length === 0) {
      return { success: true, changes: 0 };
    }

    // Try to connect to each trusted device and sync
    let totalChanges = 0;
    const conflicts: any[] = [];

    for (const device of trustedDevices) {
      try {
        // Implement device-to-device sync
        // This would use WebRTC or similar for direct communication
        const result = await this.syncWithDevice(device);
        totalChanges += result.changes || 0;
        conflicts.push(...(result.conflicts || []));
        
        // Update last seen
        device.lastSeen = new Date();
      } catch (error) {
        console.warn(`Failed to sync with device ${device.deviceName}:`, error);
      }
    }

    await this.savePairedDevices();
    
    return { success: true, changes: totalChanges, conflicts };
  }

  private async syncWithDevice(device: PairedDevice): Promise<SyncResult> {
    // Placeholder for device-to-device sync implementation
    return { success: true, changes: 0 };
  }

  private async gatherCurrentConfig(): Promise<any> {
    // Gather configuration from all app services
    const config = {
      version: '1.0',
      timestamp: Date.now(),
      workspace: await this.getWorkspaceConfig(),
      plugins: await this.getPluginConfigs(),
      preferences: await this.getUserPreferences(),
      accounts: await this.getAccountConfigs(),
    };

    return config;
  }

  private async getWorkspaceConfig(): Promise<any> {
    // Get workspace configuration
    return {};
  }

  private async getPluginConfigs(): Promise<any> {
    // Get plugin configurations
    return {};
  }

  private async getUserPreferences(): Promise<any> {
    // Get user preferences
    return {};
  }

  private async getAccountConfigs(): Promise<any> {
    // Get account configurations (excluding sensitive data)
    return {};
  }

  private async applyImportedConfig(config: any): Promise<void> {
    // Apply imported configuration to the app
    if (config.workspace) {
      await this.applyWorkspaceConfig(config.workspace);
    }
    
    if (config.plugins) {
      await this.applyPluginConfigs(config.plugins);
    }
    
    if (config.preferences) {
      await this.applyUserPreferences(config.preferences);
    }
  }

  private async applyWorkspaceConfig(config: any): Promise<void> {
    // Apply workspace configuration
  }

  private async applyPluginConfigs(configs: any): Promise<void> {
    // Apply plugin configurations
  }

  private async applyUserPreferences(preferences: any): Promise<void> {
    // Apply user preferences
  }

  private startAutoSync(): void {
    this.stopAutoSync();
    
    const intervalMs = this.syncState.syncInterval * 60 * 1000;
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, intervalMs);
  }

  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  private setupNetworkMonitoring(): void {
    this.networkMonitor.on('connected', () => {
      this.syncState.error = null;
      if (this.syncState.autoSync) {
        // Trigger sync when network becomes available
        setTimeout(() => this.performSync().catch(console.error), 1000);
      }
    });

    this.networkMonitor.on('disconnected', () => {
      this.syncState.error = 'No network connectivity';
    });
  }
}

// Singleton instance
export const configSyncService = new ConfigSyncService();
export default configSyncService;