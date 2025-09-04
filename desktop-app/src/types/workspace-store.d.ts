/**
 * Typed ElectronStore wrapper for workspace data
 */
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
        created: string;
        lastAccessed: string;
        isActive: boolean;
    }>;
    activeWorkspaceId?: string;
    settings: {
        defaultWorkspace?: string;
        autoSwitchOnActivity: boolean;
    };
}
export declare class WorkspaceStore {
    private store;
    constructor();
    getWorkspaces(): Record<string, WorkspaceStoreData['workspaces'][string]>;
    setWorkspaces(workspaces: Record<string, WorkspaceStoreData['workspaces'][string]>): void;
    getActiveWorkspaceId(): string | undefined;
    setActiveWorkspaceId(workspaceId: string | undefined): void;
    getSettings(): WorkspaceStoreData['settings'];
    setSettings(settings: WorkspaceStoreData['settings']): void;
}
export default WorkspaceStore;
//# sourceMappingURL=workspace-store.d.ts.map