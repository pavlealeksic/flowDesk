import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import type {
  CalendarAccount,
  CalendarEvent,
  Calendar,
  CreateCalendarAccountInput,
  UpdateCalendarAccountInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarSyncStatus,
  CalendarPrivacySync,
  MeetingProposal,
  FreeBusySlot,
  EventReminder,
  ReminderMethod
} from '@flow-desk/shared'

// Declare global window interface for calendar API

// Async thunks for calendar operations
export const fetchUserAccounts = createAsyncThunk(
  'calendar/fetchUserAccounts',
  async (userId: string, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.getUserAccounts(userId);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch accounts');
      }
      return result.data || [];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const createCalendarAccount = createAsyncThunk(
  'calendar/createAccount',
  async (accountData: CreateCalendarAccountInput, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.createAccount(accountData);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to create account');
      }
      return result.data!;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const updateCalendarAccount = createAsyncThunk(
  'calendar/updateAccount',
  async ({ accountId, updates }: { accountId: string; updates: UpdateCalendarAccountInput }, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.updateAccount(accountId, updates);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update account');
      }
      return result.data!;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const deleteCalendarAccount = createAsyncThunk(
  'calendar/deleteAccount',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.deleteAccount(accountId);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to delete account');
      }
      return accountId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchCalendars = createAsyncThunk(
  'calendar/fetchCalendars',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.listCalendars(accountId);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch calendars');
      }
      return { accountId, calendars: result.data || [] };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchEventsInRange = createAsyncThunk(
  'calendar/fetchEventsInRange',
  async ({ calendarIds, timeMin, timeMax }: { calendarIds: string[]; timeMin: Date; timeMax: Date }, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.getEventsInRange(
        calendarIds,
        timeMin.toISOString(),
        timeMax.toISOString()
      );
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch events');
      }
      return { calendarIds, events: result.data || [] };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const createCalendarEvent = createAsyncThunk(
  'calendar/createEvent',
  async (eventData: CreateCalendarEventInput, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.createEvent(eventData);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to create event');
      }
      return result.data!;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const updateCalendarEvent = createAsyncThunk(
  'calendar/updateEvent',
  async ({ calendarId, eventId, updates }: { calendarId: string; eventId: string; updates: UpdateCalendarEventInput }, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.updateEvent(calendarId, eventId, updates);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update event');
      }
      return result.data!;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const deleteCalendarEvent = createAsyncThunk(
  'calendar/deleteEvent',
  async ({ calendarId, eventId }: { calendarId: string; eventId: string }, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.deleteEvent(calendarId, eventId);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to delete event');
      }
      return { calendarId, eventId };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const syncCalendarAccount = createAsyncThunk(
  'calendar/syncAccount',
  async ({ accountId, force = false }: { accountId: string; force?: boolean }, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.syncAccount(accountId, force);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to sync account');
      }
      return { accountId, status: result.data! };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const searchCalendarEvents = createAsyncThunk(
  'calendar/searchEvents',
  async ({ query, limit }: { query: string; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await window.flowDesk.calendar.searchEvents(query, limit);
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to search events');
      }
      return { query, events: result.data || [] };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// Extended calendar types for comprehensive features
interface EventTemplate {
  id: string
  name: string
  title: string
  description?: string
  location?: string
  duration: number // in minutes
  reminders: EventReminder[]
  attendees?: string[]
  category: string
  color?: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

interface ConflictingEvent {
  eventId: string
  conflictingEventIds: string[]
  severity: 'overlap' | 'double_booked' | 'travel_conflict'
  resolved: boolean
  suggestedActions: Array<{
    type: 'move' | 'shorten' | 'decline'
    description: string
  }>
}

interface CalendarSettings {
  workWeekStart: 'sunday' | 'monday'
  timeFormat: '12h' | '24h'
  weekendVisible: boolean
  defaultDuration: number
  defaultReminders: EventReminder[]
  autoDeclineConflicts: boolean
  showDeclinedEvents: boolean
}

interface CalendarNotification {
  id: string
  type: 'event_reminder' | 'meeting_invitation' | 'event_update' | 'conflict_detected'
  title: string
  message: string
  eventId?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  timestamp: Date
  read: boolean
  actionable: boolean
  actions?: Array<{
    type: string
    label: string
    handler: string
  }>
}

interface PrintSettings {
  layout: 'day' | 'week' | 'month' | 'agenda'
  includeWeekends: boolean
  colorPrint: boolean
  showDetails: boolean
}

interface FocusTimeSlot {
  id: string
  title: string
  startTime: Date
  endTime: Date
  calendarIds: string[]
  blockInterruptions: boolean
  autoDecline: boolean
  status: 'active' | 'inactive'
  createdAt: Date
}

interface WorkingHours {
  monday: DayWorkingHours
  tuesday: DayWorkingHours
  wednesday: DayWorkingHours
  thursday: DayWorkingHours
  friday: DayWorkingHours
  saturday: DayWorkingHours
  sunday: DayWorkingHours
}

interface DayWorkingHours {
  start: string // HH:MM format
  end: string // HH:MM format
  enabled: boolean
}

interface CalendarState {
  accounts: CalendarAccount[]
  calendars: Record<string, Calendar[]> // calendars by account ID
  events: Record<string, CalendarEvent[]> // events by calendar ID
  currentView: 'day' | 'week' | 'month' | 'year' | 'agenda' | 'timeline'
  currentDate: string
  selectedEventIds: string[]
  visibleCalendars: string[]
  isLoading: boolean
  error: string | null
  syncStatus: Record<string, CalendarSyncStatus>
  privacySyncRules: CalendarPrivacySync[]
  searchQuery: string
  searchResults: CalendarEvent[]
  eventTemplates: EventTemplate[]
  meetingProposals: MeetingProposal[]
  conflictingEvents: ConflictingEvent[]
  freeBusyData: Record<string, FreeBusySlot[]>
  selectedDateRange: { start: Date; end: Date } | null
  calendarSettings: CalendarSettings
  notifications: CalendarNotification[]
  printSettings: PrintSettings
  focusTime: FocusTimeSlot[]
  travelTimeEnabled: boolean
  smartSchedulingEnabled: boolean
  workingHours: WorkingHours
  timeZone: string
}

const initialState: CalendarState = {
  accounts: [],
  calendars: {},
  events: {},
  currentView: 'week',
  currentDate: new Date().toISOString().split('T')[0],
  selectedEventIds: [],
  visibleCalendars: [],
  isLoading: false,
  error: null,
  syncStatus: {},
  privacySyncRules: [],
  searchQuery: '',
  searchResults: [],
  eventTemplates: [],
  meetingProposals: [],
  conflictingEvents: [],
  freeBusyData: {},
  selectedDateRange: null,
  calendarSettings: {
    workWeekStart: 'monday',
    timeFormat: '12h',
    weekendVisible: true,
    defaultDuration: 60,
    defaultReminders: [{ method: 'popup', minutesBefore: 15 }],
    autoDeclineConflicts: false,
    showDeclinedEvents: false
  },
  notifications: [],
  printSettings: {
    layout: 'week',
    includeWeekends: true,
    colorPrint: true,
    showDetails: true
  },
  focusTime: [],
  travelTimeEnabled: true,
  smartSchedulingEnabled: true,
  workingHours: {
    monday: { start: '09:00', end: '17:00', enabled: true },
    tuesday: { start: '09:00', end: '17:00', enabled: true },
    wednesday: { start: '09:00', end: '17:00', enabled: true },
    thursday: { start: '09:00', end: '17:00', enabled: true },
    friday: { start: '09:00', end: '17:00', enabled: true },
    saturday: { start: '09:00', end: '17:00', enabled: false },
    sunday: { start: '09:00', end: '17:00', enabled: false }
  },
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
}

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setCurrentView: (state, action: PayloadAction<'day' | 'week' | 'month' | 'year' | 'agenda' | 'timeline'>) => {
      state.currentView = action.payload
    },
    setCurrentDate: (state, action: PayloadAction<string>) => {
      state.currentDate = action.payload
    },
    setSelectedEvents: (state, action: PayloadAction<string[]>) => {
      state.selectedEventIds = action.payload
    },
    toggleEventSelection: (state, action: PayloadAction<string>) => {
      const eventId = action.payload
      const index = state.selectedEventIds.indexOf(eventId)
      if (index > -1) {
        state.selectedEventIds.splice(index, 1)
      } else {
        state.selectedEventIds.push(eventId)
      }
    },
    setVisibleCalendars: (state, action: PayloadAction<string[]>) => {
      state.visibleCalendars = action.payload
    },
    toggleCalendarVisibility: (state, action: PayloadAction<string>) => {
      const calendarId = action.payload
      const index = state.visibleCalendars.indexOf(calendarId)
      if (index > -1) {
        state.visibleCalendars.splice(index, 1)
      } else {
        state.visibleCalendars.push(calendarId)
      }
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    clearSearchResults: (state) => {
      state.searchResults = []
      state.searchQuery = ''
    },
    clearError: (state) => {
      state.error = null
    },
    // Real-time updates from IPC
    accountCreated: (state, action: PayloadAction<CalendarAccount>) => {
      state.accounts.push(action.payload)
    },
    accountUpdated: (state, action: PayloadAction<CalendarAccount>) => {
      const index = state.accounts.findIndex(account => account.id === action.payload.id)
      if (index !== -1) {
        state.accounts[index] = action.payload
      }
    },
    accountDeleted: (state, action: PayloadAction<{ accountId: string }>) => {
      state.accounts = state.accounts.filter(account => account.id !== action.payload.accountId)
      delete state.calendars[action.payload.accountId]
      // Remove events from deleted account's calendars
      Object.keys(state.events).forEach(calendarId => {
        const calendar = Object.values(state.calendars).flat().find(cal => cal.id === calendarId)
        if (!calendar || calendar.accountId === action.payload.accountId) {
          delete state.events[calendarId]
        }
      })
    },
    eventCreated: (state, action: PayloadAction<CalendarEvent>) => {
      const event = action.payload
      if (!state.events[event.calendarId]) {
        state.events[event.calendarId] = []
      }
      state.events[event.calendarId].push(event)
    },
    eventUpdated: (state, action: PayloadAction<CalendarEvent>) => {
      const event = action.payload
      const calendarEvents = state.events[event.calendarId]
      if (calendarEvents) {
        const index = calendarEvents.findIndex(e => e.id === event.id)
        if (index !== -1) {
          calendarEvents[index] = event
        }
      }
    },
    eventDeleted: (state, action: PayloadAction<{ calendarId: string; eventId: string }>) => {
      const { calendarId, eventId } = action.payload
      const calendarEvents = state.events[calendarId]
      if (calendarEvents) {
        state.events[calendarId] = calendarEvents.filter(event => event.id !== eventId)
      }
    },
    syncStatusUpdated: (state, action: PayloadAction<{ accountId: string; status: CalendarSyncStatus }>) => {
      const { accountId, status } = action.payload
      state.syncStatus[accountId] = status
    },
    // Extended calendar actions
    setSelectedDateRange: (state, action: PayloadAction<{ start: Date; end: Date } | null>) => {
      state.selectedDateRange = action.payload
    },
    setTimeZone: (state, action: PayloadAction<string>) => {
      state.timeZone = action.payload
    },
    updateCalendarSettings: (state, action: PayloadAction<Partial<CalendarSettings>>) => {
      state.calendarSettings = { ...state.calendarSettings, ...action.payload }
    },
    addEventTemplate: (state, action: PayloadAction<EventTemplate>) => {
      state.eventTemplates.push(action.payload)
    },
    updateEventTemplate: (state, action: PayloadAction<EventTemplate>) => {
      const index = state.eventTemplates.findIndex(t => t.id === action.payload.id)
      if (index !== -1) {
        state.eventTemplates[index] = action.payload
      }
    },
    deleteEventTemplate: (state, action: PayloadAction<string>) => {
      state.eventTemplates = state.eventTemplates.filter(t => t.id !== action.payload)
    },
    addMeetingProposal: (state, action: PayloadAction<MeetingProposal>) => {
      state.meetingProposals.push(action.payload)
    },
    updateMeetingProposal: (state, action: PayloadAction<MeetingProposal>) => {
      const index = state.meetingProposals.findIndex(p => p.id === action.payload.id)
      if (index !== -1) {
        state.meetingProposals[index] = action.payload
      }
    },
    addConflictingEvent: (state, action: PayloadAction<ConflictingEvent>) => {
      state.conflictingEvents.push(action.payload)
    },
    resolveConflict: (state, action: PayloadAction<string>) => {
      const conflict = state.conflictingEvents.find(c => c.eventId === action.payload)
      if (conflict) {
        conflict.resolved = true
      }
    },
    updateFreeBusyData: (state, action: PayloadAction<{ email: string; slots: FreeBusySlot[] }>) => {
      const { email, slots } = action.payload
      state.freeBusyData[email] = slots
    },
    addNotification: (state, action: PayloadAction<CalendarNotification>) => {
      state.notifications.unshift(action.payload)
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100)
      }
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.read = true
      }
    },
    clearNotifications: (state) => {
      state.notifications = []
    },
    addFocusTime: (state, action: PayloadAction<FocusTimeSlot>) => {
      state.focusTime.push(action.payload)
    },
    updateFocusTime: (state, action: PayloadAction<FocusTimeSlot>) => {
      const index = state.focusTime.findIndex(f => f.id === action.payload.id)
      if (index !== -1) {
        state.focusTime[index] = action.payload
      }
    },
    deleteFocusTime: (state, action: PayloadAction<string>) => {
      state.focusTime = state.focusTime.filter(f => f.id !== action.payload)
    },
    toggleTravelTime: (state) => {
      state.travelTimeEnabled = !state.travelTimeEnabled
    },
    toggleSmartScheduling: (state) => {
      state.smartSchedulingEnabled = !state.smartSchedulingEnabled
    },
    updateWorkingHours: (state, action: PayloadAction<WorkingHours>) => {
      state.workingHours = action.payload
    },
    updatePrintSettings: (state, action: PayloadAction<PrintSettings>) => {
      state.printSettings = action.payload
    }
  },
  extraReducers: (builder) => {
    // Fetch user accounts
    builder
      .addCase(fetchUserAccounts.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchUserAccounts.fulfilled, (state, action) => {
        state.isLoading = false
        state.accounts = action.payload as any
      })
      .addCase(fetchUserAccounts.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Create account
    builder
      .addCase(createCalendarAccount.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createCalendarAccount.fulfilled, (state, action) => {
        state.isLoading = false
        state.accounts.push(action.payload as any)
      })
      .addCase(createCalendarAccount.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Update account
    builder
      .addCase(updateCalendarAccount.fulfilled, (state, action) => {
        const index = state.accounts.findIndex(account => account.id === action.payload.id)
        if (index !== -1) {
          state.accounts[index] = action.payload as any
        }
      })
      .addCase(updateCalendarAccount.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Delete account
    builder
      .addCase(deleteCalendarAccount.fulfilled, (state, action) => {
        const accountId = action.payload
        state.accounts = state.accounts.filter(account => account.id !== accountId)
        delete state.calendars[accountId]
        // Remove events from deleted account's calendars
        Object.keys(state.events).forEach(calendarId => {
          const calendar = Object.values(state.calendars).flat().find(cal => cal.id === calendarId)
          if (!calendar || calendar.accountId === accountId) {
            delete state.events[calendarId]
          }
        })
      })
      .addCase(deleteCalendarAccount.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Fetch calendars
    builder
      .addCase(fetchCalendars.fulfilled, (state, action) => {
        const { accountId, calendars } = action.payload
        state.calendars[accountId] = calendars as any
      })
      .addCase(fetchCalendars.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Fetch events in range
    builder
      .addCase(fetchEventsInRange.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchEventsInRange.fulfilled, (state, action) => {
        state.isLoading = false
        const { calendarIds, events } = action.payload
        
        // Group events by calendar ID
        const eventsByCalendar: Record<string, CalendarEvent[]> = {}
        events.forEach(event => {
          if (!eventsByCalendar[event.calendarId]) {
            eventsByCalendar[event.calendarId] = []
          }
          eventsByCalendar[event.calendarId].push(event as any)
        })
        
        // Update state with new events
        calendarIds.forEach(calendarId => {
          state.events[calendarId] = eventsByCalendar[calendarId] || []
        })
      })
      .addCase(fetchEventsInRange.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Create event
    builder
      .addCase(createCalendarEvent.fulfilled, (state, action) => {
        const event = action.payload
        if (!state.events[event.calendarId]) {
          state.events[event.calendarId] = []
        }
        state.events[event.calendarId].push(event as any)
      })
      .addCase(createCalendarEvent.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Update event
    builder
      .addCase(updateCalendarEvent.fulfilled, (state, action) => {
        const event = action.payload
        const calendarEvents = state.events[event.calendarId]
        if (calendarEvents) {
          const index = calendarEvents.findIndex(e => e.id === event.id)
          if (index !== -1) {
            calendarEvents[index] = event as any
          }
        }
      })
      .addCase(updateCalendarEvent.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Delete event
    builder
      .addCase(deleteCalendarEvent.fulfilled, (state, action) => {
        const { calendarId, eventId } = action.payload
        const calendarEvents = state.events[calendarId]
        if (calendarEvents) {
          state.events[calendarId] = calendarEvents.filter(event => event.id !== eventId)
        }
      })
      .addCase(deleteCalendarEvent.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Sync account
    builder
      .addCase(syncCalendarAccount.fulfilled, (state, action) => {
        const { accountId, status } = action.payload
        state.syncStatus[accountId] = status
      })
      .addCase(syncCalendarAccount.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Search events
    builder
      .addCase(searchCalendarEvents.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(searchCalendarEvents.fulfilled, (state, action) => {
        state.isLoading = false
        const { query, events } = action.payload
        state.searchQuery = query
        state.searchResults = events as any
      })
      .addCase(searchCalendarEvents.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  }
})

export const {
  setLoading,
  setError,
  setCurrentView,
  setCurrentDate,
  setSelectedEvents,
  toggleEventSelection,
  setVisibleCalendars,
  toggleCalendarVisibility,
  setSearchQuery,
  clearSearchResults,
  clearError,
  accountCreated,
  accountUpdated,
  accountDeleted,
  eventCreated,
  eventUpdated,
  eventDeleted,
  syncStatusUpdated,
  setSelectedDateRange,
  setTimeZone,
  updateCalendarSettings,
  addEventTemplate,
  updateEventTemplate,
  deleteEventTemplate,
  addMeetingProposal,
  updateMeetingProposal,
  addConflictingEvent,
  resolveConflict,
  updateFreeBusyData,
  addNotification,
  markNotificationRead,
  clearNotifications,
  addFocusTime,
  updateFocusTime,
  deleteFocusTime,
  toggleTravelTime,
  toggleSmartScheduling,
  updateWorkingHours,
  updatePrintSettings
} = calendarSlice.actions

export default calendarSlice.reducer