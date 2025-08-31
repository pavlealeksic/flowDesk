/**
 * Plugin Store Slice - Manages plugin runtime and sandboxed execution
 */

import { StateCreator } from 'zustand';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  main: string;
  permissions: PluginPermission[];
  scopes: PluginScope[];
  entrypoints: PluginEntrypoint[];
  dependencies?: Record<string, string>;
  engines: {
    flowDesk: string;
  };
}

export type PluginPermission = 
  | 'read_emails' | 'write_emails'
  | 'read_calendar' | 'write_calendar'
  | 'read_contacts' | 'write_contacts'
  | 'network_access' | 'filesystem_read' | 'filesystem_write'
  | 'notifications' | 'system_integration'
  | 'storage_access' | 'clipboard_access';

export type PluginScope = 'connector' | 'panel' | 'automation' | 'search';

export interface PluginEntrypoint {
  type: 'panel' | 'automation' | 'search_provider';
  id: string;
  name: string;
  description?: string;
  icon?: string;
  component?: string;
  config?: Record<string, any>;
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  isEnabled: boolean;
  isLoaded: boolean;
  installedAt: Date;
  lastUsed?: Date;
  settings: Record<string, any>;
  grantedPermissions: PluginPermission[];
  error?: string;
}

export interface PluginInstance {
  id: string;
  pluginId: string;
  workspaceId: string;
  entrypointId: string;
  isActive: boolean;
  sandboxUrl?: string;
  state: Record<string, any>;
  createdAt: Date;
}

export interface PluginMessage {
  id: string;
  type: 'api_call' | 'event' | 'storage' | 'navigation';
  pluginId: string;
  instanceId?: string;
  data: any;
  timestamp: Date;
  response?: any;
}

export interface PluginAPI {
  // Core APIs
  version: string;
  platform: 'mobile' | 'desktop';
  
  // Storage API
  storage: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
  };
  
  // Events API
  events: {
    emit(type: string, data: any): void;
    on(type: string, handler: (data: any) => void): () => void;
    off(type: string, handler: (data: any) => void): void;
  };
  
  // UI API
  ui: {
    showNotification(title: string, message: string, options?: any): void;
    showModal(component: string, props?: any): Promise<any>;
    navigate(path: string): void;
    setTitle(title: string): void;
    setBadge(count: number): void;
  };
  
  // Data APIs (based on permissions)
  mail?: {
    getAccounts(): Promise<any[]>;
    getMessages(accountId: string, options?: any): Promise<any[]>;
    sendMessage(accountId: string, message: any): Promise<void>;
  };
  
  calendar?: {
    getAccounts(): Promise<any[]>;
    getEvents(accountId: string, options?: any): Promise<any[]>;
    createEvent(accountId: string, event: any): Promise<string>;
    updateEvent(eventId: string, updates: any): Promise<void>;
  };
  
  // Network API (if network_access permission granted)
  http?: {
    get(url: string, options?: any): Promise<Response>;
    post(url: string, data: any, options?: any): Promise<Response>;
    put(url: string, data: any, options?: any): Promise<Response>;
    delete(url: string, options?: any): Promise<Response>;
  };
}

export interface PluginSlice {
  // State
  installedPlugins: InstalledPlugin[];
  activeInstances: PluginInstance[];
  messages: PluginMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Plugin management
  installPlugin: (manifest: PluginManifest, packageData: ArrayBuffer) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  updatePlugin: (pluginId: string, packageData: ArrayBuffer) => Promise<void>;
  
  // Instance management
  createInstance: (pluginId: string, workspaceId: string, entrypointId: string) => Promise<string>;
  destroyInstance: (instanceId: string) => Promise<void>;
  activateInstance: (instanceId: string) => void;
  deactivateInstance: (instanceId: string) => void;
  
  // Permission management
  requestPermissions: (pluginId: string, permissions: PluginPermission[]) => Promise<boolean>;
  revokePermissions: (pluginId: string, permissions: PluginPermission[]) => Promise<void>;
  hasPermission: (pluginId: string, permission: PluginPermission) => boolean;
  
