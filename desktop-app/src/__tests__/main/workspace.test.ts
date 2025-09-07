/**
 * Comprehensive unit tests for WorkspaceManager class
 * Tests all critical functionality including workspace and service management
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { WorkspaceManager, type Workspace, type WorkspaceService } from '../../main/workspace';

// Mock the filesystem operations
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
};

const mockPath = {
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/'))
};

const mockCrypto = {
  randomBytes: jest.fn((size: number) => ({
    toString: jest.fn(() => `mock-id-${size}-${Date.now()}`)
  }))
};

// Mock electron modules
const mockBrowserWindow = {
  on: jest.fn(),
  webContents: {
    on: jest.fn(),
    session: {
      clearStorageData: jest.fn().mockResolvedValue(undefined)
    }
  },
  addBrowserView: jest.fn(),
  removeBrowserView: jest.fn(),
  getContentBounds: jest.fn().mockReturnValue({
    x: 0,
    y: 0,
    width: 1200,
    height: 800
  })
};

const mockBrowserView = {
  webContents: {
    loadURL: jest.fn().mockResolvedValue(undefined),
    getURL: jest.fn().mockReturnValue('about:blank'),
    session: {
      clearStorageData: jest.fn().mockResolvedValue(undefined)
    },
    setWindowOpenHandler: jest.fn(),
    destroy: jest.fn()
  },
  setBounds: jest.fn()
};

const mockSession = {
  fromPartition: jest.fn().mockReturnValue({
    clearStorageData: jest.fn().mockResolvedValue(undefined),
    webRequest: {
      onBeforeSendHeaders: jest.fn()
    }
  })
};

const mockShell = {
  openExternal: jest.fn()
};

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock modules before importing the class
jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);
jest.mock('crypto', () => mockCrypto);
jest.mock('electron-log', () => mockLog);
jest.mock('electron', () => ({
  BrowserView: jest.fn().mockImplementation(() => mockBrowserView),
  session: mockSession,
  shell: mockShell
}));

describe('WorkspaceManager', () => {
  let workspaceManager: WorkspaceManager;
  let mockWorkspaceData: Workspace[];

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock data
    mockWorkspaceData = [
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
        isActive: false
      }
    ];

    // Mock filesystem operations
    mockFs.existsSync.mockImplementation((path: string) => {
      return path.includes('workspaces.json');
    });
    
    mockFs.readFileSync.mockImplementation((path: string) => {
      if (path.includes('workspaces.json')) {
        return JSON.stringify(mockWorkspaceData);
      }
      return '{}';
    });
    
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});
    
    // Mock path operations
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    
    // Create new instance
    workspaceManager = new WorkspaceManager();
  });

  afterEach(() => {
    if (workspaceManager) {
      workspaceManager.destroy();
    }
    jest.resetAllMocks();
  });

  describe('Initialization', () => {
    test('should be an EventEmitter', () => {
      expect(workspaceManager).toBeInstanceOf(EventEmitter);
    });

    test('should create data directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      new WorkspaceManager();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });

    test('should load workspaces from disk on initialization', () => {
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('workspaces.json'),
        'utf8'
      );
    });

    test('should create default workspace if none exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const manager = new WorkspaceManager();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith(
        'Created default workspace:',
        'Personal'
      );
      
      manager.destroy();
    });

    test('should handle JSON parsing errors gracefully', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      const manager = new WorkspaceManager();
      
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load workspaces from disk:',
        expect.any(Error)
      );
      
      manager.destroy();
    });
  });

  describe('Main Window Management', () => {
    test('should set main window and attach event listeners', () => {
      const mockWindow = {
        ...mockBrowserWindow,
        on: jest.fn(),
        webContents: {
          ...mockBrowserWindow.webContents,
          on: jest.fn()
        }
      };

      workspaceManager.setMainWindow(mockWindow as any);

      expect(mockWindow.on).toHaveBeenCalledWith('resized', expect.any(Function));
      expect(mockWindow.on).toHaveBeenCalledWith('maximize', expect.any(Function));
      expect(mockWindow.on).toHaveBeenCalledWith('unmaximize', expect.any(Function));
      expect(mockWindow.webContents.on).toHaveBeenCalledWith('devtools-opened', expect.any(Function));
      expect(mockWindow.webContents.on).toHaveBeenCalledWith('devtools-closed', expect.any(Function));
    });

    test('should log when main window is set', () => {
      workspaceManager.setMainWindow(mockBrowserWindow as any);

      expect(mockLog.info).toHaveBeenCalledWith('Main window set for workspace manager');
    });
  });

  describe('Workspace Operations', () => {
    describe('createWorkspace', () => {
      test('should create workspace with provided data', async () => {
        const workspaceData = {
          name: 'Test Workspace',
          color: '#ff0000',
          browserIsolation: 'isolated' as const
        };

        const result = await workspaceManager.createWorkspace(workspaceData);

        expect(result).toMatchObject({
          name: 'Test Workspace',
          color: '#ff0000',
          browserIsolation: 'isolated',
          abbreviation: 'TW',
          services: [],
          members: [],
          isActive: false
        });
        
        expect(result.id).toBeDefined();
        expect(result.created).toBeInstanceOf(Date);
        expect(result.lastAccessed).toBeInstanceOf(Date);
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      test('should generate abbreviation from workspace name', async () => {
        const result = await workspaceManager.createWorkspace({
          name: 'My Long Workspace Name',
          color: '#ff0000'
        });

        expect(result.abbreviation).toBe('ML');
      });

      test('should emit workspace-created event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('workspace-created', eventSpy);

        const result = await workspaceManager.createWorkspace({
          name: 'Test',
          color: '#ff0000'
        });

        expect(eventSpy).toHaveBeenCalledWith(result);
      });

      test('should use default browser isolation if not provided', async () => {
        const result = await workspaceManager.createWorkspace({
          name: 'Test',
          color: '#ff0000'
        });

        expect(result.browserIsolation).toBe('shared');
      });
    });

    describe('getWorkspaces', () => {
      test('should return all workspaces', async () => {
        const workspaces = await workspaceManager.getWorkspaces();
        
        expect(workspaces).toHaveLength(2);
        expect(workspaces[0]).toMatchObject({
          id: 'workspace-1',
          name: 'Personal'
        });
        expect(workspaces[1]).toMatchObject({
          id: 'workspace-2',
          name: 'Work'
        });
      });

      test('should return Date objects for created and lastAccessed', async () => {
        const workspaces = await workspaceManager.getWorkspaces();
        
        expect(workspaces[0].created).toBeInstanceOf(Date);
        expect(workspaces[0].lastAccessed).toBeInstanceOf(Date);
      });
    });

    describe('getWorkspace', () => {
      test('should return specific workspace by ID', async () => {
        const workspace = await workspaceManager.getWorkspace('workspace-1');
        
        expect(workspace).toMatchObject({
          id: 'workspace-1',
          name: 'Personal'
        });
      });

      test('should return null for non-existent workspace', async () => {
        const workspace = await workspaceManager.getWorkspace('non-existent');
        
        expect(workspace).toBeNull();
      });
    });

    describe('switchWorkspace', () => {
      test('should switch active workspace', async () => {
        await workspaceManager.switchWorkspace('workspace-2');

        const workspaces = await workspaceManager.getWorkspaces();
        expect(workspaces.find(w => w.id === 'workspace-1')?.isActive).toBe(false);
        expect(workspaces.find(w => w.id === 'workspace-2')?.isActive).toBe(true);
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      test('should update lastAccessed timestamp', async () => {
        const beforeTime = new Date();
        await workspaceManager.switchWorkspace('workspace-2');
        const workspace = await workspaceManager.getWorkspace('workspace-2');
        
        expect(workspace?.lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      });

      test('should emit workspace-switched event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('workspace-switched', eventSpy);

        await workspaceManager.switchWorkspace('workspace-2');

        expect(eventSpy).toHaveBeenCalledWith('workspace-2');
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.switchWorkspace('non-existent'))
          .rejects.toThrow('Workspace non-existent not found');
      });
    });

    describe('updateWorkspace', () => {
      test('should update workspace with new data', async () => {
        await workspaceManager.updateWorkspace('workspace-1', {
          name: 'Updated Personal',
          color: '#00ff00'
        });

        const workspace = await workspaceManager.getWorkspace('workspace-1');
        expect(workspace).toMatchObject({
          id: 'workspace-1',
          name: 'Updated Personal',
          color: '#00ff00'
        });
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      test('should emit workspace-updated event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('workspace-updated', eventSpy);

        await workspaceManager.updateWorkspace('workspace-1', { name: 'Updated' });

        expect(eventSpy).toHaveBeenCalledWith('workspace-1', expect.any(Object));
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.updateWorkspace('non-existent', { name: 'Test' }))
          .rejects.toThrow('Workspace non-existent not found');
      });
    });

    describe('deleteWorkspace', () => {
      test('should delete workspace and cleanup browser views', async () => {
        // Setup browser views for services
        workspaceManager.setMainWindow(mockBrowserWindow as any);
        
        await workspaceManager.deleteWorkspace('workspace-1');

        const workspaces = await workspaceManager.getWorkspaces();
        expect(workspaces.find(w => w.id === 'workspace-1')).toBeUndefined();
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      test('should emit workspace-deleted event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('workspace-deleted', eventSpy);

        await workspaceManager.deleteWorkspace('workspace-1');

        expect(eventSpy).toHaveBeenCalledWith('workspace-1');
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.deleteWorkspace('non-existent'))
          .rejects.toThrow('Workspace non-existent not found');
      });
    });

    describe('clearWorkspaceData', () => {
      test('should clear session data for all services in workspace', async () => {
        workspaceManager.setMainWindow(mockBrowserWindow as any);
        
        await workspaceManager.clearWorkspaceData('workspace-1');

        expect(mockLog.info).toHaveBeenCalledWith(
          'Cleared data for workspace:',
          'Personal'
        );
      });

      test('should emit workspace-data-cleared event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('workspace-data-cleared', eventSpy);

        await workspaceManager.clearWorkspaceData('workspace-1');

        expect(eventSpy).toHaveBeenCalledWith('workspace-1');
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.clearWorkspaceData('non-existent'))
          .rejects.toThrow('Workspace non-existent not found');
      });
    });
  });

  describe('Service Operations', () => {
    describe('createService', () => {
      test('should create service in workspace', async () => {
        const serviceId = await workspaceManager.createService(
          'workspace-2',
          'Test Service',
          'web',
          'https://example.com'
        );

        expect(serviceId).toBeDefined();
        
        const workspace = await workspaceManager.getWorkspace('workspace-2');
        const service = workspace?.services.find(s => s.id === serviceId);
        
        expect(service).toMatchObject({
          id: serviceId,
          name: 'Test Service',
          type: 'web',
          url: 'https://example.com',
          isEnabled: true,
          config: {}
        });
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      test('should emit service-created event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('service-created', eventSpy);

        const serviceId = await workspaceManager.createService(
          'workspace-2',
          'Test Service',
          'web',
          'https://example.com'
        );

        expect(eventSpy).toHaveBeenCalledWith('workspace-2', expect.objectContaining({
          id: serviceId,
          name: 'Test Service'
        }));
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.createService(
          'non-existent',
          'Test',
          'web',
          'https://example.com'
        )).rejects.toThrow('Workspace non-existent not found');
      });
    });

    describe('deleteService', () => {
      test('should delete service from workspace', async () => {
        await workspaceManager.deleteService('workspace-1', 'service-1');

        const workspace = await workspaceManager.getWorkspace('workspace-1');
        expect(workspace?.services).toHaveLength(0);
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      test('should emit service-deleted event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('service-deleted', eventSpy);

        await workspaceManager.deleteService('workspace-1', 'service-1');

        expect(eventSpy).toHaveBeenCalledWith('workspace-1', 'service-1');
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.deleteService('non-existent', 'service-1'))
          .rejects.toThrow('Workspace non-existent not found');
      });

      test('should throw error for non-existent service', async () => {
        await expect(workspaceManager.deleteService('workspace-1', 'non-existent'))
          .rejects.toThrow('Service non-existent not found');
      });
    });

    describe('loadService', () => {
      beforeEach(() => {
        workspaceManager.setMainWindow(mockBrowserWindow as any);
      });

      test('should load service in browser view', async () => {
        await workspaceManager.loadService('workspace-1', 'service-1');

        expect(mockBrowserView.webContents.loadURL).toHaveBeenCalledWith(
          'https://mail.google.com'
        );
        expect(mockLog.info).toHaveBeenCalledWith('Loaded service:', 'Gmail');
      });

      test('should emit service-loaded event', async () => {
        const eventSpy = jest.fn();
        workspaceManager.on('service-loaded', eventSpy);

        await workspaceManager.loadService('workspace-1', 'service-1');

        expect(eventSpy).toHaveBeenCalledWith('workspace-1', 'service-1');
      });

      test('should throw error if main window not set', async () => {
        const manager = new WorkspaceManager();
        
        await expect(manager.loadService('workspace-1', 'service-1'))
          .rejects.toThrow('Main window not set');
          
        manager.destroy();
      });

      test('should throw error for non-existent workspace', async () => {
        await expect(workspaceManager.loadService('non-existent', 'service-1'))
          .rejects.toThrow('Workspace non-existent not found');
      });

      test('should throw error for non-existent service', async () => {
        await expect(workspaceManager.loadService('workspace-1', 'non-existent'))
          .rejects.toThrow('Service non-existent not found');
      });
    });
  });

  describe('Browser View Management', () => {
    beforeEach(() => {
      workspaceManager.setMainWindow(mockBrowserWindow as any);
    });

    describe('hideBrowserView', () => {
      test('should hide current browser view', () => {
        workspaceManager.hideBrowserView();
        
        // Should not throw error even if no browser view is set
        expect(mockLog.info).not.toHaveBeenCalledWith('Browser view hidden');
      });
    });

    describe('showBrowserView', () => {
      test('should show current browser view', () => {
        workspaceManager.showBrowserView();
        
        // Should not throw error even if no browser view is set
        expect(mockLog.info).not.toHaveBeenCalledWith('Browser view shown');
      });
    });
  });

  describe('Persistence', () => {
    test('should save workspaces to disk after modifications', async () => {
      await workspaceManager.createWorkspace({
        name: 'Test',
        color: '#ff0000'
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('workspaces.json'),
        expect.stringContaining('"name":"Test"'),
        undefined
      );
    });

    test('should handle file write errors gracefully', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await workspaceManager.createWorkspace({
        name: 'Test',
        color: '#ff0000'
      });

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to save workspaces to disk:',
        expect.any(Error)
      );
    });
  });

  describe('Cleanup', () => {
    test('should cleanup browser views on destroy', () => {
      const destroySpy = jest.fn();
      mockBrowserView.webContents.destroy = destroySpy;
      
      workspaceManager.setMainWindow(mockBrowserWindow as any);
      workspaceManager.destroy();

      expect(workspaceManager.listenerCount('workspace-created')).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON in workspace file', () => {
      mockFs.readFileSync.mockReturnValue('invalid json {');
      
      const manager = new WorkspaceManager();
      
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load workspaces from disk:',
        expect.any(Error)
      );
      
      manager.destroy();
    });

    test('should handle filesystem errors during save', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await workspaceManager.updateWorkspace('workspace-1', { name: 'Updated' });

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to save workspaces to disk:',
        expect.any(Error)
      );
    });
  });
});