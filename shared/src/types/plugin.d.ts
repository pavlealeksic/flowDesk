/**
 * Plugin System Types for Flow Desk
 *
 * Defines comprehensive types for plugin manifests, permissions, runtime environment,
 * marketplace, and plugin SDK following Blueprint.md requirements.
 */
import { z } from 'zod';
/**
 * Plugin types
 */
export type PluginType = 'connector' | 'panel' | 'view' | 'automation' | 'widget' | 'theme' | 'integration';
/**
 * Plugin manifest (plugin.json)
 */
export interface PluginManifest {
    /** Plugin identifier (unique) */
    id: string;
    /** Plugin name */
    name: string;
    /** Plugin version (semver) */
    version: string;
    /** Plugin description */
    description: string;
    /** Plugin author */
    author: string;
    /** Author email */
    authorEmail?: string;
    /** Plugin homepage URL */
    homepage?: string;
    /** Plugin repository URL */
    repository?: string;
    /** Plugin documentation URL */
    documentation?: string;
    /** Plugin license */
    license: string;
    /** Plugin type */
    type: PluginType;
    /** Plugin category */
    category: PluginCategory;
    /** Plugin tags for discovery */
    tags: string[];
    /** Plugin icon URL */
    icon?: string;
    /** Plugin screenshots */
    screenshots?: string[];
    /** Minimum Flow Desk version required */
    minFlowDeskVersion: string;
    /** Maximum Flow Desk version supported */
    maxFlowDeskVersion?: string;
    /** Supported platforms */
    platforms: Platform[];
    /** Plugin permissions */
    permissions: PluginPermission[];
    /** Plugin scopes */
    scopes: PluginScope[];
    /** Plugin entrypoints */
    entrypoints: PluginEntrypoint[];
    /** Plugin configuration schema */
    configSchema?: PluginConfigSchema;
    /** Plugin dependencies */
    dependencies?: PluginDependency[];
    /** Plugin capabilities */
    capabilities: PluginCapabilities;
    /** Plugin marketplace info */
    marketplace?: PluginMarketplaceInfo;
    /** Plugin build info */
    build: PluginBuildInfo;
}
/**
 * Plugin categories
 */
export type PluginCategory = 'communication' | 'productivity' | 'meetings' | 'development' | 'storage' | 'crm' | 'support' | 'marketing' | 'finance' | 'ai' | 'utilities' | 'themes' | 'other';
/**
 * Supported platforms
 */
export type Platform = 'desktop' | 'mobile' | 'web';
/**
 * Plugin permissions
 */
export type PluginPermission = 'read:emails' | 'write:emails' | 'read:calendar' | 'write:calendar' | 'read:contacts' | 'write:contacts' | 'read:files' | 'write:files' | 'network' | 'filesystem' | 'notifications' | 'clipboard' | 'keychain' | 'ui:panels' | 'ui:menus' | 'ui:commands' | 'ui:dialogs' | 'ui:notifications' | 'automation' | 'search:index' | 'search:query' | 'events:listen' | 'events:emit' | 'system:shell' | 'system:process' | 'system:registry';
/**
 * Plugin scopes (OAuth-style)
 */
export type PluginScope = 'user:read' | 'user:write' | 'workspace:read' | 'workspace:write' | 'mail:read' | 'mail:write' | 'mail:send' | 'calendar:read' | 'calendar:write' | 'contacts:read' | 'contacts:write' | 'files:read' | 'files:write' | 'search:read' | 'search:write' | 'notifications:read' | 'notifications:write' | 'automation:read' | 'automation:write';
/**
 * Plugin entrypoint
 */
export interface PluginEntrypoint {
    /** Entrypoint type */
    type: 'main' | 'background' | 'content' | 'popup' | 'panel' | 'automation';
    /** Entry file path */
    file: string;
    /** Platform-specific overrides */
    platforms?: Partial<Record<Platform, string>>;
}
/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
    /** JSON Schema for plugin configuration */
    schema: Record<string, any>;
    /** UI schema for configuration form */
    uiSchema?: Record<string, any>;
    /** Default configuration values */
    defaults?: Record<string, any>;
}
/**
 * Plugin dependency
 */
export interface PluginDependency {
    /** Dependency plugin ID */
    pluginId: string;
    /** Required version range (semver) */
    version: string;
    /** Whether dependency is optional */
    optional: boolean;
}
/**
 * Plugin capabilities
 */
