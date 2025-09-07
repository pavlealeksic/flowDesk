/**
 * Comprehensive unit tests for workspaceSlice Redux store
 * Tests all actions, reducers, and selectors
 */

import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import workspaceSlice, {
  loadWorkspaces,
  switchWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  updatePartition,
  clearWorkspaceData,
  loadWorkspaceWindows,
  createWorkspaceWindow,
  setLoading,
  setError,
  clearError,
  setSyncStatus,
  updateWorkspaceLocal,
  selectAllWorkspaces,
  selectCurrentWorkspace,
  selectWorkspaceById,
  selectWorkspacePartitions,
  selectPartitionById,
  selectWorkspaceWindows,
  selectActiveWorkspaces,
  selectWorkspacesByType,
  selectSortedWorkspaces,
  selectWorkspaceLoading,
  selectWorkspaceError,
  selectWorkspaceSyncStatus
} from '../../../renderer/store/slices/workspaceSlice';

// Mock window.flowDesk API
const mockFlowDeskAPI = {
  workspace: {
    list: vi.fn(),
    getCurrent: vi.fn(),
    listPartitions: vi.fn(),
    switch: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updatePartition: vi.fn(),
    clearData: vi.fn(),
    getWindows: vi.fn(),
    createWindow: vi.fn(),
    createPartition: vi.fn()
  }
};

// Setup global window mock
Object.defineProperty(window, 'flowDesk', {
  value: mockFlowDeskAPI,
  writable: true,
  configurable: true
});

