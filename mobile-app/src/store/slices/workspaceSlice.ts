/**
 * Workspace Store Slice - Manages workspaces and containers
 */

import { StateCreator } from 'zustand';
import type { WorkspaceConfig, AppConfig } from '@flow-desk/shared';

export interface WorkspaceApp {
  id: string;
  name: string;
  type: 'mail' | 'calendar' | 'plugin' | 'native';
  pluginId?: string;
  config: AppConfig;
  isEnabled: boolean;
  position: number;
  permissions: string[];
  lastUsed?: Date;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  isDefault: boolean;
  apps: WorkspaceApp[];
  config: {
    // Container-like settings for mobile adaptation
    isolateStorage: boolean;
    customUserAgent?: string;
    proxySettings?: {
      enabled: boolean;
      host?: string;
      port?: number;
      auth?: {
        username: string;
        password: string;
      };
    };
    networkRules?: {
      allowedDomains: string[];
      blockedDomains: string[];
      requireVPN: boolean;
    };
    ephemeralMode: boolean; // Clear data on workspace switch
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceSlice {
  // State
  workspaces: Workspace[];
  activeWorkspace: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializeWorkspaces: () => Promise<void>;
  createWorkspace: (workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  
  // App management
  addAppToWorkspace: (workspaceId: string, app: Omit<WorkspaceApp, 'id' | 'position'>) => Promise<string>;
  updateWorkspaceApp: (workspaceId: string, appId: string, updates: Partial<WorkspaceApp>) => Promise<void>;
  removeAppFromWorkspace: (workspaceId: string, appId: string) => Promise<void>;
  reorderWorkspaceApps: (workspaceId: string, appIds: string[]) => Promise<void>;
  
  // Utility getters
  getActiveWorkspace: () => Workspace | null;
  getWorkspaceApps: (workspaceId: string) => WorkspaceApp[];
  getWorkspaceApp: (workspaceId: string, appId: string) => WorkspaceApp | null;
}

// Default workspace configuration
const createDefaultWorkspace = (): Workspace => ({
  id: 'default',
  name: 'Default',
  description: 'Your main workspace',
  color: '#6750A4',
  isDefault: true,
  apps: [
    {
      id: 'mail',
      name: 'Mail',
      type: 'mail',
      config: {},
      isEnabled: true,
      position: 0,
      permissions: ['read_emails', 'write_emails'],
    },
    {
      id: 'calendar',
      name: 'Calendar',
      type: 'calendar',
      config: {},
      isEnabled: true,
      position: 1,
      permissions: ['read_calendar', 'write_calendar'],
    },
  ],
  config: {
    isolateStorage: false,
    ephemeralMode: false,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const createWorkspaceStore: StateCreator<
  any,
  [],
  [],
  WorkspaceSlice
> = (set, get) => ({
  // Initial state
  workspaces: [],
  activeWorkspace: null,
  isLoading: false,
  error: null,
  
  initializeWorkspaces: async () => {
    set((state: any) => {
      state.isLoading = true;
      state.error = null;
    });
    
    try {
      // In a real implementation, this would load from sync service
      // For now, we'll create a default workspace if none exist
      const existingWorkspaces = get().workspaces;
      
      if (existingWorkspaces.length === 0) {
        const defaultWorkspace = createDefaultWorkspace();
        
        set((state: any) => {
          state.workspaces = [defaultWorkspace];
          state.activeWorkspace = defaultWorkspace.id;
          state.isLoading = false;
        });
      } else {
        set((state: any) => {
          state.isLoading = false;
        });
      }
    } catch (error) {
      console.error('Workspace initialization error:', error);
      set((state: any) => {
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Failed to initialize workspaces';
      });
    }
  },
  
  createWorkspace: async (workspaceData) => {
    const id = `workspace_${Date.now()}`;
    const workspace: Workspace = {
      ...workspaceData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state: any) => {
      state.workspaces.push(workspace);
    });
    
    return id;
  },
  
  updateWorkspace: async (id, updates) => {
    set((state: any) => {
      const index = state.workspaces.findIndex((w: Workspace) => w.id === id);
      if (index >= 0) {
        state.workspaces[index] = {
          ...state.workspaces[index],
          ...updates,
          updatedAt: new Date(),
        };
      }
    });
  },
  
  deleteWorkspace: async (id) => {
    const workspace = get().workspaces.find(w => w.id === id);
    if (workspace?.isDefault) {
      throw new Error('Cannot delete default workspace');
    }
    
    set((state: any) => {
      state.workspaces = state.workspaces.filter((w: Workspace) => w.id !== id);
      
      // If we're deleting the active workspace, switch to default
      if (state.activeWorkspace === id) {
        const defaultWorkspace = state.workspaces.find((w: Workspace) => w.isDefault);
        state.activeWorkspace = defaultWorkspace?.id || null;
      }
    });
  },
  
  setActiveWorkspace: (id) => {
    const workspace = get().workspaces.find(w => w.id === id);
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`);
    }
    
    set((state: any) => {
      state.activeWorkspace = id;
    });
  },
  
  addAppToWorkspace: async (workspaceId, appData) => {
    const workspace = get().workspaces.find(w => w.id === workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }
    
    const appId = `${workspaceId}_app_${Date.now()}`;
    const app: WorkspaceApp = {
      ...appData,
      id: appId,
      position: workspace.apps.length,
    };
    
    set((state: any) => {
      const workspaceIndex = state.workspaces.findIndex((w: Workspace) => w.id === workspaceId);
      if (workspaceIndex >= 0) {
        state.workspaces[workspaceIndex].apps.push(app);
        state.workspaces[workspaceIndex].updatedAt = new Date();
      }
    });
    
    return appId;
  },
  
  updateWorkspaceApp: async (workspaceId, appId, updates) => {
    set((state: any) => {
      const workspaceIndex = state.workspaces.findIndex((w: Workspace) => w.id === workspaceId);
      if (workspaceIndex >= 0) {
        const appIndex = state.workspaces[workspaceIndex].apps.findIndex((a: WorkspaceApp) => a.id === appId);
        if (appIndex >= 0) {
          state.workspaces[workspaceIndex].apps[appIndex] = {
            ...state.workspaces[workspaceIndex].apps[appIndex],
            ...updates,
          };
          state.workspaces[workspaceIndex].updatedAt = new Date();
        }
      }
    });
  },
  
  removeAppFromWorkspace: async (workspaceId, appId) => {
    set((state: any) => {
      const workspaceIndex = state.workspaces.findIndex((w: Workspace) => w.id === workspaceId);
      if (workspaceIndex >= 0) {
        state.workspaces[workspaceIndex].apps = state.workspaces[workspaceIndex].apps
          .filter((a: WorkspaceApp) => a.id !== appId);
        
        // Reorder positions
        state.workspaces[workspaceIndex].apps.forEach((app: WorkspaceApp, index: number) => {
          app.position = index;
        });
        
        state.workspaces[workspaceIndex].updatedAt = new Date();
      }
    });
  },
  
  reorderWorkspaceApps: async (workspaceId, appIds) => {
    set((state: any) => {
      const workspaceIndex = state.workspaces.findIndex((w: Workspace) => w.id === workspaceId);
      if (workspaceIndex >= 0) {
        const apps = state.workspaces[workspaceIndex].apps;
        const reorderedApps = appIds.map(id => apps.find((a: WorkspaceApp) => a.id === id))
          .filter(Boolean)
          .map((app: WorkspaceApp, index: number) => ({ ...app, position: index }));
        
        state.workspaces[workspaceIndex].apps = reorderedApps;
        state.workspaces[workspaceIndex].updatedAt = new Date();
      }
    });
  },
  
  // Utility getters
  getActiveWorkspace: () => {
    const activeWorkspaceId = get().activeWorkspace;
    if (!activeWorkspaceId) return null;
    return get().workspaces.find(w => w.id === activeWorkspaceId) || null;
  },
  
  getWorkspaceApps: (workspaceId) => {
    const workspace = get().workspaces.find(w => w.id === workspaceId);
    if (!workspace) return [];
    return workspace.apps.sort((a, b) => a.position - b.position);
  },
  
  getWorkspaceApp: (workspaceId, appId) => {
    const workspace = get().workspaces.find(w => w.id === workspaceId);
    if (!workspace) return null;
    return workspace.apps.find(a => a.id === appId) || null;
  },
});