export interface PluginCapabilities {
    /** Can handle search queries */
    search?: boolean;
    /** Can provide notifications */
    notifications?: boolean;
    /** Can provide automations */
    automations?: boolean;
    /** Can provide OAuth authentication */
    oauth?: boolean;
    /** Can provide webhooks */
    webhooks?: boolean;
    /** Can provide file previews */
    filePreviews?: boolean;
    /** Can provide quick actions */
    quickActions?: boolean;
    /** Can provide contextual data */
    contextualData?: boolean;
    /** Real-time data updates */
    realTime?: boolean;
    /** Offline functionality */
    offline?: boolean;
}
/**
 * Plugin marketplace information
 */
export interface PluginMarketplaceInfo {
    /** Whether plugin is published */
    published: boolean;
    /** Plugin pricing */
    pricing: PluginPricing;
    /** Supported regions */
    regions?: string[];
    /** Age rating */
    ageRating?: 'everyone' | 'teen' | 'mature';
    /** Content rating */
    contentRating?: string[];
    /** Privacy policy URL */
    privacyPolicy?: string;
    /** Terms of service URL */
    termsOfService?: string;
    /** Support contact */
    support?: {
        email?: string;
        url?: string;
        phone?: string;
    };
}
/**
 * Plugin pricing
 */
export interface PluginPricing {
    /** Pricing model */
    model: 'free' | 'paid' | 'subscription' | 'freemium';
    /** Price in cents (USD) */
    price?: number;
    /** Currency code */
    currency?: string;
    /** Billing period for subscriptions */
    billingPeriod?: 'monthly' | 'yearly';
    /** Free trial period in days */
    trialDays?: number;
    /** Free tier limitations */
    freeTierLimits?: Record<string, any>;
}
/**
 * Plugin build information
 */
export interface PluginBuildInfo {
    /** Build timestamp */
    buildTime: string;
    /** Build environment */
    environment: 'development' | 'staging' | 'production';
    /** Git commit hash */
    commit?: string;
    /** Bundle size in bytes */
    bundleSize?: number;
    /** Build tools used */
    buildTools?: string[];
    /** Content Security Policy */
    csp?: string;
}
/**
 * Plugin installation record
 */
export interface PluginInstallation {
    /** Installation ID */
    id: string;
    /** User ID */
    userId: string;
    /** Workspace ID (optional) */
    workspaceId?: string;
    /** Plugin ID */
    pluginId: string;
    /** Installed version */
    version: string;
    /** Installation status */
    status: PluginInstallationStatus;
    /** Plugin configuration */
    config: Record<string, any>;
    /** Installation settings */
    settings: PluginSettings;
    /** Granted permissions */
    grantedPermissions: PluginPermission[];
    /** Granted scopes */
    grantedScopes: PluginScope[];
    /** Installation date */
    installedAt: Date;
    /** Last update date */
    updatedAt: Date;
    /** Last used date */
    lastUsedAt?: Date;
    /** Usage statistics */
    usageStats?: PluginUsageStats;
}
/**
 * Plugin installation status
 */
export type PluginInstallationStatus = 'installing' | 'active' | 'disabled' | 'updating' | 'error' | 'uninstalling';
/**
 * Plugin settings
 */
export interface PluginSettings {
    /** Whether plugin is enabled */
    enabled: boolean;
    /** Auto-update enabled */
    autoUpdate: boolean;
    /** Plugin visibility in UI */
    visible: boolean;
    /** Plugin order/priority */
    order: number;
    /** Notification settings */
    notifications: {
        enabled: boolean;
        types: string[];
    };
}
/**
 * Plugin usage statistics
 */
export interface PluginUsageStats {
    /** Total invocations */
    totalInvocations: number;
    /** Last 30 days invocations */
    recentInvocations: number;
    /** Average response time in ms */
    avgResponseTime: number;
    /** Error rate (0-1) */
    errorRate: number;
    /** Most used features */
    topFeatures: Array<{
        feature: string;
        count: number;
    }>;
}
/**
 * Plugin runtime context
 */
export interface PluginRuntimeContext {
    /** Plugin installation info */
    plugin: PluginInstallation;
    /** Current user context */
    user: {
        id: string;
        email: string;
        name: string;
        preferences: Record<string, any>;
    };
    /** Current workspace context */
    workspace?: {
        id: string;
        name: string;
        settings: Record<string, any>;
    };
    /** Platform information */
    platform: {
        type: Platform;
        version: string;
        os: string;
    };
    /** Plugin API instance */
    api: PluginAPI;
}
/**
 * Plugin API interface
 */
