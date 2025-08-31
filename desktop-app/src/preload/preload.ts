/**
 * Flow Desk Preload Script - Final Implementation
 * 
 * Exposes secure APIs for IMAP mail, CalDAV calendar, and workspace management
 */

import { contextBridge, ipcRenderer } from 'electron';

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
    create(workspaceData: any): Promise<string>;
    update(workspaceId: string, updates: any): Promise<void>;
    delete(workspaceId: string): Promise<void>;
    switch(workspaceId: string): Promise<void>;
    
    // Partition management (Redux slice methods)
    listPartitions(): Promise<any[]>;
    createPartition(partitionData: any): Promise<any>;
    updatePartition(partitionId: string, updates: any): Promise<any>;
    
    // Window management (Redux slice methods)
    getWindows(workspaceId: string): Promise<any[]>;
    createWindow(windowData: any): Promise<any>;
    clearData(workspaceId: string): Promise<any>;
    
    // Service management within workspaces
    addService(workspaceId: string, serviceName: string, serviceType: string, url: string): Promise<string>;
    updateService(workspaceId: string, serviceId: string, updates: { name?: string; url?: string; isEnabled?: boolean }): Promise<void>;
    removeService(workspaceId: string, serviceId: string): Promise<void>;
    loadService(workspaceId: string, serviceId: string): Promise<void>;
    
    // Utility methods
    getPredefinedServices(): Promise<Record<string, { name: string; url: string; type: string }>>;
  };


  // Mail (IMAP/SMTP) - API matching Redux slice expectations
  mail: {
    // Account management (Redux slice signatures)
    getAccounts(): Promise<MailAccount[]>;
    addAccount(account: any): Promise<MailAccount>;
    updateAccount(accountId: string, updates: any): Promise<MailAccount | null>;
    removeAccount(accountId: string): Promise<boolean>;
    
    // Folder operations
    getFolders(accountId: string): Promise<MailFolder[]>;
    
    // Message operations (Redux slice signatures)
    getMessages(accountId: string, folderId?: string, options?: any): Promise<EmailMessage[]>;
    sendMessage(accountId: string, message: any): Promise<boolean>;
    markMessageRead(accountId: string, messageId: string, read: boolean): Promise<boolean>;
    deleteMessage(accountId: string, messageId: string): Promise<boolean>;
    
    // Search and sync
    searchMessages(query: string, options?: { accountId?: string; folderId?: string }): Promise<EmailMessage[]>;
    syncAccount(accountId: string): Promise<boolean>;
    syncAll(): Promise<void>;
    getSyncStatus(): Promise<Record<string, any>>;
    startSync(): Promise<boolean>;
    stopSync(): Promise<boolean>;
    
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

  // Window management
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
  };

  // Event listeners
  on(channel: string, callback: (...args: any[]) => void): void;
  off(channel: string, callback: (...args: any[]) => void): void;
}

// Type definitions for the renderer
interface Workspace {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  services: WorkspaceService[];
  created: Date;
  lastAccessed: Date;
  isActive: boolean;
}

interface WorkspaceService {
  id: string;
  name: string;
  type: string;
  url: string;
  iconUrl?: string;
  isEnabled: boolean;
  config: any;
}

interface MailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  isEnabled: boolean;
}

interface MailFolder {
  id: string;
  name: string;
  unreadCount: number;
  type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'custom';
}

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  isRead: boolean;
  isStarred: boolean;
  preview: string;
}

interface CalendarAccount {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  isEnabled: boolean;
}

interface Calendar {
  id: string;
  accountId: string;
  name: string;
  color: string;
  isPrimary: boolean;
  isWritable: boolean;
}

interface CalendarEvent {
  id: string;
  calendarId: string; // Required by Redux slices
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees: string[];
  isAllDay: boolean;
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
    create: (workspaceData: any) => ipcRenderer.invoke('workspace:create-full', workspaceData),
    update: (workspaceId: string, updates: any) => ipcRenderer.invoke('workspace:update', workspaceId, updates),
    delete: (workspaceId: string) => ipcRenderer.invoke('workspace:delete', workspaceId),
    switch: (workspaceId: string) => ipcRenderer.invoke('workspace:switch', workspaceId),
    
    // Redux slice compatibility methods
    list: () => ipcRenderer.invoke('workspace:get-all'),
    listPartitions: () => ipcRenderer.invoke('workspace:list-partitions'),
    createPartition: (partitionData: any) => ipcRenderer.invoke('workspace:create-partition', partitionData),
    updatePartition: (partitionId: string, updates: any) => ipcRenderer.invoke('workspace:update-partition', partitionId, updates),
    clearData: (workspaceId: string) => ipcRenderer.invoke('workspace:clear-data', workspaceId),
    getWindows: (workspaceId: string) => ipcRenderer.invoke('workspace:get-windows', workspaceId),
    createWindow: (windowData: any) => ipcRenderer.invoke('workspace:create-window', windowData),
    
    // Service management within workspaces
    addService: (workspaceId: string, serviceName: string, serviceType: string, url: string) => 
      ipcRenderer.invoke('workspace:add-service', workspaceId, serviceName, serviceType, url),
    updateService: (workspaceId: string, serviceId: string, updates: { name?: string; url?: string; isEnabled?: boolean }) => 
      ipcRenderer.invoke('workspace:update-service', workspaceId, serviceId, updates),
    removeService: (workspaceId: string, serviceId: string) => 
      ipcRenderer.invoke('workspace:remove-service', workspaceId, serviceId),
    loadService: (workspaceId: string, serviceId: string) => 
      ipcRenderer.invoke('workspace:load-service', workspaceId, serviceId),
    
    // Utility methods
    getPredefinedServices: () => ipcRenderer.invoke('workspace:get-predefined-services'),
  },


  // Mail (IMAP/SMTP) - implementation matching Redux slice expectations
  mail: {
    // Account management (exact Redux signatures)
    getAccounts: () => ipcRenderer.invoke('mail:get-accounts'),
    addAccount: (account: any) => 
      ipcRenderer.invoke('mail:add-account-obj', account),
    updateAccount: (accountId: string, updates: any) => 
      ipcRenderer.invoke('mail:update-account', accountId, updates),
    removeAccount: (accountId: string) => 
      ipcRenderer.invoke('mail:remove-account', accountId),
    
    // Folder operations
    getFolders: (accountId: string) => 
      ipcRenderer.invoke('mail:get-folders', accountId),
    
    // Message operations (exact Redux signatures)
    getMessages: (accountId: string, folderId?: string, options?: any) => 
      ipcRenderer.invoke('mail:get-messages', accountId, folderId, options),
    sendMessage: (accountId: string, message: any) => 
      ipcRenderer.invoke('mail:send-message-obj', accountId, message),
    markMessageRead: (accountId: string, messageId: string, read: boolean) => 
      ipcRenderer.invoke('mail:mark-message-read', accountId, messageId, read),
    deleteMessage: (accountId: string, messageId: string) => 
      ipcRenderer.invoke('mail:delete-message', accountId, messageId),
    
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

  // Window management
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Event handling
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  }
};

// Expose the API to renderer
contextBridge.exposeInMainWorld('flowDesk', flowDeskAPI);
contextBridge.exposeInMainWorld('searchAPI', flowDeskAPI.searchAPI);

// Add global type declaration for TypeScript
declare global {
  interface Window {
    flowDesk: FlowDeskAPI;
    searchAPI: FlowDeskAPI['searchAPI'];
  }
}

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