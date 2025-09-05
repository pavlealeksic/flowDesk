import React, { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  Globe,
  Clock,
  Users,
  MapPin,
  Video,
  Bell,
  Plus,
  ChevronDown,
  Calendar as CalendarIcon,
  Settings,
  RefreshCw
} from 'lucide-react'
import { Button, Card, Input } from '../ui'
import { cn } from '../ui/utils'
import { CalendarViews } from './CalendarViews'
import { useNotifications } from '../ui/NotificationSystem'
import { SmartLoading } from '../ui/LoadingStates'
import type { CalendarEvent } from '@flow-desk/shared'

dayjs.extend(timezone)
dayjs.extend(utc)

interface TimeZoneInfo {
  name: string
  label: string
  offset: string
  current: string
}

interface EnhancedCalendarInterfaceProps {
  className?: string
  onEventCreate?: (event: Partial<CalendarEvent>) => void
  onEventUpdate?: (eventId: string, updates: Partial<CalendarEvent>) => void
  onEventDelete?: (eventId: string) => void
}

const TimeZoneSelector: React.FC<{
  selectedTimezone: string
  onTimezoneChange: (timezone: string) => void
  className?: string
}> = ({ selectedTimezone, onTimezoneChange, className }) => {
  const [isOpen, setIsOpen] = useState(false)

  const timezones: TimeZoneInfo[] = useMemo(() => {
    const now = dayjs()
    const zones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Pacific/Auckland'
    ]

    return zones.map(zone => {
      const time = now.tz(zone)
      return {
        name: zone,
        label: zone.replace('_', ' ').split('/')[1],
        offset: time.format('Z'),
        current: time.format('HH:mm')
      }
    })
  }, [])

  const currentTimezone = timezones.find(tz => tz.name === selectedTimezone) || timezones[0]

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Globe className="h-4 w-4" />
        <span className="font-mono text-sm">{currentTimezone.current}</span>
        <span className="text-xs text-muted-foreground">{currentTimezone.label}</span>
        <ChevronDown className="h-3 w-3" />
      </Button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-50"
        >
          <div className="p-2">
            <div className="text-xs text-muted-foreground px-2 py-1 font-medium">
              Time Zones
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {timezones.map((tz) => (
                <button
                  key={tz.name}
                  onClick={() => {
                    onTimezoneChange(tz.name)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-accent',
                    tz.name === selectedTimezone && 'bg-accent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{tz.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {tz.offset}
                    </span>
                  </div>
                  <span className="font-mono text-xs">{tz.current}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

const QuickActions: React.FC<{
  onCreateEvent: () => void
  onRefresh: () => void
  onSettings: () => void
}> = ({ onCreateEvent, onRefresh, onSettings }) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Sync
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onSettings}
        className="gap-2"
      >
        <Settings className="h-4 w-4" />
        Settings
      </Button>

      <Button
        size="sm"
        onClick={onCreateEvent}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        New Event
      </Button>
    </div>
  )
}

const EventQuickCreate: React.FC<{
  isVisible: boolean
  onClose: () => void
  onCreate: (event: Partial<CalendarEvent>) => void
  selectedDate?: Date
}> = ({ isVisible, onClose, onCreate, selectedDate }) => {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState(
    selectedDate ? dayjs(selectedDate).format('HH:mm') : dayjs().format('HH:mm')
  )
  const [duration, setDuration] = useState(60)

  const handleCreate = useCallback(() => {
    if (!title.trim()) return

    const startDateTime = dayjs(selectedDate || new Date())
      .hour(parseInt(time.split(':')[0]))
      .minute(parseInt(time.split(':')[1]))
      .toDate()

    const endDateTime = dayjs(startDateTime)
      .add(duration, 'minute')
      .toDate()

    onCreate({
      title: title.trim(),
      startTime: startDateTime,
      endTime: endDateTime,
      isAllDay: false,
      description: '',
      location: '',
      attendees: []
    })

    setTitle('')
    onClose()
  }, [title, time, duration, selectedDate, onCreate, onClose])

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 p-4"
    >
      <div className="space-y-3">
        <div>
          <Input
            value={title}
            onChange={setTitle}
            placeholder="Event title"
            className="font-medium"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') onClose()
            }}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="px-2 py-1 text-sm bg-background border border-border rounded"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">for</span>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="px-2 py-1 text-sm bg-background border border-border rounded"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedDate ? dayjs(selectedDate).format('dddd, MMM D') : 'Today'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>
              Create
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const UpcomingEvents: React.FC<{
  events: CalendarEvent[]
  timezone: string
  className?: string
}> = ({ events, timezone, className }) => {
  const upcomingEvents = useMemo(() => {
    const now = dayjs().tz(timezone)
    return events
      .filter(event => dayjs(event.startTime).tz(timezone).isAfter(now))
      .sort((a, b) => dayjs(a.startTime).diff(dayjs(b.startTime)))
      .slice(0, 5)
  }, [events, timezone])

  if (upcomingEvents.length === 0) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-center text-sm text-muted-foreground">
          <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No upcoming events</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn('p-4', className)}>
      <h3 className="text-sm font-semibold mb-3">Upcoming Events</h3>
      <div className="space-y-3">
        {upcomingEvents.map((event) => {
          const start = dayjs(event.startTime).tz(timezone)
          const isToday = start.isSame(dayjs().tz(timezone), 'day')
          const isTomorrow = start.isSame(dayjs().tz(timezone).add(1, 'day'), 'day')
          
          return (
            <div key={event.id} className="flex items-start gap-3 p-2 rounded hover:bg-accent/50 cursor-pointer">
              <div className="flex-shrink-0 text-center">
                <div className="text-xs text-muted-foreground font-medium">
                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : start.format('MMM D')}
                </div>
                <div className="text-sm font-mono">
                  {start.format('HH:mm')}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{event.title}</div>
                {event.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Users className="h-3 w-3" />
                    <span>{event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export const EnhancedCalendarInterface: React.FC<EnhancedCalendarInterfaceProps> = ({
  className,
  onEventCreate,
  onEventUpdate,
  onEventDelete
}) => {
  const [selectedTimezone, setSelectedTimezone] = useState(dayjs.tz.guess())
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickCreateDate, setQuickCreateDate] = useState<Date | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const { success, info } = useNotifications()

  const handleEventCreate = useCallback((eventData: Partial<CalendarEvent>) => {
    onEventCreate?.(eventData)
    success('Event Created', `"${eventData.title}" has been added to your calendar`)
  }, [onEventCreate, success])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 1000))
      info('Calendar Synced', 'Your calendar has been updated')
    } finally {
      setIsLoading(false)
    }
  }, [info])

  const handleDateSelect = useCallback((date: Date) => {
    setQuickCreateDate(date)
    setShowQuickCreate(true)
  }, [])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Calendar</h1>
          <TimeZoneSelector
            selectedTimezone={selectedTimezone}
            onTimezoneChange={setSelectedTimezone}
          />
        </div>
        
        <QuickActions
          onCreateEvent={() => {
            setQuickCreateDate(new Date())
            setShowQuickCreate(true)
          }}
          onRefresh={handleRefresh}
          onSettings={() => info('Settings', 'Calendar settings coming soon!')}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar View */}
        <div className="flex-1 relative">
          <SmartLoading
            isLoading={isLoading}
            hasData={true}
            className="h-full"
          >
            <CalendarViews
              className="h-full"
              onDateSelect={handleDateSelect}
              onEventClick={(event) => {
                console.log('Event clicked:', event)
              }}
              onCreateEvent={() => {
                setQuickCreateDate(new Date())
                setShowQuickCreate(true)
              }}
            />
          </SmartLoading>

          {/* Quick Create Overlay */}
          <div className="absolute top-4 left-4 right-4">
            <div className="relative">
              <EventQuickCreate
                isVisible={showQuickCreate}
                onClose={() => setShowQuickCreate(false)}
                onCreate={handleEventCreate}
                selectedDate={quickCreateDate}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-border bg-card/30 p-4 space-y-4 overflow-y-auto">
          <UpcomingEvents 
            events={[]} // This would come from Redux state
            timezone={selectedTimezone}
          />

          {/* Mini Calendar */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Mini Calendar</h3>
            <div className="text-xs text-muted-foreground text-center py-4">
              Mini calendar widget coming soon
            </div>
          </Card>

          {/* Calendar Accounts */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Calendar Accounts</h3>
            <div className="text-xs text-muted-foreground text-center py-4">
              Account management coming soon
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}