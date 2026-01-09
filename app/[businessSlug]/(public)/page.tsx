import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getPublishedEventsByBusinessId, getEventPriceDisplay, getEventAvailableTickets, getEventTotalTickets } from '@/lib/db/events'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EventInfoTooltip } from '@/components/event-info-tooltip'
import { BusinessMap } from '@/components/business/business-map'
import { AnimatedThemeGlow } from '@/components/business/animated-theme-glow'
import { GlowPointer } from '@/components/business/glow-pointer'
import { PublicEventsCalendar } from '@/components/public/public-events-calendar'
import { Armchair, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering to always show current ticket availability
export const dynamic = 'force-dynamic'

interface BusinessPageProps {
  params: Promise<{
    businessSlug: string
  }>
  searchParams: Promise<{
    ref?: string
  }>
}

// Helper function to format time to 12-hour format
function formatTimeTo12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`
}

export default async function BusinessPage({ params, searchParams }: BusinessPageProps) {
  const { businessSlug } = await params
  const { ref } = await searchParams

  // Build ref query string for checkout links
  const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : ''
  const refParamFirst = ref ? `?ref=${encodeURIComponent(ref)}` : ''

  // Fetch business data
  let business
  try {
    business = await getBusinessBySlug(businessSlug)
  } catch (error) {
    notFound()
  }

  // Fetch published events (include past events for calendar view)
  let events: Awaited<ReturnType<typeof getPublishedEventsByBusinessId>> = []
  try {
    events = await getPublishedEventsByBusinessId(business.id, true)
  } catch (error) {
    console.error('Error fetching events:', error)
  }

  // Fetch table service availability for events that have it enabled
  const supabase = await createClient()
  const eventsWithTableService = events.filter((e: any) => e.table_service_enabled)
  const eventTableServiceMap: Record<string, number> = {}

  if (eventsWithTableService.length > 0) {
    const { data: tableSections } = await supabase
      .from('event_table_sections')
      .select('event_id, available_tables')
      .in('event_id', eventsWithTableService.map(e => e.id))
      .eq('is_enabled', true)

    if (tableSections) {
      tableSections.forEach(section => {
        eventTableServiceMap[section.event_id] = (eventTableServiceMap[section.event_id] || 0) + section.available_tables
      })
    }
  }

  const themeColor = business.theme_color || '#3b82f6'
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }

  const hsl = hexToHsl(themeColor)

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Pointer tracking for glow effect */}
      <GlowPointer />

      {/* Animated Background Glow */}
      <AnimatedThemeGlow themeColor={themeColor} />

      <div
        className="container mx-auto px-4 py-8 relative z-10"
        style={{
          '--glow-hue': hsl.h,
          '--glow-saturation': hsl.s,
          '--glow-lightness': hsl.l,
        } as React.CSSProperties}
      >
        {/* Business Header */}
        <div className="mb-8 pb-8 border-b flex items-center justify-between">
          {business.logo_url ? (
            <div className="relative h-12 w-auto max-w-[200px]">
              <Image
                src={business.logo_url}
                alt={business.name}
                width={200}
                height={48}
                className="object-contain object-left h-12 w-auto"
                priority
              />
            </div>
          ) : (
            <h1 className="text-4xl font-bold mb-2">{business.name}</h1>
          )}

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {business.website && (
              <Link
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </Link>
            )}

            {business.instagram && (
              <Link
                href={business.instagram.startsWith('http') ? business.instagram : `https://instagram.com/${business.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </Link>
            )}

            {business.tiktok && (
              <Link
                href={business.tiktok.startsWith('http') ? business.tiktok : `https://tiktok.com/@${business.tiktok.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </Link>
            )}

            {business.facebook && (
              <Link
                href={business.facebook.startsWith('http') ? business.facebook : `https://facebook.com/${business.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Events Section */}
        <section>
          {events.length === 0 ? (
            <>
              <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No upcoming events at this time. Check back soon!
                  </p>
                </CardContent>
              </Card>
            </>
          ) : events.length > 12 ? (
            /* Calendar view for more than 12 events */
            <PublicEventsCalendar
              events={events.map((event) => ({
                id: event.id,
                title: event.title,
                event_date: event.event_date,
                event_time: event.event_time,
                location: event.location,
                image_url: event.image_url,
                availableTickets: getEventAvailableTickets(event),
                priceDisplay: getEventPriceDisplay(event),
                hasTableService: eventTableServiceMap[event.id] > 0,
              }))}
              businessSlug={businessSlug}
              themeColor={themeColor}
              title="Upcoming Events"
              trackingRef={ref}
            />
          ) : (
            /* Grid view for 12 or fewer events */
            <>
              <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {events.map((event) => {
                const availableTickets = getEventAvailableTickets(event)
                const totalTickets = getEventTotalTickets(event)

                return (
                  <Card key={event.id} className="flex flex-col p-0 event-glow-card" data-glow>
                    <div data-glow></div>
                    {event.image_url && (
                      <div className="relative w-full aspect-square bg-muted overflow-hidden rounded-t-lg">
                        <Image
                          src={event.image_url}
                          alt={event.title}
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                    <CardHeader className="space-y-4 px-6 pt-3 pb-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={availableTickets > 0 ? 'success' : 'destructive'}>
                            {availableTickets > 0 ? `${availableTickets} available` : 'Sold Out'}
                          </Badge>
                          {(event.description || event.location) && (
                            <EventInfoTooltip
                              description={event.description}
                              location={event.location}
                            />
                          )}
                        </div>
                        <CardTitle className="line-clamp-2 mt-4">{event.title}</CardTitle>
                        <CardDescription>
                          {new Date(event.event_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                          {event.event_time && ` at ${formatTimeTo12Hour(event.event_time)}`}
                        </CardDescription>
                        <div className="text-lg font-bold">
                          {getEventPriceDisplay(event)}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" asChild disabled={availableTickets === 0} className="flex-1">
                            <Link href={`/${businessSlug}/events/${event.id}/checkout${refParamFirst}`}>
                              <Ticket className="mr-1 h-3 w-3" />
                              {availableTickets > 0 ? 'Buy Tickets' : 'Sold Out'}
                            </Link>
                          </Button>
                          {eventTableServiceMap[event.id] > 0 && (
                            <Button size="sm" variant="outline" asChild className="flex-1">
                              <Link href={`/${businessSlug}/events/${event.id}/checkout?mode=tables${refParam}`}>
                                <Armchair className="mr-1 h-3 w-3" />
                                Book Table
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}
              </div>
            </>
          )}
        </section>

        {/* Business Map - Only show if location is set */}
        {business.address && business.address_latitude && business.address_longitude && (
          <section className="mt-12">
            <BusinessMap
              address={business.address}
              latitude={business.address_latitude}
              longitude={business.address_longitude}
              businessName={business.name}
            />
          </section>
        )}
      </div>
    </div>
  )
}
