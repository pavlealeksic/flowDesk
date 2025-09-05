import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { createCalendarEvent } from '../../store/slices/calendarSlice'
import { Modal } from '../ui/Modal'
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Bell
} from '../ui'
import type { CreateCalendarEventInput, CalendarEvent, EventReminder } from '@flow-desk/shared'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (event: CalendarEvent) => void
  selectedDate?: Date
  selectedCalendarId?: string
}

interface EventFormData {
  title: string
  description: string
  location: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  calendarId: string
  attendees: string[]
  reminders: EventReminder[]
  isAllDay: boolean
  recurrence?: {
    frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval: number
    endDate?: string
  }
}

const DEFAULT_REMINDERS: EventReminder[] = [
  { method: 'popup', minutesBefore: 15 }
]

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedDate,
  selectedCalendarId
}) => {
  const dispatch = useAppDispatch()
  const { calendars, isLoading } = useAppSelector(state => state.calendar)
  
  // Get all calendars as a flat list
  const allCalendars = Object.values(calendars).flat()
  
  // Helper function to safely get date string from Date object
  const getDateString = useCallback((date?: Date | null): string => {
    if (date && date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  }, [])
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    startDate: getDateString(selectedDate),
    startTime: '09:00',
    endDate: getDateString(selectedDate),
    endTime: '10:00',
    calendarId: selectedCalendarId || (allCalendars[0]?.id || ''),
    attendees: [],
    reminders: DEFAULT_REMINDERS,
    isAllDay: false,
    recurrence: {
      frequency: 'none',
      interval: 1
    }
  })

  const [attendeeInput, setAttendeeInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const defaultStartDate = getDateString(selectedDate)
      const defaultCalendarId = selectedCalendarId || allCalendars[0]?.id || ''
      
      setFormData(prev => ({
        ...prev,
        startDate: defaultStartDate,
        endDate: defaultStartDate,
        calendarId: defaultCalendarId
      }))
      setError(null)
    } else {
      // Reset form on close
      const defaultCalendarId = allCalendars[0]?.id || ''
      const currentDateString = getDateString(new Date())
      setFormData({
        title: '',
        description: '',
        location: '',
        startDate: currentDateString,
        startTime: '09:00',
        endDate: currentDateString,
        endTime: '10:00',
        calendarId: defaultCalendarId,
        attendees: [],
        reminders: DEFAULT_REMINDERS,
        isAllDay: false,
        recurrence: {
          frequency: 'none',
          interval: 1
        }
      })
      setAttendeeInput('')
      setError(null)
    }
  }, [isOpen, selectedDate, selectedCalendarId, getDateString, allCalendars])

  // Update calendar selection when calendars change but only if current selection is invalid
  useEffect(() => {
    if (allCalendars.length > 0 && !formData.calendarId) {
      const defaultCalendarId = selectedCalendarId || allCalendars[0]?.id || ''
      if (defaultCalendarId) {
        setFormData(prev => ({ ...prev, calendarId: defaultCalendarId }))
      }
    }
  }, [allCalendars, formData.calendarId, selectedCalendarId])

  const handleInputChange = useCallback((field: keyof EventFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }, [error])

  const handleToggleAllDay = useCallback(() => {
    setFormData(prev => {
      const newIsAllDay = !prev.isAllDay
      return {
        ...prev,
        isAllDay: newIsAllDay,
        startTime: newIsAllDay ? '00:00' : '09:00',
        endTime: newIsAllDay ? '23:59' : '10:00'
      }
    })
  }, [])

  const handleAddAttendee = useCallback(() => {
    const email = attendeeInput.trim()
    if (email && !formData.attendees.includes(email)) {
      setFormData(prev => ({
        ...prev,
        attendees: [...prev.attendees, email]
      }))
      setAttendeeInput('')
    }
  }, [attendeeInput, formData.attendees])

  const handleRemoveAttendee = useCallback((email: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter(a => a !== email)
    }))
  }, [])

  const handleAddReminder = useCallback(() => {
    const newReminder: EventReminder = { method: 'popup', minutesBefore: 15 }
    setFormData(prev => ({
      ...prev,
      reminders: [...prev.reminders, newReminder]
    }))
  }, [])

  const handleUpdateReminder = useCallback((index: number, updates: Partial<EventReminder>) => {
    setFormData(prev => ({
      ...prev,
      reminders: prev.reminders.map((reminder, i) => 
        i === index ? { ...reminder, ...updates } : reminder
      )
    }))
  }, [])

  const handleRemoveReminder = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      reminders: prev.reminders.filter((_, i) => i !== index)
    }))
  }, [])

  const validateForm = useCallback((): string | null => {
    if (!formData.title.trim()) {
      return 'Event title is required'
    }
    if (!formData.calendarId) {
      return 'Please select a calendar'
    }
    
    // Validate dates and times
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`)
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`)
    
    if (endDateTime <= startDateTime) {
      return 'End time must be after start time'
    }
    
    return null
  }, [formData])

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`)
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`)

      const eventData: CreateCalendarEventInput = {
        calendarId: formData.calendarId,
        providerId: `${formData.calendarId}-${Date.now()}`,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        location: formData.location.trim() || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        isAllDay: formData.isAllDay,
        status: 'confirmed' as const,
        visibility: 'default' as const,
        transparency: 'opaque' as const,
        attachments: [],
        uid: `flowdesk-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        attendees: formData.attendees.length > 0 ? formData.attendees.map(email => ({
          email,
          displayName: email,
          responseStatus: 'needsAction' as const,
          optional: false,
          isResource: false
        })) : [],
        reminders: formData.reminders.length > 0 ? formData.reminders : [],
        recurrence: formData.recurrence?.frequency !== 'none' && formData.recurrence ? {
          frequency: formData.recurrence.frequency.toUpperCase() as any,
          interval: formData.recurrence.interval,
          until: formData.recurrence.endDate ? new Date(formData.recurrence.endDate) : undefined,
          rrule: `FREQ=${formData.recurrence.frequency.toUpperCase()};INTERVAL=${formData.recurrence.interval}`
        } : undefined
      }

      const result = await dispatch(createCalendarEvent(eventData)).unwrap()
      if (onSuccess) {
        // Convert result to CalendarEvent type if needed
        onSuccess(result as any)
      }
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create event')
    }
  }, [dispatch, formData, validateForm, onSuccess, onClose])

  const selectedCalendar = allCalendars.find(cal => cal.id === formData.calendarId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Event"
      description="Add a new event to your calendar"
      size="lg"
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Basic Event Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Event Title *</label>
            <Input
              value={formData.title}
              onChange={(value) => handleInputChange('title', value)}
              placeholder="Enter event title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Calendar *</label>
            <Select value={formData.calendarId} onValueChange={(value) => handleInputChange('calendarId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                {allCalendars.map(calendar => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: calendar.color }}
                      />
                      {calendar.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date and Time */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4" />
            <label className="text-sm font-medium">Date & Time</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleAllDay}
              className={formData.isAllDay ? 'bg-primary/10 border-primary' : ''}
            >
              All Day
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(value) => handleInputChange('startDate', value)}
              />
            </div>
            {!formData.isAllDay && (
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(value) => handleInputChange('startTime', value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(value) => handleInputChange('endDate', value)}
              />
            </div>
            {!formData.isAllDay && (
              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(value) => handleInputChange('endTime', value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            <label className="text-sm font-medium">Location</label>
          </div>
          <Input
            value={formData.location}
            onChange={(value) => handleInputChange('location', value)}
            placeholder="Enter event location"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <Textarea
            value={formData.description}
            onChange={(value) => handleInputChange('description', value)}
            placeholder="Add event description (optional)"
            rows={3}
          />
        </div>

        {/* Attendees */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4" />
            <label className="text-sm font-medium">Attendees</label>
          </div>
          
          <div className="flex gap-2 mb-2">
            <Input
              value={attendeeInput}
              onChange={(value) => setAttendeeInput(value)}
              placeholder="Enter email address"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddAttendee()
                }
              }}
            />
            <Button 
              type="button" 
              onClick={handleAddAttendee}
              disabled={!attendeeInput.trim()}
            >
              Add
            </Button>
          </div>
          
          {formData.attendees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.attendees.map(email => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => handleRemoveAttendee(email)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Reminders */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4" />
            <label className="text-sm font-medium">Reminders</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddReminder}
            >
              Add Reminder
            </Button>
          </div>
          
          {formData.reminders.map((reminder, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <Select 
                value={reminder.method} 
                onValueChange={(value) => handleUpdateReminder(index, { method: value as any })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popup">Popup</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={reminder.minutesBefore.toString()} 
                onValueChange={(value) => handleUpdateReminder(index, { minutesBefore: parseInt(value) })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">At event time</SelectItem>
                  <SelectItem value="5">5 minutes before</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveReminder(index)}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Recurrence */}
        <div>
          <label className="block text-sm font-medium mb-2">Repeat</label>
          <Select 
            value={formData.recurrence?.frequency || 'none'} 
            onValueChange={(value) => handleInputChange('recurrence', { 
              ...formData.recurrence, 
              frequency: value as any 
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Don't repeat</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !formData.title.trim()}>
            {isLoading ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}