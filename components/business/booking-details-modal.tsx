'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Calendar, MapPin, Users, Mail, Phone, ExternalLink, Star, StickyNote, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { TableBookingRefundDialog } from './table-booking-refund-dialog'
import { ProcessingFeeTooltip } from './processing-fee-tooltip'
import { isServerRole, type BusinessRole } from '@/lib/auth/roles'

interface BookingDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onStatusChange?: () => void
  userRole?: BusinessRole
}

interface BookingData {
  booking: {
    id: string
    table_number: number | null
    completed_table_number?: string | null
    requested_table_number?: string | null
    status: string
    amount: number | null
    order_id: string | null
    customer_name: string
    customer_email: string
    customer_phone: string | null
    created_at: string
    created_by_name?: string | null
    created_by_email?: string | null
    notes: any[]
    event: {
      id: string
      title: string
      event_date: string
      event_time: string | null
      location: string | null
    }
    section: {
      id: string
      name: string
      capacity: number | null
      price: number | null
    }
  }
  relatedBookings: {
    id: string
    table_number: number | null
    completed_table_number: string | null
    status: string
    amount: number
    section_name: string
  }[]
  refunds: any[]
  paymentMetadata: {
    subtotal: number
    taxAmount: number
    taxPercentage: number
    platformFee: number
    stripeFee: number
    totalCharged: number
    transferAmount: number
  } | null
  bookingAmount: number
  totalRefunded: number
  feedback: {
    id: string
    rating: number
    feedback: string | null
    created_by_name: string
    created_at: string
    table_number: string | null
    section_name: string | null
  } | null
}

