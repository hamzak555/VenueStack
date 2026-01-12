'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, ChevronLeft, ChevronRight, Pencil, Ticket, Armchair } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { QuickEventModal } from './quick-event-modal'

interface SalesData {
  totalSold: number
  availableTickets: number
  breakdown: Array<{ name: string; quantity: number }>
  grossRevenue: number
  netRevenue: number
  fees: number
}

interface TableData {
  booked: number
  total: number
  revenue: number
}

interface EventWithSales {
  id: string
  title: string
  event_date: string
  event_time: string | null
  status: 'draft' | 'published' | 'cancelled'
  location: string | null
  image_url: string | null
  table_service_enabled?: boolean
  salesData?: SalesData
  tableData?: TableData
}

interface DefaultLocation {
  address: string | null
  latitude: number | null
  longitude: number | null
  placeId: string | null
}

interface EventsCalendarProps {
  events: EventWithSales[]
  businessSlug: string
  businessId: string
  currentDate: Date
  defaultLocation?: DefaultLocation
  defaultTimezone?: string
  onPreviousMonth?: () => void
  onNextMonth?: () => void
  onToday?: () => void
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_OF_WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function EventsCalendar({ events, businessSlug, businessId, currentDate, defaultLocation, defaultTimezone, onPreviousMonth, onNextMonth, onToday }: EventsCalendarProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // Mobile week navigation - track the start of the current week
  const [mobileWeekStart, setMobileWeekStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  })

  const openCreateModal = (date: Date) => {
    setSelectedDate(date)
    setModalOpen(true)
  }

