import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import { addNotification, createCalendarEvent } from '../../store/slices/calendarSlice'
import {
  Button,
  Card,
  Badge,
  Avatar,
  AvatarFallback,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui'
import {
  Mail,
  Calendar,
  Clock,
  MapPin,
  Users,
  Brain,
  CheckCircle,
  X,
  Plus,
  Search,
  Filter,
  Zap,
  Settings
} from 'lucide-react'
import dayjs from 'dayjs'
import type { CalendarEvent, EventAttendee, CreateCalendarEventInput } from '@flow-desk/shared'

interface EmailCalendarIntegrationProps {
  isOpen: boolean
  onClose: () => void
}

interface DetectedEvent {
  id: string
  emailId: string
  emailSubject: string
  emailFrom: string
  emailDate: Date
  confidence: number
  eventData: {
    title: string
    description?: string
    startTime?: Date
    endTime?: Date
    location?: string
    attendees: string[]
    isAllDay?: boolean
  }
  extractedData: {
    dates: string[]
    times: string[]
    locations: string[]
    people: string[]
  }
  status: 'pending' | 'created' | 'ignored'
  reasoning: string[]
}

interface SmartSuggestion {
  type: 'meeting_request' | 'travel_booking' | 'appointment' | 'deadline' | 'reminder'
  action: 'create_event' | 'update_event' | 'suggest_time'
  description: string
  confidence: number
  data: any
}

// Mock detected events from emails
const MOCK_DETECTED_EVENTS: DetectedEvent[] = [
  {
    id: '1',
    emailId: 'email-123',
    emailSubject: 'Team Meeting Tomorrow at 2 PM',
    emailFrom: 'sarah@company.com',
    emailDate: new Date(),
    confidence: 95,
    eventData: {
      title: 'Team Meeting',
      startTime: dayjs().add(1, 'day').hour(14).minute(0).toDate(),
      endTime: dayjs().add(1, 'day').hour(15).minute(0).toDate(),
      location: 'Conference Room A',
      attendees: ['sarah@company.com', 'john@company.com'],
      description: 'Weekly team sync meeting'
    },
    extractedData: {
      dates: ['tomorrow'],
      times: ['2 PM', '14:00'],
      locations: ['Conference Room A'],
      people: ['Sarah', 'John']
    },
    status: 'pending',
    reasoning: [
      'Email mentions specific time "2 PM"',
      'Contains meeting-related keywords',
      'Sender is a known colleague',
      'Mentions conference room'
    ]
  },
  {
    id: '2',
    emailId: 'email-124',
    emailSubject: 'Flight Confirmation - SFO to NYC - March 15',
    emailFrom: 'noreply@airline.com',
    emailDate: new Date(),
    confidence: 98,
    eventData: {
      title: 'Flight to NYC',
      startTime: dayjs('2024-03-15').hour(8).minute(30).toDate(),
      endTime: dayjs('2024-03-15').hour(17).minute(15).toDate(),
      location: 'SFO Airport',
      attendees: [],
      isAllDay: false,
      description: 'Flight AA123 - SFO to JFK'
    },
    extractedData: {
      dates: ['March 15', '2024-03-15'],
      times: ['8:30 AM', '5:15 PM'],
      locations: ['SFO', 'NYC', 'JFK'],
      people: []
    },
    status: 'pending',
    reasoning: [
      'Flight confirmation email',
      'Contains departure and arrival times',
      'Airport codes detected',
      'Date clearly specified'
    ]
  },
  {
    id: '3',
    emailId: 'email-125',
    emailSubject: 'Doctor Appointment Reminder',
    emailFrom: 'appointments@healthcare.com',
    emailDate: new Date(),
    confidence: 90,
    eventData: {
      title: 'Doctor Appointment - Dr. Smith',
      startTime: dayjs().add(3, 'days').hour(10).minute(30).toDate(),
      endTime: dayjs().add(3, 'days').hour(11).minute(30).toDate(),
      location: '123 Medical Center, Suite 200',
      attendees: [],
      description: 'Annual checkup with Dr. Smith'
    },
    extractedData: {
      dates: ['Friday'],
      times: ['10:30 AM'],
      locations: ['Medical Center'],
      people: ['Dr. Smith']
    },
    status: 'pending',
    reasoning: [
      'Medical appointment confirmation',
      'Contains specific time and date',
      'Doctor name mentioned',
      'Medical facility address provided'
    ]
  }
]

export const EmailCalendarIntegration: React.FC<EmailCalendarIntegrationProps> = ({
  isOpen,
  onClose
}) => {
  const dispatch = useAppDispatch()
  const { calendars, calendarSettings } = useAppSelector(state => state.calendar)
  
  const [selectedTab, setSelectedTab] = useState('detected')
  const [detectedEvents, setDetectedEvents] = useState<DetectedEvent[]>(MOCK_DETECTED_EVENTS)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'high_confidence' | 'pending'>('all')
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([])

  // Get writable calendars for event creation
  const writableCalendars = Object.values(calendars).flat().filter(cal => 
    cal.accessLevel === 'owner' || cal.accessLevel === 'writer'
  )

  const defaultCalendar = writableCalendars.find(cal => cal.isPrimary) || writableCalendars[0]

  // Filter detected events
  const filteredEvents = detectedEvents.filter(event => {
    const matchesSearch = searchQuery === '' || 
      event.eventData.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.emailSubject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.emailFrom.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'high_confidence' && event.confidence >= 80) ||
      (filterType === 'pending' && event.status === 'pending')
    
    return matchesSearch && matchesFilter
  })

  // Create calendar event from detected event
  const createEventFromEmail = useCallback(async (detectedEvent: DetectedEvent) => {
    if (!defaultCalendar) return

    setIsProcessing(true)
    try {
      const eventData: CreateCalendarEventInput = {
        calendarId: defaultCalendar.id,
        providerId: '',
        title: detectedEvent.eventData.title,
        description: detectedEvent.eventData.description,
        location: detectedEvent.eventData.location,
        startTime: detectedEvent.eventData.startTime || new Date(),
        endTime: detectedEvent.eventData.endTime || new Date(Date.now() + 60 * 60 * 1000),
        isAllDay: detectedEvent.eventData.isAllDay || false,
        status: 'confirmed',
        visibility: 'default',
        attendees: detectedEvent.eventData.attendees.map(email => ({
          email,
          displayName: '',
          responseStatus: 'needsAction' as const,
          optional: false,
          isResource: false
        })),
        reminders: calendarSettings.defaultReminders,
        transparency: 'opaque',
        uid: `flowdesk-email-${detectedEvent.emailId}-${Date.now()}`
      }

      await dispatch(createCalendarEvent(eventData)).unwrap()

      // Update detected event status
      setDetectedEvents(prev => 
        prev.map(event => 
          event.id === detectedEvent.id 
            ? { ...event, status: 'created' as const }
            : event
        )
      )

      // Show success notification
      dispatch(addNotification({
        id: `event-created-${Date.now()}`,
        type: 'event_update',
        title: 'Event Created from Email',
        message: `Created "${detectedEvent.eventData.title}" from email`,
        priority: 'normal',
        timestamp: new Date(),
        read: false,
        actionable: false
      }))

    } catch (error) {
      console.error('Error creating event from email:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [defaultCalendar, dispatch, calendarSettings])

  // Create multiple events
  const createSelectedEvents = useCallback(async () => {
    const eventsToCreate = detectedEvents.filter(event => 
      selectedEvents.includes(event.id) && event.status === 'pending'
    )

    for (const event of eventsToCreate) {
      await createEventFromEmail(event)
    }

    setSelectedEvents([])
  }, [selectedEvents, detectedEvents, createEventFromEmail])

  // Ignore detected event
  const ignoreEvent = useCallback((eventId: string) => {
    setDetectedEvents(prev => 
      prev.map(event => 
        event.id === eventId 
          ? { ...event, status: 'ignored' as const }
          : event
      )
    )
  }, [])

  // Toggle event selection
  const toggleEventSelection = useCallback((eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    )
  }, [])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-50'
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getStatusColor = (status: DetectedEvent['status']) => {
    switch (status) {
      case 'pending': return 'text-blue-600 bg-blue-50'
      case 'created': return 'text-green-600 bg-green-50'
      case 'ignored': return 'text-gray-600 bg-gray-50'
    }
  }

  const pendingEvents = detectedEvents.filter(e => e.status === 'pending')
  const createdEvents = detectedEvents.filter(e => e.status === 'created')

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Smart Email-Calendar Integration
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detected" className="text-sm">
              Detected Events ({pendingEvents.length})
            </TabsTrigger>
            <TabsTrigger value="created" className="text-sm">
              Created ({createdEvents.length})
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="text-sm">
              Smart Suggestions
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-sm">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detected" className="space-y-4 mt-4">
            {/* Filters and Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={filterType} onValueChange={setFilterType as any}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="high_confidence">High Confidence</SelectItem>
                    <SelectItem value="pending">Pending Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedEvents.length > 0 && (
                <Button
                  onClick={createSelectedEvents}
                  disabled={isProcessing}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Create {selectedEvents.length} Event{selectedEvents.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            {/* Detected Events List */}
            <ScrollArea className="h-96">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No events detected</p>
                  <p className="text-xs mt-1">We'll automatically scan your emails for calendar events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => (
                    <Card
                      key={event.id}
                      className={`p-4 ${
                        selectedEvents.includes(event.id) ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {event.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selectedEvents.includes(event.id)}
                              onChange={() => toggleEventSelection(event.id)}
                              className="mt-1"
                            />
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium">{event.eventData.title}</h4>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${getConfidenceColor(event.confidence)}`}>
                                  {event.confidence}% confidence
                                </Badge>
                                <Badge className={`text-xs ${getStatusColor(event.status)}`}>
                                  {event.status}
                                </Badge>
                              </div>
                            </div>

                            <div className="text-sm text-muted-foreground space-y-1">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <span>{event.emailSubject}</span>
                                <span className="text-xs">from {event.emailFrom}</span>
                              </div>
                              
                              {event.eventData.startTime && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {dayjs(event.eventData.startTime).format('MMM D, YYYY [at] h:mm A')}
                                    {event.eventData.endTime && 
                                      ` - ${dayjs(event.eventData.endTime).format('h:mm A')}`
                                    }
                                  </span>
                                </div>
                              )}
                              
                              {event.eventData.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span>{event.eventData.location}</span>
                                </div>
                              )}

                              {event.eventData.attendees.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  <span>{event.eventData.attendees.length} attendee{event.eventData.attendees.length !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>

                            {/* AI Reasoning */}
                            <div className="mt-2">
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Why was this detected? (AI Analysis)
                                </summary>
                                <ul className="mt-2 space-y-1 text-muted-foreground">
                                  {event.reasoning.map((reason, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-primary">•</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            </div>
                          </div>
                        </div>

                        {event.status === 'pending' && (
                          <div className="flex items-center gap-1 ml-4">
                            <Button
                              size="sm"
                              onClick={() => createEventFromEmail(event)}
                              disabled={isProcessing}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Add to Calendar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => ignoreEvent(event.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="created" className="mt-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Successfully Created Events</h4>
              
              {createdEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No events created yet</p>
                  <p className="text-xs mt-1">Events you create from emails will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {createdEvents.map((event) => (
                      <Card key={event.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{event.eventData.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              Created from: {event.emailSubject}
                            </p>
                            {event.eventData.startTime && (
                              <p className="text-xs text-muted-foreground">
                                {dayjs(event.eventData.startTime).format('MMM D, YYYY [at] h:mm A')}
                              </p>
                            )}
                          </div>
                          <Badge className="text-xs bg-green-50 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Created
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="mt-4">
            <Card className="p-6 text-center">
              <Zap className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <h4 className="font-medium mb-2">Smart Suggestions</h4>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered suggestions for better calendar management
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Automatic meeting room booking based on attendee count</p>
                <p>• Travel time suggestions between appointments</p>
                <p>• Meeting preparation reminders</p>
                <p>• Scheduling conflict resolution</p>
              </div>
              <Badge className="mt-4" variant="outline">
                Coming Soon
              </Badge>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card className="p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Email Detection Settings
              </h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Auto-detect events from emails</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically scan incoming emails for calendar events
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">High confidence auto-add</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically add events with 90%+ confidence
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Travel bookings detection</Label>
                    <p className="text-xs text-muted-foreground">
                      Detect flights, hotels, and transportation bookings
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Meeting invitations</Label>
                    <p className="text-xs text-muted-foreground">
                      Extract meeting details from email invitations
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-3">Default Calendar</h4>
              <Select value={defaultCalendar?.id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default calendar" />
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
              <p className="text-xs text-muted-foreground mt-1">
                Events detected from emails will be added to this calendar
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}