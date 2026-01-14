'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COMMON_TIMEZONES } from '@/lib/utils/timezone'

interface TimezoneSelectorProps {
  value: string
  onChange: (timezone: string) => void
  disabled?: boolean
  label?: string
  description?: string
}

export function TimezoneSelector({
  value,
  onChange,
  disabled = false,
  label = 'Default Timezone',
  description,
}: TimezoneSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">{label}</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger id="timezone" className="w-full">
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          {COMMON_TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              <span className="flex items-center gap-2">
                <span>{tz.label}</span>
                <span className="text-muted-foreground text-xs">({tz.offset})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
