import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { updateTicketTypeAvailability } from '@/lib/db/ticket-types'
import { incrementPromoCodeUsage } from '@/lib/db/promo-codes'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const paymentIntentId = searchParams.get('payment_intent')

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing payment intent ID' },
        { status: 400 }
      )
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    // Get metadata from the payment intent
    const {
      eventId,
      businessId,
      totalTickets,
      customerName,
      customerEmail,
      hasTicketTypes,
      ticketTypes: ticketTypesJson,
      quantity, // Legacy field
      promoCodeId,
      discountAmount: discountAmountStr,
    } = paymentIntent.metadata

    const supabase = await createClient()

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, ticket_price, available_tickets, event_date, event_time, location, image_url')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Update ticket availability based on ticket type
    if (hasTicketTypes === 'true' && ticketTypesJson) {
      try {
        const ticketTypesMetadata = JSON.parse(ticketTypesJson)

        // Update each ticket type's availability
        for (const [ticketTypeId, data] of Object.entries(ticketTypesMetadata)) {
          const { quantity } = data as { name: string; price: number; quantity: number }
          await updateTicketTypeAvailability(ticketTypeId, -quantity)
        }
      } catch (error) {
        console.error('Error updating ticket type availability:', error)
        // Continue anyway - payment succeeded
      }
    } else {
      // Legacy: Update event's available_tickets
      const ticketCount = parseInt(quantity || totalTickets)
      const newAvailableTickets = event.available_tickets - ticketCount
      await supabase
        .from('events')
        .update({ available_tickets: newAvailableTickets })
        .eq('id', eventId)
    }

    // Calculate discount and subtotal
    const discountAmount = discountAmountStr ? parseFloat(discountAmountStr) : 0
    const totalAmount = paymentIntent.amount / 100 // Convert from cents to dollars
    const subtotal = totalAmount + discountAmount

    // Increment promo code usage if one was applied
    if (promoCodeId) {
      try {
        await incrementPromoCodeUsage(promoCodeId)
      } catch (error) {
        console.error('Error incrementing promo code usage:', error)
        // Continue anyway - payment succeeded
      }
    }

    // Create order record
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    try {
      await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          event_id: eventId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: paymentIntent.metadata.customerPhone || null,
          subtotal: subtotal,
          discount_amount: discountAmount,
          total: totalAmount,
          status: 'completed',
        })
    } catch (error) {
      console.error('Error creating order record:', error)
      // Continue anyway - payment succeeded and tickets updated
    }

    // Return order details
    return NextResponse.json({
      success: true,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      eventLocation: event.location,
      eventImageUrl: event.image_url,
      quantity: parseInt(totalTickets),
      amount: paymentIntent.amount / 100, // Convert from cents to dollars
      customerName,
      customerEmail,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify payment' },
      { status: 500 }
    )
  }
}