describe('workspaceSlice', () => {
  let store: ReturnType<typeof configureStore>;

  const mockWorkspaces = [
    {
      id: 'workspace-1',
      name: 'Personal',
      abbreviation: 'PE',
      color: '#4285f4',
      browserIsolation: 'shared',
      services: [
        {
          id: 'service-1',
          name: 'Gmail',
          type: 'email',
          url: 'https://mail.google.com',
          isEnabled: true,
          config: {}
        }
      ],
      members: [],
      created: new Date('2024-01-01'),
      lastAccessed: new Date('2024-01-02'),
      isActive: true
    },
    {
      id: 'workspace-2',
      name: 'Work',
      abbreviation: 'WO',
      color: '#34a853',
      browserIsolation: 'isolated',
      services: [],
      members: [],
      created: new Date('2024-01-03'),
      lastAccessed: new Date('2024-01-04'),
      isActive: false,
      type: 'team'
    }
  ];

  const mockPartitions = [
    {
      id: 'workspace-1',
      name: 'Personal',
      partitionId: 'persist:workspace-1',
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
  ];

  const mockWindows = [
    {
      windowId: 1,
      isVisible: true,
      isMinimized: false,
      isMaximized: false,
      bounds: { x: 0, y: 0, width: 1200, height: 800 }
    }
  ];

  beforeEach(() => {
    // Create fresh store
    store = configureStore({
      reducer: {
        workspace: workspaceSlice
      }
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default API responses
    mockFlowDeskAPI.workspace.list.mockResolvedValue(mockWorkspaces);
    mockFlowDeskAPI.workspace.getCurrent.mockResolvedValue(mockWorkspaces[0]);
    mockFlowDeskAPI.workspace.listPartitions.mockResolvedValue(mockPartitions);
    mockFlowDeskAPI.workspace.switch.mockResolvedValue(undefined);
    mockFlowDeskAPI.workspace.create.mockResolvedValue('new-workspace-id');
    mockFlowDeskAPI.workspace.update.mockResolvedValue(undefined);
    mockFlowDeskAPI.workspace.delete.mockResolvedValue(undefined);
    mockFlowDeskAPI.workspace.updatePartition.mockResolvedValue(undefined);
    mockFlowDeskAPI.workspace.clearData.mockResolvedValue(undefined);
    mockFlowDeskAPI.workspace.getWindows.mockResolvedValue(mockWindows);
    mockFlowDeskAPI.workspace.createWindow.mockResolvedValue(123);
    mockFlowDeskAPI.workspace.createPartition.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const state = store.getState().workspace;

      expect(state).toEqual({
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
      });
    });
  });

  describe('Synchronous Actions', () => {
    test('should handle setLoading', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().workspace.isLoading).toBe(true);

      store.dispatch(setLoading(false));
      expect(store.getState().workspace.isLoading).toBe(false);
    });

    test('should handle setError', () => {
      store.dispatch(setError('Test error'));
      expect(store.getState().workspace.error).toBe('Test error');

      store.dispatch(setError(null));
      expect(store.getState().workspace.error).toBeNull();
    });

    test('should handle clearError', () => {
      store.dispatch(setError('Test error'));
      store.dispatch(clearError());
      expect(store.getState().workspace.error).toBeNull();
    });

    test('should handle setSyncStatus', () => {
      const syncStatus = { isSync: true, lastSync: '2024-01-01', error: 'Sync error' };
      store.dispatch(setSyncStatus(syncStatus));
      
      expect(store.getState().workspace.syncStatus).toEqual(syncStatus);
    });

    test('should handle updateWorkspaceLocal', () => {
      // First add a workspace
      const state = store.getState();
      state.workspace.workspaces['workspace-1'] = mockWorkspaces[0] as any;

      store.dispatch(updateWorkspaceLocal({
        id: 'workspace-1',
        updates: { name: 'Updated Personal' }
      }));

      const updatedWorkspace = store.getState().workspace.workspaces['workspace-1'];
      expect(updatedWorkspace.name).toBe('Updated Personal');
    });
  });

  describe('Async Thunks', () => {
    describe('loadWorkspaces', () => {
      test('should load workspaces successfully', async () => {
        const action = await store.dispatch(loadWorkspaces());

        expect(action.type).toBe(loadWorkspaces.fulfilled.type);
        
        const state = store.getState().workspace;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(Object.keys(state.workspaces)).toHaveLength(2);
        expect(state.workspaces['workspace-1'].name).toBe('Personal');
        expect(state.workspaces['workspace-2'].name).toBe('Work');
        expect(state.currentWorkspaceId).toBe('workspace-1');
      });

      test('should handle loading state', async () => {
        mockFlowDeskAPI.workspace.list.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(mockWorkspaces), 100))
        );

        const promise = store.dispatch(loadWorkspaces());
        
        expect(store.getState().workspace.isLoading).toBe(true);
        expect(store.getState().workspace.error).toBeNull();

        await promise;
        expect(store.getState().workspace.isLoading).toBe(false);
      });

      test('should handle error state', async () => {
        const errorMessage = 'Failed to load workspaces';
        mockFlowDeskAPI.workspace.list.mockRejectedValue(new Error(errorMessage));

        const action = await store.dispatch(loadWorkspaces());

        expect(action.type).toBe(loadWorkspaces.rejected.type);
        
        const state = store.getState().workspace;
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(errorMessage);
      });

      test('should set first workspace as current if none is active', async () => {
        const workspacesWithoutCurrent = mockWorkspaces.map(w => ({ ...w, isActive: false }));
        mockFlowDeskAPI.workspace.list.mockResolvedValue(workspacesWithoutCurrent);
        mockFlowDeskAPI.workspace.getCurrent.mockResolvedValue(null);

        await store.dispatch(loadWorkspaces());

        const state = store.getState().workspace;
        expect(state.currentWorkspaceId).toBe('workspace-1');
      });

      test('should handle missing data gracefully', async () => {
        const incompleteWorkspaces = [
          {
            id: 'workspace-1',
            // Missing required fields
          }
        ];
        mockFlowDeskAPI.workspace.list.mockResolvedValue(incompleteWorkspaces);

        await store.dispatch(loadWorkspaces());

        const state = store.getState().workspace;
        const workspace = state.workspaces['workspace-1'];
        
        expect(workspace.name).toBe('Unnamed Workspace');
        expect(workspace.abbreviation).toBe('UW');
        expect(workspace.color).toBe('#4285f4');
        expect(workspace.services).toEqual([]);
      });
    });

    describe('switchWorkspace', () => {
      test('should switch workspace successfully', async () => {
        await store.dispatch(switchWorkspace('workspace-2'));

        expect(mockFlowDeskAPI.workspace.switch).toHaveBeenCalledWith('workspace-2');
        expect(store.getState().workspace.currentWorkspaceId).toBe('workspace-2');
      });

      test('should handle switch error', async () => {
        const errorMessage = 'Failed to switch workspace';
        mockFlowDeskAPI.workspace.switch.mockRejectedValue(new Error(errorMessage));

        const action = await store.dispatch(switchWorkspace('workspace-2'));

        expect(action.type).toBe(switchWorkspace.rejected.type);
        expect(store.getState().workspace.error).toBe(errorMessage);
      });
    });

    describe('createWorkspace', () => {
      test('should create workspace successfully', async () => {
        const newWorkspace = {
          name: 'New Workspace',
          abbreviation: 'NW',
          color: '#ff0000',
          browserIsolation: 'isolated' as const,
          services: [],
          members: [],
          created: '2024-01-01',
          lastAccessed: '2024-01-01',
          isActive: false
        };

        const action = await store.dispatch(createWorkspace(newWorkspace));

        expect(action.type).toBe(createWorkspace.fulfilled.type);
        expect(mockFlowDeskAPI.workspace.create).toHaveBeenCalledWith(newWorkspace);
        expect(mockFlowDeskAPI.workspace.createPartition).toHaveBeenCalled();

        const state = store.getState().workspace;
        expect(state.workspaces['new-workspace-id']).toBeDefined();
        expect(state.workspaces['new-workspace-id'].name).toBe('New Workspace');
        expect(state.partitions['new-workspace-id']).toBeDefined();
      });

      test('should handle create error', async () => {
        const errorMessage = 'Failed to create workspace';
        mockFlowDeskAPI.workspace.create.mockRejectedValue(new Error(errorMessage));

        const action = await store.dispatch(createWorkspace({
          name: 'Test',
          abbreviation: 'TE',
          color: '#ff0000',
          browserIsolation: 'shared',
          services: [],
          members: [],
          created: '2024-01-01',
          lastAccessed: '2024-01-01',
          isActive: false
        }));

        expect(action.type).toBe(createWorkspace.rejected.type);
        expect(store.getState().workspace.error).toBe(errorMessage);
      });
    });

    describe('updateWorkspace', () => {
      test('should update workspace successfully', async () => {
        // Add workspace to state first
        await store.dispatch(loadWorkspaces());

        const updates = { name: 'Updated Personal', color: '#ff0000' };
        await store.dispatch(updateWorkspace({
          workspaceId: 'workspace-1',
          updates
        }));

        expect(mockFlowDeskAPI.workspace.update).toHaveBeenCalledWith('workspace-1', updates);
        
        const workspace = store.getState().workspace.workspaces['workspace-1'];
        expect(workspace.name).toBe('Updated Personal');
        expect(workspace.color).toBe('#ff0000');
      });

      test('should handle update error', async () => {
        const errorMessage = 'Failed to update workspace';
        mockFlowDeskAPI.workspace.update.mockRejectedValue(new Error(errorMessage));

        const action = await store.dispatch(updateWorkspace({
          workspaceId: 'workspace-1',
          updates: { name: 'Updated' }
        }));

        expect(action.type).toBe(updateWorkspace.rejected.type);
        expect(store.getState().workspace.error).toBe(errorMessage);
      });
    });

    describe('deleteWorkspace', () => {
      test('should delete workspace successfully', async () => {
        // Load workspaces first
        await store.dispatch(loadWorkspaces());

        await store.dispatch(deleteWorkspace('workspace-2'));

        expect(mockFlowDeskAPI.workspace.delete).toHaveBeenCalledWith('workspace-2');
        
        const state = store.getState().workspace;
        expect(state.workspaces['workspace-2']).toBeUndefined();
        expect(state.partitions['workspace-2']).toBeUndefined();
        expect(state.windows['workspace-2']).toBeUndefined();
      });

      test('should switch to another workspace when deleting current workspace', async () => {
        // Load workspaces and set workspace-2 as current
        await store.dispatch(loadWorkspaces());
        await store.dispatch(switchWorkspace('workspace-2'));

        // Delete current workspace
        await store.dispatch(deleteWorkspace('workspace-2'));

        const state = store.getState().workspace;
        expect(state.currentWorkspaceId).toBe('workspace-1');
      });

      test('should set currentWorkspaceId to null when deleting last workspace', async () => {
        // Load a single workspace
        mockFlowDeskAPI.workspace.list.mockResolvedValue([mockWorkspaces[0]]);
        await store.dispatch(loadWorkspaces());

        await store.dispatch(deleteWorkspace('workspace-1'));

        const state = store.getState().workspace;
        expect(state.currentWorkspaceId).toBeNull();
      });

      test('should handle delete error', async () => {
        const errorMessage = 'Failed to delete workspace';
        mockFlowDeskAPI.workspace.delete.mockRejectedValue(new Error(errorMessage));

        const action = await store.dispatch(deleteWorkspace('workspace-1'));

        expect(action.type).toBe(deleteWorkspace.rejected.type);
        expect(store.getState().workspace.error).toBe(errorMessage);
      });
    });

    describe('updatePartition', () => {
      test('should update partition successfully', async () => {
        // Load workspaces first to have partitions
        await store.dispatch(loadWorkspaces());

        const updates = { ephemeral: true };
        await store.dispatch(updatePartition({
          workspaceId: 'workspace-1',
          updates
        }));

        expect(mockFlowDeskAPI.workspace.updatePartition).toHaveBeenCalledWith('workspace-1', updates);
        
        const partition = store.getState().workspace.partitions['workspace-1'];
        expect(partition.ephemeral).toBe(true);
      });
    });

    describe('clearWorkspaceData', () => {
      test('should clear workspace data successfully', async () => {
        await store.dispatch(clearWorkspaceData('workspace-1'));

        expect(mockFlowDeskAPI.workspace.clearData).toHaveBeenCalledWith('workspace-1');
      });
    });

    describe('loadWorkspaceWindows', () => {
      test('should load workspace windows successfully', async () => {
        await store.dispatch(loadWorkspaceWindows('workspace-1'));

        expect(mockFlowDeskAPI.workspace.getWindows).toHaveBeenCalledWith('workspace-1');
        
        const windows = store.getState().workspace.windows['workspace-1'];
        expect(windows).toEqual(mockWindows);
      });
    });

    describe('createWorkspaceWindow', () => {
      test('should create workspace window successfully', async () => {
        const options = { width: 800, height: 600 };
        await store.dispatch(createWorkspaceWindow({
          workspaceId: 'workspace-1',
          options
        }));

        expect(mockFlowDeskAPI.workspace.createWindow).toHaveBeenCalledWith(options);
      });
    });
  });

  describe('Selectors', () => {
    beforeEach(async () => {
      // Load workspaces for selector tests
      await store.dispatch(loadWorkspaces());
    });

    test('selectAllWorkspaces should return all workspaces', () => {
      const state = store.getState();
      const workspaces = selectAllWorkspaces(state);

      expect(workspaces).toHaveLength(2);
      expect(workspaces[0].id).toBe('workspace-1');
      expect(workspaces[1].id).toBe('workspace-2');
    });

    test('selectCurrentWorkspace should return current workspace', () => {
      const state = store.getState();
      const currentWorkspace = selectCurrentWorkspace(state);

      expect(currentWorkspace).toBeDefined();
      expect(currentWorkspace?.id).toBe('workspace-1');
      expect(currentWorkspace?.name).toBe('Personal');
    });

    test('selectCurrentWorkspace should return null when no current workspace', () => {
      // Reset current workspace
      store.dispatch(switchWorkspace('non-existent'));
      
      const state = store.getState();
      const currentWorkspace = selectCurrentWorkspace(state);

      expect(currentWorkspace).toBeNull();
    });

    test('selectWorkspaceById should return specific workspace', () => {
      const state = store.getState();
      const workspace = selectWorkspaceById('workspace-2')(state);

      expect(workspace).toBeDefined();
      expect(workspace?.id).toBe('workspace-2');
      expect(workspace?.name).toBe('Work');
    });

    test('selectWorkspaceById should return null for non-existent workspace', () => {
      const state = store.getState();
      const workspace = selectWorkspaceById('non-existent')(state);

      expect(workspace).toBeNull();
    });

    test('selectWorkspacePartitions should return all partitions', () => {
      const state = store.getState();
      const partitions = selectWorkspacePartitions(state);

      expect(partitions).toHaveLength(1);
      expect(partitions[0].id).toBe('workspace-1');
    });

    test('selectPartitionById should return specific partition', () => {
      const state = store.getState();
      const partition = selectPartitionById('workspace-1')(state);

      expect(partition).toBeDefined();
      expect(partition?.id).toBe('workspace-1');
      expect(partition?.name).toBe('Personal');
    });

    test('selectWorkspaceWindows should return workspace windows', async () => {
      await store.dispatch(loadWorkspaceWindows('workspace-1'));
      
      const state = store.getState();
      const windows = selectWorkspaceWindows('workspace-1')(state);

      expect(windows).toEqual(mockWindows);
    });

    test('selectActiveWorkspaces should return only active workspaces', () => {
      const state = store.getState();
      const activeWorkspaces = selectActiveWorkspaces(state);

      expect(activeWorkspaces).toHaveLength(1);
      expect(activeWorkspaces[0].id).toBe('workspace-1');
      expect(activeWorkspaces[0].isActive).toBe(true);
    });

    test('selectWorkspacesByType should group workspaces by type', () => {
      const state = store.getState();
      const workspacesByType = selectWorkspacesByType(state);

      expect(workspacesByType.personal).toHaveLength(1);
      expect(workspacesByType.team).toHaveLength(1);
      expect(workspacesByType.personal[0].id).toBe('workspace-1');
      expect(workspacesByType.team[0].id).toBe('workspace-2');
    });

    test('selectSortedWorkspaces should sort workspaces by lastAccessed', () => {
      const state = store.getState();
      const sortedWorkspaces = selectSortedWorkspaces(state);

      expect(sortedWorkspaces).toHaveLength(2);
      // workspace-2 has later lastAccessed date
      expect(sortedWorkspaces[0].id).toBe('workspace-2');
      expect(sortedWorkspaces[1].id).toBe('workspace-1');
    });

    test('selectWorkspaceLoading should return loading state', () => {
      store.dispatch(setLoading(true));
      
      const state = store.getState();
      const loading = selectWorkspaceLoading(state);

      expect(loading).toBe(true);
    });

    test('selectWorkspaceError should return error state', () => {
      store.dispatch(setError('Test error'));
      
      const state = store.getState();
      const error = selectWorkspaceError(state);

      expect(error).toBe('Test error');
    });

    test('selectWorkspaceSyncStatus should return sync status', () => {
      const syncStatus = { isSync: true, lastSync: '2024-01-01', error: null };
      store.dispatch(setSyncStatus(syncStatus));
      
      const state = store.getState();
      const result = selectWorkspaceSyncStatus(state);

      expect(result).toEqual(syncStatus);
    });
  });

  describe('Memoization', () => {
    test('selectors should be memoized and return same reference for same data', async () => {
      await store.dispatch(loadWorkspaces());
      
      const state1 = store.getState();
      const workspaces1 = selectAllWorkspaces(state1);
      const currentWorkspace1 = selectCurrentWorkspace(state1);

      const state2 = store.getState();
      const workspaces2 = selectAllWorkspaces(state2);
      const currentWorkspace2 = selectCurrentWorkspace(state2);

      // Should return same reference due to memoization
      expect(workspaces1).toBe(workspaces2);
      expect(currentWorkspace1).toBe(currentWorkspace2);
    });

    test('selectors should return new reference when data changes', async () => {
      await store.dispatch(loadWorkspaces());
      
      const state1 = store.getState();
      const workspaces1 = selectAllWorkspaces(state1);

      // Update workspace
      store.dispatch(updateWorkspaceLocal({
        id: 'workspace-1',
        updates: { name: 'Updated Personal' }
      }));

      const state2 = store.getState();
      const workspaces2 = selectAllWorkspaces(state2);

      // Should return different reference after change
      expect(workspaces1).not.toBe(workspaces2);
    });
  });
});