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
  /** Automation functionality removed to simplify the app */
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
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
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
  textScaling: number; // 0.8 - 2.0
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
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    days: number[];    // 0-6, Sunday=0
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
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    days: number[];    // 0-6, Sunday=0
  };
  /** Default event duration */
  defaultEventDuration: number; // minutes
  /** Default reminders */
  defaultReminders: number[]; // minutes before event
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
export type SyncTransportConfig = 
  | CloudSyncTransportConfig
  | LANSyncTransportConfig
  | ImportExportTransportConfig;

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
    privateKey: string; // encrypted
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

// Automation interfaces removed to simplify the app

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

// Zod schemas for runtime validation
export const WorkspaceConfigSchema = z.object({
  version: z.string(),
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    type: z.enum(['personal', 'team', 'organization']),
    organizationId: z.string().optional(),
    teamId: z.string().optional(),
    ownerId: z.string(),
    members: z.array(z.object({
      userId: z.string(),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
      joinedAt: z.date(),
      invitedBy: z.string().optional(),
      permissions: z.array(z.string())
    })).optional(),
    createdAt: z.date(),
    tags: z.array(z.string())
  }),
  preferences: z.object({
    theme: z.object({
      mode: z.enum(['light', 'dark', 'auto']),
      accentColor: z.string(),
      customTheme: z.string().optional(),
      fontFamily: z.string(),
      fontSize: z.enum(['small', 'medium', 'large']),
      highContrast: z.boolean(),
      colorBlindFriendly: z.boolean()
    }),
    language: z.object({
      locale: z.string(),
      dateFormat: z.string(),
      timeFormat: z.enum(['12h', '24h']),
      numberFormat: z.string(),
      currency: z.string(),
      timezone: z.string(),
      firstDayOfWeek: z.number().min(0).max(6)
    }),
    privacy: z.object({
      analytics: z.boolean(),
      crashReporting: z.boolean(),
      usageData: z.boolean(),
      telemetry: z.boolean(),
      showOnlineStatus: z.boolean(),
      showLastSeen: z.boolean(),
      readReceipts: z.boolean()
    }),
    accessibility: z.object({
      reducedMotion: z.boolean(),
      screenReader: z.boolean(),
      keyboardNavigation: z.boolean(),
      focusIndicators: z.boolean(),
      textScaling: z.number().min(0.8).max(2.0),
      voiceCommands: z.boolean()
    }),
    notifications: z.object({
      desktop: z.boolean(),
      sound: z.boolean(),
      emailDigest: z.boolean(),
      push: z.boolean(),
      soundFile: z.string(),
      doNotDisturb: z.object({
        enabled: z.boolean(),
        startTime: z.string(),
        endTime: z.string(),
        days: z.array(z.number().min(0).max(6))
      })
    }),
    startup: z.object({
      autoStart: z.boolean(),
      restoreWorkspace: z.boolean(),
      defaultApps: z.array(z.string()),
      layout: z.string(),
      autoSync: z.boolean(),
      checkUpdates: z.boolean()
    })
  }),
  apps: z.record(z.any()),
  plugins: z.object({
    plugins: z.record(z.object({
      pluginId: z.string(),
      version: z.string(),
      enabled: z.boolean(),
      settings: z.record(z.any()),
      permissions: z.array(z.string()),
      data: z.record(z.any()),
      lastUpdateCheck: z.date().optional(),
      autoUpdate: z.boolean()
    })),
    global: z.object({
      autoUpdate: z.boolean(),
      updateCheckInterval: z.number(),
      allowBeta: z.boolean(),
      dataDirectory: z.string()
    })
  }),
  keybindings: z.object({
    global: z.record(z.object({
      key: z.string(),
      command: z.string(),
      args: z.any().optional(),
      when: z.string().optional(),
      description: z.string().optional()
    })),
    apps: z.record(z.record(z.object({
      key: z.string(),
      command: z.string(),
      args: z.any().optional(),
      when: z.string().optional(),
      description: z.string().optional()
    }))),
    plugins: z.record(z.record(z.object({
      key: z.string(),
      command: z.string(),
      args: z.any().optional(),
      when: z.string().optional(),
      description: z.string().optional()
    })))
  }),
  ui: z.record(z.any()),
  sync: z.object({
    enabled: z.boolean(),
    transport: z.any(),
    intervalMinutes: z.number(),
    autoSync: z.boolean(),
    conflictResolution: z.enum(['manual', 'latest', 'merge']),
    encryption: z.object({
      algorithm: z.enum(['chacha20poly1305', 'aes256gcm']),
      kdf: z.enum(['argon2id', 'pbkdf2']),
      workspaceSyncKey: z.string(),
      deviceKey: z.object({
        publicKey: z.string(),
        privateKey: z.string(),
        algorithm: z.enum(['x25519'])
      }),
      keyRotation: z.object({
        enabled: z.boolean(),
        intervalDays: z.number(),
        lastRotation: z.date().optional()
      })
    }),
    excludePatterns: z.array(z.string()),
    backup: z.object({
      enabled: z.boolean(),
      frequency: z.enum(['hourly', 'daily', 'weekly']),
      retentionCount: z.number(),
      location: z.string(),
      compress: z.boolean(),
      encrypt: z.boolean()
    })
  }),
  // automations: removed to simplify the app,
  notifications: z.record(z.any()),
  lastModified: z.object({
    timestamp: z.date(),
    deviceId: z.string(),
    userId: z.string()
  })
});

export const SyncStateSchema = z.object({
  status: z.enum(['idle', 'syncing', 'error', 'paused']),
  lastSync: z.date().optional(),
  lastError: z.object({
    message: z.string(),
    timestamp: z.date(),
    code: z.string()
  }).optional(),
  stats: z.object({
    totalSyncs: z.number(),
    successfulSyncs: z.number(),
    failedSyncs: z.number(),
    lastSyncDuration: z.number(),
    avgSyncDuration: z.number()
  }),
  pendingChanges: z.number(),
  conflicts: z.number(),
  vectorClock: z.record(z.number())
});

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