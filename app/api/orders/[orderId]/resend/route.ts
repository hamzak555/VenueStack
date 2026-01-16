import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTicketConfirmationEmail } from '@/lib/sendgrid'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params

    const supabase = await createClient()

    // Get the order with event details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, events(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Get tickets for this order with their types
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*, ticket_types(*)')
      .eq('order_id', orderId)

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError)
    }

    // Build ticket line items for email
    const ticketLineItems: { name: string; quantity: number; price: number }[] = []

    if (tickets && tickets.length > 0) {
      // Group tickets by type
      const ticketsByType: Record<string, { quantity: number; price: number }> = {}

      for (const ticket of tickets) {
        const typeName = ticket.ticket_types?.name || 'General Admission'
        if (!ticketsByType[typeName]) {
          ticketsByType[typeName] = { quantity: 0, price: ticket.price || 0 }
        }
        ticketsByType[typeName].quantity += 1
      }

      for (const typeName of Object.keys(ticketsByType)) {
        ticketLineItems.push({
          name: typeName,
          quantity: ticketsByType[typeName].quantity,
          price: ticketsByType[typeName].price,
        })
      }
    } else {
      // Fallback if no individual tickets found
      ticketLineItems.push({
        name: 'General Admission',
        quantity: order.quantity,
        price: order.subtotal / order.quantity,
      })
    }

    const event = order.events

    // Send confirmation email
    await sendTicketConfirmationEmail({
      to: order.customer_email,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      eventLocation: event.location,
      eventImageUrl: event.image_url,
      tickets: ticketLineItems,
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      promoCode: order.promo_code,
      taxAmount: order.tax_amount,
      processingFees: (order.platform_fee || 0) + (order.stripe_fee || 0),
      customerPaidFees: order.stripe_fee_payer === 'customer' || order.platform_fee_payer === 'customer',
      total: order.total,
    })

    return NextResponse.json({
      success: true,
      message: 'Tickets resent successfully',
    })
  } catch (error) {
    console.error('Resend tickets error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resend tickets' },
      { status: 500 }
    )
  }
}
