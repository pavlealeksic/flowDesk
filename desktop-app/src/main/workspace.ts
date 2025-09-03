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

  async createWorkspace(name: string, description?: string): Promise<Workspace> {
    const workspace: Workspace = {
      id: `ws_${Date.now()}`,
      name,
      description,
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

  async shutdown(): Promise<void> {
    this.removeAllListeners();
  }
}