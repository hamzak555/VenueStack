import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { DollarSign, TrendingUp, Ticket, Building2, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface BusinessReport {
  id: string
  name: string
  slug: string
  is_active: boolean
  stripe_onboarding_complete: boolean
  created_at: string
  total_events: number
  published_events: number
  total_orders: number
  total_tickets_sold: number
  gross_revenue: number
  platform_fees_collected: number
  stripe_fees: number
  net_to_business: number
  avg_order_value: number
  last_order_date: string | null
}

interface PlatformSummary {
  total_businesses: number
  active_businesses: number
  businesses_with_sales: number
  total_events: number
  total_orders: number
  total_tickets_sold: number
  gross_revenue: number
  total_platform_fees: number
  total_stripe_fees: number
  avg_platform_fee_per_order: number
}

async function getPlatformReports(): Promise<{ businesses: BusinessReport[], summary: PlatformSummary }> {
  const supabase = await createClient()

  // Get all businesses
  const { data: businesses, error: businessError } = await supabase
    .from('businesses')
    .select('id, name, slug, is_active, stripe_onboarding_complete, created_at')
    .order('created_at', { ascending: false })

  if (businessError) {
    console.error('Error fetching businesses:', businessError)
    return { businesses: [], summary: getEmptySummary() }
  }

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

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      is_active: business.is_active,
      stripe_onboarding_complete: business.stripe_onboarding_complete,
      created_at: business.created_at,
      total_events: eventStats.total,
      published_events: eventStats.published,
      total_orders: orderStats.orders,
      total_tickets_sold: orderStats.tickets,
      gross_revenue: orderStats.gross,
      platform_fees_collected: orderStats.platformFees,
      stripe_fees: orderStats.stripeFees,
      net_to_business: orderStats.gross - orderStats.platformFees - orderStats.stripeFees,
      avg_order_value: orderStats.orders > 0 ? orderStats.gross / orderStats.orders : 0,
      last_order_date: orderStats.lastOrderDate
    }
  })

  // Calculate platform summary
  const summary: PlatformSummary = {
    total_businesses: businesses?.length || 0,
    active_businesses: businesses?.filter(b => b.is_active).length || 0,
    businesses_with_sales: Array.from(orderStatsByBusiness.keys()).length,
    total_events: events?.length || 0,
    total_orders: businessReports.reduce((sum, b) => sum + b.total_orders, 0),
    total_tickets_sold: businessReports.reduce((sum, b) => sum + b.total_tickets_sold, 0),
    gross_revenue: businessReports.reduce((sum, b) => sum + b.gross_revenue, 0),
    total_platform_fees: businessReports.reduce((sum, b) => sum + b.platform_fees_collected, 0),
    total_stripe_fees: businessReports.reduce((sum, b) => sum + b.stripe_fees, 0),
    avg_platform_fee_per_order: 0
  }

  summary.avg_platform_fee_per_order = summary.total_orders > 0
    ? summary.total_platform_fees / summary.total_orders
    : 0

  // Sort by platform fees collected (most valuable first)
  businessReports.sort((a, b) => b.platform_fees_collected - a.platform_fees_collected)

  return { businesses: businessReports, summary }
}

function getEmptySummary(): PlatformSummary {
  return {
    total_businesses: 0,
    active_businesses: 0,
    businesses_with_sales: 0,
    total_events: 0,
    total_orders: 0,
    total_tickets_sold: 0,
    gross_revenue: 0,
    total_platform_fees: 0,
    total_stripe_fees: 0,
    avg_platform_fee_per_order: 0
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

export default async function ReportsPage() {
  const { businesses, summary } = await getPlatformReports()

  return (
    <AdminDashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics for all businesses on the platform
          </p>
        </div>

        {/* Platform Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.total_platform_fees)}
              </div>
              <p className="text-xs text-muted-foreground">
                Your earnings from platform fees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.gross_revenue)}</div>
              <p className="text-xs text-muted-foreground">
                Total processed through platform
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
              <CardTitle className="text-sm font-medium">Active Businesses</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.businesses_with_sales}</div>
              <p className="text-xs text-muted-foreground">
                {summary.active_businesses} total active / {summary.total_businesses} registered
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Platform Fee / Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(summary.avg_platform_fee_per_order)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stripe Fees (Paid by platform)</CardTitle>
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
              <div className="text-xl font-bold">
                {formatCurrency(summary.gross_revenue - summary.total_platform_fees - summary.total_stripe_fees)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Business Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Business Performance</CardTitle>
            <CardDescription>
              Detailed breakdown of each business&apos;s contribution to platform revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Events</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="text-center">Tickets</TableHead>
                    <TableHead className="text-right">Gross Revenue</TableHead>
                    <TableHead className="text-right text-green-600">Platform Fees</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                    <TableHead className="text-right">Last Sale</TableHead>
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
                            <div className="text-xs text-muted-foreground">/{business.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={business.is_active ? 'default' : 'secondary'}>
                              {business.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {!business.stripe_onboarding_complete && (
                              <Badge variant="outline" className="text-xs">
                                No Stripe
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div>
                            <div className="font-medium">{business.published_events}</div>
                            <div className="text-xs text-muted-foreground">{business.total_events} total</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {business.total_orders.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {business.total_tickets_sold.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(business.gross_revenue)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(business.platform_fees_collected)}
                        </TableCell>
                        <TableCell className="text-right">
                          {business.total_orders > 0 ? formatCurrency(business.avg_order_value) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDate(business.last_order_date)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                    .filter(b => b.platform_fees_collected > 0)
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
                              {business.total_orders} orders
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            {formatCurrency(business.platform_fees_collected)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(business.gross_revenue)} gross
                          </div>
                        </div>
                      </div>
                    ))}
                  {businesses.filter(b => b.platform_fees_collected > 0).length === 0 && (
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
                    .filter(b => b.last_order_date)
                    .sort((a, b) => new Date(b.last_order_date!).getTime() - new Date(a.last_order_date!).getTime())
                    .slice(0, 5)
                    .map((business) => (
                      <div key={business.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{business.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Last sale: {formatDate(business.last_order_date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {business.total_tickets_sold} tickets
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(business.platform_fees_collected)} fees
                          </div>
                        </div>
                      </div>
                    ))}
                  {businesses.filter(b => b.last_order_date).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No sales activity yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Businesses Needing Attention */}
        {businesses.some(b => !b.stripe_onboarding_complete || (!b.is_active && b.total_events > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-orange-600" />
                Needs Attention
              </CardTitle>
              <CardDescription>
                Businesses that may need follow-up
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {businesses
                  .filter(b => !b.stripe_onboarding_complete && b.is_active)
                  .map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-sm text-orange-600">Stripe onboarding incomplete</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Joined {formatDateShort(business.created_at)}
                      </div>
                    </div>
                  ))}
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
                        {formatCurrency(business.gross_revenue)} lifetime
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
