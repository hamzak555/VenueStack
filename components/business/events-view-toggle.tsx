'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Ticket, Armchair, CheckCircle, FileEdit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EventsCalendar } from './events-calendar'

interface SalesData {
  totalSold: number
  availableTickets: number
  breakdown: Array<{ name: string; quantity: number }>
  grossRevenue: number
  netRevenue: number
  fees: number
}

interface TableData {
  booked: number
  total: number
  revenue: number
}

interface EventWithSales {
  id: string
  title: string
  event_date: string
  event_time: string | null
  status: 'draft' | 'published' | 'cancelled'
  location: string | null
  image_url: string | null
  table_service_enabled?: boolean
  salesData: SalesData
  tableData?: TableData
  priceDisplay: string
}

interface DefaultLocation {
  address: string | null
  latitude: number | null
  longitude: number | null
  placeId: string | null
}

interface EventsViewToggleProps {
  events: EventWithSales[]
  businessSlug: string
  businessId: string
  defaultLocation?: DefaultLocation
  defaultTimezone?: string
}

export function EventsViewToggle({ events, businessSlug, businessId, defaultLocation, defaultTimezone }: EventsViewToggleProps) {
  const [mounted, setMounted] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Calculate monthly statistics
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const monthEvents = events.filter(event => {
      const dateStr = event.event_date.split('T')[0]
      const [y, m] = dateStr.split('-').map(Number)
      return y === year && m - 1 === month
    })

    // Calculate totals
    let ticketsSold = 0
    let ticketsTotal = 0
    let tablesBooked = 0
    // Ticket revenue breakdown
    let ticketGrossRevenue = 0
    let ticketNetRevenue = 0
    let ticketFees = 0
    // Table revenue
    let tableRevenue = 0

    monthEvents.forEach(event => {
      ticketsSold += event.salesData.totalSold
      ticketsTotal += event.salesData.totalSold + event.salesData.availableTickets
      ticketGrossRevenue += event.salesData.grossRevenue
      ticketNetRevenue += event.salesData.netRevenue
      ticketFees += event.salesData.fees
      if (event.tableData) {
        tablesBooked += event.tableData.booked
        tableRevenue += event.tableData.revenue
      }
    })

    const published = monthEvents.filter(e => e.status === 'published').length
    const draft = monthEvents.filter(e => e.status === 'draft').length

    return {
      ticketsSold,
      ticketsTotal,
      tablesBooked,
      ticketGrossRevenue,
      ticketNetRevenue,
      ticketFees,
      tableRevenue,
      published,
      draft,
    }
  }, [events, currentDate])

  // Prevent hydration mismatch by not rendering view-specific content until mounted
  if (!mounted) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold ml-1">Loading...</h2>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="pt-6 pb-4 lg:py-6">
      <CardHeader className="hidden lg:grid pb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Calendar navigation (desktop only, mobile has week nav in calendar) */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-1">{monthName}</h2>
            <Button variant="outline" size="sm" className="ml-2 h-8" onClick={goToToday}>
              Today
            </Button>
          </div>

          {/* Right side - Monthly statistics */}
          <TooltipProvider>
            <div className="flex items-center gap-5 text-sm">
              {monthStats.published > 0 && (
                <div className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{monthStats.published} published</span>
                </div>
              )}
              {monthStats.draft > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileEdit className="h-4 w-4" />
                  <span>{monthStats.draft} draft</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Ticket className="h-4 w-4" />
                <span>{monthStats.ticketsSold}/{monthStats.ticketsTotal} sold</span>
              </div>
              {monthStats.tablesBooked > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Armchair className="h-4 w-4" />
                  <span>{monthStats.tablesBooked} booked</span>
                </div>
              )}
              {/* Ticket Revenue with tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                    <Ticket className="h-4 w-4" />
                    <span>${monthStats.ticketNetRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="space-y-1">
                    <div className="font-medium">Ticket Revenue</div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Collected:</span>
                      <span>${monthStats.ticketGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Fees:</span>
                      <span>-${monthStats.ticketFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t pt-1">
                      <span className="text-muted-foreground">You receive:</span>
                      <span className="font-medium">${monthStats.ticketNetRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              {/* Table Revenue with tooltip */}
              {monthStats.tableRevenue > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                      <Armchair className="h-4 w-4" />
                      <span>${monthStats.tableRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="space-y-1">
                      <div className="font-medium">Table Service Revenue</div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">You receive:</span>
                        <span className="font-medium">${monthStats.tableRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <EventsCalendar
          events={events}
          businessSlug={businessSlug}
          businessId={businessId}
          currentDate={currentDate}
          defaultLocation={defaultLocation}
          defaultTimezone={defaultTimezone}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onToday={goToToday}
        />
      </CardContent>
    </Card>
  )
}
