/**
 * Simplified preload script for Flow Desk
 * 
 * Exposes secure APIs to renderer process with proper typing
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to renderer
interface FlowDeskAPI {
  // Gmail API
  gmail: {
    getOAuthUrl(): Promise<string>;
    startOAuth(): Promise<any>;
    listAccounts(): Promise<any[]>;
    syncAccount(accountId: string): Promise<any>;
    getMessages(accountId: string): Promise<any[]>;
  };
  
  // Calendar API
  calendar: {
    getOAuthUrl(clientId: string): Promise<string>;
    addAccount(email: string, accessToken: string, refreshToken?: string): Promise<any>;
    syncAccount(accountId: string): Promise<any>;
    createEvent(accountId: string, calendarId: string, title: string, startTime: Date, endTime: Date): Promise<string>;
  };
  
  // Slack API
  slack: {
    getOAuthUrl(clientId: string): Promise<string>;
    addAccount(accessToken: string): Promise<any>;
    syncAccount(accountId: string): Promise<any>;
    sendMessage(accountId: string, channelId: string, text: string): Promise<string>;
  };
  
  // App API
  app: {
    getVersion(): Promise<string>;
    getPlatform(): Promise<string>;
  };

  // Event listeners
  on(channel: string, callback: (data: any) => void): void;
  off(channel: string, callback: (data: any) => void): void;
}

// Secure API implementation
const flowDeskAPI: FlowDeskAPI = {
  // Gmail methods
  gmail: {
    getOAuthUrl: () => ipcRenderer.invoke('gmail:get-oauth-url'),
    startOAuth: () => ipcRenderer.invoke('gmail:start-oauth'),
    listAccounts: () => ipcRenderer.invoke('gmail:list-accounts'),
    syncAccount: (accountId: string) => ipcRenderer.invoke('gmail:sync-account', accountId),
    getMessages: (accountId: string) => ipcRenderer.invoke('gmail:get-messages', accountId),
  },

  // Calendar methods
  calendar: {
    getOAuthUrl: (clientId: string) => ipcRenderer.invoke('calendar:get-oauth-url', clientId),
    addAccount: (email: string, accessToken: string, refreshToken?: string) => 
      ipcRenderer.invoke('calendar:add-account', email, accessToken, refreshToken),
    syncAccount: (accountId: string) => ipcRenderer.invoke('calendar:sync-account', accountId),
    createEvent: (accountId: string, calendarId: string, title: string, startTime: Date, endTime: Date) =>
      ipcRenderer.invoke('calendar:create-event', accountId, calendarId, title, startTime, endTime),
  },

  // Slack methods
  slack: {
    getOAuthUrl: (clientId: string) => ipcRenderer.invoke('slack:get-oauth-url', clientId),
    addAccount: (accessToken: string) => ipcRenderer.invoke('slack:add-account', accessToken),
    syncAccount: (accountId: string) => ipcRenderer.invoke('slack:sync-account', accountId),
    sendMessage: (accountId: string, channelId: string, text: string) =>
      ipcRenderer.invoke('slack:send-message', accountId, channelId, text),
  },

  // App methods
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  },

  // Event handling
  on: (channel: string, callback: (data: any) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(args[0]);
    ipcRenderer.on(channel, subscription);
  },

  off: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.removeListener(channel, callback);
  }
};

// Expose the API to renderer process
contextBridge.exposeInMainWorld('flowDesk', flowDeskAPI);

// Add type declaration for renderer process
declare global {
  interface Window {
    flowDesk: FlowDeskAPI;
  }
}

// Log that preload script loaded
console.log('Flow Desk preload script loaded');

export type { FlowDeskAPI };