export interface PluginAPI {
    /** API version */
    readonly version: string;
    /** Plugin metadata */
    readonly plugin: PluginManifest;
    /** Platform info */
    readonly platform: {
        type: Platform;
        version: string;
        os: string;
    };
    storage: {
        /** Get stored value */
        get<T>(key: string): Promise<T | null>;
        /** Store value */
        set<T>(key: string, value: T): Promise<void>;
        /** Remove stored value */
        remove(key: string): Promise<void>;
        /** Clear all stored values */
        clear(): Promise<void>;
        /** List all keys */
        keys(): Promise<string[]>;
    };
    events: {
        /** Emit event */
        emit(type: string, data: any): void;
        /** Listen to events */
        on<T>(type: string, handler: (data: T) => void): () => void;
        /** Remove event listener */
        off<T>(type: string, handler: (data: T) => void): void;
        /** Listen once */
        once<T>(type: string, handler: (data: T) => void): void;
    };
    ui: {
        /** Show notification */
        showNotification(options: NotificationOptions): void;
        /** Show dialog */
        showDialog(options: DialogOptions): Promise<any>;
        /** Add command to palette */
        addCommand(command: CommandRegistration): void;
        /** Remove command */
        removeCommand(commandId: string): void;
        /** Add menu item */
        addMenuItem(item: MenuItemRegistration): void;
        /** Show context menu */
        showContextMenu(items: ContextMenuItem[]): void;
        /** Create panel */
        createPanel(options: PanelOptions): Promise<Panel>;
    };
    data: {
        mail: {
            /** Get email accounts */
            getAccounts(): Promise<any[]>;
            /** Get messages */
            getMessages(accountId: string, options?: any): Promise<any[]>;
            /** Send message */
            sendMessage(accountId: string, message: any): Promise<void>;
            /** Search messages */
            searchMessages(query: string, options?: any): Promise<any>;
        };
        calendar: {
            /** Get calendar accounts */
            getAccounts(): Promise<any[]>;
            /** Get events */
            getEvents(accountId: string, options?: any): Promise<any[]>;
            /** Create event */
            createEvent(accountId: string, event: any): Promise<any>;
            /** Update event */
            updateEvent(eventId: string, updates: any): Promise<any>;
            /** Delete event */
            deleteEvent(eventId: string): Promise<void>;
        };
        contacts: {
            /** Get contacts */
            getContacts(): Promise<any[]>;
            /** Search contacts */
            searchContacts(query: string): Promise<any[]>;
        };
        files: {
            /** Read file */
            readFile(path: string): Promise<Buffer>;
            /** Write file */
            writeFile(path: string, content: Buffer): Promise<void>;
            /** List directory */
            listDirectory(path: string): Promise<string[]>;
        };
    };
    network: {
        /** Make HTTP request */
        fetch(url: string, options?: RequestInit): Promise<Response>;
        /** WebSocket connection */
        websocket(url: string): Promise<WebSocket>;
    };
    search: {
        /** Register search provider */
        registerProvider(provider: SearchProvider): void;
        /** Perform search */
        search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
        /** Index content */
        index(content: SearchableContent): Promise<void>;
    };
    automation: {
        /** Register trigger */
        registerTrigger(trigger: TriggerDefinition): void;
        /** Register action */
        registerAction(action: ActionDefinition): void;
        /** Execute automation */
        execute(automationId: string, context: any): Promise<any>;
    };
    oauth: {
        /** Start OAuth flow */
        startFlow(provider: string, scopes: string[]): Promise<string>;
        /** Exchange code for token */
        exchangeCode(code: string): Promise<OAuthTokens>;
        /** Refresh token */
        refreshToken(refreshToken: string): Promise<OAuthTokens>;
    };
    webhooks: {
        /** Register webhook */
        register(url: string, events: string[]): Promise<string>;
        /** Unregister webhook */
        unregister(webhookId: string): Promise<void>;
    };
    logger: {
        /** Log debug message */
        debug(message: string, ...args: any[]): void;
        /** Log info message */
        info(message: string, ...args: any[]): void;
        /** Log warning message */
        warn(message: string, ...args: any[]): void;
        /** Log error message */
        error(message: string, ...args: any[]): void;
    };
}
/**
 * Plugin notification options
 */
export interface NotificationOptions {
    /** Notification title */
    title: string;
    /** Notification body */
    body?: string;
    /** Notification icon */
    icon?: string;
    /** Notification actions */
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
    /** Auto-hide timeout in ms */
    timeout?: number;
}
/**
 * Plugin dialog options
 */
