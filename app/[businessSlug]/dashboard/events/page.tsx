import { getEventsByBusinessId, getEventPriceDisplay, getEventTicketSales, getEventAvailableTickets } from '@/lib/db/events'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getBusinessAnalytics } from '@/lib/db/analytics'
import { EventsViewToggle } from '@/components/business/events-view-toggle'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { redirect } from 'next/navigation'
import { type BusinessRole } from '@/lib/auth/roles'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface EventsPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function EventsPage({ params }: EventsPageProps) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)

  // Get user session and role
  const session = await verifyBusinessAccess(business.id)
  if (!session) {
    redirect(`/${businessSlug}/login`)
  }
  const userRole = session.role as BusinessRole

  // Fetch events and analytics in parallel
  const [events, analytics] = await Promise.all([
    getEventsByBusinessId(business.id),
    getBusinessAnalytics(business.id)
  ])

  // Create a map of event analytics for quick lookup
  const eventAnalyticsMap = new Map(
    analytics.events.map(e => [e.event_id, e])
  )

  // Fetch ticket sales data for all events
  const eventsWithSales = await Promise.all(
    events.map(async (event) => {
      const salesData = await getEventTicketSales(event.id)
      const availableTickets = getEventAvailableTickets(event)
      const eventAnalytics = eventAnalyticsMap.get(event.id)

      return {
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        event_time: event.event_time,
        status: event.status,
        location: event.location,
        image_url: event.image_url,
        table_service_enabled: (event as any).table_service_enabled || false,
        salesData: {
          totalSold: salesData.totalSold,
          availableTickets,
          breakdown: salesData.breakdown,
          grossRevenue: eventAnalytics?.ticket_gross_revenue || 0,
          netRevenue: eventAnalytics?.ticket_net_revenue || 0,
          fees: eventAnalytics?.ticket_fees || 0,
        },
        tableData: eventAnalytics ? {
          booked: eventAnalytics.total_table_bookings,
          total: 0,
          revenue: eventAnalytics.table_revenue,
        } : undefined,
        priceDisplay: getEventPriceDisplay(event)
      }
    })
  )

  // Business default location for new events
  const defaultLocation = {
    address: business.address,
    latitude: business.address_latitude,
    longitude: business.address_longitude,
    placeId: business.google_place_id,
  }

  return (
    <EventsViewToggle
      events={eventsWithSales}
      businessSlug={businessSlug}
      businessId={business.id}
      defaultLocation={defaultLocation}
      defaultTimezone={business.default_timezone || 'America/Los_Angeles'}
      userRole={userRole}
    />
  )
}
