'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Star, Mail, Phone, Calendar, Ticket, Armchair, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

interface CustomerDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerIdentifier: string | null // Phone number (primary) or email (fallback)
  businessSlug: string
}

interface CustomerData {
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
    emails: string[]
    total_reservations: number
    total_tickets: number
    total_spent: number
    first_purchase: string
    last_purchase: string
    average_rating: number | null
    total_ratings: number
  }
  reservations: {
    past: Reservation[]
    upcoming: Reservation[]
  }
  tickets: TicketPurchase[]
}

interface Reservation {
  id: string
  event_id: string
  event_title: string
  event_date: string
  event_time: string | null
  section_name: string
  table_number: string | null
  status: string
  amount: number | null
  rating: number | null
  feedback: string | null
  feedback_by: string | null
}

interface TicketPurchase {
  id: string
  order_number: string
  event_title: string
  event_date: string
  quantity: number
  total: number
  status: string
  created_at: string
}

function StarDisplay({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-muted-foreground text-sm">No ratings</span>
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          strokeWidth={1.5}
          className={cn(
            'h-4 w-4',
            star <= Math.round(rating)
              ? 'text-yellow-400 fill-yellow-900'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
    </div>
  )
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'teal' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'seated':
      return 'teal'
    case 'arrived':
      return 'success'
    case 'confirmed':
      return 'warning'
    case 'reserved':
      return 'secondary'
    case 'cancelled':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

export function CustomerDetailPanel({
  open,
  onOpenChange,
  customerIdentifier,
  businessSlug,
}: CustomerDetailPanelProps) {
  const [data, setData] = useState<CustomerData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && customerIdentifier) {
      fetchCustomerDetails()
    } else {
      setData(null)
      setError(null)
    }
  }, [open, customerIdentifier])

  const fetchCustomerDetails = async () => {
    if (!customerIdentifier) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customerIdentifier)}`,
        { credentials: 'include' }
      )
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch customer details')
      }
      const customerData = await response.json()
      setData(customerData)
    } catch (err) {
      console.error('Error fetching customer:', err)
      setError(err instanceof Error ? err.message : 'Failed to load customer')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : data ? (
          <>
            <SheetHeader className="pb-4">
              <SheetTitle className="text-xl">{data.customer.name}</SheetTitle>
              <div className="flex items-center gap-1 mt-1">
                <StarDisplay rating={data.customer.average_rating} />
                {data.customer.total_ratings > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({data.customer.total_ratings})
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground mt-2">
                {data.customer.emails && data.customer.emails.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      {data.customer.emails.map((email, i) => (
                        <a
                          key={email}
                          href={`mailto:${email}`}
                          className="hover:text-foreground transition-colors"
                        >
                          {email}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {data.customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <a
                      href={`tel:${data.customer.phone}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {data.customer.phone}
                    </a>
                  </div>
                )}
              </div>
            </SheetHeader>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3 my-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {data.reservations.past.length + data.reservations.upcoming.length}
                </p>
                <p className="text-xs text-muted-foreground">Reservations</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.tickets.length}</p>
                <p className="text-xs text-muted-foreground">Tickets</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {formatCurrency(data.customer.total_spent, false)}
                </p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>
            </div>

            {/* Customer Since */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Calendar className="h-4 w-4" />
              <span>Customer since {formatDate(data.customer.first_purchase)}</span>
            </div>

            <Tabs defaultValue="reservations" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reservations" className="flex items-center gap-2">
                  <Armchair className="h-4 w-4" />
                  Reservations
                </TabsTrigger>
                <TabsTrigger value="tickets" className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Tickets
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reservations" className="space-y-4 mt-4">
                {/* Upcoming Reservations */}
                {data.reservations.upcoming.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-muted-foreground">
                      Upcoming ({data.reservations.upcoming.length})
                    </h4>
                    <div className="space-y-2">
                      {data.reservations.upcoming.map((r) => (
                        <ReservationCard key={r.id} reservation={r} businessSlug={businessSlug} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Past Reservations */}
                <div>
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">
                    Past ({data.reservations.past.length})
                  </h4>
                  {data.reservations.past.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No past reservations
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.reservations.past.map((r) => (
                        <ReservationCard key={r.id} reservation={r} businessSlug={businessSlug} showRating />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tickets" className="mt-4">
                {data.tickets.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    No ticket purchases
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.tickets.map((t) => (
                      <TicketCard key={t.id} ticket={t} businessSlug={businessSlug} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a customer to view details
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ReservationCard({
  reservation,
  businessSlug,
  showRating,
}: {
  reservation: Reservation
  businessSlug: string
  showRating?: boolean
}) {
  return (
    <Link
      href={`/${businessSlug}/dashboard/tables?eventId=${reservation.event_id}&bookingId=${reservation.id}`}
      className="block p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors group"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{reservation.event_title}</p>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-sm text-muted-foreground">
            {reservation.section_name}
            {reservation.table_number && ` · Table ${reservation.table_number}`}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{formatDate(reservation.event_date)}</span>
            {reservation.event_time && (
              <>
                <span>·</span>
                <span>{formatTime(reservation.event_time)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={getStatusVariant(reservation.status)}>
            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
          </Badge>
          {reservation.amount && (
            <span className="text-sm font-medium">
              {formatCurrency(reservation.amount)}
            </span>
          )}
        </div>
      </div>
      {showRating && reservation.rating && (
        <div className="mt-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  strokeWidth={1.5}
                  className={cn(
                    'h-3 w-3',
                    star <= reservation.rating!
                      ? 'text-yellow-400 fill-yellow-900'
                      : 'text-muted-foreground/30'
                  )}
                />
              ))}
            </div>
            {reservation.feedback_by && (
              <span className="text-xs text-muted-foreground">
                by {reservation.feedback_by}
              </span>
            )}
          </div>
          {reservation.feedback && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              &quot;{reservation.feedback}&quot;
            </p>
          )}
        </div>
      )}
    </Link>
  )
}

function TicketCard({ ticket, businessSlug }: { ticket: TicketPurchase; businessSlug: string }) {
  return (
    <Link
      href={`/${businessSlug}/dashboard/tickets/${ticket.id}`}
      className="block p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors group"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{ticket.event_title}</p>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs text-muted-foreground">
            Order #{ticket.order_number}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{formatDate(ticket.event_date)}</span>
            <span>·</span>
            <span>
              {ticket.quantity} ticket{ticket.quantity !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant={
              ticket.status === 'completed'
                ? 'success'
                : ticket.status === 'cancelled' || ticket.status === 'refunded'
                ? 'destructive'
                : 'secondary'
            }
          >
            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
          </Badge>
          <span className="text-sm font-medium">{formatCurrency(ticket.total)}</span>
        </div>
      </div>
    </Link>
  )
}
