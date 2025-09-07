/**
 * Type definitions for the renderer process preload API
 * Workspace-only implementation - email and calendar removed
 */

export interface Workspace {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
    description?: string;
    icon?: string;
    browserIsolation?: 'shared' | 'isolated';
    services: WorkspaceService[];
    members?: string[];
    created: Date;
    lastAccessed: Date;
    isActive: boolean;
}

export interface WorkspaceService {
    id: string;
    name: string;
    type: string;
    url: string;
    iconUrl?: string;
    isEnabled: boolean;
    config: Record<string, unknown>;
}

export interface ThemeSettings {
    theme: 'light' | 'dark' | 'system';
    name?: string;
    accentColor: string;
    fontSize: number;
}

export interface NotificationOptions {
    title: string;
    body?: string;
    icon?: string;
    silent?: boolean;
    actions?: NotificationAction[];
}

export interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
}

export interface SearchResult {
    id: string;
    title: string;
    content: string;
    type: string;
    source: string;
    score: number;
    timestamp: Date;
    url?: string;
    metadata?: Record<string, unknown>;
}

export interface SearchDocument {
    id: string;
    title: string;
    content: string;
    type: string;
    source: string;
    metadata: Record<string, unknown>;
    timestamp: Date;
}

export interface SearchProvider {
    id: string;
    name: string;
    enabled: boolean;
    weight: number;
}

export interface SearchOptions {
    query: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, unknown>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeMetadata?: boolean;
}

export interface AppSettings {
    autoLaunch: boolean;
    minimizeToTray: boolean;
    closeToTray: boolean;
    startMinimized: boolean;
    showInDock: boolean;
    language: string;
    locale: string;
    timezone: string;
    telemetry: boolean;
    crashReporting: boolean;
    updates: {
        autoDownload: boolean;
        autoInstall: boolean;
        channel: 'stable' | 'beta' | 'dev';
    };
}

export interface ConfigBackup {
    id: string;
    name: string;
    description?: string;
    data: Record<string, unknown>;
    createdAt: Date;
    size: number;
    version: string;
}

// Logging types for preload API
export interface LogEntry {
    timestamp: string;
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    message: string;
    context?: LogContext;
    metadata?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

export interface LogContext {
    process: 'main' | 'renderer' | 'preload';
    component?: string;
    userId?: string;
    workspaceId?: string;
    sessionId?: string;
    action?: string;
    performanceMarker?: {
        duration?: number;
        memory?: number;
    };
}

export interface LoggerConfig {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    enableConsole: boolean;
    enableFile: boolean;
    enablePerformance: boolean;
    enableUserActions: boolean;
}

// Main Flow Desk API exposed to renderer
export interface FlowDeskAPI {
    // Workspace management
    workspace: {
        create(data: {
            name: string;
            icon?: string;
            color: string;
            browserIsolation?: 'shared' | 'isolated';
        }): Promise<string>;
        list(): Promise<Workspace[]>;
        get(id: string): Promise<Workspace | null>;
        getCurrent(): Promise<Workspace | null>;
        switch(id: string): Promise<void>;
        update(id: string, updates: Partial<Workspace>): Promise<void>;
        delete(id: string): Promise<void>;
        addService(workspaceId: string, name: string, type: string, url: string): Promise<string>;
        removeService(workspaceId: string, serviceId: string): Promise<void>;
        loadService(workspaceId: string, serviceId: string): Promise<void>;
        updateService?(workspaceId: string, serviceId: string, updates: Partial<WorkspaceService>): Promise<void>;
        listPartitions(): Promise<any[]>;
        createPartition(config: any): Promise<void>;
        updatePartition(id: string, updates: any): Promise<void>;
        clearData(id: string): Promise<void>;
        getWindows(id: string): Promise<any[]>;
        createWindow(options: any): Promise<number>;
        hideBrowserViews?(): Promise<void>;
        showBrowserViews?(): Promise<void>;
    };

    // Theme management
    theme: {
        get(): Promise<ThemeSettings>;
        set(settings: ThemeSettings): Promise<void>;
    };

    // System integration
    system: {
        showNotification(options: NotificationOptions): Promise<void>;
        showDialog(options: any): Promise<any>;
        openExternal(url: string): Promise<void>;
        getInfo?(): Promise<any>;
    };

    // Browser view control
    browserView: {
        hide(): Promise<void>;
        show(): Promise<void>;
    };

    // Generic invoke for IPC calls
    invoke?(channel: string, ...args: any[]): Promise<any>;

    // Event handling
    on?(channel: string, callback: (...args: any[]) => void): void;
    off?(channel: string, callback: (...args: any[]) => void): void;

    // Settings management (optional - may not be implemented)
    settings?: {
        get(): Promise<AppSettings>;
        update(key: string, value: any): Promise<void>;
    };

    // Analytics (optional)
    analytics?: {
        trackError(error: any): void;
        trackUsage(event: string, data?: any): void;
        captureException?(error: any): void;
    };

    // Plugin management (optional)
    pluginManager?: {
        getInstalled(): Promise<any[]>;
        getInstalledPlugins?(): Promise<any[]>;
        searchPlugins?(query: string): Promise<any[]>;
        install(pluginId: string): Promise<void>;
        installPlugin?(pluginId: string): Promise<void>;
        uninstall(pluginId: string): Promise<void>;
        uninstallPlugin?(pluginId: string): Promise<void>;
        enable(pluginId: string): Promise<void>;
        enablePlugin?(pluginId: string): Promise<void>;
        disable(pluginId: string): Promise<void>;
        disablePlugin?(pluginId: string): Promise<void>;
    };

    // Mail API (optional - removed but may be referenced)
    mail?: {
        getAccounts(): Promise<any[]>;
        getMessages(): Promise<any[]>;
        sendMessage(data: any): Promise<void>;
        [key: string]: any;
    };

    // Logging API
    logging?: {
        log(entry: LogEntry): Promise<void>;
        flush(): Promise<void>;
        getConfig(): Promise<LoggerConfig>;
        updateConfig(config: Partial<LoggerConfig>): Promise<void>;
    };
}

// Global window interface extension
declare global {
    interface Window {
        flowDesk: FlowDeskAPI;
    }
}