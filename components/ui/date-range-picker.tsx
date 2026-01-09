'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DateRangePreset,
  presetLabels,
  getPresetDateRange,
} from '@/lib/utils/date-range'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined, preset: DateRangePreset) => void
  preset: DateRangePreset
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  preset,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(value)

  // Sync tempRange when popover opens
  React.useEffect(() => {
    if (open) {
      setTempRange(value)
    }
  }, [open, value])

  const handlePresetClick = (newPreset: DateRangePreset) => {
    if (newPreset === 'custom') {
      // Don't close, let user select dates
      return
    }
    const range = getPresetDateRange(newPreset)
    onChange(range, newPreset)
    setOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempRange(range)
  }

  const handleApplyCustomRange = () => {
    if (tempRange?.from && tempRange?.to) {
      onChange(tempRange, 'custom')
      setOpen(false)
    }
  }

  const displayValue = React.useMemo(() => {
    if (preset !== 'custom') {
      return presetLabels[preset]
    }
    if (value?.from && value?.to) {
      return `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`
    }
    if (value?.from) {
      return `${format(value.from, 'MMM d, yyyy')} - ...`
    }
    return 'Select dates'
  }, [value, preset])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="border-r p-2 space-y-1 w-[150px]">
            {(Object.keys(presetLabels) as DateRangePreset[]).map((key) => (
              <Button
                key={key}
                variant={preset === key ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handlePresetClick(key)}
              >
                {presetLabels[key]}
              </Button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              defaultMonth={value?.from}
              selected={tempRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
            {tempRange?.from && tempRange?.to && (
              <div className="border-t p-2 flex justify-end">
                <Button size="sm" onClick={handleApplyCustomRange}>
                  Apply
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
