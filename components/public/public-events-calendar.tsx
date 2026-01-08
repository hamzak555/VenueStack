'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Ticket, Armchair } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PublicEvent {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  availableTickets: number
  priceDisplay: string
  hasTableService: boolean
}

interface PublicEventsCalendarProps {
  events: PublicEvent[]
  businessSlug: string
  themeColor?: string
  title?: string
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTimeTo12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`
}

export function PublicEventsCalendar({ events, businessSlug, themeColor = '#3b82f6', title }: PublicEventsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    // Start on the month of the first event, or current month if no events
    if (events.length > 0) {
      const firstEventDate = events[0].event_date.split('T')[0]
      const [year, month] = firstEventDate.split('-').map(Number)
      return new Date(year, month - 1, 1)
    }
    return new Date()
  })

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const { year, month, calendarDays, rowsWithEvents } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const firstDayOfMonth = firstDay.getDay()

    const days: (number | null)[] = []

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null)
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return { year, month, calendarDays: days, rowsWithEvents: new Set<number>() }
  }, [currentDate])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, PublicEvent[]>()

    events.forEach(event => {
      const dateStr = event.event_date.split('T')[0]
      const [y, m, d] = dateStr.split('-').map(Number)
      const eventDate = new Date(y, m - 1, d)

      if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
        const day = eventDate.getDate()
        const key = day.toString()
        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key)!.push(event)
      }
    })

    return map
  }, [events, year, month])

  // Determine which rows have future events (non-past events)
  const rowHasFutureEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rowsWithFutureEvents = new Set<number>()

    calendarDays.forEach((day, index) => {
      if (day !== null) {
        const rowIndex = Math.floor(index / 7)
        const checkDate = new Date(year, month, day)
        const isPastDay = checkDate < today
        const dayEvents = eventsByDate.get(day.toString()) || []

        // Row has future events if day is not past and has events
        if (!isPastDay && dayEvents.length > 0) {
          rowsWithFutureEvents.add(rowIndex)
        }
      }
    })

    return rowsWithFutureEvents
  }, [calendarDays, eventsByDate, year, month])

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear()
  }

  const isPast = (day: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(year, month, day)
    return checkDate < today
  }

  return (
    <div className="space-y-4">
      {/* Header with title on left and navigation on the right */}
      <div className="flex items-center justify-between">
        {title && <h2 className="text-2xl font-bold">{title}</h2>}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthName}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="ml-2 h-8" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border border-border/30">
        {/* Days of week header */}
        <div className="grid grid-cols-7 bg-muted/50 rounded-t-lg">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-b border-border/50">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dayEvents = day ? eventsByDate.get(day.toString()) || [] : []
            const hasEvents = dayEvents.length > 0
            const pastDay = day ? isPast(day) : false
            const rowIndex = Math.floor(index / 7)
            const isCompactRow = !rowHasFutureEvents.has(rowIndex)
            const isLastRow = index >= calendarDays.length - 7
            // Use compact cards for past days or multiple events
            const useCompactCards = pastDay || dayEvents.length > 1

            return (
              <div
                key={index}
                className={cn(
                  "p-3 border-b border-r border-border/30",
                  isCompactRow ? "min-h-[80px]" : "min-h-[200px]",
                  "[&:nth-child(7n)]:border-r-0",
                  isLastRow && "border-b-0",
                  day === null && "bg-muted/10",
                  pastDay && day !== null && "bg-muted/5 opacity-60"
                )}
              >
                {day !== null && (
                  <div className="h-full flex flex-col">
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                        isToday(day) && "bg-primary text-primary-foreground",
                        pastDay && !isToday(day) && "text-muted-foreground"
                      )}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                        </span>
                      )}
                    </div>

                    {/* Events */}
                    <div className="flex-1 overflow-hidden relative">
                      {hasEvents && (
                        <>
                        <div className={cn(
                          "space-y-2",
                          useCompactCards && dayEvents.length > 1 && "max-h-[232px] overflow-y-auto overflow-x-hidden scrollbar-thin",
                          useCompactCards && dayEvents.length > 3 && "pb-14"
                        )}>
                          {dayEvents.map(event => (
                            <PublicEventCard
                              key={event.id}
                              event={event}
                              businessSlug={businessSlug}
                              compact={useCompactCards}
                              themeColor={themeColor}
                            />
                          ))}
                        </div>
                        {useCompactCards && dayEvents.length > 3 && (
                          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
                        )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthName}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="ml-2 h-8" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>
    </div>
  )
}

function PublicEventCard({ event, businessSlug, compact, themeColor }: { event: PublicEvent; businessSlug: string; compact: boolean; themeColor: string }) {
  const ticketsSoldOut = event.availableTickets === 0
  const hasTableService = event.hasTableService
  const hasTickets = event.availableTickets > 0
  const showPrice = event.priceDisplay && event.priceDisplay !== 'N/A' && event.priceDisplay !== 'Free'

  // Check if event is in the past
  const eventDateStr = event.event_date.split('T')[0]
  const [year, month, day] = eventDateStr.split('-').map(Number)
  const eventDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPastEvent = eventDate < today

  // Determine if card should be interactive (not clickable if past or sold out without tables)
  const isClickable = !isPastEvent && (!ticketsSoldOut || hasTableService)
  const hasBothOptions = isClickable && !ticketsSoldOut && hasTableService

  // Compact card content for multiple events on same day
  const compactCard = (
    <div
      className={cn(
        "h-[56px] rounded-md bg-card glow-rounded-sm",
        isPastEvent && "opacity-40",
        !isClickable && !isPastEvent && "opacity-60"
      )}
      data-glow
    >
      <div className="flex w-full h-full overflow-hidden rounded-[5px]">
        {event.image_url && (
          <div className="relative w-[54px] h-full flex-shrink-0 rounded-l-[5px] overflow-hidden">
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0 p-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn("text-[11px] font-medium truncate transition-colors", isClickable && "group-hover:text-primary")}>
              {event.title}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {event.event_time && (
                <p className="text-[10px] text-muted-foreground">
                  {formatTimeTo12Hour(event.event_time)}
                </p>
              )}
              {ticketsSoldOut && !hasTableService && (
                <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3">
                  Sold Out
                </Badge>
              )}
              {ticketsSoldOut && hasTableService && (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3">
                  Tables Only
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            {hasTickets && (
              <Ticket className="h-3 w-3" style={{ color: themeColor }} />
            )}
            {hasTableService && (
              <Armchair className="h-3 w-3" style={{ color: themeColor }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // Full-size card content for single event
  const fullCard = (
    <div
      className={cn(
        "flex flex-col h-full rounded-xl bg-card relative glow-rounded-lg",
        isPastEvent && "opacity-40",
        !isClickable && !isPastEvent && "opacity-60"
      )}
      data-glow
    >
      {event.image_url ? (
          <>
            <div className="relative z-10 w-full aspect-square bg-muted overflow-hidden rounded-t-lg">
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-contain"
              />
            </div>
            <div className="p-2 flex-1 flex flex-col justify-center relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-[11px] font-medium truncate transition-colors", isClickable && "group-hover:text-primary")}>
                    {event.title}
                  </p>
                  {event.event_time && (
                    <p className="text-[10px] text-muted-foreground">
                      {formatTimeTo12Hour(event.event_time)}
                    </p>
                  )}
                  {ticketsSoldOut && !hasTableService && (
                    <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3 mt-1">
                      Sold Out
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  {hasTickets && (
                    <Ticket className="h-4 w-4" style={{ color: themeColor }} />
                  )}
                  {hasTableService && (
                    <Armchair className="h-4 w-4" style={{ color: themeColor }} />
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-2 h-full flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs font-medium truncate transition-colors", isClickable && "group-hover:text-primary")}>
                  {event.title}
                </p>
                {event.event_time && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatTimeTo12Hour(event.event_time)}
                  </p>
                )}
                {ticketsSoldOut && !hasTableService && (
                  <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3 mt-1">
                    Sold Out
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-center gap-0.5">
                {hasTickets && (
                  <Ticket className="h-4 w-4" style={{ color: themeColor }} />
                )}
                {hasTableService && (
                  <Armchair className="h-4 w-4" style={{ color: themeColor }} />
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )

  const cardContent = compact ? compactCard : fullCard

  // Not clickable - both tickets sold out and no table service
  if (!isClickable) {
    return (
      <div className={compact ? "block" : "block h-full"}>
        {cardContent}
      </div>
    )
  }

  // Has both options or only tickets - link directly to checkout (toggle available there)
  if (hasBothOptions || !ticketsSoldOut) {
    return (
      <Link
        href={`/${businessSlug}/events/${event.id}/checkout`}
        className={compact ? "block group" : "block group h-full"}
      >
        {cardContent}
      </Link>
    )
  }

  // Only table service available (tickets sold out) - link directly to checkout with tables mode
  return (
    <Link
      href={`/${businessSlug}/events/${event.id}/checkout?mode=tables`}
      className={compact ? "block group" : "block group h-full"}
    >
      {cardContent}
    </Link>
  )
}
