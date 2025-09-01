import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { CalendarViews } from '../CalendarViews'
import { EventManager } from '../EventManager'
import { SmartSchedulingAssistant } from '../SmartSchedulingAssistant'
import { CalendarNotificationCenter } from '../CalendarNotificationCenter'
import { CalendarProviderManager } from '../CalendarProviderManager'
import { EmailCalendarIntegration } from '../EmailCalendarIntegration'
import calendarReducer from '../../../store/slices/calendarSlice'
import type { CalendarEvent, CalendarAccount, Calendar } from '@flow-desk/shared'
import dayjs from 'dayjs'

// Mock data
const mockCalendar: Calendar = {
  id: 'cal-1',
  accountId: 'acc-1',
  providerId: 'google-cal-1',
  name: 'Test Calendar',
  description: 'Test calendar description',
  color: '#3b82f6',
  timezone: 'America/New_York',
  isPrimary: true,
  accessLevel: 'owner',
  isVisible: true,
  canSync: true,
  type: 'primary',
  isSelected: true,
  syncStatus: {
    lastSyncAt: new Date(),
    isBeingSynced: false
  },
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockAccount: CalendarAccount = {
  id: 'acc-1',
  userId: 'user-1',
  name: 'Test Google Account',
  email: 'test@gmail.com',
  provider: 'google',
  config: {
    provider: 'google',
    clientId: 'test-client-id',
    scopes: ['calendar.readonly', 'calendar'],
    enablePushNotifications: true
  },
  status: 'active',
  syncIntervalMinutes: 15,
  isEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockEvent: CalendarEvent = {
  id: 'event-1',
  calendarId: 'cal-1',
  providerId: 'google-event-1',
  title: 'Test Meeting',
  description: 'A test meeting event',
  location: 'Conference Room A',
  startTime: dayjs().add(1, 'hour').toDate(),
  endTime: dayjs().add(2, 'hour').toDate(),
  isAllDay: false,
  status: 'confirmed',
  visibility: 'default',
  attendees: [
    {
      email: 'attendee@example.com',
      displayName: 'Test Attendee',
      responseStatus: 'needsAction',
      optional: false,
      isResource: false
    }
  ],
  reminders: [
    {
      method: 'popup',
      minutesBefore: 15
    }
  ],
  conferencing: {
    solution: 'zoom',
    joinUrl: 'https://zoom.us/j/123456789',
    meetingId: '123456789'
  },
  attachments: [],
  transparency: 'opaque',
  uid: 'test-event-uid',
  sequence: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      calendar: calendarReducer
    },
    preloadedState: {
      calendar: {
        accounts: [mockAccount],
        calendars: { 'acc-1': [mockCalendar] },
        events: { 'cal-1': [mockEvent] },
        currentView: 'week',
        currentDate: dayjs().format('YYYY-MM-DD'),
        selectedEventIds: [],
        visibleCalendars: ['cal-1'],
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
        timeZone: 'America/New_York',
        ...initialState
      }
    }
  })
}

// Mock window.flowDesk API
const mockFlowDeskAPI = {
  calendar: {
    getUserAccounts: jest.fn().mockResolvedValue({ success: true, data: [mockAccount] }),
    createAccount: jest.fn().mockResolvedValue({ success: true, data: mockAccount }),
    updateAccount: jest.fn().mockResolvedValue({ success: true, data: mockAccount }),
    deleteAccount: jest.fn().mockResolvedValue({ success: true }),
    listCalendars: jest.fn().mockResolvedValue({ success: true, data: [mockCalendar] }),
    getEventsInRange: jest.fn().mockResolvedValue({ success: true, data: [mockEvent] }),
    createEvent: jest.fn().mockResolvedValue({ success: true, data: mockEvent }),
    updateEvent: jest.fn().mockResolvedValue({ success: true, data: mockEvent }),
    deleteEvent: jest.fn().mockResolvedValue({ success: true }),
    syncAccount: jest.fn().mockResolvedValue({ success: true, data: { status: 'idle' } }),
    searchEvents: jest.fn().mockResolvedValue({ success: true, data: [] })
  }
}

