/*!
 * Calendar Preload Script
 * 
 * Exposes secure calendar API to the renderer process through contextBridge.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  CalendarAccount,
  CalendarEvent,
  Calendar,
  CreateCalendarAccountInput,
  UpdateCalendarAccountInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarPrivacySync,
  FreeBusyQuery,
  FreeBusyResponse,
  CalendarSyncStatus,
  CalendarMetrics,
  CalendarProvider
} from '@flow-desk/shared/types/calendar';

export interface CalendarAPI {
  // === Account Management ===
  createAccount: (accountData: CreateCalendarAccountInput) => Promise<{ success: boolean; data?: CalendarAccount; error?: string }>;
  getAccount: (accountId: string) => Promise<{ success: boolean; data?: CalendarAccount; error?: string }>;
  getUserAccounts: (userId: string) => Promise<{ success: boolean; data?: CalendarAccount[]; error?: string }>;
  updateAccount: (accountId: string, updates: UpdateCalendarAccountInput) => Promise<{ success: boolean; data?: CalendarAccount; error?: string }>;
  deleteAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;

  // === Calendar Operations ===
  listCalendars: (accountId: string) => Promise<{ success: boolean; data?: Calendar[]; error?: string }>;
  getCalendar: (calendarId: string) => Promise<{ success: boolean; data?: Calendar; error?: string }>;
  createCalendar: (calendar: Calendar) => Promise<{ success: boolean; data?: Calendar; error?: string }>;

  // === Event Operations ===
  createEvent: (eventData: CreateCalendarEventInput) => Promise<{ success: boolean; data?: CalendarEvent; error?: string }>;
  updateEvent: (calendarId: string, eventId: string, updates: UpdateCalendarEventInput) => Promise<{ success: boolean; data?: CalendarEvent; error?: string }>;
  deleteEvent: (calendarId: string, eventId: string) => Promise<{ success: boolean; error?: string }>;
  getEventsInRange: (calendarIds: string[], timeMin: string, timeMax: string) => Promise<{ success: boolean; data?: CalendarEvent[]; error?: string }>;

  // === Free/Busy Operations ===
  queryFreeBusy: (query: FreeBusyQuery) => Promise<{ success: boolean; data?: FreeBusyResponse; error?: string }>;

  // === Sync Operations ===
  syncAccount: (accountId: string, force?: boolean) => Promise<{ success: boolean; data?: CalendarSyncStatus; error?: string }>;
  getAllSyncStatus: () => Promise<{ success: boolean; data?: Record<string, CalendarSyncStatus>; error?: string }>;

  // === Privacy Sync Operations ===
  createPrivacySyncRule: (rule: CalendarPrivacySync) => Promise<{ success: boolean; data?: string; error?: string }>;
  executePrivacySync: () => Promise<{ success: boolean; data?: any; error?: string }>;
  executePrivacySyncRule: (ruleId: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // === Search Operations ===
  searchEvents: (query: string, limit?: number) => Promise<{ success: boolean; data?: CalendarEvent[]; error?: string }>;
  searchCalendars: (query: string) => Promise<{ success: boolean; data?: Calendar[]; error?: string }>;

  // === Metrics and Monitoring ===
  getMetrics: () => Promise<{ success: boolean; data?: CalendarMetrics; error?: string }>;

  // === Utility Operations ===
  getSupportedProviders: () => Promise<{ success: boolean; data?: CalendarProvider[]; error?: string }>;
  getProviderCapabilities: (provider: CalendarProvider) => Promise<{ success: boolean; data?: any; error?: string }>;

  // === Event Listeners ===
  onAccountCreated: (callback: (account: CalendarAccount) => void) => void;
  onAccountUpdated: (callback: (account: CalendarAccount) => void) => void;
  onAccountDeleted: (callback: (data: { accountId: string }) => void) => void;
  onCalendarCreated: (callback: (calendar: Calendar) => void) => void;
  onEventCreated: (callback: (event: CalendarEvent) => void) => void;
  onEventUpdated: (callback: (event: CalendarEvent) => void) => void;
  onEventDeleted: (callback: (data: { calendarId: string; eventId: string }) => void) => void;
  onSyncStatusUpdated: (callback: (data: { accountId: string; status: CalendarSyncStatus }) => void) => void;
  onPrivacySyncRuleCreated: (callback: (data: { ruleId: string; rule: CalendarPrivacySync }) => void) => void;
  onPrivacySyncCompleted: (callback: (data: { results: any }) => void) => void;
  onNotification: (callback: (notification: { type: string; data: any; timestamp: string }) => void) => void;

  // === Event Listener Cleanup ===
  removeAllListeners: () => void;
}

const calendarAPI: CalendarAPI = {
  // === Account Management ===
  createAccount: (accountData: CreateCalendarAccountInput) => 
    ipcRenderer.invoke('calendar:create-account', accountData),
  
  getAccount: (accountId: string) => 
    ipcRenderer.invoke('calendar:get-account', accountId),
  
  getUserAccounts: (userId: string) => 
    ipcRenderer.invoke('calendar:get-user-accounts', userId),
  
  updateAccount: (accountId: string, updates: UpdateCalendarAccountInput) => 
    ipcRenderer.invoke('calendar:update-account', accountId, updates),
  
  deleteAccount: (accountId: string) => 
    ipcRenderer.invoke('calendar:delete-account', accountId),

  // === Calendar Operations ===
  listCalendars: (accountId: string) => 
    ipcRenderer.invoke('calendar:list-calendars', accountId),
  
  getCalendar: (calendarId: string) => 
    ipcRenderer.invoke('calendar:get-calendar', calendarId),
  
  createCalendar: (calendar: Calendar) => 
    ipcRenderer.invoke('calendar:create-calendar', calendar),

  // === Event Operations ===
  createEvent: (eventData: CreateCalendarEventInput) => 
    ipcRenderer.invoke('calendar:create-event', eventData),
  
  updateEvent: (calendarId: string, eventId: string, updates: UpdateCalendarEventInput) => 
    ipcRenderer.invoke('calendar:update-event', calendarId, eventId, updates),
  
  deleteEvent: (calendarId: string, eventId: string) => 
    ipcRenderer.invoke('calendar:delete-event', calendarId, eventId),
  
  getEventsInRange: (calendarIds: string[], timeMin: string, timeMax: string) => 
    ipcRenderer.invoke('calendar:get-events-in-range', calendarIds, timeMin, timeMax),

  // === Free/Busy Operations ===
  queryFreeBusy: (query: FreeBusyQuery) => 
    ipcRenderer.invoke('calendar:query-free-busy', query),

  // === Sync Operations ===
  syncAccount: (accountId: string, force = false) => 
    ipcRenderer.invoke('calendar:sync-account', accountId, force),
  
  getAllSyncStatus: () => 
    ipcRenderer.invoke('calendar:get-all-sync-status'),

  // === Privacy Sync Operations ===
  createPrivacySyncRule: (rule: CalendarPrivacySync) => 
    ipcRenderer.invoke('calendar:create-privacy-sync-rule', rule),
  
  executePrivacySync: () => 
    ipcRenderer.invoke('calendar:execute-privacy-sync'),
  
  executePrivacySyncRule: (ruleId: string) => 
    ipcRenderer.invoke('calendar:execute-privacy-sync-rule', ruleId),

  // === Search Operations ===
  searchEvents: (query: string, limit?: number) => 
    ipcRenderer.invoke('calendar:search-events', query, limit),
  
  searchCalendars: (query: string) => 
    ipcRenderer.invoke('calendar:search-calendars', query),

  // === Metrics and Monitoring ===
  getMetrics: () => 
    ipcRenderer.invoke('calendar:get-metrics'),

  // === Utility Operations ===
  getSupportedProviders: () => 
    ipcRenderer.invoke('calendar:get-supported-providers'),
  
  getProviderCapabilities: (provider: CalendarProvider) => 
    ipcRenderer.invoke('calendar:get-provider-capabilities', provider),

  // === Event Listeners ===
  onAccountCreated: (callback: (account: CalendarAccount) => void) => {
    const listener = (_event: IpcRendererEvent, account: CalendarAccount) => callback(account);
    ipcRenderer.on('calendar:account-created', listener);
  },

  onAccountUpdated: (callback: (account: CalendarAccount) => void) => {
    const listener = (_event: IpcRendererEvent, account: CalendarAccount) => callback(account);
    ipcRenderer.on('calendar:account-updated', listener);
  },

  onAccountDeleted: (callback: (data: { accountId: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { accountId: string }) => callback(data);
    ipcRenderer.on('calendar:account-deleted', listener);
  },

  onCalendarCreated: (callback: (calendar: Calendar) => void) => {
    const listener = (_event: IpcRendererEvent, calendar: Calendar) => callback(calendar);
    ipcRenderer.on('calendar:calendar-created', listener);
  },

  onEventCreated: (callback: (event: CalendarEvent) => void) => {
    const listener = (_event: IpcRendererEvent, event: CalendarEvent) => callback(event);
    ipcRenderer.on('calendar:event-created', listener);
  },

  onEventUpdated: (callback: (event: CalendarEvent) => void) => {
    const listener = (_event: IpcRendererEvent, event: CalendarEvent) => callback(event);
    ipcRenderer.on('calendar:event-updated', listener);
  },

  onEventDeleted: (callback: (data: { calendarId: string; eventId: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { calendarId: string; eventId: string }) => callback(data);
    ipcRenderer.on('calendar:event-deleted', listener);
  },

  onSyncStatusUpdated: (callback: (data: { accountId: string; status: CalendarSyncStatus }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { accountId: string; status: CalendarSyncStatus }) => callback(data);
    ipcRenderer.on('calendar:sync-status-updated', listener);
  },

  onPrivacySyncRuleCreated: (callback: (data: { ruleId: string; rule: CalendarPrivacySync }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { ruleId: string; rule: CalendarPrivacySync }) => callback(data);
    ipcRenderer.on('calendar:privacy-sync-rule-created', listener);
  },

  onPrivacySyncCompleted: (callback: (data: { results: any }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { results: any }) => callback(data);
    ipcRenderer.on('calendar:privacy-sync-completed', listener);
  },

  onNotification: (callback: (notification: { type: string; data: any; timestamp: string }) => void) => {
    const listener = (_event: IpcRendererEvent, notification: { type: string; data: any; timestamp: string }) => callback(notification);
    ipcRenderer.on('calendar:notification', listener);
  },

  // === Event Listener Cleanup ===
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('calendar:account-created');
    ipcRenderer.removeAllListeners('calendar:account-updated');
    ipcRenderer.removeAllListeners('calendar:account-deleted');
    ipcRenderer.removeAllListeners('calendar:calendar-created');
    ipcRenderer.removeAllListeners('calendar:event-created');
    ipcRenderer.removeAllListeners('calendar:event-updated');
    ipcRenderer.removeAllListeners('calendar:event-deleted');
    ipcRenderer.removeAllListeners('calendar:sync-status-updated');
    ipcRenderer.removeAllListeners('calendar:privacy-sync-rule-created');
    ipcRenderer.removeAllListeners('calendar:privacy-sync-completed');
    ipcRenderer.removeAllListeners('calendar:notification');
  }
};

// Expose calendar API to renderer process
contextBridge.exposeInMainWorld('calendarAPI', calendarAPI);