/**
 * Timezone utilities for fetching and formatting timezones
 */

// Common timezones for the dropdown selector
export const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/UTC-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/UTC-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/UTC-6' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/UTC-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/UTC-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  { value: 'America/Phoenix', label: 'Arizona (MST)', offset: 'UTC-7' },
  { value: 'America/Toronto', label: 'Toronto (ET)', offset: 'UTC-5/UTC-4' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)', offset: 'UTC-8/UTC-7' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 'UTC+0/UTC+1' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 'UTC+1/UTC+2' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: 'UTC+1/UTC+2' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 'UTC+4' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: 'UTC+10/UTC+11' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', offset: 'UTC+10/UTC+11' },
]

/**
 * Format a time with timezone abbreviation
 * e.g., "7:00 PM PST" or "19:00 PST"
 */
export function formatTimeWithTimezone(
  time: string,
  timezone: string,
  date?: string,
  use12Hour: boolean = true
): string {
  if (!time) return ''

  try {
    // Create a date object for proper timezone formatting
    const dateStr = date || new Date().toISOString().split('T')[0]
    const dateTime = new Date(`${dateStr}T${time}:00`)

    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: use12Hour,
      timeZone: timezone,
      timeZoneName: 'short',
    })

    return formatter.format(dateTime)
  } catch (error) {
    // Fallback if timezone is invalid
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    if (use12Hour) {
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${hour12}:${minutes} ${ampm}`
    }
    return time
  }
}

/**
 * Get timezone abbreviation for a given timezone ID
 * e.g., "America/Los_Angeles" -> "PST" or "PDT" depending on date
 */
export function getTimezoneAbbreviation(timezone: string, date?: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })

    const parts = formatter.formatToParts(date || new Date())
    const tzPart = parts.find(part => part.type === 'timeZoneName')
    return tzPart?.value || timezone
  } catch {
    return timezone
  }
}

/**
 * Get friendly timezone name
 * e.g., "America/Los_Angeles" -> "Pacific Time"
 */
export function getTimezoneFriendlyName(timezone: string): string {
  const found = COMMON_TIMEZONES.find(tz => tz.value === timezone)
  if (found) {
    return found.label
  }

  // Try to extract a friendly name from the timezone ID
  const parts = timezone.split('/')
  if (parts.length > 1) {
    return parts[parts.length - 1].replace(/_/g, ' ')
  }

  return timezone
}

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}