export interface DialogOptions {
    /** Dialog title */
    title: string;
    /** Dialog content (HTML or React component) */
    content: string | any;
    /** Dialog buttons */
    buttons?: Array<{
        label: string;
        value: any;
        variant?: 'primary' | 'secondary' | 'danger';
    }>;
    /** Dialog size */
    size?: 'small' | 'medium' | 'large';
    /** Whether dialog is modal */
    modal?: boolean;
}
/**
 * Command registration
 */
export interface CommandRegistration {
    /** Command ID */
    id: string;
    /** Command title */
    title: string;
    /** Command description */
    description?: string;
    /** Command icon */
    icon?: string;
    /** Keyboard shortcut */
    shortcut?: string;
    /** Command handler */
    handler: () => void | Promise<void>;
    /** When command is available */
    when?: string;
}
/**
 * Menu item registration
 */
export interface MenuItemRegistration {
    /** Menu location */
    location: 'toolbar' | 'context' | 'main';
    /** Menu item */
    item: {
        id: string;
        label: string;
        icon?: string;
        shortcut?: string;
        action: () => void;
        submenu?: MenuItemRegistration[];
    };
}
/**
 * Context menu item
 */
export interface ContextMenuItem {
    /** Item ID */
    id: string;
    /** Item label */
    label: string;
    /** Item icon */
    icon?: string;
    /** Item action */
    action: () => void;
    /** Whether item is disabled */
    disabled?: boolean;
    /** Item submenu */
    submenu?: ContextMenuItem[];
}
/**
 * Panel options
 */
export interface PanelOptions {
    /** Panel title */
    title: string;
    /** Panel icon */
    icon?: string;
    /** Panel location */
    location: 'sidebar' | 'bottom' | 'floating';
    /** Panel content (HTML or React component) */
    content: string | any;
    /** Panel size */
    size?: {
        width?: number;
        height?: number;
    };
    /** Whether panel is resizable */
    resizable?: boolean;
}
/**
 * Panel instance
 */
export interface Panel {
    /** Panel ID */
    id: string;
    /** Show panel */
    show(): void;
    /** Hide panel */
    hide(): void;
    /** Update panel content */
    updateContent(content: string | any): void;
    /** Close panel */
    close(): void;
    /** Panel event emitter */
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
}
/**
 * Search provider registration
 */
export interface SearchProvider {
    /** Provider ID */
    id: string;
    /** Provider name */
    name: string;
    /** Provider icon */
    icon?: string;
    /** Search handler */
    search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
    /** Supported content types */
    contentTypes?: string[];
}
/**
 * Search options
 */
export interface SearchOptions {
    /** Content types to search */
    contentTypes?: string[];
    /** Maximum results */
    limit?: number;
    /** Search offset */
    offset?: number;
    /** Sort options */
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    /** Filter options */
    filters?: Record<string, any>;
}
/**
 * Search result
 */
export interface SearchResult {
    /** Result ID */
    id: string;
    /** Result title */
    title: string;
    /** Result description */
    description?: string;
    /** Result URL */
    url?: string;
    /** Result icon */
    icon?: string;
    /** Result thumbnail */
    thumbnail?: string;
    /** Result score (0-1) */
    score: number;
    /** Result metadata */
    metadata?: Record<string, any>;
    /** Content type */
    contentType: string;
    /** Source provider */
    provider: string;
    /** Last modified date */
    lastModified?: Date;
}
/**
 * Searchable content for indexing
 */
export interface SearchableContent {
    /** Content ID */
    id: string;
    /** Content title */
    title: string;
    /** Content body */
    body: string;
    /** Content URL */
    url?: string;
    /** Content type */
    contentType: string;
    /** Content metadata */
    metadata?: Record<string, any>;
    /** Content tags */
    tags?: string[];
    /** Last modified date */
    lastModified: Date;
}
/**
 * Trigger definition for automations
 */
export interface TriggerDefinition {
    /** Trigger ID */
    id: string;
    /** Trigger name */
    name: string;
    /** Trigger description */
    description?: string;
    /** Trigger configuration schema */
    configSchema?: Record<string, any>;
    /** Trigger handler */
    handler: (config: any, context: any) => Promise<boolean>;
}
/**
 * Action definition for automations
 */
export interface ActionDefinition {
    /** Action ID */
    id: string;
    /** Action name */
    name: string;
    /** Action description */
    description?: string;
    /** Action configuration schema */
    configSchema?: Record<string, any>;
    /** Action handler */
    handler: (config: any, context: any) => Promise<any>;
}
/**
 * OAuth tokens
 */
