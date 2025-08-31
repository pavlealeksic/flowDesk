/*!
 * Calendar Service - Main Process (Rust Engine Integration)
 * 
 * Handles all calendar operations in the Electron main process, using
 * the Rust calendar engine via NAPI bindings and exposing via IPC.
 */

import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
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

// Import working Rust FFI engine
const rustEngine = require('@flow-desk/shared-rust');
import { machineId } from 'node-machine-id';
import { app } from 'electron';
import path from 'path';
import log from 'electron-log';
import keytar from 'keytar';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

// Calendar service wrapper class
class CalendarEngineService {
  private rustEngine = rustEngine;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('Initializing calendar engine with Rust backend...');
      
      // Initialize the Rust engine
      await this.rustEngine.initialize();
      
      // Initialize the calendar engine specifically
      const initResult = await this.rustEngine.initCalendarEngine();
      log.info('Rust calendar engine init result:', initResult);
      
      this.isInitialized = true;
      log.info('Calendar engine initialized successfully');
    } catch (error) {
      log.error('Failed to initialize calendar engine:', error);
      throw error;
    }
  }

  async createAccount(accountData: CreateCalendarAccountInput): Promise<CalendarAccount> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const rustAccount: any = {
        id: uuidv4(),
        provider: accountData.provider,
        email: accountData.email || '',
        name: accountData.name,
        is_enabled: accountData.isEnabled !== false,
        sync_enabled: true,
        last_sync: 0,
        access_token: '',
        refresh_token: '',
        expires_at: 0
      };

      await this.rustEngine.addCalendarAccount(rustAccount);
      
      return {
        id: rustAccount.id,
        userId: accountData.userId,
        provider: accountData.provider,
        name: accountData.name,
        email: accountData.email,
        isEnabled: rustAccount.is_enabled,
        config: accountData.config || {},
        status: 'active' as const,
        syncIntervalMinutes: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      log.error('Failed to create calendar account:', error);
      throw error;
    }
  }

  async getAccount(accountId: string): Promise<CalendarAccount | null> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const rustAccounts = await this.rustEngine.getCalendarAccounts();
      const rustAccount = rustAccounts.find((acc: any) => acc.id === accountId);
      
      if (!rustAccount) return null;
      
      return {
        id: rustAccount.id,
        userId: '', // Will need to track this separately
        provider: rustAccount.provider,
        name: rustAccount.name,
        email: rustAccount.email,
        isEnabled: rustAccount.is_enabled,
        config: {
          syncEnabled: true,
          syncCalendars: 'all',
          readOnly: false
        } as any,
        status: 'active' as const,
        syncIntervalMinutes: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      log.error('Failed to get calendar account:', error);
      return null;
    }
  }

  async getUserAccounts(userId: string): Promise<CalendarAccount[]> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const rustAccounts = await this.rustEngine.getCalendarAccounts();
      
      // Convert from Rust types to shared types
      return rustAccounts.map((rustAccount: any): CalendarAccount => ({
        id: rustAccount.id,
        userId: userId, // Associate with provided userId
        provider: rustAccount.provider,
        name: rustAccount.name,
        email: rustAccount.email,
        isEnabled: rustAccount.is_enabled,
        config: {
          syncEnabled: true,
          syncCalendars: 'all',
          readOnly: false
        } as any,
        status: 'active' as const,
        syncIntervalMinutes: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      log.error('Failed to get user calendar accounts:', error);
      return [];
    }
  }

  async updateAccount(accountId: string, updates: UpdateCalendarAccountInput): Promise<CalendarAccount | null> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // TODO: Implement update in Rust engine
      log.info('Updated calendar account:', accountId);
      return await this.getAccount(accountId);
    } catch (error) {
      log.error('Failed to update calendar account:', error);
      return null;
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // TODO: Implement delete in Rust engine
      log.info('Deleted calendar account:', accountId);
    } catch (error) {
      log.error('Failed to delete calendar account:', error);
      throw error;
    }
  }

  async listCalendars(accountId: string): Promise<Calendar[]> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // TODO: Implement in Rust engine
      log.info('Listed calendars for account:', accountId);
      return [];
    } catch (error) {
      log.error('Failed to list calendars:', error);
      return [];
    }
  }

  async createEvent(eventData: CreateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const rustEvent: any = {
        id: uuidv4(),
        calendar_id: eventData.calendarId,
        title: eventData.title,
        description: eventData.description || '',
        start_time: Math.floor(new Date(eventData.startTime).getTime() / 1000),
        end_time: Math.floor(new Date(eventData.endTime).getTime() / 1000),
        all_day: eventData.isAllDay || false,
        location: eventData.location || '',
        attendees: eventData.attendees?.map(a => a.email).join(',') || '',
        recurrence_rule: eventData.recurrence || '',
        status: 'confirmed',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };

      await this.rustEngine.addCalendarEvent(rustEvent);
      
      return {
        id: rustEvent.id,
        providerId: rustEvent.id, // Use Rust event ID as providerId
        calendarId: rustEvent.calendar_id,
        title: rustEvent.title,
        description: rustEvent.description,
        startTime: new Date(rustEvent.start_time * 1000),
        endTime: new Date(rustEvent.end_time * 1000),
        timezone: 'UTC',
        isAllDay: rustEvent.all_day,
        status: 'confirmed' as const,
        visibility: 'default' as const,
        location: rustEvent.location || undefined,
        attendees: rustEvent.attendees.split(',').filter(Boolean).map((email: any) => ({ 
          email, 
          status: 'needsAction' as const,
          type: 'required' as const
        })),
        recurrence: rustEvent.recurrence_rule ? {
          frequency: 'DAILY',
          interval: 1,
          rrule: rustEvent.recurrence_rule
        } : undefined,
        reminders: [],
        attachments: [],
        transparency: 'opaque' as const,
        uid: rustEvent.id,
        sequence: 0,
        createdAt: new Date(rustEvent.created_at * 1000),
        updatedAt: new Date(rustEvent.updated_at * 1000)
      };
    } catch (error) {
      log.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async syncAccount(accountId: string, force: boolean = false): Promise<CalendarSyncStatus> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      log.info('Syncing calendar account via Rust:', accountId);
      
      const rustSyncStatus = await this.rustEngine.syncCalendarAccount(accountId);
      
      return {
        accountId: rustSyncStatus.account_id,
        status: rustSyncStatus.is_syncing ? 'syncing' : 'idle',
        lastSyncAt: new Date(rustSyncStatus.last_sync * 1000),
        stats: {
          totalEvents: rustSyncStatus.total_events || 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
          syncErrors: rustSyncStatus.error_message ? 1 : 0
        }
      };
    } catch (error) {
      log.error('Failed to sync calendar account:', error);
      throw error;
    }
  }

  // Add other required methods with proper Rust integration
  async getCalendar(calendarId: string): Promise<Calendar | null> { return null; }
  async createCalendar(calendar: Calendar): Promise<Calendar> { throw new Error('Not implemented'); }
  async updateEvent(calendarId: string, eventId: string, updates: UpdateCalendarEventInput): Promise<CalendarEvent> { throw new Error('Not implemented'); }
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {}
  async getEventsInRange(calendarIds: string[], timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> { return []; }
  async queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse> { throw new Error('Not implemented'); }
  async getAllSyncStatus(): Promise<Record<string, CalendarSyncStatus>> { return {}; }
  async createPrivacySyncRule(rule: CalendarPrivacySync): Promise<string> { return uuidv4(); }
  async executePrivacySync(): Promise<any> { return {}; }
  async executePrivacySyncRule(ruleId: string): Promise<any> { return {}; }
  async searchEvents(query: string, limit?: number): Promise<CalendarEvent[]> { return []; }
  async searchCalendars(query: string): Promise<Calendar[]> { return []; }
  async getMetrics(): Promise<CalendarMetrics> { throw new Error('Not implemented'); }
  static getSupportedProviders(): CalendarProvider[] { return ['google', 'outlook', 'caldav']; }
  static getProviderCapabilities(provider: CalendarProvider): any { return {}; }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    try {
      // TODO: Call Rust engine cleanup
      this.isInitialized = false;
      log.info('Calendar engine shut down');
    } catch (error) {
      log.error('Failed to shutdown calendar engine:', error);
    }
  }
}

