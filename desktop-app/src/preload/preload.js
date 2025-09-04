"use strict";
/**
 * Flow Desk Preload Script - Final Implementation
 *
 * Exposes secure APIs for IMAP mail, CalDAV calendar, and workspace management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Implement the Flow Desk API
const flowDeskAPI = {
    // App information
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke('app:get-version'),
        getPlatform: () => electron_1.ipcRenderer.invoke('app:get-platform'),
    },
    // View management
    view: {
        switch: (view) => electron_1.ipcRenderer.invoke('view:switch', view),
        onViewChanged: (callback) => {
            electron_1.ipcRenderer.on('view-changed', (_, view) => callback(view));
        },
    },
    // Workspace management - implementation matching Redux slice expectations
    workspace: {
        // Core workspace operations (unified methods)
        getAll: () => electron_1.ipcRenderer.invoke('workspace:get-all'),
        getById: (workspaceId) => electron_1.ipcRenderer.invoke('workspace:get-by-id', workspaceId),
        getCurrent: () => electron_1.ipcRenderer.invoke('workspace:get-active'),
        create: (workspaceData) => electron_1.ipcRenderer.invoke('workspace:create-full', workspaceData),
        update: (workspaceId, updates) => electron_1.ipcRenderer.invoke('workspace:update', workspaceId, updates),
        delete: (workspaceId) => electron_1.ipcRenderer.invoke('workspace:delete', workspaceId),
        switch: (workspaceId) => electron_1.ipcRenderer.invoke('workspace:switch', workspaceId),
        // Redux slice compatibility methods
        list: () => electron_1.ipcRenderer.invoke('workspace:get-all'),
        listPartitions: () => electron_1.ipcRenderer.invoke('workspace:list-partitions'),
        createPartition: (partitionData) => electron_1.ipcRenderer.invoke('workspace:create-partition', partitionData),
        updatePartition: (partitionId, updates) => electron_1.ipcRenderer.invoke('workspace:update-partition', partitionId, updates),
        clearData: (workspaceId) => electron_1.ipcRenderer.invoke('workspace:clear-data', workspaceId),
        getWindows: (workspaceId) => electron_1.ipcRenderer.invoke('workspace:get-windows', workspaceId),
        createWindow: (windowData) => electron_1.ipcRenderer.invoke('workspace:create-window', windowData),
        // Service management within workspaces
        addService: (workspaceId, serviceName, serviceType, url) => electron_1.ipcRenderer.invoke('workspace:add-service', workspaceId, serviceName, serviceType, url),
        updateService: (workspaceId, serviceId, updates) => electron_1.ipcRenderer.invoke('workspace:update-service', workspaceId, serviceId, updates),
        removeService: (workspaceId, serviceId) => electron_1.ipcRenderer.invoke('workspace:remove-service', workspaceId, serviceId),
        loadService: (workspaceId, serviceId) => electron_1.ipcRenderer.invoke('workspace:load-service', workspaceId, serviceId),
        // Utility methods
        getPredefinedServices: () => electron_1.ipcRenderer.invoke('workspace:get-predefined-services'),
    },
    // Mail (IMAP/SMTP) - implementation matching Redux slice expectations
    mail: {
        // Account management (exact Redux signatures)
        getAccounts: () => electron_1.ipcRenderer.invoke('mail:get-accounts'),
        addAccount: (account) => electron_1.ipcRenderer.invoke('mail:add-account-obj', account),
        updateAccount: (accountId, updates) => electron_1.ipcRenderer.invoke('mail:update-account', accountId, updates),
        removeAccount: (accountId) => electron_1.ipcRenderer.invoke('mail:remove-account', accountId),
        // Folder operations
        getFolders: (accountId) => electron_1.ipcRenderer.invoke('mail:get-folders', accountId),
        // Message operations (exact Redux signatures)
        getMessages: (accountId, folderId, options) => electron_1.ipcRenderer.invoke('mail:get-messages', accountId, folderId, options),
        sendMessage: (accountId, message) => electron_1.ipcRenderer.invoke('mail:send-message-obj', accountId, message),
        markMessageRead: (accountId, messageId, read) => electron_1.ipcRenderer.invoke('mail:mark-message-read', accountId, messageId, read),
        markMessageStarred: (accountId, messageId, starred) => electron_1.ipcRenderer.invoke('mail:mark-message-starred', accountId, messageId, starred),
        deleteMessage: (accountId, messageId) => electron_1.ipcRenderer.invoke('mail:delete-message', accountId, messageId),
        // Advanced message features
        getUnifiedMessages: (limit) => electron_1.ipcRenderer.invoke('mail:get-unified-messages', limit),
        getSmartMailboxMessages: (criteria) => electron_1.ipcRenderer.invoke('mail:get-smart-mailbox-messages', criteria),
        getMessageThread: (accountId, threadId) => electron_1.ipcRenderer.invoke('mail:get-message-thread', accountId, threadId),
        // Email scheduling
        scheduleMessage: (accountId, message, scheduledDate) => electron_1.ipcRenderer.invoke('mail:schedule-message', accountId, message, scheduledDate),
        getScheduledMessages: (accountId) => electron_1.ipcRenderer.invoke('mail:get-scheduled-messages', accountId),
        cancelScheduledMessage: (accountId, messageId) => electron_1.ipcRenderer.invoke('mail:cancel-scheduled-message', accountId, messageId),
        // Email aliases
        getEmailAliases: (accountId) => electron_1.ipcRenderer.invoke('mail:get-email-aliases', accountId),
        addEmailAlias: (accountId, address, name) => electron_1.ipcRenderer.invoke('mail:add-email-alias', accountId, address, name),
        removeEmailAlias: (accountId, aliasAddress) => electron_1.ipcRenderer.invoke('mail:remove-email-alias', accountId, aliasAddress),
        // Search and sync (exact Redux signatures)
        searchMessages: (query, options) => electron_1.ipcRenderer.invoke('mail:search-messages', query, options),
        syncAccount: (accountId) => electron_1.ipcRenderer.invoke('mail:sync-account', accountId),
        syncAll: () => electron_1.ipcRenderer.invoke('mail:sync-all'),
        getSyncStatus: () => electron_1.ipcRenderer.invoke('mail:get-sync-status'),
        startSync: () => electron_1.ipcRenderer.invoke('mail:start-sync'),
        stopSync: () => electron_1.ipcRenderer.invoke('mail:stop-sync'),
        // OAuth2 Authentication (new enhanced methods)
        startOAuthFlow: (providerId) => electron_1.ipcRenderer.invoke('oauth:start-flow', providerId),
        authenticateProvider: (providerId) => electron_1.ipcRenderer.invoke('oauth:authenticate-provider', providerId),
        getProviderStatus: (providerId) => electron_1.ipcRenderer.invoke('oauth:get-provider-status', providerId),
        getConfiguredProviders: () => electron_1.ipcRenderer.invoke('oauth:get-configured-providers'),
        refreshToken: (accountId, providerId) => electron_1.ipcRenderer.invoke('oauth:refresh-token', accountId, providerId),
        revokeToken: (accountId, providerId) => electron_1.ipcRenderer.invoke('oauth:revoke-token', accountId, providerId),
        getTokenStatus: (accountId, providerId) => electron_1.ipcRenderer.invoke('oauth:get-token-status', accountId, providerId),
        // Real-time sync (IDLE)
        startIdle: (accountId) => electron_1.ipcRenderer.invoke('mail:start-idle', accountId),
        stopIdle: (accountId) => electron_1.ipcRenderer.invoke('mail:stop-idle', accountId),
        // Attachment operations
        downloadAttachment: (attachment) => electron_1.ipcRenderer.invoke('mail:download-attachment', attachment),
        // Email template operations
        getAllTemplates: () => electron_1.ipcRenderer.invoke('email-templates:get-all'),
        getTemplatesByCategory: (category) => electron_1.ipcRenderer.invoke('email-templates:get-by-category', category),
        getTemplate: (templateId) => electron_1.ipcRenderer.invoke('email-templates:get', templateId),
        saveTemplate: (template) => electron_1.ipcRenderer.invoke('email-templates:save', template),
        updateTemplate: (templateId, updates) => electron_1.ipcRenderer.invoke('email-templates:update', templateId, updates),
        deleteTemplate: (templateId) => electron_1.ipcRenderer.invoke('email-templates:delete', templateId),
        useTemplate: (templateId) => electron_1.ipcRenderer.invoke('email-templates:use', templateId),
        searchTemplates: (query) => electron_1.ipcRenderer.invoke('email-templates:search', query),
        processTemplateVariables: (template, variables) => electron_1.ipcRenderer.invoke('email-templates:process-variables', template, variables),
        // Email scheduling operations (using correct IPC handler names)
        scheduleEmail: (emailData, scheduledTime) => electron_1.ipcRenderer.invoke('email-scheduler:schedule', emailData, scheduledTime),
        cancelScheduledEmail: (emailId) => electron_1.ipcRenderer.invoke('email-scheduler:cancel', emailId),
        getScheduledEmails: () => electron_1.ipcRenderer.invoke('email-scheduler:get-scheduled'),
        snoozeEmail: (messageId, accountId, snoozeUntil, reason) => electron_1.ipcRenderer.invoke('email-scheduler:snooze', messageId, accountId, snoozeUntil, reason),
        getSnoozedEmails: () => electron_1.ipcRenderer.invoke('email-scheduler:get-snoozed'),
        getSchedulerStats: () => electron_1.ipcRenderer.invoke('email-scheduler:get-stats'),
        // Email rules operations
        getAllRules: () => electron_1.ipcRenderer.invoke('email-rules:get-all'),
        getRulesByAccount: (accountId) => electron_1.ipcRenderer.invoke('email-rules:get-by-account', accountId),
        createRule: (ruleData) => electron_1.ipcRenderer.invoke('email-rules:create', ruleData),
        updateRule: (ruleId, updates) => electron_1.ipcRenderer.invoke('email-rules:update', ruleId, updates),
        deleteRule: (ruleId) => electron_1.ipcRenderer.invoke('email-rules:delete', ruleId),
        testRule: (ruleId, testMessage) => electron_1.ipcRenderer.invoke('email-rules:test', ruleId, testMessage),
        getRuleStats: () => electron_1.ipcRenderer.invoke('email-rules:get-stats'),
        processMessage: (message) => electron_1.ipcRenderer.invoke('email-rules:process-message', message),
        // Text snippet operations
        getAllSnippets: () => electron_1.ipcRenderer.invoke('snippets:get-all'),
        getSnippetsByCategory: (category) => electron_1.ipcRenderer.invoke('snippets:get-by-category', category),
        saveSnippet: (snippet) => electron_1.ipcRenderer.invoke('snippets:save', snippet),
        updateSnippet: (snippetId, updates) => electron_1.ipcRenderer.invoke('snippets:update', snippetId, updates),
        deleteSnippet: (snippetId) => electron_1.ipcRenderer.invoke('snippets:delete', snippetId),
        useSnippet: (snippetId) => electron_1.ipcRenderer.invoke('snippets:use', snippetId),
        searchSnippets: (query) => electron_1.ipcRenderer.invoke('snippets:search', query),
        getSnippetByShortcut: (shortcut) => electron_1.ipcRenderer.invoke('snippets:get-by-shortcut', shortcut),
        // Event callbacks for real-time updates
        onSyncStarted: (callback) => {
            electron_1.ipcRenderer.on('mail:sync-started', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('mail:sync-started');
        },
        onSyncCompleted: (callback) => {
            electron_1.ipcRenderer.on('mail:sync-completed', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('mail:sync-completed');
        },
        onSyncError: (callback) => {
            electron_1.ipcRenderer.on('mail:sync-error', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('mail:sync-error');
        },
        onNewMessages: (callback) => {
            electron_1.ipcRenderer.on('mail:new-messages', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('mail:new-messages');
        },
    },
    // Calendar (CalDAV) - implementation matching Redux slice expectations
    calendar: {
        // Account management (Redux slice compatibility)
        getUserAccounts: (userId) => electron_1.ipcRenderer.invoke('calendar:get-user-accounts', userId),
        getAccounts: () => electron_1.ipcRenderer.invoke('calendar:get-accounts'),
        createAccount: (accountData) => electron_1.ipcRenderer.invoke('calendar:create-account', accountData),
        addAccount: (email, password, serverConfig) => electron_1.ipcRenderer.invoke('calendar:add-account', email, password, serverConfig),
        updateAccount: (accountId, updates) => electron_1.ipcRenderer.invoke('calendar:update-account', accountId, updates),
        deleteAccount: (accountId) => electron_1.ipcRenderer.invoke('calendar:delete-account', accountId),
        removeAccount: (accountId) => electron_1.ipcRenderer.invoke('calendar:remove-account', accountId),
        // Calendar operations
        listCalendars: (accountId) => electron_1.ipcRenderer.invoke('calendar:list-calendars', accountId),
        getCalendars: (accountId) => electron_1.ipcRenderer.invoke('calendar:get-calendars', accountId),
        // Event operations (Redux slice compatibility)
        getEventsInRange: (calendarIds, timeMin, timeMax) => electron_1.ipcRenderer.invoke('calendar:get-events-in-range', calendarIds, timeMin, timeMax),
        getEvents: (accountId, startDate, endDate) => electron_1.ipcRenderer.invoke('calendar:get-events', accountId, startDate, endDate),
        createEvent: (eventData) => electron_1.ipcRenderer.invoke('calendar:create-event-full', eventData),
        updateEvent: (calendarId, eventId, updates) => electron_1.ipcRenderer.invoke('calendar:update-event-full', calendarId, eventId, updates),
        deleteEvent: (calendarId, eventId) => electron_1.ipcRenderer.invoke('calendar:delete-event-full', calendarId, eventId),
        // Search operations
        searchEvents: (query, limit) => electron_1.ipcRenderer.invoke('calendar:search-events', query, limit),
        // Sync operations (Redux slice compatibility)
        syncAccount: (accountId, force) => electron_1.ipcRenderer.invoke('calendar:sync-account-full', accountId, force),
        syncAll: () => electron_1.ipcRenderer.invoke('calendar:sync-all'),
        // Event callbacks (for useCalendarSync hook)
        onAccountCreated: (callback) => {
            electron_1.ipcRenderer.on('calendar:account-created', (_, account) => callback(account));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:account-created');
        },
        onAccountUpdated: (callback) => {
            electron_1.ipcRenderer.on('calendar:account-updated', (_, account) => callback(account));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:account-updated');
        },
        onAccountDeleted: (callback) => {
            electron_1.ipcRenderer.on('calendar:account-deleted', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:account-deleted');
        },
        onEventCreated: (callback) => {
            electron_1.ipcRenderer.on('calendar:event-created', (_, event) => callback(event));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:event-created');
        },
        onEventUpdated: (callback) => {
            electron_1.ipcRenderer.on('calendar:event-updated', (_, event) => callback(event));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:event-updated');
        },
        onEventDeleted: (callback) => {
            electron_1.ipcRenderer.on('calendar:event-deleted', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:event-deleted');
        },
        onSyncStatusUpdated: (callback) => {
            electron_1.ipcRenderer.on('calendar:sync-status-updated', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeAllListeners('calendar:sync-status-updated');
        },
        removeAllListeners: () => {
            electron_1.ipcRenderer.removeAllListeners('calendar:account-created');
            electron_1.ipcRenderer.removeAllListeners('calendar:account-updated');
            electron_1.ipcRenderer.removeAllListeners('calendar:account-deleted');
            electron_1.ipcRenderer.removeAllListeners('calendar:event-created');
            electron_1.ipcRenderer.removeAllListeners('calendar:event-updated');
            electron_1.ipcRenderer.removeAllListeners('calendar:event-deleted');
            electron_1.ipcRenderer.removeAllListeners('calendar:sync-status-updated');
        },
    },
    // System information
    system: {
        getInfo: () => electron_1.ipcRenderer.invoke('system:get-info'),
    },
    // Settings management (appSlice compatibility)
    settings: {
        get: () => electron_1.ipcRenderer.invoke('settings:get'),
        set: (key, value) => electron_1.ipcRenderer.invoke('settings:set-key', key, value),
        update: (settings) => electron_1.ipcRenderer.invoke('settings:update', settings),
    },
    // Search API (for searchSlice compatibility)
    searchAPI: {
        search: (options) => electron_1.ipcRenderer.invoke('search:perform', options),
        getSuggestions: (partialQuery, limit) => electron_1.ipcRenderer.invoke('search:get-suggestions', partialQuery, limit),
        indexDocument: (document) => electron_1.ipcRenderer.invoke('search:index-document', document),
        initialize: () => electron_1.ipcRenderer.invoke('search:initialize'),
        getAnalytics: () => electron_1.ipcRenderer.invoke('search:get-analytics'),
    },
    // Theme API (for themeSlice compatibility)  
    theme: {
        get: () => electron_1.ipcRenderer.invoke('theme:get'),
        set: (theme) => electron_1.ipcRenderer.invoke('theme:set', theme),
    },
    // Window management
    window: {
        minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
        maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
        close: () => electron_1.ipcRenderer.invoke('window:close'),
    },
    // Event handling
    on: (channel, callback) => {
        const subscription = (_event, ...args) => callback(...args);
        electron_1.ipcRenderer.on(channel, subscription);
    },
    off: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    }
};
// Expose the API to renderer
electron_1.contextBridge.exposeInMainWorld('flowDesk', flowDeskAPI);
electron_1.contextBridge.exposeInMainWorld('searchAPI', flowDeskAPI.searchAPI);
// Global type declaration is in src/types/global.d.ts
console.log('Flow Desk preload script loaded successfully!');
console.log('flowDesk API exposed to window:', !!window.flowDesk);
//# sourceMappingURL=preload.js.map