Object.defineProperty(window, 'flowDesk', {
  value: mockFlowDeskAPI,
  writable: true
})

describe('Calendar System Integration Tests', () => {
  let store: ReturnType<typeof createMockStore>

  beforeEach(() => {
    store = createMockStore()
    jest.clearAllMocks()
  })

  describe('CalendarViews Component', () => {
    test('renders calendar with different views', () => {
      render(
        <Provider store={store}>
          <CalendarViews />
        </Provider>
      )

      expect(screen.getByText('Week')).toBeInTheDocument()
      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('New Event')).toBeInTheDocument()
    })

    test('switches between calendar views', async () => {
      render(
        <Provider store={store}>
          <CalendarViews />
        </Provider>
      )

      // Click on view selector
      const viewSelector = screen.getByText('Week')
      fireEvent.click(viewSelector)

      // Check if dropdown appears
      await waitFor(() => {
        expect(screen.getByText('Month')).toBeInTheDocument()
        expect(screen.getByText('Day')).toBeInTheDocument()
        expect(screen.getByText('Agenda')).toBeInTheDocument()
        expect(screen.getByText('Year')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
      })

      // Switch to month view
      fireEvent.click(screen.getByText('Month'))

      await waitFor(() => {
        expect(store.getState().calendar.currentView).toBe('month')
      })
    })

    test('displays events in calendar', () => {
      render(
        <Provider store={store}>
          <CalendarViews />
        </Provider>
      )

      expect(screen.getByText('Test Meeting')).toBeInTheDocument()
    })

    test('handles event click', () => {
      const onEventClick = jest.fn()
      render(
        <Provider store={store}>
          <CalendarViews onEventClick={onEventClick} />
        </Provider>
      )

      const eventElement = screen.getByText('Test Meeting')
      fireEvent.click(eventElement)

      expect(onEventClick).toHaveBeenCalledWith(mockEvent)
    })
  })

  describe('EventManager Component', () => {
    test('renders event creation form', () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      expect(screen.getByText('New Event')).toBeInTheDocument()
      expect(screen.getByLabelText('Event Title *')).toBeInTheDocument()
      expect(screen.getByLabelText('Calendar *')).toBeInTheDocument()
    })

    test('validates required fields', async () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      // Try to submit without title
      const saveButton = screen.getByText('Create Event')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
      })
    })

    test('handles event creation', async () => {
      const onClose = jest.fn()
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={onClose}
            mode="create"
          />
        </Provider>
      )

      // Fill in required fields
      const titleInput = screen.getByLabelText('Event Title *')
      fireEvent.change(titleInput, { target: { value: 'New Test Event' } })

      // Submit form
      const saveButton = screen.getByText('Create Event')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockFlowDeskAPI.calendar.createEvent).toHaveBeenCalled()
      })
    })

    test('handles recurring event creation', () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      // Switch to recurrence tab
      fireEvent.click(screen.getByText('Recurrence'))

      // Add recurrence
      const addRecurrenceButton = screen.getByText('Add Recurrence')
      fireEvent.click(addRecurrenceButton)

      expect(screen.getByText('Event Recurrence')).toBeInTheDocument()
      expect(screen.getByText('Every week')).toBeInTheDocument()
    })

    test('handles attendee management', () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      // Switch to attendees tab
      fireEvent.click(screen.getByText('Attendees'))

      expect(screen.getByText('Add Attendees')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter email address or name...')).toBeInTheDocument()
    })

    test('handles video conferencing setup', () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      // Switch to conferencing tab
      fireEvent.click(screen.getByText('Meeting'))

      // Add meeting
      const addMeetingButton = screen.getByText('Add Meeting')
      fireEvent.click(addMeetingButton)

      expect(screen.getByText('Meeting Provider')).toBeInTheDocument()
    })
  })

  describe('Smart Scheduling Assistant', () => {
    test('renders scheduling suggestions', () => {
      render(
        <Provider store={store}>
          <SmartSchedulingAssistant
            isOpen={true}
            onClose={() => {}}
            onScheduleEvent={() => {}}
            attendees={[mockEvent.attendees[0]]}
            duration={60}
          />
        </Provider>
      )

      expect(screen.getByText('Smart Scheduling Assistant')).toBeInTheDocument()
      expect(screen.getByText('AI Suggestions')).toBeInTheDocument()
    })

    test('analyzes scheduling options', async () => {
      render(
        <Provider store={store}>
          <SmartSchedulingAssistant
            isOpen={true}
            onClose={() => {}}
            onScheduleEvent={() => {}}
            attendees={[mockEvent.attendees[0]]}
            duration={60}
          />
        </Provider>
      )

      const findTimesButton = screen.getByText('Find Times')
      fireEvent.click(findTimesButton)

      await waitFor(() => {
        expect(screen.getByText('Analyzing 1 attendee availability...')).toBeInTheDocument()
      })
    })
  })

  describe('Calendar Notification Center', () => {
    test('renders notification center', () => {
      render(
        <Provider store={store}>
          <CalendarNotificationCenter
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('All (0)')).toBeInTheDocument()
    })

    test('displays notifications when present', () => {
      const storeWithNotifications = createMockStore({
        notifications: [
          {
            id: 'notif-1',
            type: 'event_reminder',
            title: 'Upcoming Event',
            message: 'Test Meeting starts in 15 minutes',
            priority: 'high',
            timestamp: new Date(),
            read: false,
            actionable: true
          }
        ]
      })

      render(
        <Provider store={storeWithNotifications}>
          <CalendarNotificationCenter
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      expect(screen.getByText('1 new')).toBeInTheDocument()
      expect(screen.getByText('Upcoming Event')).toBeInTheDocument()
      expect(screen.getByText('Test Meeting starts in 15 minutes')).toBeInTheDocument()
    })
  })

  describe('Calendar Provider Manager', () => {
    test('renders provider management interface', () => {
      render(
        <Provider store={store}>
          <CalendarProviderManager
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      expect(screen.getByText('Calendar Providers')).toBeInTheDocument()
      expect(screen.getByText('Connected Accounts')).toBeInTheDocument()
      expect(screen.getByText('Available Providers')).toBeInTheDocument()
    })

    test('displays connected accounts', () => {
      render(
        <Provider store={store}>
          <CalendarProviderManager
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      expect(screen.getByText('Test Google Account')).toBeInTheDocument()
      expect(screen.getByText('test@gmail.com')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
    })

    test('shows available providers', () => {
      render(
        <Provider store={store}>
          <CalendarProviderManager
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      // Switch to providers tab
      fireEvent.click(screen.getByText('Available Providers'))

      expect(screen.getByText('Google Calendar')).toBeInTheDocument()
      expect(screen.getByText('Microsoft Outlook')).toBeInTheDocument()
      expect(screen.getByText('iCloud Calendar')).toBeInTheDocument()
    })
  })

  describe('Email Calendar Integration', () => {
    test('renders email integration interface', () => {
      render(
        <Provider store={store}>
          <EmailCalendarIntegration
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      expect(screen.getByText('Smart Email-Calendar Integration')).toBeInTheDocument()
      expect(screen.getByText('Detected Events')).toBeInTheDocument()
    })

    test('displays detected events from emails', () => {
      render(
        <Provider store={store}>
          <EmailCalendarIntegration
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      expect(screen.getByText('Team Meeting')).toBeInTheDocument()
      expect(screen.getByText('95% confidence')).toBeInTheDocument()
      expect(screen.getByText('Add to Calendar')).toBeInTheDocument()
    })

    test('handles event creation from email', async () => {
      render(
        <Provider store={store}>
          <EmailCalendarIntegration
            isOpen={true}
            onClose={() => {}}
          />
        </Provider>
      )

      const addToCalendarButton = screen.getAllByText('Add to Calendar')[0]
      fireEvent.click(addToCalendarButton)

      await waitFor(() => {
        expect(mockFlowDeskAPI.calendar.createEvent).toHaveBeenCalled()
      })
    })
  })

  describe('Integration Tests', () => {
    test('calendar data flows correctly through components', async () => {
      render(
        <Provider store={store}>
          <CalendarViews />
        </Provider>
      )

      // Verify initial data is loaded
      expect(screen.getByText('Test Meeting')).toBeInTheDocument()

      // Verify calendar account is connected
      expect(store.getState().calendar.accounts).toHaveLength(1)
      expect(store.getState().calendar.accounts[0].name).toBe('Test Google Account')

      // Verify events are properly associated with calendars
      const calendarEvents = store.getState().calendar.events['cal-1']
      expect(calendarEvents).toHaveLength(1)
      expect(calendarEvents[0].title).toBe('Test Meeting')
    })

    test('event creation updates store correctly', async () => {
      const onClose = jest.fn()
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={onClose}
            mode="create"
          />
        </Provider>
      )

      // Fill form and submit
      const titleInput = screen.getByLabelText('Event Title *')
      fireEvent.change(titleInput, { target: { value: 'Integration Test Event' } })

      const saveButton = screen.getByText('Create Event')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockFlowDeskAPI.calendar.createEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Integration Test Event'
          })
        )
      })
    })

    test('view switching updates state correctly', async () => {
      render(
        <Provider store={store}>
          <CalendarViews />
        </Provider>
      )

      const viewSelector = screen.getByText('Week')
      fireEvent.click(viewSelector)

      await waitFor(() => {
        expect(screen.getByText('Month')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Month'))

      await waitFor(() => {
        expect(store.getState().calendar.currentView).toBe('month')
      })
    })
  })

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      mockFlowDeskAPI.calendar.createEvent.mockRejectedValueOnce(
        new Error('Network error')
      )

      const onClose = jest.fn()
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={onClose}
            mode="create"
          />
        </Provider>
      )

      const titleInput = screen.getByLabelText('Event Title *')
      fireEvent.change(titleInput, { target: { value: 'Error Test Event' } })

      const saveButton = screen.getByText('Create Event')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to save event/)).toBeInTheDocument()
      })
    })

    test('validates form data before submission', async () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      // Submit without required fields
      const saveButton = screen.getByText('Create Event')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
      })

      expect(mockFlowDeskAPI.calendar.createEvent).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    test('calendar components are keyboard accessible', () => {
      render(
        <Provider store={store}>
          <CalendarViews />
        </Provider>
      )

      const todayButton = screen.getByText('Today')
      expect(todayButton).toBeVisible()
      expect(todayButton.tagName).toBe('BUTTON')

      const newEventButton = screen.getByText('New Event')
      expect(newEventButton).toBeVisible()
      expect(newEventButton.tagName).toBe('BUTTON')
    })

    test('event manager has proper ARIA labels', () => {
      render(
        <Provider store={store}>
          <EventManager
            isOpen={true}
            onClose={() => {}}
            mode="create"
          />
        </Provider>
      )

      const titleInput = screen.getByLabelText('Event Title *')
      expect(titleInput).toHaveAttribute('aria-required', 'true')

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
    })
  })
})

describe('Calendar System Performance', () => {
  test('renders large number of events efficiently', () => {
    const manyEvents = Array.from({ length: 100 }, (_, index) => ({
      ...mockEvent,
      id: `event-${index}`,
      title: `Event ${index}`,
      startTime: dayjs().add(index, 'hour').toDate(),
      endTime: dayjs().add(index + 1, 'hour').toDate()
    }))

    const storeWithManyEvents = createMockStore({
      events: { 'cal-1': manyEvents }
    })

    const renderStart = performance.now()
    
    render(
      <Provider store={storeWithManyEvents}>
        <CalendarViews />
      </Provider>
    )

    const renderEnd = performance.now()
    const renderTime = renderEnd - renderStart

    // Should render in under 1 second even with 100 events
    expect(renderTime).toBeLessThan(1000)
  })
})