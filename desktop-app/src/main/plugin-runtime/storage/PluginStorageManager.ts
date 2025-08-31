/**
 * Plugin Storage Manager - Manages plugin data storage and configuration
 * 
 * Provides secure, scoped storage for plugins with encryption and access control.
 * Handles plugin installations, configurations, and user data.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import Store from 'electron-store';
import { 
  PluginInstallation, 
  PluginInstallationSchema,
  CreatePluginInstallationInput,
  UpdatePluginInstallationInput 
} from '@flow-desk/shared';
import { PluginLogger } from '../utils/PluginLogger';

export interface StorageOptions {
  /** Base directory for plugin storage */
  baseDir: string;
  /** Enable encryption for sensitive data */
  encrypted: boolean;
  /** Encryption key for sensitive data */
  encryptionKey?: string;
  /** Maximum storage size per plugin in MB */
  maxStoragePerPlugin: number;
  /** Enable storage compression */
  compression: boolean;
}

export interface PluginStorageAPI {
  /** Get stored value */
  get<T>(key: string): Promise<T | null>;
  /** Store value */
  set<T>(key: string, value: T): Promise<void>;
  /** Remove stored value */
  remove(key: string): Promise<void>;
  /** Clear all stored values */
  clear(): Promise<void>;
  /** List all keys */
  keys(): Promise<string[]>;
  /** Get storage usage in bytes */
  getUsage(): Promise<number>;
}

/**
 * Plugin Storage Manager
 * 
 * Manages all plugin storage operations with security and access control.
 */
