/*!
 * Pure Rust Calendar Service - NAPI Wrapper
 * 
 * Provides a pure TypeScript wrapper around the Rust calendar engine
 * via NAPI bindings. All calendar business logic runs in Rust.
 */

import { ipcMain, BrowserWindow } from 'electron';
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

// Import Rust NAPI bindings - all calendar operations run in Rust
import {
  initCalendarEngine,
  addCalendarAccount,
  removeCalendarAccount,
  getCalendarAccounts,
  syncCalendarAccount,
  getCalendars as getRustCalendars,
  getCalendarEvents as getRustCalendarEvents,
  createCalendarEvent as createRustCalendarEvent,
  // Import additional NAPI functions as they are implemented
} from '@flow-desk/shared-rust';

import log from 'electron-log';

/**
 * Pure NAPI wrapper for Rust calendar engine
 * No TypeScript business logic - all operations delegated to Rust
 */
class PureRustCalendarService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('Initializing pure Rust calendar engine via NAPI...');
      
      // Initialize Rust calendar engine
      const initResult = await initCalendarEngine();
      log.info('Pure Rust calendar engine init result:', initResult);
      
      this.isInitialized = true;
      log.info('Pure Rust calendar engine initialized successfully');
    } catch (error) {
      log.error('Failed to initialize pure Rust calendar engine:', error);
      throw error;
    }
  }

  // === Account Management (Pure NAPI) ===

  async createAccount(accountData: CreateCalendarAccountInput): Promise<CalendarAccount> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Convert TypeScript types to NAPI format
      const napiAccount = {
        id: accountData.userId, // Use user ID as account ID
        email: accountData.email || '',
        provider: accountData.provider,
        display_name: accountData.name,
        is_enabled: accountData.isEnabled !== false,
      };

      // Call Rust via NAPI
      await addCalendarAccount(napiAccount);
      
      // Return the created account (converted back from NAPI)
      return {
        id: napiAccount.id,
        userId: accountData.userId,
        provider: accountData.provider,
        name: accountData.name,
        email: accountData.email,
        isEnabled: napiAccount.is_enabled,
        config: accountData.config || {},
        status: 'active' as const,
        syncIntervalMinutes: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      log.error('Failed to create calendar account via Rust:', error);
      throw error;
    }
  }

  async getUserAccounts(userId: string): Promise<CalendarAccount[]> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Get accounts from Rust engine
      const rustAccounts = await getCalendarAccounts();
      
      // Convert NAPI format to TypeScript types
      return rustAccounts.map((rustAccount: any): CalendarAccount => ({
        id: rustAccount.id,
        userId: userId,
        provider: rustAccount.provider as CalendarProvider,
        name: rustAccount.display_name,
        email: rustAccount.email,
        isEnabled: rustAccount.is_enabled,
        config: {}, // Configuration handled in Rust
        status: 'active' as const,
        syncIntervalMinutes: 15,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      log.error('Failed to get user calendar accounts from Rust:', error);
      return [];
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Delete account via Rust NAPI
      await removeCalendarAccount(accountId);
      log.info('Deleted calendar account via Rust engine:', accountId);
    } catch (error) {
      log.error('Failed to delete calendar account via Rust:', error);
      throw error;
    }
  }

  // === Calendar Operations (Pure NAPI) ===

  async listCalendars(accountId: string): Promise<Calendar[]> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Get calendars from Rust engine
      const rustCalendars = await getRustCalendars(accountId);
      
      // Convert NAPI format to TypeScript
      return rustCalendars.map((rustCal: any) => ({
        id: rustCal.id,
        accountId: rustCal.account_id,
        name: rustCal.name,
        description: rustCal.description || '',
        color: rustCal.color || '#3174ad',
        timezone: 'UTC',
        isDefault: rustCal.is_primary || false,
        accessLevel: 'owner' as const,
        syncEnabled: true,
        source: 'remote' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      log.error('Failed to list calendars via Rust:', error);
      return [];
    }
  }

  // === Event Operations (Pure NAPI) ===

  async createEvent(eventData: CreateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Create event via Rust NAPI
      const eventId = await createRustCalendarEvent(
        eventData.calendarId,
        eventData.title,
        Math.floor(eventData.startTime.getTime() / 1000),
        Math.floor(eventData.endTime.getTime() / 1000)
      );
      
      // Return the created event
      return {
        id: eventId,
        providerId: eventId,
        calendarId: eventData.calendarId,
        title: eventData.title,
        description: eventData.description,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        timezone: 'UTC',
        isAllDay: eventData.isAllDay || false,
        status: 'confirmed' as const,
        visibility: 'default' as const,
        location: eventData.location,
        attendees: eventData.attendees || [],
        recurrence: eventData.recurrence,
        reminders: eventData.reminders || [],
        attachments: eventData.attachments || [],
        transparency: 'opaque' as const,
        uid: eventId,
        sequence: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      log.error('Failed to create calendar event via Rust:', error);
      throw error;
    }
  }

  async getEventsInRange(calendarIds: string[], timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Get events from Rust engine
      const rustEvents = await getRustCalendarEvents(calendarIds[0]); // Simplified for now
      
      // Convert NAPI format to TypeScript
      return rustEvents.map((rustEvent: any): CalendarEvent => ({
        id: rustEvent.id,
        providerId: rustEvent.id,
        calendarId: rustEvent.calendar_id,
        title: rustEvent.title,
        description: rustEvent.description,
        startTime: new Date(rustEvent.start_time * 1000),
        endTime: new Date(rustEvent.end_time * 1000),
        timezone: 'UTC',
        isAllDay: rustEvent.is_all_day,
        status: 'confirmed' as const,
        visibility: 'default' as const,
        location: rustEvent.location,
        attendees: [], // Parse from Rust format
        recurrence: undefined,
        reminders: [],
        attachments: [],
        transparency: 'opaque' as const,
        uid: rustEvent.id,
        sequence: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      log.error('Failed to get events in range via Rust:', error);
      return [];
    }
  }

  // === Sync Operations (Pure NAPI) ===

  async syncAccount(accountId: string, force: boolean = false): Promise<CalendarSyncStatus> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      log.info('Syncing calendar account via pure Rust:', accountId);
      
      // Sync via Rust NAPI
      const rustSyncStatus = await syncCalendarAccount(accountId);
      
      // Convert NAPI format to TypeScript
      return {
        accountId: rustSyncStatus.account_id,
        status: rustSyncStatus.is_syncing ? 'syncing' : 'idle',
        lastSyncAt: new Date(rustSyncStatus.last_sync || Date.now()),
        stats: {
          totalEvents: rustSyncStatus.total_events || 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
          syncErrors: rustSyncStatus.error_message ? 1 : 0
        }
      };
    } catch (error) {
      log.error('Failed to sync calendar account via Rust:', error);
      throw error;
    }
  }

  // === Utility Methods ===

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    try {
      // Shutdown handled automatically by Rust engine
      this.isInitialized = false;
      log.info('Pure Rust calendar engine shut down successfully');
    } catch (error) {
      log.error('Failed to shutdown pure Rust calendar engine:', error);
    }
  }
}

