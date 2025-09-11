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
export type PluginType = 
  | 'connector'       // Data connector only (no UI)
  | 'panel'           // Sidebar panel/view
  | 'view'            // Full page view
  | 'automation'      // Automation/workflow plugin
  | 'widget'          // Small UI widget
  | 'theme'           // UI theme/customization
  | 'integration';    // System integration

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
export type PluginCategory = 
  | 'communication'   // Slack, Teams, Discord, etc.
  | 'productivity'    // Notion, Asana, Trello, etc.
  | 'meetings'        // Zoom, Meet, Webex, etc.
  | 'development'     // GitHub, GitLab, Jira, etc.
  | 'storage'         // Google Drive, Dropbox, etc.
  | 'crm'             // Salesforce, HubSpot, etc.
  | 'support'         // Zendesk, Intercom, etc.
  | 'marketing'       // Mailchimp, Buffer, etc.
  | 'finance'         // Stripe, QuickBooks, etc.
  | 'ai'              // ChatGPT, Claude, etc.
  | 'utilities'       // General utility plugins
  | 'themes'          // UI themes and customizations
  | 'other';          // Miscellaneous

/**
 * Supported platforms
 */
export type Platform = 'desktop' | 'mobile' | 'web';

/**
 * Plugin permissions
 */
export type PluginPermission = 
  // Data access
  | 'read:emails'
  | 'write:emails'
  | 'read:calendar'
  | 'write:calendar'
  | 'read:contacts'
  | 'write:contacts'
  | 'read:files'
  | 'write:files'
  // System access
  | 'network'
  | 'filesystem'
  | 'storage'
  | 'notifications'
  | 'clipboard'
  | 'keychain'
  // UI access
  | 'ui:panels'
  | 'ui:menus'
  | 'ui:commands'
  | 'ui:dialogs'
  | 'ui:notifications'
  // App integration
  | 'automation'
  | 'search:index'
  | 'search:query'
  | 'events:listen'
  | 'events:emit'
  // System integration
  | 'system:shell'
  | 'system:process'
  | 'system:registry';

/**
 * Plugin scopes (OAuth-style)
 */
export type PluginScope = 
  | 'user:read'
  | 'user:write'
  | 'workspace:read'
  | 'workspace:write'
  | 'mail:read'
  | 'mail:write'
  | 'mail:send'
  | 'calendar:read'
  | 'calendar:write'
  | 'contacts:read'
  | 'contacts:write'
  | 'files:read'
  | 'files:write'
  | 'search:read'
  | 'search:write'
  | 'notifications:read'
  | 'notifications:write'
  | 'automation:read'
  | 'automation:write';

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
export type PluginInstallationStatus = 
  | 'installing'      // Currently being installed
  | 'active'          // Installed and active
  | 'disabled'        // Installed but disabled
  | 'updating'        // Being updated
  | 'error'           // Installation/runtime error
  | 'uninstalling';   // Being uninstalled

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
  
  // Storage API
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
  
  // Events API
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
  
  // UI API
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
  
  // Data API (simplified - mail/calendar removed)
  data: {
    // Files API
    files: {
      /** Read file */
      readFile(path: string): Promise<Buffer>;
      /** Write file */
      writeFile(path: string, content: Buffer | string): Promise<void>;
      /** List directory */
      listDirectory(path: string): Promise<string[]>;
    };
  };
  
  // Network API
  network: {
    /** Make HTTP request */
    fetch(url: string, options?: RequestInit): Promise<Response>;
    /** WebSocket connection */
    websocket(url: string): Promise<WebSocket>;
  };
  
    
  // OAuth API
  oauth: {
    /** Start OAuth flow */
    startFlow(provider: string, scopes: string[]): Promise<string>;
    /** Exchange code for token */
    exchangeCode(code: string): Promise<OAuthTokens>;
    /** Refresh token */
    refreshToken(refreshToken: string): Promise<OAuthTokens>;
  };
  
  // Webhook API
  webhooks: {
    /** Register webhook */
    register(url: string, events: string[]): Promise<string>;
    /** Unregister webhook */
    unregister(webhookId: string): Promise<void>;
  };
  
  // Logger API
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
  /** Silent notification */
  silent?: boolean;
  /** Urgency level */
  urgency?: 'low' | 'normal' | 'critical';
  /** Timeout type */
  timeoutType?: 'default' | 'never';
  /** Click handler */
  onClick?: () => void;
  /** Notification actions */
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
    handler?: () => void;
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
  /** Dialog type */
  type?: 'info' | 'warning' | 'error' | 'question' | 'open' | 'save';
  /** Dialog message */
  message?: string;
  /** Dialog detail */
  detail?: string;
  /** Dialog buttons */
  buttons?: string[];
  /** Default button index */
  defaultId?: number;
  /** Cancel button index */
  cancelId?: number;
  /** Default path for file dialogs */
  defaultPath?: string;
  /** File filters for file dialogs */
  filters?: Array<{ name: string; extensions: string[] }>;
  /** Properties for open dialogs */
  properties?: string[];
  /** Dialog content (HTML or React component) */
  content?: string | any;
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
  /** Token expires in seconds */
  expiresIn?: number;
  /** Token type */
  tokenType: string;
  /** Token scope */
  scope?: string;
}

