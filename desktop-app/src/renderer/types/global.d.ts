// Global type declarations for Flow Desk Desktop App

// Local type definitions since shared types may not be available

declare global {
  interface Window {
    flowDesk?: {
      workspace: {
        list: () => Promise<WorkspaceData[]>;
        create: (name: string, color?: string) => Promise<string>;
        getCurrent: () => Promise<WorkspaceData | null>;
        switch: (workspaceId: string) => Promise<void>;
        listPartitions: () => Promise<any[]>;
        createPartition: (config: any) => Promise<void>;
        update: (workspaceId: string, updates: any) => Promise<void>;
        delete: (workspaceId: string) => Promise<void>;
        updatePartition: (workspaceId: string, updates: any) => Promise<void>;
        clearData: (workspaceId: string) => Promise<void>;
        getWindows: (workspaceId: string) => Promise<any[]>;
        createWindow: (options: any) => Promise<string>;
        loadServices: (workspaceId: string) => Promise<ServiceData[]>;
        loadService: (workspaceId: string, serviceId: string) => Promise<void>;
        addService: (workspaceId: string, name: string, type: string, url: string) => Promise<string>;
        removeService: (workspaceId: string, serviceId: string) => Promise<void>;
        updateService: (workspaceId: string, serviceId: string, updates: Partial<ServiceData>) => Promise<ServiceData>;
      };
      browserView: {
        hide: () => Promise<void>;
        show: () => Promise<void>;
      };
      mail: {
        sendMail: (options: any) => Promise<void>;
        getMailboxes: () => Promise<any[]>;
        getCurrentMailbox: () => Promise<any>;
        listMessages: (mailboxId: string, options?: any) => Promise<any[]>;
        getMessage: (messageId: string) => Promise<any>;
        deleteMessage: (messageId: string) => Promise<void>;
        markAsRead: (messageId: string) => Promise<void>;
        markAsUnread: (messageId: string) => Promise<void>;
        moveMessage: (messageId: string, mailboxId: string) => Promise<void>;
      };
      theme: {
        get: () => Promise<ThemeSettings>;
        set: (settings: ThemeSettings) => Promise<void>;
      };
      system: {
        showNotification: (options: NotificationOptions) => Promise<void>;
        showDialog: (options: any) => Promise<any>;
        openExternal: (url: string) => Promise<void>;
        getOS: () => Promise<string>;
        getArch: () => Promise<string>;
        getPath: (name: string) => Promise<string>;
        showItemInFolder: (path: string) => Promise<void>;
      };
      search: {
        query: (query: string, filters?: any) => Promise<any[]>;
        indexDocument: (document: any) => Promise<void>;
        removeDocument: (id: string) => Promise<void>;
        optimize: () => Promise<void>;
      };
      auth: {
        getCurrentUser: () => Promise<any>;
        signIn: (credentials: any) => Promise<any>;
        signOut: () => Promise<void>;
        isMFAEnabled: () => Promise<boolean>;
        setupMFA: () => Promise<void>;
        verifyMFA: (code: string) => Promise<boolean>;
      };
      config: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        has: (key: string) => Promise<boolean>;
        delete: (key: string) => Promise<void>;
      };
      file: {
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
        delete: (path: string) => Promise<void>;
      };
      notification: {
        show: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => Promise<void>;
        dismiss: (id?: string) => Promise<void>;
      };
      error: {
        report: (error: Error, context?: any) => Promise<void>;
        clear: () => Promise<void>;
      };
      logger: {
        info: (message: string, error?: Error, context?: any) => Promise<void>;
        warn: (message: string, error?: Error, context?: any) => Promise<void>;
        error: (message: string, error?: Error, context?: any) => Promise<void>;
        debug: (message: string, error?: Error, context?: any) => Promise<void>;
      };
      ipc: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: Function) => void;
        removeListener: (channel: string, listener: Function) => void;
      };
    };
  }

  interface HTMLElement {
    // Add any additional DOM element types if needed
  }
}

// Recovery action type for error handling
export interface RecoveryAction {
  label: string;
  action: () => void;
  primary?: boolean;
  destructive?: boolean;
}

// Extended error types
export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  details?: string;
  recoveryActions?: RecoveryAction[];
  timestamp: Date;
  context?: any;
  canRetry: boolean;
}

// Workspace data types
export interface WorkspaceData {
  id: string;
  name: string;
  description?: string;
  color: string;
  abbreviation: string;
  services: ServiceData[];
  created: Date;
  updated: Date;
  isActive: boolean;
}

// Service data types
export interface ServiceData {
  id: string;
  name: string;
  type: string;
  url: string;
  iconUrl?: string;
  isEnabled: boolean;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

// Theme settings
export interface ThemeSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: number;
}

// Notification options
export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  silent?: boolean;
}