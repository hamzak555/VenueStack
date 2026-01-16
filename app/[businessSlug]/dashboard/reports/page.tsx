import { getEventsByBusinessId } from '@/lib/db/events'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireSectionAccess } from '@/lib/auth/role-guard'
import { getBusinessAnalytics } from '@/lib/db/analytics'
import { getTrackingLinkAnalytics } from '@/lib/db/tracking-links'
import { getPageViewAnalytics } from '@/lib/db/page-views'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { parseDateRangeParams } from '@/lib/utils/date-range'
import { createClient } from '@/lib/supabase/server'
import { Ticket, Armchair, DollarSign, TrendingUp, Receipt, RotateCcw, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EventPerformanceTable } from '@/components/business/event-performance-table'
import { PageViewsChart } from '@/components/business/page-views-chart'
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

  // Protect page - only owner, manager, accounting can access reports
  await requireSectionAccess(business.id, businessSlug, 'reports')

  const events = await getEventsByBusinessId(business.id)

  // Parse date range from URL params
  const dateRange = parseDateRangeParams(resolvedSearchParams)

  const analytics = await getBusinessAnalytics(business.id, dateRange)
  const trackingAnalytics = await getTrackingLinkAnalytics(business.id, dateRange)
  const pageViewStats = await getPageViewAnalytics(business.id, dateRange)

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

  // Use fee payer data stored at time of each transaction (from analytics)
  // This ensures historical accuracy even if business changes their settings later
  const customerPaidTicketStripeFees = analytics.ticket_customer_paid_stripe_fees
  const customerPaidTicketPlatformFees = analytics.ticket_customer_paid_platform_fees
  const customerPaidTicketFees = customerPaidTicketStripeFees + customerPaidTicketPlatformFees

  const customerPaidTableStripeFees = analytics.table_customer_paid_stripe_fees
  const customerPaidTablePlatformFees = analytics.table_customer_paid_platform_fees
  const customerPaidTableFees = customerPaidTableStripeFees + customerPaidTablePlatformFees

  const businessPaidTicketStripeFees = analytics.ticket_business_paid_stripe_fees
  const businessPaidTicketPlatformFees = analytics.ticket_business_paid_platform_fees
  const businessPaidTicketFees = businessPaidTicketStripeFees + businessPaidTicketPlatformFees

  const businessPaidTableStripeFees = analytics.table_business_paid_stripe_fees
  const businessPaidTablePlatformFees = analytics.table_business_paid_platform_fees
  const businessPaidTableFees = businessPaidTableStripeFees + businessPaidTablePlatformFees

  // Calculate totals
  // For tickets: Subtotal = gross - tax - customer-paid fees (fees included in gross when customer pays)
  // For tables: Subtotal = total_table_revenue (amount field is already the base price, fees stored separately)
  const ticketSubtotal = analytics.ticket_gross_revenue - analytics.ticket_tax_collected - customerPaidTicketFees
  const tableSubtotal = analytics.total_table_revenue
  const totalSubtotal = ticketSubtotal + tableSubtotal

  // Total tax collected (pass-through to government)
  const totalTaxCollected = analytics.ticket_tax_collected + analytics.table_tax_collected

  // Gross = subtotal + tax (fees are not included - they go to platform/Stripe)
  const totalGrossRevenue = totalSubtotal + totalTaxCollected
  const ticketGrossRevenue = ticketSubtotal + analytics.ticket_tax_collected
  const tableGrossRevenue = tableSubtotal + analytics.table_tax_collected

  // Net revenue = subtotal - business-paid fees - refunds
  // Business-paid fees are deducted from what they receive
  const ticketNetRevenue = ticketSubtotal - businessPaidTicketFees - analytics.ticket_refunds
  const tableNetRevenue = tableSubtotal - businessPaidTableFees - analytics.table_refunds
  const totalNetRevenue = ticketNetRevenue + tableNetRevenue

  // Total = subtotal + tax - business-paid fees - refunds (what you actually receive including tax)
  const ticketTotal = ticketSubtotal + analytics.ticket_tax_collected - businessPaidTicketFees - analytics.ticket_refunds
  const tableTotal = tableSubtotal + analytics.table_tax_collected - businessPaidTableFees - analytics.table_refunds
  const overallTotal = totalSubtotal + totalTaxCollected - (businessPaidTicketFees + businessPaidTableFees) - analytics.total_refunds

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        </div>
        <ReportsDateFilter />
      </div>

      {/* Revenue Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium text-green-600 cursor-help inline-flex items-center gap-1">
                      Net Revenue
                      <Info className="h-3 w-3 opacity-70" />
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                    <div className="text-xs">
                      <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                        Net Revenue Calculation
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex justify-between gap-4">
                          <span>Subtotal</span>
                          <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                        </div>
                        {(ticketSubtotal > 0 || tableSubtotal > 0) && (
                          <>
                            {ticketSubtotal > 0 && (
                              <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                <span className="pl-4">Tickets</span>
                                <span>{formatCurrency(ticketSubtotal)}</span>
                              </div>
                            )}
                            {tableSubtotal > 0 && (
                              <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                <span className="pl-4">Tables</span>
                                <span>{formatCurrency(tableSubtotal)}</span>
                              </div>
                            )}
                          </>
                        )}
                        {(businessPaidTicketFees + businessPaidTableFees) > 0 && (
                          <>
                            <div className="flex justify-between gap-4">
                              <span>- Fees (paid by you)</span>
                              <span className="font-medium text-red-600">-{formatCurrency(businessPaidTicketFees + businessPaidTableFees)}</span>
                            </div>
                            {businessPaidTicketFees > 0 && businessPaidTableFees > 0 && (
                              <>
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tickets</span>
                                  <span>-{formatCurrency(businessPaidTicketFees)}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tables</span>
                                  <span>-{formatCurrency(businessPaidTableFees)}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        {analytics.total_refunds > 0 && (
                          <>
                            <div className="flex justify-between gap-4">
                              <span>- Refunds</span>
                              <span className="font-medium text-red-600">-{formatCurrency(analytics.total_refunds)}</span>
                            </div>
                            {analytics.ticket_refunds > 0 && (
                              <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                <span className="pl-4">Tickets</span>
                                <span>-{formatCurrency(analytics.ticket_refunds)}</span>
                              </div>
                            )}
                            {analytics.table_refunds > 0 && (
                              <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                <span className="pl-4">Tables</span>
                                <span>-{formatCurrency(analytics.table_refunds)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                          <span>Net Revenue</span>
                          <span className="text-green-600">{formatCurrency(totalNetRevenue)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          What you keep after fees & refunds (tax excluded as pass-through)
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalNetRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {businessPaidTicketFees > 0 || businessPaidTableFees > 0
                ? 'After fees, tax & refunds'
                : 'After tax & refunds'}
            </p>
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help inline-flex items-center gap-1">
                        Total (with tax)
                        <Info className="h-3 w-3 opacity-50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                      <div className="text-xs">
                        <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                          Total Calculation
                        </div>
                        <div className="p-3 space-y-1.5">
                          <div className="flex justify-between gap-4">
                            <span>Subtotal</span>
                            <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                          </div>
                          {(ticketSubtotal > 0 || tableSubtotal > 0) && (
                            <>
                              {ticketSubtotal > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tickets</span>
                                  <span>{formatCurrency(ticketSubtotal)}</span>
                                </div>
                              )}
                              {tableSubtotal > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tables</span>
                                  <span>{formatCurrency(tableSubtotal)}</span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between gap-4">
                            <span>+ Tax ({business.tax_percentage || 0}%)</span>
                            <span className="font-medium">{formatCurrency(totalTaxCollected)}</span>
                          </div>
                          {(analytics.ticket_tax_collected > 0 || analytics.table_tax_collected > 0) && (
                            <>
                              {analytics.ticket_tax_collected > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tickets</span>
                                  <span>{formatCurrency(analytics.ticket_tax_collected)}</span>
                                </div>
                              )}
                              {analytics.table_tax_collected > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tables</span>
                                  <span>{formatCurrency(analytics.table_tax_collected)}</span>
                                </div>
                              )}
                            </>
                          )}
                          {(businessPaidTicketFees + businessPaidTableFees) > 0 && (
                            <>
                              <div className="flex justify-between gap-4">
                                <span>- Fees (paid by you)</span>
                                <span className="font-medium text-red-600">-{formatCurrency(businessPaidTicketFees + businessPaidTableFees)}</span>
                              </div>
                              {businessPaidTicketFees > 0 && businessPaidTableFees > 0 && (
                                <>
                                  <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                    <span className="pl-4">Tickets</span>
                                    <span>-{formatCurrency(businessPaidTicketFees)}</span>
                                  </div>
                                  <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                    <span className="pl-4">Tables</span>
                                    <span>-{formatCurrency(businessPaidTableFees)}</span>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                          {analytics.total_refunds > 0 && (
                            <>
                              <div className="flex justify-between gap-4">
                                <span>- Refunds</span>
                                <span className="font-medium text-red-600">-{formatCurrency(analytics.total_refunds)}</span>
                              </div>
                              {analytics.ticket_refunds > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tickets</span>
                                  <span>-{formatCurrency(analytics.ticket_refunds)}</span>
                                </div>
                              )}
                              {analytics.table_refunds > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tables</span>
                                  <span>-{formatCurrency(analytics.table_refunds)}</span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                            <span>Total</span>
                            <span>{formatCurrency(overallTotal)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground pt-1">
                            Total amount received including tax
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-sm font-bold">{formatCurrency(overallTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium text-muted-foreground cursor-help inline-flex items-center gap-1">
                      Gross Revenue
                      <Info className="h-3 w-3 opacity-50" />
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                    <div className="text-xs">
                      <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                        Gross Revenue Calculation
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex justify-between gap-4">
                          <span>Subtotal</span>
                          <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>+ Tax</span>
                          <span className="font-medium">{formatCurrency(totalTaxCollected)}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                          <span>Total</span>
                          <span>{formatCurrency(totalGrossRevenue)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          Processing fees are not included in gross revenue
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalGrossRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Subtotal + tax
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Refunds</p>
            </div>
            <div className={`text-2xl font-bold ${analytics.total_refunds > 0 ? 'text-red-600' : ''}`}>{analytics.total_refunds > 0 ? `-${formatCurrency(analytics.total_refunds)}` : formatCurrency(0)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.refund_count} refund{analytics.refund_count !== 1 ? 's' : ''} processed
            </p>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="pb-0">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Tax Collected ({business.tax_percentage || 0}%)</p>
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
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(ticketSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax Collected</span>
                  <span className="font-medium">{formatCurrency(analytics.ticket_tax_collected)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground cursor-help inline-flex items-center gap-1">
                          Processing Fees
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Fee Breakdown
                          </div>
                          <div className="p-3 space-y-2">
                            {customerPaidTicketPlatformFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Platform Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Customer
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(customerPaidTicketPlatformFees)}</span>
                              </div>
                            )}
                            {businessPaidTicketPlatformFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Platform Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                    You
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(businessPaidTicketPlatformFees)}</span>
                              </div>
                            )}
                            {customerPaidTicketStripeFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Stripe Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Customer
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(customerPaidTicketStripeFees)}</span>
                              </div>
                            )}
                            {businessPaidTicketStripeFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Stripe Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                    You
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(businessPaidTicketStripeFees)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-medium text-muted-foreground">
                    {businessPaidTicketFees > 0 ? `-${formatCurrency(businessPaidTicketFees)}` : formatCurrency(customerPaidTicketFees)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Refunds</span>
                  <span className={`font-medium ${analytics.ticket_refunds > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {analytics.ticket_refunds > 0 ? `-${formatCurrency(analytics.ticket_refunds)}` : formatCurrency(0)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help inline-flex items-center gap-1">
                          Gross Revenue
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Gross Revenue Calculation
                          </div>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal</span>
                              <span className="font-medium">{formatCurrency(ticketSubtotal)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>+ Tax ({business.tax_percentage || 0}%)</span>
                              <span className="font-medium">{formatCurrency(analytics.ticket_tax_collected)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                              <span>Gross Revenue</span>
                              <span>{formatCurrency(ticketGrossRevenue)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                              Processing fees are not included in gross revenue
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-bold">{formatCurrency(ticketGrossRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help inline-flex items-center gap-1">
                          Net Revenue
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Net Revenue Calculation
                          </div>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal</span>
                              <span className="font-medium">{formatCurrency(ticketSubtotal)}</span>
                            </div>
                            {businessPaidTicketFees > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Fees (paid by you)</span>
                                <span className="font-medium text-red-600">-{formatCurrency(businessPaidTicketFees)}</span>
                              </div>
                            )}
                            {analytics.ticket_refunds > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Refunds</span>
                                <span className="font-medium text-red-600">-{formatCurrency(analytics.ticket_refunds)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                              <span>Net Revenue</span>
                              <span className="text-green-600">{formatCurrency(ticketNetRevenue)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                              What you keep after fees & refunds (tax excluded as pass-through)
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-bold text-green-600">{formatCurrency(ticketNetRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help inline-flex items-center gap-1">
                          Total
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Total Calculation
                          </div>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal</span>
                              <span className="font-medium">{formatCurrency(ticketSubtotal)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>+ Tax ({business.tax_percentage || 0}%)</span>
                              <span className="font-medium">{formatCurrency(analytics.ticket_tax_collected)}</span>
                            </div>
                            {businessPaidTicketFees > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Fees (paid by you)</span>
                                <span className="font-medium text-red-600">-{formatCurrency(businessPaidTicketFees)}</span>
                              </div>
                            )}
                            {analytics.ticket_refunds > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Refunds</span>
                                <span className="font-medium text-red-600">-{formatCurrency(analytics.ticket_refunds)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                              <span>Total</span>
                              <span>{formatCurrency(ticketTotal)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                              Total amount received including tax
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-bold">{formatCurrency(ticketTotal)}</span>
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
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(tableSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax Collected</span>
                  <span className="font-medium">{formatCurrency(analytics.table_tax_collected)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground cursor-help inline-flex items-center gap-1">
                          Processing Fees
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Fee Breakdown
                          </div>
                          <div className="p-3 space-y-2">
                            {customerPaidTablePlatformFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Platform Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Customer
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(customerPaidTablePlatformFees)}</span>
                              </div>
                            )}
                            {businessPaidTablePlatformFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Platform Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                    You
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(businessPaidTablePlatformFees)}</span>
                              </div>
                            )}
                            {customerPaidTableStripeFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Stripe Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Customer
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(customerPaidTableStripeFees)}</span>
                              </div>
                            )}
                            {businessPaidTableStripeFees > 0 && (
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                  <span>Stripe Fee</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                    You
                                  </span>
                                </div>
                                <span className="font-medium">{formatCurrency(businessPaidTableStripeFees)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-medium text-muted-foreground">
                    {businessPaidTableFees > 0 ? `-${formatCurrency(businessPaidTableFees)}` : formatCurrency(customerPaidTableFees)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Refunds</span>
                  <span className={`font-medium ${analytics.table_refunds > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {analytics.table_refunds > 0 ? `-${formatCurrency(analytics.table_refunds)}` : formatCurrency(0)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help inline-flex items-center gap-1">
                          Gross Revenue
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Gross Revenue Calculation
                          </div>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal</span>
                              <span className="font-medium">{formatCurrency(tableSubtotal)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>+ Tax ({business.tax_percentage || 0}%)</span>
                              <span className="font-medium">{formatCurrency(analytics.table_tax_collected)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                              <span>Gross Revenue</span>
                              <span>{formatCurrency(tableGrossRevenue)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                              Processing fees are not included in gross revenue
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-bold">{formatCurrency(tableGrossRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help inline-flex items-center gap-1">
                          Net Revenue
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Net Revenue Calculation
                          </div>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal</span>
                              <span className="font-medium">{formatCurrency(tableSubtotal)}</span>
                            </div>
                            {businessPaidTableFees > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Fees (paid by you)</span>
                                <span className="font-medium text-red-600">-{formatCurrency(businessPaidTableFees)}</span>
                              </div>
                            )}
                            {analytics.table_refunds > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Refunds</span>
                                <span className="font-medium text-red-600">-{formatCurrency(analytics.table_refunds)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                              <span>Net Revenue</span>
                              <span className="text-green-600">{formatCurrency(tableNetRevenue)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                              What you keep after fees & refunds (tax excluded as pass-through)
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-bold text-green-600">{formatCurrency(tableNetRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help inline-flex items-center gap-1">
                          Total
                          <Info className="h-3 w-3 opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                        <div className="text-xs">
                          <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                            Total Calculation
                          </div>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal</span>
                              <span className="font-medium">{formatCurrency(tableSubtotal)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>+ Tax ({business.tax_percentage || 0}%)</span>
                              <span className="font-medium">{formatCurrency(analytics.table_tax_collected)}</span>
                            </div>
                            {businessPaidTableFees > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Fees (paid by you)</span>
                                <span className="font-medium text-red-600">-{formatCurrency(businessPaidTableFees)}</span>
                              </div>
                            )}
                            {analytics.table_refunds > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>- Refunds</span>
                                <span className="font-medium text-red-600">-{formatCurrency(analytics.table_refunds)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                              <span>Total</span>
                              <span>{formatCurrency(tableTotal)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">
                              Total amount received including tax
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-bold">{formatCurrency(tableTotal)}</span>
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

      {/* Public Page Performance */}
      <PageViewsChart stats={pageViewStats} themeColor={business.theme_color} />

      {/* Tracking Link Performance */}
      <TrackingLinkAnalytics analytics={trackingAnalytics} />
    </div>
  )
}
