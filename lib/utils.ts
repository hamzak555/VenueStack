import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC.
 * This prevents timezone issues where "2026-01-12" becomes Jan 11th in Pacific time.
 */
export function parseLocalDate(dateString: string): Date {
  // Handle both "2026-01-12" and "2026-01-12T00:00:00" formats
  const datePart = dateString.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year, month - 1, day) // month is 0-indexed
}