// === Service State ===
let calendarEngine: PureRustCalendarService | null = null;
let mainWindow: BrowserWindow | null = null;
let isInitialized = false;

/**
 * Initialize pure Rust calendar service
 */
export const initializeCalendarService = async (): Promise<void> => {
  if (isInitialized) {
    log.warn('Pure Rust calendar service already initialized');
    return;
  }

  try {
    log.info('Initializing pure Rust calendar service');
    
    // Initialize pure Rust calendar engine
    calendarEngine = new PureRustCalendarService();
    await calendarEngine.initialize();

    // Setup IPC handlers
    setupCalendarIPC();

    isInitialized = true;
    log.info('Pure Rust calendar service initialized successfully');
  } catch (error) {
    log.error('Failed to initialize pure Rust calendar service:', error);
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
 * Shutdown pure Rust calendar service
 */
export const shutdownCalendarService = async (): Promise<void> => {
  if (!isInitialized || !calendarEngine) {
    return;
  }

  try {
    log.info('Shutting down pure Rust calendar service');
    await calendarEngine.shutdown();
    calendarEngine = null;
    isInitialized = false;
    log.info('Pure Rust calendar service shut down successfully');
  } catch (error) {
    log.error('Error shutting down pure Rust calendar service:', error);
  }
};

/**
 * Setup IPC handlers for pure Rust calendar operations
 */
const setupCalendarIPC = (): void => {
  log.info('Setting up pure Rust calendar IPC handlers');

  // === Account Management (Pure NAPI delegation) ===

  ipcMain.handle('calendar:create-account', async (event, accountData: CreateCalendarAccountInput) => {
    try {
      log.info('Creating calendar account via pure Rust:', accountData.name);
      
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      const account = await calendarEngine.createAccount(accountData);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:account-created', account);
      
      return { success: true, data: account };
    } catch (error) {
      log.error('Error creating calendar account via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-user-accounts', async (event, userId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      const accounts = await calendarEngine.getUserAccounts(userId);
      return { success: true, data: accounts };
    } catch (error) {
      log.error('Error getting user calendar accounts via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:delete-account', async (event, accountId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      await calendarEngine.deleteAccount(accountId);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:account-deleted', { accountId });
      
      return { 
        success: true, 
        data: { 
          accountId,
          deletedAt: new Date().toISOString(),
          message: 'Calendar account deleted successfully via Rust engine' 
        } 
      };
    } catch (error) {
      log.error('Error deleting calendar account via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Calendar Operations (Pure NAPI delegation) ===

  ipcMain.handle('calendar:list-calendars', async (event, accountId: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      const calendars = await calendarEngine.listCalendars(accountId);
      return { success: true, data: calendars };
    } catch (error) {
      log.error('Error listing calendars via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Event Operations (Pure NAPI delegation) ===

  ipcMain.handle('calendar:create-event', async (event, eventData: CreateCalendarEventInput) => {
    try {
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      const createdEvent = await calendarEngine.createEvent(eventData);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:event-created', createdEvent);
      
      return { success: true, data: createdEvent };
    } catch (error) {
      log.error('Error creating calendar event via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('calendar:get-events-in-range', async (event, calendarIds: string[], timeMin: string, timeMax: string) => {
    try {
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      const events = await calendarEngine.getEventsInRange(
        calendarIds,
        new Date(timeMin),
        new Date(timeMax)
      );
      
      return { success: true, data: events };
    } catch (error) {
      log.error('Error getting events in range via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // === Sync Operations (Pure NAPI delegation) ===

  ipcMain.handle('calendar:sync-account', async (event, accountId: string, force = false) => {
    try {
      if (!calendarEngine) {
        throw new Error('Pure Rust calendar engine not initialized');
      }

      const status = await calendarEngine.syncAccount(accountId, force);
      
      // Send real-time update
      mainWindow?.webContents.send('calendar:sync-status-updated', { accountId, status });
      
      return { success: true, data: status };
    } catch (error) {
      log.error('Error syncing calendar account via pure Rust:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  log.info('Pure Rust calendar IPC handlers setup completed');
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
  sendNotification
};