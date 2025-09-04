import React, { useState, useMemo, useCallback, useEffect } from 'react'
import dayjs from 'dayjs'
import AddCalendarAccountModal from './CalendarAccountModal'
import { useAppSelector, useAppDispatch } from '../../store'
import { useCalendarSync } from '../../hooks/useCalendarSync'
import {
  setCurrentView,
  setCurrentDate,
  fetchEventsInRange,
  fetchUserAccounts,
  fetchCalendars
} from '../../store/slices/calendarSlice'
import {
  Button,
  Card,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Avatar,
  cn,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import type { CalendarEvent } from '@flow-desk/shared'

type ViewType = 'day' | 'week' | 'month' | 'year' | 'agenda' | 'timeline'

// Helper function to get week days
const getWeekDays = (currentDate: Date | string) => {
  const date = dayjs(currentDate);
  const startOfWeek = date.startOf('week');
  return Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day'));
};

interface CalendarHeaderProps {
  currentDate: Date
  viewType: ViewType
  onDateChange: (date: Date) => void
  onViewChange: (view: ViewType) => void
  onToday: () => void
  onCreateEvent: () => void
  onAddAccount?: () => void
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewType,
  onDateChange,
  onViewChange,
  onToday,
  onCreateEvent,
  onAddAccount
}) => {
  const formatHeaderDate = (date: Date, view: ViewType) => {
    const options: Intl.DateTimeFormatOptions = {}
    
    switch (view) {
      case 'day':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      case 'week':
        const startOfWeek = new Date(date)
        startOfWeek.setDate(date.getDate() - date.getDay())
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        
        if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
          return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()}-${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`
        } else {
          return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${startOfWeek.getFullYear()}`
        }
      case 'month':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        })
      case 'agenda':
        return 'Upcoming Events'
      default:
        return date.toLocaleDateString()
    }
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    
    switch (viewType) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
      case 'agenda':
        // Agenda view doesn't navigate
        return
    }
    
    onDateChange(newDate)
  }

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={onToday}
          className="font-medium"
        >
          Today
        </Button>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('prev')}
            disabled={viewType === 'agenda'}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" 
            size="sm"
            onClick={() => navigateDate('next')}
            disabled={viewType === 'agenda'}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h1 className="text-xl font-semibold">
          {formatHeaderDate(currentDate, viewType)}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="outline" className="capitalize">
              {viewType} <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem
              selected={viewType === 'day'}
              onSelect={() => onViewChange('day')}
              shortcut="D"
            >
              Day
            </DropdownItem>
            <DropdownItem
              selected={viewType === 'week'}
              onSelect={() => onViewChange('week')}
              shortcut="W"
            >
              Week
            </DropdownItem>
            <DropdownItem
              selected={viewType === 'month'}
              onSelect={() => onViewChange('month')}
              shortcut="M"
            >
              Month
            </DropdownItem>
            <DropdownItem
              selected={viewType === 'agenda'}
              onSelect={() => onViewChange('agenda')}
              shortcut="A"
            >
              Agenda
            </DropdownItem>
          </DropdownContent>
        </Dropdown>

        {onAddAccount && (
          <Button
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={onAddAccount}
          >
            Add Account
          </Button>
        )}
        
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={onCreateEvent}
        >
          New Event
        </Button>
      </div>
    </div>
  )
}

interface EventItemProps {
  event: CalendarEvent
  compact?: boolean
  onClick?: (event: CalendarEvent) => void
  getCalendarForEvent?: (event: CalendarEvent) => any
}

