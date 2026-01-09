import { subDays, startOfMonth, startOfYear } from 'date-fns'

export type DateRangePreset =
  | 'all-time'
  | 'current-month'
  | 'last-30-days'
  | 'last-90-days'
  | 'last-6-months'
  | 'ytd'
  | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

export const presetLabels: Record<DateRangePreset, string> = {
  'all-time': 'All Time',
  'current-month': 'Current Month',
  'last-30-days': 'Last 30 Days',
  'last-90-days': 'Last 90 Days',
  'last-6-months': 'Last 6 Months',
  'ytd': 'Year to Date',
  'custom': 'Custom Range',
}

export function getPresetDateRange(preset: DateRangePreset): DateRange {
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of today

  switch (preset) {
    case 'all-time':
      return {
        from: new Date(2000, 0, 1),
        to: today,
      }
    case 'current-month':
      return {
        from: startOfMonth(today),
        to: today,
      }
    case 'last-30-days':
      return {
        from: subDays(today, 30),
        to: today,
      }
    case 'last-90-days':
      return {
        from: subDays(today, 90),
        to: today,
      }
    case 'last-6-months':
      return {
        from: subDays(today, 180),
        to: today,
      }
    case 'ytd':
      return {
        from: startOfYear(today),
        to: today,
      }
    default:
      return {
        from: subDays(today, 30),
        to: today,
      }
  }
}

export function parseDateRangeParams(searchParams: {
  preset?: string
  from?: string
  to?: string
}): DateRange {
  const preset = (searchParams.preset as DateRangePreset) || 'last-30-days'

  if (preset === 'custom' && searchParams.from && searchParams.to) {
    return {
      from: new Date(searchParams.from),
      to: new Date(searchParams.to),
    }
  }

  return getPresetDateRange(preset)
}