export class PluginStorageManager extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly options: StorageOptions;
  private readonly installationStore: Store;
  private readonly pluginStores = new Map<string, Store>();
  private readonly storageUsage = new Map<string, number>();
  
  private isInitialized = false;

  constructor(baseDir: string, options: Partial<StorageOptions> = {}) {
    super();
    
    this.options = {
      baseDir,
      encrypted: true,
      maxStoragePerPlugin: 100, // 100MB default
      compression: true,
      ...options
    };

    this.logger = new PluginLogger('PluginStorageManager');

    // Main store for plugin installations
    this.installationStore = new Store({
      name: 'plugin-installations',
      cwd: path.join(this.options.baseDir, 'storage'),
      encryptionKey: this.options.encryptionKey,
      schema: {
        installations: {
          type: 'array',
          items: {
            type: 'object'
          }
        }
      }
    });
  }

  /**
   * Initialize the storage manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Storage manager already initialized');
    }

    this.logger.info('Initializing plugin storage manager');

    try {
      // Ensure storage directories exist
      await this.ensureDirectoryStructure();
      
      // Load existing plugin stores
      await this.loadExistingPluginStores();
      
      // Calculate initial storage usage
      await this.calculateStorageUsage();

      this.isInitialized = true;
      this.logger.info('Plugin storage manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize plugin storage manager', error);
      throw error;
    }
  }

  /**
   * Shutdown the storage manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Shutting down plugin storage manager');
    
    // Close all plugin stores
    for (const store of this.pluginStores.values()) {
      // electron-store doesn't have explicit close method
      // Data is automatically persisted
    }
    
    this.pluginStores.clear();
    this.storageUsage.clear();
    this.isInitialized = false;
    
    this.logger.info('Plugin storage manager shut down');
  }

  /**
   * Save plugin installation
   */
  async savePluginInstallation(installation: PluginInstallation): Promise<void> {
    this.logger.debug(`Saving plugin installation: ${installation.id}`);

    try {
      // Validate installation data
      const validationResult = PluginInstallationSchema.safeParse(installation);
      if (!validationResult.success) {
        throw new Error(`Invalid installation data: ${validationResult.error.message}`);
      }

      // Get existing installations
      const installations = this.installationStore.get('installations', []) as PluginInstallation[];
      
      // Update or add installation
      const existingIndex = installations.findIndex(inst => inst.id === installation.id);
      if (existingIndex >= 0) {
        installations[existingIndex] = installation;
      } else {
        installations.push(installation);
      }

      // Save updated installations
      this.installationStore.set('installations', installations);

      this.logger.debug(`Plugin installation saved: ${installation.id}`);
      this.emit('installationSaved', installation);
    } catch (error) {
      this.logger.error(`Failed to save plugin installation ${installation.id}`, error);
      throw error;
    }
  }

  /**
   * Load plugin installations
   */
  async loadPluginInstallations(): Promise<PluginInstallation[]> {
    try {
      const installations = this.installationStore.get('installations', []) as PluginInstallation[];
      
      // Convert date strings back to Date objects
      return installations.map(installation => ({
        ...installation,
        installedAt: new Date(installation.installedAt),
        updatedAt: new Date(installation.updatedAt),
        lastUsedAt: installation.lastUsedAt ? new Date(installation.lastUsedAt) : undefined
      }));
    } catch (error) {
      this.logger.error('Failed to load plugin installations', error);
      throw error;
    }
  }

  /**
   * Remove plugin installation
   */
  async removePluginInstallation(installationId: string): Promise<void> {
    this.logger.debug(`Removing plugin installation: ${installationId}`);

    try {
      // Get existing installations
      const installations = this.installationStore.get('installations', []) as PluginInstallation[];
      
      // Filter out the installation to remove
      const filteredInstallations = installations.filter(inst => inst.id !== installationId);
      
      if (filteredInstallations.length === installations.length) {
        throw new Error(`Installation ${installationId} not found`);
      }

      // Save updated installations
      this.installationStore.set('installations', filteredInstallations);

      // Remove plugin storage
      await this.removePluginStorage(installationId);

      this.logger.debug(`Plugin installation removed: ${installationId}`);
      this.emit('installationRemoved', installationId);
    } catch (error) {
      this.logger.error(`Failed to remove plugin installation ${installationId}`, error);
      throw error;
    }
  }

  /**
   * Create scoped storage API for a plugin
   */
  createPluginStorageAPI(installationId: string, pluginId: string): PluginStorageAPI {
    const store = this.getOrCreatePluginStore(installationId, pluginId);
    const logger = this.logger.child({ installationId, pluginId });

    return {
      async get<T>(key: string): Promise<T | null> {
        try {
          const value = store.get(key) as T;
          logger.debug(`Storage get: ${key}`, { hasValue: value !== undefined });
          return value ?? null;
        } catch (error) {
          logger.error(`Failed to get storage value for key ${key}`, error);
          throw error;
        }
      },

      async set<T>(key: string, value: T): Promise<void> {
        try {
          // Check storage limits
          await this.checkStorageLimit(installationId, key, value);
          
          store.set(key, value);
          
          // Update storage usage
          await this.updateStorageUsage(installationId);
          
          logger.debug(`Storage set: ${key}`, { valueType: typeof value });
          this.emit('pluginDataChanged', installationId, key, value);
        } catch (error) {
          logger.error(`Failed to set storage value for key ${key}`, error);
          throw error;
        }
      },

      async remove(key: string): Promise<void> {
        try {
          store.delete(key);
          
          // Update storage usage
          await this.updateStorageUsage(installationId);
          
          logger.debug(`Storage remove: ${key}`);
          this.emit('pluginDataChanged', installationId, key, undefined);
        } catch (error) {
          logger.error(`Failed to remove storage value for key ${key}`, error);
          throw error;
        }
      },

      async clear(): Promise<void> {
        try {
          store.clear();
          
          // Update storage usage
          this.storageUsage.set(installationId, 0);
          
          logger.debug('Storage cleared');
          this.emit('pluginStorageCleared', installationId);
        } catch (error) {
          logger.error('Failed to clear plugin storage', error);
          throw error;
        }
      },

      async keys(): Promise<string[]> {
        try {
          // electron-store doesn't have a direct keys method
          const allData = store.store;
          const keys = Object.keys(allData);
          logger.debug(`Storage keys: ${keys.length} keys`);
          return keys;
        } catch (error) {
          logger.error('Failed to get storage keys', error);
          throw error;
        }
      },

      async getUsage(): Promise<number> {
        try {
          const usage = this.storageUsage.get(installationId) || 0;
          logger.debug(`Storage usage: ${usage} bytes`);
          return usage;
        } catch (error) {
          logger.error('Failed to get storage usage', error);
          throw error;
        }
      }
    };
  }

  /**
   * Get storage usage for all plugins
   */
  async getGlobalStorageUsage(): Promise<{ total: number; byPlugin: Record<string, number> }> {
    const byPlugin: Record<string, number> = {};
    let total = 0;

    for (const [installationId, usage] of this.storageUsage.entries()) {
      byPlugin[installationId] = usage;
      total += usage;
    }

    return { total, byPlugin };
  }

  /**
   * Cleanup unused storage
   */
  async cleanupUnusedStorage(): Promise<void> {
    this.logger.info('Starting storage cleanup');

    try {
      const installations = await this.loadPluginInstallations();
      const activeInstallationIds = new Set(installations.map(inst => inst.id));

      // Remove stores for uninstalled plugins
      for (const installationId of this.pluginStores.keys()) {
        if (!activeInstallationIds.has(installationId)) {
          await this.removePluginStorage(installationId);
        }
      }

      // Recalculate storage usage
      await this.calculateStorageUsage();

      this.logger.info('Storage cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup unused storage', error);
      throw error;
    }
  }

  /**
   * Export plugin data for backup
   */
  async exportPluginData(installationId: string): Promise<Record<string, any>> {
    const store = this.pluginStores.get(installationId);
    if (!store) {
      throw new Error(`No storage found for installation ${installationId}`);
    }

    return store.store;
  }

  /**
   * Import plugin data from backup
   */
  async importPluginData(installationId: string, data: Record<string, any>): Promise<void> {
    const store = this.getOrCreatePluginStore(installationId, 'imported');
    
    // Clear existing data
    store.clear();
    
    // Import new data
    for (const [key, value] of Object.entries(data)) {
      store.set(key, value);
    }

    // Update storage usage
    await this.updateStorageUsage(installationId);

    this.logger.info(`Imported data for installation ${installationId}`);
  }

  /**
   * Private: Ensure directory structure exists
   */
  private async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      path.join(this.options.baseDir, 'storage'),
      path.join(this.options.baseDir, 'storage', 'plugins'),
      path.join(this.options.baseDir, 'backups')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Private: Load existing plugin stores
   */
  private async loadExistingPluginStores(): Promise<void> {
    try {
      const pluginsDir = path.join(this.options.baseDir, 'storage', 'plugins');
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const installationId = entry.name;
          // Store will be created lazily when needed
          this.logger.debug(`Found existing plugin storage: ${installationId}`);
        }
      }
    } catch (error) {
      // Directory might not exist yet, that's okay
      this.logger.debug('No existing plugin stores found');
    }
  }

  /**
   * Private: Get or create plugin store
   */
  private getOrCreatePluginStore(installationId: string, pluginId: string): Store {
    let store = this.pluginStores.get(installationId);
    
    if (!store) {
      const storePath = path.join(this.options.baseDir, 'storage', 'plugins', installationId);
      
      store = new Store({
        name: 'plugin-data',
        cwd: storePath,
        encryptionKey: this.options.encryptionKey,
        serialize: this.options.compression ? 
          (value) => JSON.stringify(value) : 
          undefined,
        deserialize: this.options.compression ? 
          (value) => JSON.parse(value) : 
          undefined
      });

      this.pluginStores.set(installationId, store);
      this.logger.debug(`Created plugin store for installation ${installationId}`);
    }

    return store;
  }

  /**
   * Private: Remove plugin storage
   */
  private async removePluginStorage(installationId: string): Promise<void> {
    // Remove from memory
    this.pluginStores.delete(installationId);
    this.storageUsage.delete(installationId);

    // Remove storage directory
    const storePath = path.join(this.options.baseDir, 'storage', 'plugins', installationId);
    try {
      await fs.rm(storePath, { recursive: true, force: true });
      this.logger.debug(`Removed storage directory: ${storePath}`);
    } catch (error) {
      this.logger.warn(`Failed to remove storage directory ${storePath}`, error);
    }
  }

  /**
   * Private: Calculate storage usage for all plugins
   */
  private async calculateStorageUsage(): Promise<void> {
    this.storageUsage.clear();

    try {
      const pluginsDir = path.join(this.options.baseDir, 'storage', 'plugins');
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const installationId = entry.name;
          await this.updateStorageUsage(installationId);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to calculate storage usage', error);
    }
  }

  /**
   * Private: Update storage usage for a plugin
   */
  private async updateStorageUsage(installationId: string): Promise<void> {
    try {
      const storePath = path.join(this.options.baseDir, 'storage', 'plugins', installationId);
      const usage = await this.getDirectorySize(storePath);
      this.storageUsage.set(installationId, usage);
    } catch (error) {
      // Directory might not exist yet
      this.storageUsage.set(installationId, 0);
    }
  }

  /**
   * Private: Get directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist, return 0
    }

    return totalSize;
  }

  /**
   * Private: Check storage limit for a plugin
   */
  private async checkStorageLimit(installationId: string, key: string, value: any): Promise<void> {
    const currentUsage = this.storageUsage.get(installationId) || 0;
    const maxBytes = this.options.maxStoragePerPlugin * 1024 * 1024; // Convert MB to bytes
    
    // Estimate size of the new value
    const estimatedSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
    
    if (currentUsage + estimatedSize > maxBytes) {
      throw new Error(
        `Storage limit exceeded for plugin. ` +
        `Current: ${Math.round(currentUsage / 1024 / 1024)}MB, ` +
        `Limit: ${this.options.maxStoragePerPlugin}MB`
      );
    }
  }
}