import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/server'
import {
  DollarSign,
  TrendingUp,
  Ticket,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Users,
  Armchair,
  AlertCircle
} from 'lucide-react'

interface BusinessReport {
  id: string
  name: string
  slug: string
  is_active: boolean
  stripe_onboarding_complete: boolean
  created_at: string
  // Subscription data
  subscription_status: string | null
  subscription_current_period_end: string | null
  subscription_cancel_at_period_end: boolean
  subscription_revenue_collected: number
  // Event data
  total_events: number
  published_events: number
  // Ticket sales data
  total_orders: number
  total_tickets_sold: number
  ticket_gross_revenue: number
  ticket_platform_fees: number
  ticket_stripe_fees: number
  // Table booking data
  total_table_bookings: number
  table_booking_revenue: number
  // Combined metrics
  total_revenue: number
  total_platform_fees: number
  net_to_business: number
  avg_order_value: number
  last_activity_date: string | null
}

interface SubscriptionSummary {
  total_subscribers: number
  active_subscribers: number
  trialing_subscribers: number
  past_due_subscribers: number
  canceled_subscribers: number
  monthly_recurring_revenue: number
  total_subscription_revenue_collected: number
  subscription_monthly_fee: number
}

interface TableServiceSummary {
  total_bookings: number
  confirmed_bookings: number
  total_revenue: number
  businesses_with_table_service: number
}

interface PlatformSummary {
  total_businesses: number
  active_businesses: number
  businesses_with_sales: number
  total_events: number
  // Ticket metrics
  total_orders: number
  total_tickets_sold: number
  ticket_gross_revenue: number
  total_platform_fees: number
  total_stripe_fees: number
  avg_platform_fee_per_order: number
  // Table metrics
  table_booking_revenue: number
  total_table_bookings: number
  // Combined
  total_gross_revenue: number
  total_net_to_businesses: number
}

