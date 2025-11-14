import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventById } from '@/lib/db/events'
import { getTicketTypes } from '@/lib/db/ticket-types'
import { hasEventBeenSold } from '@/lib/db/orders'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EventForm } from '@/components/business/event-form'
import TicketTypesTab from '@/components/business/ticket-types-tab'
import PromoCodesTab from '@/components/business/promo-codes-tab'
import { DeleteEventButton } from '@/components/delete-event-button'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface EventManagePageProps {
  params: Promise<{
    businessId: string
    eventId: string
  }>
}

export default async function EventManagePage({ params }: EventManagePageProps) {
  const { businessId, eventId } = await params

  let event
  try {
    event = await getEventById(eventId)
  } catch (error) {
    notFound()
  }

  const ticketTypes = await getTicketTypes(eventId)

  // Check if event has been sold
  const eventHasBeenSold = await hasEventBeenSold(eventId)

  // Calculate stats from ticket types
  let totalTickets = 0
  let availableTickets = 0
  let soldTickets = 0
  let revenue = 0

  if (ticketTypes.length > 0) {
    ticketTypes.forEach(tt => {
      totalTickets += tt.total_quantity
      availableTickets += tt.available_quantity
      const sold = tt.total_quantity - tt.available_quantity
      soldTickets += sold
      revenue += sold * tt.price
    })
  } else {
    // Fallback to event-level tickets if no ticket types exist
    totalTickets = event.total_tickets || 0
    availableTickets = event.available_tickets || 0
    soldTickets = totalTickets - availableTickets
    revenue = soldTickets * (event.ticket_price || 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/business/${businessId}/events`}>← Back to Events</Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
          <p className="text-muted-foreground">
            {new Date(event.event_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={
            event.status === 'published'
              ? 'success'
              : event.status === 'cancelled'
              ? 'destructive'
              : 'secondary'
          } className="capitalize">
            {event.status}
          </Badge>
          <DeleteEventButton
            eventId={eventId}
            eventTitle={event.title}
            businessId={businessId}
            canDelete={!eventHasBeenSold}
            reasonCannotDelete={
              eventHasBeenSold
                ? 'Cannot delete event with sold tickets'
                : undefined
            }
          />
        </div>
      </div>

      {/* Event Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{soldTickets}</div>
            <p className="text-xs text-muted-foreground">
              of {totalTickets} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableTickets}</div>
            <p className="text-xs text-muted-foreground">
              Tickets remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {ticketTypes.length > 0 ? `From ${ticketTypes.length} ticket option${ticketTypes.length > 1 ? 's' : ''}` : 'Total revenue'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Event Management Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Event Details</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="promo">Promo Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <EventForm
            businessId={businessId}
            initialData={{
              id: event.id,
              title: event.title,
              description: event.description || '',
              event_date: event.event_date,
              event_time: event.event_time,
              location: event.location || '',
              image_url: event.image_url,
              status: event.status,
            }}
          />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <TicketTypesTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="promo" className="space-y-4">
          <PromoCodesTab eventId={eventId} businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
