/**
 * Complete Workspace Manager with Real Rust Backend Integration
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';

export interface WebviewOptions {
  partition?: string;
  allowExternalUrls?: boolean;
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  preload?: string;
  [key: string]: unknown;
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  autoSync: boolean;
  defaultEmailSignature?: string;
  timezone: string;
  language: string;
}

export interface WorkspaceService {
  id: string;
  name: string;
  type: 'browser-service' | 'native-service'; // Most are browser-based
  url: string;
  icon: string;
  color: string;
  isEnabled: boolean;
  config: {
    integration: 'browser' | 'oauth' | 'native';
    permissions?: string[];
    webviewOptions?: WebviewOptions;
  };
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  members: WorkspaceMember[];
  color?: string;
  icon?: string; // Path to icon file or icon identifier
  browserIsolation?: 'shared' | 'isolated';
  settings: WorkspaceSettings;
  services: WorkspaceService[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
  lastActive?: Date;
}

export class WorkspaceManager extends EventEmitter {
  private workspaces: Map<string, Workspace> = new Map();
  private currentWorkspace?: string;
  private initialized: boolean = false;

  constructor() {
    super();
    this.initializeWorkspaces();
  }

  private async initializeWorkspaces(): Promise<void> {
    try {
      // Load workspaces from Rust backend
      const result = await rustEngineIntegration.callRustFunction('collaboration_list_workspaces', []);
      
      if (result.success && result.result) {
        const workspaces = result.result as Workspace[];
        for (const workspace of workspaces) {
          this.workspaces.set(workspace.id, workspace);
        }
        log.info(`Loaded ${workspaces.length} workspaces from backend`);
      } else {
        // Create default workspace if none exist
        await this.createDefaultWorkspace();
      }
      
      this.initialized = true;
      this.emit('workspaces-loaded', Array.from(this.workspaces.values()));
    } catch (error) {
      log.error('Failed to initialize workspaces:', error);
      // Fallback to default workspace
      await this.createDefaultWorkspace();
      this.initialized = true;
    }
  }

  private async createDefaultWorkspace(): Promise<void> {
    const defaultWorkspace = await this.createWorkspace(
      'Personal Workspace',
      '#4285f4',
      'workspace-default',
      'shared',
      'Your personal email and calendar workspace'
    );
    this.setCurrentWorkspace(defaultWorkspace.id);
  }

  async createWorkspace(
    name: string, 
    color?: string, 
    icon?: string, 
    browserIsolation?: 'shared' | 'isolated',
    description?: string
  ): Promise<Workspace> {
    const workspace: Workspace = {
      id: `ws_${Date.now()}`,
      name,
      description,
      color: color || '#4285f4',
      icon: icon || 'workspace-default',
      browserIsolation: browserIsolation || 'shared',
      members: [],
      settings: {
        theme: 'auto',
        notifications: true,
        autoSync: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: 'en',
      },
      services: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workspaces.set(workspace.id, workspace);

    // Persist to Rust backend
    try {
      const result = await rustEngineIntegration.callRustFunction('collaboration_create_workspace', [
        workspace.name,
        workspace.description || ''
      ]);
      
      if (result.success && result.result && (result.result as any).workspace_id) {
        workspace.id = (result.result as any).workspace_id;
        this.workspaces.delete(`ws_${Date.now()}`);
        this.workspaces.set(workspace.id, workspace);
      }
    } catch (error) {
      log.error('Failed to persist workspace to backend:', error);
    }

    this.emit('workspace-created', workspace);
    log.info(`Created workspace: ${workspace.name} (${workspace.id})`);
    
    return workspace;
  }

  async addServiceToWorkspace(workspaceId: string, serviceName: string, serviceType: string, url: string): Promise<string> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const service: WorkspaceService = {
      id: `service_${Date.now()}`,
      name: serviceName,
      type: serviceType as 'browser-service' | 'native-service',
      url,
      icon: this.getServiceIcon(serviceType),
      color: this.getServiceColor(serviceType),
      isEnabled: true,
      config: {
        integration: 'browser' as const,
        permissions: [],
        webviewOptions: {}
      },
    };

    workspace.services.push(service);
    workspace.updatedAt = new Date();
    
    await this.saveWorkspace(workspace);
    this.emit('service-added', { workspace, service });
    log.info(`Added service ${serviceName} to workspace ${workspace.name}`);
    
    return service.id;
  }

  private getServiceIcon(serviceType: string): string {
    const iconMap: Record<string, string> = {
      'communication': 'chat-icon',
      'productivity': 'document-icon',
      'development': 'code-icon',
      'email': 'email-icon',
      'calendar': 'calendar-icon',
      'notes': 'notes-icon',
      'crm': 'contact-icon',
      'project': 'project-icon',
    };
    return iconMap[serviceType] || 'service-default';
  }

  private getServiceColor(serviceType: string): string {
    const colorMap: Record<string, string> = {
      'communication': '#4A154B',
      'productivity': '#000000',
      'development': '#181717',
      'email': '#1a73e8',
      'calendar': '#137333',
      'notes': '#f9ab00',
      'crm': '#ff6900',
      'project': '#8e24aa',
    };
    return colorMap[serviceType] || '#666666';
  }

  private async saveWorkspace(workspace: Workspace): Promise<void> {
    try {
      await rustEngineIntegration.callRustFunction('collaboration_update_workspace', [
        workspace.id,
        {
          name: workspace.name,
          description: workspace.description,
          color: workspace.color,
          icon: workspace.icon,
          settings: workspace.settings,
          services: workspace.services,
          updatedAt: workspace.updatedAt,
        }
      ]);
    } catch (error) {
      log.error(`Failed to save workspace ${workspace.id} to backend:`, error);
    }
  }

  getCurrentWorkspace(): Workspace | undefined {
    return this.currentWorkspace ? this.workspaces.get(this.currentWorkspace) : undefined;
  }

  setCurrentWorkspace(workspaceId: string): void {
    if (this.workspaces.has(workspaceId)) {
      this.currentWorkspace = workspaceId;
      this.emit('workspace-changed', this.workspaces.get(workspaceId));
    }
  }

  getAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  // Methods expected by main.ts
  getWorkspaces(): Workspace[] {
    return this.getAllWorkspaces();
  }

  getActiveWorkspace(): Workspace | undefined {
    return this.getCurrentWorkspace();
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    this.setCurrentWorkspace(workspaceId);
  }

  async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    Object.assign(workspace, updates);
    workspace.updatedAt = new Date();
    
    await this.saveWorkspace(workspace);
    this.emit('workspace-updated', workspace);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    try {
      await rustEngineIntegration.callRustFunction('collaboration_delete_workspace', [workspaceId]);
    } catch (error) {
      log.error('Failed to delete workspace from backend:', error);
    }

    this.workspaces.delete(workspaceId);
    this.emit('workspace-deleted', workspace);
    log.info(`Deleted workspace: ${workspace.name}`);
  }

  async removeServiceFromWorkspace(workspaceId: string, serviceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const serviceIndex = workspace.services.findIndex(s => s.id === serviceId);
    if (serviceIndex >= 0) {
      workspace.services.splice(serviceIndex, 1);
      workspace.updatedAt = new Date();
      await this.saveWorkspace(workspace);
    }
  }

  async updateServiceInWorkspace(workspaceId: string, serviceId: string, updates: Partial<WorkspaceService>): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const service = workspace.services.find(s => s.id === serviceId);
    if (service) {
      Object.assign(service, updates);
      workspace.updatedAt = new Date();
      await this.saveWorkspace(workspace);
    }
  }

  async loadService(workspaceId: string, serviceId: string, mainWindow?: BrowserWindow): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const service = workspace.services.find(s => s.id === serviceId);
    if (service) {
      this.emit('service-load-requested', { workspace, service });
    }
  }

  getPredefinedServices(): WorkspaceService[] {
    return [
      // Task Management & Project Management
      { id: 'asana-template', name: 'Asana', type: 'browser-service', url: 'https://app.asana.com', icon: 'asana-icon', color: '#f06a6a', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:asana', allowExternalUrls: true } } },
      { id: 'trello-template', name: 'Trello', type: 'browser-service', url: 'https://trello.com', icon: 'trello-icon', color: '#0079BF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:trello', allowExternalUrls: true } } },
      { id: 'monday-template', name: 'Monday.com', type: 'browser-service', url: 'https://monday.com', icon: 'monday-icon', color: '#ff3d57', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:monday', allowExternalUrls: true } } },
      { id: 'todoist-template', name: 'Todoist', type: 'browser-service', url: 'https://todoist.com/app', icon: 'todoist-icon', color: '#e44332', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:todoist', allowExternalUrls: true } } },
      { id: 'clickup-template', name: 'ClickUp', type: 'browser-service', url: 'https://app.clickup.com', icon: 'clickup-icon', color: '#7b68ee', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:clickup', allowExternalUrls: true } } },
      { id: 'linear-template', name: 'Linear', type: 'browser-service', url: 'https://linear.app', icon: 'linear-icon', color: '#5e6ad2', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:linear', allowExternalUrls: true } } },
      { id: 'basecamp-template', name: 'Basecamp', type: 'browser-service', url: 'https://basecamp.com', icon: 'basecamp-icon', color: '#1f5a41', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:basecamp', allowExternalUrls: true } } },
      { id: 'height-template', name: 'Height', type: 'browser-service', url: 'https://height.app', icon: 'height-icon', color: '#4c6ef5', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:height', allowExternalUrls: true } } },
      
      // Communication & Collaboration
      { id: 'slack-template', name: 'Slack', type: 'browser-service', url: 'https://app.slack.com', icon: 'slack-icon', color: '#4A154B', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:slack', allowExternalUrls: true } } },
      { id: 'discord-template', name: 'Discord', type: 'browser-service', url: 'https://discord.com/app', icon: 'discord-icon', color: '#5865F2', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:discord', allowExternalUrls: true } } },
      { id: 'teams-template', name: 'Microsoft Teams', type: 'browser-service', url: 'https://teams.microsoft.com', icon: 'teams-icon', color: '#6264A7', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:teams', allowExternalUrls: true } } },
      { id: 'zoom-template', name: 'Zoom', type: 'browser-service', url: 'https://zoom.us/wc', icon: 'zoom-icon', color: '#2D8CFF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:zoom', allowExternalUrls: true } } },
      { id: 'meet-template', name: 'Google Meet', type: 'browser-service', url: 'https://meet.google.com', icon: 'meet-icon', color: '#00ac47', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:meet', allowExternalUrls: true } } },
      { id: 'telegram-template', name: 'Telegram Web', type: 'browser-service', url: 'https://web.telegram.org', icon: 'telegram-icon', color: '#0088cc', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:telegram', allowExternalUrls: true } } },
      { id: 'whatsapp-template', name: 'WhatsApp Web', type: 'browser-service', url: 'https://web.whatsapp.com', icon: 'whatsapp-icon', color: '#25d366', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:whatsapp', allowExternalUrls: true } } },
      
      // Development & Code Management
      { id: 'github-template', name: 'GitHub', type: 'browser-service', url: 'https://github.com', icon: 'github-icon', color: '#181717', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:github', allowExternalUrls: true } } },
      { id: 'gitlab-template', name: 'GitLab', type: 'browser-service', url: 'https://gitlab.com', icon: 'gitlab-icon', color: '#FC6D26', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gitlab', allowExternalUrls: true } } },
      { id: 'bitbucket-template', name: 'Bitbucket', type: 'browser-service', url: 'https://bitbucket.org', icon: 'bitbucket-icon', color: '#0052CC', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:bitbucket', allowExternalUrls: true } } },
      { id: 'jira-template', name: 'Jira', type: 'browser-service', url: 'https://atlassian.net', icon: 'jira-icon', color: '#0052CC', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:jira', allowExternalUrls: true } } },
      { id: 'confluence-template', name: 'Confluence', type: 'browser-service', url: 'https://confluence.atlassian.com', icon: 'confluence-icon', color: '#172b4d', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:confluence', allowExternalUrls: true } } },
      { id: 'jenkins-template', name: 'Jenkins', type: 'browser-service', url: 'https://jenkins.io', icon: 'jenkins-icon', color: '#335061', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:jenkins', allowExternalUrls: true } } },
      
      // Productivity & Notes
      { id: 'notion-template', name: 'Notion', type: 'browser-service', url: 'https://notion.so', icon: 'notion-icon', color: '#000000', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:notion', allowExternalUrls: true } } },
      { id: 'obsidian-template', name: 'Obsidian', type: 'browser-service', url: 'https://obsidian.md', icon: 'obsidian-icon', color: '#7C3AED', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:obsidian', allowExternalUrls: true } } },
      { id: 'evernote-template', name: 'Evernote', type: 'browser-service', url: 'https://evernote.com/client/web', icon: 'evernote-icon', color: '#00A82D', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:evernote', allowExternalUrls: true } } },
      { id: 'onenote-template', name: 'OneNote', type: 'browser-service', url: 'https://onenote.com', icon: 'onenote-icon', color: '#7719AA', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:onenote', allowExternalUrls: true } } },
      { id: 'logseq-template', name: 'Logseq', type: 'browser-service', url: 'https://logseq.com', icon: 'logseq-icon', color: '#002b36', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:logseq', allowExternalUrls: true } } },
      
      // Google Workspace
      { id: 'gdrive-template', name: 'Google Drive', type: 'browser-service', url: 'https://drive.google.com', icon: 'gdrive-icon', color: '#1a73e8', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gdrive', allowExternalUrls: true } } },
      { id: 'gdocs-template', name: 'Google Docs', type: 'browser-service', url: 'https://docs.google.com', icon: 'gdocs-icon', color: '#4285f4', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gdocs', allowExternalUrls: true } } },
      { id: 'gsheets-template', name: 'Google Sheets', type: 'browser-service', url: 'https://sheets.google.com', icon: 'gsheets-icon', color: '#137333', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gsheets', allowExternalUrls: true } } },
      { id: 'gslides-template', name: 'Google Slides', type: 'browser-service', url: 'https://slides.google.com', icon: 'gslides-icon', color: '#f9ab00', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gslides', allowExternalUrls: true } } },
      
      // Microsoft Office & OneDrive
      { id: 'onedrive-template', name: 'OneDrive', type: 'browser-service', url: 'https://onedrive.live.com', icon: 'onedrive-icon', color: '#0078d4', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:onedrive', allowExternalUrls: true } } },
      { id: 'office-template', name: 'Office 365', type: 'browser-service', url: 'https://office.com', icon: 'office-icon', color: '#D13438', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:office', allowExternalUrls: true } } },
      { id: 'sharepoint-template', name: 'SharePoint', type: 'browser-service', url: 'https://sharepoint.com', icon: 'sharepoint-icon', color: '#0078d4', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:sharepoint', allowExternalUrls: true } } },
      
      // Cloud Storage & File Sharing
      { id: 'dropbox-template', name: 'Dropbox', type: 'browser-service', url: 'https://dropbox.com', icon: 'dropbox-icon', color: '#0061FF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:dropbox', allowExternalUrls: true } } },
      { id: 'box-template', name: 'Box', type: 'browser-service', url: 'https://app.box.com', icon: 'box-icon', color: '#0061D5', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:box', allowExternalUrls: true } } },
      
      // Design & Creative
      { id: 'figma-template', name: 'Figma', type: 'browser-service', url: 'https://figma.com', icon: 'figma-icon', color: '#F24E1E', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:figma', allowExternalUrls: true } } },
      { id: 'canva-template', name: 'Canva', type: 'browser-service', url: 'https://canva.com', icon: 'canva-icon', color: '#00C4CC', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:canva', allowExternalUrls: true } } },
      { id: 'adobe-template', name: 'Adobe Creative Cloud', type: 'browser-service', url: 'https://creativecloud.adobe.com', icon: 'adobe-icon', color: '#FF0000', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:adobe', allowExternalUrls: true } } },
      { id: 'sketch-template', name: 'Sketch', type: 'browser-service', url: 'https://sketch.com', icon: 'sketch-icon', color: '#F7B500', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:sketch', allowExternalUrls: true } } },
      
      // Business & CRM
      { id: 'salesforce-template', name: 'Salesforce', type: 'browser-service', url: 'https://login.salesforce.com', icon: 'salesforce-icon', color: '#00A1E0', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:salesforce', allowExternalUrls: true } } },
      { id: 'hubspot-template', name: 'HubSpot', type: 'browser-service', url: 'https://app.hubspot.com', icon: 'hubspot-icon', color: '#FF7A59', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:hubspot', allowExternalUrls: true } } },
      { id: 'zendesk-template', name: 'Zendesk', type: 'browser-service', url: 'https://zendesk.com', icon: 'zendesk-icon', color: '#03363D', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:zendesk', allowExternalUrls: true } } },
      { id: 'intercom-template', name: 'Intercom', type: 'browser-service', url: 'https://app.intercom.com', icon: 'intercom-icon', color: '#1f8ded', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:intercom', allowExternalUrls: true } } },
      { id: 'pipedrive-template', name: 'Pipedrive', type: 'browser-service', url: 'https://app.pipedrive.com', icon: 'pipedrive-icon', color: '#28a745', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:pipedrive', allowExternalUrls: true } } },
      
      // Analytics & Marketing
      { id: 'analytics-template', name: 'Google Analytics', type: 'browser-service', url: 'https://analytics.google.com', icon: 'analytics-icon', color: '#E37400', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:analytics', allowExternalUrls: true } } },
      { id: 'mixpanel-template', name: 'Mixpanel', type: 'browser-service', url: 'https://mixpanel.com', icon: 'mixpanel-icon', color: '#674ea7', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:mixpanel', allowExternalUrls: true } } },
      { id: 'amplitude-template', name: 'Amplitude', type: 'browser-service', url: 'https://app.amplitude.com', icon: 'amplitude-icon', color: '#0066FF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:amplitude', allowExternalUrls: true } } },
      
      // Social Media Management
      { id: 'buffer-template', name: 'Buffer', type: 'browser-service', url: 'https://buffer.com', icon: 'buffer-icon', color: '#168eea', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:buffer', allowExternalUrls: true } } },
      { id: 'hootsuite-template', name: 'Hootsuite', type: 'browser-service', url: 'https://hootsuite.com', icon: 'hootsuite-icon', color: '#143d52', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:hootsuite', allowExternalUrls: true } } },
      
      // Finance & Accounting
      { id: 'quickbooks-template', name: 'QuickBooks', type: 'browser-service', url: 'https://qbo.intuit.com', icon: 'quickbooks-icon', color: '#0077C5', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:quickbooks', allowExternalUrls: true } } },
      { id: 'xero-template', name: 'Xero', type: 'browser-service', url: 'https://go.xero.com', icon: 'xero-icon', color: '#13B5EA', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:xero', allowExternalUrls: true } } },
      { id: 'stripe-template', name: 'Stripe', type: 'browser-service', url: 'https://dashboard.stripe.com', icon: 'stripe-icon', color: '#635BFF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:stripe', allowExternalUrls: true } } },
      
      // Custom Service
      { id: 'custom-template', name: 'Custom Service', type: 'browser-service', url: '', icon: 'custom-icon', color: '#666666', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:custom', allowExternalUrls: true } } }
    ];
  }

  async cleanup(): Promise<void> {
    for (const workspace of this.workspaces.values()) {
      await this.saveWorkspace(workspace);
    }
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    this.removeAllListeners();
  }
}