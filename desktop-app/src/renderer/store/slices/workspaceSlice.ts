import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { WorkspacePartitionConfig } from '@flow-desk/shared'

interface WorkspaceData {
  id: string
  name: string
  abbreviation: string
  color: string
  icon?: string
  browserIsolation?: 'shared' | 'isolated'
  services: Array<{
    id: string
    name: string
    type: string
    url: string
    iconUrl?: string
    isEnabled: boolean
    config: Record<string, any>
  }>
  members?: string[]
  created: Date
  lastAccessed: Date
  isActive: boolean
  // Legacy fields for compatibility
  type?: 'personal' | 'team' | 'organization'
  description?: string
  organizationId?: string
  teamId?: string
  ownerId?: string
  createdAt?: string
  updatedAt?: string
  tags?: string[]
  apps?: string[]
  settings?: Record<string, any>
}

interface WorkspaceWindow {
  windowId: number
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
  bounds: { x: number; y: number; width: number; height: number }
}

interface WorkspaceState {
  workspaces: Record<string, WorkspaceData>
  currentWorkspaceId: string | null
  partitions: Record<string, WorkspacePartitionConfig>
  windows: Record<string, WorkspaceWindow[]>
  isLoading: boolean
  error: string | null
  syncStatus: {
    isSync: boolean
    lastSync: string | null
    error: string | null
  }
}

const initialState: WorkspaceState = {
  workspaces: {},
  currentWorkspaceId: null,
  partitions: {},
  windows: {},
  isLoading: false,
  error: null,
  syncStatus: {
    isSync: false,
    lastSync: null,
    error: null
  }
}

// Async thunks
export const loadWorkspaces = createAsyncThunk(
  'workspace/loadWorkspaces',
  async () => {
    const [workspaces, currentWorkspace, partitions] = await Promise.all([
      window.flowDesk.workspace.list(),
      window.flowDesk.workspace.getCurrent(),
      window.flowDesk.workspace.listPartitions()
    ])
    
    const partitionsMap = partitions.reduce((acc, partition) => {
      acc[partition.id] = partition
      return acc
    }, {} as Record<string, WorkspacePartitionConfig>)
    
    return {
      workspaces,
      currentWorkspaceId: currentWorkspace?.id || null,
      partitions: partitionsMap
    }
  }
)

export const switchWorkspace = createAsyncThunk(
  'workspace/switchWorkspace',
  async (workspaceId: string) => {
    await window.flowDesk.workspace.switch(workspaceId)
    return workspaceId
  }
)

export const createWorkspace = createAsyncThunk(
  'workspace/createWorkspace',
  async (workspace: Omit<WorkspaceData, 'createdAt' | 'updatedAt'>) => {
    const newWorkspace = await window.flowDesk.workspace.create(workspace)
    
    // Create corresponding partition
    const partitionConfig: WorkspacePartitionConfig = {
      id: workspace.id,
      name: workspace.name,
      partitionId: `persist:${workspace.id}`,
      ephemeral: false,
      permissions: {
        notifications: true,
        geolocation: false,
        camera: false,
        microphone: false,
        clipboard: true,
        fullscreen: true,
        plugins: true,
        popups: false
      },
      security: {
        webSecurity: true,
        allowInsecureContent: false,
        experimentalFeatures: false,
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      }
    }
    
    await window.flowDesk.workspace.createPartition(partitionConfig)
    
    return { workspace: newWorkspace, partition: partitionConfig }
  }
)

export const updateWorkspace = createAsyncThunk(
  'workspace/updateWorkspace',
  async ({ workspaceId, updates }: { workspaceId: string; updates: Partial<WorkspaceData> }) => {
    await window.flowDesk.workspace.update(workspaceId, updates)
    return { workspaceId, updates }
  }
)

export const deleteWorkspace = createAsyncThunk(
  'workspace/deleteWorkspace',
  async (workspaceId: string) => {
    await window.flowDesk.workspace.delete(workspaceId)
    return workspaceId
  }
)

export const updatePartition = createAsyncThunk(
  'workspace/updatePartition',
  async ({ workspaceId, updates }: { workspaceId: string; updates: Partial<WorkspacePartitionConfig> }) => {
    await window.flowDesk.workspace.updatePartition(workspaceId, updates)
    return { workspaceId, updates }
  }
)

export const clearWorkspaceData = createAsyncThunk(
  'workspace/clearData',
  async (workspaceId: string) => {
    await window.flowDesk.workspace.clearData(workspaceId)
    return workspaceId
  }
)

export const loadWorkspaceWindows = createAsyncThunk(
  'workspace/loadWindows',
  async (workspaceId: string) => {
    const windows = await window.flowDesk.workspace.getWindows(workspaceId)
    return { workspaceId, windows }
  }
)

