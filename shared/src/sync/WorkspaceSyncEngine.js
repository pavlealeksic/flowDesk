"use strict";
/**
 * Workspace Sync Engine
 *
 * Handles cross-platform synchronization of workspace settings,
 * plugin configurations, and user preferences with conflict resolution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceSyncEngine = void 0;
const events_1 = require("events");
class WorkspaceSyncEngine extends events_1.EventEmitter {
    constructor(deviceInfo) {
        super();
        this.config = null;
        this.metadata = null;
        this.conflicts = [];
        this.syncInProgress = false;
        this.deviceInfo = deviceInfo;
    }
    /**
     * Initialize the sync engine with current workspace configuration
     */
    async initialize(config) {
        this.config = config;
        this.metadata = {
            lastSync: Date.now(),
            version: config.version,
            checksum: this.calculateChecksum(config),
            conflictCount: 0,
            deviceCount: 1,
        };
        this.emit('initialized', { config, metadata: this.metadata });
    }
    /**
     * Sync workspace configuration across platforms
     */
    async syncWorkspaceSettings(remoteConfig) {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }
        this.syncInProgress = true;
        this.emit('syncStarted');
        try {
            if (!this.config) {
                throw new Error('Sync engine not initialized');
            }
            // Detect conflicts between local and remote configurations
            const conflicts = await this.detectConflicts(this.config, remoteConfig);
            if (conflicts.length > 0) {
                this.conflicts = conflicts;
                this.emit('conflictsDetected', conflicts);
                return {
                    success: false,
                    timestamp: new Date(),
                    duration: 0,
                    changesCount: 0,
                    conflictCount: conflicts.length,
                    conflicts: conflicts,
                    stats: {
                        uploaded: 0,
                        downloaded: 0,
                        merged: 0,
                        deleted: 0
                    }
                };
            }
            // Merge configurations
            const mergedConfig = await this.mergeConfigurations(this.config, remoteConfig);
            // Update local configuration
            this.config = mergedConfig;
            this.metadata = {
                lastSync: Date.now(),
                version: mergedConfig.version,
                checksum: this.calculateChecksum(mergedConfig),
                conflictCount: 0,
                deviceCount: this.metadata?.deviceCount || 1,
            };
            this.emit('configurationUpdated', mergedConfig);
            this.emit('syncCompleted', { config: mergedConfig, metadata: this.metadata });
            return {
                success: true,
                timestamp: new Date(),
                duration: 0,
                changesCount: this.countChanges(this.config, remoteConfig),
                conflictCount: 0,
                stats: {
                    uploaded: 0,
                    downloaded: this.countChanges(this.config, remoteConfig),
                    merged: 0,
                    deleted: 0
                }
            };
        }
        catch (error) {
            this.emit('syncError', error);
            return {
                success: false,
                timestamp: new Date(),
                duration: 0,
                changesCount: 0,
                conflictCount: 0,
                error: error instanceof Error ? error.message : 'Unknown sync error',
                stats: {
                    uploaded: 0,
                    downloaded: 0,
                    merged: 0,
                    deleted: 0
                }
            };
        }
        finally {
            this.syncInProgress = false;
        }
    }
    /**
     * Detect conflicts between local and remote configurations
     */
    async detectConflicts(localConfig, remoteConfig) {
        const conflicts = [];
        // Check workspace conflicts
        for (const remoteWorkspace of remoteConfig.workspaces) {
            const localWorkspace = localConfig.workspaces.find(w => w.id === remoteWorkspace.id);
            if (localWorkspace) {
                const workspaceConflicts = this.detectWorkspaceConflicts(localWorkspace, remoteWorkspace);
                conflicts.push(...workspaceConflicts);
            }
        }
        // Check plugin configuration conflicts
        for (const [pluginId, remotePlugin] of Object.entries(remoteConfig.plugins)) {
            const localPlugin = localConfig.plugins[pluginId];
            if (localPlugin) {
                const pluginConflicts = this.detectPluginConflicts(pluginId, localPlugin, remotePlugin);
                conflicts.push(...pluginConflicts);
            }
        }
        // Check preferences conflicts
        const preferencesConflicts = this.detectPreferencesConflicts(localConfig.preferences, remoteConfig.preferences);
        conflicts.push(...preferencesConflicts);
        return conflicts;
    }
    /**
     * Detect conflicts within a specific workspace
     */
    detectWorkspaceConflicts(local, remote) {
        const conflicts = [];
        // Check if workspace settings conflict
        if (JSON.stringify(local.settings) !== JSON.stringify(remote.settings)) {
            conflicts.push({
                id: `workspace_settings_${local.id}`,
                path: `workspace.${local.id}.settings`,
                type: 'workspace_settings',
                description: `Workspace "${local.workspace.name}" has conflicting settings`,
                local: {
                    value: local.settings,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                },
                remote: {
                    value: remote.settings,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                }
            });
        }
        // Check if app configurations conflict
        if (JSON.stringify(local.apps) !== JSON.stringify(remote.apps)) {
            conflicts.push({
                id: `workspace_apps_${local.id}`,
                path: `workspace.${local.id}.apps`,
                type: 'workspace_apps',
                description: `Workspace "${local.workspace.name}" has conflicting app configurations`,
                local: {
                    value: local.apps,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                },
                remote: {
                    value: remote.apps,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                }
            });
        }
        return conflicts;
    }
    /**
     * Detect conflicts within plugin configurations
     */
    detectPluginConflicts(pluginId, local, remote) {
        const conflicts = [];
        // Check if plugin settings conflict
        if (JSON.stringify(local.settings) !== JSON.stringify(remote.settings)) {
            conflicts.push({
                id: `plugin_settings_${pluginId}`,
                path: `plugins.${pluginId}.settings`,
                type: 'plugin_settings',
                description: `Plugin "${pluginId}" has conflicting settings`,
                local: {
                    value: local.settings,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                },
                remote: {
                    value: remote.settings,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                }
            });
        }
        // Check if plugin permissions conflict
        if (JSON.stringify(local.permissions) !== JSON.stringify(remote.permissions)) {
            conflicts.push({
                id: `plugin_permissions_${pluginId}`,
                path: `plugins.${pluginId}.permissions`,
                type: 'plugin_permissions',
                description: `Plugin "${pluginId}" has conflicting permissions`,
                local: {
                    value: local.permissions,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                },
                remote: {
                    value: remote.permissions,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                }
            });
        }
        return conflicts;
    }
    /**
     * Detect conflicts within user preferences
     */
    detectPreferencesConflicts(local, remote) {
        const conflicts = [];
        // Check theme conflicts
        if (JSON.stringify(local.theme) !== JSON.stringify(remote.theme)) {
            conflicts.push({
                id: 'preferences_theme',
                path: 'preferences.theme',
                type: 'concurrent_edit',
                description: 'Theme preferences conflict detected',
                local: {
                    value: local.theme,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                },
                remote: {
                    value: remote.theme,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                }
            });
        }
        // Check notification preferences conflicts
        if (JSON.stringify(local.notifications) !== JSON.stringify(remote.notifications)) {
            conflicts.push({
                id: 'preferences_notifications',
                path: 'preferences.notifications',
                type: 'concurrent_edit',
                description: 'Notification preferences conflict detected',
                local: {
                    value: local.notifications,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                },
                remote: {
                    value: remote.notifications,
                    timestamp: new Date(),
                    deviceId: 'unknown',
                    vectorClock: {}
                }
            });
        }
        return conflicts;
    }
    /**
     * Merge two configurations intelligently
     */
    async mergeConfigurations(localConfig, remoteConfig) {
        // Use the most recent version
        const baseConfig = remoteConfig.timestamp > localConfig.timestamp ? remoteConfig : localConfig;
        const otherConfig = remoteConfig.timestamp > localConfig.timestamp ? localConfig : remoteConfig;
        // Merge workspaces
        const mergedWorkspaces = this.mergeWorkspaces(baseConfig.workspaces, otherConfig.workspaces);
        // Merge plugins
        const mergedPlugins = this.mergePlugins(baseConfig.plugins, otherConfig.plugins);
        // Merge preferences
        const mergedPreferences = this.mergePreferences(baseConfig.preferences, otherConfig.preferences);
        return {
            workspaces: mergedWorkspaces,
            plugins: mergedPlugins,
            preferences: mergedPreferences,
            version: this.generateVersion(),
            timestamp: Date.now(),
            deviceId: this.deviceInfo.deviceId,
        };
    }
    /**
     * Merge workspace configurations
     */
    mergeWorkspaces(workspaces1, workspaces2) {
        const merged = new Map();
        // Add all workspaces from first config
        for (const workspace of workspaces1) {
            merged.set(workspace.workspace.id, workspace);
        }
        // Merge or add workspaces from second config
        for (const workspace of workspaces2) {
            const existing = merged.get(workspace.workspace.id);
            if (existing) {
                // Merge workspace configurations
                merged.set(workspace.workspace.id, {
                    ...existing,
                    ...workspace,
                    workspace: { ...existing.workspace, ...workspace.workspace },
                    apps: { ...existing.apps, ...workspace.apps },
                    lastModified: {
                        timestamp: new Date(Math.max(existing.lastModified.timestamp.getTime(), workspace.lastModified.timestamp.getTime())),
                        deviceId: workspace.lastModified.deviceId,
                        userId: workspace.lastModified.userId
                    }
                });
            }
            else {
                merged.set(workspace.workspace.id, workspace);
            }
        }
        return Array.from(merged.values());
    }
    /**
     * Merge app configurations within workspaces
     */
    mergeApps(apps1, apps2) {
        const merged = new Map();
        // Add all apps from first config
        for (const app of apps1) {
            merged.set(app.id, app);
        }
        // Merge or add apps from second config
        for (const app of apps2) {
            const existing = merged.get(app.id);
            if (existing) {
                merged.set(app.id, {
                    ...existing,
                    ...app,
                    settings: { ...existing.settings, ...app.settings },
                });
            }
            else {
                merged.set(app.id, app);
            }
        }
        return Array.from(merged.values());
    }
    /**
     * Merge plugin configurations
     */
    mergePlugins(plugins1, plugins2) {
        const merged = { ...plugins1 };
        for (const [pluginId, plugin] of Object.entries(plugins2)) {
            if (merged[pluginId]) {
                // Merge plugin configurations
                merged[pluginId] = {
                    ...merged[pluginId],
                    ...plugin,
                    settings: { ...merged[pluginId].settings, ...plugin.settings },
                    permissions: { ...merged[pluginId].permissions, ...plugin.permissions },
                };
            }
            else {
                merged[pluginId] = plugin;
            }
        }
        return merged;
    }
    /**
     * Merge user preferences
     */
    mergePreferences(prefs1, prefs2) {
        return {
            ...prefs1,
            ...prefs2,
            notifications: { ...prefs1.notifications, ...prefs2.notifications },
            theme: { ...prefs1.theme, ...prefs2.theme },
            language: { ...prefs1.language, ...prefs2.language },
            privacy: { ...prefs1.privacy, ...prefs2.privacy },
            accessibility: { ...prefs1.accessibility, ...prefs2.accessibility },
            startup: { ...prefs1.startup, ...prefs2.startup },
        };
    }
    /**
     * Resolve a specific conflict
     */
    async resolveConflict(resolution) {
        const conflictIndex = this.conflicts.findIndex(c => c.id === resolution.conflictId);
        if (conflictIndex === -1) {
            throw new Error(`Conflict ${resolution.conflictId} not found`);
        }
        const conflict = this.conflicts[conflictIndex];
        let resolvedValue;
        switch (resolution.resolution) {
            case 'local':
                resolvedValue = conflict.local.value;
                break;
            case 'remote':
                resolvedValue = conflict.remote.value;
                break;
            case 'merge':
                resolvedValue = resolution.mergedValue || this.autoMerge(conflict.local.value, conflict.remote.value);
                break;
        }
        // Apply the resolved value to the configuration
        if (this.config) {
            this.applyConflictResolution(conflict, resolvedValue);
        }
        // Remove the conflict from the list
        this.conflicts.splice(conflictIndex, 1);
        this.emit('conflictResolved', { conflictId: resolution.conflictId, resolvedValue });
    }
    /**
     * Apply a conflict resolution to the configuration
     */
    applyConflictResolution(conflict, resolvedValue) {
        if (!this.config)
            return;
        const [type, ...parts] = conflict.type.split('_');
        switch (type) {
            case 'workspace':
                this.applyWorkspaceResolution(parts.join('_'), conflict.id, resolvedValue);
                break;
            case 'plugin':
                this.applyPluginResolution(parts.join('_'), conflict.id, resolvedValue);
                break;
            case 'preferences':
                this.applyPreferencesResolution(parts.join('_'), resolvedValue);
                break;
        }
    }
    /**
     * Apply workspace conflict resolution
     */
    applyWorkspaceResolution(type, conflictId, resolvedValue) {
        if (!this.config)
            return;
        const workspaceId = conflictId.split('_').pop();
        const workspace = this.config.workspaces.find(w => w.id === workspaceId);
        if (workspace) {
            switch (type) {
                case 'settings':
                    workspace.settings = resolvedValue;
                    break;
                case 'apps':
                    workspace.apps = resolvedValue;
                    break;
            }
        }
    }
    /**
     * Apply plugin conflict resolution
     */
    applyPluginResolution(type, conflictId, resolvedValue) {
        if (!this.config)
            return;
        const pluginId = conflictId.split('_').pop();
        if (pluginId && this.config.plugins[pluginId]) {
            switch (type) {
                case 'settings':
                    this.config.plugins[pluginId].settings = resolvedValue;
                    break;
                case 'permissions':
                    this.config.plugins[pluginId].permissions = resolvedValue;
                    break;
            }
        }
    }
    /**
     * Apply preferences conflict resolution
     */
    applyPreferencesResolution(type, resolvedValue) {
        if (!this.config)
            return;
        switch (type) {
            case 'theme':
                this.config.preferences.theme = resolvedValue;
                break;
            case 'notifications':
                this.config.preferences.notifications = resolvedValue;
                break;
        }
    }
    /**
     * Automatically merge two values
     */
    autoMerge(localValue, remoteValue) {
        if (typeof localValue === 'object' && typeof remoteValue === 'object') {
            if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
                // Merge arrays by combining unique items
                return [...new Set([...localValue, ...remoteValue])];
            }
            else {
                // Merge objects by combining properties
                return { ...localValue, ...remoteValue };
            }
        }
        // For primitive values, prefer the remote value
        return remoteValue;
    }
    /**
     * Calculate configuration checksum
     */
    calculateChecksum(config) {
        const content = JSON.stringify(config, Object.keys(config).sort());
        return this.hash(content);
    }
    /**
     * Simple hash function
     */
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    /**
     * Generate a new version string
     */
    generateVersion() {
        return `v${Date.now()}.${Math.random().toString(36).substr(2, 5)}`;
    }
    /**
     * Count the number of changes between configurations
     */
    countChanges(config1, config2) {
        let changes = 0;
        // Count workspace changes
        changes += Math.abs(config1.workspaces.length - config2.workspaces.length);
        // Count plugin changes
        changes += Math.abs(Object.keys(config1.plugins).length - Object.keys(config2.plugins).length);
        // Count preference changes
        if (JSON.stringify(config1.preferences) !== JSON.stringify(config2.preferences)) {
            changes += 1;
        }
        return changes;
    }
    /**
     * Get current configuration
     */
    getCurrentConfig() {
        return this.config;
    }
    /**
     * Get current metadata
     */
    getMetadata() {
        return this.metadata;
    }
    /**
     * Get current conflicts
     */
    getConflicts() {
        return this.conflicts;
    }
    /**
     * Check if sync is in progress
     */
    isSyncing() {
        return this.syncInProgress;
    }
}
exports.WorkspaceSyncEngine = WorkspaceSyncEngine;
//# sourceMappingURL=WorkspaceSyncEngine.js.map