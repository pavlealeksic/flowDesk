import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  addEventTemplate,
  updateEventTemplate,
  deleteEventTemplate,
  addConflictingEvent,
  resolveConflict
} from '../../store/slices/calendarSlice'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Switch,
  Badge,
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn
} from '../ui'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  Bell,
  Repeat,
  File as Template,
  AlertTriangle,
  Save,
  Trash2,
  Copy,
  Send,
  Settings
} from 'lucide-react'
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  EventReminder,
  RecurrenceRule,
  ConferencingSolution,
  EventVisibility
} from '@flow-desk/shared'
import EventTemplateEditor from './EventTemplateEditor'
import { RecurrenceEditor } from './RecurrenceEditor'
import { ConferencingSetup } from './ConferencingSetup'
import { AttendeeManager } from './AttendeeManager'
import { ConflictDetector } from './ConflictDetector'

interface EventManagerProps {
  isOpen: boolean
  onClose: () => void
  event?: CalendarEvent
  defaultCalendarId?: string
  defaultStartTime?: Date
  defaultEndTime?: Date
  mode?: 'create' | 'edit' | 'template'
}

export const EventManager: React.FC<EventManagerProps> = ({
  isOpen,
  onClose,
  event,
  defaultCalendarId,
  defaultStartTime,
  defaultEndTime,
  mode = 'create'
}) => {
  const dispatch = useAppDispatch()
  const { calendars, eventTemplates, conflictingEvents, calendarSettings } = useAppSelector(state => state.calendar)
  
  // Form state
  const [formData, setFormData] = useState<Partial<CreateCalendarEventInput>>({
    calendarId: defaultCalendarId || '',
    title: '',
    description: '',
    location: '',
    startTime: defaultStartTime || new Date(),
    endTime: defaultEndTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    isAllDay: false,
    status: 'confirmed',
    visibility: 'default',
    attendees: [],
    reminders: calendarSettings.defaultReminders,
    transparency: 'opaque',
    color: undefined
  })
  
  const [activeTab, setActiveTab] = useState('details')
  const [showConflicts, setShowConflicts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Initialize form data
  useEffect(() => {
    if (event && mode === 'edit') {
      setFormData({
        calendarId: event.calendarId,
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        status: event.status,
        visibility: event.visibility,
        attendees: event.attendees,
        reminders: event.reminders,
        recurrence: event.recurrence,
        conferencing: event.conferencing,
        transparency: event.transparency,
        color: event.color
      })
    }
  }, [event, mode])
  
  // Get all available calendars
  const allCalendars = Object.values(calendars).flat()
  const writableCalendars = allCalendars.filter(cal => 
    cal.accessLevel === 'owner' || cal.accessLevel === 'writer'
  )
  
  // Validation
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required'
    }
    
    if (!formData.calendarId) {
      newErrors.calendarId = 'Calendar is required'
    }
    
    if (formData.startTime && formData.endTime) {
      if (new Date(formData.endTime) <= new Date(formData.startTime)) {
        newErrors.endTime = 'End time must be after start time'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])
  
  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)
    try {
      const eventData = {
        ...formData,
        uid: event?.uid || `flowdesk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        providerId: event?.providerId || '',
        sequence: (event?.sequence || 0) + (mode === 'edit' ? 1 : 0)
      } as CreateCalendarEventInput
      
      if (mode === 'edit' && event) {
        await dispatch(updateCalendarEvent({
          calendarId: event.calendarId,
          eventId: event.id,
          updates: eventData as UpdateCalendarEventInput
        })).unwrap()
      } else {
        await dispatch(createCalendarEvent(eventData)).unwrap()
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving event:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save event' })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, mode, event, dispatch, onClose])
  
  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!event) return
    
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await dispatch(deleteCalendarEvent({
          calendarId: event.calendarId,
          eventId: event.id
        })).unwrap()
        onClose()
      } catch (error) {
        console.error('Error deleting event:', error)
      }
    }
  }, [event, dispatch, onClose])
  
  // Apply template
  const handleApplyTemplate = useCallback((templateId: string) => {
    const template = eventTemplates.find(t => t.id === templateId)
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title,
        description: template.description,
        location: template.location,
        endTime: prev.startTime ? new Date(new Date(prev.startTime).getTime() + template.duration * 60000) : prev.endTime,
        reminders: template.reminders,
        attendees: template.attendees?.map(email => ({
          email,
          displayName: '',
          responseStatus: 'needsAction' as const,
          optional: false,
          isResource: false
        })) || [],
        color: template.color
      }))
    }
  }, [eventTemplates])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {mode === 'edit' ? 'Edit Event' : mode === 'template' ? 'Create Template' : 'New Event'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="attendees">Attendees</TabsTrigger>
              <TabsTrigger value="recurrence">Recurrence</TabsTrigger>
              <TabsTrigger value="conferencing">Meeting</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Event Templates */}
              {mode === 'create' && eventTemplates.length > 0 && (
                <Card className="p-4">
                  <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
                  <div className="flex flex-wrap gap-2">
                    {eventTemplates.slice(0, 5).map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyTemplate(template.id)}
                        className="flex items-center gap-1"
                      >
                        <Template className="h-3 w-3" />
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </Card>
              )}
              
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Event Title *</Label>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter event title"
                    className={errors.title ? 'border-red-500' : ''}
                  />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                </div>
                
                <div>
                  <Label htmlFor="calendar">Calendar *</Label>
                  <Select
                    value={formData.calendarId || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, calendarId: value }))}
                  >
                    <SelectTrigger className={errors.calendarId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {writableCalendars.map(calendar => (
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
                  {errors.calendarId && <p className="text-red-500 text-sm mt-1">{errors.calendarId}</p>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allDay"
                    checked={formData.isAllDay || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAllDay: checked }))}
                  />
                  <Label htmlFor="allDay">All Day Event</Label>
                </div>
              </div>
              
              {/* Time Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type={formData.isAllDay ? 'date' : 'datetime-local'}
                    value={formData.startTime ? 
                      formData.isAllDay
                        ? new Date(formData.startTime).toISOString().split('T')[0]
                        : new Date(formData.startTime).toISOString().slice(0, 16)
                      : ''
                    }
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      startTime: new Date(e.target.value)
                    }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type={formData.isAllDay ? 'date' : 'datetime-local'}
                    value={formData.endTime ?
                      formData.isAllDay
                        ? new Date(formData.endTime).toISOString().split('T')[0]
                        : new Date(formData.endTime).toISOString().slice(0, 16)
                      : ''
                    }
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      endTime: new Date(e.target.value)
                    }))}
                    className={errors.endTime ? 'border-red-500' : ''}
                  />
                  {errors.endTime && <p className="text-red-500 text-sm mt-1">{errors.endTime}</p>}
                </div>
              </div>
              
              {/* Location */}
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Enter location"
                />
              </div>
              
              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter event description"
                  rows={4}
                />
              </div>
              
              {/* Conflict Detection */}
              <ConflictDetector
                startTime={formData.startTime}
                endTime={formData.endTime}
                attendees={formData.attendees || []}
                onConflictDetected={(conflicts) => setShowConflicts(conflicts.length > 0)}
              />
            </TabsContent>
            
            <TabsContent value="attendees">
              <AttendeeManager
                attendees={formData.attendees || []}
                onChange={(attendees) => setFormData(prev => ({ ...prev, attendees }))}
                canEditAttendees={mode !== 'edit'}
              />
            </TabsContent>
            
            <TabsContent value="recurrence">
              <RecurrenceEditor
                recurrence={formData.recurrence}
                onChange={(recurrence) => setFormData(prev => ({ ...prev, recurrence }))}
                startTime={formData.startTime}
              />
            </TabsContent>
            
            <TabsContent value="conferencing">
              <ConferencingSetup
                conferencing={formData.conferencing}
                onChange={(conferencing) => setFormData(prev => ({ ...prev, conferencing }))}
                attendees={formData.attendees || []}
              />
            </TabsContent>
            
            <TabsContent value="advanced" className="space-y-4">
              {/* Reminders */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Reminders</Label>
                <div className="space-y-2">
                  {(formData.reminders || []).map((reminder, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={reminder.method}
                        onValueChange={(method) => {
                          const newReminders = [...(formData.reminders || [])]
                          newReminders[index] = { ...reminder, method: method as any }
                          setFormData(prev => ({ ...prev, reminders: newReminders }))
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popup">Notification</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input
                        type="number"
                        value={reminder.minutesBefore.toString()}
                        onChange={(e) => {
                          const newReminders = [...(formData.reminders || [])]
                          newReminders[index] = { ...reminder, minutesBefore: parseInt(e.target.value) }
                          setFormData(prev => ({ ...prev, reminders: newReminders }))
                        }}
                        className="w-20"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground">minutes before</span>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newReminders = [...(formData.reminders || [])]
                          newReminders.splice(index, 1)
                          setFormData(prev => ({ ...prev, reminders: newReminders }))
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newReminders = [
                        ...(formData.reminders || []),
                        { method: 'popup' as const, minutesBefore: 15 }
                      ]
                      setFormData(prev => ({ ...prev, reminders: newReminders }))
                    }}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Add Reminder
                  </Button>
                </div>
              </div>
              
              {/* Event Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || 'confirmed'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="tentative">Tentative</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select
                    value={formData.visibility || 'default'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value as EventVisibility }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="showAsBusy"
                  checked={formData.transparency === 'opaque'}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, transparency: checked ? 'opaque' : 'transparent' }))
                  }
                />
                <Label htmlFor="showAsBusy">Show as busy (blocks time in calendar)</Label>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
            
            {showConflicts && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Scheduling conflicts detected
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  {mode === 'edit' ? 'Update' : 'Create'} Event
                </>
              )}
            </Button>
          </div>
        </div>
        
        {errors.submit && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{errors.submit}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}