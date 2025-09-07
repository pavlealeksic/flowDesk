/**
 * @fileoverview Workspace Manager - Core workspace and service management for Flow Desk
 * 
 * This module provides comprehensive workspace management functionality including:
 * - Workspace creation, deletion, and switching
 * - Service management within workspaces
 * - Browser view orchestration for service isolation
 * - Persistent data storage and retrieval
 * - Event-driven architecture for state changes
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { EventEmitter } from 'events';
import { BaseWindow, WebContentsView, session, shell } from 'electron';
import log from 'electron-log';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { LAYOUT_CONSTANTS } from './constants/layout';

/**
 * Configuration options for webview behavior within services
 * @interface WebviewOptions
 * @property {string} [partition] - Session partition for data isolation
 * @property {boolean} [allowExternalUrls] - Whether to allow navigation to external URLs
 * @property {boolean} [nodeIntegration] - Enable Node.js integration (security risk)
 * @property {boolean} [contextIsolation] - Enable context isolation for security
 * @property {boolean} [webSecurity] - Enable web security features
 */
export interface WebviewOptions {
  partition?: string;
  allowExternalUrls?: boolean;
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  webSecurity?: boolean;
}

/**
 * Represents a service within a workspace (e.g., Slack, GitHub, etc.)
 * @interface WorkspaceService
 * @property {string} id - Unique identifier for the service
 * @property {string} name - Human-readable name of the service
 * @property {string} type - Service type identifier (e.g., 'slack', 'github')
 * @property {string} url - URL where the service is accessed
 * @property {string} [iconUrl] - Optional custom icon URL
 * @property {boolean} isEnabled - Whether the service is currently enabled
 * @property {object} config - Service-specific configuration options
 * @property {WebviewOptions} [config.webviewOptions] - Webview behavior settings
 * @property {Record<string, string>} [config.customHeaders] - Custom HTTP headers
 * @property {string} [config.userAgent] - Custom user agent string
 */
export interface WorkspaceService {
  id: string;
  name: string;
  type: string;
  url: string;
  iconUrl?: string;
  isEnabled: boolean;
  config: {
    webviewOptions?: WebviewOptions;
    customHeaders?: Record<string, string>;
    userAgent?: string;
  };
}

/**
 * Represents a workspace containing multiple services and their configuration
 * @interface Workspace
 * @property {string} id - Unique identifier for the workspace
 * @property {string} name - Human-readable name of the workspace
 * @property {string} abbreviation - 2-letter abbreviation for display
 * @property {string} color - Hex color code for workspace theming
 * @property {string} [icon] - Optional custom icon URL or path
 * @property {'shared' | 'isolated'} browserIsolation - Data isolation strategy
 * @property {WorkspaceService[]} services - Array of services in this workspace
 * @property {string[]} [members] - Optional list of workspace member IDs
 * @property {Date} created - Timestamp when workspace was created
 * @property {Date} lastAccessed - Timestamp when workspace was last accessed
 * @property {boolean} isActive - Whether this workspace is currently active
 */
export interface Workspace {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  icon?: string;
  browserIsolation: 'shared' | 'isolated';
  services: WorkspaceService[];
  members?: string[];
  created: Date;
  lastAccessed: Date;
  isActive: boolean;
}