export function BookingDetailsModal({
  open,
  onOpenChange,
  bookingId,
  onStatusChange,
  userRole,
}: BookingDetailsModalProps) {
  const [data, setData] = useState<BookingData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReopening, setIsReopening] = useState(false)
  const isServer = userRole ? isServerRole(userRole) : false

  useEffect(() => {
    if (open && bookingId) {
      fetchBookingDetails()
    }
  }, [open, bookingId])

  const fetchBookingDetails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        toast.error('Failed to load booking details')
      }
    } catch (error) {
      console.error('Error fetching booking:', error)
      toast.error('Failed to load booking details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReopen = async () => {
    if (!bookingId) return
    setIsReopening(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/reopen`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to reopen reservation')
      }
      toast.success('Reservation reopened')
      onOpenChange(false)
      onStatusChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reopen reservation')
    } finally {
      setIsReopening(false)
    }
  }

  const getStatusColor = (status: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatTimeTo12Hour = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`
  }

  const handleStatusChange = () => {
    fetchBookingDetails()
    onStatusChange?.()
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-xl">
                  {/* For completed reservations, show table info from completed_table_number or feedback */}
                  {data.booking.status === 'completed' ? (
                    data.booking.completed_table_number ? (
                      <>{data.booking.section.name} - Table #{data.booking.completed_table_number}</>
                    ) : data.feedback?.table_number ? (
                      <>{data.feedback.section_name || data.booking.section.name} - Table #{data.feedback.table_number}</>
                    ) : (
                      <>{data.booking.section.name} - Table Unknown</>
                    )
                  ) : data.booking.table_number ? (
                    <>{data.booking.section.name} - Table #{data.booking.table_number}</>
                  ) : (
                    <>{data.booking.section.name} - No Table Assigned</>
                  )}
                </DialogTitle>
                <Badge variant={getStatusColor(data.booking.status) as any} className="capitalize">
                  {data.booking.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Booked on {formatDateTime(data.booking.created_at)}
              </p>
              {/* Show requested table if no table is assigned */}
              {!data.booking.table_number && data.booking.requested_table_number && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Requested: Table #{data.booking.requested_table_number}
                </p>
              )}
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Event Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">{data.booking.event.title}</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(data.booking.event.event_date)}
                    {data.booking.event.event_time && ` at ${formatTimeTo12Hour(data.booking.event.event_time)}`}
                  </div>
                  {data.booking.event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {data.booking.event.location}
                    </div>
                  )}
                  {data.booking.section.capacity && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Capacity: {data.booking.section.capacity} guests
                    </div>
                  )}
                </div>
              </div>

              {/* Related Tables */}
              {data.relatedBookings.length > 1 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">All Tables in This Booking</p>
                  <div className="flex flex-wrap gap-2">
                    {data.relatedBookings.map((b) => {
                      const tableNum = b.table_number || b.completed_table_number
                      return (
                        <Badge
                          key={b.id}
                          variant={b.id === bookingId ? 'default' : 'outline'}
                        >
                          {b.section_name} {tableNum ? `#${tableNum}` : '(No Table)'}
                          {b.status === 'arrived' && ' (Arrived)'}
                          {b.status === 'completed' && ' (Completed)'}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div>
                <h4 className="font-medium mb-3">Customer Information</h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Name:</span>{' '}
                    <span className="font-medium">{data.booking.customer_name}</span>
                  </p>
                  <p className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${data.booking.customer_email}`} className="text-primary hover:underline">
                      {data.booking.customer_email}
                    </a>
                  </p>
                  {data.booking.customer_phone && (
                    <p className="text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${data.booking.customer_phone}`} className="text-primary hover:underline">
                        {data.booking.customer_phone}
                      </a>
                    </p>
                  )}
                  {data.booking.created_by_name && (
                    <p className="text-sm text-muted-foreground pt-2 border-t mt-2">
                      Created by <span className="font-medium text-foreground">{data.booking.created_by_name}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Reservation Notes */}
              {data.booking.notes && data.booking.notes.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Notes ({data.booking.notes.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {data.booking.notes.map((note: any, index: number) => (
                      <div
                        key={note.id || index}
                        className="bg-muted/50 rounded-lg p-3 space-y-1"
                      >
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {note.created_by_name} · {new Date(note.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Feedback (for completed reservations) */}
              {data.feedback && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Customer Feedback</h4>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-5 w-5 ${
                              star <= data.feedback!.rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">{data.feedback.rating}/5</span>
                    </div>
                    {data.feedback.feedback && (
                      <p className="text-sm text-muted-foreground italic mb-2">
                        &quot;{data.feedback.feedback}&quot;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Rated by {data.feedback.created_by_name} on{' '}
                      {new Date(data.feedback.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Info - Only show for paid bookings */}
              {(data.bookingAmount > 0 || data.paymentMetadata) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Payment Details</h4>
                  {data.paymentMetadata ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Subtotal ({data.relatedBookings.length > 1 ? `${data.relatedBookings.length} tables` : '1 table'})
                        </span>
                        <span>{formatCurrency(data.paymentMetadata.subtotal)}</span>
                      </div>

                      {data.paymentMetadata.taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Tax{data.paymentMetadata.taxPercentage > 0 && ` (${data.paymentMetadata.taxPercentage}%)`}
                          </span>
                          <span>{formatCurrency(data.paymentMetadata.taxAmount)}</span>
                        </div>
                      )}

                      {(data.paymentMetadata.platformFee + data.paymentMetadata.stripeFee) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center">
                            Processing Fee
                            <ProcessingFeeTooltip
                              platformFee={data.paymentMetadata.platformFee}
                              stripeFee={data.paymentMetadata.stripeFee}
                            />
                          </span>
                          <span>{formatCurrency(data.paymentMetadata.platformFee + data.paymentMetadata.stripeFee)}</span>
                        </div>
                      )}

                      <div className="flex justify-between pt-2 border-t font-medium">
                        <span>Total Charged</span>
                        <span className="text-lg">{formatCurrency(data.paymentMetadata.totalCharged)}</span>
                      </div>

                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">Transferred to Business</span>
                          <span className="text-lg font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(data.paymentMetadata.transferAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="text-xl font-bold">{formatCurrency(data.bookingAmount)}</span>
                    </div>
                  )}

                  {data.totalRefunded > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Total Refunded</span>
                        <span className="text-lg font-bold text-orange-700 dark:text-orange-400">
                          {formatCurrency(data.totalRefunded)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions - Only show if there are relevant actions */}
              {(data.booking.status === 'completed' || data.bookingAmount > 0) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Actions</h4>
                  <div className="flex flex-wrap gap-3">
                    {data.booking.status === 'completed' && (
                      <Button
                        variant="outline"
                        onClick={handleReopen}
                        disabled={isReopening}
                      >
                        {isReopening ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        Reopen
                      </Button>
                    )}
                    {data.bookingAmount > 0 && !isServer && (
                      <TableBookingRefundDialog
                        bookingId={data.booking.id}
                        maxRefundable={data.bookingAmount}
                        totalRefunded={data.totalRefunded}
                        sectionName={data.booking.section.name || 'Table'}
                        tableNumber={data.booking.table_number}
                        onRefundComplete={handleStatusChange}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Refund History */}
              {data.refunds.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Refund History</h4>
                  <div className="space-y-2">
                    {data.refunds.map((refund: any) => (
                      <div key={refund.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                        <div>
                          <span className="font-medium">{formatCurrency(refund.amount)}</span>
                          <span className="text-muted-foreground ml-2">
                            {new Date(refund.created_at).toLocaleDateString()}
                          </span>
                          {refund.reason && (
                            <span className="text-muted-foreground ml-2">- {refund.reason}</span>
                          )}
                        </div>
                        <Badge variant={refund.status === 'succeeded' ? 'success' : 'secondary'}>
                          {refund.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load booking details
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
