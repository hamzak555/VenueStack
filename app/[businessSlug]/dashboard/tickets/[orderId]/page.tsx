import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrderById } from '@/lib/db/orders'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { DownloadTicketsButton } from '@/components/business/download-tickets-button'
import { ResendTicketsButton } from '@/components/business/resend-tickets-button'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils/currency'
import { OrderTicketsDisplay } from '@/components/business/order-tickets-display'
import { ProcessingFeeTooltip } from '@/components/business/processing-fee-tooltip'
import { RefundDialog } from '@/components/business/refund-dialog'
import { RefundHistory } from '@/components/business/refund-history'
import { Refund } from '@/lib/types'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface OrderDetailPageProps {
  params: Promise<{
    businessSlug: string
    orderId: string
  }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { businessSlug, orderId } = await params

  let order
  try {
    order = await getOrderById(orderId)
  } catch (error) {
    notFound()
  }

  // Fetch individual tickets and refunds for this order
  const supabase = await createClient()
  let { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  const { data: refunds } = await supabase
    .from('refunds')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  // Manually fetch ticket types if tickets have ticket_type_id
  if (tickets && tickets.length > 0) {
    const ticketTypeIds = tickets
      .map(t => t.ticket_type_id)
      .filter(Boolean)

    if (ticketTypeIds.length > 0) {
      const { data: ticketTypes } = await supabase
        .from('ticket_types')
        .select('id, name')
        .in('id', ticketTypeIds)

      if (ticketTypes) {
        const typeMap = new Map(ticketTypes.map(tt => [tt.id, tt]))
        tickets = tickets.map(ticket => ({
          ...ticket,
          ticket_type: ticket.ticket_type_id ? typeMap.get(ticket.ticket_type_id) : null
        }))
      }
    }
  }

  // Calculate refund amounts
  const totalRefunded = refunds?.filter(r => r.status === 'succeeded')
    .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0
  // Business receives: total charged minus all fees (platform + stripe)
  const businessTransferAmount = order.total - (order.platform_fee || 0) - (order.stripe_fee || 0)
  const remainingRefundable = businessTransferAmount - totalRefunded

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'pending':
        return 'warning'
      case 'refunded':
        return 'destructive'
      case 'partially_refunded':
        return 'warning'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessSlug}/dashboard/tickets`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order {order.order_number}</h1>
        </div>
        <Badge variant={getStatusColor(order.status)} className="text-sm capitalize">
          {order.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Event</p>
              <p className="text-lg font-semibold">{order.events.title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(order.events.event_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {order.events.event_time && ` at ${order.events.event_time}`}
              </p>
              {order.events.location && (
                <p className="text-sm text-muted-foreground mt-1">
                  {order.events.location}
                </p>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Subtotal ({order.quantity} {order.quantity === 1 ? 'ticket' : 'tickets'})</p>
                <p className="text-sm font-medium">{formatCurrency(order.subtotal)}</p>
              </div>

              {order.discount_amount > 0 && (
                <div className="flex justify-between">
                  <p className="text-sm text-muted-foreground">
                    Discount{order.promo_code && ` (${order.promo_code})`}
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    -{formatCurrency(order.discount_amount)}
                  </p>
                </div>
              )}

              {order.tax_amount != null && order.tax_amount > 0 && (
                <div className="flex justify-between">
                  <p className="text-sm text-muted-foreground">
                    Tax{order.tax_percentage > 0 && ` (${order.tax_percentage}%)`}
                  </p>
                  <p className="text-sm font-medium">{formatCurrency(order.tax_amount)}</p>
                </div>
              )}

              {((order.platform_fee || 0) + (order.stripe_fee || 0)) > 0 && (
                <div className="flex justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-muted-foreground">Processing Fee</p>
                    <ProcessingFeeTooltip
                      platformFee={order.platform_fee || 0}
                      stripeFee={order.stripe_fee || 0}
                      platformFeePayer={order.platform_fee_payer || 'customer'}
                      stripeFeePayer={order.stripe_fee_payer || 'customer'}
                    />
                  </div>
                  <p className="text-sm font-medium">
                    {formatCurrency((order.platform_fee || 0) + (order.stripe_fee || 0))}
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground">Total Charged</p>
                <p className="text-2xl font-bold">{formatCurrency(order.total)}</p>
              </div>

              {totalRefunded > 0 && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-100">Total Refunded</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      -{formatCurrency(totalRefunded)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">Transferred to Business</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(businessTransferAmount)}
                  </p>
                </div>
                {totalRefunded > 0 && (
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-200">After Refunds</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(remainingRefundable)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column - Actions and Customer Info */}
        <div className="space-y-6 flex flex-col">
          {/* Actions */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Manage this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <DownloadTicketsButton
                  orderId={order.id}
                  orderNumber={order.order_number}
                />
                <ResendTicketsButton
                  orderId={order.id}
                  customerEmail={order.customer_email}
                />
                <RefundDialog
                  orderId={order.id}
                  orderNumber={order.order_number}
                  maxRefundable={businessTransferAmount}
                  totalRefunded={totalRefunded}
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer Details */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-lg">{order.customer_name}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-lg">{order.customer_email}</p>
              </div>

              {order.customer_phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-lg">{order.customer_phone}</p>
                </div>
              )}

              <div className="pt-2">
                <Button variant="outline" asChild>
                  <Link href={`mailto:${order.customer_email}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Contact Customer
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Individual Tickets */}
      {tickets && tickets.length > 0 && (
        <OrderTicketsDisplay tickets={tickets} />
      )}

      {/* Refund History */}
      {refunds && refunds.length > 0 && (
        <RefundHistory refunds={refunds as Refund[]} />
      )}
    </div>
  )
}
