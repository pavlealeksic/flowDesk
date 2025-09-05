import React, { useState, useCallback } from 'react'
import {
  Button,
  Card,
  Input,
  cn,
  Calendar,
  Clock,
  Send,
  X,
  ChevronDown
} from '../ui'

interface ScheduledEmail {
  id: string
  subject: string
  to: string[]
  scheduledTime: Date
  status: 'pending' | 'sent' | 'failed'
  body: string
  attachments?: any[]
}

interface EmailSchedulerProps {
  isOpen: boolean
  onClose: () => void
  onSchedule: (email: any, scheduledTime: Date) => void
  initialEmail?: {
    to: string
    subject: string
    body: string
  }
  className?: string
}

const QUICK_SCHEDULE_OPTIONS = [
  { label: 'In 1 hour', getTime: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: 'Tomorrow 9 AM', getTime: () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow
  }},
  { label: 'Monday 9 AM', getTime: () => {
    const monday = new Date()
    const daysUntilMonday = (8 - monday.getDay()) % 7 || 7
    monday.setDate(monday.getDate() + daysUntilMonday)
    monday.setHours(9, 0, 0, 0)
    return monday
  }},
  { label: 'Next week', getTime: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
]

export const EmailScheduler: React.FC<EmailSchedulerProps> = ({
  isOpen,
  onClose,
  onSchedule,
  initialEmail,
  className
}) => {
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [useCustomDateTime, setUseCustomDateTime] = useState(false)

  const handleQuickSchedule = useCallback((getTime: () => Date) => {
    const time = getTime()
    setScheduledTime(time)
  }, [])

  const handleCustomDateTime = useCallback(() => {
    if (customDate && customTime) {
      const dateTime = new Date(`${customDate}T${customTime}`)
      if (dateTime > new Date()) {
        setScheduledTime(dateTime)
      }
    }
  }, [customDate, customTime])

  const handleScheduleEmail = useCallback(() => {
    if (scheduledTime && initialEmail) {
      onSchedule(initialEmail, scheduledTime)
      onClose()
    }
  }, [scheduledTime, initialEmail, onSchedule, onClose])

  const formatScheduledTime = (time: Date) => {
    const now = new Date()
    const diffInMs = time.getTime() - now.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return `Today at ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffInDays === 1) {
      return `Tomorrow at ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return time.toLocaleString([], { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className={cn('w-full max-w-md bg-card border-border', className)}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Schedule Email
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {initialEmail && (
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              <div className="font-medium mb-1">To: {initialEmail.to}</div>
              <div className="text-muted-foreground truncate">
                Subject: {initialEmail.subject || '(No subject)'}
              </div>
            </div>
          )}

          {/* Quick Schedule Options */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Quick Schedule</h3>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_SCHEDULE_OPTIONS.map((option, index) => {
                const time = option.getTime()
                const isSelected = scheduledTime?.getTime() === time.getTime()
                
                return (
                  <Button
                    key={index}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handleQuickSchedule(option.getTime)}
                    className="h-auto p-3 text-left"
                  >
                    <div>
                      <div className="font-medium text-xs">{option.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatScheduledTime(time)}
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Custom Date/Time */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUseCustomDateTime(!useCustomDateTime)}
              className="w-full justify-start"
            >
              <Clock className="h-4 w-4 mr-2" />
              Custom Date & Time
              <ChevronDown className={cn(
                "h-4 w-4 ml-auto transition-transform",
                useCustomDateTime && "rotate-180"
              )} />
            </Button>
            
            {useCustomDateTime && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Date</label>
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(value) => setCustomDate(value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Time</label>
                    <Input
                      type="time"
                      value={customTime}
                      onChange={(value) => setCustomTime(value)}
                    />
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCustomDateTime}
                  disabled={!customDate || !customTime}
                  className="w-full"
                >
                  Set Custom Time
                </Button>
              </div>
            )}
          </div>

          {/* Selected Time Preview */}
          {scheduledTime && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Send className="h-4 w-4 text-primary" />
                <span className="font-medium">Will send:</span>
                <span className="text-primary">{formatScheduledTime(scheduledTime)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleEmail}
              disabled={!scheduledTime || !initialEmail}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Email
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default EmailScheduler