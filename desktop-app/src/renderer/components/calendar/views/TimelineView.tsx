import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dayjs from 'dayjs'
import { cn } from '../../ui'
import { Button } from '../../ui'
import { ChevronLeft, ChevronRight, Clock, MapPin, Users, Video } from 'lucide-react'
import type { CalendarEvent } from '@flow-desk/shared'

interface TimelineViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  getCalendarForEvent: (event: CalendarEvent) => any
}

const TimelineView: React.FC<TimelineViewProps> = ({
  date,
  events,
  onEventClick,
  getCalendarForEvent
}) => {
  const [selectedDate, setSelectedDate] = useState(dayjs(date))
  const [viewRange, setViewRange] = useState<'day' | 'week' | 'month'>('week')
  const [zoomLevel, setZoomLevel] = useState(2) // 1=compact, 2=normal, 3=expanded
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Get date range based on view
  const dateRange = useMemo(() => {
    let start: dayjs.Dayjs
    let end: dayjs.Dayjs
    
    switch (viewRange) {
      case 'day':
        start = selectedDate.startOf('day')
        end = selectedDate.endOf('day')
        break
      case 'week':
        start = selectedDate.startOf('week')
        end = selectedDate.endOf('week')
        break
      case 'month':
        start = selectedDate.startOf('month').startOf('week')
        end = selectedDate.endOf('month').endOf('week')
        break
    }
    
    return { start, end }
  }, [selectedDate, viewRange])
  
  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {}
    
    events
      .filter(event => {
        const eventDate = dayjs(event.startTime)
        return eventDate.isAfter(dateRange.start) && eventDate.isBefore(dateRange.end.add(1, 'day'))
      })
      .forEach(event => {
        const dateKey = dayjs(event.startTime).format('YYYY-MM-DD')
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(event)
      })
    
    // Sort events within each date
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => 
        dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
      )
    })
    
    return grouped
  }, [events, dateRange])
  
  // Generate timeline days
  const timelineDays = useMemo(() => {
    const days = []
    let currentDate = dateRange.start
    
    while (currentDate.isBefore(dateRange.end) || currentDate.isSame(dateRange.end, 'day')) {
      days.push(currentDate)
      currentDate = currentDate.add(1, 'day')
    }
    
    return days
  }, [dateRange])
  
  // Navigate timeline
  const navigate = useCallback((direction: 'prev' | 'next') => {
    const unit = viewRange === 'day' ? 'day' : viewRange === 'week' ? 'week' : 'month'
    setSelectedDate(prev => 
      direction === 'next' ? prev.add(1, unit) : prev.subtract(1, unit)
    )
  }, [viewRange])
  
  // Scroll to current time on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = dayjs()
      const hourHeight = zoomLevel * 60 // pixels per hour
      const currentHour = now.hour()
      const scrollTop = currentHour * hourHeight
      
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollTop - 200, // Center current time
          behavior: 'smooth'
        })
      }, 100)
    }
  }, [zoomLevel])
  
  const formatEventTime = (startTime: Date, endTime: Date) => {
    const start = dayjs(startTime)
    const end = dayjs(endTime)
    
    if (start.isSame(end, 'day')) {
      return `${start.format('HH:mm')} - ${end.format('HH:mm')}`
    } else {
      return `${start.format('MMM D, HH:mm')} - ${end.format('MMM D, HH:mm')}`
    }
  }
  
  const getEventDuration = (startTime: Date, endTime: Date) => {
    const duration = dayjs(endTime).diff(dayjs(startTime), 'minute')
    if (duration < 60) {
      return `${duration}m`
    } else {
      const hours = Math.floor(duration / 60)
      const minutes = duration % 60
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Timeline Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Date Range */}
          <div className="text-lg font-semibold">
            {viewRange === 'day' 
              ? selectedDate.format('dddd, MMMM D, YYYY')
              : viewRange === 'week'
              ? `${dateRange.start.format('MMM D')} - ${dateRange.end.format('MMM D, YYYY')}`
              : selectedDate.format('MMMM YYYY')
            }
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Range Selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['day', 'week', 'month'] as const).map((range) => (
              <Button
                key={range}
                variant={viewRange === range ? 'primary' : 'ghost'}
                size="sm"
                className="rounded-none border-0"
                onClick={() => setViewRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
              disabled={zoomLevel <= 1}
            >
              -
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {zoomLevel === 1 ? 'Compact' : zoomLevel === 2 ? 'Normal' : 'Expanded'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(Math.min(3, zoomLevel + 1))}
              disabled={zoomLevel >= 3}
            >
              +
            </Button>
          </div>
        </div>
      </div>
      
      {/* Timeline Content */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-auto"
          style={{ scrollBehavior: 'smooth' }}
        >
          {timelineDays.map((day, dayIndex) => {
            const dateKey = day.format('YYYY-MM-DD')
            const dayEvents = eventsByDate[dateKey] || []
            const isToday = day.isSame(dayjs(), 'day')
            const isWeekend = day.day() === 0 || day.day() === 6
            
            return (
              <div
                key={dateKey}
                className={cn(
                  "border-b border-border last:border-b-0",
                  isToday && "bg-primary/5",
                  isWeekend && "bg-muted/20"
                )}
              >
                {/* Date Header */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 border-b border-border">
                  <div className="flex-shrink-0">
                    <div className={cn(
                      "text-sm font-medium",
                      isToday && "text-primary font-bold"
                    )}>
                      {day.format('dddd')}
                    </div>
                    <div className={cn(
                      "text-2xl font-bold",
                      isToday && "text-primary"
                    )}>
                      {day.format('D')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {day.format('MMM')}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    {dayEvents.length === 0 ? (
                      <div className="text-muted-foreground text-sm italic">
                        No events scheduled
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Events List */}
                {dayEvents.length > 0 && (
                  <div className="space-y-2 p-4">
                    {dayEvents.map((event, eventIndex) => {
                      const calendar = getCalendarForEvent(event)
                      const startTime = dayjs(event.startTime)
                      const endTime = dayjs(event.endTime)
                      
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "group flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                            zoomLevel === 1 && "p-2",
                            zoomLevel === 3 && "p-6"
                          )}
                          style={{
                            borderLeftColor: calendar?.color,
                            borderLeftWidth: '4px',
                            backgroundColor: `${calendar?.color}10`
                          }}
                          onClick={() => onEventClick(event)}
                        >
                          {/* Time Indicator */}
                          <div className="flex-shrink-0 text-center">
                            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {startTime.format('HH:mm')}
                            </div>
                            {zoomLevel >= 2 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {getEventDuration(event.startTime, event.endTime)}
                              </div>
                            )}
                          </div>
                          
                          {/* Event Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={cn(
                                "font-medium group-hover:text-primary transition-colors truncate",
                                zoomLevel === 1 && "text-sm",
                                zoomLevel === 3 && "text-lg"
                              )}>
                                {event.title}
                              </h4>
                              
                              {/* Event Status Indicators */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {event.conferencing && (
                                  <Video className="h-3 w-3 text-blue-500" />
                                )}
                                {event.attendees.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {event.attendees.length}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Event Details */}
                            {zoomLevel >= 2 && (
                              <div className="mt-2 space-y-1">
                                {event.location && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                                
                                {event.description && zoomLevel >= 3 && (
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>{formatEventTime(event.startTime, event.endTime)}</span>
                                  {calendar && (
                                    <span
                                      className="px-2 py-1 rounded-full text-xs"
                                      style={{
                                        backgroundColor: `${calendar.color}20`,
                                        color: calendar.color
                                      }}
                                    >
                                      {calendar.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default TimelineView