import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getEventById } from '@/lib/db/events'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Clock, Ticket, Wine } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface EventPageProps {
  params: Promise<{
    businessSlug: string
    eventId: string
  }>
}

export default async function EventPage({ params }: EventPageProps) {
  const { businessSlug, eventId } = await params

  let business
  let event

  try {
    business = await getBusinessBySlug(businessSlug)
    event = await getEventById(eventId)
  } catch (error) {
    notFound()
  }

  // Check if event belongs to this business
  if (event.business_id !== business.id) {
    notFound()
  }

  // Check if table service is enabled and has available tables
  let hasTableService = false
  let totalAvailableTables = 0

  if ((event as any).table_service_enabled) {
    const supabase = await createClient()
    const { data: tableSections } = await supabase
      .from('event_table_sections')
      .select('available_tables')
      .eq('event_id', eventId)
      .eq('is_enabled', true)

    if (tableSections && tableSections.length > 0) {
      hasTableService = true
      totalAvailableTables = tableSections.reduce((sum, s) => sum + s.available_tables, 0)
    }
  }

  const eventDate = new Date(event.event_date)
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const isSoldOut = event.available_tickets === 0
  const isPublished = event.status === 'published'
  const isCancelled = event.status === 'cancelled'

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      {event.image_url && (
        <div className="relative w-full h-[400px] md:h-[500px]">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Event Title and Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {isCancelled && (
                  <Badge variant="destructive" className="text-sm">
                    Cancelled
                  </Badge>
                )}
                {!isCancelled && isSoldOut && (
                  <Badge variant="secondary" className="text-sm">
                    Sold Out
                  </Badge>
                )}
                {!isCancelled && !isPublished && (
                  <Badge variant="secondary" className="text-sm">
                    Draft
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                {event.title}
              </h1>

              <p className="text-lg text-muted-foreground">
                Presented by{' '}
                <Link
                  href={`/${businessSlug}`}
                  className="text-primary hover:underline"
                >
                  {business.name}
                </Link>
              </p>
            </div>

            {/* Event Details */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Date & Time</p>
                    <p className="text-sm text-muted-foreground">
                      {formattedDate}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formattedTime}
                    </p>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {event.location}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Ticket className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Availability</p>
                    <p className="text-sm text-muted-foreground">
                      {event.available_tickets} of {event.total_tickets} tickets remaining
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {event.description && (
              <div>
                <h2 className="text-2xl font-bold mb-4">About This Event</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Ticket Purchase */}
          <div className="md:col-span-1">
            <Card className="sticky top-8">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Price</p>
                  <p className="text-3xl font-bold">
                    ${event.ticket_price.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">per ticket</p>
                </div>

                {/* Action Buttons - Side by Side */}
                <div className="flex gap-2">
                  {isPublished && !isCancelled && !isSoldOut ? (
                    <Button asChild variant="outline" className="flex-1" size="lg">
                      <Link href={`/${businessSlug}/events/${eventId}/checkout`}>
                        <Ticket className="mr-2 h-4 w-4" />
                        Get Tickets
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className="flex-1" size="lg">
                      <Ticket className="mr-2 h-4 w-4" />
                      {isCancelled
                        ? 'Event Cancelled'
                        : isSoldOut
                        ? 'Sold Out'
                        : 'Not Available'}
                    </Button>
                  )}

                  {/* Book Table Button */}
                  {isPublished && !isCancelled && hasTableService && totalAvailableTables > 0 && (
                    <Button asChild variant="outline" className="flex-1" size="lg">
                      <Link href={`/${businessSlug}/events/${eventId}/book-table`}>
                        <Wine className="mr-2 h-4 w-4" />
                        Book Table
                      </Link>
                    </Button>
                  )}
                </div>

                <div className="pt-4 border-t space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tickets are non-refundable
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Secure checkout powered by Stripe
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Back to Business */}
        <div className="mt-12 pt-8 border-t">
          <Button variant="outline" asChild>
            <Link href={`/${businessSlug}`}>
              ← Back to {business.name}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
