/**
 * Flow Desk Shared Types
 *
 * Comprehensive type definitions for the Flow Desk application ecosystem.
 * This package provides type-safe interfaces for all core domain areas.
 */
export * from './user';
export * from './mail';
export * from './calendar';
export * from './plugin';
export * from './billing';
export * from './errors';
export * from './api';
export type { DeviceInfo } from './security';
export type { WorkspaceConfig, WorkspaceMetadata, WorkspacePartitionConfig, UserPreferences as ConfigUserPreferences, SyncState, SyncConflict, SyncDevice, ThemeSettings, LanguageSettings, PrivacySettings, AccessibilitySettings, NotificationPreferences as ConfigNotificationPreferences, StartupPreferences, AppConfigurations, PluginConfigurations, PluginConfig, Keybindings, UICustomizations, SyncSettings, SyncTransport, BaseSyncTransport, SyncTransportConfig, SyncResult, NotificationConfigs, NotificationRule as ConfigNotificationRule } from './config';
export type { SearchProviderType, SearchContentType, SearchProvider as SearchProviderConfig, SearchQuery, SearchResult as SearchResultType, SearchOptions as SearchQueryOptions, SearchResponse, SearchAnalytics, SearchConfiguration, ContentType, ProviderType, SearchDocument } from './search';
export type { NotificationChannel, NotificationTemplate, NotificationRule as NotificationRuleType, NotificationPreferences as NotificationPrefs, NotificationDeliveryLog } from './notifications';
//# sourceMappingURL=index.d.ts.map