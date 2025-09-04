/**
 * Pure Rust Calendar Engine Proxy
 * 
 * Delegates all calendar operations to the pure Rust backend via NAPI bindings.
 * This TypeScript layer is a minimal wrapper with no business logic.
 */

import type {
  CalendarAccount,
  CalendarEvent,
  Calendar,
  CreateCalendarAccountInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarProvider,
  CalendarAccountConfig,
} from '@flow-desk/shared/types/calendar';

// Import Rust NAPI calendar functions
import {
  initCalendarEngine,
  addCalendarAccount,
  removeCalendarAccount,
  getCalendarAccounts,
  getCalendars as getRustCalendars,
  getCalendarEvents as getRustCalendarEvents,
  createCalendarEvent as createRustCalendarEvent,
  syncCalendarAccount,
} from '@flow-desk/shared-rust';

import log from 'electron-log';

// Legacy interfaces for backward compatibility
export interface LegacyCalendarAccount {
  id: string;
  email: string;
  provider: string;
  displayName: string;
  isEnabled: boolean;
}

export interface LegacyCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  attendees: string[];
  location?: string;
}

export interface LegacyCalendar {
  id: string;
  accountId: string;
  name: string;
  description?: string;
  color: string;
  isPrimary: boolean;
}

/**
 * Pure Rust Calendar Engine Proxy
 * All operations are delegated to Rust backend
 */
export class PureRustCalendarEngine {
  private isInitialized = false;

