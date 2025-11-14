import Link from 'next/link'
import Image from 'next/image'
import { getEventsByBusinessId, getEventPriceDisplay, getEventTicketSales, getEventAvailableTickets, getEventTotalTickets } from '@/lib/db/events'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EventTicketsCell } from '@/components/business/event-tickets-cell'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface EventsPageProps {
  params: Promise<{
    businessId: string
  }>
}

export default async function EventsPage({ params }: EventsPageProps) {
  const { businessId } = await params
  const events = await getEventsByBusinessId(businessId)

  // Fetch ticket sales data for all events
  const eventsWithSales = await Promise.all(
    events.map(async (event) => {
      const salesData = await getEventTicketSales(event.id)
      const availableTickets = getEventAvailableTickets(event)
      return {
        ...event,
        salesData: {
          totalSold: salesData.totalSold,
          availableTickets,
          breakdown: salesData.breakdown
        }
      }
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Manage your event listings and ticket sales
          </p>
        </div>
        <Button asChild>
          <Link href={`/business/${businessId}/events/new`}>Create Event</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Events</CardTitle>
          <CardDescription>
            {eventsWithSales.length} event{eventsWithSales.length !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsWithSales.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No events created yet
              </p>
              <Button asChild>
                <Link href={`/business/${businessId}/events/new`}>
                  Create Your First Event
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsWithSales.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {event.image_url && (
                          <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                            <Image
                              src={event.image_url}
                              alt={event.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{event.title}</div>
                          {event.location && (
                            <div className="text-sm text-muted-foreground">
                              {event.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(event.event_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === 'published'
                            ? 'success'
                            : event.status === 'cancelled'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="capitalize"
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <EventTicketsCell salesData={event.salesData} />
                    </TableCell>
                    <TableCell>{getEventPriceDisplay(event)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/business/${businessId}/events/${event.id}`}>
                          Manage
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
