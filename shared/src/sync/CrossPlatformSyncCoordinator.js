"use strict";
/**
 * Cross-Platform Sync Coordinator
 *
 * Orchestrates synchronization of workspace settings, plugin configurations,
 * and user preferences across desktop and mobile platforms.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossPlatformSyncCoordinator = void 0;
const events_1 = require("events");
const WorkspaceSyncEngine_1 = require("./WorkspaceSyncEngine");
class CrossPlatformSyncCoordinator extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.currentState = {
            status: 'idle',
            stats: {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                lastSyncDuration: 0,
                avgSyncDuration: 0
            },
            pendingChanges: 0,
            conflicts: 0,
            vectorClock: {}
        };
        this.syncInterval = null;
        this.activeSessions = new Map();
        this.config = config;
        this.workspaceSyncEngine = new WorkspaceSyncEngine_1.WorkspaceSyncEngine(config.deviceInfo);
        this.statistics = {
            totalSessions: 0,
            successfulSessions: 0,
            failedSessions: 0,
            totalConflicts: 0,
            resolvedConflicts: 0,
            lastSyncTime: 0,
            averageSyncDuration: 0,
            dataTransferred: 0,
        };
        this.setupEventListeners();
    }
    /**
     * Initialize the sync coordinator
     */
    async initialize() {
        try {
            // Initialize workspace sync engine
            const currentConfig = await this.gatherCurrentConfiguration();
            await this.workspaceSyncEngine.initialize(currentConfig);
            // Start auto-sync if enabled
            if (this.config.autoSync) {
                this.startAutoSync();
            }
            this.emit('initialized');
        }
        catch (error) {
            this.emit('error', { type: 'initialization', error });
            throw error;
        }
    }
    /**
     * Perform a full cross-platform synchronization
     */
    async performFullSync() {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            startTime: Date.now(),
            status: 'in_progress',
            changes: 0,
            conflicts: 0,
            errors: [],
        };
        this.activeSessions.set(sessionId, session);
        this.currentState.status = 'syncing';
        this.statistics.totalSessions++;
        this.emit('syncStarted', { sessionId });
        try {
            const results = [];
            let totalChanges = 0;
            let totalConflicts = 0;
            // Sync with each available transport
            for (const transport of this.config.transports) {
                if (!transport.isAvailable()) {
                    continue;
                }
                try {
                    const result = await this.syncWithTransport(transport, sessionId);
                    results.push(result);
                    totalChanges += result.changesCount || 0;
                    totalConflicts += result.conflicts?.length || 0;
                }
                catch (error) {
                    session.errors.push(`Transport ${transport.name}: ${error instanceof Error ? error.message : String(error)}`);
                    this.emit('transportError', { transport: transport.name, error, sessionId });
                }
            }
            // Update session
            session.endTime = Date.now();
            session.changes = totalChanges;
            session.conflicts = totalConflicts;
            if (session.errors.length === 0) {
                session.status = 'completed';
                this.statistics.successfulSessions++;
            }
            else {
                session.status = 'failed';
                this.statistics.failedSessions++;
            }
            this.statistics.totalConflicts += totalConflicts;
            this.statistics.lastSyncTime = session.endTime;
            this.updateStatistics(session);
            const finalResult = {
                success: session.status === 'completed',
                timestamp: new Date(session.endTime || Date.now()),
                duration: (session.endTime || Date.now()) - session.startTime,
                changesCount: totalChanges,
                conflictCount: totalConflicts,
                conflicts: totalConflicts > 0 ? this.workspaceSyncEngine.getConflicts() : undefined,
                stats: {
                    uploaded: 0,
                    downloaded: totalChanges,
                    merged: 0,
                    deleted: 0
                }
            };
            this.emit('syncCompleted', { result: finalResult, session });
            return finalResult;
        }
        catch (error) {
            session.endTime = Date.now();
            session.status = 'failed';
            session.errors.push(error instanceof Error ? error.message : String(error));
            this.statistics.failedSessions++;
            this.emit('syncFailed', { error, sessionId });
            return {
                success: false,
                timestamp: new Date(),
                duration: Date.now() - session.startTime,
                changesCount: 0,
                conflictCount: 0,
                error: error instanceof Error ? error.message : String(error),
                stats: {
                    uploaded: 0,
                    downloaded: 0,
                    merged: 0,
                    deleted: 0
                }
            };
        }
        finally {
            this.currentState.status = 'idle';
        }
    }
    /**
     * Sync with a specific transport
     */
    async syncWithTransport(transport, sessionId) {
        this.emit('transportSyncStarted', { transport: transport.name, sessionId });
        // Download remote configuration
        const remoteConfig = await transport.downloadConfiguration();
        // Sync workspace settings
        const result = await this.workspaceSyncEngine.syncWorkspaceSettings(remoteConfig);
        if (result.success && !result.conflicts) {
            // Upload merged configuration back to transport
            const currentConfig = this.workspaceSyncEngine.getCurrentConfig();
            if (currentConfig) {
                await transport.uploadConfiguration(currentConfig);
                this.statistics.dataTransferred += this.estimateConfigSize(currentConfig);
            }
        }
        this.emit('transportSyncCompleted', { transport: transport.name, result, sessionId });
        return result;
    }
    /**
     * Sync specific configuration types
     */
    async syncWorkspaceSettings(workspaceId) {
        const currentConfig = await this.gatherCurrentConfiguration();
        if (workspaceId) {
            // Filter to specific workspace
            currentConfig.workspaces = currentConfig.workspaces.filter(w => w.id === workspaceId);
        }
        // Perform targeted sync
        return await this.performConfigSync(currentConfig);
    }
    async syncPluginConfigurations(pluginIds) {
        const currentConfig = await this.gatherCurrentConfiguration();
        if (pluginIds) {
            // Filter to specific plugins
            const filteredPlugins = {};
            for (const id of pluginIds) {
                if (currentConfig.plugins[id]) {
                    filteredPlugins[id] = currentConfig.plugins[id];
                }
            }
            currentConfig.plugins = filteredPlugins;
        }
        return await this.performConfigSync(currentConfig);
    }
    async syncUserPreferences() {
        const currentConfig = await this.gatherCurrentConfiguration();
        // Only sync preferences
        currentConfig.workspaces = [];
        currentConfig.plugins = {};
        return await this.performConfigSync(currentConfig);
    }
    /**
     * Perform configuration sync with conflict detection and resolution
     */
    async performConfigSync(config) {
        for (const transport of this.config.transports) {
            if (!transport.isAvailable())
                continue;
            try {
                const remoteConfig = await transport.downloadConfiguration();
                const result = await this.workspaceSyncEngine.syncWorkspaceSettings(remoteConfig);
                if (result.conflicts && this.config.conflictResolution !== 'manual') {
                    // Auto-resolve conflicts
                    await this.autoResolveConflicts(result.conflicts);
                }
                return result;
            }
            catch (error) {
                console.error(`Sync failed with transport ${transport.name}:`, error);
            }
        }
        throw new Error('All transports failed');
    }
    /**
     * Auto-resolve conflicts based on configuration
     */
    async autoResolveConflicts(conflicts) {
        const resolution = this.config.conflictResolution === 'auto_local' ? 'local' : 'remote';
        for (const conflict of conflicts) {
            await this.workspaceSyncEngine.resolveConflict({
                conflictId: conflict.id,
                resolution,
            });
        }
        this.statistics.resolvedConflicts += conflicts.length;
    }
    /**
     * Handle real-time configuration changes
     */
    async onConfigurationChanged(changeType, data) {
        if (this.config.autoSync && this.currentState.status === 'idle') {
            // Debounce rapid changes
            setTimeout(async () => {
                try {
                    switch (changeType) {
                        case 'workspace':
                            await this.syncWorkspaceSettings(data.workspaceId);
                            break;
                        case 'plugin':
                            await this.syncPluginConfigurations([data.pluginId]);
                            break;
                        case 'preferences':
                            await this.syncUserPreferences();
                            break;
                    }
                }
                catch (error) {
                    this.emit('autoSyncError', { changeType, error });
                }
            }, 5000); // 5 second debounce
        }
    }
    /**
     * Start automatic synchronization
     */
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.syncInterval = setInterval(async () => {
            if (this.currentState.status === 'idle') {
                try {
                    await this.performFullSync();
                }
                catch (error) {
                    this.emit('autoSyncError', { error });
                }
            }
        }, this.config.syncInterval);
        this.emit('autoSyncStarted', { interval: this.config.syncInterval });
    }
    /**
     * Stop automatic synchronization
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.emit('autoSyncStopped');
    }
    /**
     * Update sync configuration
     */
    async updateSyncConfig(updates) {
        this.config = { ...this.config, ...updates };
        if (updates.autoSync !== undefined) {
            if (updates.autoSync) {
                this.startAutoSync();
            }
            else {
                this.stopAutoSync();
            }
        }
        if (updates.syncInterval && this.config.autoSync) {
            this.startAutoSync(); // Restart with new interval
        }
        this.emit('configUpdated', this.config);
    }
    /**
     * Get current synchronization status
     */
    getStatus() {
        return {
            state: this.currentState,
            activeSessions: Array.from(this.activeSessions.values()),
            conflicts: this.workspaceSyncEngine.getConflicts(),
            statistics: this.statistics,
            config: this.config,
        };
    }
    /**
     * Get sync history
     */
    getSyncHistory(limit = 50) {
        return Array.from(this.activeSessions.values())
            .filter(session => session.status !== 'in_progress')
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit);
    }
    /**
     * Force conflict resolution
     */
    async resolveConflicts(resolutions) {
        for (const resolution of resolutions) {
            await this.workspaceSyncEngine.resolveConflict(resolution);
        }
        this.statistics.resolvedConflicts += resolutions.length;
        this.emit('conflictsResolved', { count: resolutions.length });
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.stopAutoSync();
        // Cancel active sessions
        for (const session of this.activeSessions.values()) {
            if (session.status === 'in_progress') {
                session.status = 'cancelled';
                session.endTime = Date.now();
            }
        }
        this.removeAllListeners();
    }
    // Private helper methods
    setupEventListeners() {
        this.workspaceSyncEngine.on('conflictsDetected', (conflicts) => {
            this.emit('conflictsDetected', conflicts);
        });
        this.workspaceSyncEngine.on('conflictResolved', (resolution) => {
            this.emit('conflictResolved', resolution);
        });
        this.workspaceSyncEngine.on('configurationUpdated', (config) => {
            this.emit('configurationUpdated', config);
        });
    }
    async gatherCurrentConfiguration() {
        // This would gather current configuration from the application
        // Implementation would depend on the specific platform
        return {
            workspaces: [], // Get from workspace manager
            plugins: {}, // Get from plugin manager
            preferences: {
                theme: {
                    mode: 'light',
                    accentColor: '#007acc',
                    fontFamily: 'Inter',
                    fontSize: 'medium',
                    highContrast: false,
                    colorBlindFriendly: false
                },
                language: {
                    locale: 'en-US',
                    dateFormat: 'MM/dd/yyyy',
                    timeFormat: '12h',
                    numberFormat: 'en-US',
                    currency: 'USD',
                    timezone: 'America/New_York',
                    firstDayOfWeek: 0
                },
                privacy: {
                    analytics: false,
                    crashReporting: true,
                    usageData: false,
                    telemetry: false,
                    showOnlineStatus: false,
                    showLastSeen: false,
                    readReceipts: false
                },
                accessibility: {
                    reducedMotion: false,
                    screenReader: false,
                    keyboardNavigation: false,
                    focusIndicators: true,
                    textScaling: 1.0,
                    voiceCommands: false
                },
                notifications: {
                    desktop: true,
                    sound: true,
                    emailDigest: false,
                    push: false,
                    soundFile: 'default',
                    doNotDisturb: {
                        enabled: false,
                        startTime: '22:00',
                        endTime: '08:00',
                        days: [0, 1, 2, 3, 4, 5, 6]
                    }
                },
                startup: {
                    autoStart: false,
                    restoreWorkspace: true,
                    defaultApps: [],
                    layout: 'default',
                    autoSync: true,
                    checkUpdates: true
                }
            }, // Get from preferences manager
            version: this.generateVersion(),
            timestamp: Date.now(),
            deviceId: this.config.deviceInfo.deviceId,
        };
    }
    generateSessionId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    generateVersion() {
        return `v${Date.now()}.${Math.random().toString(36).substr(2, 5)}`;
    }
    estimateConfigSize(config) {
        return JSON.stringify(config).length;
    }
    updateStatistics(session) {
        if (session.endTime && session.startTime) {
            const duration = session.endTime - session.startTime;
            this.statistics.averageSyncDuration =
                (this.statistics.averageSyncDuration * (this.statistics.totalSessions - 1) + duration) /
                    this.statistics.totalSessions;
        }
    }
}
exports.CrossPlatformSyncCoordinator = CrossPlatformSyncCoordinator;
//# sourceMappingURL=CrossPlatformSyncCoordinator.js.map