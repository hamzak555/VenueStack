import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { sendTicketRefundEmail } from '@/lib/sendgrid'
import { getBusinessSession } from '@/lib/auth/business-session'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params
    const body = await request.json()
    const { amount, reason, voidTickets } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid refund amount' },
        { status: 400 }
      )
    }

    // Get the current user session
    const session = await getBusinessSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get the order with business and event details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, events(*, businesses(*))')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Calculate the amount that was transferred to the business
    // This is total minus platform and stripe fees (what the business actually received)
    const businessTransferAmount = order.total - (order.platform_fee || 0) - (order.stripe_fee || 0)

    // Get all existing refunds for this order
    const { data: existingRefunds, error: refundsError } = await supabase
      .from('refunds')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'succeeded')

    if (refundsError) {
      console.error('Error fetching refunds:', refundsError)
      return NextResponse.json(
        { error: 'Failed to fetch refund history' },
        { status: 500 }
      )
    }

    // Calculate total already refunded
    const totalRefunded = existingRefunds?.reduce((sum, refund) => sum + parseFloat(refund.amount.toString()), 0) || 0

    // Calculate remaining refundable amount
    const remainingRefundable = businessTransferAmount - totalRefunded

    // Validate refund amount
    if (amount > remainingRefundable) {
      return NextResponse.json(
        { error: `Refund amount cannot exceed ${remainingRefundable.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Get the business's Stripe account
    const business = order.events.businesses
    if (!business.stripe_account_id) {
      return NextResponse.json(
        { error: 'Business does not have a Stripe account connected' },
        { status: 400 }
      )
    }

    // Get the payment intent - try from order first, then search if not found (for legacy orders)
    let paymentIntent

    if (order.stripe_payment_intent_id) {
      // New orders have the payment intent ID stored
      paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)
    } else {
      // Legacy orders: search for payment intent using metadata
      console.log('Searching for payment intent for legacy order...')

      try {
        const stripePayments = await stripe.paymentIntents.list({
          limit: 100,
        })

        if (!stripePayments || !stripePayments.data) {
          return NextResponse.json(
            { error: 'Failed to retrieve payment intents from Stripe' },
            { status: 500 }
          )
        }

        paymentIntent = stripePayments.data.find(
          pi => pi.metadata?.eventId === order.event_id &&
               pi.metadata?.customerEmail === order.customer_email &&
               Math.abs(pi.amount - Math.round(order.total * 100)) < 10 // Allow small rounding differences
        )

        if (!paymentIntent) {
          console.error('Payment intent not found. Order details:', {
            eventId: order.event_id,
            customerEmail: order.customer_email,
            total: order.total,
            totalInCents: Math.round(order.total * 100)
          })

          return NextResponse.json(
            { error: 'Payment intent not found for this order. The payment may have been processed through a different method.' },
            { status: 404 }
          )
        }
      } catch (error) {
        console.error('Error searching for payment intent:', error)
        return NextResponse.json(
          { error: 'Failed to search for payment intent in Stripe' },
          { status: 500 }
        )
      }
    }

    // Get the charge ID from the payment intent
    const chargeId = paymentIntent.latest_charge as string

    if (!chargeId) {
      return NextResponse.json(
        { error: 'Charge not found for this order' },
        { status: 404 }
      )
    }

    // Create refund in Stripe
    // Since the charge was created with on_behalf_of, the refund is processed on the platform account
    // The funds will be automatically taken from the business's transferred amount
    const stripeRefund = await stripe.refunds.create({
      charge: chargeId,
      amount: Math.round(amount * 100), // Convert to cents
      reason: 'requested_by_customer',
      reverse_transfer: true, // This reverses the transfer to the connected account
      metadata: {
        orderId,
        orderNumber: order.order_number,
        refundReason: reason || '',
      },
    })

    // Create refund record in database
    // Note: We don't use refunded_by_id as it has a foreign key constraint
    // that may not match our auth system. We just store the name for display.
    const { data: refundRecord, error: refundError } = await supabase
      .from('refunds')
      .insert({
        order_id: orderId,
        amount,
        reason,
        stripe_refund_id: stripeRefund.id,
        status: 'succeeded',
        refunded_by_name: session.name || session.email,
        voided_tickets: voidTickets || false,
      })
      .select()
      .single()

    if (refundError) {
      console.error('Error creating refund record:', refundError)
      // Note: The Stripe refund was already processed, so we log this error
      // but don't fail the request
    }

    // If voiding tickets, update all tickets for this order
    if (voidTickets) {
      const { error: voidError } = await supabase
        .from('tickets')
        .update({ status: 'invalid', updated_at: new Date().toISOString() })
        .eq('order_id', orderId)

      if (voidError) {
        console.error('Error voiding tickets:', voidError)
      }
    }

    // Update order status
    const newTotalRefunded = totalRefunded + amount
    let newStatus: 'refunded' | 'partially_refunded' | 'completed' = 'completed'

    if (newTotalRefunded >= businessTransferAmount) {
      newStatus = 'refunded'
    } else if (newTotalRefunded > 0) {
      newStatus = 'partially_refunded'
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order status:', updateError)
    }

    // Send refund email to customer
    const event = order.events
    sendTicketRefundEmail({
      to: order.customer_email,
      customerName: order.customer_name || order.customer_email.split('@')[0],
      orderNumber: order.order_number,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.start_time,
      refundAmount: amount,
    }).catch(err => console.error('Failed to send refund email:', err))

    return NextResponse.json({
      success: true,
      refund: refundRecord,
      newStatus,
      totalRefunded: newTotalRefunded,
      remainingRefundable: businessTransferAmount - newTotalRefunded,
    })
  } catch (error) {
    console.error('Refund error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process refund' },
      { status: 500 }
    )
  }
}
