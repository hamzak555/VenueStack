import { getEventsByBusinessId } from '@/lib/db/events'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getBusinessAnalytics } from '@/lib/db/analytics'
import { getTrackingLinkAnalytics } from '@/lib/db/tracking-links'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { parseDateRangeParams } from '@/lib/utils/date-range'
import { createClient } from '@/lib/supabase/server'
import { Ticket, Armchair, DollarSign, TrendingUp, Receipt, MinusCircle } from 'lucide-react'
import { EventPerformanceTable } from '@/components/business/event-performance-table'
import { TrackingLinkAnalytics } from '@/components/business/tracking-link-analytics'
import { ReportsDateFilter } from '@/components/business/reports-date-filter'

// Force dynamic rendering to always show current data
export const dynamic = 'force-dynamic'

interface ReportsPageProps {
  params: Promise<{
    businessSlug: string
  }>
  searchParams: Promise<{
    preset?: string
    from?: string
    to?: string
  }>
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { businessSlug } = await params
  const resolvedSearchParams = await searchParams

  const business = await getBusinessBySlug(businessSlug)
  const events = await getEventsByBusinessId(business.id)

  // Parse date range from URL params
  const dateRange = parseDateRangeParams(resolvedSearchParams)

  const analytics = await getBusinessAnalytics(business.id, dateRange)
  const trackingAnalytics = await getTrackingLinkAnalytics(business.id, dateRange)

  // Get ticket types for all events to calculate available tickets
  const supabase = await createClient()
  const { data: allTicketTypes } = await supabase
    .from('ticket_types')
    .select('event_id, total_quantity, available_quantity')
    .in('event_id', events.map(e => e.id))

  // Create a map of event_id to total available tickets
  const availableTicketsMap = new Map<string, number>()
  if (allTicketTypes) {
    for (const tt of allTicketTypes) {
      const current = availableTicketsMap.get(tt.event_id) || 0
      availableTicketsMap.set(tt.event_id, current + tt.available_quantity)
    }
  }

  const totalTicketsAvailable = Array.from(availableTicketsMap.values()).reduce((sum, n) => sum + n, 0)
  const publishedEvents = events.filter(e => e.status === 'published')
  const upcomingEvents = events.filter(e => new Date(e.event_date) > new Date())

  // Calculate totals
  const totalGrossRevenue = analytics.ticket_gross_revenue + analytics.total_table_revenue
  const totalNetRevenue = analytics.ticket_net_revenue + analytics.total_table_revenue
  const totalFees = analytics.ticket_fees

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            View performance metrics and sales data for your events
          </p>
        </div>
        <ReportsDateFilter />
      </div>

      {/* Revenue Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-600">Net Revenue</p>
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalNetRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Amount you receive
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Gross Revenue</p>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalGrossRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Total amount collected
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-medium text-muted-foreground">Processing Fees</p>
            </div>
            <div className="text-2xl font-bold text-orange-500">{formatCurrency(totalFees)}</div>
            <p className="text-xs text-muted-foreground">
              Platform + Stripe fees
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Tax Collected</p>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(analytics.total_tax_collected)}</div>
            <p className="text-xs text-muted-foreground">
              Included in gross revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Sales vs Table Service Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Ticket Sales Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Ticket Sales</CardTitle>
            </div>
            <CardDescription>Revenue from ticket purchases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tickets Sold</span>
                <span className="font-medium">{analytics.total_tickets_sold}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available</span>
                <span className="font-medium">{totalTicketsAvailable}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Gross Revenue</span>
                  <span className="font-medium">{formatCurrency(analytics.ticket_gross_revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Processing Fees</span>
                  <span className="font-medium text-orange-500">{formatCurrency(analytics.ticket_fees)}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">You Receive</span>
                  <span className="font-bold text-green-600">{formatCurrency(analytics.ticket_net_revenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Service Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Table Service</CardTitle>
            </div>
            <CardDescription>Revenue from table bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tables Booked</span>
                <span className="font-medium">{analytics.total_table_bookings}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Orders</span>
                <span className="font-medium">{analytics.total_table_bookings}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Revenue Collected</span>
                  <span className="font-medium">{formatCurrency(analytics.total_table_revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Processing Fees</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">You Receive</span>
                  <span className="font-bold text-green-600">{formatCurrency(analytics.total_table_revenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
            <div className="text-2xl font-bold">{analytics.total_orders + analytics.total_table_bookings}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.total_orders} ticket + {analytics.total_table_bookings} table
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-sm font-medium text-muted-foreground">Total Events</p>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">
              {publishedEvents.length} published
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-sm font-medium text-muted-foreground">Upcoming Events</p>
            <div className="text-2xl font-bold">{upcomingEvents.length}</div>
            <p className="text-xs text-muted-foreground">
              Future events
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-sm font-medium text-muted-foreground">Avg Order Value</p>
            <div className="text-2xl font-bold">
              {analytics.total_orders > 0
                ? formatCurrency(analytics.ticket_gross_revenue / analytics.total_orders)
                : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per ticket order
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Event Performance Table */}
      <EventPerformanceTable
        events={events.map(e => ({
          id: e.id,
          title: e.title,
          status: e.status,
          event_date: e.event_date,
          image_url: e.image_url,
        }))}
        eventAnalytics={analytics.events}
      />

      {/* Tracking Link Performance */}
      <TrackingLinkAnalytics analytics={trackingAnalytics} />
    </div>
  )
}