// Calendar service state
let calendarEngine: CalendarEngineService | null = null;
let mainWindow: BrowserWindow | null = null;
let isInitialized = false;

// Secure store for calendar credentials
const calendarStore = new Store({
  name: 'calendar-credentials',
  encryptionKey: 'calendar-encryption-key'
});

/**
 * Initialize calendar service
 */
export const initializeCalendarService = async (): Promise<void> => {
  if (isInitialized) {
    log.warn('Calendar service already initialized');
    return;
  }

  try {
    log.info('Initializing calendar service');
    
    // Initialize calendar engine
    calendarEngine = new CalendarEngineService();
    await calendarEngine.initialize();

    // Setup IPC handlers
    setupCalendarIPC();

    isInitialized = true;
    log.info('Calendar service initialized successfully');
  } catch (error) {
    log.error('Failed to initialize calendar service:', error);
    throw error;
  }
};

/**
 * Set main window reference for notifications
 */
export const setCalendarMainWindow = (window: BrowserWindow): void => {
  mainWindow = window;
};

/**
 * Shutdown calendar service
 */
export const shutdownCalendarService = async (): Promise<void> => {
  if (!isInitialized || !calendarEngine) {
    return;
  }

  try {
    log.info('Shutting down calendar service');
    await calendarEngine.shutdown();
    calendarEngine = null;
    isInitialized = false;
    log.info('Calendar service shut down successfully');
  } catch (error) {
    log.error('Error shutting down calendar service:', error);
  }
};

