import { addDays, addWeeks, addMonths, addYears, format, isBefore, isAfter, getDay, setDate, getDate } from 'date-fns'
import type { RecurrenceRule } from '@/lib/types'

/**
 * Generate dates based on a recurrence rule
 * @param startDate - The first occurrence date
 * @param rule - The recurrence rule
 * @param maxOccurrences - Maximum number of dates to generate (safety limit)
 * @returns Array of dates (as ISO strings) for each occurrence
 */
export function generateRecurrenceDates(
  startDate: Date,
  rule: RecurrenceRule,
  maxOccurrences: number = 26 // Default to ~6 months of weekly events
): string[] {
  if (!rule || rule.type === 'none') {
    return []
  }

  const dates: string[] = []
  const interval = rule.interval || 1

  // Determine end condition
  let endDate: Date | null = null
  let maxCount = maxOccurrences

  if (rule.endType === 'date' && rule.endDate) {
    endDate = new Date(rule.endDate)
  } else if (rule.endType === 'count' && rule.endCount) {
    maxCount = Math.min(rule.endCount, maxOccurrences)
  }

  // Don't include the start date - that's the original event
  let currentDate = startDate
  let count = 0

  while (count < maxCount) {
    // Calculate next date based on recurrence type
    let nextDate: Date

    switch (rule.type) {
      case 'daily':
        nextDate = addDays(currentDate, interval)
        break

      case 'weekly':
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          // Find next occurrence on specified days
          nextDate = getNextWeeklyDate(currentDate, rule.daysOfWeek, interval, count === 0)
        } else {
          nextDate = addWeeks(currentDate, interval)
        }
        break

      case 'weekdays':
        // Monday to Friday
        nextDate = getNextWeekday(currentDate)
        break

      case 'monthly':
        if (rule.weekOfMonth && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          // Nth weekday of month (e.g., "second Tuesday")
          nextDate = getNextMonthlyWeekday(currentDate, rule.weekOfMonth, rule.daysOfWeek[0], interval)
        } else if (rule.dayOfMonth) {
          // Specific day of month
          nextDate = getNextMonthlyDate(currentDate, rule.dayOfMonth, interval)
        } else {
          nextDate = addMonths(currentDate, interval)
        }
        break

      case 'yearly':
        nextDate = addYears(currentDate, interval)
        break

      case 'custom':
        // Custom uses the same logic as weekly with multiple days
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          nextDate = getNextWeeklyDate(currentDate, rule.daysOfWeek, interval, count === 0)
        } else {
          nextDate = addWeeks(currentDate, interval)
        }
        break

      default:
        return dates
    }

    // Check end conditions
    if (endDate && isAfter(nextDate, endDate)) {
      break
    }

    dates.push(format(nextDate, 'yyyy-MM-dd'))
    currentDate = nextDate
    count++
  }

  return dates
}

/**
 * Get next date that falls on one of the specified weekdays
 */
function getNextWeeklyDate(
  fromDate: Date,
  daysOfWeek: number[],
  interval: number,
  isFirstIteration: boolean
): Date {
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b)
  const currentDay = getDay(fromDate)

  // Find next day in the same week first
  for (const day of sortedDays) {
    if (day > currentDay) {
      const daysToAdd = day - currentDay
      return addDays(fromDate, daysToAdd)
    }
  }

  // No more days this week, go to first day of next interval week
  const daysUntilNextWeek = 7 - currentDay + sortedDays[0]
  const weeksToAdd = isFirstIteration ? 1 : interval
  return addDays(fromDate, daysUntilNextWeek + (weeksToAdd - 1) * 7)
}

/**
 * Get next weekday (Monday-Friday)
 */
function getNextWeekday(fromDate: Date): Date {
  let nextDate = addDays(fromDate, 1)
  const day = getDay(nextDate)

  if (day === 0) { // Sunday -> Monday
    nextDate = addDays(nextDate, 1)
  } else if (day === 6) { // Saturday -> Monday
    nextDate = addDays(nextDate, 2)
  }

  return nextDate
}

/**
 * Get next monthly date on a specific day number
 */
function getNextMonthlyDate(fromDate: Date, dayOfMonth: number, interval: number): Date {
  let nextDate = addMonths(fromDate, interval)

  // Handle months with fewer days
  const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
  const targetDay = Math.min(dayOfMonth, maxDay)

  return setDate(nextDate, targetDay)
}

/**
 * Get next Nth weekday of the month (e.g., "second Tuesday")
 */
function getNextMonthlyWeekday(
  fromDate: Date,
  weekOfMonth: number,
  dayOfWeek: number,
  interval: number
): Date {
  let targetMonth = addMonths(fromDate, interval)

  // Find the Nth occurrence of dayOfWeek in the target month
  const year = targetMonth.getFullYear()
  const month = targetMonth.getMonth()

  if (weekOfMonth === 5) {
    // "Last" occurrence - find from end of month
    const lastDay = new Date(year, month + 1, 0)
    let date = lastDay
    while (getDay(date) !== dayOfWeek) {
      date = addDays(date, -1)
    }
    return date
  }

  // Find Nth occurrence from start
  let date = new Date(year, month, 1)
  let count = 0

  while (count < weekOfMonth) {
    if (getDay(date) === dayOfWeek) {
      count++
      if (count === weekOfMonth) {
        return date
      }
    }
    date = addDays(date, 1)
  }

  return date
}

/**
 * Get a human-readable description of the recurrence
 */
export function getRecurrenceDescription(rule: RecurrenceRule | null): string {
  if (!rule || rule.type === 'none') {
    return 'Does not repeat'
  }

  const interval = rule.interval || 1

  switch (rule.type) {
    case 'daily':
      return interval === 1 ? 'Daily' : `Every ${interval} days`
    case 'weekly':
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`
    case 'monthly':
      return interval === 1 ? 'Monthly' : `Every ${interval} months`
    case 'yearly':
      return interval === 1 ? 'Yearly' : `Every ${interval} years`
    case 'weekdays':
      return 'Every weekday'
    default:
      return 'Custom recurrence'
  }
}