/**
 * WorkspaceManager - Core class managing workspace and service lifecycle
 * 
 * This class handles all workspace-related operations including creation, deletion,
 * switching, and service management. It also manages browser views for service
 * isolation and provides event-driven updates for UI synchronization.
 * 
 * @class WorkspaceManager
 * @extends {EventEmitter}
 * 
 * @fires WorkspaceManager#workspace-created - When a new workspace is created
 * @fires WorkspaceManager#workspace-deleted - When a workspace is deleted
 * @fires WorkspaceManager#workspace-switched - When user switches workspace
 * @fires WorkspaceManager#workspace-updated - When workspace data is modified
 * @fires WorkspaceManager#service-created - When a new service is added
 * @fires WorkspaceManager#service-deleted - When a service is removed
 * @fires WorkspaceManager#service-loaded - When a service is loaded in browser view
 * @fires WorkspaceManager#workspace-data-cleared - When workspace data is cleared
 * 
 * @example
 * ```typescript
 * const workspaceManager = new WorkspaceManager();
 * 
 * // Listen for workspace changes
 * workspaceManager.on('workspace-switched', (workspaceId) => {
 *   console.log(`Switched to workspace: ${workspaceId}`);
 * });
 * 
 * // Create a new workspace
 * const workspace = await workspaceManager.createWorkspace({
 *   name: 'Development',
 *   color: '#4285f4',
 *   browserIsolation: 'isolated'
 * });
 * ```
 */
export class WorkspaceManager extends EventEmitter {
  /** @private Main Electron window reference */
  private mainWindow: BaseWindow | null = null;
  
  /** @private Map of workspace ID to workspace data */
  private workspaces: Map<string, Workspace> = new Map();
  
  /** @private Map of service ID to web contents view for service isolation */
  private webContentsViews: Map<string, WebContentsView> = new Map();
  
  /** @private Currently active service ID */
  private currentServiceId: string | null = null;
  
  /** @private Currently visible web contents view */
  private currentWebContentsView: WebContentsView | null = null;
  
  /** @private Track web contents view visibility state */
  private webContentsViewVisible: boolean = false;
  
  /** @private Path to persistent data storage */
  private dataPath: string;

  /**
   * Initialize the WorkspaceManager
   * 
   * Sets up data storage directory and loads existing workspaces from disk.
   * Creates a default workspace if none exist.
   * 
   * @constructor
   * @throws {Error} If data directory cannot be created or workspaces cannot be loaded
   */
  constructor() {
    super();
    this.dataPath = join(process.cwd(), 'data');
    this.ensureDataDirectory();
    this.loadWorkspacesFromDisk();
  }

  private ensureDataDirectory(): void {
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private getWorkspacesFilePath(): string {
    return join(this.dataPath, 'workspaces.json');
  }

  private loadWorkspacesFromDisk(): void {
    try {
      const filePath = this.getWorkspacesFilePath();
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        data.forEach((workspace: any) => {
          // Convert date strings back to Date objects
          workspace.created = new Date(workspace.created);
          workspace.lastAccessed = new Date(workspace.lastAccessed);
          this.workspaces.set(workspace.id, workspace);
        });
        log.info(`Loaded ${this.workspaces.size} workspaces from disk`);
      } else {
        // Create default workspace if none exist
        this.createDefaultWorkspace();
      }
    } catch (error) {
      log.error('Failed to load workspaces from disk:', error);
      // Create default workspace on error
      this.createDefaultWorkspace();
    }
  }

  private createDefaultWorkspace(): void {
    const defaultWorkspace: Workspace = {
      id: this.generateId(),
      name: 'Personal',
      abbreviation: 'PE',
      color: '#4285f4',
      browserIsolation: 'shared',
      services: [],
      members: [],
      created: new Date(),
      lastAccessed: new Date(),
      isActive: true
    };

    this.workspaces.set(defaultWorkspace.id, defaultWorkspace);
    this.saveWorkspacesToDisk();
    log.info('Created default workspace:', defaultWorkspace.name);
  }

  private saveWorkspacesToDisk(): void {
    try {
      const workspacesArray = Array.from(this.workspaces.values());
      writeFileSync(this.getWorkspacesFilePath(), JSON.stringify(workspacesArray, null, 2));
      log.info('Saved workspaces to disk');
    } catch (error) {
      log.error('Failed to save workspaces to disk:', error);
    }
  }