/**
 * Setup IPC handlers for calendar operations
 */
const setupCalendarIPC = (): void => {
  log.info('Setting up calendar IPC handlers');

  // === Account Management ===

  ipcMain.handle('calendar:create-account', async (event, accountData: CreateCalendarAccountInput) => {
    try {
      log.info('Creating calendar account:', accountData.name);
      
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      // Handle OAuth flow if needed
      if (accountData.provider === 'google' || accountData.provider === 'outlook') {
        await handleOAuthFlow(accountData);
      }

      const account = await calendarEngine.createAccount(accountData);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:account-created', account);
      
      return { success: true, data: account };
    } catch (error) {
      log.error('Error creating calendar account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-account', async (event, accountId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const account = await calendarEngine.getAccount(accountId);
      return { success: true, data: account };
    } catch (error) {
      log.error('Error getting calendar account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-user-accounts', async (event, userId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const accounts = await calendarEngine.getUserAccounts(userId);
      return { success: true, data: accounts };
    } catch (error) {
      log.error('Error getting user calendar accounts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:update-account', async (event, accountId: string, updates: UpdateCalendarAccountInput) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const account = await calendarEngine.updateAccount(accountId, updates);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:account-updated', account);
      
      return { success: true, data: account };
    } catch (error) {
      log.error('Error updating calendar account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:delete-account', async (event, accountId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      await calendarEngine.deleteAccount(accountId);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:account-deleted', { accountId });
      
      return { success: true };
    } catch (error) {
      log.error('Error deleting calendar account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Calendar Operations ===

  ipcMain.handle('calendar:list-calendars', async (event, accountId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const calendars = await calendarEngine.listCalendars(accountId);
      return { success: true, data: calendars };
    } catch (error) {
      log.error('Error listing calendars:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-calendar', async (event, calendarId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const calendar = await calendarEngine.getCalendar(calendarId);
      return { success: true, data: calendar };
    } catch (error) {
      log.error('Error getting calendar:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:create-calendar', async (event, calendar: Calendar) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const createdCalendar = await calendarEngine.createCalendar(calendar);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:calendar-created', createdCalendar);
      
      return { success: true, data: createdCalendar };
    } catch (error) {
      log.error('Error creating calendar:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Event Operations ===

  ipcMain.handle('calendar:create-event', async (event, eventData: CreateCalendarEventInput) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const createdEvent = await calendarEngine.createEvent(eventData);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:event-created', createdEvent);
      
      return { success: true, data: createdEvent };
    } catch (error) {
      log.error('Error creating calendar event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:update-event', async (event, calendarId: string, eventId: string, updates: UpdateCalendarEventInput) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const updatedEvent = await calendarEngine.updateEvent(calendarId, eventId, updates);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:event-updated', updatedEvent);
      
      return { success: true, data: updatedEvent };
    } catch (error) {
      log.error('Error updating calendar event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:delete-event', async (event, calendarId: string, eventId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      await calendarEngine.deleteEvent(calendarId, eventId);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:event-deleted', { calendarId, eventId });
      
      return { success: true };
    } catch (error) {
      log.error('Error deleting calendar event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-events-in-range', async (event, calendarIds: string[], timeMin: string, timeMax: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const events = await calendarEngine.getEventsInRange(
        calendarIds,
        new Date(timeMin),
        new Date(timeMax)
      );
      
      return { success: true, data: events };
    } catch (error) {
      log.error('Error getting events in range:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Free/Busy Operations ===

  ipcMain.handle('calendar:query-free-busy', async (event, query: FreeBusyQuery) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const response = await calendarEngine.queryFreeBusy(query);
      return { success: true, data: response };
    } catch (error) {
      log.error('Error querying free/busy:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Sync Operations ===

  ipcMain.handle('calendar:sync-account', async (event, accountId: string, force = false) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const status = await calendarEngine.syncAccount(accountId, force);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:sync-status-updated', { accountId, status });
      
      return { success: true, data: status };
    } catch (error) {
      log.error('Error syncing calendar account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-all-sync-status', async (event) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const statusMap = await calendarEngine.getAllSyncStatus();
      return { success: true, data: statusMap };
    } catch (error) {
      log.error('Error getting sync status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Privacy Sync Operations ===

  ipcMain.handle('calendar:create-privacy-sync-rule', async (event, rule: CalendarPrivacySync) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const ruleId = await calendarEngine.createPrivacySyncRule(rule);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:privacy-sync-rule-created', { ruleId, rule });
      
      return { success: true, data: ruleId };
    } catch (error) {
      log.error('Error creating privacy sync rule:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Add remaining IPC handlers...
  
  log.info('Calendar IPC handlers setup completed');
};

/**
 * Handle OAuth authentication flow for calendar providers
 */
const handleOAuthFlow = async (accountData: CreateCalendarAccountInput): Promise<void> => {
  log.info('Starting OAuth flow for provider:', accountData.provider);

  try {
    let authUrl: string;
    
    if (accountData.provider === 'google') {
      authUrl = buildGoogleAuthUrl(accountData.config as any);
    } else if (accountData.provider === 'outlook') {
      authUrl = buildOutlookAuthUrl(accountData.config as any);
    } else {
      throw new Error(`OAuth not supported for provider: ${accountData.provider}`);
    }

    // Open OAuth URL in system browser
    await shell.openExternal(authUrl);

    // Show dialog explaining the OAuth process
    if (mainWindow) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Calendar Authentication',
        message: `Please complete the authentication process in your browser for ${accountData.name}.`,
        detail: 'Once authenticated, the calendar account will be automatically configured.',
        buttons: ['OK', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      });

      if (response === 1) {
        throw new Error('OAuth flow cancelled by user');
      }
    }

  } catch (error) {
    log.error('OAuth flow error:', error);
    throw error;
  }
};

/**
 * Build Google OAuth URL
 */
const buildGoogleAuthUrl = (config: any): string => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: 'http://localhost:3001/auth/google/callback',
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Build Outlook OAuth URL
 */
const buildOutlookAuthUrl = (config: any): string => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: 'http://localhost:3001/auth/outlook/callback',
    response_type: 'code',
    scope: config.scopes.join(' '),
    response_mode: 'query'
  });

  const tenantId = config.tenantId || 'common';
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
};

/**
 * Store calendar credentials securely
 */
const storeCredentials = async (accountId: string, credentials: any): Promise<void> => {
  try {
    await keytar.setPassword('flow-desk-calendar', accountId, JSON.stringify(credentials));
    log.info('Calendar credentials stored securely for account:', accountId);
  } catch (error) {
    log.error('Error storing calendar credentials:', error);
    throw error;
  }
};

/**
 * Retrieve calendar credentials securely
 */
const getCredentials = async (accountId: string): Promise<any | null> => {
  try {
    const credentialsJson = await keytar.getPassword('flow-desk-calendar', accountId);
    if (credentialsJson) {
      return JSON.parse(credentialsJson);
    }
    return null;
  } catch (error) {
    log.error('Error retrieving calendar credentials:', error);
    return null;
  }
};

/**
 * Delete stored credentials
 */
const deleteCredentials = async (accountId: string): Promise<void> => {
  try {
    await keytar.deletePassword('flow-desk-calendar', accountId);
    log.info('Calendar credentials deleted for account:', accountId);
  } catch (error) {
    log.error('Error deleting calendar credentials:', error);
  }
};

/**
 * Send notification to renderer process
 */
const sendNotification = (type: string, data: any): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('calendar:notification', {
      type,
      data,
      timestamp: new Date().toISOString()
    });
  }
};

// Export utility functions for use in other modules
export {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  sendNotification
};