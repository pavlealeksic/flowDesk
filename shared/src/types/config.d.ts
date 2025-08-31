/**
 * Config Sync Types for Flow Desk
 *
 * Defines comprehensive types for local-first config synchronization,
 * workspace configs, encryption keys, and sync states following Blueprint.md requirements.
 */
import { z } from 'zod';
/**
 * Workspace configuration (the main config object)
 */
export interface WorkspaceConfig {
    /** Unique workspace identifier */
    id: string;
    /** Configuration version for schema evolution */
    version: string;
    /** Workspace metadata */
    workspace: WorkspaceMetadata;
    /** User preferences */
    preferences: UserPreferences;
    /** App configurations */
    apps: AppConfigurations;
    /** Plugin settings */
    plugins: PluginConfigurations;
    /** Keybindings */
    keybindings: Keybindings;
    /** UI customizations */
    ui: UICustomizations;
    /** Sync settings */
    sync: SyncSettings;
    /** Automation rules */
    automations: AutomationConfigs;
    /** Notification rules */
    notifications: NotificationConfigs;
    /** Additional workspace settings */
    settings?: Record<string, any>;
    /** Last modification info */
    lastModified: {
        timestamp: Date;
        deviceId: string;
        userId: string;
    };
}
/**
 * Workspace metadata
 */
export interface WorkspaceMetadata {
    /** Workspace ID */
    id: string;
    /** Workspace name */
    name: string;
    /** Workspace description */
    description?: string;
    /** Workspace icon */
    icon?: string;
    /** Workspace type */
    type: 'personal' | 'team' | 'organization';
    /** Organization ID if applicable */
    organizationId?: string;
    /** Team ID if applicable */
    teamId?: string;
    /** Owner user ID */
    ownerId: string;
    /** Workspace members */
    members?: WorkspaceMember[];
    /** Creation timestamp */
    createdAt: Date;
    /** Tags for organization */
    tags: string[];
    /** Workspace settings */
    settings?: Record<string, any>;
}
/**
 * Workspace member
 */
export interface WorkspaceMember {
    /** User ID */
    userId: string;
    /** Member role */
    role: 'owner' | 'admin' | 'member' | 'viewer';
    /** Join date */
    joinedAt: Date;
    /** Invited by user ID */
    invitedBy?: string;
    /** Member permissions */
    permissions: string[];
}
/**
 * User preferences within workspace
 */
export interface UserPreferences {
    /** Theme settings */
    theme: ThemeSettings;
    /** Language and localization */
    language: LanguageSettings;
    /** Privacy settings */
    privacy: PrivacySettings;
    /** Accessibility settings */
    accessibility: AccessibilitySettings;
    /** Notification preferences */
    notifications: NotificationPreferences;
    /** Startup preferences */
    startup: StartupPreferences;
}
/**
 * Theme settings
 */
export interface ThemeSettings {
    /** Color scheme */
    mode: 'light' | 'dark' | 'auto';
    /** Accent color */
    accentColor: string;
    /** Custom theme ID */
    customTheme?: string;
    /** Font family */
    fontFamily: string;
    /** Font size */
    fontSize: 'small' | 'medium' | 'large';
    /** High contrast mode */
    highContrast: boolean;
    /** Color blind friendly mode */
    colorBlindFriendly: boolean;
}
/**
 * Language settings
 */
