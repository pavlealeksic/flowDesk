import React, { useState, useCallback, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label,
  Button,
  Card,
  Badge,
  Switch,
  RadioGroup,
  RadioGroupItem
} from '../ui'
import { Calendar, Repeat, X, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import type { RecurrenceRule, RecurrenceFrequency, WeekDay } from '@flow-desk/shared'

interface RecurrenceEditorProps {
  recurrence?: RecurrenceRule
  onChange: (recurrence?: RecurrenceRule) => void
  startTime?: Date
}

const FREQUENCIES: RecurrenceFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

const WEEKDAYS: { value: WeekDay; label: string }[] = [
  { value: 'SU', label: 'Sun' },
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' }
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({
  recurrence,
  onChange,
  startTime
}) => {
  const [isEnabled, setIsEnabled] = useState(!!recurrence)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(recurrence?.frequency || 'WEEKLY')
  const [interval, setInterval] = useState(recurrence?.interval || 1)
  const [endType, setEndType] = useState<'never' | 'count' | 'until'>(
    recurrence?.count ? 'count' : recurrence?.until ? 'until' : 'never'
  )
  const [count, setCount] = useState(recurrence?.count || 10)
  const [until, setUntil] = useState(
    recurrence?.until ? dayjs(recurrence.until).format('YYYY-MM-DD') : 
    dayjs().add(1, 'year').format('YYYY-MM-DD')
  )
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>(
    recurrence?.byWeekDay || (startTime ? [getDayOfWeek(startTime)] : ['MO'])
  )
  const [monthDay, setMonthDay] = useState(
    recurrence?.byMonthDay?.[0] || (startTime ? dayjs(startTime).date() : 1)
  )
  const [monthlyType, setMonthlyType] = useState<'date' | 'day'>('date')
  const [yearMonth, setYearMonth] = useState(
    recurrence?.byMonth?.[0] || (startTime ? dayjs(startTime).month() + 1 : 1)
  )

  // Get day of week from date
  function getDayOfWeek(date: Date): WeekDay {
    const day = dayjs(date).day()
    return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day] as WeekDay
  }

  // Build RRULE string
  const buildRRule = useCallback(() => {
    if (!isEnabled) return undefined

    const parts = [`FREQ=${frequency}`, `INTERVAL=${interval}`]

    // Add frequency-specific rules
    if (frequency === 'WEEKLY' && selectedWeekDays.length > 0) {
      parts.push(`BYDAY=${selectedWeekDays.join(',')}`)
    }

    if (frequency === 'MONTHLY') {
      if (monthlyType === 'date') {
        parts.push(`BYMONTHDAY=${monthDay}`)
      } else if (startTime) {
        // By day (e.g., "second Tuesday")
        const date = dayjs(startTime)
        const weekOfMonth = Math.ceil(date.date() / 7)
        const dayOfWeek = getDayOfWeek(startTime)
        parts.push(`BYDAY=${weekOfMonth}${dayOfWeek}`)
      }
    }

    if (frequency === 'YEARLY') {
      parts.push(`BYMONTH=${yearMonth}`)
      if (startTime) {
        parts.push(`BYMONTHDAY=${dayjs(startTime).date()}`)
      }
    }

    // Add end condition
    if (endType === 'count') {
      parts.push(`COUNT=${count}`)
    } else if (endType === 'until') {
      parts.push(`UNTIL=${dayjs(until).format('YYYYMMDD')}T235959Z`)
    }

    const rrule = parts.join(';')

    const recurrenceRule: RecurrenceRule = {
      frequency,
      interval,
      rrule,
      ...(selectedWeekDays.length > 0 && frequency === 'WEEKLY' && { byWeekDay: selectedWeekDays }),
      ...(frequency === 'MONTHLY' && monthlyType === 'date' && { byMonthDay: [monthDay] }),
      ...(frequency === 'YEARLY' && { byMonth: [yearMonth] }),
      ...(endType === 'count' && { count }),
      ...(endType === 'until' && { until: dayjs(until).toDate() }),
      weekStart: 'MO'
    }

    return recurrenceRule
  }, [
    isEnabled, frequency, interval, selectedWeekDays, monthDay, monthlyType, 
    yearMonth, endType, count, until, startTime
  ])

  // Update recurrence when form changes
  useEffect(() => {
    const newRecurrence = buildRRule()
    onChange(newRecurrence)
  }, [buildRRule, onChange])

  // Toggle weekday selection
  const toggleWeekDay = useCallback((day: WeekDay) => {
    setSelectedWeekDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day)
      } else {
        return [...prev, day].sort((a, b) => {
          const order = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
          return order.indexOf(a) - order.indexOf(b)
        })
      }
    })
  }, [])

  // Generate preview text
  const getPreviewText = useCallback(() => {
    if (!isEnabled) return 'Does not repeat'

    const intervalText = interval === 1 ? '' : `every ${interval} `
    
    let baseText = ''
    switch (frequency) {
      case 'DAILY':
        baseText = `${intervalText}day${interval === 1 ? '' : 's'}`
        break
      case 'WEEKLY':
        if (selectedWeekDays.length === 7) {
          baseText = `${intervalText}day${interval === 1 ? '' : 's'}`
        } else if (selectedWeekDays.length === 0) {
          baseText = `${intervalText}week${interval === 1 ? '' : 's'}`
        } else {
          const dayNames = selectedWeekDays.map(day => 
            WEEKDAYS.find(wd => wd.value === day)?.label || day
          )
          baseText = `${intervalText}week${interval === 1 ? '' : 's'} on ${dayNames.join(', ')}`
        }
        break
      case 'MONTHLY':
        if (monthlyType === 'date') {
          baseText = `${intervalText}month${interval === 1 ? '' : 's'} on day ${monthDay}`
        } else {
          baseText = `${intervalText}month${interval === 1 ? '' : 's'} on the same weekday`
        }
        break
      case 'YEARLY':
        baseText = `${intervalText}year${interval === 1 ? '' : 's'} in ${MONTHS[yearMonth - 1]}`
        break
    }

    let endText = ''
    if (endType === 'count') {
      endText = `, ${count} times`
    } else if (endType === 'until') {
      endText = `, until ${dayjs(until).format('MMM D, YYYY')}`
    }

    return `Every ${baseText}${endText}`
  }, [isEnabled, frequency, interval, selectedWeekDays, monthDay, monthlyType, yearMonth, endType, count, until])

  if (!isEnabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Event Recurrence</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEnabled(true)}
          >
            <Repeat className="h-4 w-4 mr-1" />
            Add Recurrence
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">This event does not repeat</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Event Recurrence</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEnabled(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {getPreviewText()}
          </span>
        </div>
      </Card>

      <div className="space-y-4">
        {/* Frequency and Interval */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={(value: string) => setFrequency(value as RecurrenceFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="interval">Every</Label>
            <div className="flex items-center gap-2">
              <Input
                id="interval"
                type="number"
                min="1"
                max="999"
                value={interval.toString()}
                onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                {frequency.toLowerCase().slice(0, -2)}{interval === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {/* Frequency-specific options */}
        {frequency === 'WEEKLY' && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Repeat on</Label>
            <div className="flex gap-1">
              {WEEKDAYS.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={selectedWeekDays.includes(value) ? 'primary' : 'outline'}
                  size="sm"
                  className="w-12 h-8 text-xs"
                  onClick={() => toggleWeekDay(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {frequency === 'MONTHLY' && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Monthly recurrence</Label>
            <RadioGroup
              value={monthlyType}
              onValueChange={(value: string) => setMonthlyType(value as 'date' | 'day')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="monthly-date" />
                <Label htmlFor="monthly-date" className="flex items-center gap-2">
                  On day
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={monthDay.toString()}
                    onChange={(e) => setMonthDay(parseInt(e.target.value) || 1)}
                    className="w-16 h-8"
                  />
                  of the month
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="day" id="monthly-day" />
                <Label htmlFor="monthly-day">
                  On the same day of the week
                  {startTime && (
                    <span className="text-muted-foreground ml-1">
                      ({dayjs(startTime).format('dddd')})
                    </span>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {frequency === 'YEARLY' && (
          <div>
            <Label htmlFor="yearMonth">Repeat in</Label>
            <Select value={yearMonth.toString()} onValueChange={(value) => setYearMonth(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, index) => (
                  <SelectItem key={index} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* End condition */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Ends</Label>
          <RadioGroup
            value={endType}
            onValueChange={(value: string) => setEndType(value as 'never' | 'count' | 'until')}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="never" id="end-never" />
              <Label htmlFor="end-never">Never</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="count" id="end-count" />
              <Label htmlFor="end-count" className="flex items-center gap-2">
                After
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={count.toString()}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  disabled={endType !== 'count'}
                  className="w-16 h-8"
                />
                occurrences
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="until" id="end-until" />
              <Label htmlFor="end-until" className="flex items-center gap-2">
                On
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  disabled={endType !== 'until'}
                  className="w-36 h-8"
                />
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  )
}