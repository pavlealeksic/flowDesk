/**
 * Flow Desk Preload Script - Final Implementation
 * 
 * Exposes secure APIs for IMAP mail, CalDAV calendar, and workspace management
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { 
  Workspace, 
  WorkspaceService, 
  MailAccount, 
  MailFolder, 
  EmailMessage, 
  CalendarAccount, 
  CalendarEvent, 
  CreateWorkspaceData,
  CreatePartitionData,
  CreateWindowData,
  GetMessagesOptions,
  EmailTemplate,
  EmailRule,
  TextSnippet,
  SearchOptions,
  APIResponse,
  SyncStatus
} from '../types/preload';

// Define the complete Flow Desk API
interface FlowDeskAPI {
  // App information
  app: {
    getVersion(): Promise<string>;
    getPlatform(): Promise<string>;
  };

  // View management
  view: {
    switch(view: 'mail' | 'calendar' | 'workspace'): Promise<void>;
    onViewChanged(callback: (view: string) => void): void;
  };

  // Workspace management - API matching Redux slice expectations  
  workspace: {
    // Core workspace operations (unified + Redux compatibility)
    getAll(): Promise<Workspace[]>;
    list(): Promise<Workspace[]>;
    getById(workspaceId: string): Promise<Workspace | null>;
    getCurrent(): Promise<Workspace | null>;
    create(workspaceData: CreateWorkspaceData): Promise<string>;
    update(workspaceId: string, updates: Partial<Workspace>): Promise<void>;
    delete(workspaceId: string): Promise<void>;
    switch(workspaceId: string): Promise<void>;
    
    // Partition management (Redux slice methods)
    listPartitions(): Promise<unknown[]>;
    createPartition(partitionData: CreatePartitionData): Promise<unknown>;
    updatePartition(partitionId: string, updates: Partial<CreatePartitionData>): Promise<unknown>;
    
    // Window management (Redux slice methods)
    getWindows(workspaceId: string): Promise<unknown[]>;
    createWindow(windowData: CreateWindowData): Promise<unknown>;
    clearData(workspaceId: string): Promise<unknown>;
    
    // Service management within workspaces
    addService(workspaceId: string, serviceName: string, serviceType: string, url: string): Promise<string>;
    updateService(workspaceId: string, serviceId: string, updates: { name?: string; url?: string; isEnabled?: boolean }): Promise<void>;
    removeService(workspaceId: string, serviceId: string): Promise<void>;
    loadService(workspaceId: string, serviceId: string): Promise<void>;
    closeService(workspaceId: string, serviceId: string): Promise<void>;
    
    // Utility methods
    getPredefinedServices(): Promise<Record<string, { name: string; url: string; type: string }>>;
  };


  // Mail (IMAP/SMTP) - API matching Redux slice expectations
  mail: {
    // Account management (Redux slice signatures)
    getAccounts(): Promise<MailAccount[]>;
    addAccount(account: Partial<MailAccount>): Promise<MailAccount>;
    updateAccount(accountId: string, updates: Partial<MailAccount>): Promise<MailAccount | null>;
    removeAccount(accountId: string): Promise<boolean>;
    
    // Folder operations
    getFolders(accountId: string): Promise<MailFolder[]>;
    
    // Message operations (Redux slice signatures)
    getMessages(accountId: string, folderId?: string, options?: GetMessagesOptions): Promise<EmailMessage[]>;
    sendMessage(accountId: string, message: Partial<EmailMessage>): Promise<boolean>;
    markMessageRead(accountId: string, messageId: string, read: boolean): Promise<boolean>;
    markMessageStarred(accountId: string, messageId: string, starred: boolean): Promise<boolean>;
    deleteMessage(accountId: string, messageId: string): Promise<boolean>;
    
    // Advanced message features
    getUnifiedMessages(limit?: number): Promise<EmailMessage[]>;
    getSmartMailboxMessages(criteria: string): Promise<EmailMessage[]>;
    getMessageThread(accountId: string, threadId: string): Promise<EmailMessage[]>;
    
    // Email scheduling
    scheduleMessage(accountId: string, message: any, scheduledDate: Date): Promise<string>;
    getScheduledMessages(accountId: string): Promise<any[]>;
    cancelScheduledMessage(accountId: string, messageId: string): Promise<boolean>;
    
    // Email aliases
    getEmailAliases(accountId: string): Promise<any[]>;
    addEmailAlias(accountId: string, address: string, name: string): Promise<any>;
    removeEmailAlias(accountId: string, aliasAddress: string): Promise<boolean>;
    
    // Search and sync
    searchMessages(query: string, options?: { accountId?: string; folderId?: string }): Promise<EmailMessage[]>;
    syncAccount(accountId: string): Promise<boolean>;
    syncAll(): Promise<void>;
    getSyncStatus(): Promise<Record<string, any>>;
    startSync(): Promise<boolean>;
    stopSync(): Promise<boolean>;
    
    
    // Real-time sync (IDLE)
    startIdle(accountId: string): Promise<boolean>;
    stopIdle(accountId: string): Promise<boolean>;
    
    // Attachment operations
    downloadAttachment(attachment: { filename: string; data: string; mimeType: string }): Promise<{ success: boolean; path?: string; error?: string }>;
    
    // Email template operations
    getAllTemplates(): Promise<any[]>;
    getTemplatesByCategory(category: string): Promise<any[]>;
    getTemplate(templateId: string): Promise<any>;
    saveTemplate(template: any): Promise<string>;
    updateTemplate(templateId: string, updates: any): Promise<boolean>;
    deleteTemplate(templateId: string): Promise<boolean>;
    useTemplate(templateId: string): Promise<any>;
    searchTemplates(query: string): Promise<any[]>;
    processTemplateVariables(template: any, variables: any): Promise<{ subject: string; body: string }>;
    
    // Email scheduling operations
    scheduleEmail(emailData: any, scheduledTime: Date): Promise<string>;
    cancelScheduledEmail(emailId: string): Promise<boolean>;
    getScheduledEmails(): Promise<any[]>;
    snoozeEmail(messageId: string, accountId: string, snoozeUntil: Date, reason: string): Promise<string>;
    getSnoozedEmails(): Promise<any[]>;
    getSchedulerStats(): Promise<any>;
    
    // Email rules operations
    getAllRules(): Promise<any[]>;
    getRulesByAccount(accountId: string): Promise<any[]>;
    createRule(ruleData: any): Promise<string>;
    updateRule(ruleId: string, updates: any): Promise<boolean>;
    deleteRule(ruleId: string): Promise<boolean>;
    testRule(ruleId: string, testMessage: any): Promise<boolean>;
    getRuleStats(): Promise<any>;
    processMessage(message: any): Promise<any>;
    
    // Text snippet operations
    getAllSnippets(): Promise<any[]>;
    getSnippetsByCategory(category: string): Promise<any[]>;
    saveSnippet(snippet: any): Promise<string>;
    updateSnippet(snippetId: string, updates: any): Promise<boolean>;
    deleteSnippet(snippetId: string): Promise<boolean>;
    useSnippet(snippetId: string): Promise<any>;
    searchSnippets(query: string): Promise<any[]>;
    getSnippetByShortcut(shortcut: string): Promise<any>;
    
    // Event callbacks for real-time updates
    onSyncStarted(callback: (data: { accountId: string }) => void): () => void;
    onSyncCompleted(callback: (data: { accountId: string; syncResult: any }) => void): () => void;
    onSyncError(callback: (data: { accountId: string; error: string }) => void): () => void;
    onNewMessages(callback: (data: { accountId: string; count: number }) => void): () => void;
  };

  // Calendar (CalDAV) - interface matching Redux slice expectations
  calendar: {
    // Account management (Redux slice methods)
    getUserAccounts(userId: string): Promise<{ success: boolean; data?: CalendarAccount[]; error?: string }>;
    createAccount(accountData: any): Promise<{ success: boolean; data?: CalendarAccount; error?: string }>;
    updateAccount(accountId: string, updates: any): Promise<{ success: boolean; data?: CalendarAccount; error?: string }>;
    deleteAccount(accountId: string): Promise<{ success: boolean; error?: string }>;
    
    // Account management (unified methods)
    getAccounts(): Promise<CalendarAccount[]>;
    addAccount(email: string, password: string, serverConfig?: any): Promise<CalendarAccount>;
    removeAccount(accountId: string): Promise<void>;
    
    // Calendar operations
    listCalendars(accountId: string): Promise<{ success: boolean; data?: Calendar[]; error?: string }>;
    getCalendars(accountId: string): Promise<Calendar[]>;
    
    // Event operations (Redux slice methods)
    getEventsInRange(calendarIds: string[], timeMin: string, timeMax: string): Promise<{ success: boolean; data?: CalendarEvent[]; error?: string }>;
    createEvent(eventData: any): Promise<{ success: boolean; data?: CalendarEvent; error?: string }>;
    updateEvent(calendarId: string, eventId: string, updates: any): Promise<{ success: boolean; data?: CalendarEvent; error?: string }>;
    deleteEvent(calendarId: string, eventId: string): Promise<{ success: boolean; error?: string }>;
    searchEvents(query: string, limit?: number): Promise<{ success: boolean; data?: CalendarEvent[]; error?: string }>;
    
    // Event operations (unified methods)
    getEvents(accountId: string, startDate: string, endDate: string): Promise<CalendarEvent[]>;
    
    // Sync operations (Redux slice methods)
    syncAccount(accountId: string, force?: boolean): Promise<{ success: boolean; data?: any; error?: string }>;
    syncAll(): Promise<void>;
    
    // Privacy sync operations
    createPrivacySyncRule(rule: any): Promise<{ success: boolean; data?: any; error?: string }>;
    executePrivacySync(accountId: string): Promise<{ success: boolean; data?: any; error?: string }>;
    
    // Event callbacks (for useCalendarSync hook)
    onAccountCreated(callback: (account: CalendarAccount) => void): () => void;
    onAccountUpdated(callback: (account: CalendarAccount) => void): () => void;
    onAccountDeleted(callback: (data: { accountId: string }) => void): () => void;
    onEventCreated(callback: (event: CalendarEvent) => void): () => void;
    onEventUpdated(callback: (event: CalendarEvent) => void): () => void;
    onEventDeleted(callback: (data: { calendarId: string; eventId: string }) => void): () => void;
    onSyncStatusUpdated(callback: (data: { accountId: string; status: any }) => void): () => void;
    removeAllListeners(): void;
  };

  // System information
  system: {
    getInfo(): Promise<{ platform: string; version: string; arch: string }>;
  };

  // Settings management (appSlice compatibility)
  settings: {
    get(): Promise<any>;
    set(key: string, value: any): Promise<boolean>; // appSlice signature
    update(settings: any): Promise<void>; // bulk update method
  };

  // Search API (for searchSlice compatibility)
  searchAPI: {
    search(options: { query: string; limit: number; offset: number }): Promise<{ success: boolean; data?: any; error?: string }>;
    getSuggestions(partialQuery: string, limit: number): Promise<{ success: boolean; data?: any; error?: string }>;
    indexDocument(document: any): Promise<{ success: boolean; error?: string }>;
    initialize(): Promise<{ success: boolean; error?: string }>;
    getAnalytics(): Promise<{ success: boolean; data?: any; error?: string }>;
  };

  // Theme API (for themeSlice compatibility)
  theme: {
    get(): Promise<any>;
    set(theme: any): Promise<any>;
  };

  // Simple Mail API (Apple Mail style)
  simpleMail: {
    initEngine(): Promise<string>;
    detectEmailProvider(email: string): Promise<{ name: string; displayName: string; supported: boolean } | null>;
    testConnection(email: string, password: string): Promise<boolean>;
    addAccount(input: { email: string; password: string; displayName?: string }): Promise<any>;
    getAccounts(): Promise<any[]>;
    getAccount(accountId: string): Promise<any | null>;
    removeAccount(accountId: string): Promise<void>;
    updateAccountStatus(accountId: string, isEnabled: boolean): Promise<void>;
    fetchMessages(accountId: string, folder?: string): Promise<any[]>;
    sendEmail(accountId: string, to: string[], subject: string, body: string, isHtml?: boolean): Promise<void>;
    syncAccount(accountId: string): Promise<any>;
    getSupportedProviders(): Promise<any[]>;
    validateEmailAddress(email: string): Promise<boolean>;
  };

  // Production Email API - Professional IMAP/SMTP with Rust backend
  productionEmail: {
    // Account Management
    setupAccount(userId: string, credentials: { email: string; password: string; displayName?: string; providerOverride?: string }): Promise<any>;
    removeAccount(accountId: string): Promise<void>;
    updateAccountPassword(accountId: string, newPassword: string): Promise<void>;
    getStoredAccounts(): Promise<string[]>;
    testEmailSetup(credentials: { email: string; password: string; displayName?: string; providerOverride?: string }): Promise<any>;
    
    // Server Configuration
    getServerConfig(email: string): Promise<any>;
    
    // Email Operations
    syncAccount(accountId: string): Promise<any>;
    sendEmail(accountId: string, message: any): Promise<void>;
    getFolders(accountId: string): Promise<any[]>;
    getMessages(accountId: string, folderName: string, limit?: number): Promise<any[]>;
    markMessageRead(accountId: string, folderName: string, messageUid: number, isRead: boolean): Promise<void>;
    deleteMessage(accountId: string, folderName: string, messageUid: number): Promise<void>;
    
    // System Operations
    getHealthStatus(): Promise<Record<string, [boolean, boolean]>>;
    closeConnections(accountId: string): Promise<void>;
  };

  // AI Engine API
  ai?: {
    initialize(cacheDir?: string): Promise<void>;
    storeApiKey(provider: string, apiKey: string): Promise<void>;
    hasApiKey(provider: string): Promise<boolean>;
    deleteApiKey(provider: string): Promise<boolean>;
    createCompletion(request: any): Promise<any>;
    createStreamingCompletion(request: any, callback: (chunk: any) => void): Promise<void>;
    getAvailableModels(): Promise<any[]>;
    healthCheck(): Promise<boolean>;
    getUsageStats(): Promise<any>;
    getRateLimitInfo(provider: string): Promise<any>;
    clearCache(operationType?: string): Promise<void>;
    getCacheStats(): Promise<Record<string, any>>;
    testProvider(provider: string): Promise<boolean>;
  };

  // Window management
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
  };

  // Event listeners
  on(channel: string, callback: (...args: unknown[]) => void): void;
  off(channel: string, callback: (...args: unknown[]) => void): void;
}

// Import the EmailAttachment and Calendar types locally if needed
interface EmailAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  isInline: boolean;
  contentId?: string;
  data?: string;
}

interface Calendar {
  id: string;
  accountId: string;
  name: string;
  color: string;
  isPrimary: boolean;
  isWritable: boolean;
}

// Implement the Flow Desk API
const flowDeskAPI: FlowDeskAPI = {
  // App information
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  },

  // View management
  view: {
    switch: (view: 'mail' | 'calendar' | 'workspace') => ipcRenderer.invoke('view:switch', view),
    onViewChanged: (callback: (view: string) => void) => {
      ipcRenderer.on('view-changed', (_, view) => callback(view));
    },
  },

  // Workspace management - implementation matching Redux slice expectations
  workspace: {
    // Core workspace operations (unified methods)
    getAll: () => ipcRenderer.invoke('workspace:get-all'),
    getById: (workspaceId: string) => ipcRenderer.invoke('workspace:get-by-id', workspaceId),
    getCurrent: () => ipcRenderer.invoke('workspace:get-active'),
    create: (workspaceData: { name: string; icon?: string; color?: string; browserIsolation?: 'shared' | 'isolated' }) => ipcRenderer.invoke('workspace:create-full', workspaceData),
    update: (workspaceId: string, updates: Partial<{ name: string; icon: string; color: string; browserIsolation: 'shared' | 'isolated' }>) => ipcRenderer.invoke('workspace:update', workspaceId, updates),
    delete: (workspaceId: string) => ipcRenderer.invoke('workspace:delete', workspaceId),
    switch: (workspaceId: string) => ipcRenderer.invoke('workspace:switch', workspaceId),
    
    // Redux slice compatibility methods
    list: () => ipcRenderer.invoke('workspace:get-all'),
    listPartitions: () => ipcRenderer.invoke('workspace:list-partitions'),
    createPartition: (partitionData: CreatePartitionData) => ipcRenderer.invoke('workspace:create-partition', partitionData),
    updatePartition: (partitionId: string, updates: Partial<CreatePartitionData>) => ipcRenderer.invoke('workspace:update-partition', partitionId, updates),
    clearData: (workspaceId: string) => ipcRenderer.invoke('workspace:clear-data', workspaceId),
    getWindows: (workspaceId: string) => ipcRenderer.invoke('workspace:get-windows', workspaceId),
    createWindow: (windowData: CreateWindowData) => ipcRenderer.invoke('workspace:create-window', windowData),
    
    // Service management within workspaces
    addService: (workspaceId: string, serviceName: string, serviceType: string, url: string) => 
      ipcRenderer.invoke('workspace:add-service', workspaceId, serviceName, serviceType, url),
    updateService: (workspaceId: string, serviceId: string, updates: { name?: string; url?: string; isEnabled?: boolean }) => 
      ipcRenderer.invoke('workspace:update-service', workspaceId, serviceId, updates),
    removeService: (workspaceId: string, serviceId: string) => 
      ipcRenderer.invoke('workspace:remove-service', workspaceId, serviceId),
    loadService: (workspaceId: string, serviceId: string) => 
      ipcRenderer.invoke('workspace:load-service', workspaceId, serviceId),
    closeService: (workspaceId: string, serviceId: string) => 
      ipcRenderer.invoke('workspace:close-service', workspaceId, serviceId),
    
    // Utility methods
    getPredefinedServices: () => ipcRenderer.invoke('workspace:get-predefined-services'),
  },


  // Mail (IMAP/SMTP) - implementation matching Redux slice expectations
  mail: {
    // Account management (exact Redux signatures)
    getAccounts: () => ipcRenderer.invoke('mail:get-accounts'),
    addAccount: (account: { email: string; name: string; provider: string; config?: Record<string, unknown> }) => 
      ipcRenderer.invoke('mail:add-account-obj', account),
    updateAccount: (accountId: string, updates: Partial<MailAccount>) => 
      ipcRenderer.invoke('mail:update-account', accountId, updates),
    removeAccount: (accountId: string) => 
      ipcRenderer.invoke('mail:remove-account', accountId),
    
    // Folder operations
    getFolders: (accountId: string) => 
      ipcRenderer.invoke('mail:get-folders', accountId),
    
    // Message operations (exact Redux signatures)
    getMessages: (accountId: string, folderId?: string, options?: { limit?: number; offset?: number }) => 
      ipcRenderer.invoke('mail:get-messages', accountId, folderId, options),
    sendMessage: (accountId: string, message: any) => 
      ipcRenderer.invoke('mail:send-message-obj', accountId, message),
    markMessageRead: (accountId: string, messageId: string, read: boolean) => 
      ipcRenderer.invoke('mail:mark-message-read', accountId, messageId, read),
    markMessageStarred: (accountId: string, messageId: string, starred: boolean) => 
      ipcRenderer.invoke('mail:mark-message-starred', accountId, messageId, starred),
    deleteMessage: (accountId: string, messageId: string) => 
      ipcRenderer.invoke('mail:delete-message', accountId, messageId),
    
    // Advanced message features
    getUnifiedMessages: (limit?: number) => 
      ipcRenderer.invoke('mail:get-unified-messages', limit),
    getSmartMailboxMessages: (criteria: string) => 
      ipcRenderer.invoke('mail:get-smart-mailbox-messages', criteria),
    getMessageThread: (accountId: string, threadId: string) => 
      ipcRenderer.invoke('mail:get-message-thread', accountId, threadId),
    
    // Email scheduling
    scheduleMessage: (accountId: string, message: any, scheduledDate: Date) => 
      ipcRenderer.invoke('mail:schedule-message', accountId, message, scheduledDate),
    getScheduledMessages: (accountId: string) => 
      ipcRenderer.invoke('mail:get-scheduled-messages', accountId),
    cancelScheduledMessage: (accountId: string, messageId: string) => 
      ipcRenderer.invoke('mail:cancel-scheduled-message', accountId, messageId),
    
    // Email aliases
    getEmailAliases: (accountId: string) => 
      ipcRenderer.invoke('mail:get-email-aliases', accountId),
    addEmailAlias: (accountId: string, address: string, name: string) => 
      ipcRenderer.invoke('mail:add-email-alias', accountId, address, name),
    removeEmailAlias: (accountId: string, aliasAddress: string) => 
      ipcRenderer.invoke('mail:remove-email-alias', accountId, aliasAddress),
    
    // Search and sync (exact Redux signatures)
    searchMessages: (query: string, options?: any) => 
      ipcRenderer.invoke('mail:search-messages', query, options),
    syncAccount: (accountId: string) => 
      ipcRenderer.invoke('mail:sync-account', accountId),
    syncAll: () => 
      ipcRenderer.invoke('mail:sync-all'),
    getSyncStatus: () => 
      ipcRenderer.invoke('mail:get-sync-status'),
    startSync: () => 
      ipcRenderer.invoke('mail:start-sync'),
    stopSync: () => 
      ipcRenderer.invoke('mail:stop-sync'),
    
    
    // Real-time sync (IDLE)
    startIdle: (accountId: string) => 
      ipcRenderer.invoke('mail:start-idle', accountId),
    stopIdle: (accountId: string) => 
      ipcRenderer.invoke('mail:stop-idle', accountId),
    
    // Attachment operations
    downloadAttachment: (attachment: { filename: string; data: string; mimeType: string }) => 
      ipcRenderer.invoke('mail:download-attachment', attachment),
    
    // Email template operations
    getAllTemplates: () => ipcRenderer.invoke('email-templates:get-all'),
    getTemplatesByCategory: (category: string) => ipcRenderer.invoke('email-templates:get-by-category', category),
    getTemplate: (templateId: string) => ipcRenderer.invoke('email-templates:get', templateId),
    saveTemplate: (template: any) => ipcRenderer.invoke('email-templates:save', template),
    updateTemplate: (templateId: string, updates: any) => ipcRenderer.invoke('email-templates:update', templateId, updates),
    deleteTemplate: (templateId: string) => ipcRenderer.invoke('email-templates:delete', templateId),
    useTemplate: (templateId: string) => ipcRenderer.invoke('email-templates:use', templateId),
    searchTemplates: (query: string) => ipcRenderer.invoke('email-templates:search', query),
    processTemplateVariables: (template: any, variables: any) => ipcRenderer.invoke('email-templates:process-variables', template, variables),
    
    // Email scheduling operations (using correct IPC handler names)
    scheduleEmail: (emailData: any, scheduledTime: Date) => ipcRenderer.invoke('email-scheduler:schedule', emailData, scheduledTime),
    cancelScheduledEmail: (emailId: string) => ipcRenderer.invoke('email-scheduler:cancel', emailId),
    getScheduledEmails: () => ipcRenderer.invoke('email-scheduler:get-scheduled'),
    snoozeEmail: (messageId: string, accountId: string, snoozeUntil: Date, reason: string) => 
      ipcRenderer.invoke('email-scheduler:snooze', messageId, accountId, snoozeUntil, reason),
    getSnoozedEmails: () => ipcRenderer.invoke('email-scheduler:get-snoozed'),
    getSchedulerStats: () => ipcRenderer.invoke('email-scheduler:get-stats'),
    
    // Email rules operations
    getAllRules: () => ipcRenderer.invoke('email-rules:get-all'),
    getRulesByAccount: (accountId: string) => ipcRenderer.invoke('email-rules:get-by-account', accountId),
    createRule: (ruleData: any) => ipcRenderer.invoke('email-rules:create', ruleData),
    updateRule: (ruleId: string, updates: any) => ipcRenderer.invoke('email-rules:update', ruleId, updates),
    deleteRule: (ruleId: string) => ipcRenderer.invoke('email-rules:delete', ruleId),
    testRule: (ruleId: string, testMessage: any) => ipcRenderer.invoke('email-rules:test', ruleId, testMessage),
    getRuleStats: () => ipcRenderer.invoke('email-rules:get-stats'),
    processMessage: (message: any) => ipcRenderer.invoke('email-rules:process-message', message),
    
    // Text snippet operations
    getAllSnippets: () => ipcRenderer.invoke('snippets:get-all'),
    getSnippetsByCategory: (category: string) => ipcRenderer.invoke('snippets:get-by-category', category),
    saveSnippet: (snippet: any) => ipcRenderer.invoke('snippets:save', snippet),
    updateSnippet: (snippetId: string, updates: any) => ipcRenderer.invoke('snippets:update', snippetId, updates),
    deleteSnippet: (snippetId: string) => ipcRenderer.invoke('snippets:delete', snippetId),
    useSnippet: (snippetId: string) => ipcRenderer.invoke('snippets:use', snippetId),
    searchSnippets: (query: string) => ipcRenderer.invoke('snippets:search', query),
    getSnippetByShortcut: (shortcut: string) => ipcRenderer.invoke('snippets:get-by-shortcut', shortcut),
    
    // Event callbacks for real-time updates
    onSyncStarted: (callback: (data: { accountId: string }) => void) => {
      ipcRenderer.on('mail:sync-started', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mail:sync-started');
    },
    onSyncCompleted: (callback: (data: { accountId: string; syncResult: any }) => void) => {
      ipcRenderer.on('mail:sync-completed', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mail:sync-completed');
    },
    onSyncError: (callback: (data: { accountId: string; error: string }) => void) => {
      ipcRenderer.on('mail:sync-error', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mail:sync-error');
    },
    onNewMessages: (callback: (data: { accountId: string; count: number }) => void) => {
      ipcRenderer.on('mail:new-messages', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mail:new-messages');
    },
  },

  // Calendar (CalDAV) - implementation matching Redux slice expectations
  calendar: {
    // Account management (Redux slice compatibility)
    getUserAccounts: (userId: string) => 
      ipcRenderer.invoke('calendar:get-user-accounts', userId),
    getAccounts: () => 
      ipcRenderer.invoke('calendar:get-accounts'),
    createAccount: (accountData: any) => 
      ipcRenderer.invoke('calendar:create-account', accountData),
    addAccount: (email: string, password: string, serverConfig?: any) => 
      ipcRenderer.invoke('calendar:add-account', email, password, serverConfig),
    updateAccount: (accountId: string, updates: any) => 
      ipcRenderer.invoke('calendar:update-account', accountId, updates),
    deleteAccount: (accountId: string) => 
      ipcRenderer.invoke('calendar:delete-account', accountId),
    removeAccount: (accountId: string) => 
      ipcRenderer.invoke('calendar:remove-account', accountId),
    
    // Calendar operations
    listCalendars: (accountId: string) => 
      ipcRenderer.invoke('calendar:list-calendars', accountId),
    getCalendars: (accountId: string) => 
      ipcRenderer.invoke('calendar:get-calendars', accountId),
    
    // Event operations (Redux slice compatibility)
    getEventsInRange: (calendarIds: string[], timeMin: string, timeMax: string) => 
      ipcRenderer.invoke('calendar:get-events-in-range', calendarIds, timeMin, timeMax),
    getEvents: (accountId: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('calendar:get-events', accountId, startDate, endDate),
    createEvent: (eventData: any) => 
      ipcRenderer.invoke('calendar:create-event-full', eventData),
    updateEvent: (calendarId: string, eventId: string, updates: any) => 
      ipcRenderer.invoke('calendar:update-event-full', calendarId, eventId, updates),
    deleteEvent: (calendarId: string, eventId: string) => 
      ipcRenderer.invoke('calendar:delete-event-full', calendarId, eventId),
    
    // Search operations
    searchEvents: (query: string, limit?: number) => 
      ipcRenderer.invoke('calendar:search-events', query, limit),
    
    // Sync operations (Redux slice compatibility)
    syncAccount: (accountId: string, force?: boolean) => 
      ipcRenderer.invoke('calendar:sync-account-full', accountId, force),
    syncAll: () => 
      ipcRenderer.invoke('calendar:sync-all'),
    
    // Privacy sync operations
    createPrivacySyncRule: (rule: any) =>
      ipcRenderer.invoke('calendar:create-privacy-sync-rule', rule),
    executePrivacySync: (accountId: string) =>
      ipcRenderer.invoke('calendar:execute-privacy-sync', accountId),
    
    // Event callbacks (for useCalendarSync hook)
    onAccountCreated: (callback: (account: CalendarAccount) => void) => {
      ipcRenderer.on('calendar:account-created', (_, account) => callback(account));
      return () => ipcRenderer.removeAllListeners('calendar:account-created');
    },
    onAccountUpdated: (callback: (account: CalendarAccount) => void) => {
      ipcRenderer.on('calendar:account-updated', (_, account) => callback(account));
      return () => ipcRenderer.removeAllListeners('calendar:account-updated');
    },
    onAccountDeleted: (callback: (data: { accountId: string }) => void) => {
      ipcRenderer.on('calendar:account-deleted', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('calendar:account-deleted');
    },
    onEventCreated: (callback: (event: CalendarEvent) => void) => {
      ipcRenderer.on('calendar:event-created', (_, event) => callback(event));
      return () => ipcRenderer.removeAllListeners('calendar:event-created');
    },
    onEventUpdated: (callback: (event: CalendarEvent) => void) => {
      ipcRenderer.on('calendar:event-updated', (_, event) => callback(event));
      return () => ipcRenderer.removeAllListeners('calendar:event-updated');
    },
    onEventDeleted: (callback: (data: { calendarId: string; eventId: string }) => void) => {
      ipcRenderer.on('calendar:event-deleted', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('calendar:event-deleted');
    },
    onSyncStatusUpdated: (callback: (data: { accountId: string; status: any }) => void) => {
      ipcRenderer.on('calendar:sync-status-updated', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('calendar:sync-status-updated');
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('calendar:account-created');
      ipcRenderer.removeAllListeners('calendar:account-updated');
      ipcRenderer.removeAllListeners('calendar:account-deleted');
      ipcRenderer.removeAllListeners('calendar:event-created');
      ipcRenderer.removeAllListeners('calendar:event-updated');
      ipcRenderer.removeAllListeners('calendar:event-deleted');
      ipcRenderer.removeAllListeners('calendar:sync-status-updated');
    },
  },

  // System information
  system: {
    getInfo: () => ipcRenderer.invoke('system:get-info'),
  },

  // Settings management (appSlice compatibility)
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set-key', key, value),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  },

  // Search API (for searchSlice compatibility)
  searchAPI: {
    search: (options: { query: string; limit: number; offset: number }) => 
      ipcRenderer.invoke('search:perform', options),
    getSuggestions: (partialQuery: string, limit: number) => 
      ipcRenderer.invoke('search:get-suggestions', partialQuery, limit),
    indexDocument: (document: any) => 
      ipcRenderer.invoke('search:index-document', document),
    initialize: () => 
      ipcRenderer.invoke('search:initialize'),
    getAnalytics: () => 
      ipcRenderer.invoke('search:get-analytics'),
  },

  // Theme API (for themeSlice compatibility)  
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme: any) => ipcRenderer.invoke('theme:set', theme),
  },

  // Simple Mail API (Apple Mail style)
  simpleMail: {
    initEngine: () => ipcRenderer.invoke('simple-mail:init-engine'),
    detectEmailProvider: (email: string) => ipcRenderer.invoke('simple-mail:detect-provider', email),
    testConnection: (email: string, password: string) => ipcRenderer.invoke('simple-mail:test-connection', email, password),
    addAccount: (input: { email: string; password: string; displayName?: string }) => 
      ipcRenderer.invoke('simple-mail:add-account', input),
    getAccounts: () => ipcRenderer.invoke('simple-mail:get-accounts'),
    getAccount: (accountId: string) => ipcRenderer.invoke('simple-mail:get-account', accountId),
    removeAccount: (accountId: string) => ipcRenderer.invoke('simple-mail:remove-account', accountId),
    updateAccountStatus: (accountId: string, isEnabled: boolean) => 
      ipcRenderer.invoke('simple-mail:update-account-status', accountId, isEnabled),
    fetchMessages: (accountId: string, folder?: string) => 
      ipcRenderer.invoke('simple-mail:fetch-messages', accountId, folder),
    sendEmail: (accountId: string, to: string[], subject: string, body: string, isHtml?: boolean) =>
      ipcRenderer.invoke('simple-mail:send-email', accountId, to, subject, body, isHtml),
    syncAccount: (accountId: string) => ipcRenderer.invoke('simple-mail:sync-account', accountId),
    getSupportedProviders: () => ipcRenderer.invoke('simple-mail:get-supported-providers'),
    validateEmailAddress: (email: string) => ipcRenderer.invoke('simple-mail:validate-email', email),
  },

  // Production Email API - Professional IMAP/SMTP with Rust backend
  productionEmail: {
    // Account Management
    setupAccount: (userId: string, credentials: { email: string; password: string; displayName?: string; providerOverride?: string }) =>
      ipcRenderer.invoke('email:setup-account', userId, credentials),
    removeAccount: (accountId: string) =>
      ipcRenderer.invoke('email:remove-account', accountId),
    updateAccountPassword: (accountId: string, newPassword: string) =>
      ipcRenderer.invoke('email:update-password', accountId, newPassword),
    getStoredAccounts: () =>
      ipcRenderer.invoke('email:get-stored-accounts'),
    testEmailSetup: (credentials: { email: string; password: string; displayName?: string; providerOverride?: string }) =>
      ipcRenderer.invoke('email:test-setup', credentials),
    
    // Server Configuration
    getServerConfig: (email: string) =>
      ipcRenderer.invoke('email:get-server-config', email),
    
    // Email Operations
    syncAccount: (accountId: string) =>
      ipcRenderer.invoke('email:sync-account', accountId),
    sendEmail: (accountId: string, message: any) =>
      ipcRenderer.invoke('email:send', accountId, message),
    getFolders: (accountId: string) =>
      ipcRenderer.invoke('email:get-folders', accountId),
    getMessages: (accountId: string, folderName: string, limit?: number) =>
      ipcRenderer.invoke('email:get-messages', accountId, folderName, limit),
    markMessageRead: (accountId: string, folderName: string, messageUid: number, isRead: boolean) =>
      ipcRenderer.invoke('email:mark-read', accountId, folderName, messageUid, isRead),
    deleteMessage: (accountId: string, folderName: string, messageUid: number) =>
      ipcRenderer.invoke('email:delete-message', accountId, folderName, messageUid),
    
    // System Operations
    getHealthStatus: () =>
      ipcRenderer.invoke('email:health-check'),
    closeConnections: (accountId: string) =>
      ipcRenderer.invoke('email:close-connections', accountId),
  },

  // AI Engine API (optional - will only be available if implemented in main process)
  ai: {
    initialize: (cacheDir?: string) => ipcRenderer.invoke('ai:initialize', cacheDir),
    storeApiKey: (provider: string, apiKey: string) => ipcRenderer.invoke('ai:store-api-key', provider, apiKey),
    hasApiKey: (provider: string) => ipcRenderer.invoke('ai:has-api-key', provider),
    deleteApiKey: (provider: string) => ipcRenderer.invoke('ai:delete-api-key', provider),
    createCompletion: (request: any) => ipcRenderer.invoke('ai:create-completion', request),
    createStreamingCompletion: (request: any, callback: (chunk: any) => void) => {
      // For streaming, we need to handle it differently - register a listener and then invoke
      const streamChannel = `ai:streaming-completion-${Date.now()}`;
      ipcRenderer.on(streamChannel, (_, chunk) => callback(chunk));
      return ipcRenderer.invoke('ai:create-streaming-completion', request, streamChannel);
    },
    getAvailableModels: () => ipcRenderer.invoke('ai:get-available-models'),
    healthCheck: () => ipcRenderer.invoke('ai:health-check'),
    getUsageStats: () => ipcRenderer.invoke('ai:get-usage-stats'),
    getRateLimitInfo: (provider: string) => ipcRenderer.invoke('ai:get-rate-limit-info', provider),
    clearCache: (operationType?: string) => ipcRenderer.invoke('ai:clear-cache', operationType),
    getCacheStats: () => ipcRenderer.invoke('ai:get-cache-stats'),
    testProvider: (provider: string) => ipcRenderer.invoke('ai:test-provider', provider),
  },

  // Window management
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Event handling
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
  },

  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  }
};

// Expose the API to renderer
contextBridge.exposeInMainWorld('flowDesk', flowDeskAPI);
contextBridge.exposeInMainWorld('searchAPI', flowDeskAPI.searchAPI);

// Global type declaration is in src/types/global.d.ts

console.log('Flow Desk preload script loaded successfully!');
console.log('flowDesk API exposed to window:', !!window.flowDesk);

export type { 
  FlowDeskAPI, 
  Workspace, 
  WorkspaceService, 
  MailAccount, 
  MailFolder, 
  EmailMessage, 
  CalendarAccount, 
  CalendarEvent 
};