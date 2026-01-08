'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, getDay, getDate, getMonth } from 'date-fns'
import { Repeat, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { RecurrenceRule } from '@/lib/types'

interface RecurrenceSelectorProps {
  value: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
  eventDate: Date | undefined
  disabled?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
]

const WEEK_ORDINALS = [
  { value: 1, label: 'first' },
  { value: 2, label: 'second' },
  { value: 3, label: 'third' },
  { value: 4, label: 'fourth' },
  { value: 5, label: 'last' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function getWeekOfMonth(date: Date): number {
  const dayOfMonth = getDate(date)
  const weekNum = Math.ceil(dayOfMonth / 7)
  // Check if it's the last occurrence of this weekday in the month
  const nextWeek = new Date(date)
  nextWeek.setDate(dayOfMonth + 7)
  if (nextWeek.getMonth() !== date.getMonth()) {
    return 5 // Last occurrence
  }
  return weekNum
}

function getRecurrenceDescription(rule: RecurrenceRule | null, eventDate?: Date): string {
  if (!rule || rule.type === 'none') return 'Does not repeat'

  const interval = rule.interval || 1
  const intervalText = interval > 1 ? `${interval} ` : ''

  switch (rule.type) {
    case 'daily':
      return interval === 1 ? 'Daily' : `Every ${interval} days`

    case 'weekly':
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        if (rule.daysOfWeek.length === 1) {
          const dayName = DAYS_OF_WEEK[rule.daysOfWeek[0]].fullLabel
          return interval === 1
            ? `Weekly on ${dayName}`
            : `Every ${interval} weeks on ${dayName}`
        }
        const dayNames = rule.daysOfWeek.map(d => DAYS_OF_WEEK[d].label).join(', ')
        return interval === 1
          ? `Weekly on ${dayNames}`
          : `Every ${interval} weeks on ${dayNames}`
      }
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`

    case 'monthly':
      if (rule.weekOfMonth && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const ordinal = WEEK_ORDINALS.find(w => w.value === rule.weekOfMonth)?.label || ''
        const dayName = DAYS_OF_WEEK[rule.daysOfWeek[0]].fullLabel
        return interval === 1
          ? `Monthly on the ${ordinal} ${dayName}`
          : `Every ${interval} months on the ${ordinal} ${dayName}`
      }
      if (rule.dayOfMonth) {
        return interval === 1
          ? `Monthly on day ${rule.dayOfMonth}`
          : `Every ${interval} months on day ${rule.dayOfMonth}`
      }
      return interval === 1 ? 'Monthly' : `Every ${interval} months`

    case 'yearly':
      if (eventDate) {
        const monthName = MONTHS[getMonth(eventDate)]
        const day = getDate(eventDate)
        return interval === 1
          ? `Annually on ${monthName} ${day}`
          : `Every ${interval} years on ${monthName} ${day}`
      }
      return interval === 1 ? 'Annually' : `Every ${interval} years`

    case 'weekdays':
      return 'Every weekday (Monday to Friday)'

    case 'custom':
      return 'Custom recurrence'

    default:
      return 'Does not repeat'
  }
}

export function RecurrenceSelector({ value, onChange, eventDate, disabled }: RecurrenceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)

  // Custom rule state
  const [customInterval, setCustomInterval] = useState(1)
  const [customFrequency, setCustomFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly')
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<number[]>([])
  const [customMonthlyType, setCustomMonthlyType] = useState<'dayOfMonth' | 'weekOfMonth'>('dayOfMonth')
  const [customEndType, setCustomEndType] = useState<'never' | 'date' | 'count'>('never')
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined)
  const [customEndCount, setCustomEndCount] = useState(10)

  // Get contextual options based on the selected date
  const contextualOptions = useMemo(() => {
    if (!eventDate) return []

    const dayOfWeek = getDay(eventDate)
    const dayName = DAYS_OF_WEEK[dayOfWeek].fullLabel
    const dayOfMonth = getDate(eventDate)
    const weekOfMonth = getWeekOfMonth(eventDate)
    const ordinal = WEEK_ORDINALS.find(w => w.value === weekOfMonth)?.label || 'first'
    const monthName = MONTHS[getMonth(eventDate)]

    return [
      {
        id: 'none',
        label: 'Does not repeat',
        rule: null,
      },
      {
        id: 'weekly',
        label: `Weekly on ${dayName}`,
        rule: { type: 'weekly', interval: 1, daysOfWeek: [dayOfWeek], endType: 'never' } as RecurrenceRule,
      },
      {
        id: 'monthly-week',
        label: `Monthly on the ${ordinal} ${dayName}`,
        rule: {
          type: 'monthly',
          interval: 1,
          weekOfMonth,
          daysOfWeek: [dayOfWeek],
          endType: 'never'
        } as RecurrenceRule,
      },
      {
        id: 'monthly-day',
        label: `Monthly on day ${dayOfMonth}`,
        rule: {
          type: 'monthly',
          interval: 1,
          dayOfMonth,
          endType: 'never'
        } as RecurrenceRule,
      },
      {
        id: 'yearly',
        label: `Annually on ${monthName} ${dayOfMonth}`,
        rule: {
          type: 'yearly',
          interval: 1,
          monthOfYear: getMonth(eventDate) + 1,
          dayOfMonth,
          endType: 'never'
        } as RecurrenceRule,
      },
      {
        id: 'custom',
        label: 'Custom...',
        rule: null,
      },
    ]
  }, [eventDate])

  // Initialize custom modal with current values
  const openCustomModal = () => {
    if (value && value.type !== 'none') {
      setCustomInterval(value.interval || 1)
      if (value.type === 'daily' || value.type === 'weekly' || value.type === 'monthly' || value.type === 'yearly') {
        setCustomFrequency(value.type)
      } else {
        setCustomFrequency('weekly')
      }
      setCustomDaysOfWeek(value.daysOfWeek || (eventDate ? [getDay(eventDate)] : []))
      setCustomMonthlyType(value.weekOfMonth ? 'weekOfMonth' : 'dayOfMonth')
      setCustomEndType(value.endType || 'never')
      setCustomEndDate(value.endDate ? new Date(value.endDate) : undefined)
      setCustomEndCount(value.endCount || 10)
    } else if (eventDate) {
      setCustomInterval(1)
      setCustomFrequency('weekly')
      setCustomDaysOfWeek([getDay(eventDate)])
      setCustomMonthlyType('dayOfMonth')
      setCustomEndType('never')
      setCustomEndDate(undefined)
      setCustomEndCount(10)
    }
    setCustomModalOpen(true)
  }

  const handleOptionSelect = (optionId: string) => {
    if (optionId === 'custom') {
      openCustomModal()
    } else {
      const option = contextualOptions.find(o => o.id === optionId)
      if (option) {
        onChange(option.rule)
      }
    }
    setIsOpen(false)
  }

  const handleCustomSave = () => {
    let rule: RecurrenceRule

    if (customFrequency === 'daily') {
      rule = {
        type: 'daily',
        interval: customInterval,
        endType: customEndType,
        endDate: customEndType === 'date' && customEndDate
          ? format(customEndDate, 'yyyy-MM-dd')
          : undefined,
        endCount: customEndType === 'count' ? customEndCount : undefined,
      }
    } else if (customFrequency === 'weekly') {
      rule = {
        type: customDaysOfWeek.length === 5 &&
              customDaysOfWeek.includes(1) &&
              customDaysOfWeek.includes(2) &&
              customDaysOfWeek.includes(3) &&
              customDaysOfWeek.includes(4) &&
              customDaysOfWeek.includes(5) &&
              customInterval === 1
          ? 'weekdays'
          : 'weekly',
        interval: customInterval,
        daysOfWeek: customDaysOfWeek,
        endType: customEndType,
        endDate: customEndType === 'date' && customEndDate
          ? format(customEndDate, 'yyyy-MM-dd')
          : undefined,
        endCount: customEndType === 'count' ? customEndCount : undefined,
      }
    } else if (customFrequency === 'monthly') {
      if (customMonthlyType === 'weekOfMonth' && eventDate) {
        rule = {
          type: 'monthly',
          interval: customInterval,
          weekOfMonth: getWeekOfMonth(eventDate),
          daysOfWeek: [getDay(eventDate)],
          endType: customEndType,
          endDate: customEndType === 'date' && customEndDate
            ? format(customEndDate, 'yyyy-MM-dd')
            : undefined,
          endCount: customEndType === 'count' ? customEndCount : undefined,
        }
      } else {
        rule = {
          type: 'monthly',
          interval: customInterval,
          dayOfMonth: eventDate ? getDate(eventDate) : 1,
          endType: customEndType,
          endDate: customEndType === 'date' && customEndDate
            ? format(customEndDate, 'yyyy-MM-dd')
            : undefined,
          endCount: customEndType === 'count' ? customEndCount : undefined,
        }
      }
    } else {
      rule = {
        type: 'yearly',
        interval: customInterval,
        monthOfYear: eventDate ? getMonth(eventDate) + 1 : 1,
        dayOfMonth: eventDate ? getDate(eventDate) : 1,
        endType: customEndType,
        endDate: customEndType === 'date' && customEndDate
          ? format(customEndDate, 'yyyy-MM-dd')
          : undefined,
        endCount: customEndType === 'count' ? customEndCount : undefined,
      }
    }

    onChange(rule)
    setCustomModalOpen(false)
  }

  const toggleDayOfWeek = (day: number) => {
    setCustomDaysOfWeek(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    )
  }

  const description = getRecurrenceDescription(value, eventDate)

  return (
    <>
      <div className="space-y-2">
        <Label>Repeat</Label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
              disabled={disabled || !eventDate}
            >
              <span className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                {description}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <div className="flex flex-col">
              {contextualOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleOptionSelect(option.id)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm hover:bg-accent transition-colors",
                    option.id === 'none' && "border-b",
                    option.id === 'custom' && "border-t font-medium"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {!eventDate && (
          <p className="text-xs text-muted-foreground">Select an event date first</p>
        )}
        {value && value.endType !== 'never' && (
          <p className="text-xs text-muted-foreground">
            {value.endType === 'date' && value.endDate
              ? `Ends on ${format(new Date(value.endDate), 'MMM d, yyyy')}`
              : value.endType === 'count' && value.endCount
              ? `Ends after ${value.endCount} occurrences`
              : ''}
          </p>
        )}
      </div>

      {/* Custom Recurrence Dialog */}
      <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Custom recurrence</DialogTitle>
            <DialogDescription>
              Set up a custom repeat pattern for this event
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Repeat every */}
            <div className="space-y-2">
              <Label>Repeat every</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={customInterval}
                  onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20"
                />
                <Select value={customFrequency} onValueChange={(v: 'daily' | 'weekly' | 'monthly' | 'yearly') => setCustomFrequency(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{customInterval === 1 ? 'day' : 'days'}</SelectItem>
                    <SelectItem value="weekly">{customInterval === 1 ? 'week' : 'weeks'}</SelectItem>
                    <SelectItem value="monthly">{customInterval === 1 ? 'month' : 'months'}</SelectItem>
                    <SelectItem value="yearly">{customInterval === 1 ? 'year' : 'years'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Days of week (for weekly) */}
            {customFrequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Repeat on</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDayOfWeek(day.value)}
                      className={cn(
                        "w-10 h-10 rounded-full text-sm font-medium transition-colors",
                        customDaysOfWeek.includes(day.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly options */}
            {customFrequency === 'monthly' && eventDate && (
              <div className="space-y-2">
                <Label>Repeat on</Label>
                <RadioGroup value={customMonthlyType} onValueChange={(v: 'dayOfMonth' | 'weekOfMonth') => setCustomMonthlyType(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dayOfMonth" id="dayOfMonth" />
                    <Label htmlFor="dayOfMonth" className="font-normal cursor-pointer">
                      Day {getDate(eventDate)} of the month
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weekOfMonth" id="weekOfMonth" />
                    <Label htmlFor="weekOfMonth" className="font-normal cursor-pointer">
                      The {WEEK_ORDINALS.find(w => w.value === getWeekOfMonth(eventDate))?.label} {DAYS_OF_WEEK[getDay(eventDate)].fullLabel}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* End options */}
            <div className="space-y-3">
              <Label>Ends</Label>
              <RadioGroup value={customEndType} onValueChange={(v: 'never' | 'date' | 'count') => setCustomEndType(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="never" id="never" />
                  <Label htmlFor="never" className="font-normal cursor-pointer">Never</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="date" id="date" />
                  <Label htmlFor="date" className="font-normal cursor-pointer">On</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={customEndType !== 'date'}
                        className={cn(
                          "ml-2",
                          customEndType !== 'date' && "opacity-50"
                        )}
                      >
                        {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        disabled={(date) => eventDate ? date < eventDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="count" id="count" />
                  <Label htmlFor="count" className="font-normal cursor-pointer">After</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={customEndCount}
                    onChange={(e) => setCustomEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={customEndType !== 'count'}
                    className={cn(
                      "w-20 ml-2",
                      customEndType !== 'count' && "opacity-50"
                    )}
                  />
                  <span className={cn(
                    "text-sm",
                    customEndType !== 'count' && "opacity-50"
                  )}>
                    occurrences
                  </span>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomSave}
              disabled={customFrequency === 'weekly' && customDaysOfWeek.length === 0}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