  // Messaging
  sendMessage: (message: Omit<PluginMessage, 'id' | 'timestamp'>) => Promise<any>;
  handleMessage: (messageId: string, response: any) => void;
  
  // Settings
  updatePluginSettings: (pluginId: string, settings: Record<string, any>) => void;
  getPluginSettings: (pluginId: string) => Record<string, any>;
  
  // Utility functions
  getPlugin: (pluginId: string) => InstalledPlugin | null;
  getActiveInstances: (pluginId?: string) => PluginInstance[];
  getPluginAPI: (pluginId: string, instanceId?: string) => PluginAPI;
}

// Mock plugin runtime
class PluginRuntime {
  static async loadPlugin(manifest: PluginManifest, packageData: ArrayBuffer): Promise<void> {
    // Mock plugin loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Loaded plugin: ${manifest.name}`);
  }
  
  static async createSandbox(pluginId: string, instanceId: string): Promise<string> {
    // Mock sandbox creation - in reality, this would create an isolated JavaScript context
    await new Promise(resolve => setTimeout(resolve, 500));
    return `sandbox://${pluginId}/${instanceId}`;
  }
  
  static async executeInSandbox(sandboxUrl: string, code: string, api: PluginAPI): Promise<any> {
    // Mock code execution in sandbox
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }
}

export const createPluginStore: StateCreator<
  any,
  [],
  [],
  PluginSlice