/**
 * Plugin marketplace types
 */
export interface PluginMarketplaceListing {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: PluginCategory;
  tags: string[];
  downloadCount: number;
  rating: number;
  ratingCount: number;
  featured: boolean;
  verified: boolean;
  lastUpdated: Date;
  screenshots?: string[];
  iconUrl?: string;
  manifest?: PluginManifest;
}

export interface PluginRating {
  id: string;
  pluginId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  helpful: number;
}

export interface PluginLicense {
  type: string;
  name: string;
  url?: string;
  text?: string;
}

export interface PluginDownloadInfo {
  pluginId: string;
  version: string;
  downloadUrl: string;
  checksum: string;
  size: number;
  format: 'tar.gz' | 'zip';
  headers?: Record<string, string>;
}

// Zod schemas for runtime validation
export const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  authorEmail: z.string().email().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  documentation: z.string().url().optional(),
  license: z.string(),
  type: z.enum(['connector', 'panel', 'view', 'automation', 'widget', 'theme', 'integration']),
  category: z.enum(['communication', 'productivity', 'meetings', 'development', 'storage', 'crm', 'support', 'marketing', 'finance', 'ai', 'utilities', 'themes', 'other']),
  tags: z.array(z.string()),
  icon: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional(),
  minFlowDeskVersion: z.string(),
  maxFlowDeskVersion: z.string().optional(),
  platforms: z.array(z.enum(['desktop', 'mobile', 'web'])),
  permissions: z.array(z.string()),
  scopes: z.array(z.string()),
  entrypoints: z.array(z.object({
    type: z.enum(['main', 'background', 'content', 'popup', 'panel', 'automation']),
    file: z.string(),
    platforms: z.record(z.string()).optional()
  })),
  configSchema: z.object({
    schema: z.record(z.any()),
    uiSchema: z.record(z.any()).optional(),
    defaults: z.record(z.any()).optional()
  }).optional(),
  dependencies: z.array(z.object({
    pluginId: z.string(),
    version: z.string(),
    optional: z.boolean()
  })).optional(),
  capabilities: z.object({
    search: z.boolean().optional(),
    notifications: z.boolean().optional(),
    automations: z.boolean().optional(),
    oauth: z.boolean().optional(),
    webhooks: z.boolean().optional(),
    filePreviews: z.boolean().optional(),
    quickActions: z.boolean().optional(),
    contextualData: z.boolean().optional(),
    realTime: z.boolean().optional(),
    offline: z.boolean().optional()
  }),
  marketplace: z.object({
    published: z.boolean(),
    pricing: z.object({
      model: z.enum(['free', 'paid', 'subscription', 'freemium']),
      price: z.number().optional(),
      currency: z.string().optional(),
      billingPeriod: z.enum(['monthly', 'yearly']).optional(),
      trialDays: z.number().optional(),
      freeTierLimits: z.record(z.any()).optional()
    }),
    regions: z.array(z.string()).optional(),
    ageRating: z.enum(['everyone', 'teen', 'mature']).optional(),
    contentRating: z.array(z.string()).optional(),
    privacyPolicy: z.string().url().optional(),
    termsOfService: z.string().url().optional(),
    support: z.object({
      email: z.string().email().optional(),
      url: z.string().url().optional(),
      phone: z.string().optional()
    }).optional()
  }).optional(),
  build: z.object({
    buildTime: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
    commit: z.string().optional(),
    bundleSize: z.number().optional(),
    buildTools: z.array(z.string()).optional(),
    csp: z.string().optional()
  })
});

export const PluginInstallationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string().optional(),
  pluginId: z.string(),
  version: z.string(),
  status: z.enum(['installing', 'active', 'disabled', 'updating', 'error', 'uninstalling']),
  config: z.record(z.any()),
  settings: z.object({
    enabled: z.boolean(),
    autoUpdate: z.boolean(),
    visible: z.boolean(),
    order: z.number(),
    notifications: z.object({
      enabled: z.boolean(),
      types: z.array(z.string())
    })
  }),
  grantedPermissions: z.array(z.string()),
  grantedScopes: z.array(z.string()),
  installedAt: z.date(),
  updatedAt: z.date(),
  lastUsedAt: z.date().optional(),
  usageStats: z.object({
    totalInvocations: z.number(),
    recentInvocations: z.number(),
    avgResponseTime: z.number(),
    errorRate: z.number().min(0).max(1),
    topFeatures: z.array(z.object({
      feature: z.string(),
      count: z.number()
    }))
  }).optional()
});

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