  /**
   * Set the main Electron window and configure web contents view management
   * 
   * Registers event handlers for window resizing, dev tools, and sets up
   * web contents view positioning. This method must be called before using
   * any service loading functionality.
   * 
   * @param {BaseWindow} window - The main Electron window
   * @throws {Error} If window is null or invalid
   * 
   * @example
   * ```typescript
   * const mainWindow = new BaseWindow({ width: 1200, height: 800 });
   * workspaceManager.setMainWindow(mainWindow);
   * ```
   */
  setMainWindow(window: BaseWindow): void {
    this.mainWindow = window;
    
    // Handle window resize to reposition web contents views
    this.mainWindow.on('resized', () => {
      this.repositionAllWebContentsViews();
    });
    
    this.mainWindow.on('maximize', () => {
      this.repositionAllWebContentsViews();
    });
    
    this.mainWindow.on('unmaximize', () => {
      this.repositionAllWebContentsViews();
    });
    
    log.info('Main window set for workspace manager');
  }

  private repositionAllWebContentsViews(): void {
    if (this.currentServiceId && this.webContentsViews.has(this.currentServiceId)) {
      const currentView = this.webContentsViews.get(this.currentServiceId)!;
      this.positionWebContentsView(currentView);
    }
  }

  public hideWebContentsView(): void {
    if (this.currentWebContentsView && this.mainWindow && this.webContentsViewVisible) {
      this.mainWindow.contentView.removeChildView(this.currentWebContentsView);
      this.webContentsViewVisible = false;
      log.info('WebContentsView hidden');
    }
  }

  public showWebContentsView(): void {
    if (this.currentWebContentsView && this.mainWindow && !this.webContentsViewVisible) {
      this.mainWindow.contentView.addChildView(this.currentWebContentsView);
      this.positionWebContentsView(this.currentWebContentsView);
      this.webContentsViewVisible = true;
      log.info('WebContentsView shown');
    }
  }

  // Legacy method names for backward compatibility
  public hideBrowserView(): void {
    this.hideWebContentsView();
  }

  public showBrowserView(): void {
    this.showWebContentsView();
  }