> = (set, get) => ({
  // Initial state
  installedPlugins: [],
  activeInstances: [],
  messages: [],
  isLoading: false,
  error: null,
  
  // Plugin management
  installPlugin: async (manifest, packageData) => {
    set((state: any) => {
      state.isLoading = true;
      state.error = null;
    });
    
    try {
      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error('Invalid plugin manifest');
      }
      
      // Check if plugin already exists
      const existing = get().installedPlugins.find(p => p.manifest.id === manifest.id);
      if (existing) {
        throw new Error('Plugin already installed');
      }
      
      // Load plugin
      await PluginRuntime.loadPlugin(manifest, packageData);
      
      const plugin: InstalledPlugin = {
        manifest,
        isEnabled: false, // Plugins start disabled for security
        isLoaded: false,
        installedAt: new Date(),
        settings: {},
        grantedPermissions: [],
      };
      
      set((state: any) => {
        state.installedPlugins.push(plugin);
        state.isLoading = false;
      });
    } catch (error) {
      console.error('Plugin installation error:', error);
      set((state: any) => {
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Installation failed';
      });
      throw error;
    }
  },
  
  uninstallPlugin: async (pluginId) => {
    // Destroy all instances of this plugin
    const instances = get().activeInstances.filter(i => i.pluginId === pluginId);
    await Promise.all(instances.map(i => get().destroyInstance(i.id)));
    
    set((state: any) => {
      state.installedPlugins = state.installedPlugins.filter(
        (p: InstalledPlugin) => p.manifest.id !== pluginId
      );
    });
  },
  
  enablePlugin: async (pluginId) => {
    const plugin = get().getPlugin(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }
    
    // Request necessary permissions
    if (plugin.manifest.permissions.length > 0) {
      const granted = await get().requestPermissions(pluginId, plugin.manifest.permissions);
      if (!granted) {
        throw new Error('Permissions denied');
      }
    }
    
    set((state: any) => {
      const pluginIndex = state.installedPlugins.findIndex(
        (p: InstalledPlugin) => p.manifest.id === pluginId
      );
      if (pluginIndex >= 0) {
        state.installedPlugins[pluginIndex].isEnabled = true;
        state.installedPlugins[pluginIndex].isLoaded = true;
      }
    });
  },
  
  disablePlugin: async (pluginId) => {
    // Destroy all instances
    const instances = get().activeInstances.filter(i => i.pluginId === pluginId);
    await Promise.all(instances.map(i => get().destroyInstance(i.id)));
    
    set((state: any) => {
      const pluginIndex = state.installedPlugins.findIndex(
        (p: InstalledPlugin) => p.manifest.id === pluginId
      );
      if (pluginIndex >= 0) {
        state.installedPlugins[pluginIndex].isEnabled = false;
        state.installedPlugins[pluginIndex].isLoaded = false;
      }
    });
  },
  
  updatePlugin: async (pluginId, packageData) => {
    const plugin = get().getPlugin(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }
    
    // For now, just simulate update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    set((state: any) => {
      const pluginIndex = state.installedPlugins.findIndex(
        (p: InstalledPlugin) => p.manifest.id === pluginId
      );
      if (pluginIndex >= 0) {
        state.installedPlugins[pluginIndex].manifest.version = '1.0.1'; // Mock version bump
      }
    });
  },
  
  // Instance management
  createInstance: async (pluginId, workspaceId, entrypointId) => {
    const plugin = get().getPlugin(pluginId);
    if (!plugin || !plugin.isEnabled) {
      throw new Error('Plugin not available');
    }
    
    const entrypoint = plugin.manifest.entrypoints.find(e => e.id === entrypointId);
    if (!entrypoint) {
      throw new Error('Entrypoint not found');
    }
    
    const instanceId = `instance_${pluginId}_${Date.now()}`;
    const sandboxUrl = await PluginRuntime.createSandbox(pluginId, instanceId);
    
    const instance: PluginInstance = {
      id: instanceId,
      pluginId,
      workspaceId,
      entrypointId,
      isActive: false,
      sandboxUrl,
      state: {},
      createdAt: new Date(),
    };
    
    set((state: any) => {
      state.activeInstances.push(instance);
    });
    
    return instanceId;
  },
  
  destroyInstance: async (instanceId) => {
    set((state: any) => {
      state.activeInstances = state.activeInstances.filter(
        (i: PluginInstance) => i.id !== instanceId
      );
    });
  },
  
  activateInstance: (instanceId) => {
    set((state: any) => {
      const instance = state.activeInstances.find((i: PluginInstance) => i.id === instanceId);
      if (instance) {
        instance.isActive = true;
      }
    });
  },
  
  deactivateInstance: (instanceId) => {
    set((state: any) => {
      const instance = state.activeInstances.find((i: PluginInstance) => i.id === instanceId);
      if (instance) {
        instance.isActive = false;
      }
    });
  },
  
  // Permission management
  requestPermissions: async (pluginId, permissions) => {
    // Mock permission request - in reality, this would show a system dialog
    return new Promise((resolve) => {
      setTimeout(() => {
        const granted = Math.random() > 0.3; // Mock 70% approval rate
        if (granted) {
          set((state: any) => {
            const plugin = state.installedPlugins.find(
              (p: InstalledPlugin) => p.manifest.id === pluginId
            );
            if (plugin) {
              plugin.grantedPermissions = [...new Set([...plugin.grantedPermissions, ...permissions])];
            }
          });
        }
        resolve(granted);
      }, 1000);
    });
  },
  
  revokePermissions: async (pluginId, permissions) => {
    set((state: any) => {
      const plugin = state.installedPlugins.find(
        (p: InstalledPlugin) => p.manifest.id === pluginId
      );
      if (plugin) {
        plugin.grantedPermissions = plugin.grantedPermissions.filter(
          p => !permissions.includes(p)
        );
      }
    });
  },
  
  hasPermission: (pluginId, permission) => {
    const plugin = get().getPlugin(pluginId);
    return plugin?.grantedPermissions.includes(permission) || false;
  },
  
  // Messaging
  sendMessage: async (messageData) => {
    const message: PluginMessage = {
      ...messageData,
      id: `msg_${Date.now()}`,
      timestamp: new Date(),
    };
    
    set((state: any) => {
      state.messages.push(message);
    });
    
    // Mock message processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = { success: true, data: 'Mock response' };
    get().handleMessage(message.id, response);
    
    return response;
  },
  
  handleMessage: (messageId, response) => {
    set((state: any) => {
      const message = state.messages.find((m: PluginMessage) => m.id === messageId);
      if (message) {
        message.response = response;
      }
    });
  },
  
  // Settings
  updatePluginSettings: (pluginId, settings) => {
    set((state: any) => {
      const plugin = state.installedPlugins.find(
        (p: InstalledPlugin) => p.manifest.id === pluginId
      );
      if (plugin) {
        plugin.settings = { ...plugin.settings, ...settings };
      }
    });
  },
  
  getPluginSettings: (pluginId) => {
    const plugin = get().getPlugin(pluginId);
    return plugin?.settings || {};
  },
  
  // Utility functions
  getPlugin: (pluginId) => {
    return get().installedPlugins.find(p => p.manifest.id === pluginId) || null;
  },
  
  getActiveInstances: (pluginId) => {
    const instances = get().activeInstances;
    return pluginId ? instances.filter(i => i.pluginId === pluginId) : instances;
  },
  
  getPluginAPI: (pluginId, instanceId) => {
    const plugin = get().getPlugin(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }
    
    // Create a scoped API based on granted permissions
    const api: PluginAPI = {
      version: '1.0.0',
      platform: 'mobile',
      
      storage: {
        get: async <T>(key: string): Promise<T | null> => {
          // Mock storage implementation
          return null;
        },
        set: async <T>(key: string, value: T): Promise<void> => {
          // Mock storage implementation
        },
        remove: async (key: string): Promise<void> => {
          // Mock storage implementation
        },
        clear: async (): Promise<void> => {
          // Mock storage implementation
        },
      },
      
      events: {
        emit: (type: string, data: any) => {
          console.log(`Plugin ${pluginId} emitted event:`, type, data);
        },
        on: (type: string, handler: (data: any) => void) => {
          return () => {}; // Mock unsubscribe
        },
        off: (type: string, handler: (data: any) => void) => {
          // Mock event removal
        },
      },
      
      ui: {
        showNotification: (title: string, message: string, options?: any) => {
          // This would integrate with the notification system
          console.log(`Plugin notification: ${title} - ${message}`);
        },
        showModal: async (component: string, props?: any): Promise<any> => {
          return new Promise(resolve => {
            setTimeout(() => resolve({ confirmed: true }), 1000);
          });
        },
        navigate: (path: string) => {
          console.log(`Plugin navigation: ${path}`);
        },
        setTitle: (title: string) => {
          console.log(`Plugin title: ${title}`);
        },
        setBadge: (count: number) => {
          console.log(`Plugin badge: ${count}`);
        },
      },
    };
    
    // Add mail API if permission granted
    if (get().hasPermission(pluginId, 'read_emails') || get().hasPermission(pluginId, 'write_emails')) {
      api.mail = {
        getAccounts: async () => [],
        getMessages: async (accountId: string, options?: any) => [],
        sendMessage: async (accountId: string, message: any) => {},
      };
    }
    
    // Add calendar API if permission granted
    if (get().hasPermission(pluginId, 'read_calendar') || get().hasPermission(pluginId, 'write_calendar')) {
      api.calendar = {
        getAccounts: async () => [],
        getEvents: async (accountId: string, options?: any) => [],
        createEvent: async (accountId: string, event: any) => 'event_id',
        updateEvent: async (eventId: string, updates: any) => {},
      };
    }
    
    // Add HTTP API if permission granted
    if (get().hasPermission(pluginId, 'network_access')) {
      api.http = {
        get: async (url: string, options?: any) => new Response(),
        post: async (url: string, data: any, options?: any) => new Response(),
        put: async (url: string, data: any, options?: any) => new Response(),
        delete: async (url: string, options?: any) => new Response(),
      };
    }
    
    return api;
  },
});