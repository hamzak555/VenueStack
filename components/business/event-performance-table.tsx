'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
}

interface EventPerformanceTableProps {
  events: EventData[]
  eventAnalytics: EventAnalytics[]
}

const ITEMS_PER_PAGE = 10

type TimeFilter = 'all' | 'upcoming' | 'past'
type SortField = 'event' | 'status' | 'date' | 'tickets' | 'ticket_revenue' | 'ticket_tax' | 'tables' | 'table_revenue' | 'table_tax' | 'gross' | 'net'
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
    const ticketNet = analytics?.ticket_net_revenue || 0
    const tablesBooked = analytics?.total_table_bookings || 0
    const tableRevenue = analytics?.table_revenue || 0
    const tableTax = analytics?.table_tax || 0
    const totalGross = ticketGross + tableRevenue + tableTax
    const totalNet = ticketNet + tableRevenue
    return { ticketsSold, ticketGross, ticketTax, ticketNet, tablesBooked, tableRevenue, tableTax, totalGross, totalNet }
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
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'date':
          comparison = new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
          break
        case 'tickets':
          comparison = analyticsA.ticketsSold - analyticsB.ticketsSold
          break
        case 'ticket_revenue':
          comparison = analyticsA.ticketGross - analyticsB.ticketGross
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
        case 'gross':
          comparison = analyticsA.totalGross - analyticsB.totalGross
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
                    <SortableHeader field="status">Status</SortableHeader>
                    <SortableHeader field="date">Date</SortableHeader>
                    <SortableHeader field="tickets" className="text-right">Tickets</SortableHeader>
                    <SortableHeader field="ticket_revenue" className="text-right">Ticket Revenue</SortableHeader>
                    <SortableHeader field="ticket_tax" className="text-right">Ticket Tax</SortableHeader>
                    <SortableHeader field="tables" className="text-right">Tables</SortableHeader>
                    <SortableHeader field="table_revenue" className="text-right">Table Revenue</SortableHeader>
                    <SortableHeader field="table_tax" className="text-right">Table Tax</SortableHeader>
                    <SortableHeader field="gross" className="text-right">Gross Revenue</SortableHeader>
                    <SortableHeader field="net" className="text-right">Net Revenue</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEvents.map((event) => {
                    const analytics = eventAnalytics.find(a => a.event_id === event.id)
                    const ticketsSold = analytics?.total_tickets_sold || 0
                    const ticketGross = analytics?.ticket_gross_revenue || 0
                    const ticketTax = analytics?.ticket_tax || 0
                    const ticketNet = analytics?.ticket_net_revenue || 0
                    const tablesBooked = analytics?.total_table_bookings || 0
                    const tableRevenue = analytics?.table_revenue || 0
                    const tableTax = analytics?.table_tax || 0
                    const totalGross = ticketGross + tableRevenue + tableTax
                    const totalNet = ticketNet + tableRevenue

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
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(event.event_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right">{ticketsSold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ticketGross)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ticketTax)}</TableCell>
                        <TableCell className="text-right">{tablesBooked}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tableRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tableTax)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalGross)}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(totalNet)}
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
