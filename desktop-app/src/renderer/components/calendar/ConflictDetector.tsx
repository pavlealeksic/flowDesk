import React, { useEffect, useState, useCallback } from 'react'
import { useAppSelector } from '../../store'
import { Alert, AlertDescription } from '../ui'
import { Button } from '../ui'
import { AlertTriangle, Clock, Users, MapPin, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import type { CalendarEvent, EventAttendee } from '@flow-desk/shared'

interface ConflictDetectorProps {
  startTime?: Date
  endTime?: Date
  attendees?: EventAttendee[]
  onConflictDetected?: (conflicts: ConflictInfo[]) => void
}

interface ConflictInfo {
  type: 'time_overlap' | 'double_booking' | 'travel_time' | 'attendee_busy'
  severity: 'warning' | 'error'
  message: string
  affectedEvent?: CalendarEvent
  affectedAttendee?: string
  suggestion?: string
}

export const ConflictDetector: React.FC<ConflictDetectorProps> = ({
  startTime,
  endTime,
  attendees = [],
  onConflictDetected
}) => {
  const { events, calendars, freeBusyData, travelTimeEnabled, workingHours } = useAppSelector(state => state.calendar)
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [isChecking, setIsChecking] = useState(false)

  // Get all events from visible calendars
  const allEvents = React.useMemo(() => {
    const eventsList: CalendarEvent[] = []
    Object.values(events).forEach(calendarEvents => {
      eventsList.push(...calendarEvents)
    })
    return eventsList
  }, [events])

  // Check for conflicts
  const checkConflicts = useCallback(async () => {
    if (!startTime || !endTime) {
      setConflicts([])
      onConflictDetected?.([])
      return
    }

    setIsChecking(true)
    const detectedConflicts: ConflictInfo[] = []

    try {
      const eventStart = dayjs(startTime)
      const eventEnd = dayjs(endTime)

      // Check for time overlaps with existing events
      allEvents.forEach(existingEvent => {
        const existingStart = dayjs(existingEvent.startTime)
        const existingEnd = dayjs(existingEvent.endTime)

        // Check if events overlap
        if (
          (eventStart.isBefore(existingEnd) && eventEnd.isAfter(existingStart)) ||
          (existingStart.isBefore(eventEnd) && existingEnd.isAfter(eventStart))
        ) {
          // Only flag as conflict if it's the same calendar and not transparent
          const calendar = Object.values(calendars).flat().find(cal => cal.id === existingEvent.calendarId)
          
          if (existingEvent.transparency === 'opaque') {
            detectedConflicts.push({
              type: 'time_overlap',
              severity: 'error',
              message: `Overlaps with "${existingEvent.title}"`,
              affectedEvent: existingEvent,
              suggestion: 'Consider moving the event to avoid conflict'
            })
          }
        }
      })

      // Check working hours
      const isWorkingHour = (date: dayjs.Dayjs) => {
        const dayOfWeek = date.format('dddd').toLowerCase() as keyof typeof workingHours
        const dayHours = workingHours[dayOfWeek]
        
        if (!dayHours.enabled) return false
        
        const timeStr = date.format('HH:mm')
        return timeStr >= dayHours.start && timeStr <= dayHours.end
      }

      if (!isWorkingHour(eventStart) || !isWorkingHour(eventEnd)) {
        detectedConflicts.push({
          type: 'time_overlap',
          severity: 'warning',
          message: 'Event is scheduled outside working hours',
          suggestion: 'Consider scheduling during working hours'
        })
      }

      // Check attendee availability
      attendees.forEach(attendee => {
        if (freeBusyData[attendee.email]) {
          const busySlots = freeBusyData[attendee.email]
          
          busySlots.forEach(slot => {
            const slotStart = dayjs(slot.start)
            const slotEnd = dayjs(slot.end)
            
            if (
              (eventStart.isBefore(slotEnd) && eventEnd.isAfter(slotStart)) &&
              slot.status === 'busy'
            ) {
              detectedConflicts.push({
                type: 'attendee_busy',
                severity: 'warning',
                message: `${attendee.displayName || attendee.email} appears to be busy`,
                affectedAttendee: attendee.email,
                suggestion: 'Check with attendee or find alternative time'
              })
            }
          })
        }
      })

      // Check travel time if enabled
      if (travelTimeEnabled && allEvents.length > 0) {
        // Find events before and after this one
        const sortedEvents = allEvents
          .filter(e => dayjs(e.startTime).isSame(eventStart, 'day'))
          .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())

        const eventBeforeIndex = sortedEvents.findIndex(e => dayjs(e.endTime).isAfter(eventStart))
        const eventBefore = eventBeforeIndex > 0 ? sortedEvents[eventBeforeIndex - 1] : null
        const eventAfter = sortedEvents.find(e => dayjs(e.startTime).isAfter(eventEnd))

        // Check if there's enough travel time between events
        const MINIMUM_TRAVEL_TIME = 15 // minutes

        if (eventBefore && eventBefore.location && eventBefore.location !== (startTime as any).location) {
          const timeBetween = eventStart.diff(dayjs(eventBefore.endTime), 'minute')
          if (timeBetween < MINIMUM_TRAVEL_TIME) {
            detectedConflicts.push({
              type: 'travel_time',
              severity: 'warning',
              message: `Limited travel time from previous event "${eventBefore.title}"`,
              affectedEvent: eventBefore,
              suggestion: `Consider ${MINIMUM_TRAVEL_TIME - timeBetween} minutes buffer for travel`
            })
          }
        }

        if (eventAfter && eventAfter.location && eventAfter.location !== (endTime as any).location) {
          const timeBetween = dayjs(eventAfter.startTime).diff(eventEnd, 'minute')
          if (timeBetween < MINIMUM_TRAVEL_TIME) {
            detectedConflicts.push({
              type: 'travel_time',
              severity: 'warning',
              message: `Limited travel time to next event "${eventAfter.title}"`,
              affectedEvent: eventAfter,
              suggestion: `Consider ${MINIMUM_TRAVEL_TIME - timeBetween} minutes buffer for travel`
            })
          }
        }
      }

      setConflicts(detectedConflicts)
      onConflictDetected?.(detectedConflicts)
    } catch (error) {
      console.error('Error checking conflicts:', error)
    } finally {
      setIsChecking(false)
    }
  }, [startTime, endTime, attendees, allEvents, calendars, freeBusyData, travelTimeEnabled, workingHours, onConflictDetected])

  // Check conflicts when inputs change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      checkConflicts()
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [checkConflicts])

  if (!startTime || !endTime) return null

  return (
    <div className="space-y-2">
      {isChecking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          Checking for conflicts...
        </div>
      )}

      {!isChecking && conflicts.length === 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            No scheduling conflicts detected
          </AlertDescription>
        </Alert>
      )}

      {conflicts.map((conflict, index) => (
        <Alert
          key={index}
          className={
            conflict.severity === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-yellow-200 bg-yellow-50'
          }
        >
          <AlertTriangle
            className={`h-4 w-4 ${
              conflict.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
            }`}
          />
          <AlertDescription
            className={
              conflict.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
            }
          >
            <div className="space-y-1">
              <div className="font-medium">{conflict.message}</div>
              
              {conflict.affectedEvent && (
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <Clock className="h-3 w-3" />
                  {dayjs(conflict.affectedEvent.startTime).format('MMM D, HH:mm')} - {dayjs(conflict.affectedEvent.endTime).format('HH:mm')}
                  {conflict.affectedEvent.location && (
                    <>
                      <MapPin className="h-3 w-3 ml-2" />
                      {conflict.affectedEvent.location}
                    </>
                  )}
                </div>
              )}

              {conflict.affectedAttendee && (
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <Users className="h-3 w-3" />
                  {conflict.affectedAttendee}
                </div>
              )}
              
              {conflict.suggestion && (
                <div className="text-sm italic opacity-80">
                  💡 {conflict.suggestion}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}

      {conflicts.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkConflicts}
            disabled={isChecking}
          >
            Recheck Conflicts
          </Button>
          
          {conflicts.some(c => c.severity === 'error') && (
            <Button variant="outline" size="sm" className="text-orange-600">
              Find Alternative Time
            </Button>
          )}
        </div>
      )}
    </div>
  )
}