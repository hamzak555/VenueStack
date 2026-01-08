import Link from 'next/link'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getEventsByBusinessId, getEventAvailableTickets, getEventTotalTickets } from '@/lib/db/events'
import { getBusinessAnalytics } from '@/lib/db/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EventCardHover } from '@/components/business/event-card-hover'
import { formatCurrency } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering to always show current data
export const dynamic = 'force-dynamic'

interface BusinessDashboardProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function BusinessDashboard({ params }: BusinessDashboardProps) {
  const { businessSlug } = await params

  const business = await getBusinessBySlug(businessSlug)
  const events = await getEventsByBusinessId(business.id)
  const analytics = await getBusinessAnalytics(business.id)

  // Get total available tickets from ticket types
  const supabase = await createClient()
  const { data: allTicketTypes } = await supabase
    .from('ticket_types')
    .select('available_quantity')
    .in('event_id', events.map(e => e.id))

  const availableTickets = allTicketTypes?.reduce((sum, tt) => sum + tt.available_quantity, 0) || 0

  // Calculate stats
  const totalEvents = events.length
  const publishedEvents = events.filter(e => e.status === 'published').length
  const draftEvents = events.filter(e => e.status === 'draft').length

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's what's happening with your events.
            </p>
          </div>
          <Button asChild>
            <Link href={`/${businessSlug}/dashboard/events/new`}>Create Event</Link>
          </Button>
        </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              {publishedEvents} published, {draftEvents} draft
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_tickets_sold}</div>
            <p className="text-xs text-muted-foreground">
              {availableTickets} still available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tables Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_table_bookings}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(analytics.total_table_revenue)} revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.total_revenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.total_orders} orders, {analytics.total_table_bookings} tables
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Your latest event listings</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${businessSlug}/dashboard/events`}>View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No events created yet
              </p>
              <Button asChild>
                <Link href={`/${businessSlug}/dashboard/events/new`}>Create Your First Event</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {events.slice(0, 5).map((event) => (
                <EventCardHover
                  key={event.id}
                  event={{
                    ...event,
                    available_tickets: getEventAvailableTickets(event),
                    total_tickets: getEventTotalTickets(event),
                  }}
                  businessId={business.id}
                  businessSlug={businessSlug}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
