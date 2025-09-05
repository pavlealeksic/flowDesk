/**
 * Workspace Manager for Flow Desk
 * 
 * Manages isolated workspaces with Chrome browser instances for web services
 */

import { BrowserWindow, BrowserView, session } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import Store from 'electron-store';

export interface Workspace {
  id: string;
  name: string;
  abbreviation: string; // 2-letter abbreviation
  color: string;
  services: WorkspaceService[];
  created: Date;
  lastAccessed: Date;
  isActive: boolean;
}

export interface WorkspaceService {
  id: string;
  name: string;
  type: 'slack' | 'notion' | 'github' | 'jira' | 'trello' | 'asana' | 'teams' | 'discord' | 'custom';
  url: string;
  iconUrl?: string;
  isEnabled: boolean;
  config: ServiceConfig;
}

export interface ServiceConfig {
  autoLogin?: boolean;
  notifications?: boolean;
  customCSS?: string;
  customJS?: string;
  userAgent?: string;
  proxyConfig?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

interface WorkspaceStore {
  workspaces: Record<string, Workspace>;
  activeWorkspaceId?: string;
  settings: {
    defaultWorkspace?: string;
    autoSwitchOnActivity: boolean;
  };
}

export class WorkspaceManager {
  private store: Store<WorkspaceStore>;
  private browserViews: Map<string, BrowserView> = new Map();
  private sessions: Map<string, Electron.Session> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private activeWorkspaceId?: string;
  private mainWindow?: BrowserWindow;
  private browserViewsHidden: boolean = false;

  constructor() {
    this.store = new Store<WorkspaceStore>({
      name: 'flow-desk-workspaces',
      defaults: {
        workspaces: {},
        settings: {
          autoSwitchOnActivity: false
        }
      }
    });

    this.loadWorkspaces();
  }

  private loadWorkspaces() {
    try {
      const storedWorkspaces = this.store.store.workspaces;
      const activeId = this.store.store.activeWorkspaceId;

      for (const [id, workspace] of Object.entries(storedWorkspaces)) {
        this.workspaces.set(id, {
          ...workspace,
          created: new Date(workspace.created),
          lastAccessed: new Date(workspace.lastAccessed)
        });
      }

      this.activeWorkspaceId = activeId;
      log.info(`Loaded ${this.workspaces.size} workspaces`);
    } catch (error) {
      log.error('Failed to load workspaces:', error);
    }
  }

  private saveWorkspaces() {
    const workspacesObj: Record<string, Workspace> = {};
    for (const [id, workspace] of this.workspaces) {
      workspacesObj[id] = workspace;
    }

    this.store.store = {
      ...this.store.store,
      workspaces: workspacesObj,
      activeWorkspaceId: this.activeWorkspaceId
    };
  }

  /**
   * Create new workspace
   */
  async createWorkspace(name: string, color: string = '#4285f4'): Promise<string> {
    const id = uuidv4();
    const abbreviation = this.generateAbbreviation(name);

    const workspace: Workspace = {
      id,
      name,
      abbreviation,
      color,
      services: [],
      created: new Date(),
      lastAccessed: new Date(),
      isActive: false
    };

    this.workspaces.set(id, workspace);
    
    // Create isolated session for this workspace
    await this.createWorkspaceSession(id);
    
    this.saveWorkspaces();
    log.info(`Created workspace: ${name} (${id})`);
    
    return id;
  }

  /**
   * Generate 2-letter abbreviation from workspace name
   */
  private generateAbbreviation(name: string): string {
    const words = name.trim().split(/\s+/);
    
    if (words.length === 1) {
      // Single word - use first two letters
      return words[0].substring(0, 2).toUpperCase();
    } else {
      // Multiple words - use first letter of first two words
      return (words[0][0] + words[1][0]).toUpperCase();
    }
  }

  /**
   * Create isolated Chromium session for workspace
   */
  private async createWorkspaceSession(workspaceId: string): Promise<void> {
    const partition = `persist:workspace-${workspaceId}`;
    const workspaceSession = session.fromPartition(partition);

    // Configure session security
    workspaceSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow notifications and media for productivity services
      const allowedPermissions = ['notifications', 'camera', 'microphone', 'clipboard-read'];
      callback(allowedPermissions.includes(permission));
    });