  const openCreateModalByDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(date)
    setModalOpen(true)
  }

  // Mobile week navigation
  const goToPreviousWeek = () => {
    const newStart = new Date(mobileWeekStart)
    newStart.setDate(mobileWeekStart.getDate() - 7)
    setMobileWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(mobileWeekStart)
    newStart.setDate(mobileWeekStart.getDate() + 7)
    setMobileWeekStart(newStart)
  }

  const goToCurrentWeek = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    setMobileWeekStart(weekStart)
  }

  // Get the 7 days of the current mobile week
  const mobileWeekDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(mobileWeekStart)
      day.setDate(mobileWeekStart.getDate() + i)
      days.push(day)
    }
    return days
  }, [mobileWeekStart])

  // Format the mobile week header
  const mobileWeekLabel = useMemo(() => {
    const endOfWeek = new Date(mobileWeekStart)
    endOfWeek.setDate(mobileWeekStart.getDate() + 6)

    const startMonth = mobileWeekStart.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' })
    const startDay = mobileWeekStart.getDate()
    const endDay = endOfWeek.getDate()
    const year = mobileWeekStart.getFullYear()

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
  }, [mobileWeekStart])

  const { year, month, calendarDays } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const firstDayOfMonth = firstDay.getDay()

    // Create array of days for the calendar grid
    const days: (number | null)[] = []

    // Add empty slots for days before the first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return { year, month, calendarDays: days }
  }, [currentDate])

  // Group events by date string (YYYY-MM-DD format)
  const eventsByDateStr = useMemo(() => {
    const map = new Map<string, EventWithSales[]>()

    events.forEach(event => {
      const dateStr = event.event_date.split('T')[0]
      if (!map.has(dateStr)) {
        map.set(dateStr, [])
      }
      map.get(dateStr)!.push(event)
    })

    return map
  }, [events])

  // Group events by day number for monthly view
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithSales[]>()

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

  const isTodayDate = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear()
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  const isPast = (day: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(year, month, day)
    return checkDate < today
  }

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return (
    <div className="space-y-4">
      {/* Mobile Weekly View */}
      <div className="lg:hidden">
        {/* Week Navigation */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="outline" size="icon" className="h-8 w-8 border-[rgb(var(--theme-color))]/30 hover:bg-[rgb(var(--theme-color))]/10 hover:border-[rgb(var(--theme-color))]/50" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" style={{ color: 'var(--theme-color-hex)' }} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-[rgb(var(--theme-color))]/30 hover:bg-[rgb(var(--theme-color))]/10 hover:border-[rgb(var(--theme-color))]/50" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" style={{ color: 'var(--theme-color-hex)' }} />
          </Button>
          <span className="text-base font-bold ml-1" style={{ color: 'var(--theme-color-hex)' }}>{mobileWeekLabel}</span>
          <Button variant="outline" size="sm" className="ml-2 h-8 border-[rgb(var(--theme-color))]/30 hover:bg-[rgb(var(--theme-color))]/10 hover:border-[rgb(var(--theme-color))]/50" style={{ color: 'var(--theme-color-hex)' }} onClick={goToCurrentWeek}>
            This Week
          </Button>
        </div>

        {/* Weekly Days List */}
        <div className="border rounded-lg overflow-hidden divide-y">
          {mobileWeekDays.map((date, index) => {
            const dateKey = formatDateKey(date)
            const dayEvents = eventsByDateStr.get(dateKey) || []
            const isCurrentDay = isTodayDate(date)
            const pastDay = isPastDate(date)

            return (
              <div
                key={index}
                className={cn(
                  "p-3",
                  pastDay && "bg-muted/20",
                  isCurrentDay && "bg-[rgb(var(--theme-color))]/5"
                )}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-base font-semibold w-8 h-8 flex items-center justify-center rounded-full",
                        isCurrentDay && "bg-[rgb(var(--theme-color))]/20 border border-[rgb(var(--theme-color))]/50",
                        pastDay && !isCurrentDay && "text-muted-foreground"
                      )}
                      style={isCurrentDay ? { color: 'var(--theme-color-hex)' } : undefined}
                    >
                      {date.getDate()}
                    </span>
                    <span className={cn(
                      "text-sm",
                      isCurrentDay && "font-medium",
                      pastDay && !isCurrentDay && "text-muted-foreground"
                    )}>
                      {DAYS_OF_WEEK_FULL[date.getDay()]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dayEvents.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    )}
                    {!pastDay && dayEvents.length > 0 && (
                      <button
                        onClick={() => openCreateModal(date)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-background/80 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-colors group"
                        title="Add event"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Events for this day */}
                {dayEvents.length > 0 ? (
                  <div className="space-y-2">
                    {dayEvents.map(event => (
                      <EventCard
                        key={event.id}
                        event={event}
                        businessSlug={businessSlug}
                        compact={true}
                      />
                    ))}
                  </div>
                ) : !pastDay ? (
                  <button
                    onClick={() => openCreateModal(date)}
                    className="w-full h-10 rounded-lg border border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-accent/50 transition-all flex items-center justify-center group"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">No events</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-6">
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="h-2 w-2 p-0 rounded-full" />
            <span>Published</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full" />
            <span>Draft</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full" />
            <span>Cancelled</span>
          </div>
        </div>
      </div>

      {/* Desktop Monthly View */}
      <div className="hidden lg:block">
        <div className="border rounded-lg overflow-hidden">
          {/* Days of week header */}
          <div className="grid grid-cols-7 bg-[rgb(var(--theme-color))]/10">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium border-b border-[rgb(var(--theme-color))]/20" style={{ color: 'var(--theme-color-hex)' }}>
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

              return (
                <div
                  key={index}
                  className={cn(
                    "h-[240px] p-2 border-b border-r",
                    "[&:nth-child(7n)]:border-r-0",
                    day === null && "bg-muted/30",
                    pastDay && day !== null && "bg-muted/20"
                  )}
                >
                  {day !== null && (
                    <div className="h-full flex flex-col">
                      {/* Day number and event count */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                            isToday(day) && "bg-[rgb(var(--theme-color))]/20 border border-[rgb(var(--theme-color))]/50",
                            pastDay && !isToday(day) && "text-muted-foreground"
                          )}
                          style={isToday(day) ? { color: 'var(--theme-color-hex)' } : undefined}
                        >
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                          </span>
                        )}
                      </div>

                      {/* Events or Add button */}
                      <div className="flex-1 relative overflow-hidden">
                        {hasEvents ? (
                          <div className="relative h-full">
                            {/* Single event uses full space, multiple events are compact */}
                            {dayEvents.length === 1 ? (
                              <EventCard
                                event={dayEvents[0]}
                                businessSlug={businessSlug}
                                compact={false}
                              />
                            ) : (
                              <>
                                <div className={cn(
                                  "space-y-1.5 h-full",
                                  dayEvents.length >= 4 ? "pb-14 overflow-y-auto" : "pb-1"
                                )}>
                                  {dayEvents.map(event => (
                                    <EventCard
                                      key={event.id}
                                      event={event}
                                      businessSlug={businessSlug}
                                      compact={true}
                                    />
                                  ))}
                                </div>
                                {dayEvents.length >= 4 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
                                )}
                              </>
                            )}
                            {/* Add button for days with events */}
                            {!pastDay && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openCreateModalByDay(day)
                                }}
                                className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center rounded-full bg-background/80 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-colors group z-10"
                                title="Add event"
                              >
                                <Plus className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors" />
                              </button>
                            )}
                          </div>
                        ) : !pastDay ? (
                          <div className="relative rounded-lg overflow-hidden border border-dashed border-muted-foreground/20 hover:border-primary/50 transition-all">
                            <button
                              onClick={() => openCreateModalByDay(day)}
                              className="w-full aspect-square flex items-center justify-center hover:bg-accent/50 transition-colors group"
                            >
                              <Plus className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend and Navigation */}
        <div className="flex items-center justify-between mt-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Badge variant="success" className="h-2 w-2 p-0 rounded-full" />
              <span>Published</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full" />
              <span>Draft</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full" />
              <span>Cancelled</span>
            </div>
          </div>

          {/* Navigation */}
          {(onPreviousMonth || onNextMonth || onToday) && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Button variant="outline" size="sm" className="h-8" onClick={onToday}>
                Today
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Event Creation Modal */}
      <QuickEventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        businessId={businessId}
        businessSlug={businessSlug}
        initialDate={selectedDate}
        defaultLocation={defaultLocation}
        defaultTimezone={defaultTimezone}
      />
    </div>
  )
}

function EventCard({ event, businessSlug, compact }: { event: EventWithSales; businessSlug: string; compact: boolean }) {
  const hasTickets = event.salesData && (event.salesData.totalSold > 0 || event.salesData.availableTickets > 0)
  const hasTables = event.table_service_enabled

  const cardContent = compact ? (
    // Compact horizontal card for multiple events
    <div className="relative rounded-md overflow-hidden border bg-card hover:border-primary/50 hover:shadow-sm transition-all h-[42px] flex">
      {event.image_url && (
        <div className="relative w-[42px] h-[42px] flex-shrink-0">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="42px"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0 p-1.5 flex items-center gap-1.5">
        <StatusDot status={event.status} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate group-hover:text-primary transition-colors">
            {event.title}
          </p>
          {event.event_time && (
            <p className="text-[10px] text-muted-foreground">
              {formatTime(event.event_time)}
            </p>
          )}
        </div>
      </div>
    </div>
  ) : (
    // Full-size card for single event
    <div className="relative rounded-lg overflow-hidden border bg-card hover:border-primary/50 hover:shadow-md transition-all">
      {event.image_url ? (
        <div className="relative w-full aspect-square">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 200px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-0 left-1.5">
            <StatusDot status={event.status} />
          </div>
          <div className="absolute bottom-1.5 left-2 right-2">
            <p className="text-xs font-medium text-white truncate">
              {event.title}
            </p>
            {event.event_time && (
              <p className="text-[10px] text-white/80">
                {formatTime(event.event_time)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2 h-full flex flex-col">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-medium truncate flex-1 group-hover:text-primary transition-colors">
              {event.title}
            </p>
            <StatusDot status={event.status} />
          </div>
          {event.event_time && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatTime(event.event_time)}
            </p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="block text-left w-full group">
          {cardContent}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1.5" align="start">
        <div className="space-y-0.5">
          <Link
            href={`/${businessSlug}/dashboard/events/${event.id}`}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Event
          </Link>
          {hasTickets && (
            <Link
              href={`/${businessSlug}/dashboard/tickets?eventId=${event.id}`}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <Ticket className="h-3.5 w-3.5" />
              View Tickets
            </Link>
          )}
          {hasTables && (
            <Link
              href={`/${businessSlug}/dashboard/tables?eventId=${event.id}`}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <Armchair className="h-3.5 w-3.5" />
              View Tables
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full inline-block",
        status === 'published' && "bg-green-500",
        status === 'cancelled' && "bg-red-500",
        status === 'draft' && "bg-gray-400"
      )}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  )
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}
