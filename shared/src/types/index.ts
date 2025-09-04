/**
 * Flow Desk Shared Types
 * 
 * Comprehensive type definitions for the Flow Desk application ecosystem.
 * This package provides type-safe interfaces for all core domain areas.
 */

// Export all type modules with explicit re-exports to avoid conflicts
export * from './user';
export * from './mail';
export * from './calendar';
export * from './plugin';
export * from './billing';
export * from './errors';
export * from './api';

// Export specific types from security to avoid conflicts
export type { DeviceInfo } from './security';

// Export specific types from config to avoid conflicts
export type {
  WorkspaceConfig,
  WorkspaceMetadata,
  UserPreferences as ConfigUserPreferences,
  SyncState,
  SyncConflict,
  SyncDevice,
  ThemeSettings,
  LanguageSettings,
  PrivacySettings,
  AccessibilitySettings,
  NotificationPreferences as ConfigNotificationPreferences,
  StartupPreferences,
  AppConfigurations,
  PluginConfigurations,
  PluginConfig,
  Keybindings,
  UICustomizations,
  SyncSettings,
  SyncTransport,
  BaseSyncTransport,
  SyncTransportConfig,
  SyncResult,
  // Automation types removed to simplify the app
  NotificationConfigs,
  NotificationRule as ConfigNotificationRule
} from './config';

// Export specific types from search to avoid conflicts  
export type {
  SearchProviderType,
  SearchContentType,
  SearchProvider as SearchProviderConfig,
  SearchQuery,
  SearchResult as SearchResultType,
  SearchOptions as SearchQueryOptions,
  SearchResponse,
  SearchAnalytics,
  SearchConfiguration,
  ContentType,
  ProviderType,
  SearchDocument
} from './search';

// Export specific types from notifications
export type {
  NotificationChannel,
  NotificationTemplate,
  NotificationRule as NotificationRuleType,
  NotificationPreferences as NotificationPrefs,
  NotificationDeliveryLog
} from './notifications';

// Automation types removed to simplify the app

// Legacy types have been removed to prevent duplicate exports
// Import types directly from their respective modules:
// - User types from './user'
// - Mail types from './mail'  
// - Calendar types from './calendar'
// - Plugin types from './plugin'
// - Config types from './config'
// - API types from './api'