export const createWorkspaceWindow = createAsyncThunk(
  'workspace/createWindow',
  async ({ workspaceId, options }: { workspaceId: string; options: Electron.BrowserWindowConstructorOptions }) => {
    const result = await window.flowDesk.workspace.createWindow({ workspaceId, ...options })
    return result
  }
)

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    setSyncStatus: (state, action: PayloadAction<Partial<WorkspaceState['syncStatus']>>) => {
      state.syncStatus = { ...state.syncStatus, ...action.payload }
    },
    updateWorkspaceLocal: (state, action: PayloadAction<{ id: string; updates: Partial<WorkspaceData> }>) => {
      const { id, updates } = action.payload
      if (state.workspaces[id]) {
        state.workspaces[id] = { ...state.workspaces[id], ...updates }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Load workspaces
      .addCase(loadWorkspaces.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadWorkspaces.fulfilled, (state, action) => {
        state.isLoading = false
        // Convert workspace array to Record and ensure proper data structure
        const workspacesMap: Record<string, WorkspaceData> = {};
        if (action.payload.workspaces && Array.isArray(action.payload.workspaces)) {
          action.payload.workspaces.forEach((workspace: any) => {
            // Ensure workspace has all required fields with fallbacks
            const workspaceData: WorkspaceData = {
              id: workspace.id || `ws_${Date.now()}`,
              name: workspace.name || 'Unnamed Workspace',
              abbreviation: workspace.abbreviation || workspace.name?.substring(0, 2).toUpperCase() || 'UW',
              color: workspace.color || '#4285f4',
              icon: workspace.icon,
              browserIsolation: workspace.browserIsolation || 'shared',
              services: workspace.services || [],
              members: workspace.members || [],
              created: workspace.created ? new Date(workspace.created) : new Date(),
              lastAccessed: workspace.lastAccessed ? new Date(workspace.lastAccessed) : new Date(),
              isActive: workspace.isActive || false,
              // Legacy compatibility
              type: workspace.type,
              description: workspace.description,
              organizationId: workspace.organizationId,
              teamId: workspace.teamId,
              ownerId: workspace.ownerId,
              createdAt: workspace.createdAt,
              updatedAt: workspace.updatedAt,
              tags: workspace.tags,
              apps: workspace.apps,
              settings: workspace.settings
            };
            workspacesMap[workspace.id] = workspaceData;
          });
        }
        state.workspaces = workspacesMap;
        // Set current workspace, with fallback to first workspace if none is set
        const currentWorkspaceId = action.payload.currentWorkspaceId;
        const workspaceIds = Object.keys(workspacesMap);
        state.currentWorkspaceId = currentWorkspaceId || (workspaceIds.length > 0 ? workspaceIds[0] : null);
        state.partitions = action.payload.partitions || {}
      })
      .addCase(loadWorkspaces.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to load workspaces'
      })
      
      // Switch workspace
      .addCase(switchWorkspace.fulfilled, (state, action) => {
        state.currentWorkspaceId = action.payload
      })
      .addCase(switchWorkspace.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to switch workspace'
      })
      
      // Create workspace
      .addCase(createWorkspace.fulfilled, (state, action) => {
        const { workspace, partition } = action.payload
        // Ensure the workspace has all required fields
        const workspaceData: WorkspaceData = {
          id: workspace.id || `ws_${Date.now()}`,
          name: workspace.name || 'New Workspace',
          abbreviation: workspace.abbreviation || workspace.name?.substring(0, 2).toUpperCase() || 'NW',
          color: workspace.color || '#4285f4',
          icon: workspace.icon,
          browserIsolation: workspace.browserIsolation || 'shared',
          services: workspace.services || [],
          members: workspace.members || [],
          created: workspace.created ? new Date(workspace.created) : new Date(),
          lastAccessed: workspace.lastAccessed ? new Date(workspace.lastAccessed) : new Date(),
          isActive: workspace.isActive || false,
          // Legacy compatibility
          type: workspace.type,
          description: workspace.description,
          organizationId: workspace.organizationId,
          teamId: workspace.teamId,
          ownerId: workspace.ownerId,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          tags: workspace.tags,
          apps: workspace.apps,
          settings: workspace.settings
        };
        state.workspaces[workspace.id] = workspaceData
        if (partition) {
          state.partitions[partition.id] = partition
        }
      })
      .addCase(createWorkspace.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create workspace'
      })
      
      // Update workspace
      .addCase(updateWorkspace.fulfilled, (state, action) => {
        const { workspaceId, updates } = action.payload
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId] = { ...state.workspaces[workspaceId], ...updates };
        }
      })
      .addCase(updateWorkspace.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update workspace'
      })
      
      // Delete workspace
      .addCase(deleteWorkspace.fulfilled, (state, action) => {
        const workspaceId = action.payload
        delete state.workspaces[workspaceId]
        delete state.partitions[workspaceId]
        delete state.windows[workspaceId]
        if (state.currentWorkspaceId === workspaceId) {
          const remainingWorkspaces = Object.keys(state.workspaces)
          state.currentWorkspaceId = remainingWorkspaces.length > 0 ? remainingWorkspaces[0] : null
        }
      })
      .addCase(deleteWorkspace.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete workspace'
      })
      
      // Update partition
      .addCase(updatePartition.fulfilled, (state, action) => {
        const { workspaceId, updates } = action.payload
        if (state.partitions[workspaceId]) {
          state.partitions[workspaceId] = { ...state.partitions[workspaceId], ...updates }
        }
      })
      
      // Load workspace windows
      .addCase(loadWorkspaceWindows.fulfilled, (state, action) => {
        const { workspaceId, windows } = action.payload
        state.windows[workspaceId] = windows
      })
      
      // Create workspace window
      .addCase(createWorkspaceWindow.fulfilled, (state, action) => {
        const { workspaceId, windowId } = action.payload
        // Window will be loaded in the next loadWorkspaceWindows call
      })
  }
})

export const {
  setLoading,
  setError,
  clearError,
  setSyncStatus,
  updateWorkspaceLocal
} = workspaceSlice.actions

export default workspaceSlice.reducer