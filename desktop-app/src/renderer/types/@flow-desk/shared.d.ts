// Type declaration for @flow-desk/shared module
// This provides type safety for the shared library

// Export all types from the shared library
export * from '../global';

// Re-export specific types that might be used
export type {
  // Config types
  WorkspaceConfig,
  WorkspaceMetadata,
  UserPreferences,
  AppConfigurations,
  PluginConfigurations,
  Keybindings,
  UICustomizations,
  SyncSettings,
  NotificationConfigs,
  ThemeSettings,
  LanguageSettings,
  PrivacySettings,
  AccessibilitySettings,
  NotificationPreferences,
  StartupPreferences,
  ConfigBackup,
  AppSettings
} from '@flow-desk/shared';

// Search types
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
} from '@flow-desk/shared';

// Notification types
export type {
  NotificationChannel,
  NotificationTemplate,
  NotificationRule as NotificationRuleType,
  NotificationPreferences as NotificationPrefs,
  NotificationDeliveryLog
} from '@flow-desk/shared';

// Error types from shared library
export type {
  ErrorSeverity,
  ErrorCategory,
  ErrorDomain,
  ErrorCode,
  ErrorContext,
  RetryConfig,
  AppError as SharedAppError,
  ErrorBuilder,
  ErrorHandlerConfig,
  ErrorStats,
  IErrorHandler,
  ErrorFactory
} from '@flow-desk/shared';

// User and auth types
export type {
  DeviceInfo,
  User
} from '@flow-desk/shared';