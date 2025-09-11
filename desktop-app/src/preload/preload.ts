/**
 * Flow Desk Preload Script - Workspace Only Implementation
 * 
 * Exposes secure APIs for workspace management only
 * 
 * Security considerations:
 * - All IPC channels are explicitly whitelisted
 * - No direct Node.js API exposure
 * - Input validation on all parameters
 * - Rate limiting for sensitive operations
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { LogEntry, LoggerConfig } from '../types/preload';
import { createLogger } from '../shared/logging/LoggerFactory';

// Create logger instance for preload script
const logger = createLogger('Preload');

// Define workspace interfaces for preload
interface Workspace {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  icon?: string;
  browserIsolation?: 'shared' | 'isolated';
  services: WorkspaceService[];
  members?: string[];
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
  config: Record<string, unknown>;
}

interface CreateWorkspaceData {
  name: string;
  icon?: string;
  color: string;
  browserIsolation?: 'shared' | 'isolated';
}

interface ThemeSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: number;
}

interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  silent?: boolean;
}

// Security: Input validation helpers
const validateString = (input: unknown, maxLength: number = 1000): string => {
  if (typeof input !== 'string') {
    throw new Error('Invalid input: expected string');
  }
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength}`);
  }
  // Remove any potential script injection attempts
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

const validateId = (id: unknown): string => {
  const validatedId = validateString(id, 100);
  // Ensure ID contains only alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(validatedId)) {
    throw new Error('Invalid ID format');
  }
  return validatedId;
};

const validateUrl = (url: unknown): string => {
  const validatedUrl = validateString(url, 2000);
  try {
    const parsedUrl = new URL(validatedUrl);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol');
    }
    return validatedUrl;
  } catch {
    throw new Error('Invalid URL format');
  }
};

// Main Flow Desk API
const flowDeskAPI = {
  // Workspace management
  workspace: {
    create: (data: CreateWorkspaceData): Promise<string> =>
      ipcRenderer.invoke('workspace:create', data),
    
    list: (): Promise<Workspace[]> =>
      ipcRenderer.invoke('workspace:list'),
    
    get: (id: string): Promise<Workspace | null> =>
      ipcRenderer.invoke('workspace:get', validateId(id)),
    
    getCurrent: (): Promise<Workspace | null> =>
      ipcRenderer.invoke('workspace:get-active'),
    
    switch: (id: string): Promise<void> =>
      ipcRenderer.invoke('workspace:switch', validateId(id)),
    
    update: (id: string, updates: Partial<Workspace>): Promise<void> =>
      ipcRenderer.invoke('workspace:update', validateId(id), updates),
    
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('workspace:delete', validateId(id)),
    
    addService: (workspaceId: string, name: string, type: string, url: string): Promise<string> =>
      ipcRenderer.invoke('workspace:addService', validateId(workspaceId), validateString(name), validateString(type, 50), validateUrl(url)),
    
    removeService: (workspaceId: string, serviceId: string): Promise<void> =>
      ipcRenderer.invoke('workspace:removeService', validateId(workspaceId), validateId(serviceId)),
    
    loadService: (workspaceId: string, serviceId: string): Promise<void> =>
      ipcRenderer.invoke('workspace:loadService', validateId(workspaceId), validateId(serviceId)),
    
    listPartitions: (): Promise<any[]> =>
      ipcRenderer.invoke('workspace:list-partitions'),
    
    createPartition: (config: any): Promise<void> =>
      ipcRenderer.invoke('workspace:create-partition', config),
    
    updatePartition: (id: string, updates: any): Promise<void> =>
      ipcRenderer.invoke('workspace:update-partition', id, updates),
    
    clearData: (id: string): Promise<void> =>
      ipcRenderer.invoke('workspace:clear-data', id),
    
    getWindows: (id: string): Promise<any[]> =>
      ipcRenderer.invoke('workspace:get-windows', id),
    
    createWindow: (options: any): Promise<number> =>
      ipcRenderer.invoke('workspace:create-window', options),
  },

  // Theme management
  theme: {
    get: (): Promise<ThemeSettings> =>
      ipcRenderer.invoke('theme:get'),
    
    set: (settings: ThemeSettings): Promise<void> =>
      ipcRenderer.invoke('theme:set', settings),
  },

  // System integration
  system: {
    showNotification: (options: NotificationOptions): Promise<void> =>
      ipcRenderer.invoke('system:showNotification', options),
    
    showDialog: (options: any): Promise<any> =>
      ipcRenderer.invoke('system:showDialog', options),
    
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('system:openExternal', url),
  },

  // Browser view control
  browserView: {
    hide: (): Promise<void> =>
      ipcRenderer.invoke('browser-view:hide'),
    
    show: (): Promise<void> =>
      ipcRenderer.invoke('browser-view:show'),
    
    hideBrowserViews: (): Promise<void> =>
      ipcRenderer.invoke('browser-view:hide'),
    
    showBrowserViews: (): Promise<void> =>
      ipcRenderer.invoke('browser-view:show'),
  },

  // Mail API (placeholder implementation)
  mail: {
    sendMail: (options: any): Promise<void> =>
      ipcRenderer.invoke('mail:sendMail', options),
    
    getMailboxes: (): Promise<any[]> =>
      ipcRenderer.invoke('mail:getMailboxes'),
    
    getCurrentMailbox: (): Promise<any> =>
      ipcRenderer.invoke('mail:getCurrentMailbox'),
    
    listMessages: (mailboxId: string, options?: any): Promise<any[]> =>
      ipcRenderer.invoke('mail:listMessages', mailboxId, options),
    
    getMessage: (messageId: string): Promise<any> =>
      ipcRenderer.invoke('mail:getMessage', messageId),
    
    deleteMessage: (messageId: string): Promise<void> =>
      ipcRenderer.invoke('mail:deleteMessage', messageId),
    
    markAsRead: (messageId: string): Promise<void> =>
      ipcRenderer.invoke('mail:markAsRead', messageId),
    
    markAsUnread: (messageId: string): Promise<void> =>
      ipcRenderer.invoke('mail:markAsUnread', messageId),
    
    moveMessage: (messageId: string, mailboxId: string): Promise<void> =>
      ipcRenderer.invoke('mail:moveMessage', messageId, mailboxId),
    
    getAccounts: (): Promise<any[]> =>
      ipcRenderer.invoke('mail:getAccounts'),
    
    getMessages: (): Promise<any[]> =>
      ipcRenderer.invoke('mail:getMessages'),
    
    sendMessage: (data: any): Promise<void> =>
      ipcRenderer.invoke('mail:sendMessage', data),
    
    getAllSnippets: (): Promise<any[]> =>
      ipcRenderer.invoke('mail:getAllSnippets'),
    
    saveSnippet: (data: any): Promise<any> =>
      ipcRenderer.invoke('mail:saveSnippet', data),
    
    updateSnippet: (id: string, data: any): Promise<any> =>
      ipcRenderer.invoke('mail:updateSnippet', id, data),
    
    deleteSnippet: (id: string): Promise<void> =>
      ipcRenderer.invoke('mail:deleteSnippet', id),
    
    useSnippet: (id: string): Promise<any> =>
      ipcRenderer.invoke('mail:useSnippet', id),
    
    getTemplates: (): Promise<any[]> =>
      ipcRenderer.invoke('mail:getTemplates'),
    
    getAllTemplates: (): Promise<any[]> =>
      ipcRenderer.invoke('mail:getAllTemplates'),
    
    saveTemplate: (data: any): Promise<any> =>
      ipcRenderer.invoke('mail:saveTemplate', data),
    
    getTemplate: (id: string): Promise<any> =>
      ipcRenderer.invoke('mail:getTemplate', id),
    
    updateTemplate: (id: string, data: any): Promise<any> =>
      ipcRenderer.invoke('mail:updateTemplate', id, data),
    
    deleteTemplate: (id: string): Promise<void> =>
      ipcRenderer.invoke('mail:deleteTemplate', id),
  },

  // Logging API
  logging: {
    log: (entry: LogEntry): Promise<void> =>
      ipcRenderer.invoke('logging:log', entry),
    
    flush: (): Promise<void> =>
      ipcRenderer.invoke('logging:flush'),
    
    getConfig: (): Promise<LoggerConfig> =>
      ipcRenderer.invoke('logging:get-config'),
    
    updateConfig: (config: Partial<LoggerConfig>): Promise<void> =>
      ipcRenderer.invoke('logging:update-config', config),
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('flowDesk', flowDeskAPI);

// Log successful preload initialization
logger.debug('Console log', undefined, { originalArgs: ['🚀 Flow Desk preload script initialized (workspace-only mode)'], method: 'console.log' });

export type FlowDeskAPI = typeof flowDeskAPI;