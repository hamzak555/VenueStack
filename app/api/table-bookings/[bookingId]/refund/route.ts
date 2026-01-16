import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { isServerRole, type BusinessRole } from '@/lib/auth/roles'
import { sendTableRefundEmail } from '@/lib/sendgrid'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params
    const body = await request.json()
    const { amount, reason } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid refund amount' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the table booking with event and business details
    const { data: booking, error: bookingError } = await supabase
      .from('table_bookings')
      .select(`
        *,
        events (
          *,
          businesses (*)
        ),
        event_table_sections (*)
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Table booking not found' },
        { status: 404 }
      )
    }

    // Verify user has access and is not a server
    const session = await verifyBusinessAccess(booking.events.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Servers cannot process refunds
    if (isServerRole(session.role as BusinessRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to process refunds' },
        { status: 403 }
      )
    }

    if (!booking.order_id) {
      return NextResponse.json(
        { error: 'No payment found for this booking' },
        { status: 400 }
      )
    }

    // Get all bookings for this order (same payment intent)
    const { data: allBookingsInOrder } = await supabase
      .from('table_bookings')
      .select('id, amount')
      .eq('order_id', booking.order_id)
      .neq('status', 'cancelled')

    // Calculate total order amount
    const totalOrderAmount = allBookingsInOrder?.reduce((sum, b) => sum + (parseFloat(b.amount?.toString() || '0')), 0) || 0

    // Get all existing refunds for this order
    const { data: existingRefunds, error: refundsError } = await supabase
      .from('table_booking_refunds')
      .select('*')
      .eq('order_id', booking.order_id)
      .eq('status', 'succeeded')

    if (refundsError) {
      console.error('Error fetching refunds:', refundsError)
      // Continue anyway - table might not exist yet
    }

    // Calculate total already refunded for this order
    const totalRefunded = existingRefunds?.reduce((sum, refund) => sum + parseFloat(refund.amount.toString()), 0) || 0

    // Calculate remaining refundable amount for the entire order
    const remainingRefundable = totalOrderAmount - totalRefunded

    // Validate refund amount
    if (amount > remainingRefundable) {
      return NextResponse.json(
        { error: `Refund amount cannot exceed ${remainingRefundable.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Get the business's Stripe account
    const business = booking.events.businesses
    if (!business.stripe_account_id) {
      return NextResponse.json(
        { error: 'Business does not have a Stripe account connected' },
        { status: 400 }
      )
    }

    // Get the payment intent
    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(booking.order_id)
    } catch (error) {
      console.error('Error retrieving payment intent:', error)
      return NextResponse.json(
        { error: 'Payment intent not found' },
        { status: 404 }
      )
    }

    // Get the charge ID from the payment intent
    const chargeId = paymentIntent.latest_charge as string

    if (!chargeId) {
      return NextResponse.json(
        { error: 'Charge not found for this booking' },
        { status: 404 }
      )
    }

    // Create refund in Stripe
    const stripeRefund = await stripe.refunds.create({
      charge: chargeId,
      amount: Math.round(amount * 100), // Convert to cents
      reason: 'requested_by_customer',
      reverse_transfer: true,
      metadata: {
        tableBookingId: bookingId,
        orderId: booking.order_id,
        refundReason: reason || '',
      },
    })

    // Create refund record in database
    // Note: We don't use refunded_by_id as it has a foreign key constraint that may fail
    // if the user table structure differs. We just store the name for display.
    const { data: refundRecord, error: refundError } = await supabase
      .from('table_booking_refunds')
      .insert({
        table_booking_id: bookingId,
        order_id: booking.order_id,
        amount,
        reason,
        stripe_refund_id: stripeRefund.id,
        status: 'succeeded',
        refunded_by_name: session.name || session.email,
      })
      .select()
      .single()

    if (refundError) {
      console.error('Error creating refund record:', refundError)
      // Note: The Stripe refund was already processed
    }

    // Calculate new total refunded (don't auto-cancel - let business cancel manually)
    const newTotalRefunded = totalRefunded + amount

    // Keep the current status - refunds don't affect reservation status
    // Business can manually cancel the reservation if needed
    const newStatus = booking.status

    // Send refund email to customer
    const event = booking.events
    sendTableRefundEmail({
      to: booking.customer_email,
      customerName: booking.customer_name || booking.customer_email.split('@')[0],
      reservationNumber: booking.reservation_number || bookingId,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      refundAmount: amount,
    }).catch(err => console.error('Failed to send table refund email:', err))

    return NextResponse.json({
      success: true,
      refund: refundRecord,
      newStatus,
      totalRefunded: newTotalRefunded,
      remainingRefundable: totalOrderAmount - newTotalRefunded,
    })
  } catch (error) {
    console.error('Refund error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process refund' },
      { status: 500 }
    )
  }
}
