/**
 * Typed ElectronStore wrapper for workspace data
 */

import Store from 'electron-store';

interface WorkspaceStoreData {
  workspaces: Record<string, {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
    services: Array<{
      id: string;
      name: string;
      type: string;
      url: string;
      iconUrl?: string;
      isEnabled: boolean;
      config: Record<string, any>;
    }>;
    created: string; // ISO string for serialization
    lastAccessed: string; // ISO string for serialization  
    isActive: boolean;
  }>;
  activeWorkspaceId?: string;
  settings: {
    defaultWorkspace?: string;
    autoSwitchOnActivity: boolean;
  };
}

export class WorkspaceStore {
  private store: Store<WorkspaceStoreData>;

  constructor() {
    this.store = new Store<WorkspaceStoreData>({
      name: 'flow-desk-workspaces',
      defaults: {
        workspaces: {},
        settings: {
          autoSwitchOnActivity: false
        }
      }
    });
  }

  getWorkspaces(): Record<string, WorkspaceStoreData['workspaces'][string]> {
    return this.store.store.workspaces;
  }

  setWorkspaces(workspaces: Record<string, WorkspaceStoreData['workspaces'][string]>): void {
    this.store.store = { ...this.store.store, workspaces };
  }

  getActiveWorkspaceId(): string | undefined {
    return this.store.store.activeWorkspaceId;
  }

  setActiveWorkspaceId(workspaceId: string | undefined): void {
    this.store.store = { ...this.store.store, activeWorkspaceId: workspaceId };
  }

  getSettings(): WorkspaceStoreData['settings'] {
    return this.store.store.settings;
  }

  setSettings(settings: WorkspaceStoreData['settings']): void {
    this.store.store = { ...this.store.store, settings };
  }
}

export default WorkspaceStore;