# Configuration Migration Guide

This document maps all hardcoded values found in the Flow Desk desktop application to their new configuration system equivalents.

## Summary of Changes

### 1. Extended AppConfig.ts with New Configuration Categories

#### UI Layout Configuration (`uiLayout`)
- **Primary sidebar width**: `64px` → `config.uiLayout.primarySidebarWidth`
- **Services sidebar width**: `256px` → `config.uiLayout.servicesSidebarWidth`
- **Docked panel width**: `280px` → `config.uiLayout.dockedPanelWidth`
- **Minimum panel width**: `200px` → `config.uiLayout.minPanelWidth`
- **Maximum panel width**: `500px` → `config.uiLayout.maxPanelWidth`
- **Top bar height**: `0px` → `config.uiLayout.topBarHeight`
- **Content padding**: `16px` → `config.uiLayout.contentPadding`
- **Panel padding**: `12px` → `config.uiLayout.panelPadding`

#### Z-Index Configuration (`zIndex`)
- **Base layer**: `1` → `config.zIndex.base`
- **Browser view**: `5` → `config.zIndex.browserView`
- **Main content**: `10` → `config.zIndex.mainContent`
- **Sidebar**: `20` → `config.zIndex.sidebar`
- **Navigation**: `30` → `config.zIndex.navigation`
- **Dropdown**: `100` → `config.zIndex.dropdown`
- **Tooltip**: `200` → `config.zIndex.tooltip`
- **Popover**: `300` → `config.zIndex.popover`
- **Overlay**: `500` → `config.zIndex.overlay`
- **Search overlay**: `600` → `config.zIndex.searchOverlay`
- **Notifications**: `700` → `config.zIndex.notifications`
- **Modal backdrop**: `1000` → `config.zIndex.modalBackdrop`
- **Modal**: `1100` → `config.zIndex.modal`
- **Alert modal**: `1200` → `config.zIndex.alertModal`
- **Loading overlay**: `2000` → `config.zIndex.loadingOverlay`
- **Error boundary**: `2100` → `config.zIndex.errorBoundary`
- **Accessibility overlay**: `2200` → `config.zIndex.accessibilityOverlay`
- **Maximum**: `9999` → `config.zIndex.maximum`

#### Network Configuration (`network`)
- **Default timeout**: `30000ms` → `config.network.defaultTimeout`
- **Service load timeout**: `10000ms` → `config.network.serviceLoadTimeout`
- **Database timeout**: `30000ms` → `config.network.databaseTimeout`
- **Plugin execution timeout**: `30000ms` → `config.network.pluginExecutionTimeout`
- **Search timeout**: `5000ms` → `config.network.searchTimeout`
- **Retry base delay**: `1000ms` → `config.network.retryBaseDelay`
- **Retry max delay**: `30000ms` → `config.network.retryMaxDelay`
- **Default bind address**: `'127.0.0.1'` → `config.network.defaultBindAddress`
- **Max URL length**: `2000` → `config.network.maxUrlLength`

#### Encryption Configuration (`encryption`)
- **Key derivation iterations**: `100000` → `config.encryption.keyDerivationIterations`
- **Key length**: `32` → `config.encryption.keyLength`
- **Service name**: `'FlowDeskEncryption'` → `config.encryption.serviceName`
- **Account prefix**: `'flowdesk_'` → `config.encryption.accountPrefix`
- **Key rotation interval**: `90 days` → `config.encryption.keyRotationIntervalDays`

#### Plugin Configuration (`plugin`)
- **Max plugins**: `100` → `config.plugin.maxPlugins`
- **Sandbox timeout**: `30000ms` → `config.plugin.sandboxTimeout`
- **Max event history size**: `1000` → `config.plugin.maxEventHistorySize`
- **Max listeners**: `1000` → `config.plugin.maxListeners`
- **Health check interval**: `60000ms` → `config.plugin.healthCheckInterval`
- **Alert cleanup interval**: `300000ms` → `config.plugin.alertCleanupInterval`
- **Preload timeout**: `3000ms` → `config.plugin.preloadTimeout`

