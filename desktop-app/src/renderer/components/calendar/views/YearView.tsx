import React, { useState, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { cn } from '../../ui'
import type { CalendarEvent } from '@flow-desk/shared'

interface YearViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDateClick: (date: Date) => void
  getCalendarForEvent: (event: CalendarEvent) => any
}

const YearView: React.FC<YearViewProps> = ({
  date,
  events,
  onEventClick,
  onDateClick,
  getCalendarForEvent
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null)
  
  const year = date.getFullYear()
  
  // Generate all months for the year
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = new Date(year, monthIndex, 1)
      const monthEnd = new Date(year, monthIndex + 1, 0)
      const firstDayOfWeek = monthStart.getDay()
      
      // Get all days for the month including padding days
      const days = []
      
      // Add padding days from previous month
      for (let i = 0; i < firstDayOfWeek; i++) {
        const paddingDate = new Date(year, monthIndex, -firstDayOfWeek + i + 1)
        days.push({ date: paddingDate, isCurrentMonth: false })
      }
      
      // Add days of current month
      for (let day = 1; day <= monthEnd.getDate(); day++) {
        const currentDate = new Date(year, monthIndex, day)
        days.push({ date: currentDate, isCurrentMonth: true })
      }
      
      // Add padding days from next month
      const remainingCells = 42 - days.length // 6 rows × 7 days
      for (let i = 1; i <= remainingCells; i++) {
        const paddingDate = new Date(year, monthIndex + 1, i)
        days.push({ date: paddingDate, isCurrentMonth: false })
      }
      
      return {
        monthIndex,
        name: monthStart.toLocaleString('default', { month: 'long' }),
        days: days.slice(0, 42) // Ensure exactly 42 days (6 weeks)
      }
    })
  }, [year])
  
  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    return events.filter(event => 
      dayjs(event.startTime).isSame(dayjs(date), 'day')
    )
  }, [events])
  
  // Check if date is today
  const isToday = useCallback((date: Date) => {
    const today = new Date()
    return dayjs(date).isSame(dayjs(today), 'day')
  }, [])
  
  // Handle month click
  const handleMonthClick = useCallback((monthIndex: number) => {
    const newDate = new Date(year, monthIndex, 1)
    onDateClick(newDate)
  }, [year, onDateClick])

  return (
    <div className="h-full w-full overflow-auto bg-background">
      {/* Year header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <h1 className="text-2xl font-bold text-center">{year}</h1>
      </div>
      
      {/* Months grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {months.map(({ monthIndex, name, days }) => (
          <div
            key={monthIndex}
            className={cn(
              "bg-card rounded-lg border border-border hover:shadow-md transition-all duration-200 cursor-pointer",
              hoveredMonth === monthIndex && "shadow-lg border-primary/50"
            )}
            onMouseEnter={() => setHoveredMonth(monthIndex)}
            onMouseLeave={() => setHoveredMonth(null)}
            onClick={() => handleMonthClick(monthIndex)}
          >
            {/* Month header */}
            <div className="p-3 border-b border-border bg-muted/30 rounded-t-lg">
              <h3 className="font-semibold text-center text-sm">{name}</h3>
            </div>
            
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 px-2 py-1 text-xs text-muted-foreground">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <div key={index} className="text-center font-medium">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 p-2">
              {days.map(({ date, isCurrentMonth }, dayIndex) => {
                const dayEvents = getEventsForDate(date)
                const hasEvents = dayEvents.length > 0
                const isTodayDate = isToday(date)
                
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      "relative aspect-square flex flex-col items-center justify-center text-xs rounded hover:bg-accent/50 transition-colors",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isTodayDate && "bg-primary text-primary-foreground font-bold",
                      hasEvents && "bg-accent/20"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDateClick(date)
                    }}
                  >
                    {/* Day number */}
                    <span className="leading-none">
                      {date.getDate()}
                    </span>
                    
                    {/* Event indicators */}
                    {hasEvents && (
                      <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 flex space-x-0.5">
                        {dayEvents.slice(0, 3).map((event, eventIndex) => {
                          const calendar = getCalendarForEvent(event)
                          return (
                            <div
                              key={eventIndex}
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: calendar?.color || '#3b82f6' }}
                              title={event.title}
                            />
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div
                            className="w-1 h-1 rounded-full bg-muted-foreground"
                            title={`+${dayEvents.length - 3} more events`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default YearView