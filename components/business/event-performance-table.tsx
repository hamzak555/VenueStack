'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils/currency'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image'

interface EventData {
  id: string
  title: string
  status: 'draft' | 'published' | 'cancelled'
  event_date: string
  image_url?: string | null
}

interface EventAnalytics {
  event_id: string
  total_tickets_sold: number
  ticket_gross_revenue: number
  ticket_fees: number
  ticket_net_revenue: number
  ticket_tax: number
  total_table_bookings: number
  table_revenue: number
  table_tax: number
  table_fees: number
  ticket_customer_paid_fees: number
  ticket_business_paid_fees: number
  table_customer_paid_fees: number
  table_business_paid_fees: number
  ticket_refunds: number
  table_refunds: number
  total_refunds: number
}

interface EventPerformanceTableProps {
  events: EventData[]
  eventAnalytics: EventAnalytics[]
}

const ITEMS_PER_PAGE = 10

type TimeFilter = 'all' | 'upcoming' | 'past'
type SortField = 'event' | 'date' | 'tickets' | 'tables' | 'subtotal' | 'tax' | 'gross' | 'fees' | 'refunds' | 'net' | 'total'
type SortDirection = 'asc' | 'desc'

export function EventPerformanceTable({ events, eventAnalytics }: EventPerformanceTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Filter events by time
  const filteredEvents = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    return events.filter(event => {
      const eventDate = new Date(event.event_date)
      eventDate.setHours(0, 0, 0, 0)

      if (timeFilter === 'upcoming') {
        return eventDate >= now
      } else if (timeFilter === 'past') {
        return eventDate < now
      }
      return true // 'all'
    })
  }, [events, timeFilter])

  // Helper to get analytics for an event
  const getEventAnalytics = (eventId: string) => {
    const analytics = eventAnalytics.find(a => a.event_id === eventId)
    const ticketsSold = analytics?.total_tickets_sold || 0
    const ticketGross = analytics?.ticket_gross_revenue || 0
    const ticketTax = analytics?.ticket_tax || 0
    const ticketFees = analytics?.ticket_fees || 0
    const tablesBooked = analytics?.total_table_bookings || 0
    const tableRevenue = analytics?.table_revenue || 0
    const tableTax = analytics?.table_tax || 0
    const tableFees = analytics?.table_fees || 0
    const totalRefunds = analytics?.total_refunds || 0
    const ticketCustomerPaidFees = analytics?.ticket_customer_paid_fees || 0
    const ticketBusinessPaidFees = analytics?.ticket_business_paid_fees || 0
    const tableCustomerPaidFees = analytics?.table_customer_paid_fees || 0
    const tableBusinessPaidFees = analytics?.table_business_paid_fees || 0
    const totalFees = ticketFees + tableFees
    const totalCustomerPaidFees = ticketCustomerPaidFees + tableCustomerPaidFees
    const totalBusinessPaidFees = ticketBusinessPaidFees + tableBusinessPaidFees
    // Subtotal = gross - tax - customer-paid fees (customer-paid fees are included in gross)
    const ticketSubtotal = ticketGross - ticketTax - ticketCustomerPaidFees
    const totalSubtotal = ticketSubtotal + tableRevenue
    const totalTax = ticketTax + tableTax
    // Gross = subtotal + tax (fees not included - they go to platform/Stripe)
    const totalGross = totalSubtotal + totalTax
    // Net = subtotal - business-paid fees - refunds (tax is pass-through)
    const totalNet = totalSubtotal - totalBusinessPaidFees - totalRefunds
    // Total = subtotal + tax - business-paid fees - refunds (what you actually receive)
    const total = totalGross - totalBusinessPaidFees - totalRefunds
    return {
      ticketsSold, ticketSubtotal, ticketTax, ticketFees, ticketCustomerPaidFees, ticketBusinessPaidFees,
      tablesBooked, tableRevenue, tableTax, tableFees, tableCustomerPaidFees, tableBusinessPaidFees,
      totalFees, totalCustomerPaidFees, totalBusinessPaidFees, totalRefunds,
      totalSubtotal, totalTax, totalGross, total, totalNet
    }
  }

  // Sort events
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      let comparison = 0
      const analyticsA = getEventAnalytics(a.id)
      const analyticsB = getEventAnalytics(b.id)

      switch (sortField) {
        case 'event':
          comparison = a.title.localeCompare(b.title)
          break
        case 'date':
          comparison = new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
          break
        case 'tickets':
          comparison = analyticsA.ticketsSold - analyticsB.ticketsSold
          break
        case 'tables':
          comparison = analyticsA.tablesBooked - analyticsB.tablesBooked
          break
        case 'subtotal':
          comparison = analyticsA.totalSubtotal - analyticsB.totalSubtotal
          break
        case 'tax':
          comparison = analyticsA.totalTax - analyticsB.totalTax
          break
        case 'gross':
          comparison = analyticsA.totalGross - analyticsB.totalGross
          break
        case 'fees':
          comparison = analyticsA.totalBusinessPaidFees - analyticsB.totalBusinessPaidFees
          break
        case 'refunds':
          comparison = analyticsA.totalRefunds - analyticsB.totalRefunds
          break
        case 'net':
          comparison = analyticsA.totalNet - analyticsB.totalNet
          break
        case 'total':
          comparison = analyticsA.total - analyticsB.total
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredEvents, sortField, sortDirection, eventAnalytics])

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setTimeFilter(value as TimeFilter)
    setCurrentPage(1)
  }

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1)
  }

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1 hover:text-foreground transition-colors ${className?.includes('text-right') ? 'ml-auto' : ''}`}
      >
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  )

  // Calculate pagination
  const totalPages = Math.ceil(sortedEvents.length / ITEMS_PER_PAGE)
  const paginatedEvents = sortedEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Event Performance</CardTitle>
          <Tabs value={timeFilter} onValueChange={handleFilterChange}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {sortedEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {timeFilter === 'all'
                ? 'No events to report on yet'
                : timeFilter === 'upcoming'
                ? 'No upcoming events'
                : 'No past events'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="event">Event</SortableHeader>
                    <SortableHeader field="date">Date</SortableHeader>
                    <SortableHeader field="tickets" className="text-right">Tickets</SortableHeader>
                    <SortableHeader field="tables" className="text-right">Tables</SortableHeader>
                    <SortableHeader field="subtotal" className="text-right">Subtotal</SortableHeader>
                    <SortableHeader field="tax" className="text-right">Tax</SortableHeader>
                    <SortableHeader field="gross" className="text-right">Gross</SortableHeader>
                    <SortableHeader field="fees" className="text-right">Fees</SortableHeader>
                    <SortableHeader field="refunds" className="text-right">Refunds</SortableHeader>
                    <SortableHeader field="net" className="text-right">Net</SortableHeader>
                    <SortableHeader field="total" className="text-right">Total</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEvents.map((event) => {
                    const analytics = eventAnalytics.find(a => a.event_id === event.id)
                    const ticketsSold = analytics?.total_tickets_sold || 0
                    const ticketGross = analytics?.ticket_gross_revenue || 0
                    const ticketTax = analytics?.ticket_tax || 0
                    const tablesBooked = analytics?.total_table_bookings || 0
                    const tableRevenue = analytics?.table_revenue || 0
                    const tableTax = analytics?.table_tax || 0
                    const ticketRefunds = analytics?.ticket_refunds || 0
                    const tableRefunds = analytics?.table_refunds || 0
                    const totalRefunds = analytics?.total_refunds || 0
                    const ticketCustomerPaidFees = analytics?.ticket_customer_paid_fees || 0
                    const ticketBusinessPaidFees = analytics?.ticket_business_paid_fees || 0
                    const tableBusinessPaidFees = analytics?.table_business_paid_fees || 0
                    const totalBusinessPaidFees = ticketBusinessPaidFees + tableBusinessPaidFees
                    // Subtotal = gross - tax - customer-paid fees (customer-paid fees are included in gross)
                    const ticketSubtotal = ticketGross - ticketTax - ticketCustomerPaidFees
                    const totalSubtotal = ticketSubtotal + tableRevenue
                    const totalTax = ticketTax + tableTax
                    // Gross = subtotal + tax (fees not included - they go to platform/Stripe)
                    const totalGross = totalSubtotal + totalTax
                    // Net = subtotal - business-paid fees - refunds (tax is pass-through)
                    const totalNet = totalSubtotal - totalBusinessPaidFees - totalRefunds
                    // Total = subtotal + tax - business-paid fees - refunds (what you actually receive)
                    const total = totalGross - totalBusinessPaidFees - totalRefunds

                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {event.image_url ? (
                              <Image
                                src={event.image_url}
                                alt={event.title}
                                width={40}
                                height={40}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                                No img
                              </div>
                            )}
                            <span className="font-medium">{event.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(event.event_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right">{ticketsSold}</TableCell>
                        <TableCell className="text-right">{tablesBooked}</TableCell>
                        <TableCell className="text-right">
                          {totalSubtotal > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center gap-1">
                                    {formatCurrency(totalSubtotal)}
                                    <Info className="h-3 w-3 opacity-50" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                                  <div className="text-xs">
                                    <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                                      Subtotal Breakdown
                                    </div>
                                    <div className="p-3 space-y-1.5">
                                      <div className="flex justify-between gap-4">
                                        <span>Total</span>
                                        <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                                      </div>
                                      {ticketSubtotal > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tickets</span>
                                          <span>{formatCurrency(ticketSubtotal)}</span>
                                        </div>
                                      )}
                                      {tableRevenue > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tables</span>
                                          <span>{formatCurrency(tableRevenue)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            formatCurrency(0)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalTax > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center gap-1">
                                    {formatCurrency(totalTax)}
                                    <Info className="h-3 w-3 opacity-50" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                                  <div className="text-xs">
                                    <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                                      Tax Breakdown
                                    </div>
                                    <div className="p-3 space-y-1.5">
                                      <div className="flex justify-between gap-4">
                                        <span>Total</span>
                                        <span className="font-medium">{formatCurrency(totalTax)}</span>
                                      </div>
                                      {ticketTax > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tickets</span>
                                          <span>{formatCurrency(ticketTax)}</span>
                                        </div>
                                      )}
                                      {tableTax > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tables</span>
                                          <span>{formatCurrency(tableTax)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            formatCurrency(0)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help inline-flex items-center gap-1">
                                  {formatCurrency(totalGross)}
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
                                      <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>+ Tax</span>
                                      <span className="font-medium">{formatCurrency(totalTax)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                                      <span>Gross Revenue</span>
                                      <span>{formatCurrency(totalGross)}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pt-1">
                                      Processing fees are not included in gross revenue
                                    </p>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          {totalBusinessPaidFees > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center gap-1">
                                    -{formatCurrency(totalBusinessPaidFees)}
                                    <Info className="h-3 w-3 opacity-50" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                                  <div className="text-xs">
                                    <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                                      Fees Paid by You
                                    </div>
                                    <div className="p-3 space-y-1.5">
                                      <div className="flex justify-between gap-4">
                                        <span>Total</span>
                                        <span className="font-medium">{formatCurrency(totalBusinessPaidFees)}</span>
                                      </div>
                                      {ticketBusinessPaidFees > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tickets</span>
                                          <span>{formatCurrency(ticketBusinessPaidFees)}</span>
                                        </div>
                                      )}
                                      {tableBusinessPaidFees > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tables</span>
                                          <span>{formatCurrency(tableBusinessPaidFees)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            formatCurrency(0)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalRefunds > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-orange-600 cursor-help inline-flex items-center gap-1">
                                    -{formatCurrency(totalRefunds)}
                                    <Info className="h-3 w-3 opacity-50" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                                  <div className="text-xs">
                                    <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                                      Refunds
                                    </div>
                                    <div className="p-3 space-y-1.5">
                                      <div className="flex justify-between gap-4">
                                        <span>Total</span>
                                        <span className="font-medium">{formatCurrency(totalRefunds)}</span>
                                      </div>
                                      {ticketRefunds > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tickets</span>
                                          <span>{formatCurrency(ticketRefunds)}</span>
                                        </div>
                                      )}
                                      {tableRefunds > 0 && (
                                        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                          <span className="pl-4">Tables</span>
                                          <span>{formatCurrency(tableRefunds)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            formatCurrency(0)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-medium text-green-600 cursor-help inline-flex items-center gap-1">
                                  {formatCurrency(totalNet)}
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
                                      <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                                    </div>
                                    {totalBusinessPaidFees > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span>- Fees (paid by you)</span>
                                        <span className="font-medium">-{formatCurrency(totalBusinessPaidFees)}</span>
                                      </div>
                                    )}
                                    {totalRefunds > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span>- Refunds</span>
                                        <span className="font-medium text-orange-600">-{formatCurrency(totalRefunds)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                                      <span>Net Revenue</span>
                                      <span className="text-green-600">{formatCurrency(totalNet)}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pt-1">
                                      What you keep after fees & refunds (tax excluded as pass-through)
                                    </p>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-medium cursor-help inline-flex items-center gap-1">
                                  {formatCurrency(total)}
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
                                    <div className="flex justify-between gap-4">
                                      <span>+ Tax</span>
                                      <span className="font-medium">{formatCurrency(totalTax)}</span>
                                    </div>
                                    {totalBusinessPaidFees > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span>- Fees (paid by you)</span>
                                        <span className="font-medium">-{formatCurrency(totalBusinessPaidFees)}</span>
                                      </div>
                                    )}
                                    {totalRefunds > 0 && (
                                      <div className="flex justify-between gap-4">
                                        <span>- Refunds</span>
                                        <span className="font-medium text-orange-600">-{formatCurrency(totalRefunds)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                                      <span>Total</span>
                                      <span>{formatCurrency(total)}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pt-1">
                                      Total amount received including tax
                                    </p>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedEvents.length)} of {sortedEvents.length} events
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
