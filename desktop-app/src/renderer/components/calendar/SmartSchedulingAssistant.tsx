import React, { useState, useCallback, useEffect } from 'react'
import { useAppSelector } from '../../store'
import {
  Button,
  Card,
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
  Badge,
  Avatar,
  AvatarFallback,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui'
import {
  Brain,
  Calendar,
  Clock,
  Users,
  MapPin,
  Zap,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Settings
} from 'lucide-react'
import dayjs from 'dayjs'
import type { CalendarEvent, EventAttendee, FreeBusySlot } from '@flow-desk/shared'

interface SmartSchedulingAssistantProps {
  isOpen: boolean
  onClose: () => void
  onScheduleEvent: (suggestions: SchedulingSuggestion) => void
  attendees?: EventAttendee[]
  duration?: number
  preferredTimes?: string[]
}

interface SchedulingSuggestion {
  startTime: Date
  endTime: Date
  confidence: number
  reason: string
  conflicts: string[]
  travelTime?: number
  venue?: string
  attendeeAvailability: Record<string, 'available' | 'busy' | 'tentative'>
}

interface TimeSlot {
  start: Date
  end: Date
  score: number
  reasons: string[]
  issues: string[]
}

export const SmartSchedulingAssistant: React.FC<SmartSchedulingAssistantProps> = ({
  isOpen,
  onClose,
  onScheduleEvent,
  attendees = [],
  duration = 60,
  preferredTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
}) => {
  const { events, workingHours, freeBusyData, travelTimeEnabled } = useAppSelector(state => state.calendar)
  const [selectedTab, setSelectedTab] = useState('suggestions')
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: dayjs().format('YYYY-MM-DD'),
    end: dayjs().add(14, 'days').format('YYYY-MM-DD')
  })

  // Analyze best meeting times
  const analyzeSchedulingOptions = useCallback(async () => {
    setIsAnalyzing(true)
    
    try {
      const startDate = dayjs(dateRange.start)
      const endDate = dayjs(dateRange.end)
      const timeSlots: TimeSlot[] = []
      
      let currentDate = startDate
      while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
        const dayOfWeek = currentDate.format('dddd').toLowerCase() as keyof typeof workingHours
        const dayWorkingHours = workingHours[dayOfWeek]
        
        if (dayWorkingHours.enabled) {
          // Generate time slots for this day
          const dayStart = currentDate.hour(parseInt(dayWorkingHours.start.split(':')[0]))
            .minute(parseInt(dayWorkingHours.start.split(':')[1]))
          const dayEnd = currentDate.hour(parseInt(dayWorkingHours.end.split(':')[0]))
            .minute(parseInt(dayWorkingHours.end.split(':')[1]))
          
          let slotStart = dayStart
          while (slotStart.add(duration, 'minute').isBefore(dayEnd) || 
                 slotStart.add(duration, 'minute').isSame(dayEnd)) {
            
            const slotEnd = slotStart.add(duration, 'minute')
            const slot = analyzeTimeSlot(slotStart.toDate(), slotEnd.toDate())
            timeSlots.push(slot)
            
            slotStart = slotStart.add(30, 'minute') // 30-minute intervals
          }
        }
        
        currentDate = currentDate.add(1, 'day')
      }
      
      // Sort by score and take top 10
      const topSlots = timeSlots
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(slot => ({
          startTime: slot.start,
          endTime: slot.end,
          confidence: Math.min(100, slot.score),
          reason: slot.reasons.join(', '),
          conflicts: slot.issues,
          attendeeAvailability: getAttendeeAvailability(slot.start, slot.end)
        }))
      
      setSuggestions(topSlots)
    } catch (error) {
      console.error('Error analyzing scheduling options:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [dateRange, duration, workingHours, attendees])

  // Analyze a specific time slot
  const analyzeTimeSlot = useCallback((start: Date, end: Date): TimeSlot => {
    const startTime = dayjs(start)
    const endTime = dayjs(end)
    let score = 50 // Base score
    const reasons: string[] = []
    const issues: string[] = []

    // Prefer morning hours (9-11 AM)
    if (startTime.hour() >= 9 && startTime.hour() <= 11) {
      score += 20
      reasons.push('Morning hours (peak productivity)')
    }

    // Prefer afternoon hours (2-4 PM) as secondary option
    else if (startTime.hour() >= 14 && startTime.hour() <= 16) {
      score += 15
      reasons.push('Afternoon hours (good availability)')
    }

    // Avoid lunch hours (12-1 PM)
    else if (startTime.hour() === 12) {
      score -= 15
      issues.push('Lunch hour conflict')
    }

    // Avoid end of day (after 5 PM)
    else if (startTime.hour() >= 17) {
      score -= 10
      issues.push('Late in the day')
    }

    // Check for conflicts with existing events
    const allEventsList = Object.values(events).flat()
    const hasConflicts = allEventsList.some(event => {
      const eventStart = dayjs(event.startTime)
      const eventEnd = dayjs(event.endTime)
      return (startTime.isBefore(eventEnd) && endTime.isAfter(eventStart))
    })

    if (hasConflicts) {
      score -= 30
      issues.push('Conflicts with existing events')
    } else {
      score += 10
      reasons.push('No calendar conflicts')
    }

    // Check attendee availability
    let availableAttendees = 0
    attendees.forEach(attendee => {
      const busySlots = freeBusyData[attendee.email] || []
      const isAvailable = !busySlots.some(slot => {
        const slotStart = dayjs(slot.start)
        const slotEnd = dayjs(slot.end)
        return (startTime.isBefore(slotEnd) && endTime.isAfter(slotStart)) && slot.status === 'busy'
      })
      
      if (isAvailable) {
        availableAttendees++
      }
    })

    if (attendees.length > 0) {
      const availabilityRatio = availableAttendees / attendees.length
      score += availabilityRatio * 20
      
      if (availabilityRatio === 1) {
        reasons.push('All attendees available')
      } else if (availabilityRatio >= 0.8) {
        reasons.push('Most attendees available')
      } else {
        issues.push(`${attendees.length - availableAttendees} attendees may be busy`)
      }
    }

    // Bonus for preferred times
    const timeStr = startTime.format('HH:mm')
    if (preferredTimes.includes(timeStr)) {
      score += 15
      reasons.push('Matches preferred time')
    }

    // Travel time considerations
    if (travelTimeEnabled) {
      const previousEvent = findPreviousEvent(start)
      const nextEvent = findNextEvent(end)
      
      if (previousEvent && dayjs(start).diff(dayjs(previousEvent.endTime), 'minute') < 15) {
        score -= 5
        issues.push('Limited travel time from previous event')
      }
      
      if (nextEvent && dayjs(nextEvent.startTime).diff(dayjs(end), 'minute') < 15) {
        score -= 5
        issues.push('Limited travel time to next event')
      }
    }

    return {
      start,
      end,
      score: Math.max(0, score),
      reasons,
      issues
    }
  }, [events, attendees, freeBusyData, preferredTimes, travelTimeEnabled])

  // Get attendee availability for a time slot
  const getAttendeeAvailability = useCallback((start: Date, end: Date): Record<string, 'available' | 'busy' | 'tentative'> => {
    const availability: Record<string, 'available' | 'busy' | 'tentative'> = {}
    
    attendees.forEach(attendee => {
      const busySlots = freeBusyData[attendee.email] || []
      const conflict = busySlots.find(slot => {
        const slotStart = dayjs(slot.start)
        const slotEnd = dayjs(slot.end)
        return (dayjs(start).isBefore(slotEnd) && dayjs(end).isAfter(slotStart))
      })
      
      if (conflict) {
        availability[attendee.email] = conflict.status === 'tentative' ? 'tentative' : 'busy'
      } else {
        availability[attendee.email] = 'available'
      }
    })
    
    return availability
  }, [attendees, freeBusyData])

  // Find previous event on the same day
  const findPreviousEvent = useCallback((time: Date) => {
    const allEventsList = Object.values(events).flat()
    return allEventsList
      .filter(event => dayjs(event.endTime).isSame(dayjs(time), 'day') && dayjs(event.endTime).isBefore(dayjs(time)))
      .sort((a, b) => dayjs(b.endTime).valueOf() - dayjs(a.endTime).valueOf())[0]
  }, [events])

  // Find next event on the same day
  const findNextEvent = useCallback((time: Date) => {
    const allEventsList = Object.values(events).flat()
    return allEventsList
      .filter(event => dayjs(event.startTime).isSame(dayjs(time), 'day') && dayjs(event.startTime).isAfter(dayjs(time)))
      .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())[0]
  }, [events])

  // Auto-analyze when dialog opens
  useEffect(() => {
    if (isOpen && attendees.length > 0) {
      analyzeSchedulingOptions()
    }
  }, [isOpen, attendees, analyzeSchedulingOptions])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50'
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getAvailabilityIcon = (status: 'available' | 'busy' | 'tentative') => {
    switch (status) {
      case 'available': return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'tentative': return <AlertCircle className="h-3 w-3 text-yellow-500" />
      case 'busy': return <AlertCircle className="h-3 w-3 text-red-500" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Smart Scheduling Assistant
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggestions">AI Suggestions</TabsTrigger>
            <TabsTrigger value="analysis">Availability Analysis</TabsTrigger>
            <TabsTrigger value="settings">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-4">
            <div className="space-y-4">
              {/* Date Range Selector */}
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="startDate" className="text-sm">Search from</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-sm">Until</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-40"
                  />
                </div>
                <Button 
                  onClick={analyzeSchedulingOptions} 
                  disabled={isAnalyzing}
                  variant="outline"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  {isAnalyzing ? 'Analyzing...' : 'Find Times'}
                </Button>
              </div>

              {/* Suggestions List */}
              <ScrollArea className="h-96">
                {isAnalyzing ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Brain className="h-8 w-8 mx-auto mb-2 animate-pulse text-blue-500" />
                      <p className="text-sm text-muted-foreground">
                        Analyzing {attendees.length} attendee{attendees.length !== 1 ? 's' : ''} availability...
                      </p>
                    </div>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No scheduling suggestions found</p>
                    <p className="text-xs mt-1">Try expanding the date range or reducing attendees</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                      <Card
                        key={index}
                        className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => onScheduleEvent(suggestion)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div>
                                <div className="font-medium text-lg">
                                  {dayjs(suggestion.startTime).format('dddd, MMM D')}
                                </div>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {dayjs(suggestion.startTime).format('h:mm A')} - {dayjs(suggestion.endTime).format('h:mm A')}
                                </div>
                              </div>
                              
                              <Badge className={`${getConfidenceColor(suggestion.confidence)} border-0`}>
                                {suggestion.confidence}% match
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.reason}
                            </p>

                            {/* Attendee availability */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {attendees.slice(0, 5).map((attendee) => {
                                const status = suggestion.attendeeAvailability[attendee.email]
                                return (
                                  <div
                                    key={attendee.email}
                                    className="flex items-center gap-1 text-xs"
                                    title={`${attendee.displayName || attendee.email}: ${status}`}
                                  >
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-xs">
                                        {(attendee.displayName || attendee.email)[0].toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    {getAvailabilityIcon(status)}
                                  </div>
                                )
                              })}
                              {attendees.length > 5 && (
                                <span className="text-xs text-muted-foreground">
                                  +{attendees.length - 5} more
                                </span>
                              )}
                            </div>

                            {/* Conflicts */}
                            {suggestion.conflicts.length > 0 && (
                              <div className="mt-2">
                                <div className="flex flex-wrap gap-1">
                                  {suggestion.conflicts.map((conflict, i) => (
                                    <Badge key={i} variant="outline" className="text-xs text-orange-600">
                                      {conflict}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <Button variant="outline" size="sm">
                            Schedule
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="mt-4">
            <Card className="p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Scheduling Analysis
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground mb-2">Meeting Participants</div>
                  <div className="space-y-1">
                    {attendees.map(attendee => (
                      <div key={attendee.email} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {(attendee.displayName || attendee.email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{attendee.displayName || attendee.email}</span>
                        {attendee.optional && <Badge variant="outline" className="text-xs">Optional</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="font-medium text-muted-foreground mb-2">Constraints</div>
                  <div className="space-y-1 text-xs">
                    <div>Duration: {duration} minutes</div>
                    <div>Date range: {dayjs(dateRange.start).format('MMM D')} - {dayjs(dateRange.end).format('MMM D')}</div>
                    <div>Working hours: {workingHours.monday.start} - {workingHours.monday.end}</div>
                    {travelTimeEnabled && <div>Travel time: Enabled</div>}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card className="p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Scheduling Preferences
              </h4>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Preferred Meeting Times</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                      <Button
                        key={time}
                        variant={preferredTimes.includes(time) ? 'primary' : 'outline'}
                        size="sm"
                        className="text-xs"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Smart Features</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Consider travel time</span>
                      <Badge variant={travelTimeEnabled ? 'default' : 'outline'}>
                        {travelTimeEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avoid lunch hours</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Prefer morning slots</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}