// Core UI Components (loaded immediately as they're used frequently)
export * from './ui'

// Layout Components (loaded immediately)
export * from './layout'

// Feature Components - Only export what's actually used
export { PluginPanels } from './plugins/PluginPanels'
export { NotificationsHub } from './notifications/NotificationsHub'
// SearchInterface and SettingsPanels removed - not used in main app