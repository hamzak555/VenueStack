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
type SortField = 'event' | 'date' | 'tickets' | 'ticket_revenue' | 'ticket_tax' | 'tables' | 'table_revenue' | 'table_tax' | 'fees' | 'refunds' | 'gross' | 'total' | 'net'
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
    // Gross = subtotal + tax (fees not included - they go to platform/Stripe)
    const totalGross = ticketSubtotal + ticketTax + tableRevenue + tableTax
    // Net = subtotal - business-paid fees - refunds (tax is pass-through)
    const totalNet = ticketSubtotal + tableRevenue - totalBusinessPaidFees - totalRefunds
    // Total = subtotal + tax - business-paid fees - refunds (what you actually receive)
    const total = totalGross - totalBusinessPaidFees - totalRefunds
    return {
      ticketsSold, ticketSubtotal, ticketTax, ticketFees, ticketCustomerPaidFees, ticketBusinessPaidFees,
      tablesBooked, tableRevenue, tableTax, tableFees, tableCustomerPaidFees, tableBusinessPaidFees,
      totalFees, totalCustomerPaidFees, totalBusinessPaidFees, totalRefunds, totalGross, total, totalNet
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
        case 'ticket_revenue':
          comparison = analyticsA.ticketSubtotal - analyticsB.ticketSubtotal
          break
        case 'ticket_tax':
          comparison = analyticsA.ticketTax - analyticsB.ticketTax
          break
        case 'tables':
          comparison = analyticsA.tablesBooked - analyticsB.tablesBooked
          break
        case 'table_revenue':
          comparison = analyticsA.tableRevenue - analyticsB.tableRevenue
          break
        case 'table_tax':
          comparison = analyticsA.tableTax - analyticsB.tableTax
          break
        case 'fees':
          comparison = analyticsA.totalBusinessPaidFees - analyticsB.totalBusinessPaidFees
          break
        case 'refunds':
          comparison = analyticsA.totalRefunds - analyticsB.totalRefunds
          break
        case 'gross':
          comparison = analyticsA.totalGross - analyticsB.totalGross
          break
        case 'total':
          comparison = analyticsA.total - analyticsB.total
          break
        case 'net':
          comparison = analyticsA.totalNet - analyticsB.totalNet
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
        className="flex items-center gap-1 hover:text-foreground transition-colors"
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
                    <SortableHeader field="ticket_revenue" className="text-right">Ticket Subtotal</SortableHeader>
                    <SortableHeader field="ticket_tax" className="text-right">Ticket Tax</SortableHeader>
                    <SortableHeader field="tables" className="text-right">Tables</SortableHeader>
                    <SortableHeader field="table_revenue" className="text-right">Table Subtotal</SortableHeader>
                    <SortableHeader field="table_tax" className="text-right">Table Tax</SortableHeader>
                    <SortableHeader field="gross" className="text-right">Gross Revenue</SortableHeader>
                    <SortableHeader field="fees" className="text-right">Fees</SortableHeader>
                    <SortableHeader field="refunds" className="text-right">Refunds</SortableHeader>
                    <SortableHeader field="net" className="text-right">Net Revenue</SortableHeader>
                    <SortableHeader field="total" className="text-right">Total</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEvents.map((event) => {
                    const analytics = eventAnalytics.find(a => a.event_id === event.id)
                    const ticketsSold = analytics?.total_tickets_sold || 0
                    const ticketGross = analytics?.ticket_gross_revenue || 0
                    const ticketTax = analytics?.ticket_tax || 0
                    const ticketFees = analytics?.ticket_fees || 0
                    const tablesBooked = analytics?.total_table_bookings || 0
                    const tableRevenue = analytics?.table_revenue || 0
                    const tableTax = analytics?.table_tax || 0
                    const tableFees = analytics?.table_fees || 0
                    const ticketRefunds = analytics?.ticket_refunds || 0
                    const tableRefunds = analytics?.table_refunds || 0
                    const totalRefunds = analytics?.total_refunds || 0
                    const ticketCustomerPaidFees = analytics?.ticket_customer_paid_fees || 0
                    const ticketBusinessPaidFees = analytics?.ticket_business_paid_fees || 0
                    const tableCustomerPaidFees = analytics?.table_customer_paid_fees || 0
                    const tableBusinessPaidFees = analytics?.table_business_paid_fees || 0
                    const totalFees = ticketFees + tableFees
                    const totalBusinessPaidFees = ticketBusinessPaidFees + tableBusinessPaidFees
                    // Subtotal = gross - tax - customer-paid fees (customer-paid fees are included in gross)
                    const ticketSubtotal = ticketGross - ticketTax - ticketCustomerPaidFees
                    // Gross = subtotal + tax (fees not included - they go to platform/Stripe)
                    const totalGross = ticketSubtotal + ticketTax + tableRevenue + tableTax
                    // Net = subtotal - business-paid fees - refunds (tax is pass-through)
                    const totalNet = ticketSubtotal + tableRevenue - totalBusinessPaidFees - totalRefunds
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
                        <TableCell className="text-right">{formatCurrency(ticketSubtotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ticketTax)}</TableCell>
                        <TableCell className="text-right">{tablesBooked}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tableRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tableTax)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalGross)}</TableCell>
                        <TableCell className="text-right">
                          {totalBusinessPaidFees > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-red-600 cursor-help inline-flex items-center gap-1">
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
                                  <span className="text-red-600 cursor-help inline-flex items-center gap-1">
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
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(totalNet)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(total)}
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