export interface LanguageSettings {
    /** UI language code */
    locale: string;
    /** Date format */
    dateFormat: string;
    /** Time format */
    timeFormat: '12h' | '24h';
    /** Number format */
    numberFormat: string;
    /** Currency */
    currency: string;
    /** Timezone */
    timezone: string;
    /** First day of week */
    firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
/**
 * Privacy settings
 */
export interface PrivacySettings {
    /** Analytics collection consent */
    analytics: boolean;
    /** Crash reporting consent */
    crashReporting: boolean;
    /** Usage data collection */
    usageData: boolean;
    /** Telemetry data collection */
    telemetry: boolean;
    /** Show online status */
    showOnlineStatus: boolean;
    /** Show last seen */
    showLastSeen: boolean;
    /** Allow read receipts */
    readReceipts: boolean;
}
/**
 * Accessibility settings
 */
export interface AccessibilitySettings {
    /** Reduced motion */
    reducedMotion: boolean;
    /** Screen reader mode */
    screenReader: boolean;
    /** Keyboard navigation only */
    keyboardNavigation: boolean;
    /** Focus indicators */
    focusIndicators: boolean;
    /** Text scaling */
    textScaling: number;
    /** Voice commands */
    voiceCommands: boolean;
}
/**
 * Notification preferences
 */
export interface NotificationPreferences {
    /** Desktop notifications */
    desktop: boolean;
    /** Sound notifications */
    sound: boolean;
    /** Email digest */
    emailDigest: boolean;
    /** Push notifications */
    push: boolean;
    /** Notification sound */
    soundFile: string;
    /** Do not disturb settings */
    doNotDisturb: {
        enabled: boolean;
        startTime: string;
        endTime: string;
        days: number[];
    };
}
/**
 * Startup preferences
 */
export interface StartupPreferences {
    /** Auto-start with system */
    autoStart: boolean;
    /** Restore workspace on startup */
    restoreWorkspace: boolean;
    /** Default apps to open */
    defaultApps: string[];
    /** Startup layout */
    layout: string;
    /** Auto-sync on startup */
    autoSync: boolean;
    /** Check for updates on startup */
    checkUpdates: boolean;
}
/**
 * App configurations
 */
export interface AppConfigurations {
    /** Mail app config */
    mail?: MailAppConfig;
    /** Calendar app config */
    calendar?: CalendarAppConfig;
    /** Chat app config */
    chat?: ChatAppConfig;
    /** Files app config */
    files?: FilesAppConfig;
    /** Browser app config */
    browser?: BrowserAppConfig;
    /** Custom app configs by ID */
    custom: Record<string, Record<string, any>>;
}
/**
 * Mail app configuration
 */
export interface MailAppConfig {
    /** Default compose mode */
    defaultComposeMode: 'plain' | 'html' | 'markdown';
    /** Show preview pane */
    showPreviewPane: boolean;
    /** Preview pane position */
    previewPanePosition: 'right' | 'bottom' | 'off';
    /** Thread grouping */
    threadGrouping: boolean;
    /** Auto-mark as read delay */
    autoMarkReadDelay: number;
    /** Default signature */
    defaultSignature?: string;
    /** Spam filtering level */
    spamFiltering: 'off' | 'low' | 'medium' | 'high';
    /** Image loading */
    autoLoadImages: 'always' | 'contacts' | 'never';
    /** Tracking protection */
    trackingProtection: boolean;
}
/**
 * Calendar app configuration
 */
export interface CalendarAppConfig {
    /** Default view */
    defaultView: 'day' | 'week' | 'month' | 'agenda';
    /** Work hours */
    workHours: {
        startTime: string;
        endTime: string;
        days: number[];
    };
    /** Default event duration */
    defaultEventDuration: number;
    /** Default reminders */
    defaultReminders: number[];
    /** Show declined events */
    showDeclinedEvents: boolean;
    /** Show weekends */
    showWeekends: boolean;
    /** Time zone display */
    showTimeZone: boolean;
}
/**
 * Chat app configuration
 */
export interface ChatAppConfig {
    /** Show online status */
    showOnlineStatus: boolean;
    /** Auto-join channels */
    autoJoinChannels: boolean;
    /** Message formatting */
    messageFormatting: 'plain' | 'markdown' | 'rich';
    /** Emoji reactions */
    emojiReactions: boolean;
    /** Message threading */
    messageThreading: boolean;
    /** Typing indicators */
    typingIndicators: boolean;
    /** Read receipts */
    readReceipts: boolean;
}
/**
 * Files app configuration
 */
export interface FilesAppConfig {
    /** Default view */
    defaultView: 'list' | 'grid' | 'columns';
    /** Show hidden files */
    showHiddenFiles: boolean;
    /** File sorting */
    sorting: {
        field: 'name' | 'size' | 'modified' | 'type';
        direction: 'asc' | 'desc';
    };
    /** Preview pane */
    showPreviewPane: boolean;
    /** Thumbnail size */
    thumbnailSize: 'small' | 'medium' | 'large';
    /** Auto-sync folders */
    autoSyncFolders: string[];
}
/**
 * Browser app configuration
 */
export interface BrowserAppConfig {
    /** Default search engine */
    defaultSearchEngine: string;
    /** Homepage */
    homepage: string;
    /** New tab behavior */
    newTabBehavior: 'homepage' | 'blank' | 'continue';
    /** Privacy mode */
    privacyMode: boolean;
    /** Ad blocking */
    adBlocking: boolean;
    /** Tracking protection */
    trackingProtection: boolean;
    /** Cookie policy */
    cookiePolicy: 'allow' | 'block' | 'ask';
}
/**
 * Plugin configurations
 */
export interface PluginConfigurations {
    /** Plugin settings by plugin ID */
    plugins: Record<string, PluginConfig>;
    /** Global plugin settings */
    global: {
        /** Auto-update plugins */
        autoUpdate: boolean;
        /** Check for updates interval */
        updateCheckInterval: number;
        /** Allow beta plugins */
        allowBeta: boolean;
        /** Plugin data directory */
        dataDirectory: string;
    };
}
/**
 * Individual plugin configuration
 */
export interface PluginConfig {
    /** Plugin ID */
    pluginId: string;
    /** Plugin version */
    version: string;
    /** Whether plugin is enabled */
    enabled: boolean;
    /** Plugin-specific settings */
    settings: Record<string, any>;
    /** Plugin permissions */
    permissions: string[];
    /** Plugin data */
    data: Record<string, any>;
    /** Last update check */
    lastUpdateCheck?: Date;
    /** Auto-update enabled */
    autoUpdate: boolean;
}
/**
 * Keybindings configuration
 */
export interface Keybindings {
    /** Global keybindings */
    global: Record<string, KeyBinding>;
    /** App-specific keybindings */
    apps: Record<string, Record<string, KeyBinding>>;
    /** Plugin-specific keybindings */
    plugins: Record<string, Record<string, KeyBinding>>;
}
/**
 * Individual key binding
 */
export interface KeyBinding {
    /** Key combination */
    key: string;
    /** Command ID */
    command: string;
    /** Command arguments */
    args?: any[];
    /** When binding is active */
    when?: string;
    /** Binding description */
    description?: string;
}
/**
 * UI customizations
 */
export interface UICustomizations {
    /** Layout settings */
    layout: LayoutSettings;
    /** Panel configurations */
    panels: PanelConfigurations;
    /** Toolbar customizations */
    toolbars: ToolbarConfigurations;
    /** Menu customizations */
    menus: MenuConfigurations;
    /** Custom CSS */
    customCSS?: string;
}
/**
 * Layout settings
 */
export interface LayoutSettings {
    /** Sidebar position */
    sidebarPosition: 'left' | 'right';
    /** Sidebar width */
    sidebarWidth: number;
    /** Sidebar collapsed */
    sidebarCollapsed: boolean;
    /** Bottom panel height */
    bottomPanelHeight: number;
    /** Tab bar position */
    tabBarPosition: 'top' | 'bottom';
    /** Window controls position */
    windowControlsPosition: 'left' | 'right';
}
/**
 * Panel configurations
 */
export interface PanelConfigurations {
    /** Panel states by ID */
    panels: Record<string, PanelState>;
    /** Panel order */
    order: string[];
    /** Default panel */
    defaultPanel?: string;
}
/**
 * Panel state
 */
export interface PanelState {
    /** Panel ID */
    id: string;
    /** Panel visibility */
    visible: boolean;
    /** Panel size */
    size: {
        width?: number;
        height?: number;
    };
    /** Panel position */
    position: {
        x?: number;
        y?: number;
    };
    /** Panel settings */
    settings: Record<string, any>;
}
/**
 * Toolbar configurations
 */
export interface ToolbarConfigurations {
    /** Toolbar items by toolbar ID */
    toolbars: Record<string, ToolbarConfig>;
}
/**
 * Toolbar configuration
 */
export interface ToolbarConfig {
    /** Toolbar ID */
    id: string;
    /** Toolbar visibility */
    visible: boolean;
    /** Toolbar items */
    items: ToolbarItem[];
    /** Toolbar position */
    position: 'top' | 'bottom' | 'left' | 'right';
}
/**
 * Toolbar item
 */
export interface ToolbarItem {
    /** Item type */
    type: 'button' | 'separator' | 'dropdown' | 'input';
    /** Item ID */
    id: string;
    /** Item label */
    label?: string;
    /** Item icon */
    icon?: string;
    /** Item command */
    command?: string;
    /** Item visibility */
    visible: boolean;
}
/**
 * Menu configurations
 */
export interface MenuConfigurations {
    /** Menu items by menu ID */
    menus: Record<string, MenuConfig>;
}
/**
 * Menu configuration
 */
export interface MenuConfig {
    /** Menu ID */
    id: string;
    /** Menu items */
    items: MenuItem[];
    /** Menu visibility */
    visible: boolean;
}
/**
 * Menu item
 */
export interface MenuItem {
    /** Item ID */
    id: string;
    /** Item label */
    label: string;
    /** Item icon */
    icon?: string;
    /** Item command */
    command?: string;
    /** Item submenu */
    submenu?: MenuItem[];
    /** Item separator */
    separator?: boolean;
    /** Item visibility */
    visible: boolean;
}
/**
 * Sync settings
 */
export interface SyncSettings {
    /** Whether sync is enabled */
    enabled: boolean;
    /** Sync transport configuration */
    transport: SyncTransportConfig;
    /** Sync interval in minutes */
    intervalMinutes: number;
    /** Auto-sync on changes */
    autoSync: boolean;
    /** Conflict resolution strategy */
    conflictResolution: 'manual' | 'latest' | 'merge';
    /** Sync encryption settings */
    encryption: SyncEncryption;
    /** Exclude patterns */
    excludePatterns: string[];
    /** Backup settings */
    backup: BackupSettings;
}
/**
 * Base sync transport interface
 * All transport implementations must implement these core methods
 */
export interface BaseSyncTransport {
    /** Transport name */
    readonly name: string;
    /** Check if transport is available */
    isAvailable(): boolean;
    /** Download configuration from transport */
    downloadConfiguration(): Promise<any>;
    /** Upload configuration to transport */
    uploadConfiguration(config: any): Promise<void>;
    /** Check if the transport supports real-time updates */
    supportsRealTimeUpdates?(): boolean;
    /** Get the last modification time */
    getLastModified?(): Promise<Date>;
}
/**
 * Sync transport configuration
 * This represents the configuration stored in workspace settings
 */
export type SyncTransportConfig = CloudSyncTransportConfig | LANSyncTransportConfig | ImportExportTransportConfig;
/**
 * Runtime sync transport instances
 * These are the actual transport implementations used by the sync system
 */
export type SyncTransport = BaseSyncTransport;
/**
 * Cloud sync transport configuration (iCloud, OneDrive, Dropbox, Google Drive)
 */
export interface CloudSyncTransportConfig {
    type: 'cloud';
    provider: 'icloud' | 'onedrive' | 'dropbox' | 'googledrive';
    /** Cloud folder path */
    folderPath: string;
    /** Provider credentials (encrypted) */
    credentials: Record<string, any>;
    /** Sync frequency */
    syncFrequency: number;
}
/**
 * LAN sync transport configuration (mDNS + WebRTC)
 */
export interface LANSyncTransportConfig {
    type: 'lan';
    /** Device discovery settings */
    discovery: {
        enabled: boolean;
        deviceName: string;
        port: number;
    };
    /** WebRTC settings */
    webrtc: {
        iceServers: string[];
        enableRelay: boolean;
    };
    /** Allowed devices */
    allowedDevices: string[];
}
/**
 * Import/Export transport configuration (encrypted archives)
 */
export interface ImportExportTransportConfig {
    type: 'import_export';
    /** Archive format */
    format: 'workosync' | 'zip';
    /** Default export location */
    exportLocation: string;
    /** Auto-export settings */
    autoExport: {
        enabled: boolean;
        frequency: number;
        location: string;
    };
}
/**
 * Sync encryption settings
 */
export interface SyncEncryption {
    /** Encryption algorithm */
    algorithm: 'chacha20poly1305' | 'aes256gcm';
    /** Key derivation function */
    kdf: 'argon2id' | 'pbkdf2';
    /** Workspace sync key (encrypted) */
    workspaceSyncKey: string;
    /** Device key pair info */
    deviceKey: {
        publicKey: string;
        privateKey: string;
        algorithm: 'x25519';
    };
    /** Key rotation settings */
    keyRotation: {
        enabled: boolean;
        intervalDays: number;
        lastRotation?: Date;
    };
}
/**
 * Backup settings
 */
export interface BackupSettings {
    /** Whether backups are enabled */
    enabled: boolean;
    /** Backup frequency */
    frequency: 'hourly' | 'daily' | 'weekly';
    /** Number of backups to retain */
    retentionCount: number;
    /** Backup location */
    location: string;
    /** Compress backups */
    compress: boolean;
    /** Encrypt backups */
    encrypt: boolean;
}
/**
 * Automation configurations
 */
export interface AutomationConfigs {
    /** Automation rules by ID */
    rules: Record<string, AutomationRule>;
    /** Global automation settings */
    global: {
        enabled: boolean;
        maxExecutionsPerHour: number;
        logLevel: 'error' | 'warn' | 'info' | 'debug';
    };
}
/**
 * Automation rule
 */
export interface AutomationRule {
    /** Rule ID */
    id: string;
    /** Rule name */
    name: string;
    /** Rule description */
    description?: string;
    /** Whether rule is enabled */
    enabled: boolean;
    /** Rule trigger */
    trigger: AutomationTrigger;
    /** Rule conditions */
    conditions: AutomationCondition[];
    /** Rule actions */
    actions: AutomationAction[];
    /** Rule settings */
    settings: {
        runOnce: boolean;
        maxExecutions?: number;
        timeout: number;
        retries: number;
    };
    /** Rule statistics */
    stats: {
        executions: number;
        successes: number;
        failures: number;
        lastExecution?: Date;
    };
}
/**
 * Automation trigger
 */
export interface AutomationTrigger {
    /** Trigger type */
    type: string;
    /** Trigger configuration */
    config: Record<string, any>;
}
/**
 * Automation condition
 */
export interface AutomationCondition {
    /** Condition type */
    type: string;
    /** Condition configuration */
    config: Record<string, any>;
    /** Negate condition */
    negate: boolean;
}
/**
 * Automation action
 */
export interface AutomationAction {
    /** Action type */
    type: string;
    /** Action configuration */
    config: Record<string, any>;
    /** Continue on error */
    continueOnError: boolean;
}
/**
 * Notification configurations
 */
export interface NotificationConfigs {
    /** Notification rules by ID */
    rules: Record<string, NotificationRule>;
    /** Global notification settings */
    global: {
        enabled: boolean;
        doNotDisturb: {
            enabled: boolean;
            startTime: string;
            endTime: string;
            days: number[];
        };
        digest: {
            enabled: boolean;
            frequency: 'hourly' | 'daily' | 'weekly';
            time: string;
        };
    };
}
/**
 * Notification rule
 */
export interface NotificationRule {
    /** Rule ID */
    id: string;
    /** Rule name */
    name: string;
    /** Rule description */
    description?: string;
    /** Whether rule is enabled */
    enabled: boolean;
    /** Rule filters */
    filters: NotificationFilter[];
    /** Notification settings */
    settings: {
        priority: 'low' | 'normal' | 'high' | 'urgent';
        sound: boolean;
        vibration: boolean;
        badge: boolean;
        banner: boolean;
        lockScreen: boolean;
    };
    /** Rule channels */
    channels: string[];
}
/**
 * Notification filter
 */
export interface NotificationFilter {
    /** Filter type */
    type: string;
    /** Filter configuration */
    config: Record<string, any>;
    /** Negate filter */
    negate: boolean;
}
/**
 * Sync state information
 */
export interface SyncState {
    /** Current sync status */
    status: 'idle' | 'syncing' | 'error' | 'paused';
    /** Last successful sync */
    lastSync?: Date;
    /** Last sync error */
    lastError?: {
        message: string;
        timestamp: Date;
        code: string;
    };
    /** Sync statistics */
    stats: {
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        lastSyncDuration: number;
        avgSyncDuration: number;
    };
    /** Pending changes */
    pendingChanges: number;
    /** Conflict count */
    conflicts: number;
    /** Vector clock for conflict resolution */
    vectorClock: Record<string, number>;
    /** Last activity description */
    lastActivity?: string;
    /** Sync progress (0-1) */
    progress?: number;
    /** Queued changes count */
    queuedChanges?: number;
    /** Last cloud sync timestamp */
    lastCloudSync?: Date;
    /** Whether LAN discovery is active */
    lanDiscovering?: boolean;
}
/**
 * Device information for sync
 */
export interface SyncDevice {
    /** Device ID */
    id: string;
    /** Device name */
    name: string;
    /** Device type */
    type: 'desktop' | 'mobile' | 'web';
    /** Platform information */
    platform: {
        os: string;
        version: string;
        arch: string;
    };
    /** Device public key */
    publicKey: string;
    /** Last seen timestamp */
    lastSeen: Date;
    /** Whether device is trusted */
    trusted: boolean;
    /** Device capabilities */
    capabilities: string[];
}
/**
 * Sync conflict information
 */
export interface SyncConflict {
    /** Conflict ID */
    id: string;
    /** Configuration path that conflicts */
    path: string;
    /** Conflict type */
    type: 'concurrent_edit' | 'delete_edit' | 'type_mismatch' | 'workspace_settings' | 'workspace_apps' | 'plugin_settings' | 'plugin_permissions';
    /** Human-readable description of the conflict */
    description: string;
    /** Local version */
    local: {
        value: any;
        timestamp: Date;
        deviceId: string;
        vectorClock: Record<string, number>;
    };
    /** Remote version */
    remote: {
        value: any;
        timestamp: Date;
        deviceId: string;
        vectorClock: Record<string, number>;
    };
    /** Conflict resolution */
    resolution?: 'use_local' | 'use_remote' | 'merge' | 'manual';
    /** Resolved value */
    resolvedValue?: any;
    /** Resolution timestamp */
    resolvedAt?: Date;
}
export declare const WorkspaceConfigSchema: z.ZodObject<{
    version: z.ZodString;
    workspace: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["personal", "team", "organization"]>;
        organizationId: z.ZodOptional<z.ZodString>;
        teamId: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodString;
        members: z.ZodOptional<z.ZodArray<z.ZodObject<{
            userId: z.ZodString;
            role: z.ZodEnum<["owner", "admin", "member", "viewer"]>;
            joinedAt: z.ZodDate;
            invitedBy: z.ZodOptional<z.ZodString>;
            permissions: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            userId: string;
            role: "owner" | "admin" | "member" | "viewer";
            permissions: string[];
            joinedAt: Date;
            invitedBy?: string | undefined;
        }, {
            userId: string;
            role: "owner" | "admin" | "member" | "viewer";
            permissions: string[];
            joinedAt: Date;
            invitedBy?: string | undefined;
        }>, "many">>;
        createdAt: z.ZodDate;
        tags: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: Date;
        name: string;
        type: "team" | "personal" | "organization";
        tags: string[];
        ownerId: string;
        description?: string | undefined;
        icon?: string | undefined;
        organizationId?: string | undefined;
        teamId?: string | undefined;
        members?: {
            userId: string;
            role: "owner" | "admin" | "member" | "viewer";
            permissions: string[];
            joinedAt: Date;
            invitedBy?: string | undefined;
        }[] | undefined;
    }, {
        id: string;
        createdAt: Date;
        name: string;
        type: "team" | "personal" | "organization";
        tags: string[];
        ownerId: string;
        description?: string | undefined;
        icon?: string | undefined;
        organizationId?: string | undefined;
        teamId?: string | undefined;
        members?: {
            userId: string;
            role: "owner" | "admin" | "member" | "viewer";
            permissions: string[];
            joinedAt: Date;
            invitedBy?: string | undefined;
        }[] | undefined;
    }>;
    preferences: z.ZodObject<{
        theme: z.ZodObject<{
            mode: z.ZodEnum<["light", "dark", "auto"]>;
            accentColor: z.ZodString;
            customTheme: z.ZodOptional<z.ZodString>;
            fontFamily: z.ZodString;
            fontSize: z.ZodEnum<["small", "medium", "large"]>;
            highContrast: z.ZodBoolean;
            colorBlindFriendly: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            mode: "auto" | "light" | "dark";
            accentColor: string;
            fontFamily: string;
            fontSize: "small" | "medium" | "large";
            highContrast: boolean;
            colorBlindFriendly: boolean;
            customTheme?: string | undefined;
        }, {
            mode: "auto" | "light" | "dark";
            accentColor: string;
            fontFamily: string;
            fontSize: "small" | "medium" | "large";
            highContrast: boolean;
            colorBlindFriendly: boolean;
            customTheme?: string | undefined;
        }>;
        language: z.ZodObject<{
            locale: z.ZodString;
            dateFormat: z.ZodString;
            timeFormat: z.ZodEnum<["12h", "24h"]>;
            numberFormat: z.ZodString;
            currency: z.ZodString;
            timezone: z.ZodString;
            firstDayOfWeek: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            timezone: string;
            locale: string;
            currency: string;
            dateFormat: string;
            timeFormat: "12h" | "24h";
            numberFormat: string;
            firstDayOfWeek: number;
        }, {
            timezone: string;
            locale: string;
            currency: string;
            dateFormat: string;
            timeFormat: "12h" | "24h";
            numberFormat: string;
            firstDayOfWeek: number;
        }>;
        privacy: z.ZodObject<{
            analytics: z.ZodBoolean;
            crashReporting: z.ZodBoolean;
            usageData: z.ZodBoolean;
            telemetry: z.ZodBoolean;
            showOnlineStatus: z.ZodBoolean;
            showLastSeen: z.ZodBoolean;
            readReceipts: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            analytics: boolean;
            crashReporting: boolean;
            usageData: boolean;
            telemetry: boolean;
            showOnlineStatus: boolean;
            showLastSeen: boolean;
            readReceipts: boolean;
        }, {
            analytics: boolean;
            crashReporting: boolean;
            usageData: boolean;
            telemetry: boolean;
            showOnlineStatus: boolean;
            showLastSeen: boolean;
            readReceipts: boolean;
        }>;
        accessibility: z.ZodObject<{
            reducedMotion: z.ZodBoolean;
            screenReader: z.ZodBoolean;
            keyboardNavigation: z.ZodBoolean;
            focusIndicators: z.ZodBoolean;
            textScaling: z.ZodNumber;
            voiceCommands: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            reducedMotion: boolean;
            screenReader: boolean;
            keyboardNavigation: boolean;
            focusIndicators: boolean;
            textScaling: number;
            voiceCommands: boolean;
        }, {
            reducedMotion: boolean;
            screenReader: boolean;
            keyboardNavigation: boolean;
            focusIndicators: boolean;
            textScaling: number;
            voiceCommands: boolean;
        }>;
        notifications: z.ZodObject<{
            desktop: z.ZodBoolean;
            sound: z.ZodBoolean;
            emailDigest: z.ZodBoolean;
            push: z.ZodBoolean;
            soundFile: z.ZodString;
            doNotDisturb: z.ZodObject<{
                enabled: z.ZodBoolean;
                startTime: z.ZodString;
                endTime: z.ZodString;
                days: z.ZodArray<z.ZodNumber, "many">;
            }, "strip", z.ZodTypeAny, {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            }, {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            }>;
        }, "strip", z.ZodTypeAny, {
            desktop: boolean;
            push: boolean;
            sound: boolean;
            emailDigest: boolean;
            soundFile: string;
            doNotDisturb: {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            };
        }, {
            desktop: boolean;
            push: boolean;
            sound: boolean;
            emailDigest: boolean;
            soundFile: string;
            doNotDisturb: {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            };
        }>;
        startup: z.ZodObject<{
            autoStart: z.ZodBoolean;
            restoreWorkspace: z.ZodBoolean;
            defaultApps: z.ZodArray<z.ZodString, "many">;
            layout: z.ZodString;
            autoSync: z.ZodBoolean;
            checkUpdates: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            autoSync: boolean;
            autoStart: boolean;
            restoreWorkspace: boolean;
            defaultApps: string[];
            layout: string;
            checkUpdates: boolean;
        }, {
            autoSync: boolean;
            autoStart: boolean;
            restoreWorkspace: boolean;
            defaultApps: string[];
            layout: string;
            checkUpdates: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        notifications: {
            desktop: boolean;
            push: boolean;
            sound: boolean;
            emailDigest: boolean;
            soundFile: string;
            doNotDisturb: {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            };
        };
        theme: {
            mode: "auto" | "light" | "dark";
            accentColor: string;
            fontFamily: string;
            fontSize: "small" | "medium" | "large";
            highContrast: boolean;
            colorBlindFriendly: boolean;
            customTheme?: string | undefined;
        };
        language: {
            timezone: string;
            locale: string;
            currency: string;
            dateFormat: string;
            timeFormat: "12h" | "24h";
            numberFormat: string;
            firstDayOfWeek: number;
        };
        privacy: {
            analytics: boolean;
            crashReporting: boolean;
            usageData: boolean;
            telemetry: boolean;
            showOnlineStatus: boolean;
            showLastSeen: boolean;
            readReceipts: boolean;
        };
        accessibility: {
            reducedMotion: boolean;
            screenReader: boolean;
            keyboardNavigation: boolean;
            focusIndicators: boolean;
            textScaling: number;
            voiceCommands: boolean;
        };
        startup: {
            autoSync: boolean;
            autoStart: boolean;
            restoreWorkspace: boolean;
            defaultApps: string[];
            layout: string;
            checkUpdates: boolean;
        };
    }, {
        notifications: {
            desktop: boolean;
            push: boolean;
            sound: boolean;
            emailDigest: boolean;
            soundFile: string;
            doNotDisturb: {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            };
        };
        theme: {
            mode: "auto" | "light" | "dark";
            accentColor: string;
            fontFamily: string;
            fontSize: "small" | "medium" | "large";
            highContrast: boolean;
            colorBlindFriendly: boolean;
            customTheme?: string | undefined;
        };
        language: {
            timezone: string;
            locale: string;
            currency: string;
            dateFormat: string;
            timeFormat: "12h" | "24h";
            numberFormat: string;
            firstDayOfWeek: number;
        };
        privacy: {
            analytics: boolean;
            crashReporting: boolean;
            usageData: boolean;
            telemetry: boolean;
            showOnlineStatus: boolean;
            showLastSeen: boolean;
            readReceipts: boolean;
        };
        accessibility: {
            reducedMotion: boolean;
            screenReader: boolean;
            keyboardNavigation: boolean;
            focusIndicators: boolean;
            textScaling: number;
            voiceCommands: boolean;
        };
        startup: {
            autoSync: boolean;
            autoStart: boolean;
            restoreWorkspace: boolean;
            defaultApps: string[];
            layout: string;
            checkUpdates: boolean;
        };
    }>;
    apps: z.ZodRecord<z.ZodString, z.ZodAny>;
    plugins: z.ZodObject<{
        plugins: z.ZodRecord<z.ZodString, z.ZodObject<{
            pluginId: z.ZodString;
            version: z.ZodString;
            enabled: z.ZodBoolean;
            settings: z.ZodRecord<z.ZodString, z.ZodAny>;
            permissions: z.ZodArray<z.ZodString, "many">;
            data: z.ZodRecord<z.ZodString, z.ZodAny>;
            lastUpdateCheck: z.ZodOptional<z.ZodDate>;
            autoUpdate: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            data: Record<string, any>;
            version: string;
            settings: Record<string, any>;
            permissions: string[];
            pluginId: string;
            enabled: boolean;
            autoUpdate: boolean;
            lastUpdateCheck?: Date | undefined;
        }, {
            data: Record<string, any>;
            version: string;
            settings: Record<string, any>;
            permissions: string[];
            pluginId: string;
            enabled: boolean;
            autoUpdate: boolean;
            lastUpdateCheck?: Date | undefined;
        }>>;
        global: z.ZodObject<{
            autoUpdate: z.ZodBoolean;
            updateCheckInterval: z.ZodNumber;
            allowBeta: z.ZodBoolean;
            dataDirectory: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            autoUpdate: boolean;
            updateCheckInterval: number;
            allowBeta: boolean;
            dataDirectory: string;
        }, {
            autoUpdate: boolean;
            updateCheckInterval: number;
            allowBeta: boolean;
            dataDirectory: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        plugins: Record<string, {
            data: Record<string, any>;
            version: string;
            settings: Record<string, any>;
            permissions: string[];
            pluginId: string;
            enabled: boolean;
            autoUpdate: boolean;
            lastUpdateCheck?: Date | undefined;
        }>;
        global: {
            autoUpdate: boolean;
            updateCheckInterval: number;
            allowBeta: boolean;
            dataDirectory: string;
        };
    }, {
        plugins: Record<string, {
            data: Record<string, any>;
            version: string;
            settings: Record<string, any>;
            permissions: string[];
            pluginId: string;
            enabled: boolean;
            autoUpdate: boolean;
            lastUpdateCheck?: Date | undefined;
        }>;
        global: {
            autoUpdate: boolean;
            updateCheckInterval: number;
            allowBeta: boolean;
            dataDirectory: string;
        };
    }>;
    keybindings: z.ZodObject<{
        global: z.ZodRecord<z.ZodString, z.ZodObject<{
            key: z.ZodString;
            command: z.ZodString;
            args: z.ZodOptional<z.ZodAny>;
            when: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
        apps: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
            key: z.ZodString;
            command: z.ZodString;
            args: z.ZodOptional<z.ZodAny>;
            when: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>>;
        plugins: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
            key: z.ZodString;
            command: z.ZodString;
            args: z.ZodOptional<z.ZodAny>;
            when: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        plugins: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
        global: Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>;
        apps: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
    }, {
        plugins: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
        global: Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>;
        apps: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
    }>;
    ui: z.ZodRecord<z.ZodString, z.ZodAny>;
    sync: z.ZodObject<{
        enabled: z.ZodBoolean;
        transport: z.ZodAny;
        intervalMinutes: z.ZodNumber;
        autoSync: z.ZodBoolean;
        conflictResolution: z.ZodEnum<["manual", "latest", "merge"]>;
        encryption: z.ZodObject<{
            algorithm: z.ZodEnum<["chacha20poly1305", "aes256gcm"]>;
            kdf: z.ZodEnum<["argon2id", "pbkdf2"]>;
            workspaceSyncKey: z.ZodString;
            deviceKey: z.ZodObject<{
                publicKey: z.ZodString;
                privateKey: z.ZodString;
                algorithm: z.ZodEnum<["x25519"]>;
            }, "strip", z.ZodTypeAny, {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            }, {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            }>;
            keyRotation: z.ZodObject<{
                enabled: z.ZodBoolean;
                intervalDays: z.ZodNumber;
                lastRotation: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            }, {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            algorithm: "chacha20poly1305" | "aes256gcm";
            kdf: "argon2id" | "pbkdf2";
            workspaceSyncKey: string;
            deviceKey: {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            };
            keyRotation: {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            };
        }, {
            algorithm: "chacha20poly1305" | "aes256gcm";
            kdf: "argon2id" | "pbkdf2";
            workspaceSyncKey: string;
            deviceKey: {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            };
            keyRotation: {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            };
        }>;
        excludePatterns: z.ZodArray<z.ZodString, "many">;
        backup: z.ZodObject<{
            enabled: z.ZodBoolean;
            frequency: z.ZodEnum<["hourly", "daily", "weekly"]>;
            retentionCount: z.ZodNumber;
            location: z.ZodString;
            compress: z.ZodBoolean;
            encrypt: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            location: string;
            frequency: "hourly" | "daily" | "weekly";
            enabled: boolean;
            retentionCount: number;
            compress: boolean;
            encrypt: boolean;
        }, {
            location: string;
            frequency: "hourly" | "daily" | "weekly";
            enabled: boolean;
            retentionCount: number;
            compress: boolean;
            encrypt: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        autoSync: boolean;
        encryption: {
            algorithm: "chacha20poly1305" | "aes256gcm";
            kdf: "argon2id" | "pbkdf2";
            workspaceSyncKey: string;
            deviceKey: {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            };
            keyRotation: {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            };
        };
        enabled: boolean;
        intervalMinutes: number;
        conflictResolution: "manual" | "latest" | "merge";
        excludePatterns: string[];
        backup: {
            location: string;
            frequency: "hourly" | "daily" | "weekly";
            enabled: boolean;
            retentionCount: number;
            compress: boolean;
            encrypt: boolean;
        };
        transport?: any;
    }, {
        autoSync: boolean;
        encryption: {
            algorithm: "chacha20poly1305" | "aes256gcm";
            kdf: "argon2id" | "pbkdf2";
            workspaceSyncKey: string;
            deviceKey: {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            };
            keyRotation: {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            };
        };
        enabled: boolean;
        intervalMinutes: number;
        conflictResolution: "manual" | "latest" | "merge";
        excludePatterns: string[];
        backup: {
            location: string;
            frequency: "hourly" | "daily" | "weekly";
            enabled: boolean;
            retentionCount: number;
            compress: boolean;
            encrypt: boolean;
        };
        transport?: any;
    }>;
    automations: z.ZodRecord<z.ZodString, z.ZodAny>;
    notifications: z.ZodRecord<z.ZodString, z.ZodAny>;
    lastModified: z.ZodObject<{
        timestamp: z.ZodDate;
        deviceId: z.ZodString;
        userId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        userId: string;
        deviceId: string;
        timestamp: Date;
    }, {
        userId: string;
        deviceId: string;
        timestamp: Date;
    }>;
}, "strip", z.ZodTypeAny, {
    version: string;
    workspace: {
        id: string;
        createdAt: Date;
        name: string;
        type: "team" | "personal" | "organization";
        tags: string[];
        ownerId: string;
        description?: string | undefined;
        icon?: string | undefined;
        organizationId?: string | undefined;
        teamId?: string | undefined;
        members?: {
            userId: string;
            role: "owner" | "admin" | "member" | "viewer";
            permissions: string[];
            joinedAt: Date;
            invitedBy?: string | undefined;
        }[] | undefined;
    };
    notifications: Record<string, any>;
    plugins: {
        plugins: Record<string, {
            data: Record<string, any>;
            version: string;
            settings: Record<string, any>;
            permissions: string[];
            pluginId: string;
            enabled: boolean;
            autoUpdate: boolean;
            lastUpdateCheck?: Date | undefined;
        }>;
        global: {
            autoUpdate: boolean;
            updateCheckInterval: number;
            allowBeta: boolean;
            dataDirectory: string;
        };
    };
    preferences: {
        notifications: {
            desktop: boolean;
            push: boolean;
            sound: boolean;
            emailDigest: boolean;
            soundFile: string;
            doNotDisturb: {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            };
        };
        theme: {
            mode: "auto" | "light" | "dark";
            accentColor: string;
            fontFamily: string;
            fontSize: "small" | "medium" | "large";
            highContrast: boolean;
            colorBlindFriendly: boolean;
            customTheme?: string | undefined;
        };
        language: {
            timezone: string;
            locale: string;
            currency: string;
            dateFormat: string;
            timeFormat: "12h" | "24h";
            numberFormat: string;
            firstDayOfWeek: number;
        };
        privacy: {
            analytics: boolean;
            crashReporting: boolean;
            usageData: boolean;
            telemetry: boolean;
            showOnlineStatus: boolean;
            showLastSeen: boolean;
            readReceipts: boolean;
        };
        accessibility: {
            reducedMotion: boolean;
            screenReader: boolean;
            keyboardNavigation: boolean;
            focusIndicators: boolean;
            textScaling: number;
            voiceCommands: boolean;
        };
        startup: {
            autoSync: boolean;
            autoStart: boolean;
            restoreWorkspace: boolean;
            defaultApps: string[];
            layout: string;
            checkUpdates: boolean;
        };
    };
    automations: Record<string, any>;
    sync: {
        autoSync: boolean;
        encryption: {
            algorithm: "chacha20poly1305" | "aes256gcm";
            kdf: "argon2id" | "pbkdf2";
            workspaceSyncKey: string;
            deviceKey: {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            };
            keyRotation: {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            };
        };
        enabled: boolean;
        intervalMinutes: number;
        conflictResolution: "manual" | "latest" | "merge";
        excludePatterns: string[];
        backup: {
            location: string;
            frequency: "hourly" | "daily" | "weekly";
            enabled: boolean;
            retentionCount: number;
            compress: boolean;
            encrypt: boolean;
        };
        transport?: any;
    };
    apps: Record<string, any>;
    keybindings: {
        plugins: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
        global: Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>;
        apps: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
    };
    ui: Record<string, any>;
    lastModified: {
        userId: string;
        deviceId: string;
        timestamp: Date;
    };
}, {
    version: string;
    workspace: {
        id: string;
        createdAt: Date;
        name: string;
        type: "team" | "personal" | "organization";
        tags: string[];
        ownerId: string;
        description?: string | undefined;
        icon?: string | undefined;
        organizationId?: string | undefined;
        teamId?: string | undefined;
        members?: {
            userId: string;
            role: "owner" | "admin" | "member" | "viewer";
            permissions: string[];
            joinedAt: Date;
            invitedBy?: string | undefined;
        }[] | undefined;
    };
    notifications: Record<string, any>;
    plugins: {
        plugins: Record<string, {
            data: Record<string, any>;
            version: string;
            settings: Record<string, any>;
            permissions: string[];
            pluginId: string;
            enabled: boolean;
            autoUpdate: boolean;
            lastUpdateCheck?: Date | undefined;
        }>;
        global: {
            autoUpdate: boolean;
            updateCheckInterval: number;
            allowBeta: boolean;
            dataDirectory: string;
        };
    };
    preferences: {
        notifications: {
            desktop: boolean;
            push: boolean;
            sound: boolean;
            emailDigest: boolean;
            soundFile: string;
            doNotDisturb: {
                startTime: string;
                endTime: string;
                enabled: boolean;
                days: number[];
            };
        };
        theme: {
            mode: "auto" | "light" | "dark";
            accentColor: string;
            fontFamily: string;
            fontSize: "small" | "medium" | "large";
            highContrast: boolean;
            colorBlindFriendly: boolean;
            customTheme?: string | undefined;
        };
        language: {
            timezone: string;
            locale: string;
            currency: string;
            dateFormat: string;
            timeFormat: "12h" | "24h";
            numberFormat: string;
            firstDayOfWeek: number;
        };
        privacy: {
            analytics: boolean;
            crashReporting: boolean;
            usageData: boolean;
            telemetry: boolean;
            showOnlineStatus: boolean;
            showLastSeen: boolean;
            readReceipts: boolean;
        };
        accessibility: {
            reducedMotion: boolean;
            screenReader: boolean;
            keyboardNavigation: boolean;
            focusIndicators: boolean;
            textScaling: number;
            voiceCommands: boolean;
        };
        startup: {
            autoSync: boolean;
            autoStart: boolean;
            restoreWorkspace: boolean;
            defaultApps: string[];
            layout: string;
            checkUpdates: boolean;
        };
    };
    automations: Record<string, any>;
    sync: {
        autoSync: boolean;
        encryption: {
            algorithm: "chacha20poly1305" | "aes256gcm";
            kdf: "argon2id" | "pbkdf2";
            workspaceSyncKey: string;
            deviceKey: {
                algorithm: "x25519";
                publicKey: string;
                privateKey: string;
            };
            keyRotation: {
                enabled: boolean;
                intervalDays: number;
                lastRotation?: Date | undefined;
            };
        };
        enabled: boolean;
        intervalMinutes: number;
        conflictResolution: "manual" | "latest" | "merge";
        excludePatterns: string[];
        backup: {
            location: string;
            frequency: "hourly" | "daily" | "weekly";
            enabled: boolean;
            retentionCount: number;
            compress: boolean;
            encrypt: boolean;
        };
        transport?: any;
    };
    apps: Record<string, any>;
    keybindings: {
        plugins: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
        global: Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>;
        apps: Record<string, Record<string, {
            key: string;
            command: string;
            description?: string | undefined;
            args?: any;
            when?: string | undefined;
        }>>;
    };
    ui: Record<string, any>;
    lastModified: {
        userId: string;
        deviceId: string;
        timestamp: Date;
    };
}>;
export declare const SyncStateSchema: z.ZodObject<{
    status: z.ZodEnum<["idle", "syncing", "error", "paused"]>;
    lastSync: z.ZodOptional<z.ZodDate>;
    lastError: z.ZodOptional<z.ZodObject<{
        message: z.ZodString;
        timestamp: z.ZodDate;
        code: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        timestamp: Date;
        message: string;
    }, {
        code: string;
        timestamp: Date;
        message: string;
    }>>;
    stats: z.ZodObject<{
        totalSyncs: z.ZodNumber;
        successfulSyncs: z.ZodNumber;
        failedSyncs: z.ZodNumber;
        lastSyncDuration: z.ZodNumber;
        avgSyncDuration: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        lastSyncDuration: number;
        avgSyncDuration: number;
    }, {
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        lastSyncDuration: number;
        avgSyncDuration: number;
    }>;
    pendingChanges: z.ZodNumber;
    conflicts: z.ZodNumber;
    vectorClock: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "error" | "idle" | "syncing" | "paused";
    stats: {
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        lastSyncDuration: number;
        avgSyncDuration: number;
    };
    conflicts: number;
    pendingChanges: number;
    vectorClock: Record<string, number>;
    lastError?: {
        code: string;
        timestamp: Date;
        message: string;
    } | undefined;
    lastSync?: Date | undefined;
}, {
    status: "error" | "idle" | "syncing" | "paused";
    stats: {
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        lastSyncDuration: number;
        avgSyncDuration: number;
    };
    conflicts: number;
    pendingChanges: number;
    vectorClock: Record<string, number>;
    lastError?: {
        code: string;
        timestamp: Date;
        message: string;
    } | undefined;
    lastSync?: Date | undefined;
}>;
/**
 * Utility types for config operations
 */
export type CreateWorkspaceConfigInput = Omit<WorkspaceConfig, 'lastModified'>;
export type UpdateWorkspaceConfigInput = Partial<Omit<WorkspaceConfig, 'version' | 'workspace' | 'lastModified'>>;
/**
 * Config change event
 */
export interface ConfigChangeEvent {
    /** Event type */
    type: 'config_changed' | 'sync_status_changed' | 'conflict_detected';
    /** Configuration path that changed */
    path: string;
    /** Old value */
    oldValue?: any;
    /** New value */
    newValue?: any;
    /** Change timestamp */
    timestamp: Date;
    /** Device that made the change */
    deviceId: string;
    /** User that made the change */
    userId: string;
}
/**
 * Config validation result
 */
export interface ConfigValidationResult {
    /** Whether config is valid */
    valid: boolean;
    /** Validation errors */
    errors: Array<{
        path: string;
        message: string;
        code: string;
    }>;
    /** Validation warnings */
    warnings: Array<{
        path: string;
        message: string;
        code: string;
    }>;
}
/**
 * Config migration information
 */
export interface ConfigMigration {
    /** Migration ID */
    id: string;
    /** From version */
    fromVersion: string;
    /** To version */
    toVersion: string;
    /** Migration function */
    migrate: (config: any) => Promise<any>;
    /** Migration description */
    description: string;
    /** Whether migration is reversible */
    reversible: boolean;
}
/**
 * Sync result information
 */
export interface SyncResult {
    /** Whether sync was successful */
    success: boolean;
    /** Sync timestamp */
    timestamp: Date;
    /** Sync duration in milliseconds */
    duration: number;
    /** Number of changes synced */
    changesCount: number;
    /** Number of conflicts detected */
    conflictCount: number;
    /** Detected sync conflicts */
    conflicts?: SyncConflict[];
    /** Error message if sync failed */
    error?: string;
    /** Sync statistics */
    stats: {
        uploaded: number;
        downloaded: number;
        merged: number;
        deleted: number;
    };
}
//# sourceMappingURL=config.d.ts.map