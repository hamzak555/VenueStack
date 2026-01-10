import Link from 'next/link'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getTicketsByBusinessId, getEventsWithTicketStats } from '@/lib/db/tickets'
import { getEventById } from '@/lib/db/events'
import { getTicketTypes } from '@/lib/db/ticket-types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AllTicketsTable } from '@/components/business/all-tickets-table'
import { TicketsEventSelector } from '@/components/business/tickets-event-selector'
import { TicketTypeSalesProgress } from '@/components/business/ticket-type-sales-progress'
import { Ticket, ArrowLeft, Pencil } from 'lucide-react'
import Image from 'next/image'

// Force dynamic rendering to always show current data
export const dynamic = 'force-dynamic'

interface AllTicketsPageProps {
  params: Promise<{
    businessSlug: string
  }>
  searchParams: Promise<{
    eventId?: string
  }>
}

export default async function AllTicketsPage({ params, searchParams }: AllTicketsPageProps) {
  const { businessSlug } = await params
  const { eventId } = await searchParams
  const business = await getBusinessBySlug(businessSlug)

  // If no eventId, show event selection
  if (!eventId) {
    const events = await getEventsWithTicketStats(business.id)

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Tickets</h1>
            <p className="text-muted-foreground">
              Select an event to view and manage tickets
            </p>
          </div>
        </div>

        <TicketsEventSelector events={events} businessSlug={businessSlug} />
      </div>
    )
  }

  // Event selected - show tickets
  let tickets: any[] = []
  let event = null
  let ticketTypes: any[] = []

  try {
    event = await getEventById(eventId)
    ;[tickets, ticketTypes] = await Promise.all([
      getTicketsByBusinessId(business.id, eventId),
      getTicketTypes(eventId)
    ])
  } catch (error) {
    console.error('Error fetching tickets:', error)
  }

  // Calculate stats for this event
  const totalTickets = tickets.length
  const scannedTickets = tickets.filter(t => t.checked_in_at !== null).length
  const unscannedTickets = totalTickets - scannedTickets
  const scanRate = totalTickets > 0 ? ((scannedTickets / totalTickets) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessSlug}/dashboard/all-tickets`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            All Events
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        {event?.image_url ? (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Ticket className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{event?.title || 'Tickets'}</h1>
            {event && (
              <Link
                href={`/${businessSlug}/dashboard/events/${eventId}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Edit event"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {event && (
              <>
                {new Date(event.event_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {event.event_time && ` at ${new Date(`1970-01-01T${event.event_time}`).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}`}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Stats and Sales Progress Side by Side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Stats Grid - 2x2 */}
        <div className="grid gap-4 grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTickets}</div>
              <p className="text-xs text-muted-foreground">
                Tickets sold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scanned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scannedTickets}</div>
              <p className="text-xs text-muted-foreground">
                Checked in
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unscanned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unscannedTickets}</div>
              <p className="text-xs text-muted-foreground">
                Not checked in
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scan Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scanRate}%</div>
              <p className="text-xs text-muted-foreground">
                Checked in
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ticket Type Sales Progress */}
        {ticketTypes.length > 0 && (
          <TicketTypeSalesProgress ticketTypes={ticketTypes} compact />
        )}
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>
            {totalTickets} {totalTickets === 1 ? 'ticket' : 'tickets'} for this event
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                No tickets sold yet for this event
              </p>
              <p className="text-sm text-muted-foreground">
                Tickets will appear here once customers make purchases
              </p>
            </div>
          ) : (
            <AllTicketsTable tickets={tickets} businessSlug={businessSlug} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
