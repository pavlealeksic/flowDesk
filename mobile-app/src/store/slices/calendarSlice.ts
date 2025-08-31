/**
 * Calendar Store Slice - Manages calendar accounts and events
 */

import { StateCreator } from 'zustand';

export interface CalendarAccount {
  id: string;
  provider: 'google' | 'outlook' | 'caldav' | 'exchange';
  displayName: string;
  email: string;
  isEnabled: boolean;
  lastSyncTime?: Date;
  syncError?: string;
  calendars: Calendar[];
  settings: {
    syncInterval: number;
    defaultCalendar?: string;
    showDeclined: boolean;
    timeZone: string;
  };
}

export interface Calendar {
  id: string;
  accountId: string;
  name: string;
  description?: string;
  color: string;
  isVisible: boolean;
  isWritable: boolean;
  isDefault: boolean;
  timeZone: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule?: string;
  attendees: EventAttendee[];
  organizer?: EventAttendee;
  status: 'tentative' | 'confirmed' | 'cancelled';
  visibility: 'public' | 'private' | 'confidential';
  reminders: EventReminder[];
  attachments: EventAttachment[];
  meetingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAttendee {
  email: string;
  name?: string;
  status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  isOptional: boolean;
  isOrganizer: boolean;
}

export interface EventReminder {
  method: 'email' | 'popup' | 'sms';
  minutes: number;
}

export interface EventAttachment {
  id: string;
  title: string;
  mimeType: string;
  fileUrl?: string;
  iconLink?: string;
}

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

export interface CalendarSlice {
  // State
  accounts: CalendarAccount[];
  events: CalendarEvent[];
  activeAccountId: string | null;
  currentView: CalendarView;
  currentDate: Date;
  selectedEventId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  
  // Account management
  addAccount: (account: Omit<CalendarAccount, 'id' | 'calendars'>) => Promise<string>;
  updateAccount: (id: string, updates: Partial<CalendarAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  setActiveAccount: (id: string) => void;
  syncAccount: (id: string) => Promise<void>;
  syncAllAccounts: () => Promise<void>;
  
  // Event management
  loadEvents: (startDate: Date, endDate: Date) => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  respondToEvent: (id: string, response: 'accepted' | 'declined' | 'tentative') => Promise<void>;
  
  // UI state
  setCurrentView: (view: CalendarView) => void;
  setCurrentDate: (date: Date) => void;
  setSelectedEvent: (eventId: string | null) => void;
  navigateToDate: (date: Date) => void;
  navigateNext: () => void;
  navigatePrevious: () => void;
  navigateToday: () => void;
  
  // Utility functions
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsForDateRange: (startDate: Date, endDate: Date) => CalendarEvent[];
  hasEventsOnDate: (date: Date) => boolean;
}

export const createCalendarStore: StateCreator<
  any,
  [],
  [],
  CalendarSlice
> = (set, get) => ({
  // Initial state
  accounts: [],
  events: [],
  activeAccountId: null,
  currentView: 'month',
  currentDate: new Date(),
  selectedEventId: null,
  isLoading: false,
  isSyncing: false,
  error: null,
  
  // Account management
  addAccount: async (accountData) => {
    const id = `cal_account_${Date.now()}`;
    const account: CalendarAccount = {
      ...accountData,
      id,
      calendars: [
        {
          id: `cal_${id}_primary`,
          accountId: id,
          name: 'Calendar',
          color: '#1976d2',
          isVisible: true,
          isWritable: true,
          isDefault: true,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      ],
    };
    
    set((state: any) => {
      state.accounts.push(account);
      if (!state.activeAccountId) {
        state.activeAccountId = id;
      }
    });
    
    await get().syncAccount(id);
    return id;
  },
  
  updateAccount: async (id, updates) => {
    set((state: any) => {
      const index = state.accounts.findIndex((a: CalendarAccount) => a.id === id);
      if (index >= 0) {
        state.accounts[index] = { ...state.accounts[index], ...updates };
      }
    });
  },
  
  removeAccount: async (id) => {
    set((state: any) => {
      state.accounts = state.accounts.filter((a: CalendarAccount) => a.id !== id);
      state.events = state.events.filter((e: CalendarEvent) => {
        const calendar = state.accounts.find((a: CalendarAccount) => 
          a.calendars.some(c => c.id === e.calendarId)
        );
        return calendar?.id !== id;
      });
      
      if (state.activeAccountId === id) {
        state.activeAccountId = state.accounts[0]?.id || null;
      }
    });
  },
  
  setActiveAccount: (id) => {
    set((state: any) => {
      state.activeAccountId = id;
    });
  },
  
  syncAccount: async (id) => {
    set((state: any) => {
      state.isSyncing = true;
      state.error = null;
    });
    
    try {
      // Mock sync
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const account = get().accounts.find(a => a.id === id);
      if (account && account.calendars.length > 0) {
        // Generate mock events
        const mockEvents: CalendarEvent[] = [
          {
            id: `event_${Date.now()}_1`,
            calendarId: account.calendars[0].id,
            title: 'Team Meeting',
            description: 'Weekly team sync',
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour
            isAllDay: false,
            isRecurring: false,
            attendees: [],
            status: 'confirmed',
            visibility: 'public',
            reminders: [{ method: 'popup', minutes: 15 }],
            attachments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        
        set((state: any) => {
          // Remove old events for this account
          const calendarIds = account.calendars.map(c => c.id);
          state.events = state.events.filter((e: CalendarEvent) => 
            !calendarIds.includes(e.calendarId)
          );
          
          // Add new events
          state.events.push(...mockEvents);
          
          // Update sync time
          const accountIndex = state.accounts.findIndex((a: CalendarAccount) => a.id === id);
          if (accountIndex >= 0) {
            state.accounts[accountIndex].lastSyncTime = new Date();
          }
        });
      }
      
      set((state: any) => {
        state.isSyncing = false;
      });
    } catch (error) {
      set((state: any) => {
        state.isSyncing = false;
        state.error = error instanceof Error ? error.message : 'Sync failed';
      });
    }
  },
  
  syncAllAccounts: async () => {
    const accounts = get().accounts.filter(a => a.isEnabled);
    await Promise.all(accounts.map(account => get().syncAccount(account.id)));
  },
  
  // Event management
  loadEvents: async (startDate, endDate) => {
    set((state: any) => {
      state.isLoading = true;
      state.error = null;
    });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      set((state: any) => {
        state.isLoading = false;
      });
    } catch (error) {
      set((state: any) => {
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Failed to load events';
      });
    }
  },
  
  createEvent: async (eventData) => {
    const id = `event_${Date.now()}`;
    const event: CalendarEvent = {
      ...eventData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state: any) => {
      state.events.push(event);
    });
    
    return id;
  },
  
  updateEvent: async (id, updates) => {
    set((state: any) => {
      const index = state.events.findIndex((e: CalendarEvent) => e.id === id);
      if (index >= 0) {
        state.events[index] = {
          ...state.events[index],
          ...updates,
          updatedAt: new Date(),
        };
      }
    });
  },
  
  deleteEvent: async (id) => {
    set((state: any) => {
      state.events = state.events.filter((e: CalendarEvent) => e.id !== id);
      if (state.selectedEventId === id) {
        state.selectedEventId = null;
      }
    });
  },
  
  respondToEvent: async (id, response) => {
    await get().updateEvent(id, {
      attendees: get().events.find(e => e.id === id)?.attendees.map(attendee => 
        attendee.email === get().accounts.find(a => a.id === get().activeAccountId)?.email
          ? { ...attendee, status: response }
          : attendee
      ) || [],
    });
  },
  
  // UI state
  setCurrentView: (view) => {
    set((state: any) => {
      state.currentView = view;
    });
  },
  
  setCurrentDate: (date) => {
    set((state: any) => {
      state.currentDate = date;
    });
  },
  
  setSelectedEvent: (eventId) => {
    set((state: any) => {
      state.selectedEventId = eventId;
    });
  },
  
  navigateToDate: (date) => {
    get().setCurrentDate(date);
  },
  
  navigateNext: () => {
    const currentDate = get().currentDate;
    const currentView = get().currentView;
    let newDate: Date;
    
    switch (currentView) {
      case 'day':
        newDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'week':
        newDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        break;
      case 'agenda':
        newDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        newDate = currentDate;
    }
    
    get().setCurrentDate(newDate);
  },
  
  navigatePrevious: () => {
    const currentDate = get().currentDate;
    const currentView = get().currentView;
    let newDate: Date;
    
    switch (currentView) {
      case 'day':
        newDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        newDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        break;
      case 'agenda':
        newDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        newDate = currentDate;
    }
    
    get().setCurrentDate(newDate);
  },
  
  navigateToday: () => {
    get().setCurrentDate(new Date());
  },
  
  // Utility functions
  getEventsForDate: (date) => {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    
    return get().events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      return (eventStart <= endOfDay && eventEnd >= startOfDay) ||
             (event.isAllDay && eventStart.toDateString() === date.toDateString());
    });
  },
  
  getEventsForDateRange: (startDate, endDate) => {
    return get().events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      return eventStart <= endDate && eventEnd >= startDate;
    });
  },
  
  hasEventsOnDate: (date) => {
    return get().getEventsForDate(date).length > 0;
  },
});