#### Database Configuration (`database`)
- **Busy timeout**: `30000ms` → `config.database.busyTimeout`
- **Max query stats history**: `1000` → `config.database.maxQueryStatsHistory`
- **Journal mode**: `'WAL'` → `config.database.journalMode`
- **Synchronous mode**: `'NORMAL'` → `config.database.synchronousMode`
- **Cache size**: `20000 KB` → `config.database.cacheSize`
- **Foreign keys**: `true` → `config.database.enableForeignKeys`

#### Service Configuration (`service`)
- **Max preloaded services**: `5` → `config.service.maxPreloadedServices`
- **Service cleanup delay**: `1800000ms` → `config.service.serviceCleanupDelay`
- **Icon mapping**: hardcoded paths → `config.service.iconMapping`
- **Validation rules**: hardcoded limits → `config.service.validation`

### 2. Environment Variables Added

#### UI Layout Variables
- `FLOWDESK_PRIMARY_SIDEBAR_WIDTH`: Override primary sidebar width
- `FLOWDESK_SERVICES_SIDEBAR_WIDTH`: Override services sidebar width

#### Network Variables
- `FLOWDESK_DEFAULT_TIMEOUT`: Override default network timeout
- `FLOWDESK_SERVICE_LOAD_TIMEOUT`: Override service load timeout
- `FLOWDESK_BIND_ADDRESS`: Override default bind address

#### Encryption Variables
- `FLOWDESK_KEY_ITERATIONS`: Override key derivation iterations
- `FLOWDESK_KEY_LENGTH`: Override encryption key length

#### Plugin Variables
- `FLOWDESK_MAX_PLUGINS`: Override maximum number of plugins
- `FLOWDESK_PLUGIN_TIMEOUT`: Override plugin sandbox timeout

#### Database Variables
- `FLOWDESK_DB_TIMEOUT`: Override database busy timeout
- `FLOWDESK_DB_CACHE_SIZE`: Override database cache size

#### Service Variables
- `FLOWDESK_MAX_PRELOADED_SERVICES`: Override maximum preloaded services

### 3. Files Updated

#### Main Process Files
- `/src/main/config/AppConfig.ts`: Extended with new configuration schemas
- `/src/main/workspace.ts`: Replaced hardcoded timeouts and limits
- `/src/main/encryption-key-manager.ts`: Replaced hardcoded encryption settings

#### Renderer Process Files
- `/src/renderer/components/layout/ServicesSidebar.tsx`: Replaced hardcoded icon mapping and z-index
- `/src/renderer/constants/layout.ts`: Added TODO comments for config integration
- `/src/renderer/constants/zIndex.ts`: Added TODO comments for config integration

### 4. Implementation Status

#### Completed ✅
- Extended AppConfig.ts with all new configuration categories
- Added environment variable mappings for new configuration options
- Updated workspace.ts to use configuration values
- Updated ServicesSidebar.tsx to prepare for configuration integration
- Updated constants files with TODO comments
- Updated encryption-key-manager.ts to prepare for configuration integration

#### In Progress 🔄
- Integration of configuration values in renderer process (requires IPC setup)
- Testing of new configuration system
- Documentation updates

#### Pending ⏳
- Update additional files with hardcoded values
- Create IPC handlers for renderer configuration access
- Add configuration validation tests
- Update development and production configuration files
- Create migration scripts for existing installations

### 5. Next Steps

1. **IPC Integration**: Set up IPC handlers to allow renderer process to access configuration
2. **Testing**: Create comprehensive tests for the new configuration system
3. **Documentation**: Update developer documentation with configuration options
4. **Migration**: Create migration guide for existing installations
5. **Validation**: Add runtime configuration validation and error handling

### 6. Configuration Examples

#### Development Configuration
```json
{
  "environment": "development",
  "development": {
    "enableDevTools": true,
    "enableDebugLogging": true
  },
  "uiLayout": {
    "primarySidebarWidth": 80,
    "servicesSidebarWidth": 300
  },
  "network": {
    "defaultTimeout": 10000,
    "serviceLoadTimeout": 5000
  }
}
```

#### Production Configuration
```json
{
  "environment": "production",
  "development": {
    "enableDevTools": false,
    "enableDebugLogging": false
  },
  "security": {
    "httpsOnly": true,
    "enableCSP": true
  },
  "performance": {
    "enabled": true,
    "samplingRate": 0.01
  }
}
```

This comprehensive configuration system provides flexibility, maintainability, and environment-specific customization for the Flow Desk application.