'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, MapPin, Wine, Search, ChevronRight } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils'

interface EventWithTableInfo {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  status: string
  table_bookings_count: number
  total_tables: number
  available_tables: number
  bookings_by_status: {
    seated: number
    arrived: number
    confirmed: number
    reserved: number
    completed: number
  }
}

interface TablesEventSelectorProps {
  events: EventWithTableInfo[]
  businessSlug: string
}

export function TablesEventSelector({ events, businessSlug }: TablesEventSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [mousePositions, setMousePositions] = useState<Record<string, { x: number; y: number }>>({})

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        // Search filter
        const query = searchQuery.toLowerCase()
        const matchesSearch = !query ||
          event.title.toLowerCase().includes(query) ||
          event.location?.toLowerCase().includes(query)

        // Time filter
        const eventDate = parseLocalDate(event.event_date)

        let matchesTime = true
        if (timeFilter === 'upcoming') {
          matchesTime = eventDate >= now
        } else if (timeFilter === 'past') {
          matchesTime = eventDate < now
        }

        return matchesSearch && matchesTime
      })
      .sort((a, b) => {
        const dateA = parseLocalDate(a.event_date)
        const dateB = parseLocalDate(b.event_date)
        // Upcoming: sort ascending (nearest first)
        // Past: sort descending (most recent first)
        return timeFilter === 'past'
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime()
      })
  }, [events, searchQuery, timeFilter, now])

  // Group events by month
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: EventWithTableInfo[] } = {}

    for (const event of filteredEvents) {
      const date = parseLocalDate(event.event_date)
      const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      if (!groups[monthKey]) {
        groups[monthKey] = []
      }
      groups[monthKey].push(event)
    }

    return groups
  }, [filteredEvents])

  const formatEventDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr)
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    }
  }

  const isToday = (dateStr: string) => {
    const eventDate = parseLocalDate(dateStr)
    return eventDate.getTime() === now.getTime()
  }

  const isPast = (dateStr: string) => {
    const eventDate = parseLocalDate(dateStr)
    return eventDate < now
  }

  const formatTimeTo12Hour = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`
  }

  const handleMouseMove = (eventId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePositions(prev => ({
      ...prev,
      [eventId]: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }))
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All Events</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wine className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? 'No events found matching your search'
                : timeFilter === 'upcoming'
                ? 'No upcoming events with table service'
                : timeFilter === 'past'
                ? 'No past events with table service'
                : 'No events with table service enabled'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">{month}</h3>
              <div className="grid gap-3">
                {monthEvents.map((event) => {
                  const { day, date, month: monthShort } = formatEventDate(event.event_date)
                  const eventIsPast = isPast(event.event_date)
                  const eventIsToday = isToday(event.event_date)

                  const mousePos = mousePositions[event.id] || { x: 0, y: 0 }

                  return (
                    <Link
                      key={event.id}
                      href={`/${businessSlug}/dashboard/tables?eventId=${event.id}`}
                    >
                      <div
                        className={`relative border rounded-lg overflow-hidden group cursor-pointer bg-card transition-colors ${eventIsPast ? 'opacity-75' : ''}`}
                        onMouseMove={(e) => handleMouseMove(event.id, e)}
                      >
                        {/* Animated gradient that follows cursor */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                          style={{
                            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.1), transparent 60%)`,
                          }}
                        />

                        <div className="relative z-10 p-4">
                          <div className="flex items-center gap-4">
                            {/* Date Box */}
                            <div
                              className={`flex-shrink-0 w-16 py-3 rounded-lg flex flex-col items-center justify-center ${
                                eventIsToday
                                  ? 'bg-[rgb(var(--theme-color))]'
                                  : eventIsPast
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-[rgb(var(--theme-color))]/10'
                              }`}
                              style={
                                eventIsToday
                                  ? { color: 'var(--theme-color-contrast)' }
                                  : !eventIsPast
                                  ? { color: 'var(--theme-color-hex)' }
                                  : undefined
                              }
                            >
                              <span className="text-xs font-medium uppercase">{day}</span>
                              <span className="text-2xl font-bold leading-none my-1">{date}</span>
                              <span className="text-xs">{monthShort}</span>
                            </div>

                            {/* Event Image */}
                            {event.image_url && (
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                <Image
                                  src={event.image_url}
                                  alt={event.title}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}

                            {/* Event Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold truncate">{event.title}</h4>
                                {eventIsToday && (
                                  <Badge className="text-xs bg-[rgb(var(--theme-color))]/20 border border-[rgb(var(--theme-color))]/50 hover:bg-[rgb(var(--theme-color))]/30" style={{ color: 'var(--theme-color-hex)' }}>Today</Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {event.event_time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatTimeTo12Hour(event.event_time)}
                                  </span>
                                )}
                                {event.location && (
                                  <span className="flex items-center gap-1 truncate">
                                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{event.location}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Table Stats */}
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs text-muted-foreground mb-2">
                                {event.available_tables} of {event.total_tables} tables available
                              </p>
                              <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                {event.bookings_by_status.arrived > 0 && (
                                  <Badge variant="success" className="text-xs">
                                    {event.bookings_by_status.arrived} Arrived
                                  </Badge>
                                )}
                                {event.bookings_by_status.seated > 0 && (
                                  <Badge variant="teal" className="text-xs">
                                    {event.bookings_by_status.seated} Seated
                                  </Badge>
                                )}
                                {event.bookings_by_status.confirmed > 0 && (
                                  <Badge variant="warning" className="text-xs">
                                    {event.bookings_by_status.confirmed} Confirmed
                                  </Badge>
                                )}
                                {event.bookings_by_status.completed > 0 && (
                                  <Badge variant="purple" className="text-xs">
                                    {event.bookings_by_status.completed} Completed
                                  </Badge>
                                )}
                                {event.bookings_by_status.reserved > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.bookings_by_status.reserved} Reserved
                                  </Badge>
                                )}
                                {event.table_bookings_count === 0 && (
                                  <span className="text-xs text-muted-foreground">No bookings</span>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
