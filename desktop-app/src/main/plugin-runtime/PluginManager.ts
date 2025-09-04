/**
 * Plugin Manager
 * Handles plugin loading, lifecycle, and communication
 */

import Store from 'electron-store';
import log from 'electron-log';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: string[];
  isEnabled: boolean;
  isLoaded: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: string[];
  dependencies?: Record<string, string>;
}

export interface PluginContext {
  api: {
    showNotification: (title: string, body: string) => void;
    registerCommand: (name: string, handler: Function) => void;
    getConfig: (key: string) => any;
    setConfig: (key: string, value: any) => void;
  };
  events: {
    on: (event: string, handler: Function) => void;
    emit: (event: string, data: any) => void;
  };
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private loadedPlugins: Map<string, any> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  private configStore: Store;
  private pluginConfigs: Map<string, Map<string, any>> = new Map();

  constructor() {
    this.configStore = new Store({
      name: 'plugin-configurations'
    });
    this.loadPluginConfigs();
  }

  private loadPluginConfigs(): void {
    try {
      const savedConfigs = this.configStore.get('pluginConfigs', {}) as Record<string, Record<string, any>>;
      for (const [pluginId, config] of Object.entries(savedConfigs)) {
        this.pluginConfigs.set(pluginId, new Map(Object.entries(config)));
      }
      log.info(`Loaded configurations for ${Object.keys(savedConfigs).length} plugins`);
    } catch (error) {
      log.error('Failed to load plugin configurations:', error);
    }
  }

  private savePluginConfigs(): void {
    try {
      const configsToSave: Record<string, Record<string, any>> = {};
      for (const [pluginId, configMap] of this.pluginConfigs) {
        configsToSave[pluginId] = Object.fromEntries(configMap);
      }
      this.configStore.set('pluginConfigs', configsToSave);
    } catch (error) {
      log.error('Failed to save plugin configurations:', error);
    }
  }

  async initialize(): Promise<void> {
    console.log('Plugin manager initialized');
  }

  async loadPlugin(manifest: PluginManifest): Promise<void> {
    const plugin: Plugin = {
      ...manifest,
      isEnabled: false,
      isLoaded: false
    };

    this.plugins.set(plugin.id, plugin);
    
    try {
      // In a real implementation, this would load the actual plugin code
      // For now, we'll just mark it as loaded
      plugin.isLoaded = true;
      plugin.isEnabled = true;
      
      console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`);
    } catch (error) {
      console.error(`Failed to load plugin ${plugin.id}:`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.isLoaded) {
      // Clean up plugin resources
      this.loadedPlugins.delete(pluginId);
      plugin.isLoaded = false;
      plugin.isEnabled = false;
      
      console.log(`Unloaded plugin: ${plugin.name}`);
    }
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.isLoaded) {
      throw new Error(`Plugin ${pluginId} is not loaded`);
    }

    plugin.isEnabled = true;
    console.log(`Enabled plugin: ${plugin.name}`);
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.isEnabled = false;
    console.log(`Disabled plugin: ${plugin.name}`);
  }

  async callPluginMethod(pluginId: string, methodName: string, ...args: any[]): Promise<any> {
    return this.executePluginMethod(pluginId, methodName, ...args);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return this.getPlugins().filter(plugin => plugin.isEnabled);
  }

  async executePluginMethod(pluginId: string, method: string, ...args: any[]): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.isEnabled) {
      throw new Error(`Plugin ${pluginId} is not available`);
    }

    const loadedPlugin = this.loadedPlugins.get(pluginId);
    if (!loadedPlugin || typeof loadedPlugin[method] !== 'function') {
      throw new Error(`Method ${method} not found in plugin ${pluginId}`);
    }

    try {
      return await loadedPlugin[method](...args);
    } catch (error) {
      console.error(`Error executing ${method} on plugin ${pluginId}:`, error);
      throw error;
    }
  }

  createPluginContext(pluginId: string): PluginContext {
    return {
      api: {
        showNotification: (title: string, body: string) => {
          console.log(`Plugin ${pluginId} notification: ${title} - ${body}`);
        },
        registerCommand: (name: string, handler: Function) => {
          console.log(`Plugin ${pluginId} registered command: ${name}`);
        },
        getConfig: (key: string) => {
          const pluginConfig = this.pluginConfigs.get(pluginId);
          if (!pluginConfig) {
            return null;
          }
          return pluginConfig.get(key) || null;
        },
        setConfig: (key: string, value: any) => {
          let pluginConfig = this.pluginConfigs.get(pluginId);
          if (!pluginConfig) {
            pluginConfig = new Map();
            this.pluginConfigs.set(pluginId, pluginConfig);
          }
          pluginConfig.set(key, value);
          this.savePluginConfigs();
          log.debug(`Plugin ${pluginId} set config ${key}:`, value);
        }
      },
      events: {
        on: (event: string, handler: Function) => {
          if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
          }
          this.eventHandlers.get(event)!.push(handler);
        },
        emit: (event: string, data: any) => {
          const handlers = this.eventHandlers.get(event);
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(data);
              } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
              }
            });
          }
        }
      }
    };
  }

  async broadcastEvent(event: string, data: any): Promise<void> {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      await Promise.all(handlers.map(handler => {
        try {
          return handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
          return null;
        }
      }));
    }
  }
}

export const pluginManager = new PluginManager();