  /**
   * Create a new workspace with the specified configuration
   * 
   * Creates a workspace with a unique ID, default settings, and saves it to disk.
   * Automatically generates a 2-letter abbreviation from the workspace name.
   * 
   * @param {object} data - Workspace configuration data
   * @param {string} data.name - Human-readable workspace name
   * @param {string} [data.icon] - Optional custom icon URL or file path
   * @param {string} data.color - Hex color code for workspace theming (e.g., '#4285f4')
   * @param {'shared' | 'isolated'} [data.browserIsolation='shared'] - Data isolation strategy
   * 
   * @returns {Promise<Workspace>} The created workspace object
   * @throws {WorkspaceError} When workspace creation fails due to invalid data or system errors
   * 
   * @fires WorkspaceManager#workspace-created
   * 
   * @example
   * ```typescript
   * const workspace = await workspaceManager.createWorkspace({
   *   name: 'Development Team',
   *   color: '#4285f4',
   *   browserIsolation: 'isolated'
   * });
   * console.log(`Created workspace: ${workspace.name} (${workspace.id})`);
   * ```
   */
  async createWorkspace(data: {
    name: string;
    icon?: string;
    color: string;
    browserIsolation?: 'shared' | 'isolated';
  }): Promise<Workspace> {
    const workspace: Workspace = {
      id: this.generateId(),
      name: data.name,
      abbreviation: this.generateAbbreviation(data.name),
      color: data.color,
      icon: data.icon,
      browserIsolation: data.browserIsolation || 'shared',
      services: [],
      members: [],
      created: new Date(),
      lastAccessed: new Date(),
      isActive: false
    };

    this.workspaces.set(workspace.id, workspace);
    this.saveWorkspacesToDisk();
    
    this.emit('workspace-created', workspace);
    log.info('Created workspace:', workspace.name);
    
    return workspace;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const workspaces = Array.from(this.workspaces.values());
    log.debug('getWorkspaces called', { 
      count: workspaces.length,
      workspaces: workspaces.map(w => ({
        id: w.id,
        name: w.name,
        serviceCount: w.services?.length || 0,
        services: w.services?.map(s => ({ id: s.id, name: s.name })) || []
      }))
    });
    return workspaces;
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  async deleteWorkspace(id: string): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`);
    }

    // Clean up web contents views for this workspace
    workspace.services.forEach(service => {
      this.cleanupWebContentsView(service.id);
    });

    this.workspaces.delete(id);
    this.saveWorkspacesToDisk();
    
    this.emit('workspace-deleted', id);
    log.info('Deleted workspace:', workspace.name);
  }

  async switchWorkspace(id: string): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`);
    }

    // Update all workspaces to set isActive status
    this.workspaces.forEach((ws, wsId) => {
      ws.isActive = wsId === id;
      ws.lastAccessed = wsId === id ? new Date() : ws.lastAccessed;
    });

    this.saveWorkspacesToDisk();
    this.emit('workspace-switched', id);
    log.info('Switched to workspace:', workspace.name);
    
    // Preload all services for notifications support
    this.preloadWorkspaceServices(workspace);
  }

  /**
   * Preload all services in a workspace for notifications support
   * Creates WebContentsViews for all services but doesn't show them
   */
  private async preloadWorkspaceServices(workspace: Workspace): Promise<void> {
    try {
      for (const service of workspace.services) {
        if (!this.webContentsViews.has(service.id)) {
          const webContentsView = await this.createWebContentsViewForService(service, workspace);
          this.webContentsViews.set(service.id, webContentsView);
          // Load the URL in background
          await webContentsView.webContents.loadURL(service.url);
          log.info(`Preloaded service for notifications: ${service.name}`);
        }
      }
    } catch (error) {
      log.warn('Failed to preload some services:', error);
    }
  }

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`);
    }

    // Update workspace with new data
    const updatedWorkspace = { ...workspace, ...updates };
    this.workspaces.set(id, updatedWorkspace);
    this.saveWorkspacesToDisk();
    
    this.emit('workspace-updated', id, updatedWorkspace);
    log.info('Updated workspace:', workspace.name);
  }

  async clearWorkspaceData(id: string): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`);
    }

    // Clear web contents view data for all services
    workspace.services.forEach(service => {
      const webContentsView = this.webContentsViews.get(service.id);
      if (webContentsView) {
        webContentsView.webContents.session.clearStorageData();
      }
    });
    
    this.emit('workspace-data-cleared', id);
    log.info('Cleared data for workspace:', workspace.name);
  }

  async createService(workspaceId: string, name: string, type: string, url: string): Promise<string> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const service: WorkspaceService = {
      id: this.generateId(),
      name,
      type,
      url,
      isEnabled: true,
      config: {}
    };

    workspace.services.push(service);
    this.workspaces.set(workspaceId, workspace);
    this.saveWorkspacesToDisk();
    
    this.emit('service-created', workspaceId, service);
    log.info('Created service:', name, 'in workspace:', workspace.name);
    
    return service.id;
  }

  async deleteService(workspaceId: string, serviceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const serviceIndex = workspace.services.findIndex(s => s.id === serviceId);
    if (serviceIndex === -1) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Clean up web contents view
    this.cleanupWebContentsView(serviceId);

    workspace.services.splice(serviceIndex, 1);
    this.workspaces.set(workspaceId, workspace);
    this.saveWorkspacesToDisk();
    
    this.emit('service-deleted', workspaceId, serviceId);
    log.info('Deleted service:', serviceId);
  }

  /**
   * Load a service in a web contents view with proper isolation and security
   * 
   * Creates or reuses a web contents view for the specified service, handles security
   * configuration, and positions the view correctly within the main window.
   * 
   * @param {string} workspaceId - ID of the workspace containing the service
   * @param {string} serviceId - ID of the service to load
   * 
   * @returns {Promise<void>} Resolves when service is loaded and displayed
   * @throws {Error} If workspace/service not found or main window not set
   * 
   * @fires WorkspaceManager#service-loaded
   * 
   * @example
   * ```typescript
   * // Load Slack service in development workspace
   * await workspaceManager.loadService('dev-workspace-id', 'slack-service-id');
   * ```
   */
  async loadService(workspaceId: string, serviceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const service = workspace.services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    if (!this.mainWindow) {
      throw new Error('Main window not set');
    }

    // Hide current web contents view if any
    this.hideWebContentsView();

    // Create or get web contents view for this service
    let webContentsView = this.webContentsViews.get(serviceId);
    if (!webContentsView) {
      webContentsView = await this.createWebContentsViewForService(service, workspace);
      this.webContentsViews.set(serviceId, webContentsView);
    }

    // Set as current web contents view
    this.currentWebContentsView = webContentsView;
    this.currentServiceId = serviceId;

    // Show the web contents view
    this.showWebContentsView();

    // Load the service URL
    if (webContentsView.webContents.getURL() !== service.url) {
      await webContentsView.webContents.loadURL(service.url);
    }
    
    this.emit('service-loaded', workspaceId, serviceId);
    log.info('Loaded service:', service.name);
  }

  private async createWebContentsViewForService(service: WorkspaceService, workspace: Workspace): Promise<WebContentsView> {
    // Create session for browser isolation
    const sessionName = workspace.browserIsolation === 'isolated' 
      ? `workspace-${workspace.id}-service-${service.id}`
      : `workspace-shared`;
    
    const serviceSession = session.fromPartition(`persist:${sessionName}`);

    const webContentsView = new WebContentsView({
      webPreferences: {
        session: serviceSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        backgroundThrottling: false,
        ...service.config.webviewOptions
      }
    });

    // Configure navigation security
    webContentsView.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Set custom headers if configured
    if (service.config.customHeaders) {
      webContentsView.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({
          requestHeaders: {
            ...details.requestHeaders,
            ...service.config.customHeaders
          }
        });
      });
    }

    return webContentsView;
  }

  private positionWebContentsView(webContentsView: WebContentsView): void {
    if (!this.mainWindow) return;

    const contentBounds = this.mainWindow.getBounds();
    
    // Account for left rail and services sidebar
    const leftRailWidth = LAYOUT_CONSTANTS.PRIMARY_SIDEBAR_WIDTH;
    const servicesSidebarWidth = LAYOUT_CONSTANTS.SERVICES_SIDEBAR_WIDTH;
    const totalSidebarWidth = leftRailWidth + servicesSidebarWidth;
    const headerHeight = LAYOUT_CONSTANTS.TOP_BAR_HEIGHT;
    
    // Calculate the available space for the web contents view
    const availableWidth = contentBounds.width - totalSidebarWidth;
    const availableHeight = contentBounds.height - headerHeight;
    
    // Ensure minimum dimensions
    const finalWidth = Math.max(availableWidth, 400);
    const finalHeight = Math.max(availableHeight, 300);
    
    webContentsView.setBounds({
      x: totalSidebarWidth,
      y: headerHeight,
      width: finalWidth,
      height: finalHeight
    });
    
    log.info('WebContentsView positioned:', {
      x: totalSidebarWidth,
      y: headerHeight,
      width: finalWidth,
      height: finalHeight,
      contentBounds
    });
  }

  private cleanupWebContentsView(serviceId: string): void {
    const webContentsView = this.webContentsViews.get(serviceId);
    if (webContentsView) {
      if (this.mainWindow) {
        this.mainWindow.contentView.removeChildView(webContentsView);
      }
      (webContentsView.webContents as any).destroy();
      this.webContentsViews.delete(serviceId);
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateAbbreviation(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }

  // Cleanup method
  destroy(): void {
    this.webContentsViews.forEach((webContentsView, serviceId) => {
      this.cleanupWebContentsView(serviceId);
    });
    this.removeAllListeners();
  }
}