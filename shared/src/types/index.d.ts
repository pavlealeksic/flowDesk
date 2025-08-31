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
export * from './security';
export * from './errors';
export * from './api';
export type { WorkspaceConfig, WorkspaceMetadata, UserPreferences as ConfigUserPreferences, SyncState, SyncConflict, SyncDevice, ThemeSettings, LanguageSettings, PrivacySettings, AccessibilitySettings, NotificationPreferences as ConfigNotificationPreferences, StartupPreferences, AppConfigurations, PluginConfigurations, PluginConfig, Keybindings, UICustomizations, SyncSettings, SyncTransport, BaseSyncTransport, SyncTransportConfig, SyncResult, AutomationConfigs, AutomationRule, AutomationTrigger as ConfigAutomationTrigger, AutomationCondition as ConfigAutomationCondition, AutomationAction as ConfigAutomationAction, NotificationConfigs, NotificationRule as ConfigNotificationRule } from './config';
export type { SearchProviderType, SearchContentType, SearchProvider as SearchProviderConfig, SearchQuery, SearchResult as SearchResultType, SearchOptions as SearchQueryOptions, SearchResponse, SearchAnalytics } from './search';
export type { NotificationChannel, NotificationTemplate, NotificationRule as NotificationRuleType, NotificationPreferences as NotificationPrefs, NotificationDeliveryLog } from './notifications';
export type { AutomationTrigger as AutomationTriggerType, AutomationCondition as AutomationConditionType, AutomationAction as AutomationActionType, AutomationExecution } from './automations';
//# sourceMappingURL=index.d.ts.map