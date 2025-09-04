/*!
 * Calendar Service - Main Process
 * 
 * Handles all calendar operations in the Electron main process, bridging
 * the Rust calendar engine with the renderer process via IPC.
 */

import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import { CalendarEngine, CalendarEngineConfig } from '@flow-desk/shared/calendar-engine';
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

// Import Rust engine
import { createRustEngine, type NapiCalendarAccount, type NapiCalendar, type NapiCalendarEvent, type NapiCalendarSyncStatus } from '@flow-desk/shared-rust/typescript-wrapper';
import { machineId } from 'node-machine-id';
import { app } from 'electron';
import path from 'path';
import log from 'electron-log';
import keytar from 'keytar';
import Store from 'electron-store';

// Calendar service state
let calendarEngine: CalendarEngine | null = null;
let mainWindow: BrowserWindow | null = null;
let isInitialized = false;

// Secure store for calendar credentials
const calendarStore = new Store({
  name: 'calendar-credentials',
  encryptionKey: 'calendar-encryption-key'
});

// Configuration
const getCalendarConfig = async (): Promise<CalendarEngineConfig> => {
  const userDataPath = app.getPath('userData');
  const databasePath = path.join(userDataPath, 'calendar.db');
  const machineIdValue = await machineId();

  return {
    databaseUrl: `sqlite://${databasePath}`,
    maxConcurrentSyncs: 5,
    defaultSyncIntervalMinutes: 15,
    webhookConfig: {
      host: 'localhost',
      port: 3001,
      basePath: '/webhooks/calendar',
      secret: machineIdValue.substring(0, 32)
    },
    rateLimits: {
      googleCalendarRpm: 300,
      microsoftGraphRpm: 600,
      caldavRpm: 60,
      burstCapacity: 10
    },
    privacySync: {
      defaultPrivacyTitle: 'Private',
      maxPastDays: 7,
      maxFutureDays: 60,
      enableAdvancedMode: false,
      syncIntervalMinutes: 5
    },
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    debug: process.env.NODE_ENV === 'development'
  };
};

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
    calendarEngine = new CalendarEngine();
    const config = await getCalendarConfig();
    await calendarEngine.initialize(config);
    await calendarEngine.start();

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
    await calendarEngine.stop();
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
      
      // Clean up stored credentials
      await deleteCredentials(accountId);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:account-deleted', { accountId });
      
      return { 
        success: true, 
        data: { 
          accountId,
          deletedAt: new Date().toISOString(),
          message: 'Calendar account deleted successfully' 
        } 
      };
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
      
      return { 
        success: true, 
        data: { 
          calendarId,
          eventId,
          deletedAt: new Date().toISOString(),
          message: 'Calendar event deleted successfully' 
        } 
      };
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

  ipcMain.handle('calendar:execute-privacy-sync', async (event) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const results = await calendarEngine.executePrivacySync();
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:privacy-sync-completed', { results });
      
      return { success: true, data: results };
    } catch (error) {
      log.error('Error executing privacy sync:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:execute-privacy-sync-rule', async (event, ruleId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const result = await calendarEngine.executePrivacySyncRule(ruleId);
      return { success: true, data: result };
    } catch (error) {
      log.error('Error executing privacy sync rule:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Search Operations ===

  ipcMain.handle('calendar:search-events', async (event, query: string, limit?: number) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const events = await calendarEngine.searchEvents(query, limit);
      return { success: true, data: events };
    } catch (error) {
      log.error('Error searching calendar events:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:search-calendars', async (event, query: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const calendars = await calendarEngine.searchCalendars(query);
      return { success: true, data: calendars };
    } catch (error) {
      log.error('Error searching calendars:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Metrics and Monitoring ===

  ipcMain.handle('calendar:get-metrics', async (event) => {
    try {
      if (!calendarEngine) {
        throw new Error('Calendar engine not initialized');
      }

      const metrics = await calendarEngine.getMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      log.error('Error getting calendar metrics:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Utility Operations ===

  ipcMain.handle('calendar:get-supported-providers', async (event) => {
    try {
      const providers = CalendarEngine.getSupportedProviders();
      return { success: true, data: providers };
    } catch (error) {
      log.error('Error getting supported providers:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-provider-capabilities', async (event, provider: CalendarProvider) => {
    try {
      const capabilities = CalendarEngine.getProviderCapabilities(provider);
      return { success: true, data: capabilities };
    } catch (error) {
      log.error('Error getting provider capabilities:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

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