const EventItem: React.FC<EventItemProps> = ({ event, compact = false, onClick, getCalendarForEvent }) => {
  const calendar = getCalendarForEvent?.(event)
  
  const formatEventTime = (start: Date, end: Date) => {
    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    return `${startTime} - ${endTime}`
  }

  const formatEventDuration = (start: Date, end: Date) => {
    const durationMs = end.getTime() - start.getTime()
    const minutes = Math.round(durationMs / (1000 * 60))
    
    if (minutes < 60) {
      return `${minutes}m`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
    }
  }
  
  const startTime = new Date(event.startTime)
  const endTime = new Date(event.endTime)

  if (compact) {
    return (
      <div
        className="group px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity truncate"
        style={{
          backgroundColor: calendar?.color + '20',
          borderLeft: `3px solid ${calendar?.color}`,
          color: calendar?.color
        }}
        onClick={() => onClick?.(event)}
        title={`${event.title}\n${formatEventTime(startTime, endTime)}${event.location ? `\n📍 ${event.location}` : ''}`}
      >
        {event.title}
      </div>
    )
  }

  return (
    <Card
      variant="outlined"
      padding="sm"
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 group"
      style={{ borderLeftColor: calendar?.color }}
      onClick={() => onClick?.(event)}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm group-hover:text-flow-primary-600">
            {event.title}
          </h4>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatEventDuration(startTime, endTime)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatEventTime(startTime, endTime)}</span>
        </div>

        {event.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{event.location}</span>
          </div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  getCalendarForEvent: (event: CalendarEvent) => any
}

const DayView: React.FC<DayViewProps> = ({ date, events, onEventClick, getCalendarForEvent }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const dayEvents = events.filter(event => 
    new Date(event.startTime).toDateString() === date.toDateString()
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full bg-background">
        {hours.map(hour => (
          <div
            key={hour}
            className="flex border-b border-border/50"
            style={{ height: '60px' }}
          >
            <div className="w-16 flex-shrink-0 p-2 text-sm text-muted-foreground border-r border-border/50">
              {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} ${hour === 12 ? 'PM' : 'AM'}` : `${hour - 12} PM`}
            </div>
            <div className="flex-1 relative">
              {dayEvents
                .filter(event => new Date(event.startTime).getHours() === hour)
                .map((event, index) => {
                  const calendar = getCalendarForEvent(event)
                  const startTime = new Date(event.startTime)
                  const endTime = new Date(event.endTime)
                  
                  return (
                    <div
                      key={event.id}
                      className="absolute inset-x-2 rounded shadow-sm"
                      style={{
                        top: `${(startTime.getMinutes() / 60) * 60}px`,
                        height: `${((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * 60}px`,
                        backgroundColor: calendar?.color + '20',
                        borderLeft: `3px solid ${calendar?.color}`,
                        left: `${8 + (index * 8)}px`,
                        right: `${8 + (index * 8)}px`
                      }}
                    >
                      <div
                        className="p-2 cursor-pointer hover:opacity-80 transition-opacity h-full"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="text-sm font-medium text-foreground truncate">
                          {event.title}
                        </div>
                        {event.location && (
                          <div className="text-xs text-muted-foreground truncate">
                            📍 {event.location}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDateClick: (date: Date) => void
  getCalendarForEvent: (event: CalendarEvent) => any
}

const MonthView: React.FC<MonthViewProps> = ({ date, events, onEventClick, onDateClick, getCalendarForEvent }) => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const startDate = new Date(monthStart)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  
  const days = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= monthEnd || currentDate.getDay() !== 0) {
    days.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
    if (days.length >= 42) break // 6 weeks max
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === monthStart.getMonth()
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      new Date(event.startTime).toDateString() === date.toDateString()
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {weekdays.map(day => (
          <div key={day} className="p-3 text-sm font-medium text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr border-l border-border">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day)
          
          return (
            <div
              key={index}
              className={cn(
                'border-r border-b border-border p-2 cursor-pointer hover:bg-accent/50 transition-colors min-h-[120px] flex flex-col',
                !isCurrentMonth(day) && 'bg-muted/20 text-muted-foreground',
                isToday(day) && 'bg-flow-primary-50 dark:bg-flow-primary-950'
              )}
              onClick={() => onDateClick(day)}
            >
              <div className={cn(
                'text-sm font-medium mb-2',
                isToday(day) && 'bg-flow-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center'
              )}>
                {day.getDate()}
              </div>
              
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map(event => (
                  <EventItem
                    key={event.id}
                    event={event}
                    compact
                    onClick={onEventClick}
                    getCalendarForEvent={getCalendarForEvent}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface AgendaViewProps {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  getCalendarForEvent: (event: CalendarEvent) => any
}

const AgendaView: React.FC<AgendaViewProps> = ({ events, onEventClick, getCalendarForEvent }) => {
  const sortedEvents = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  
  const groupEventsByDate = (events: CalendarEvent[]) => {
    const groups: { [key: string]: CalendarEvent[] } = {}
    
    events.forEach(event => {
      const dateKey = new Date(event.startTime).toDateString()
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(event)
    })
    
    return groups
  }

  const eventGroups = groupEventsByDate(sortedEvents)

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {Object.entries(eventGroups).map(([dateKey, events]) => {
        const date = new Date(dateKey)
        const isToday = date.toDateString() === new Date().toDateString()
        
        return (
          <div key={dateKey} className="space-y-3">
            <div className={cn(
              'flex items-center gap-3 pb-2 border-b border-border',
              isToday && 'text-flow-primary-600'
            )}>
              <CalendarIcon className="h-4 w-4" />
              <h3 className="font-semibold">
                {date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>
              {isToday && (
                <span className="px-2 py-1 bg-flow-primary-100 text-flow-primary-700 text-xs font-medium rounded-full">
                  Today
                </span>
              )}
            </div>
            
            <div className="space-y-2 pl-7">
              {events.map(event => (
                <EventItem
                  key={event.id}
                  event={event}
                  onClick={onEventClick}
                  getCalendarForEvent={getCalendarForEvent}
                />
              ))}
            </div>
          </div>
        )
      })}
      
      {sortedEvents.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium mb-2">No upcoming events</h3>
          <p className="text-sm">Your calendar is clear!</p>
        </div>
      )}
    </div>
  )
}

export interface CalendarViewsProps extends BaseComponentProps {
  initialView?: ViewType
  initialDate?: Date
  onEventClick?: (event: CalendarEvent) => void
  onCreateEvent?: () => void
  onDateSelect?: (date: Date) => void
}

export const CalendarViews: React.FC<CalendarViewsProps> = ({
  initialView = 'month',
  initialDate = new Date(),
  onEventClick,
  onCreateEvent,
  onDateSelect,
  className,
  'data-testid': testId
}) => {
  const dispatch = useAppDispatch()
  const { loadInitialData, refreshEvents } = useCalendarSync()
  
  // Local state for modals
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  
  // Get state from Redux store
  const {
    accounts,
    calendars,
    events,
    currentView,
    currentDate: currentDateString,
    visibleCalendars,
    isLoading,
    error
  } = useAppSelector(state => state.calendar)
  
  const currentDate = useMemo(() => new Date(currentDateString), [currentDateString])
  const viewType = currentView
  
  // Initialize calendar data
  useEffect(() => {
    loadInitialData('current_user') // Replace with actual user ID
  }, [loadInitialData])
  
  // Get all events from visible calendars
  const allEvents = useMemo(() => {
    const visibleEvents: CalendarEvent[] = []
    
    // If no calendars are explicitly visible, show all
    const calendarsToShow = visibleCalendars.length > 0 ? visibleCalendars : 
      Object.values(calendars).flat().map(cal => cal.id)
    
    calendarsToShow.forEach(calendarId => {
      if (events[calendarId]) {
        visibleEvents.push(...events[calendarId])
      }
    })
    
    return visibleEvents.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
  }, [events, visibleCalendars, calendars])
  
  // Get calendar for an event (for display purposes)
  const getCalendarForEvent = useCallback((event: CalendarEvent) => {
    const allCalendarsList = Object.values(calendars).flat()
    return allCalendarsList.find(cal => cal.id === event.calendarId)
  }, [calendars])

  const handleToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    dispatch(setCurrentDate(today))
  }, [dispatch])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    onEventClick?.(event)
  }, [onEventClick])

  const handleDateClick = useCallback((date: Date) => {
    onDateSelect?.(date)
    if (viewType === 'month') {
      dispatch(setCurrentView('day'))
      dispatch(setCurrentDate(date.toISOString().split('T')[0]))
    }
  }, [onDateSelect, viewType, dispatch])
  
  const handleViewChange = useCallback((view: ViewType) => {
    dispatch(setCurrentView(view))
  }, [dispatch])
  
  const handleDateChange = useCallback((date: Date) => {
    dispatch(setCurrentDate(date.toISOString().split('T')[0]))
  }, [dispatch])
  
  // Refresh events when date or view changes
  useEffect(() => {
    if (Object.keys(calendars).length === 0) return
    
    const allCalendarIds = Object.values(calendars).flat().map(cal => cal.id)
    if (allCalendarIds.length === 0) return
    
    // Calculate date range based on current view
    let timeMin: Date;
    let timeMax: Date;
    
    switch (viewType) {
      case 'day':
        timeMin = new Date(currentDate)
        timeMin.setHours(0, 0, 0, 0)
        timeMax = new Date(currentDate)
        timeMax.setHours(23, 59, 59, 999)
        break
      case 'week':
        timeMin = new Date(currentDate)
        timeMin.setDate(currentDate.getDate() - currentDate.getDay())
        timeMin.setHours(0, 0, 0, 0)
        timeMax = new Date(timeMin)
        timeMax.setDate(timeMin.getDate() + 6)
        timeMax.setHours(23, 59, 59, 999)
        break
      case 'month':
        timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        timeMax.setHours(23, 59, 59, 999)
        break
      case 'year':
        timeMin = new Date(currentDate.getFullYear(), 0, 1)
        timeMax = new Date(currentDate.getFullYear(), 11, 31)
        timeMax.setHours(23, 59, 59, 999)
        break
      case 'agenda':
        timeMin = new Date()
        timeMin.setHours(0, 0, 0, 0)
        timeMax = new Date(timeMin)
        timeMax.setDate(timeMax.getDate() + 30) // Show next 30 days
        break
      case 'timeline':
        timeMin = new Date(currentDate)
        timeMin.setDate(currentDate.getDate() - 7) // Show past week
        timeMin.setHours(0, 0, 0, 0)
        timeMax = new Date(currentDate)
        timeMax.setDate(currentDate.getDate() + 7) // Show next week
        timeMax.setHours(23, 59, 59, 999)
        break
      default:
        // Default to day view
        timeMin = new Date(currentDate)
        timeMin.setHours(0, 0, 0, 0)
        timeMax = new Date(currentDate)
        timeMax.setHours(23, 59, 59, 999)
        break
    }
    
    refreshEvents(allCalendarIds, timeMin, timeMax)
  }, [currentDate, viewType, calendars, refreshEvents])

  const renderView = () => {
    if (isLoading && allEvents.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
            <h3 className="font-medium mb-2">Loading Calendar</h3>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </div>
        </div>
      )
    }
    
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-red-400" />
            <h3 className="font-medium mb-2 text-red-600">Calendar Error</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )
    }
    
    switch (viewType) {
      case 'day':
        return (
          <DayView
            date={currentDate}
            events={allEvents}
            onEventClick={handleEventClick}
            getCalendarForEvent={getCalendarForEvent}
          />
        )
      case 'week':
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Week header with days */}
            <div className="flex border-b border-border">
              <div className="w-20 border-r border-border p-2"></div>
              {getWeekDays(currentDate).map((day, index) => (
                <div key={index} className="flex-1 p-2 text-center border-r border-border last:border-r-0">
                  <div className="text-xs text-muted-foreground">{day.format('ddd')}</div>
                  <div className={cn(
                    'text-sm font-medium',
                    day.isSame(dayjs(currentDate), 'day') && 'text-primary'
                  )}>
                    {day.format('DD')}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Week grid with time slots */}
            <div className="flex-1 overflow-auto">
              <div className="flex">
                {/* Time column */}
                <div className="w-20 border-r border-border">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="h-16 border-b border-border p-1 text-xs text-muted-foreground">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                  ))}
                </div>
                
                {/* Week days columns */}
                {getWeekDays(currentDate).map((day, dayIndex) => (
                  <div key={dayIndex} className="flex-1 border-r border-border last:border-r-0">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div 
                        key={hour} 
                        className="h-16 border-b border-border p-1 hover:bg-accent/50 cursor-pointer relative"
                        onClick={() => {
                          const eventTime = day.hour(hour).minute(0);
                          onCreateEvent?.();
                        }}
                      >
                        {/* Render events for this time slot */}
                        {allEvents
                          .filter(event => {
                            const eventStart = dayjs(event.startTime);
                            return eventStart.isSame(day, 'day') && eventStart.hour() === hour;
                          })
                          .map(event => (
                            <div
                              key={event.id}
                              className="absolute inset-1 bg-primary/20 border border-primary/40 rounded p-1 text-xs cursor-pointer hover:bg-primary/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }}
                            >
                              <div className="font-medium truncate">{event.title}</div>
                              <div className="text-muted-foreground truncate">
                                {dayjs(event.startTime).format('HH:mm')}
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      case 'month':
        return (
          <MonthView
            date={currentDate}
            events={allEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            getCalendarForEvent={getCalendarForEvent}
          />
        )
      case 'agenda':
        return (
          <AgendaView
            events={allEvents}
            onEventClick={handleEventClick}
            getCalendarForEvent={getCalendarForEvent}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)} data-testid={testId}>
      <CalendarHeader
        currentDate={currentDate}
        viewType={viewType}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
        onToday={handleToday}
        onCreateEvent={() => onCreateEvent?.()}
        onAddAccount={() => setShowAddAccountModal(true)}
      />
      
      {renderView()}
      
      <AddCalendarAccountModal
        isOpen={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={(account) => {
          console.log('Calendar account added successfully:', account);
          // Refresh calendar accounts
          dispatch(fetchUserAccounts('default-user'));
        }}
      />
    </div>
  )
}