export interface OAuthTokens {
    /** Access token */
    accessToken: string;
    /** Refresh token */
    refreshToken?: string;
    /** Token expiry */
    expiresAt?: Date;
    /** Token type */
    tokenType: string;
    /** Token scope */
    scope?: string;
}
export declare const PluginManifestSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    author: z.ZodString;
    authorEmail: z.ZodOptional<z.ZodString>;
    homepage: z.ZodOptional<z.ZodString>;
    repository: z.ZodOptional<z.ZodString>;
    documentation: z.ZodOptional<z.ZodString>;
    license: z.ZodString;
    type: z.ZodEnum<["connector", "panel", "view", "automation", "widget", "theme", "integration"]>;
    category: z.ZodEnum<["communication", "productivity", "meetings", "development", "storage", "crm", "support", "marketing", "finance", "ai", "utilities", "themes", "other"]>;
    tags: z.ZodArray<z.ZodString, "many">;
    icon: z.ZodOptional<z.ZodString>;
    screenshots: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    minFlowDeskVersion: z.ZodString;
    maxFlowDeskVersion: z.ZodOptional<z.ZodString>;
    platforms: z.ZodArray<z.ZodEnum<["desktop", "mobile", "web"]>, "many">;
    permissions: z.ZodArray<z.ZodString, "many">;
    scopes: z.ZodArray<z.ZodString, "many">;
    entrypoints: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["main", "background", "content", "popup", "panel", "automation"]>;
        file: z.ZodString;
        platforms: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "content" | "popup" | "panel" | "automation" | "main" | "background";
        file: string;
        platforms?: Record<string, string> | undefined;
    }, {
        type: "content" | "popup" | "panel" | "automation" | "main" | "background";
        file: string;
        platforms?: Record<string, string> | undefined;
    }>, "many">;
    configSchema: z.ZodOptional<z.ZodObject<{
        schema: z.ZodRecord<z.ZodString, z.ZodAny>;
        uiSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        defaults: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        schema: Record<string, any>;
        uiSchema?: Record<string, any> | undefined;
        defaults?: Record<string, any> | undefined;
    }, {
        schema: Record<string, any>;
        uiSchema?: Record<string, any> | undefined;
        defaults?: Record<string, any> | undefined;
    }>>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        pluginId: z.ZodString;
        version: z.ZodString;
        optional: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        version: string;
        optional: boolean;
        pluginId: string;
    }, {
        version: string;
        optional: boolean;
        pluginId: string;
    }>, "many">>;
    capabilities: z.ZodObject<{
        search: z.ZodOptional<z.ZodBoolean>;
        notifications: z.ZodOptional<z.ZodBoolean>;
        automations: z.ZodOptional<z.ZodBoolean>;
        oauth: z.ZodOptional<z.ZodBoolean>;
        webhooks: z.ZodOptional<z.ZodBoolean>;
        filePreviews: z.ZodOptional<z.ZodBoolean>;
        quickActions: z.ZodOptional<z.ZodBoolean>;
        contextualData: z.ZodOptional<z.ZodBoolean>;
        realTime: z.ZodOptional<z.ZodBoolean>;
        offline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        offline?: boolean | undefined;
        search?: boolean | undefined;
        notifications?: boolean | undefined;
        automations?: boolean | undefined;
        oauth?: boolean | undefined;
        webhooks?: boolean | undefined;
        filePreviews?: boolean | undefined;
        quickActions?: boolean | undefined;
        contextualData?: boolean | undefined;
        realTime?: boolean | undefined;
    }, {
        offline?: boolean | undefined;
        search?: boolean | undefined;
        notifications?: boolean | undefined;
        automations?: boolean | undefined;
        oauth?: boolean | undefined;
        webhooks?: boolean | undefined;
        filePreviews?: boolean | undefined;
        quickActions?: boolean | undefined;
        contextualData?: boolean | undefined;
        realTime?: boolean | undefined;
    }>;
    marketplace: z.ZodOptional<z.ZodObject<{
        published: z.ZodBoolean;
        pricing: z.ZodObject<{
            model: z.ZodEnum<["free", "paid", "subscription", "freemium"]>;
            price: z.ZodOptional<z.ZodNumber>;
            currency: z.ZodOptional<z.ZodString>;
            billingPeriod: z.ZodOptional<z.ZodEnum<["monthly", "yearly"]>>;
            trialDays: z.ZodOptional<z.ZodNumber>;
            freeTierLimits: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            model: "free" | "paid" | "subscription" | "freemium";
            price?: number | undefined;
            currency?: string | undefined;
            billingPeriod?: "monthly" | "yearly" | undefined;
            trialDays?: number | undefined;
            freeTierLimits?: Record<string, any> | undefined;
        }, {
            model: "free" | "paid" | "subscription" | "freemium";
            price?: number | undefined;
            currency?: string | undefined;
            billingPeriod?: "monthly" | "yearly" | undefined;
            trialDays?: number | undefined;
            freeTierLimits?: Record<string, any> | undefined;
        }>;
        regions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        ageRating: z.ZodOptional<z.ZodEnum<["everyone", "teen", "mature"]>>;
        contentRating: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        privacyPolicy: z.ZodOptional<z.ZodString>;
        termsOfService: z.ZodOptional<z.ZodString>;
        support: z.ZodOptional<z.ZodObject<{
            email: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
            phone: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            email?: string | undefined;
            url?: string | undefined;
            phone?: string | undefined;
        }, {
            email?: string | undefined;
            url?: string | undefined;
            phone?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        published: boolean;
        pricing: {
            model: "free" | "paid" | "subscription" | "freemium";
            price?: number | undefined;
            currency?: string | undefined;
            billingPeriod?: "monthly" | "yearly" | undefined;
            trialDays?: number | undefined;
            freeTierLimits?: Record<string, any> | undefined;
        };
        support?: {
            email?: string | undefined;
            url?: string | undefined;
            phone?: string | undefined;
        } | undefined;
        regions?: string[] | undefined;
        ageRating?: "everyone" | "teen" | "mature" | undefined;
        contentRating?: string[] | undefined;
        privacyPolicy?: string | undefined;
        termsOfService?: string | undefined;
    }, {
        published: boolean;
        pricing: {
            model: "free" | "paid" | "subscription" | "freemium";
            price?: number | undefined;
            currency?: string | undefined;
            billingPeriod?: "monthly" | "yearly" | undefined;
            trialDays?: number | undefined;
            freeTierLimits?: Record<string, any> | undefined;
        };
        support?: {
            email?: string | undefined;
            url?: string | undefined;
            phone?: string | undefined;
        } | undefined;
        regions?: string[] | undefined;
        ageRating?: "everyone" | "teen" | "mature" | undefined;
        contentRating?: string[] | undefined;
        privacyPolicy?: string | undefined;
        termsOfService?: string | undefined;
    }>>;
    build: z.ZodObject<{
        buildTime: z.ZodString;
        environment: z.ZodEnum<["development", "staging", "production"]>;
        commit: z.ZodOptional<z.ZodString>;
        bundleSize: z.ZodOptional<z.ZodNumber>;
        buildTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        csp: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        buildTime: string;
        environment: "development" | "staging" | "production";
        commit?: string | undefined;
        bundleSize?: number | undefined;
        buildTools?: string[] | undefined;
        csp?: string | undefined;
    }, {
        buildTime: string;
        environment: "development" | "staging" | "production";
        commit?: string | undefined;
        bundleSize?: number | undefined;
        buildTools?: string[] | undefined;
        csp?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    scopes: string[];
    description: string;
    type: "theme" | "connector" | "panel" | "view" | "automation" | "widget" | "integration";
    version: string;
    author: string;
    tags: string[];
    permissions: string[];
    category: "development" | "other" | "communication" | "productivity" | "meetings" | "storage" | "crm" | "support" | "marketing" | "finance" | "ai" | "utilities" | "themes";
    license: string;
    minFlowDeskVersion: string;
    platforms: ("desktop" | "mobile" | "web")[];
    entrypoints: {
        type: "content" | "popup" | "panel" | "automation" | "main" | "background";
        file: string;
        platforms?: Record<string, string> | undefined;
    }[];
    capabilities: {
        offline?: boolean | undefined;
        search?: boolean | undefined;
        notifications?: boolean | undefined;
        automations?: boolean | undefined;
        oauth?: boolean | undefined;
        webhooks?: boolean | undefined;
        filePreviews?: boolean | undefined;
        quickActions?: boolean | undefined;
        contextualData?: boolean | undefined;
        realTime?: boolean | undefined;
    };
    build: {
        buildTime: string;
        environment: "development" | "staging" | "production";
        commit?: string | undefined;
        bundleSize?: number | undefined;
        buildTools?: string[] | undefined;
        csp?: string | undefined;
    };
    repository?: string | undefined;
    icon?: string | undefined;
    authorEmail?: string | undefined;
    homepage?: string | undefined;
    documentation?: string | undefined;
    screenshots?: string[] | undefined;
    maxFlowDeskVersion?: string | undefined;
    configSchema?: {
        schema: Record<string, any>;
        uiSchema?: Record<string, any> | undefined;
        defaults?: Record<string, any> | undefined;
    } | undefined;
    dependencies?: {
        version: string;
        optional: boolean;
        pluginId: string;
    }[] | undefined;
    marketplace?: {
        published: boolean;
        pricing: {
            model: "free" | "paid" | "subscription" | "freemium";
            price?: number | undefined;
            currency?: string | undefined;
            billingPeriod?: "monthly" | "yearly" | undefined;
            trialDays?: number | undefined;
            freeTierLimits?: Record<string, any> | undefined;
        };
        support?: {
            email?: string | undefined;
            url?: string | undefined;
            phone?: string | undefined;
        } | undefined;
        regions?: string[] | undefined;
        ageRating?: "everyone" | "teen" | "mature" | undefined;
        contentRating?: string[] | undefined;
        privacyPolicy?: string | undefined;
        termsOfService?: string | undefined;
    } | undefined;
}, {
    id: string;
    name: string;
    scopes: string[];
    description: string;
    type: "theme" | "connector" | "panel" | "view" | "automation" | "widget" | "integration";
    version: string;
    author: string;
    tags: string[];
    permissions: string[];
    category: "development" | "other" | "communication" | "productivity" | "meetings" | "storage" | "crm" | "support" | "marketing" | "finance" | "ai" | "utilities" | "themes";
    license: string;
    minFlowDeskVersion: string;
    platforms: ("desktop" | "mobile" | "web")[];
    entrypoints: {
        type: "content" | "popup" | "panel" | "automation" | "main" | "background";
        file: string;
        platforms?: Record<string, string> | undefined;
    }[];
    capabilities: {
        offline?: boolean | undefined;
        search?: boolean | undefined;
        notifications?: boolean | undefined;
        automations?: boolean | undefined;
        oauth?: boolean | undefined;
        webhooks?: boolean | undefined;
        filePreviews?: boolean | undefined;
        quickActions?: boolean | undefined;
        contextualData?: boolean | undefined;
        realTime?: boolean | undefined;
    };
    build: {
        buildTime: string;
        environment: "development" | "staging" | "production";
        commit?: string | undefined;
        bundleSize?: number | undefined;
        buildTools?: string[] | undefined;
        csp?: string | undefined;
    };
    repository?: string | undefined;
    icon?: string | undefined;
    authorEmail?: string | undefined;
    homepage?: string | undefined;
    documentation?: string | undefined;
    screenshots?: string[] | undefined;
    maxFlowDeskVersion?: string | undefined;
    configSchema?: {
        schema: Record<string, any>;
        uiSchema?: Record<string, any> | undefined;
        defaults?: Record<string, any> | undefined;
    } | undefined;
    dependencies?: {
        version: string;
        optional: boolean;
        pluginId: string;
    }[] | undefined;
    marketplace?: {
        published: boolean;
        pricing: {
            model: "free" | "paid" | "subscription" | "freemium";
            price?: number | undefined;
            currency?: string | undefined;
            billingPeriod?: "monthly" | "yearly" | undefined;
            trialDays?: number | undefined;
            freeTierLimits?: Record<string, any> | undefined;
        };
        support?: {
            email?: string | undefined;
            url?: string | undefined;
            phone?: string | undefined;
        } | undefined;
        regions?: string[] | undefined;
        ageRating?: "everyone" | "teen" | "mature" | undefined;
        contentRating?: string[] | undefined;
        privacyPolicy?: string | undefined;
        termsOfService?: string | undefined;
    } | undefined;
}>;
export declare const PluginInstallationSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodOptional<z.ZodString>;
    pluginId: z.ZodString;
    version: z.ZodString;
    status: z.ZodEnum<["installing", "active", "disabled", "updating", "error", "uninstalling"]>;
    config: z.ZodRecord<z.ZodString, z.ZodAny>;
    settings: z.ZodObject<{
        enabled: z.ZodBoolean;
        autoUpdate: z.ZodBoolean;
        visible: z.ZodBoolean;
        order: z.ZodNumber;
        notifications: z.ZodObject<{
            enabled: z.ZodBoolean;
            types: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            types: string[];
        }, {
            enabled: boolean;
            types: string[];
        }>;
    }, "strip", z.ZodTypeAny, {
        notifications: {
            enabled: boolean;
            types: string[];
        };
        enabled: boolean;
        autoUpdate: boolean;
        visible: boolean;
        order: number;
    }, {
        notifications: {
            enabled: boolean;
            types: string[];
        };
        enabled: boolean;
        autoUpdate: boolean;
        visible: boolean;
        order: number;
    }>;
    grantedPermissions: z.ZodArray<z.ZodString, "many">;
    grantedScopes: z.ZodArray<z.ZodString, "many">;
    installedAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastUsedAt: z.ZodOptional<z.ZodDate>;
    usageStats: z.ZodOptional<z.ZodObject<{
        totalInvocations: z.ZodNumber;
        recentInvocations: z.ZodNumber;
        avgResponseTime: z.ZodNumber;
        errorRate: z.ZodNumber;
        topFeatures: z.ZodArray<z.ZodObject<{
            feature: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            feature: string;
        }, {
            count: number;
            feature: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        totalInvocations: number;
        recentInvocations: number;
        avgResponseTime: number;
        errorRate: number;
        topFeatures: {
            count: number;
            feature: string;
        }[];
    }, {
        totalInvocations: number;
        recentInvocations: number;
        avgResponseTime: number;
        errorRate: number;
        topFeatures: {
            count: number;
            feature: string;
        }[];
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    updatedAt: Date;
    userId: string;
    config: Record<string, any>;
    status: "active" | "disabled" | "error" | "installing" | "updating" | "uninstalling";
    version: string;
    settings: {
        notifications: {
            enabled: boolean;
            types: string[];
        };
        enabled: boolean;
        autoUpdate: boolean;
        visible: boolean;
        order: number;
    };
    pluginId: string;
    grantedPermissions: string[];
    grantedScopes: string[];
    installedAt: Date;
    workspaceId?: string | undefined;
    lastUsedAt?: Date | undefined;
    usageStats?: {
        totalInvocations: number;
        recentInvocations: number;
        avgResponseTime: number;
        errorRate: number;
        topFeatures: {
            count: number;
            feature: string;
        }[];
    } | undefined;
}, {
    id: string;
    updatedAt: Date;
    userId: string;
    config: Record<string, any>;
    status: "active" | "disabled" | "error" | "installing" | "updating" | "uninstalling";
    version: string;
    settings: {
        notifications: {
            enabled: boolean;
            types: string[];
        };
        enabled: boolean;
        autoUpdate: boolean;
        visible: boolean;
        order: number;
    };
    pluginId: string;
    grantedPermissions: string[];
    grantedScopes: string[];
    installedAt: Date;
    workspaceId?: string | undefined;
    lastUsedAt?: Date | undefined;
    usageStats?: {
        totalInvocations: number;
        recentInvocations: number;
        avgResponseTime: number;
        errorRate: number;
        topFeatures: {
            count: number;
            feature: string;
        }[];
    } | undefined;
}>;
/**
 * Utility types for plugin operations
 */
export type CreatePluginInstallationInput = Omit<PluginInstallation, 'id' | 'installedAt' | 'updatedAt' | 'lastUsedAt' | 'usageStats'>;
export type UpdatePluginInstallationInput = Partial<Pick<PluginInstallation, 'config' | 'settings' | 'grantedPermissions' | 'grantedScopes'>>;
/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
    /** Plugin manifest */
    manifest: PluginManifest;
    /** Plugin package info */
    package: {
        /** Package URL */
        url: string;
        /** Package hash (SHA-256) */
        hash: string;
        /** Package size in bytes */
        size: number;
        /** Package signature */
        signature?: string;
    };
    /** Registry metadata */
    registry: {
        /** Registry ID */
        id: string;
        /** Publication date */
        publishedAt: Date;
        /** Last update date */
        updatedAt: Date;
        /** Download count */
        downloadCount: number;
        /** Rating (1-5) */
        rating?: number;
        /** Review count */
        reviewCount?: number;
        /** Verification status */
        verified: boolean;
        /** Featured status */
        featured: boolean;
    };
}
/**
 * Plugin review
 */
export interface PluginReview {
    /** Review ID */
    id: string;
    /** Plugin ID */
    pluginId: string;
    /** Reviewer user ID */
    userId: string;
    /** Review rating (1-5) */
    rating: number;
    /** Review title */
    title?: string;
    /** Review content */
    content?: string;
    /** Plugin version reviewed */
    version: string;
    /** Review date */
    createdAt: Date;
    /** Review update date */
    updatedAt: Date;
    /** Whether review is verified purchase */
    verifiedPurchase: boolean;
    /** Helpful votes */
    helpfulVotes: number;
}
//# sourceMappingURL=plugin.d.ts.map