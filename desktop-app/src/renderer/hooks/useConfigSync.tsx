/**
 * React hook for config sync functionality
 * 
 * Provides React integration with the config sync system,
 * handling state management and IPC communication with main process.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import type { WorkspaceConfig } from '@flow-desk/shared/types';
import type { ConfigSyncConflict, ConfigSyncDevice, ConfigBackup } from '../types/preload';

interface ConfigSyncState {
  initialized: boolean;
  syncing: boolean;
  autoSync: boolean;
  lastSync: Date | null;
  syncInterval: number;
  error: string | null;
  conflicts: ConfigSyncConflict[];
  discoveredDevices: ConfigSyncDevice[];
}

interface ConfigSyncActions {
  performSync: () => Promise<void>;
  setAutoSync: (enabled: boolean) => Promise<void>;
  setSyncInterval: (minutes: number) => Promise<void>;
  exportConfig: () => Promise<string | null>;
  importConfig: () => Promise<WorkspaceConfig | null>;
  generatePairingQR: () => Promise<string>;
  pairWithDevice: (qrData: string) => Promise<{ success: boolean; error?: string }>;
  createBackup: (description?: string) => Promise<string>;
  listBackups: () => Promise<ConfigBackup[]>;
  restoreBackup: (backupId: string) => Promise<void>;
  refreshDiscoveredDevices: () => Promise<void>;
}

export interface UseConfigSyncResult {
  state: ConfigSyncState;
  actions: ConfigSyncActions;
}

/**
 * React hook for config sync functionality
 */