async function getPlatformReports(): Promise<{
  businesses: BusinessReport[],
  summary: PlatformSummary,
  subscriptionSummary: SubscriptionSummary,
  tableServiceSummary: TableServiceSummary
}> {
  const supabase = await createClient()

  // Get all businesses with subscription data
  const { data: businesses, error: businessError } = await supabase
    .from('businesses')
    .select(`
      id, name, slug, is_active, stripe_onboarding_complete, created_at,
      subscription_status, subscription_current_period_end, subscription_cancel_at_period_end,
      stripe_customer_id
    `)
    .order('created_at', { ascending: false })

  if (businessError) {
    console.error('Error fetching businesses:', businessError)
    return {
      businesses: [],
      summary: getEmptySummary(),
      subscriptionSummary: getEmptySubscriptionSummary(),
      tableServiceSummary: getEmptyTableServiceSummary()
    }
  }

  // Get subscription settings for MRR calculation
  const { data: platformSettings } = await supabase
    .from('platform_settings')
    .select('subscription_monthly_fee')
    .limit(1)
    .single()

  const subscriptionMonthlyFee = platformSettings?.subscription_monthly_fee || 49

  // Get all events grouped by business
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, business_id, status')

  if (eventsError) {
    console.error('Error fetching events:', eventsError)
  }

  // Get all completed orders with their fees
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      event_id,
      quantity,
      total,
      platform_fee,
      stripe_fee,
      status,
      created_at,
      events!inner (
        business_id
      )
    `)
    .eq('status', 'completed')

  if (ordersError) {
    console.error('Error fetching orders:', ordersError)
  }

  // Get all confirmed table bookings
  const { data: tableBookings, error: tableBookingsError } = await supabase
    .from('table_bookings')
    .select(`
      id,
      event_id,
      amount,
      status,
      created_at,
      events!inner (
        business_id
      )
    `)
    .in('status', ['confirmed', 'arrived', 'completed'])

  if (tableBookingsError) {
    console.error('Error fetching table bookings:', tableBookingsError)
  }

  // Get subscription invoice payments from webhook events
  const { data: invoiceEvents, error: invoiceEventsError } = await supabase
    .from('stripe_webhook_events')
    .select('payload')
    .eq('event_type', 'invoice.payment_succeeded')

  if (invoiceEventsError) {
    console.error('Error fetching invoice events:', invoiceEventsError)
  }

  // Build subscription revenue by customer ID
  const subscriptionRevenueByCustomer = new Map<string, number>()
  for (const event of invoiceEvents || []) {
    const payload = event.payload as any
    // Only count subscription invoices
    if (payload?.subscription && payload?.customer && payload?.amount_paid) {
      const customerId = payload.customer
      const amountPaid = (payload.amount_paid || 0) / 100 // Convert from cents
      const current = subscriptionRevenueByCustomer.get(customerId) || 0
      subscriptionRevenueByCustomer.set(customerId, current + amountPaid)
    }
  }

  // Build event counts by business
  const eventsByBusiness = new Map<string, { total: number, published: number }>()
  for (const event of events || []) {
    const current = eventsByBusiness.get(event.business_id) || { total: 0, published: 0 }
    current.total++
    if (event.status === 'published') current.published++
    eventsByBusiness.set(event.business_id, current)
  }

  // Build order stats by business
  const orderStatsByBusiness = new Map<string, {
    orders: number
    tickets: number
    gross: number
    platformFees: number
    stripeFees: number
    lastOrderDate: string | null
  }>()

  for (const order of orders || []) {
    const businessId = (order.events as any)?.business_id
    if (!businessId) continue

    const current = orderStatsByBusiness.get(businessId) || {
      orders: 0,
      tickets: 0,
      gross: 0,
      platformFees: 0,
      stripeFees: 0,
      lastOrderDate: null
    }

    current.orders++
    current.tickets += order.quantity || 0
    current.gross += parseFloat(order.total?.toString() || '0')
    current.platformFees += parseFloat(order.platform_fee?.toString() || '0')
    current.stripeFees += parseFloat(order.stripe_fee?.toString() || '0')

    if (!current.lastOrderDate || order.created_at > current.lastOrderDate) {
      current.lastOrderDate = order.created_at
    }

    orderStatsByBusiness.set(businessId, current)
  }

  // Build table booking stats by business
  const tableBookingsByBusiness = new Map<string, {
    bookings: number
    revenue: number
    lastBookingDate: string | null
  }>()

  for (const booking of tableBookings || []) {
    const businessId = (booking.events as any)?.business_id
    if (!businessId) continue

    const current = tableBookingsByBusiness.get(businessId) || {
      bookings: 0,
      revenue: 0,
      lastBookingDate: null
    }

    current.bookings++
    current.revenue += parseFloat(booking.amount?.toString() || '0')

    if (!current.lastBookingDate || booking.created_at > current.lastBookingDate) {
      current.lastBookingDate = booking.created_at
    }

    tableBookingsByBusiness.set(businessId, current)
  }

  // Build business reports
  const businessReports: BusinessReport[] = (businesses || []).map(business => {
    const eventStats = eventsByBusiness.get(business.id) || { total: 0, published: 0 }
    const orderStats = orderStatsByBusiness.get(business.id) || {
      orders: 0,
      tickets: 0,
      gross: 0,
      platformFees: 0,
      stripeFees: 0,
      lastOrderDate: null
    }
    const tableStats = tableBookingsByBusiness.get(business.id) || {
      bookings: 0,
      revenue: 0,
      lastBookingDate: null
    }

    // Get subscription revenue for this business
    const subscriptionRevenue = business.stripe_customer_id
      ? subscriptionRevenueByCustomer.get(business.stripe_customer_id) || 0
      : 0

    // Get the most recent activity date
    let lastActivityDate: string | null = null
    if (orderStats.lastOrderDate && tableStats.lastBookingDate) {
      lastActivityDate = orderStats.lastOrderDate > tableStats.lastBookingDate
        ? orderStats.lastOrderDate
        : tableStats.lastBookingDate
    } else {
      lastActivityDate = orderStats.lastOrderDate || tableStats.lastBookingDate
    }

    const totalRevenue = orderStats.gross + tableStats.revenue
    const totalPlatformFees = orderStats.platformFees
    const netToBusiness = totalRevenue - orderStats.platformFees - orderStats.stripeFees

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      is_active: business.is_active,
      stripe_onboarding_complete: business.stripe_onboarding_complete,
      created_at: business.created_at,
      subscription_status: business.subscription_status,
      subscription_current_period_end: business.subscription_current_period_end,
      subscription_cancel_at_period_end: business.subscription_cancel_at_period_end || false,
      subscription_revenue_collected: subscriptionRevenue,
      total_events: eventStats.total,
      published_events: eventStats.published,
      total_orders: orderStats.orders,
      total_tickets_sold: orderStats.tickets,
      ticket_gross_revenue: orderStats.gross,
      ticket_platform_fees: orderStats.platformFees,
      ticket_stripe_fees: orderStats.stripeFees,
      total_table_bookings: tableStats.bookings,
      table_booking_revenue: tableStats.revenue,
      total_revenue: totalRevenue,
      total_platform_fees: totalPlatformFees,
      net_to_business: netToBusiness,
      avg_order_value: orderStats.orders > 0 ? orderStats.gross / orderStats.orders : 0,
      last_activity_date: lastActivityDate
    }
  })

  // Calculate subscription summary
  const subscriptionSummary: SubscriptionSummary = {
    total_subscribers: businesses?.filter(b => b.subscription_status).length || 0,
    active_subscribers: businesses?.filter(b => b.subscription_status === 'active').length || 0,
    trialing_subscribers: businesses?.filter(b => b.subscription_status === 'trialing').length || 0,
    past_due_subscribers: businesses?.filter(b => b.subscription_status === 'past_due').length || 0,
    canceled_subscribers: businesses?.filter(b => b.subscription_status === 'canceled').length || 0,
    monthly_recurring_revenue: (businesses?.filter(b => b.subscription_status === 'active').length || 0) * subscriptionMonthlyFee,
    total_subscription_revenue_collected: businessReports.reduce((sum, b) => sum + b.subscription_revenue_collected, 0),
    subscription_monthly_fee: subscriptionMonthlyFee
  }

  // Calculate table service summary
  const tableServiceSummary: TableServiceSummary = {
    total_bookings: tableBookings?.length || 0,
    confirmed_bookings: tableBookings?.filter(b => b.status === 'confirmed').length || 0,
    total_revenue: businessReports.reduce((sum, b) => sum + b.table_booking_revenue, 0),
    businesses_with_table_service: Array.from(tableBookingsByBusiness.keys()).length
  }

  // Calculate platform summary
  const summary: PlatformSummary = {
    total_businesses: businesses?.length || 0,
    active_businesses: businesses?.filter(b => b.is_active).length || 0,
    businesses_with_sales: new Set([
      ...Array.from(orderStatsByBusiness.keys()),
      ...Array.from(tableBookingsByBusiness.keys())
    ]).size,
    total_events: events?.length || 0,
    total_orders: businessReports.reduce((sum, b) => sum + b.total_orders, 0),
    total_tickets_sold: businessReports.reduce((sum, b) => sum + b.total_tickets_sold, 0),
    ticket_gross_revenue: businessReports.reduce((sum, b) => sum + b.ticket_gross_revenue, 0),
    total_platform_fees: businessReports.reduce((sum, b) => sum + b.ticket_platform_fees, 0),
    total_stripe_fees: businessReports.reduce((sum, b) => sum + b.ticket_stripe_fees, 0),
    avg_platform_fee_per_order: 0,
    table_booking_revenue: businessReports.reduce((sum, b) => sum + b.table_booking_revenue, 0),
    total_table_bookings: businessReports.reduce((sum, b) => sum + b.total_table_bookings, 0),
    total_gross_revenue: businessReports.reduce((sum, b) => sum + b.total_revenue, 0),
    total_net_to_businesses: businessReports.reduce((sum, b) => sum + b.net_to_business, 0)
  }

  summary.avg_platform_fee_per_order = summary.total_orders > 0
    ? summary.total_platform_fees / summary.total_orders
    : 0

  // Sort by total platform fees collected (most valuable first)
  businessReports.sort((a, b) => b.total_platform_fees - a.total_platform_fees)

  return { businesses: businessReports, summary, subscriptionSummary, tableServiceSummary }
}

function getEmptySummary(): PlatformSummary {
  return {
    total_businesses: 0,
    active_businesses: 0,
    businesses_with_sales: 0,
    total_events: 0,
    total_orders: 0,
    total_tickets_sold: 0,
    ticket_gross_revenue: 0,
    total_platform_fees: 0,
    total_stripe_fees: 0,
    avg_platform_fee_per_order: 0,
    table_booking_revenue: 0,
    total_table_bookings: 0,
    total_gross_revenue: 0,
    total_net_to_businesses: 0
  }
}

function getEmptySubscriptionSummary(): SubscriptionSummary {
  return {
    total_subscribers: 0,
    active_subscribers: 0,
    trialing_subscribers: 0,
    past_due_subscribers: 0,
    canceled_subscribers: 0,
    monthly_recurring_revenue: 0,
    total_subscription_revenue_collected: 0,
    subscription_monthly_fee: 49
  }
}

function getEmptyTableServiceSummary(): TableServiceSummary {
  return {
    total_bookings: 0,
    confirmed_bookings: 0,
    total_revenue: 0,
    businesses_with_table_service: 0
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  })
}

function getSubscriptionBadge(status: string | null, cancelAtPeriodEnd: boolean) {
  if (!status) {
    return <Badge variant="outline" className="text-xs">No Sub</Badge>
  }

  if (cancelAtPeriodEnd && (status === 'active' || status === 'trialing')) {
    return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/50 text-xs">Canceling</Badge>
  }

  switch (status) {
    case 'active':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/50 text-xs">Active</Badge>
    case 'trialing':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/50 text-xs">Trial</Badge>
    case 'past_due':
      return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/50 text-xs">Past Due</Badge>
    case 'canceled':
      return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/50 text-xs">Canceled</Badge>
    case 'incomplete':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/50 text-xs">Incomplete</Badge>
    case 'unpaid':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/50 text-xs">Unpaid</Badge>
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>
  }
}

export default async function ReportsPage() {
  const { businesses, summary, subscriptionSummary, tableServiceSummary } = await getPlatformReports()

  // Calculate total platform revenue (subscription MRR + transaction fees)
  const totalPlatformRevenue = subscriptionSummary.monthly_recurring_revenue + summary.total_platform_fees

  return (
    <AdminDashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics for all businesses on the platform
          </p>
        </div>

        {/* Platform Revenue Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Platform Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPlatformRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Subscriptions + Transaction Fees
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(subscriptionSummary.monthly_recurring_revenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                {subscriptionSummary.active_subscribers} active @ {formatCurrency(subscriptionSummary.subscription_monthly_fee)}/mo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transaction Fees</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_platform_fees)}</div>
              <p className="text-xs text-muted-foreground">
                From tickets & deposits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_gross_revenue)}</div>
              <p className="text-xs text-muted-foreground">
                Total processed through platform
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription & Business Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionSummary.active_subscribers}</div>
              <p className="text-xs text-muted-foreground">
                {subscriptionSummary.trialing_subscribers} trialing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_tickets_sold.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_orders.toLocaleString()} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Table Reservations</CardTitle>
              <Armchair className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tableServiceSummary.total_bookings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(tableServiceSummary.total_revenue)} revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Businesses</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.businesses_with_sales}</div>
              <p className="text-xs text-muted-foreground">
                with activity / {summary.total_businesses} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Health */}
        {subscriptionSummary.total_subscribers > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription Health</CardTitle>
              <CardDescription>
                Breakdown of subscription statuses across all businesses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{subscriptionSummary.active_subscribers}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-600">{subscriptionSummary.trialing_subscribers}</div>
                  <div className="text-sm text-muted-foreground">Trialing</div>
                </div>
                <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="text-2xl font-bold text-orange-600">{subscriptionSummary.past_due_subscribers}</div>
                  <div className="text-sm text-muted-foreground">Past Due</div>
                </div>
                <div className="text-center p-4 bg-gray-500/10 rounded-lg border border-gray-500/20">
                  <div className="text-2xl font-bold text-gray-600">{subscriptionSummary.canceled_subscribers}</div>
                  <div className="text-sm text-muted-foreground">Canceled</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg border">
                  <div className="text-2xl font-bold">{summary.total_businesses - subscriptionSummary.total_subscribers}</div>
                  <div className="text-sm text-muted-foreground">No Subscription</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Fee / Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(summary.avg_platform_fee_per_order)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stripe Fees (Cost)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-muted-foreground">{formatCurrency(summary.total_stripe_fees)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net to Businesses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(summary.total_net_to_businesses)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{summary.total_events}</div>
            </CardContent>
          </Card>
        </div>

        {/* Business Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Business Performance</CardTitle>
            <CardDescription>
              Detailed breakdown of each business&apos;s activity and revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Businesses</TabsTrigger>
                <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
                <TabsTrigger value="active">With Sales</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <BusinessTable businesses={businesses} />
              </TabsContent>

              <TabsContent value="subscribers">
                <BusinessTable businesses={businesses.filter(b => b.subscription_status)} />
              </TabsContent>

              <TabsContent value="active">
                <BusinessTable businesses={businesses.filter(b => b.total_orders > 0 || b.total_table_bookings > 0)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Top Performers */}
        {businesses.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                  Top Revenue Generators
                </CardTitle>
                <CardDescription>
                  Businesses generating the most platform fees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {businesses
                    .filter(b => b.total_platform_fees > 0)
                    .slice(0, 5)
                    .map((business, index) => (
                      <div key={business.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{business.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {business.total_orders} orders, {business.total_table_bookings} tables
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            {formatCurrency(business.total_platform_fees)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(business.total_revenue)} gross
                          </div>
                        </div>
                      </div>
                    ))}
                  {businesses.filter(b => b.total_platform_fees > 0).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No revenue data yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Recently Active
                </CardTitle>
                <CardDescription>
                  Businesses with recent sales activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {businesses
                    .filter(b => b.last_activity_date)
                    .sort((a, b) => new Date(b.last_activity_date!).getTime() - new Date(a.last_activity_date!).getTime())
                    .slice(0, 5)
                    .map((business) => (
                      <div key={business.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{business.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Last activity: {formatDate(business.last_activity_date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {business.total_tickets_sold} tickets
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {business.total_table_bookings} tables
                          </div>
                        </div>
                      </div>
                    ))}
                  {businesses.filter(b => b.last_activity_date).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No sales activity yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Needs Attention */}
        {(subscriptionSummary.past_due_subscribers > 0 ||
          businesses.some(b => b.subscription_status === 'unpaid') ||
          businesses.some(b => b.subscription_status === 'incomplete') ||
          businesses.some(b => b.subscription_status === 'canceled' && b.total_revenue > 0) ||
          businesses.some(b => !b.stripe_onboarding_complete && b.is_active) ||
          businesses.some(b => !b.is_active && b.total_events > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Needs Attention
              </CardTitle>
              <CardDescription>
                Businesses that may need follow-up
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Unpaid Subscriptions - Most Critical */}
                {businesses
                  .filter(b => b.subscription_status === 'unpaid')
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-red-600">Subscription unpaid - multiple failed payments</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(business.total_revenue)} lifetime revenue
                      </div>
                    </div>
                  ))}

                {/* Past Due Subscriptions */}
                {businesses
                  .filter(b => b.subscription_status === 'past_due')
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-orange-600">Subscription payment past due</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(business.total_revenue)} lifetime revenue
                      </div>
                    </div>
                  ))}

                {/* Incomplete Subscriptions */}
                {businesses
                  .filter(b => b.subscription_status === 'incomplete')
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-orange-600">Subscription setup incomplete</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Joined {formatDateShort(business.created_at)}
                      </div>
                    </div>
                  ))}

                {/* Canceled Subscriptions with Revenue (Churned Customers) */}
                {businesses
                  .filter(b => b.subscription_status === 'canceled' && b.total_revenue > 0)
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-gray-600">Subscription canceled - had activity</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(business.total_revenue)} lifetime revenue
                      </div>
                    </div>
                  ))}

                {/* Incomplete Stripe Onboarding */}
                {businesses
                  .filter(b => !b.stripe_onboarding_complete && b.is_active)
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-yellow-600">Stripe onboarding incomplete</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Joined {formatDateShort(business.created_at)}
                      </div>
                    </div>
                  ))}

                {/* Inactive with Events */}
                {businesses
                  .filter(b => !b.is_active && b.total_events > 0)
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Inactive with {business.total_events} events
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(business.total_revenue)} lifetime
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminDashboardLayout>
  )
}

function BusinessTable({ businesses }: { businesses: BusinessReport[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead className="text-center">Subscription</TableHead>
            <TableHead className="text-center">Events</TableHead>
            <TableHead className="text-center">Tickets</TableHead>
            <TableHead className="text-center">Tables</TableHead>
            <TableHead className="text-right">Gross Revenue</TableHead>
            <TableHead className="text-right text-green-600">Platform Fees</TableHead>
            <TableHead className="text-right text-purple-600">Sub Revenue</TableHead>
            <TableHead className="text-right">Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No businesses found
              </TableCell>
            </TableRow>
          ) : (
            businesses.map((business) => (
              <TableRow key={business.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{business.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      /{business.slug}
                      {!business.stripe_onboarding_complete && (
                        <Badge variant="outline" className="text-xs">No Stripe</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {getSubscriptionBadge(business.subscription_status, business.subscription_cancel_at_period_end)}
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">{business.published_events}</div>
                    <div className="text-xs text-muted-foreground">{business.total_events} total</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">{business.total_tickets_sold.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{business.total_orders} orders</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">{business.total_table_bookings}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(business.table_booking_revenue)}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(business.total_revenue)}
                </TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {formatCurrency(business.total_platform_fees)}
                </TableCell>
                <TableCell className="text-right font-medium text-purple-600">
                  {business.subscription_revenue_collected > 0
                    ? formatCurrency(business.subscription_revenue_collected)
                    : '-'}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDate(business.last_activity_date)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