    // Block external navigation (security)
    workspaceSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: false }); // Allow all for now, can add filtering later
    });

    this.sessions.set(workspaceId, workspaceSession);
    log.debug(`Created session for workspace: ${workspaceId}`);
  }

  /**
   * Add service to workspace
   */
  async addServiceToWorkspace(
    workspaceId: string,
    serviceName: string,
    serviceType: WorkspaceService['type'],
    url: string,
    config: ServiceConfig = {}
  ): Promise<string> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const serviceId = uuidv4();
    const service: WorkspaceService = {
      id: serviceId,
      name: serviceName,
      type: serviceType,
      url,
      config,
      isEnabled: true
    };

    workspace.services.push(service);
    workspace.lastAccessed = new Date();
    
    this.saveWorkspaces();
    log.info(`Added service ${serviceName} to workspace ${workspace.name}`);
    
    return serviceId;
  }

  /**
   * Remove service from workspace
   */
  async removeServiceFromWorkspace(workspaceId: string, serviceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Close browser view if open
    const browserView = this.browserViews.get(serviceId);
    if (browserView) {
      browserView.webContents.close();
      this.browserViews.delete(serviceId);
    }

    // Remove service from workspace
    workspace.services = workspace.services.filter(s => s.id !== serviceId);
    workspace.lastAccessed = new Date();
    
    this.saveWorkspaces();
    log.info(`Removed service ${serviceId} from workspace ${workspace.name}`);
  }

  /**
   * Load service in browser view
   */
  async loadService(workspaceId: string, serviceId: string, mainWindow: BrowserWindow): Promise<BrowserView> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const service = workspace.services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    // Get or create browser view
    let browserView = this.browserViews.get(serviceId);
    
    if (!browserView) {
      const workspaceSession = this.sessions.get(workspaceId);
      if (!workspaceSession) {
        await this.createWorkspaceSession(workspaceId);
      }

      browserView = new BrowserView({
        webPreferences: {
          session: this.sessions.get(workspaceId),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true
        }
      });

      // Configure service-specific settings
      if (service.config.userAgent) {
        browserView.webContents.setUserAgent(service.config.userAgent);
      }

      // Handle navigation
      browserView.webContents.on('will-navigate', (event, url) => {
        // Allow navigation within the service domain
        try {
          const serviceUrl = new URL(service.url);
          const targetUrl = new URL(url);
          
          if (targetUrl.hostname !== serviceUrl.hostname) {
            event.preventDefault();
            // Open external links in system browser
            require('electron').shell.openExternal(url);
          }
        } catch (error) {
          log.warn('Navigation URL parse error:', error);
        }
      });

      // Handle new window requests
      browserView.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
      });

      this.browserViews.set(serviceId, browserView);
    }

    // Store main window reference
    this.mainWindow = mainWindow;
    
    // Attach to main window only if BrowserViews are not hidden
    if (!this.browserViewsHidden) {
      mainWindow.setBrowserView(browserView);
      
      // Position the browser view (will be managed by UI)
      const bounds = mainWindow.getBounds();
      browserView.setBounds({
        x: 300, // After sidebars
        y: 0,
        width: bounds.width - 300,
        height: bounds.height
      });
    }

    // Load the service URL
    await browserView.webContents.loadURL(service.url);
    
    log.info(`Loaded service ${service.name} in workspace ${workspace.name}`);
    return browserView;
  }

  /**
   * Get predefined service configurations
   */
  getPredefinedServices(): Record<string, { name: string; url: string; type: WorkspaceService['type'] }> {
    return {
      slack: { name: 'Slack', url: 'https://app.slack.com', type: 'slack' },
      notion: { name: 'Notion', url: 'https://www.notion.so', type: 'notion' },
      github: { name: 'GitHub', url: 'https://github.com', type: 'github' },
      jira: { name: 'Jira', url: 'https://[your-domain].atlassian.net', type: 'jira' },
      trello: { name: 'Trello', url: 'https://trello.com', type: 'trello' },
      asana: { name: 'Asana', url: 'https://app.asana.com', type: 'asana' },
      teams: { name: 'Microsoft Teams', url: 'https://teams.microsoft.com', type: 'teams' },
      discord: { name: 'Discord', url: 'https://discord.com/app', type: 'discord' },
    };
  }

  /**
   * Hide all BrowserViews (for modal overlays)
   */
  hideBrowserViews(): void {
    if (this.browserViewsHidden) return;
    
    try {
      if (this.mainWindow) {
        const currentView = this.mainWindow.getBrowserView();
        if (currentView) {
          this.mainWindow.setBrowserView(null);
          log.debug('BrowserViews hidden for modal overlay');
        }
      }
      this.browserViewsHidden = true;
    } catch (error) {
      log.warn('Error hiding browser views:', error);
    }
  }

  /**
   * Show BrowserViews (when modals close)
   */
  showBrowserViews(): void {
    if (!this.browserViewsHidden) return;
    
    try {
      if (this.mainWindow && this.browserViews.size > 0) {
        // Find the currently active service's BrowserView
        // For now, we'll show the first available one
        // TODO: Implement proper active service tracking
        const firstBrowserView = this.browserViews.values().next().value;
        if (firstBrowserView) {
          this.mainWindow.setBrowserView(firstBrowserView);
          
          // Reposition the browser view
          const bounds = this.mainWindow.getBounds();
          firstBrowserView.setBounds({
            x: 300, // After sidebars
            y: 0,
            width: bounds.width - 300,
            height: bounds.height
          });
          
          log.debug('BrowserViews shown after modal close');
        }
      }
      this.browserViewsHidden = false;
    } catch (error) {
      log.warn('Error showing browser views:', error);
    }
  }

  /**
   * Check if BrowserViews are currently hidden
   */
  areBrowserViewsHidden(): boolean {
    return this.browserViewsHidden;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Destroy all browser views
    for (const browserView of this.browserViews.values()) {
      try {
        browserView.webContents.close();
      } catch (error) {
        log.warn('Error destroying browser view:', error);
      }
    }

    this.browserViews.clear();
    this.sessions.clear();
    this.mainWindow = undefined;
    
    log.info('Workspace manager cleanup completed');
  }
}

export default WorkspaceManager;