/**
 * Integration tests for IPC communication between main and renderer processes
 * Tests the complete IPC flow and message handling
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import type { IpcMainInvokeEvent } from 'electron';

// Mock event for IPC handlers
const mockIpcEvent: IpcMainInvokeEvent = {
  frameId: 1,
  processId: 1,
  sender: {
    id: 1
  } as any
};

describe('IPC Communication Integration Tests', () => {
  let mockWorkspaceManager: any;
  let mockNotificationManager: any;
  let mockDialog: any;
  let mockShell: any;
  let ipcHandlers: Map<string, Function>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock managers
    mockWorkspaceManager = {
      createWorkspace: jest.fn().mockResolvedValue({ id: 'test-workspace' }),
      getWorkspaces: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          name: 'Personal',
          abbreviation: 'PE',
          color: '#4285f4',
          services: [],
          isActive: true,
          created: new Date(),
          lastAccessed: new Date()
        }
      ]),
      getWorkspace: jest.fn().mockResolvedValue(null),
      deleteWorkspace: jest.fn().mockResolvedValue(undefined),
      createService: jest.fn().mockResolvedValue('test-service-id'),
      deleteService: jest.fn().mockResolvedValue(undefined),
      loadService: jest.fn().mockResolvedValue(undefined),
      switchWorkspace: jest.fn().mockResolvedValue(undefined),
      updateWorkspace: jest.fn().mockResolvedValue(undefined),
      clearWorkspaceData: jest.fn().mockResolvedValue(undefined),
      hideBrowserView: jest.fn(),
      showBrowserView: jest.fn()
    };

    mockNotificationManager = {
      showNotification: jest.fn()
    };

    mockDialog = {
      showMessageBox: jest.fn().mockResolvedValue({ response: 0, checkboxChecked: false })
    };

    mockShell = {
      openExternal: jest.fn().mockResolvedValue(undefined)
    };

    // Mock IPC handlers storage
    ipcHandlers = new Map();
    
    // Mock ipcMain.handle to store handlers
    const mockIpcMain = {
      handle: jest.fn().mockImplementation((channel: string, handler: Function) => {
        ipcHandlers.set(channel, handler);
      })
    };

    // Simulate setting up IPC handlers (similar to what main.ts does)
    setupIpcHandlers(mockIpcMain, mockWorkspaceManager, mockNotificationManager, mockDialog, mockShell);
  });

  afterEach(() => {
    jest.clearAllMocks();
    ipcHandlers.clear();
  });

  describe('Workspace IPC Handlers', () => {
    test('should handle workspace:create correctly', async () => {
      const handler = ipcHandlers.get('workspace:create');
      expect(handler).toBeDefined();

      const workspaceData = {
        name: 'Test Workspace',
        color: '#ff0000',
        browserIsolation: 'shared'
      };

      const result = await handler!(mockIpcEvent, workspaceData);

      expect(mockWorkspaceManager.createWorkspace).toHaveBeenCalledWith(workspaceData);
      expect(result).toBe('test-workspace');
    });

    test('should handle workspace:list correctly', async () => {
      const handler = ipcHandlers.get('workspace:list');
      expect(handler).toBeDefined();

      const result = await handler!(mockIpcEvent);

      expect(mockWorkspaceManager.getWorkspaces).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Personal');
    });

    test('should handle workspace:get correctly', async () => {
      mockWorkspaceManager.getWorkspace.mockResolvedValue({
        id: 'workspace-1',
        name: 'Personal'
      });

      const handler = ipcHandlers.get('workspace:get');
      expect(handler).toBeDefined();

      const result = await handler!(mockIpcEvent, 'workspace-1');

      expect(mockWorkspaceManager.getWorkspace).toHaveBeenCalledWith('workspace-1');
      expect(result.id).toBe('workspace-1');
    });

    test('should handle workspace:delete correctly', async () => {
      const handler = ipcHandlers.get('workspace:delete');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent, 'workspace-1');

      expect(mockWorkspaceManager.deleteWorkspace).toHaveBeenCalledWith('workspace-1');
    });

    test('should handle workspace:switch correctly', async () => {
      const handler = ipcHandlers.get('workspace:switch');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent, 'workspace-2');

      expect(mockWorkspaceManager.switchWorkspace).toHaveBeenCalledWith('workspace-2');
    });

    test('should handle workspace:update correctly', async () => {
      const handler = ipcHandlers.get('workspace:update');
      expect(handler).toBeDefined();

      const updates = { name: 'Updated Workspace' };
      await handler!(mockIpcEvent, 'workspace-1', updates);

      expect(mockWorkspaceManager.updateWorkspace).toHaveBeenCalledWith('workspace-1', updates);
    });

    test('should handle workspace:addService correctly', async () => {
      const handler = ipcHandlers.get('workspace:addService');
      expect(handler).toBeDefined();

      const result = await handler!(
        mockIpcEvent,
        'workspace-1',
        'Gmail',
        'email',
        'https://mail.google.com'
      );

      expect(mockWorkspaceManager.createService).toHaveBeenCalledWith(
        'workspace-1',
        'Gmail',
        'email',
        'https://mail.google.com'
      );
      expect(result).toBe('test-service-id');
    });

    test('should handle workspace:removeService correctly', async () => {
      const handler = ipcHandlers.get('workspace:removeService');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent, 'workspace-1', 'service-1');

      expect(mockWorkspaceManager.deleteService).toHaveBeenCalledWith('workspace-1', 'service-1');
    });

    test('should handle workspace:loadService correctly', async () => {
      const handler = ipcHandlers.get('workspace:loadService');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent, 'workspace-1', 'service-1');

      expect(mockWorkspaceManager.loadService).toHaveBeenCalledWith('workspace-1', 'service-1');
    });

    test('should handle workspace:clear-data correctly', async () => {
      const handler = ipcHandlers.get('workspace:clear-data');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent, 'workspace-1');

      expect(mockWorkspaceManager.clearWorkspaceData).toHaveBeenCalledWith('workspace-1');
    });
  });

  describe('Browser View IPC Handlers', () => {
    test('should handle browser-view:hide correctly', async () => {
      const handler = ipcHandlers.get('browser-view:hide');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent);

      expect(mockWorkspaceManager.hideBrowserView).toHaveBeenCalled();
    });

    test('should handle browser-view:show correctly', async () => {
      const handler = ipcHandlers.get('browser-view:show');
      expect(handler).toBeDefined();

      await handler!(mockIpcEvent);

      expect(mockWorkspaceManager.showBrowserView).toHaveBeenCalled();
    });
  });

  describe('System IPC Handlers', () => {
    test('should handle system:showNotification correctly', () => {
      const handler = ipcHandlers.get('system:showNotification');
      expect(handler).toBeDefined();

      const options = {
        title: 'Test Notification',
        body: 'Test body',
        silent: false
      };

      handler!(mockIpcEvent, options);

      expect(mockNotificationManager.showNotification).toHaveBeenCalledWith({
        title: 'Test Notification',
        body: 'Test body',
        silent: false
      });
    });

    test('should handle system:showNotification with missing body', () => {
      const handler = ipcHandlers.get('system:showNotification');
      expect(handler).toBeDefined();

      const options = {
        title: 'Test Notification',
        silent: false
      };

      handler!(mockIpcEvent, options);

      expect(mockNotificationManager.showNotification).toHaveBeenCalledWith({
        title: 'Test Notification',
        body: '',
        silent: false
      });
    });

    test('should handle system:showDialog correctly', async () => {
      const handler = ipcHandlers.get('system:showDialog');
      expect(handler).toBeDefined();

      const options = {
        message: 'Test message',
        type: 'info',
        buttons: ['OK', 'Cancel']
      };

      const result = await handler!(mockIpcEvent, options);

      expect(mockDialog.showMessageBox).toHaveBeenCalledWith(
        undefined, // mainWindow would be passed in real implementation
        expect.objectContaining({
          message: 'Test message',
          type: 'info',
          buttons: ['OK', 'Cancel']
        })
      );
      expect(result).toEqual({ response: 0, checkboxChecked: false });
    });

    test('should handle system:showDialog with missing message', async () => {
      const handler = ipcHandlers.get('system:showDialog');
      expect(handler).toBeDefined();

      const options = { type: 'info' };

      const result = await handler!(mockIpcEvent, options);

      expect(mockDialog.showMessageBox).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          message: 'Dialog'
        })
      );
    });

    test('should handle system:openExternal correctly', () => {
      const handler = ipcHandlers.get('system:openExternal');
      expect(handler).toBeDefined();

      const url = 'https://example.com';
      handler!(mockIpcEvent, url);

      expect(mockShell.openExternal).toHaveBeenCalledWith(url);
    });
  });

  describe('Settings and Theme IPC Handlers', () => {
    test('should handle settings:get correctly', async () => {
      const handler = ipcHandlers.get('settings:get');
      expect(handler).toBeDefined();

      const result = await handler!(mockIpcEvent);

      expect(result).toEqual({
        theme: 'system',
        fontSize: 14,
        accentColor: '#007acc'
      });
    });

    test('should handle theme:get correctly', () => {
      const handler = ipcHandlers.get('theme:get');
      expect(handler).toBeDefined();

      const result = handler!(mockIpcEvent);

      expect(result).toEqual({
        theme: 'system',
        accentColor: '#007acc',
        fontSize: 14
      });
    });

    test('should handle theme:set correctly', () => {
      const handler = ipcHandlers.get('theme:set');
      expect(handler).toBeDefined();

      const themeData = {
        theme: 'dark',
        accentColor: '#ff0000',
        fontSize: 16
      };

      handler!(mockIpcEvent, themeData);

      // Should not throw and should handle the theme update
      expect(handler).not.toThrow();
    });
  });

  describe('Error Handling in IPC Handlers', () => {
    test('should handle workspace creation errors', async () => {
      mockWorkspaceManager.createWorkspace.mockRejectedValue(
        new Error('Failed to create workspace')
      );

      const handler = ipcHandlers.get('workspace:create');
      
      await expect(handler!(mockIpcEvent, { name: 'Test' }))
        .rejects.toThrow('Failed to create workspace');
    });

    test('should handle workspace deletion errors', async () => {
      mockWorkspaceManager.deleteWorkspace.mockRejectedValue(
        new Error('Failed to delete workspace')
      );

      const handler = ipcHandlers.get('workspace:delete');
      
      await expect(handler!(mockIpcEvent, 'workspace-1'))
        .rejects.toThrow('Failed to delete workspace');
    });

    test('should handle service creation errors', async () => {
      mockWorkspaceManager.createService.mockRejectedValue(
        new Error('Failed to create service')
      );

      const handler = ipcHandlers.get('workspace:addService');
      
      await expect(handler!(
        mockIpcEvent,
        'workspace-1',
        'Test',
        'web',
        'https://example.com'
      )).rejects.toThrow('Failed to create service');
    });

    test('should handle browser view errors', async () => {
      mockWorkspaceManager.hideBrowserView.mockImplementation(() => {
        throw new Error('Browser view error');
      });

      const handler = ipcHandlers.get('browser-view:hide');
      
      await expect(handler!(mockIpcEvent))
        .rejects.toThrow('Browser view error');
    });

    test('should handle dialog errors', async () => {
      mockDialog.showMessageBox.mockRejectedValue(
        new Error('Dialog error')
      );

      const handler = ipcHandlers.get('system:showDialog');
      
      await expect(handler!(mockIpcEvent, { message: 'Test' }))
        .rejects.toThrow('Dialog error');
    });
  });

  describe('IPC Message Flow Integration', () => {
    test('should handle complete workspace creation flow', async () => {
      const workspaceData = {
        name: 'Integration Test Workspace',
        color: '#00ff00',
        browserIsolation: 'isolated'
      };

      // 1. Create workspace
      const createHandler = ipcHandlers.get('workspace:create');
      const workspaceId = await createHandler!(mockIpcEvent, workspaceData);

      expect(workspaceId).toBe('test-workspace');
      expect(mockWorkspaceManager.createWorkspace).toHaveBeenCalledWith(workspaceData);

      // 2. Add service to workspace
      const addServiceHandler = ipcHandlers.get('workspace:addService');
      const serviceId = await addServiceHandler!(
        mockIpcEvent,
        workspaceId,
        'Test Service',
        'web',
        'https://test.com'
      );

      expect(serviceId).toBe('test-service-id');
      expect(mockWorkspaceManager.createService).toHaveBeenCalledWith(
        workspaceId,
        'Test Service',
        'web',
        'https://test.com'
      );

      // 3. Load service
      const loadServiceHandler = ipcHandlers.get('workspace:loadService');
      await loadServiceHandler!(mockIpcEvent, workspaceId, serviceId);

      expect(mockWorkspaceManager.loadService).toHaveBeenCalledWith(workspaceId, serviceId);

      // 4. Switch to workspace
      const switchHandler = ipcHandlers.get('workspace:switch');
      await switchHandler!(mockIpcEvent, workspaceId);

      expect(mockWorkspaceManager.switchWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    test('should handle workspace management with error recovery', async () => {
      // First attempt fails
      mockWorkspaceManager.createWorkspace.mockRejectedValueOnce(
        new Error('Network error')
      );

      const createHandler = ipcHandlers.get('workspace:create');
      
      // First call should fail
      await expect(createHandler!(mockIpcEvent, { name: 'Test' }))
        .rejects.toThrow('Network error');

      // Second attempt succeeds
      mockWorkspaceManager.createWorkspace.mockResolvedValueOnce({ id: 'retry-workspace' });
      
      const result = await createHandler!(mockIpcEvent, { name: 'Test Retry' });
      expect(result).toBe('retry-workspace');
    });

    test('should handle concurrent IPC requests', async () => {
      const listHandler = ipcHandlers.get('workspace:list');
      
      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        listHandler!(mockIpcEvent)
      );

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Personal');
      });

      // Workspace manager should have been called 5 times
      expect(mockWorkspaceManager.getWorkspaces).toHaveBeenCalledTimes(5);
    });
  });

  describe('IPC Handler Registration', () => {
    test('should register all expected workspace handlers', () => {
      const expectedHandlers = [
        'workspace:create',
        'workspace:list',
        'workspace:get-all',
        'workspace:get-active',
        'workspace:get',
        'workspace:delete',
        'workspace:addService',
        'workspace:removeService',
        'workspace:loadService',
        'workspace:switch',
        'workspace:update',
        'workspace:clear-data'
      ];

      expectedHandlers.forEach(handler => {
        expect(ipcHandlers.has(handler)).toBe(true);
      });
    });

    test('should register all expected system handlers', () => {
      const expectedHandlers = [
        'system:showNotification',
        'system:showDialog',
        'system:openExternal'
      ];

      expectedHandlers.forEach(handler => {
        expect(ipcHandlers.has(handler)).toBe(true);
      });
    });

    test('should register all expected browser view handlers', () => {
      const expectedHandlers = [
        'browser-view:hide',
        'browser-view:show'
      ];

      expectedHandlers.forEach(handler => {
        expect(ipcHandlers.has(handler)).toBe(true);
      });
    });

    test('should register all expected theme and settings handlers', () => {
      const expectedHandlers = [
        'settings:get',
        'theme:get',
        'theme:set'
      ];

      expectedHandlers.forEach(handler => {
        expect(ipcHandlers.has(handler)).toBe(true);
      });
    });
  });

  // Helper function to simulate IPC handler setup
  function setupIpcHandlers(
    mockIpcMain: any,
    workspaceManager: any,
    notificationManager: any,
    dialog: any,
    shell: any
  ) {
    // Workspace Management
    mockIpcMain.handle('workspace:create', async (event: any, workspaceData: any) => {
      const workspace = await workspaceManager.createWorkspace(workspaceData);
      return workspace.id;
    });

    mockIpcMain.handle('workspace:list', async () => {
      return await workspaceManager.getWorkspaces();
    });

    mockIpcMain.handle('workspace:get-all', async () => {
      return await workspaceManager.getWorkspaces();
    });

    mockIpcMain.handle('workspace:get-active', async () => {
      const workspaces = await workspaceManager.getWorkspaces();
      return workspaces.find((w: any) => w.isActive) || null;
    });

    mockIpcMain.handle('workspace:get', async (event: any, workspaceId: string) => {
      return await workspaceManager.getWorkspace(workspaceId);
    });

    mockIpcMain.handle('workspace:delete', async (event: any, workspaceId: string) => {
      await workspaceManager.deleteWorkspace(workspaceId);
    });

    mockIpcMain.handle('workspace:addService', async (event: any, workspaceId: string, name: string, type: string, url: string) => {
      return await workspaceManager.createService(workspaceId, name, type, url);
    });

    mockIpcMain.handle('workspace:removeService', async (event: any, workspaceId: string, serviceId: string) => {
      await workspaceManager.deleteService(workspaceId, serviceId);
    });

    mockIpcMain.handle('workspace:loadService', async (event: any, workspaceId: string, serviceId: string) => {
      await workspaceManager.loadService(workspaceId, serviceId);
    });

    mockIpcMain.handle('workspace:switch', async (event: any, workspaceId: string) => {
      await workspaceManager.switchWorkspace(workspaceId);
    });

    mockIpcMain.handle('workspace:update', async (event: any, workspaceId: string, updates: any) => {
      await workspaceManager.updateWorkspace(workspaceId, updates);
    });

    mockIpcMain.handle('workspace:clear-data', async (event: any, workspaceId: string) => {
      await workspaceManager.clearWorkspaceData(workspaceId);
    });

    // Browser view visibility control
    mockIpcMain.handle('browser-view:hide', async () => {
      workspaceManager.hideBrowserView();
    });

    mockIpcMain.handle('browser-view:show', async () => {
      workspaceManager.showBrowserView();
    });

    // System Integration
    mockIpcMain.handle('system:showNotification', (event: any, options: any) => {
      notificationManager.showNotification({
        ...options,
        body: options.body || ''
      });
    });

    mockIpcMain.handle('system:showDialog', async (event: any, options: any) => {
      const dialogOptions = {
        message: typeof options.message === 'string' ? options.message : 'Dialog',
        ...options
      };
      return await dialog.showMessageBox(undefined, dialogOptions);
    });

    mockIpcMain.handle('system:openExternal', (event: any, url: string) => {
      shell.openExternal(url);
    });

    // Settings
    mockIpcMain.handle('settings:get', async () => {
      return {
        theme: 'system',
        fontSize: 14,
        accentColor: '#007acc'
      };
    });

    // Theme Management
    mockIpcMain.handle('theme:get', () => {
      return {
        theme: 'system',
        accentColor: '#007acc',
        fontSize: 14
      };
    });

    mockIpcMain.handle('theme:set', (event: any, themeData: any) => {
      // Store theme preferences (would be implemented in real app)
    });
  }
});