  /**
   * Initialize Rust calendar engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('Initializing pure Rust calendar engine proxy...');
      await initCalendarEngine();
      this.isInitialized = true;
      log.info('Pure Rust calendar engine proxy initialized');
    } catch (error) {
      log.error('Failed to initialize pure Rust calendar engine proxy:', error);
      throw error;
    }
  }

  /**
   * Add calendar account via Rust backend
   */
  async addAccount(accountData: CreateCalendarAccountInput | LegacyCalendarAccount): Promise<CalendarAccount> {
    await this.ensureInitialized();
    
    // Handle legacy interface
    let napiAccount;
    if ('userId' in accountData) {
      napiAccount = {
        id: accountData.userId,
        email: accountData.email || '',
        provider: accountData.provider,
        display_name: accountData.name,
        is_enabled: accountData.isEnabled !== false,
      };
    } else {
      // Legacy CalendarAccount interface
      napiAccount = {
        id: accountData.id,
        email: accountData.email,
        provider: accountData.provider,
        display_name: accountData.displayName,
        is_enabled: accountData.isEnabled,
      };
    }

    await addCalendarAccount(napiAccount);

    return {
      id: napiAccount.id,
      userId: napiAccount.id,
      provider: napiAccount.provider as CalendarProvider,
      name: napiAccount.display_name,
      email: napiAccount.email,
      isEnabled: napiAccount.is_enabled,
      config: {
        provider: napiAccount.provider as CalendarProvider
      } as CalendarAccountConfig,
      status: 'active' as const,
      syncIntervalMinutes: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Remove calendar account via Rust backend
   */
  async removeAccount(accountId: string): Promise<void> {
    await this.ensureInitialized();
    await removeCalendarAccount(accountId);
  }

  /**
   * Get calendar account by ID (fetch from Rust backend)
   */
  getAccount(accountId: string): CalendarAccount | LegacyCalendarAccount | undefined {
    // This will need to be made async to fetch from Rust
    // For now, return undefined to maintain compatibility
    return undefined;
  }

  /**
   * Get all accounts via Rust backend
   */
  async getAccounts(): Promise<CalendarAccount[]> {
    await this.ensureInitialized();
    
    const rustAccounts = await getCalendarAccounts();
    return rustAccounts.map((rustAccount: any) => ({
      id: rustAccount.id,
      userId: rustAccount.id,
      provider: rustAccount.provider as CalendarProvider,
      name: rustAccount.display_name,
      email: rustAccount.email,
      isEnabled: rustAccount.is_enabled,
      config: {
        provider: rustAccount.provider as CalendarProvider
      } as CalendarAccountConfig,
      status: 'active' as const,
      syncIntervalMinutes: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Get calendars for account via Rust backend
   */
  async getCalendars(accountId: string): Promise<Calendar[]> {
    await this.ensureInitialized();
    
    try {
      const rustCalendars = await getRustCalendars(accountId);
      return rustCalendars.map((rustCal: any): Calendar => ({
        id: rustCal.id,
        accountId: rustCal.account_id || accountId,
        providerId: rustCal.id,
        name: rustCal.name,
        description: rustCal.description || undefined,
        color: rustCal.color || '#3174ad',
        timezone: rustCal.timezone || 'UTC',
        isPrimary: rustCal.is_primary || false,
        accessLevel: 'owner' as const,
        isVisible: true,
        canSync: true,
        type: rustCal.is_primary ? 'primary' : 'secondary',
        isSelected: true,
        syncStatus: {
          isBeingSynced: false
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    } catch (error) {
      log.warn('Failed to get calendars from Rust backend:', error);
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        log.info('Calendar functionality not fully implemented in Rust backend yet');
      }
      return [];
    }
  }

  /**
   * Get events for account via Rust backend
   */
  async getEvents(accountId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[] | LegacyCalendarEvent[]> {
    await this.ensureInitialized();
    
    try {
      // Get calendars first, then get events for all calendars
      const calendars = await this.getCalendars(accountId);
      if (calendars.length === 0) {
        log.info(`No calendars found for account ${accountId}`);
        return [];
      }
      
      // For now, get events from the first calendar
      const rustEvents = await getRustCalendarEvents(calendars[0].id);
      
      return rustEvents
        .map((rustEvent: any): CalendarEvent => ({
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
          attendees: [], // Convert from Rust format
          recurrence: undefined,
          reminders: [],
          attachments: [],
          transparency: 'opaque' as const,
          uid: rustEvent.id,
          sequence: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
        .filter(event => {
          // Apply date filtering if provided
          if (startDate && endDate) {
            return event.startTime >= startDate && event.endTime <= endDate;
          }
          return true;
        });
    } catch (error) {
      log.warn('Failed to get events from Rust backend:', error);
      if (error instanceof Error && error.message.includes('not yet implemented')) {
        log.info('Calendar events functionality not fully implemented in Rust backend yet');
      }
      return [];
    }
  }

  /**
   * Create event via Rust backend
   */
  async createEvent(data: CreateCalendarEventInput | any): Promise<CalendarEvent | LegacyCalendarEvent> {
    await this.ensureInitialized();
    
    // Handle both modern and legacy interfaces
    const calendarId = data.calendarId;
    const title = data.title;
    const startTime = data.startTime;
    const endTime = data.endTime;
    
    const eventId = await createRustCalendarEvent(
      calendarId,
      title,
      Math.floor(startTime.getTime() / 1000),
      Math.floor(endTime.getTime() / 1000)
    );

    // Return in legacy format for backward compatibility
    return {
      id: eventId,
      providerId: eventId,
      calendarId: calendarId,
      title: title,
      description: data.description,
      startTime: startTime,
      endTime: endTime,
      timezone: 'UTC',
      isAllDay: data.isAllDay || false,
      status: 'confirmed' as const,
      visibility: 'default' as const,
      location: data.location,
      attendees: data.attendees || [],
      recurrence: data.recurrence,
      reminders: data.reminders || [],
      attachments: data.attachments || [],
      transparency: 'opaque' as const,
      uid: eventId,
      sequence: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update event via Rust backend
   * TODO: Implement updateCalendarEvent in Rust NAPI bindings
   */
  async updateEvent(eventId: string, updates: UpdateCalendarEventInput | Partial<LegacyCalendarEvent>): Promise<CalendarEvent | LegacyCalendarEvent> {
    await this.ensureInitialized();
    
    // For now, throw an error as this needs to be implemented in Rust
    throw new Error('Update event not yet implemented in Rust backend');
  }

  /**
   * Delete event via Rust backend
   * TODO: Implement deleteCalendarEvent in Rust NAPI bindings
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.ensureInitialized();
    
    // For now, throw an error as this needs to be implemented in Rust
    throw new Error('Delete event not yet implemented in Rust backend');
  }

  /**
   * Sync account via Rust backend
   */
  async syncAccount(accountId: string): Promise<any> {
    await this.ensureInitialized();
    return await syncCalendarAccount(accountId);
  }

  /**
   * Ensure Rust engine is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

// Export singleton instance
export const pureRustCalendarEngine = new PureRustCalendarEngine();

// Keep the old interface for backward compatibility, but delegate to Rust
export class CalendarEngine extends PureRustCalendarEngine {
  // Legacy interface - all methods inherited from PureRustCalendarEngine
  // No in-memory storage - everything delegated to Rust backend
}

export const calendarEngine = new CalendarEngine();