export function useConfigSync(): UseConfigSyncResult {
  const dispatch = useAppDispatch();
  
  const [state, setState] = useState<ConfigSyncState>({
    initialized: false,
    syncing: false,
    autoSync: true,
    lastSync: null,
    syncInterval: 5,
    error: null,
    conflicts: [],
    discoveredDevices: [],
  });

  // Load initial sync status
  useEffect(() => {
    const loadSyncStatus = async () => {
      try {
        const status = await window.electronAPI.invoke('config-sync:get-status');
        setState(prev => ({
          ...prev,
          initialized: status.initialized,
          autoSync: status.autoSync,
          lastSync: status.lastSync ? new Date(status.lastSync) : null,
          syncInterval: status.syncInterval,
        }));
      } catch (error) {
        console.error('Failed to load sync status:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    loadSyncStatus();
  }, []);

  // Set up IPC event listeners
  useEffect(() => {
    const handleSyncStarted = () => {
      setState(prev => ({ ...prev, syncing: true, error: null }));
    };

    const handleSyncCompleted = (result: any) => {
      setState(prev => ({
        ...prev,
        syncing: false,
        lastSync: new Date(),
        error: result.success ? null : result.error,
      }));
    };

    const handleSyncFailed = (error: string) => {
      setState(prev => ({
        ...prev,
        syncing: false,
        error,
      }));
    };

    const handleAutoSyncChanged = (enabled: boolean) => {
      setState(prev => ({ ...prev, autoSync: enabled }));
    };

    const handleSyncIntervalChanged = (minutes: number) => {
      setState(prev => ({ ...prev, syncInterval: minutes }));
    };

    const handleConfigUpdated = (config: WorkspaceConfig) => {
      // Update Redux store with new config
      // This would integrate with your existing workspace slice
      dispatch({ type: 'workspace/configUpdated', payload: config });
    };

    const handleConfigImported = (config: WorkspaceConfig) => {
      dispatch({ type: 'workspace/configImported', payload: config });
    };

    const handleDevicePaired = (device: any) => {
      setState(prev => ({
        ...prev,
        discoveredDevices: [...prev.discoveredDevices, device],
      }));
    };

    const handleError = (error: string) => {
      setState(prev => ({ ...prev, error }));
    };

    // Register event listeners
    window.electronAPI.on('config-sync:sync-started', handleSyncStarted);
    window.electronAPI.on('config-sync:sync-completed', handleSyncCompleted);
    window.electronAPI.on('config-sync:sync-failed', handleSyncFailed);
    window.electronAPI.on('config-sync:auto-sync-changed', handleAutoSyncChanged);
    window.electronAPI.on('config-sync:sync-interval-changed', handleSyncIntervalChanged);
    window.electronAPI.on('config-sync:config-updated', handleConfigUpdated);
    window.electronAPI.on('config-sync:config-imported', handleConfigImported);
    window.electronAPI.on('config-sync:device-paired', handleDevicePaired);
    window.electronAPI.on('config-sync:error', handleError);

    // Cleanup listeners
    return () => {
      window.electronAPI.removeAllListeners('config-sync:sync-started');
      window.electronAPI.removeAllListeners('config-sync:sync-completed');
      window.electronAPI.removeAllListeners('config-sync:sync-failed');
      window.electronAPI.removeAllListeners('config-sync:auto-sync-changed');
      window.electronAPI.removeAllListeners('config-sync:sync-interval-changed');
      window.electronAPI.removeAllListeners('config-sync:config-updated');
      window.electronAPI.removeAllListeners('config-sync:config-imported');
      window.electronAPI.removeAllListeners('config-sync:device-paired');
      window.electronAPI.removeAllListeners('config-sync:error');
    };
  }, [dispatch]);

  // Actions
  const performSync = useCallback(async () => {
    try {
      await window.electronAPI.invoke('config-sync:perform-sync');
    } catch (error) {
      console.error('Sync failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, []);

  const setAutoSync = useCallback(async (enabled: boolean) => {
    try {
      await window.electronAPI.invoke('config-sync:set-auto-sync', enabled);
    } catch (error) {
      console.error('Failed to set auto-sync:', error);
    }
  }, []);

  const setSyncInterval = useCallback(async (minutes: number) => {
    try {
      await window.electronAPI.invoke('config-sync:set-sync-interval', minutes);
    } catch (error) {
      console.error('Failed to set sync interval:', error);
    }
  }, []);

  const exportConfig = useCallback(async (): Promise<string | null> => {
    try {
      return await window.electronAPI.invoke('config-sync:export-config');
    } catch (error) {
      console.error('Export failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Export failed',
      }));
      return null;
    }
  }, []);

  const importConfig = useCallback(async (): Promise<WorkspaceConfig | null> => {
    try {
      return await window.electronAPI.invoke('config-sync:import-config');
    } catch (error) {
      console.error('Import failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Import failed',
      }));
      return null;
    }
  }, []);

  const generatePairingQR = useCallback(async (): Promise<string> => {
    try {
      return await window.electronAPI.invoke('config-sync:generate-pairing-qr');
    } catch (error) {
      console.error('Failed to generate pairing QR:', error);
      throw error;
    }
  }, []);

  const pairWithDevice = useCallback(async (qrData: string) => {
    try {
      return await window.electronAPI.invoke('config-sync:pair-with-device', qrData);
    } catch (error) {
      console.error('Device pairing failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Pairing failed',
      }));
      throw error;
    }
  }, []);

  const createBackup = useCallback(async (description?: string): Promise<string> => {
    try {
      return await window.electronAPI.invoke('config-sync:create-backup', description);
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }, []);

  const listBackups = useCallback(async () => {
    try {
      return await window.electronAPI.invoke('config-sync:list-backups');
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }, []);

  const restoreBackup = useCallback(async (backupId: string) => {
    try {
      await window.electronAPI.invoke('config-sync:restore-backup', backupId);
    } catch (error) {
      console.error('Backup restore failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Restore failed',
      }));
      throw error;
    }
  }, []);

  const refreshDiscoveredDevices = useCallback(async () => {
    try {
      const devices = await window.electronAPI.invoke('config-sync:get-discovered-devices');
      setState(prev => ({ ...prev, discoveredDevices: devices }));
    } catch (error) {
      console.error('Failed to refresh discovered devices:', error);
    }
  }, []);

  return {
    state,
    actions: {
      performSync,
      setAutoSync,
      setSyncInterval,
      exportConfig,
      importConfig,
      generatePairingQR,
      pairWithDevice,
      createBackup,
      listBackups,
      restoreBackup,
      refreshDiscoveredDevices,
    },
  };
}

/**
 * Hook for accessing config sync status only (no actions)
 */
export function useConfigSyncStatus() {
  const { state } = useConfigSync();
  return state;
}