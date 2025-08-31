/**
 * Simple Working Workspace Manager
 * 
 * Uses file-based storage to avoid ElectronStore type issues
 */

import { BrowserView, session } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface Workspace {
  id: string;
  name: string;
  abbreviation: string;
  icon: string; // Custom image URL (JPG/PNG/SVG)
  color: string;
  browserIsolation: 'shared' | 'isolated';
  services: WorkspaceService[];
  created: string; // ISO string
  lastAccessed: string; // ISO string
  isActive: boolean;
}

export interface WorkspaceService {
  id: string;
  name: string;
  type: string;
  url: string;
  isEnabled: boolean;
}

interface WorkspaceData {
  workspaces: Record<string, Workspace>;
  activeWorkspaceId?: string;
}

export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private activeWorkspaceId?: string;
  private browserViews: Map<string, BrowserView> = new Map();
  private sessions: Map<string, Electron.Session> = new Map();
  private dataPath: string;

  constructor() {
    this.dataPath = join(app.getPath('userData'), 'workspaces.json');
    this.loadWorkspaces();
    this.cleanupLegacyWorkspaces();
  }

  private loadWorkspaces(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf8')) as WorkspaceData;
        
        for (const [id, workspace] of Object.entries(data.workspaces)) {
          this.workspaces.set(id, workspace);
        }
        
        this.activeWorkspaceId = data.activeWorkspaceId;
        log.info(`Loaded ${this.workspaces.size} workspaces`);
      }
    } catch (error) {
      log.error('Failed to load workspaces:', error);
    }
  }

  private saveWorkspaces(): void {
    try {
      const workspacesObj: Record<string, Workspace> = {};
      for (const [id, workspace] of Array.from(this.workspaces.entries())) {
        workspacesObj[id] = workspace;
      }

      const data: WorkspaceData = {
        workspaces: workspacesObj,
        activeWorkspaceId: this.activeWorkspaceId
      };

      writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      log.error('Failed to save workspaces:', error);
    }
  }

  private cleanupLegacyWorkspaces(): void {
    // Remove any hardcoded workspaces like 'personal', 'work'
    const legacyIds = ['personal', 'work', 'Personal', 'Work'];
    let removed = false;
    
    for (const id of legacyIds) {
      if (this.workspaces.has(id)) {
        this.workspaces.delete(id);
        removed = true;
        log.info(`Removed legacy workspace: ${id}`);
      }
    }
    
    if (removed) {
      this.saveWorkspaces();
    }
  }

  public async createWorkspace(
    name: string, 
    color: string = '#4285f4',
    icon: string = '🏢',
    browserIsolation: 'shared' | 'isolated' = 'shared'
  ): Promise<string> {
    const id = uuidv4();
    const abbreviation = this.generateAbbreviation(name);

    const workspace: Workspace = {
      id,
      name,
      abbreviation,
      icon,
      color,
      browserIsolation,
      services: [],
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      isActive: false
    };

    this.workspaces.set(id, workspace);
    this.saveWorkspaces();
    
    log.info(`Created workspace: ${name} (${id})`);
    return id;
  }

  private generateAbbreviation(name: string): string {
    const words = name.trim().split(/\s+/);
    
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    } else {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
  }

  public getWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  public getActiveWorkspace(): Workspace | undefined {
    return this.activeWorkspaceId ? this.workspaces.get(this.activeWorkspaceId) : undefined;
  }

  public async switchWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Update active states
    if (this.activeWorkspaceId) {
      const previousWorkspace = this.workspaces.get(this.activeWorkspaceId);
      if (previousWorkspace) {
        previousWorkspace.isActive = false;
      }
    }

    workspace.isActive = true;
    workspace.lastAccessed = new Date().toISOString();
    this.activeWorkspaceId = workspaceId;

    this.saveWorkspaces();
    log.info(`Switched to workspace: ${workspace.name}`);
  }

  public async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (updates.name) {
      workspace.name = updates.name;
      workspace.abbreviation = this.generateAbbreviation(updates.name);
    }
    if (updates.color) workspace.color = updates.color;
    
    workspace.lastAccessed = new Date().toISOString();
    this.saveWorkspaces();
    
    log.info(`Updated workspace: ${workspace.name}`);
  }

  public async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Close browser views
    for (const service of workspace.services) {
      const browserView = this.browserViews.get(service.id);
      if (browserView) {
        browserView.webContents.close();
        this.browserViews.delete(service.id);
      }
    }

    this.workspaces.delete(workspaceId);
    
    if (this.activeWorkspaceId === workspaceId) {
      const remainingWorkspaces = this.getWorkspaces();
      this.activeWorkspaceId = remainingWorkspaces.length > 0 ? remainingWorkspaces[0].id : undefined;
    }

    this.saveWorkspaces();
    log.info(`Deleted workspace: ${workspace.name}`);
  }

  public async addServiceToWorkspace(
    workspaceId: string,
    serviceName: string,
    serviceType: string,
    url: string
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
      isEnabled: true
    };

    workspace.services.push(service);
    workspace.lastAccessed = new Date().toISOString();
    
    this.saveWorkspaces();
    log.info(`Added service ${serviceName} to workspace ${workspace.name}`);
    
    return serviceId;
  }

  public async removeServiceFromWorkspace(workspaceId: string, serviceId: string): Promise<void> {
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

    workspace.services = workspace.services.filter(s => s.id !== serviceId);
    workspace.lastAccessed = new Date().toISOString();
    
    this.saveWorkspaces();
    log.info(`Removed service ${serviceId} from workspace ${workspace.name}`);
  }

  public async updateServiceInWorkspace(
    workspaceId: string, 
    serviceId: string, 
    updates: { name?: string; url?: string; isEnabled?: boolean }
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const service = workspace.services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    // Update service properties
    if (updates.name !== undefined) {
      service.name = updates.name;
    }
    if (updates.url !== undefined) {
      service.url = updates.url;
    }
    if (updates.isEnabled !== undefined) {
      service.isEnabled = updates.isEnabled;
    }

    workspace.lastAccessed = new Date().toISOString();
    
    this.saveWorkspaces();
    log.info(`Updated service ${service.name} in workspace ${workspace.name}`);
  }

  public async loadService(workspaceId: string, serviceId: string, mainWindow: any): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const service = workspace.services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    log.info(`Loading service ${service.name} (${service.url}) for workspace ${workspace.name}`);
    
    // Create isolated session for this workspace if not exists
    const partition = `persist:workspace-${workspaceId}`;
    const workspaceSession = session.fromPartition(partition);
    
    // Configure session security for web services
    workspaceSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow common permissions needed by productivity services
      const allowedPermissions = ['notifications', 'camera', 'microphone', 'clipboard-read'];
      callback(allowedPermissions.includes(permission));
    });

    // Create BrowserView for the service
    let browserView = this.browserViews.get(serviceId);
    
    if (!browserView) {
      const { BrowserView } = require('electron');
      browserView = new BrowserView({
        webPreferences: {
          session: workspaceSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false
        }
      });

      // Handle navigation - keep users within the service domain  
      browserView!.webContents.on('will-navigate', (event, url) => {
        try {
          const serviceUrl = new URL(service.url);
          const targetUrl = new URL(url);
          
          // Allow navigation within the same domain and common auth domains
          const allowedDomains = [
            serviceUrl.hostname,
            'accounts.google.com',
            'login.microsoftonline.com', 
            'github.com',
            'api.slack.com'
          ];
          
          if (!allowedDomains.includes(targetUrl.hostname)) {
            event.preventDefault();
            // Open external links in system browser
            require('electron').shell.openExternal(url);
          }
        } catch (error) {
          log.warn('Navigation URL parse error:', error);
        }
      });

      // Handle new window requests
      browserView!.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
      });

      this.browserViews.set(serviceId, browserView!);
    }

    // Ensure browserView is not undefined
    if (!browserView) {
      throw new Error('Failed to create or retrieve browser view');
    }

    // Attach browser view to main window
    mainWindow.setBrowserView(browserView);
    
    // Set browser view bounds (after primary sidebar + secondary sidebar)
    const bounds = mainWindow.getBounds();
    const primarySidebarWidth = 64;  // FlowDeskLeftRail width
    const secondarySidebarWidth = 256; // ServicesSidebar width
    
    browserView.setBounds({
      x: primarySidebarWidth + secondarySidebarWidth,
      y: 0,
      width: bounds.width - primarySidebarWidth - secondarySidebarWidth,
      height: bounds.height
    });

    // Load the service URL
    try {
      await browserView.webContents.loadURL(service.url);
      log.info(`Successfully loaded ${service.name} at ${service.url}`);
    } catch (error) {
      log.error(`Failed to load service ${service.name}:`, error);
      throw error;
    }
  }

  public getPredefinedServices(): Record<string, { name: string; url: string; type: string }> {
    return {
      // Communication & Collaboration
      slack: { name: 'Slack', url: 'https://app.slack.com', type: 'slack' },
      teams: { name: 'Microsoft Teams', url: 'https://teams.microsoft.com', type: 'teams' },
      discord: { name: 'Discord', url: 'https://discord.com/app', type: 'discord' },
      
      // Productivity & Project Management  
      notion: { name: 'Notion', url: 'https://www.notion.so', type: 'notion' },
      jira: { name: 'Jira', url: 'https://[your-domain].atlassian.net', type: 'jira' },
      asana: { name: 'Asana', url: 'https://app.asana.com', type: 'asana' },
      trello: { name: 'Trello', url: 'https://trello.com', type: 'trello' },
      linear: { name: 'Linear', url: 'https://linear.app', type: 'linear' },
      clickup: { name: 'ClickUp', url: 'https://app.clickup.com', type: 'clickup' },
      monday: { name: 'Monday.com', url: 'https://[your-team].monday.com', type: 'monday' },
      
      // Development
      github: { name: 'GitHub', url: 'https://github.com', type: 'github' },
      gitlab: { name: 'GitLab', url: 'https://gitlab.com', type: 'gitlab' },
      bitbucket: { name: 'Bitbucket', url: 'https://bitbucket.org', type: 'bitbucket' },
      
      // Cloud Storage
      googledrive: { name: 'Google Drive', url: 'https://drive.google.com', type: 'storage' },
      onedrive: { name: 'OneDrive', url: 'https://onedrive.live.com', type: 'storage' },
      dropbox: { name: 'Dropbox', url: 'https://www.dropbox.com/home', type: 'storage' },
      
      // Design & Creative
      figma: { name: 'Figma', url: 'https://www.figma.com', type: 'design' },
      miro: { name: 'Miro', url: 'https://miro.com', type: 'design' },
      
      // CRM & Sales
      salesforce: { name: 'Salesforce', url: 'https://[your-domain].salesforce.com', type: 'crm' },
      hubspot: { name: 'HubSpot', url: 'https://app.hubspot.com', type: 'crm' },
      
      // Support
      zendesk: { name: 'Zendesk', url: 'https://[your-domain].zendesk.com', type: 'support' },
      intercom: { name: 'Intercom', url: 'https://app.intercom.com', type: 'support' },
    };
  }

  public async cleanup(): Promise<void> {
    // Close all browser views
    for (const browserView of Array.from(this.browserViews.values())) {
      try {
        browserView.webContents.close();
      } catch (error) {
        log.warn('Error closing browser view:', error);
      }
    }

    this.browserViews.clear();
    this.sessions.clear();
    
    log.info('Workspace manager cleanup completed');
  }
}

export default WorkspaceManager;