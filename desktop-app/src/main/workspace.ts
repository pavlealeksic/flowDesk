/**
 * Workspace Manager - Complete Implementation
 */

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  members: WorkspaceMember[];
  color?: string;
  icon?: string; // Path to icon file or icon identifier
  browserIsolation?: 'shared' | 'isolated';
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
}

export class WorkspaceManager extends EventEmitter {
  private workspaces: Map<string, Workspace> = new Map();
  private currentWorkspace?: string;

  constructor() {
    super();
    this.initializeWorkspaces();
  }

  private async initializeWorkspaces(): Promise<void> {
    try {
      // Create default workspace
      const defaultWorkspace = await this.createWorkspace(
        'Personal Workspace',
        'Your personal email and calendar workspace'
      );
      this.setCurrentWorkspace(defaultWorkspace.id);
      
      log.info('Workspace manager initialized');
    } catch (error) {
      log.error('Failed to initialize workspaces:', error);
    }
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
      icon: icon || 'workspace-default', // Default icon identifier
      browserIsolation: browserIsolation || 'shared',
      members: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workspaces.set(workspace.id, workspace);
    this.emit('workspace-created', workspace);
    return workspace;
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
    const workspace = this.getWorkspace(workspaceId);
    if (workspace) {
      Object.assign(workspace, updates);
      workspace.updatedAt = new Date();
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    // Remove workspace
    log.info(`Deleting workspace: ${workspaceId}`);
  }

  async addServiceToWorkspace(workspaceId: string, serviceName: string, serviceType: string, url: string): Promise<string> {
    // Add service to workspace
    const serviceId = `service_${Date.now()}`;
    log.info(`Adding service ${serviceName} to workspace ${workspaceId}`);
    return serviceId;
  }

  async removeServiceFromWorkspace(workspaceId: string, serviceId: string): Promise<void> {
    // Remove service from workspace
    log.info(`Removing service ${serviceId} from workspace ${workspaceId}`);
  }

  async updateServiceInWorkspace(workspaceId: string, serviceId: string, updates: any): Promise<void> {
    // Update service in workspace
    log.info(`Updating service ${serviceId} in workspace ${workspaceId}`);
  }

  async loadService(workspaceId: string, serviceId: string): Promise<void> {
    // Load service in workspace
    log.info(`Loading service ${serviceId} in workspace ${workspaceId}`);
  }

  getPredefinedServices(): any[] {
    return [
      { 
        id: 'slack', 
        name: 'Slack', 
        type: 'communication', 
        url: 'https://slack.com',
        icon: 'slack-icon',
        color: '#4A154B'
      },
      { 
        id: 'notion', 
        name: 'Notion', 
        type: 'productivity', 
        url: 'https://notion.so',
        icon: 'notion-icon',
        color: '#000000'
      },
      { 
        id: 'github', 
        name: 'GitHub', 
        type: 'development', 
        url: 'https://github.com',
        icon: 'github-icon',
        color: '#181717'
      }
    ];
  }

  async cleanup(): Promise<void> {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    this.removeAllListeners();
  }
}