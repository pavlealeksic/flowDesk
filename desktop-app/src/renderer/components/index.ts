// Core UI Components (loaded immediately as they're used frequently)
export * from './ui'

// Layout Components (loaded immediately)
export * from './layout'

// Feature Components - Lazy loaded to reduce initial bundle
export { MailLayout } from './mail/MailLayout'
export { CalendarViews } from './calendar/CalendarViews'
export { PluginPanels } from './plugins/PluginPanels'
export { NotificationsHub } from './notifications/NotificationsHub'
export { SearchInterface } from './search/SearchInterface'
export { SettingsPanels } from './settings/SettingsPanels'