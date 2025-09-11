/**
 * Integration tests for workspace persistence functionality
 * Tests file system operations, data integrity, and recovery scenarios
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';

// Mock filesystem operations
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn()
};

const mockPath = {
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path: string) => path.split('/').pop() || '')
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
    stop: jest.fn(),
    destroy: jest.fn()
  },
  setBounds: jest.fn()
};

const mockSession = {
  fromPartition: jest.fn().mockReturnValue({
    clearStorageData: jest.fn().mockResolvedValue(undefined)
  })
};

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockConfigManager = {
  getConfig: jest.fn().mockReturnValue({
    environment: 'development',
    memory: {
      maxWebContentsViews: 10,
      memoryThresholdMB: 500,
      memoryMonitorInterval: 30000,
      inactiveCleanupDelay: 1800000,
      enableAutoCleanup: true,
      enableMemoryMonitoring: true
    },
    performance: {
      enabled: true,
      samplingRate: 0.1,
      metricsInterval: 10000,
      enableReactProfiler: false,
      enableBundleAnalysis: false,
      maxPerformanceEntries: 1000
    },
    errorHandling: {
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 30000,
      enableErrorReporting: false
    },
    workspace: {
      maxWorkspaces: 20,
      maxServicesPerWorkspace: 15,
      defaultBrowserIsolation: 'shared',
      enablePreloading: true,
      maxPreloadServices: 5,
      autoSaveInterval: 30000
    },
    security: {
      httpsOnly: false,
      maxUrlLength: 2000,
      allowedProtocols: ['https:', 'http:'],
      enableCSP: true,
      enableIframeSandbox: true,
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 100,
        windowSizeMs: 60000
      }
    },
    development: {
      enableDevTools: false,
      enableHotReload: false,
      enableDebugLogging: false,
      mockExternalServices: false,
      devServerPort: 5173
    },
    dataDirectory: 'data',
    logging: {
      level: 'info',
      enableFileLogging: true,
      maxLogFiles: 5,
      maxLogSizeMB: 10
    }
  }),
  validateConfig: jest.fn().mockReturnValue({ isValid: true }),
  getMemoryConfig: jest.fn().mockReturnValue({
    maxWebContentsViews: 10,
    memoryThresholdMB: 500,
    memoryMonitorInterval: 30000,
    inactiveCleanupDelay: 1800000,
    enableAutoCleanup: true,
    enableMemoryMonitoring: true
  }),
  getWorkspaceConfig: jest.fn().mockReturnValue({
    maxWorkspaces: 20,
    maxServicesPerWorkspace: 15,
    defaultBrowserIsolation: 'shared',
    enablePreloading: true,
    maxPreloadServices: 5,
    autoSaveInterval: 30000
  }),
  getSecurityConfig: jest.fn().mockReturnValue({
    httpsOnly: false,
    maxUrlLength: 2000,
    allowedProtocols: ['https:', 'http:'],
    enableCSP: true,
    enableIframeSandbox: true,
    rateLimiting: {
      enabled: true,
      maxRequestsPerMinute: 100,
      windowSizeMs: 60000
    }
  }),
  getDevelopmentConfig: jest.fn().mockReturnValue({
    enableDevTools: false,
    enableHotReload: false,
    enableDebugLogging: false,
    mockExternalServices: false,
    devServerPort: 5173
  }),
  getPerformanceConfig: jest.fn().mockReturnValue({
    enabled: true,
    samplingRate: 0.1,
    metricsInterval: 10000,
    enableReactProfiler: false,
    enableBundleAnalysis: false,
    maxPerformanceEntries: 1000
  }),
  getErrorHandlingConfig: jest.fn().mockReturnValue({
    enableAutoRecovery: true,
    maxRetryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    enableErrorReporting: false
  }),
  updateConfig: jest.fn().mockReturnValue(true),
  reloadConfig: jest.fn().mockReturnValue(true)
};

// Mock modules
jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);
jest.mock('electron', () => ({
  BrowserView: jest.fn().mockImplementation(() => mockBrowserView),
  session: mockSession,
  shell: { openExternal: jest.fn() }
}));

jest.mock('../../main/config/AppConfig', () => ({
  configManager: mockConfigManager
}));

// Mock electron-log with default export
jest.mock('electron-log', () => mockLog);
jest.mock('electron-log/default', () => mockLog);

// Now import after mocking
import { WorkspaceManager, setTestConfigManager } from '../../main/workspace';
import type { Workspace, WorkspaceService } from '../../main/workspace';

describe('Workspace Persistence Integration Tests', () => {
  let workspaceManager: WorkspaceManager;
  let mockDataPath: string;
  let mockWorkspacesFile: string;
  let persistedData: string;

  const sampleWorkspaces: Workspace[] = [
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
          config: {
            webviewOptions: { webSecurity: true },
            customHeaders: { 'User-Agent': 'FlowDesk' }
          }
        },
        {
          id: 'service-2',
          name: 'Calendar',
          type: 'productivity',
          url: 'https://calendar.google.com',
          isEnabled: true,
          config: {}
        }
      ],
      members: ['user1@example.com', 'user2@example.com'],
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
      services: [
        {
          id: 'service-3',
          name: 'Slack',
          type: 'communication',
          url: 'https://company.slack.com',
          isEnabled: true,
          config: {
            webviewOptions: { nodeIntegration: false }
          }
        }
      ],
      members: [],
      created: new Date('2024-01-03'),
      lastAccessed: new Date('2024-01-04'),
      isActive: false
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up test config manager
    setTestConfigManager(mockConfigManager);

    mockDataPath = '/mock/data/path';
    mockWorkspacesFile = '/mock/data/path/workspaces.json';
    persistedData = JSON.stringify(sampleWorkspaces);

    // Setup filesystem mocks
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    mockFs.existsSync.mockImplementation((path: string) => {
      return path === mockDataPath || path === mockWorkspacesFile;
    });
    mockFs.readFileSync.mockImplementation((path: string) => {
      if (path === mockWorkspacesFile) {
        return persistedData;
      }
      return '{}';
    });
    mockFs.writeFileSync.mockImplementation((path: string, data: string) => {
      if (path === mockWorkspacesFile) {
        persistedData = data;
      }
    });

    // Mock process.cwd() for data path
    jest.spyOn(process, 'cwd').mockReturnValue('/mock/app');
  });

  afterEach(() => {
    if (workspaceManager) {
      workspaceManager.destroy();
    }
    jest.restoreAllMocks();
  });

  describe('Workspace Data Loading', () => {
    test('should load existing workspaces from disk on initialization', () => {
      workspaceManager = new WorkspaceManager();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockWorkspacesFile, 'utf8');
      expect(mockLog.info).toHaveBeenCalledWith('Loaded 2 workspaces from disk');
    });

    test('should handle missing data directory by creating it', () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === mockWorkspacesFile; // Only file exists, not directory
      });

      workspaceManager = new WorkspaceManager();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockDataPath, { recursive: true });
    });

    test('should create default workspace when no data file exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      workspaceManager = new WorkspaceManager();

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith('Created default workspace:', 'Personal');
    });

    test('should handle corrupted JSON gracefully', () => {
      persistedData = 'invalid json {';
      
      workspaceManager = new WorkspaceManager();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load workspaces from disk:',
        expect.any(Error)
      );
      expect(mockLog.info).toHaveBeenCalledWith('Created default workspace:', 'Personal');
    });

    test('should preserve Date objects during load/save cycle', async () => {
      workspaceManager = new WorkspaceManager();

      // Get loaded workspace
      const workspaces = await workspaceManager.getWorkspaces();
      const workspace = workspaces.find(w => w.id === 'workspace-1');

      expect(workspace?.created).toBeInstanceOf(Date);
      expect(workspace?.lastAccessed).toBeInstanceOf(Date);
      expect(workspace?.created.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    test('should maintain data integrity with complex service configurations', async () => {
      workspaceManager = new WorkspaceManager();

      const workspaces = await workspaceManager.getWorkspaces();
      const workspace = workspaces.find(w => w.id === 'workspace-1');
      const service = workspace?.services.find(s => s.id === 'service-1');

      expect(service?.config.webviewOptions?.webSecurity).toBe(true);
      expect(service?.config.customHeaders?.['User-Agent']).toBe('FlowDesk');
    });
  });

  describe('Workspace Data Persistence', () => {
    beforeEach(() => {
      workspaceManager = new WorkspaceManager();
    });

    test('should persist new workspace to disk', async () => {
      const newWorkspace = await workspaceManager.createWorkspace({
        name: 'Test Workspace',
        color: '#ff0000',
        browserIsolation: 'isolated'
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockWorkspacesFile,
        expect.stringContaining('"name":"Test Workspace"'),
        undefined
      );

      // Verify persisted data structure
      const savedData = JSON.parse(persistedData);
      const savedWorkspace = savedData.find((w: any) => w.id === newWorkspace.id);
      expect(savedWorkspace).toBeDefined();
      expect(savedWorkspace.name).toBe('Test Workspace');
      expect(savedWorkspace.browserIsolation).toBe('isolated');
    });

    test('should persist workspace updates', async () => {
      await workspaceManager.updateWorkspace('workspace-1', {
        name: 'Updated Personal',
        color: '#ff00ff'
      });

      expect(mockFs.writeFileSync).toHaveBeenCalled();

      const savedData = JSON.parse(persistedData);
      const updatedWorkspace = savedData.find((w: any) => w.id === 'workspace-1');
      expect(updatedWorkspace.name).toBe('Updated Personal');
      expect(updatedWorkspace.color).toBe('#ff00ff');
    });

    test('should persist service additions', async () => {
      const serviceId = await workspaceManager.createService(
        'workspace-2',
        'Notion',
        'productivity',
        'https://notion.so'
      );

      expect(mockFs.writeFileSync).toHaveBeenCalled();

      const savedData = JSON.parse(persistedData);
      const workspace = savedData.find((w: any) => w.id === 'workspace-2');
      const service = workspace.services.find((s: any) => s.id === serviceId);
      
      expect(service).toBeDefined();
      expect(service.name).toBe('Notion');
      expect(service.url).toBe('https://notion.so');
    });

    test('should persist service deletions', async () => {
      await workspaceManager.deleteService('workspace-1', 'service-1');

      expect(mockFs.writeFileSync).toHaveBeenCalled();

      const savedData = JSON.parse(persistedData);
      const workspace = savedData.find((w: any) => w.id === 'workspace-1');
      const service = workspace.services.find((s: any) => s.id === 'service-1');
      
      expect(service).toBeUndefined();
      expect(workspace.services).toHaveLength(1); // Only service-2 should remain
    });

    test('should persist workspace deletions', async () => {
      await workspaceManager.deleteWorkspace('workspace-2');

      expect(mockFs.writeFileSync).toHaveBeenCalled();

      const savedData = JSON.parse(persistedData);
      const workspace = savedData.find((w: any) => w.id === 'workspace-2');
      
      expect(workspace).toBeUndefined();
      expect(savedData).toHaveLength(1);
    });

    test('should persist workspace switching with updated timestamps', async () => {
      const beforeSwitch = new Date();
      await workspaceManager.switchWorkspace('workspace-2');

      expect(mockFs.writeFileSync).toHaveBeenCalled();

      const savedData = JSON.parse(persistedData);
      const workspace1 = savedData.find((w: any) => w.id === 'workspace-1');
      const workspace2 = savedData.find((w: any) => w.id === 'workspace-2');
      
      expect(workspace1.isActive).toBe(false);
      expect(workspace2.isActive).toBe(true);
      
      const lastAccessed = new Date(workspace2.lastAccessed);
      expect(lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeSwitch.getTime());
    });
  });

  describe('Data Integrity and Validation', () => {
    beforeEach(() => {
      workspaceManager = new WorkspaceManager();
    });

    test('should maintain consistent data after multiple operations', async () => {
      // Perform multiple operations
      const newWorkspace = await workspaceManager.createWorkspace({
        name: 'Multi-Op Test',
        color: '#123456',
        browserIsolation: 'shared'
      });

      const serviceId = await workspaceManager.createService(
        newWorkspace.id,
        'Test Service',
        'web',
        'https://test.com'
      );

      await workspaceManager.updateWorkspace(newWorkspace.id, {
        name: 'Updated Multi-Op Test'
      });

      await workspaceManager.switchWorkspace(newWorkspace.id);

      // Verify final state
      const savedData = JSON.parse(persistedData);
      const workspace = savedData.find((w: any) => w.id === newWorkspace.id);
      
      expect(workspace.name).toBe('Updated Multi-Op Test');
      expect(workspace.isActive).toBe(true);
      expect(workspace.services).toHaveLength(1);
      expect(workspace.services[0].name).toBe('Test Service');
    });

    test('should handle concurrent operations without data corruption', async () => {
      const operations = [
        workspaceManager.updateWorkspace('workspace-1', { name: 'Concurrent 1' }),
        workspaceManager.updateWorkspace('workspace-2', { name: 'Concurrent 2' }),
        workspaceManager.createService('workspace-1', 'Service A', 'web', 'https://a.com'),
        workspaceManager.createService('workspace-2', 'Service B', 'web', 'https://b.com')
      ];

      await Promise.all(operations);

      // Verify all operations completed
      const savedData = JSON.parse(persistedData);
      const workspace1 = savedData.find((w: any) => w.id === 'workspace-1');
      const workspace2 = savedData.find((w: any) => w.id === 'workspace-2');
      
      expect(workspace1.name).toBe('Concurrent 1');
      expect(workspace2.name).toBe('Concurrent 2');
      expect(workspace1.services.some((s: any) => s.name === 'Service A')).toBe(true);
      expect(workspace2.services.some((s: any) => s.name === 'Service B')).toBe(true);
    });

    test('should validate workspace data structure on load', async () => {
      // Create workspace with incomplete data
      const incompleteData = [
        {
          id: 'incomplete-workspace',
          name: 'Incomplete',
          // Missing required fields
        }
      ];
      persistedData = JSON.stringify(incompleteData);

      const newManager = new WorkspaceManager();
      const workspaces = await newManager.getWorkspaces();
      const workspace = workspaces[0];

      // Should have filled in missing fields with defaults
      expect(workspace.abbreviation).toBeDefined();
      expect(workspace.color).toBeDefined();
      expect(workspace.services).toBeDefined();
      expect(workspace.browserIsolation).toBeDefined();
      expect(workspace.created).toBeInstanceOf(Date);

      newManager.destroy();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle filesystem write errors gracefully', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write permission denied');
      });

      workspaceManager = new WorkspaceManager();

      // Operation should complete but log error
      await workspaceManager.createWorkspace({
        name: 'Test',
        color: '#000000',
        browserIsolation: 'shared'
      });

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to save workspaces to disk:',
        expect.any(Error)
      );
    });

    test('should handle filesystem read errors during initialization', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read permission denied');
      });

      workspaceManager = new WorkspaceManager();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load workspaces from disk:',
        expect.any(Error)
      );
      expect(mockLog.info).toHaveBeenCalledWith('Created default workspace:', 'Personal');
    });

    test('should recover from partial data corruption', async () => {
      // Simulate partially corrupted data
      const partiallyCorruptedData = JSON.stringify(sampleWorkspaces).slice(0, -50) + ']}';
      persistedData = partiallyCorruptedData;

      const newManager = new WorkspaceManager();

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to load workspaces from disk:',
        expect.any(Error)
      );

      // Should create default workspace as fallback
      const workspaces = await newManager.getWorkspaces();
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe('Personal');

      newManager.destroy();
    });

    test('should handle disk space errors during save', async () => {
      workspaceManager = new WorkspaceManager();

      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      // Should not crash the application
      await workspaceManager.createWorkspace({
        name: 'Space Test',
        color: '#ffffff',
        browserIsolation: 'shared'
      });

      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to save workspaces to disk:',
        expect.objectContaining({
          message: expect.stringContaining('no space left on device')
        })
      );
    });
  });

  describe('Backup and Recovery Scenarios', () => {
    test('should maintain data consistency during app crash simulation', async () => {
      workspaceManager = new WorkspaceManager();

      // Simulate operations before crash
      await workspaceManager.createWorkspace({
        name: 'Pre-Crash',
        color: '#crash00',
        browserIsolation: 'isolated'
      });

      const savedBeforeCrash = persistedData;

      // Simulate crash (destroy and recreate)
      workspaceManager.destroy();
      workspaceManager = new WorkspaceManager();

      // Should reload previous state
      const workspaces = await workspaceManager.getWorkspaces();
      const preCrashWorkspace = workspaces.find(w => w.name === 'Pre-Crash');
      
      expect(preCrashWorkspace).toBeDefined();
      expect(preCrashWorkspace?.color).toBe('#crash00');
    });

    test('should handle data migration from older formats', async () => {
      // Simulate older data format (without some newer fields)
      const oldFormatData = [
        {
          id: 'old-workspace',
          name: 'Old Format Workspace',
          color: '#old000',
          services: [
            {
              id: 'old-service',
              name: 'Old Service',
              url: 'https://old.com',
              enabled: true // Old field name
            }
          ],
          created: '2024-01-01T00:00:00.000Z',
          lastAccessed: '2024-01-01T00:00:00.000Z',
          isActive: true
        }
      ];
      persistedData = JSON.stringify(oldFormatData);

      const newManager = new WorkspaceManager();
      const workspaces = await newManager.getWorkspaces();
      const workspace = workspaces[0];

      // Should have migrated to new format with defaults
      expect(workspace.abbreviation).toBeDefined();
      expect(workspace.browserIsolation).toBe('shared'); // Default
      expect(workspace.services[0].isEnabled).toBe(true); // Should work despite old format

      newManager.destroy();
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large workspace datasets efficiently', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `workspace-${i}`,
        name: `Workspace ${i}`,
        abbreviation: `W${i}`,
        color: `#${i.toString(16).padStart(6, '0')}`,
        browserIsolation: 'shared' as const,
        services: Array.from({ length: 10 }, (_, j) => ({
          id: `service-${i}-${j}`,
          name: `Service ${j}`,
          type: 'web',
          url: `https://service${j}.com`,
          isEnabled: true,
          config: {}
        })),
        members: [],
        created: new Date('2024-01-01'),
        lastAccessed: new Date('2024-01-01'),
        isActive: i === 0
      }));

      persistedData = JSON.stringify(largeDataset);

      const startTime = Date.now();
      const newManager = new WorkspaceManager();
      const workspaces = await newManager.getWorkspaces();
      const loadTime = Date.now() - startTime;

      expect(workspaces).toHaveLength(100);
      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
      expect(workspaces[0].services).toHaveLength(10);

      newManager.destroy();
    });

    test('should optimize save operations for frequent updates', async () => {
      workspaceManager = new WorkspaceManager();

      const startTime = Date.now();
      
      // Perform multiple rapid updates
      for (let i = 0; i < 10; i++) {
        await workspaceManager.updateWorkspace('workspace-1', {
          name: `Rapid Update ${i}`
        });
      }

      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(500); // Should complete quickly
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(10); // Each update should save
    });
  });
});