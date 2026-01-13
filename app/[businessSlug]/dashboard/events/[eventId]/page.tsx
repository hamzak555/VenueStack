import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventById } from '@/lib/db/events'
import { getTicketTypes } from '@/lib/db/ticket-types'
import { hasEventBeenSold } from '@/lib/db/orders'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getEventAnalytics } from '@/lib/db/analytics'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EventForm } from '@/components/business/event-form'
import TicketTypesTab from '@/components/business/ticket-types-tab'
import EventTableServiceTab from '@/components/business/event-table-service-tab'
import PromoCodesTab from '@/components/business/promo-codes-tab'
import ArtistLineupTab from '@/components/business/artist-lineup-tab'
import { DeleteEventButton } from '@/components/delete-event-button'
import { DuplicateEventButton } from '@/components/duplicate-event-button'
import { CopyEventLink } from '@/components/business/copy-event-link'
import { formatCurrency } from '@/lib/utils/currency'
import { Ticket, Armchair, TrendingUp } from 'lucide-react'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface EventManagePageProps {
  params: Promise<{
    businessSlug: string
    eventId: string
  }>
}

export default async function EventManagePage({ params }: EventManagePageProps) {
  const { businessSlug, eventId } = await params

  let event
  let business
  try {
    event = await getEventById(eventId)
    business = await getBusinessBySlug(businessSlug)
  } catch (error) {
    notFound()
  }

  // If this is a recurring instance, fetch the parent's recurrence rule
  let recurrenceRule = event.recurrence_rule
  if (event.parent_event_id && !recurrenceRule) {
    try {
      const parentEvent = await getEventById(event.parent_event_id)
      if (parentEvent) {
        recurrenceRule = parentEvent.recurrence_rule
      }
    } catch (error) {
      console.error('Error fetching parent event:', error)
    }
  }

  const ticketTypes = await getTicketTypes(eventId)

  // Check if event has been sold
  const eventHasBeenSold = await hasEventBeenSold(eventId)

  // Fetch event analytics
  const analytics = await getEventAnalytics(eventId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessSlug}/dashboard/events`}>← Back to Events</Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
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
          <CopyEventLink businessSlug={businessSlug} eventId={eventId} />
          <DuplicateEventButton
            eventId={eventId}
            eventTitle={event.title}
            businessId={event.business_id}
            businessSlug={businessSlug}
          />
          <DeleteEventButton
            eventId={eventId}
            eventTitle={event.title}
            businessId={event.business_id}
            businessSlug={businessSlug}
            canDelete={!eventHasBeenSold}
            reasonCannotDelete={
              eventHasBeenSold
                ? 'Cannot delete event with sold tickets'
                : undefined
            }
            isRecurringInstance={!!event.parent_event_id}
          />
        </div>
      </div>

      {/* Event Performance Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <CardTitle className="text-sm font-medium text-green-600">Net Revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.net_revenue)}</div>
            <p className="text-xs text-muted-foreground">
              Amount you receive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.gross_revenue)}</div>
            <p className="text-xs text-muted-foreground">
              Total collected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tax Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.ticket_tax + analytics.table_tax)}</div>
            <p className="text-xs text-muted-foreground">
              Tickets + Tables
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket & Table Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Ticket Sales</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tickets Sold</span>
                <span className="font-medium">{analytics.tickets_sold}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available</span>
                <span className="font-medium">{analytics.tickets_available}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="font-medium">{analytics.ticket_orders}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gross Revenue</span>
                  <span className="font-medium">{formatCurrency(analytics.ticket_gross_revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax Collected</span>
                  <span className="font-medium">{formatCurrency(analytics.ticket_tax)}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">Net Revenue</span>
                  <span className="font-bold text-green-600">{formatCurrency(analytics.ticket_net_revenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Table Service</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tables Booked</span>
                <span className="font-medium">{analytics.tables_booked}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gross Revenue</span>
                  <span className="font-medium">{formatCurrency(analytics.table_revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax Collected</span>
                  <span className="font-medium">{formatCurrency(analytics.table_tax)}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">Net Revenue</span>
                  <span className="font-bold text-green-600">{formatCurrency(analytics.table_revenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Management Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Event Details</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="tables">Table Service</TabsTrigger>
          <TabsTrigger value="artists">Artist Lineup</TabsTrigger>
          <TabsTrigger value="promo">Promo Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <EventForm
            businessId={event.business_id}
            businessSlug={businessSlug}
            defaultTimezone={business?.default_timezone || 'America/Los_Angeles'}
            initialData={{
              id: event.id,
              title: event.title,
              description: event.description || '',
              event_date: event.event_date,
              event_time: event.event_time,
              location: event.location || '',
              location_latitude: event.location_latitude,
              location_longitude: event.location_longitude,
              google_place_id: event.google_place_id,
              image_url: event.image_url,
              status: event.status,
              recurrence_rule: recurrenceRule,
              parent_event_id: event.parent_event_id,
            }}
          />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <TicketTypesTab
            eventId={eventId}
            isRecurringEvent={!!event.parent_event_id || (!!recurrenceRule && recurrenceRule.type !== 'none')}
          />
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <EventTableServiceTab
            eventId={eventId}
            businessSlug={businessSlug}
            businessId={event.business_id}
            isRecurringEvent={!!event.parent_event_id || (!!recurrenceRule && recurrenceRule.type !== 'none')}
          />
        </TabsContent>

        <TabsContent value="artists" className="space-y-4">
          <ArtistLineupTab
            eventId={eventId}
            isRecurringEvent={!!event.parent_event_id || (!!recurrenceRule && recurrenceRule.type !== 'none')}
          />
        </TabsContent>

        <TabsContent value="promo" className="space-y-4">
          <PromoCodesTab eventId={eventId} businessSlug={businessSlug} businessId={event.business_id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
