'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EventTicketsCell } from '@/components/business/event-tickets-cell'
import { CopyEventLink } from '@/components/business/copy-event-link'

interface SalesData {
  totalSold: number
  availableTickets: number
  breakdown: Array<{ name: string; quantity: number }>
}

interface EventWithSales {
  id: string
  title: string
  event_date: string
  event_time: string | null
  status: 'draft' | 'published' | 'cancelled'
  location: string | null
  image_url: string | null
  salesData: SalesData
  priceDisplay: string
}

interface EventsTableProps {
  events: EventWithSales[]
  businessSlug: string
}

export function EventsTable({ events, businessSlug }: EventsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tickets</TableHead>
          <TableHead>Price</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                {event.image_url && (
                  <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      src={event.image_url}
                      alt={event.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="font-medium">{event.title}</div>
                  {event.location && (
                    <div className="text-sm text-muted-foreground">
                      {event.location}
                    </div>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              {(() => {
                const dateStr = event.event_date.split('T')[0]
                const [y, m, d] = dateStr.split('-').map(Number)
                return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              })()}
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
            <TableCell>
              <EventTicketsCell salesData={event.salesData} />
            </TableCell>
            <TableCell>{event.priceDisplay}</TableCell>
            <TableCell className="text-right">
              <div className="flex gap-2 justify-end">
                <CopyEventLink businessSlug={businessSlug} eventId={event.id} />
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/${businessSlug}/dashboard/events/${event.id}`}>
                    Manage
                  </Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
