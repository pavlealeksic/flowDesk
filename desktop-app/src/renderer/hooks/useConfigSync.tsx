/**
 * React hook for config sync functionality
 * 
 * Provides React integration with the config sync system,
 * handling state management and IPC communication with main process.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import type { WorkspaceConfig } from '@flow-desk/shared/types';
import { useLogger } from '../logging/RendererLoggingService';
// Define types locally since not available in preload
interface ConfigSyncConflict {
  id: string;
  type: 'setting' | 'workspace' | 'account';
  localValue: any;
  remoteValue: any;
  timestamp: number;
}

interface ConfigSyncDevice {
  id: string;
  name: string;
  type: 'mobile' | 'desktop';
  platform: string;
  lastSync: Date;
  isOnline: boolean;
}

interface ConfigBackup {
  id: string;
  timestamp: number;
  size: number;
  description?: string;
}

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
  const logger = useLogger('useConfigSync');
  
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
        const status = await (window.flowDesk as any)?.invoke('config-sync:get-status') as {
          initialized: boolean;
          autoSync: boolean;
          lastSync: string | null;
          syncInterval: number;
        };
        setState(prev => ({
          ...prev,
          initialized: status.initialized,
          autoSync: status.autoSync,
          lastSync: status.lastSync ? new Date(status.lastSync) : null,
          syncInterval: status.syncInterval,
        }));
      } catch (error) {
        logger.error('Console error', undefined, { originalArgs: ['Failed to load sync status:', error], method: 'console.error' });
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

    const handleSyncFailed = (...args: unknown[]) => {
      const error = args[1] as string;
      setState(prev => ({
        ...prev,
        syncing: false,
        error,
      }));
    };

    const handleAutoSyncChanged = (...args: unknown[]) => {
      const enabled = args[1] as boolean;
      setState(prev => ({ ...prev, autoSync: enabled }));
    };

    const handleSyncIntervalChanged = (...args: unknown[]) => {
      const minutes = args[1] as number;
      setState(prev => ({ ...prev, syncInterval: minutes }));
    };

    const handleConfigUpdated = (...args: unknown[]) => {
      const config = args[1] as WorkspaceConfig;
      // Update Redux store with new config
      // This would integrate with your existing workspace slice
      dispatch({ type: 'workspace/configUpdated', payload: config });
    };

    const handleConfigImported = (...args: unknown[]) => {
      const config = args[1] as WorkspaceConfig;
      dispatch({ type: 'workspace/configImported', payload: config });
    };

    const handleDevicePaired = (...args: unknown[]) => {
      const device = args[1] as ConfigSyncDevice;
      setState(prev => ({
        ...prev,
        discoveredDevices: [...prev.discoveredDevices, device],
      }));
    };

    const handleError = (...args: unknown[]) => {
      const error = args[1] as string;
      setState(prev => ({ ...prev, error }));
    };

    // Register event listeners
    if (window.flowDesk) {
      (window.flowDesk as any).on('config-sync:sync-started', handleSyncStarted);
      (window.flowDesk as any).on('config-sync:sync-completed', handleSyncCompleted);
      (window.flowDesk as any).on('config-sync:sync-failed', handleSyncFailed);
      (window.flowDesk as any).on('config-sync:auto-sync-changed', handleAutoSyncChanged);
      (window.flowDesk as any).on('config-sync:sync-interval-changed', handleSyncIntervalChanged);
      (window.flowDesk as any).on('config-sync:config-updated', handleConfigUpdated);
      (window.flowDesk as any).on('config-sync:config-imported', handleConfigImported);
      (window.flowDesk as any).on('config-sync:device-paired', handleDevicePaired);
      (window.flowDesk as any).on('config-sync:error', handleError);

      // Cleanup listeners
      return () => {
        (window.flowDesk as any)?.removeAllListeners('config-sync:sync-started');
        (window.flowDesk as any)?.removeAllListeners('config-sync:sync-completed');
        (window.flowDesk as any)?.removeAllListeners('config-sync:sync-failed');
        (window.flowDesk as any)?.removeAllListeners('config-sync:auto-sync-changed');
        (window.flowDesk as any)?.removeAllListeners('config-sync:sync-interval-changed');
        (window.flowDesk as any)?.removeAllListeners('config-sync:config-updated');
        (window.flowDesk as any)?.removeAllListeners('config-sync:config-imported');
        (window.flowDesk as any)?.removeAllListeners('config-sync:device-paired');
        (window.flowDesk as any)?.removeAllListeners('config-sync:error');
      };
    }

    return () => {
      // No cleanup needed if window.flowDesk is not available
    };
  }, [dispatch]);

  // Actions
  const performSync = useCallback(async () => {
    try {
      await (window.flowDesk as any)?.invoke('config-sync:perform-sync');
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Sync failed:', error], method: 'console.error' });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, []);

  const setAutoSync = useCallback(async (enabled: boolean) => {
    try {
      await (window.flowDesk as any)?.invoke('config-sync:set-auto-sync', enabled);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to set auto-sync:', error], method: 'console.error' });
    }
  }, []);

  const setSyncInterval = useCallback(async (minutes: number) => {
    try {
      await (window.flowDesk as any)?.invoke('config-sync:set-sync-interval', minutes);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to set sync interval:', error], method: 'console.error' });
    }
  }, []);

  const exportConfig = useCallback(async (): Promise<string | null> => {
    try {
      return await (window.flowDesk as any)?.invoke('config-sync:export-config');
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Export failed:', error], method: 'console.error' });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Export failed',
      }));
      return null;
    }
  }, []);

  const importConfig = useCallback(async (): Promise<WorkspaceConfig | null> => {
    try {
      return await (window.flowDesk as any)?.invoke('config-sync:import-config');
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Import failed:', error], method: 'console.error' });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Import failed',
      }));
      return null;
    }
  }, []);

  const generatePairingQR = useCallback(async (): Promise<string> => {
    try {
      return await (window.flowDesk as any)?.invoke('config-sync:generate-pairing-qr') as string;
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to generate pairing QR:', error], method: 'console.error' });
      throw error;
    }
  }, []);

  const pairWithDevice = useCallback(async (qrData: string) => {
    try {
      return await (window.flowDesk as any)?.invoke('config-sync:pair-with-device', qrData) as { success: boolean; error?: string };
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Device pairing failed:', error], method: 'console.error' });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Pairing failed',
      }));
      throw error;
    }
  }, []);

  const createBackup = useCallback(async (description?: string): Promise<string> => {
    try {
      return await (window.flowDesk as any)?.invoke('config-sync:create-backup', description);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Backup creation failed:', error], method: 'console.error' });
      throw error;
    }
  }, []);

  const listBackups = useCallback(async (): Promise<ConfigBackup[]> => {
    try {
      return await (window.flowDesk as any)?.invoke('config-sync:list-backups') as ConfigBackup[];
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to list backups:', error], method: 'console.error' });
      return [];
    }
  }, []);

  const restoreBackup = useCallback(async (backupId: string) => {
    try {
      await (window.flowDesk as any)?.invoke('config-sync:restore-backup', backupId);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Backup restore failed:', error], method: 'console.error' });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Restore failed',
      }));
      throw error;
    }
  }, []);

  const refreshDiscoveredDevices = useCallback(async () => {
    try {
      const devices = await (window.flowDesk as any)?.invoke('config-sync:get-discovered-devices') as ConfigSyncDevice[];
      setState(prev => ({ ...prev, discoveredDevices: devices }));
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to refresh discovered devices:', error], method: 'console.error' });
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