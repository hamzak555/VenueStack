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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils/currency'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface EventData {
  id: string
  title: string
  status: 'draft' | 'published' | 'cancelled'
  event_date: string
}

interface EventAnalytics {
  event_id: string
  total_tickets_sold: number
  ticket_gross_revenue: number
  ticket_fees: number
  ticket_net_revenue: number
  total_table_bookings: number
  table_revenue: number
}

interface EventPerformanceTableProps {
  events: EventData[]
  eventAnalytics: EventAnalytics[]
}

const ITEMS_PER_PAGE = 10

export function EventPerformanceTable({ events, eventAnalytics }: EventPerformanceTableProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter events based on active tab
  const filteredEvents = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    let filtered = events
    if (activeTab === 'upcoming') {
      filtered = events.filter(e => new Date(e.event_date) >= now)
    } else if (activeTab === 'past') {
      filtered = events.filter(e => new Date(e.event_date) < now)
    }

    // Sort by date (newest first for all/past, soonest first for upcoming)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.event_date).getTime()
      const dateB = new Date(b.event_date).getTime()
      return activeTab === 'upcoming' ? dateA - dateB : dateB - dateA
    })
  }, [events, activeTab])

  // Calculate pagination
  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE)
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset to page 1 when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'all' | 'upcoming' | 'past')
    setCurrentPage(1)
  }

  // Get counts for each tab
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const upcomingCount = events.filter(e => new Date(e.event_date) >= now).length
  const pastCount = events.filter(e => new Date(e.event_date) < now).length

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Event Performance</CardTitle>
            <CardDescription>
              Detailed breakdown of each event's sales and revenue
            </CardDescription>
          </div>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="all">All ({events.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingCount})</TabsTrigger>
              <TabsTrigger value="past">Past ({pastCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {activeTab === 'all'
                ? 'No events to report on yet'
                : activeTab === 'upcoming'
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
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Ticket Revenue</TableHead>
                    <TableHead className="text-right">Tables</TableHead>
                    <TableHead className="text-right">Table Revenue</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Net Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEvents.map((event) => {
                    const analytics = eventAnalytics.find(a => a.event_id === event.id)
                    const ticketsSold = analytics?.total_tickets_sold || 0
                    const ticketGross = analytics?.ticket_gross_revenue || 0
                    const ticketFees = analytics?.ticket_fees || 0
                    const ticketNet = analytics?.ticket_net_revenue || 0
                    const tablesBooked = analytics?.total_table_bookings || 0
                    const tableRevenue = analytics?.table_revenue || 0
                    const totalNet = ticketNet + tableRevenue

                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.title}</TableCell>
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
                        <TableCell className="text-right">{tablesBooked}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tableRevenue)}</TableCell>
                        <TableCell className="text-right text-orange-500">
                          {ticketFees > 0 ? `-${formatCurrency(ticketFees)}` : '$0.00'}
                        </TableCell>
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
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length} events
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
