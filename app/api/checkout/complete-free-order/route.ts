import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTicketTypesByIds, decrementTicketQuantity } from '@/lib/db/ticket-types'
import { getPromoCodeById, incrementPromoCodeUsage } from '@/lib/db/promo-codes'
import { getTrackingLinkByRefCode } from '@/lib/db/tracking-links'
import { sendTicketConfirmationEmail } from '@/lib/sendgrid'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventId,
      quantity, // For legacy single-price tickets
      ticketSelections, // For multiple ticket types: [{ticketTypeId, quantity}]
      customerName,
      customerEmail,
      customerPhone,
      promoCodeId,
      trackingRef // Marketing attribution tracking
    } = body

    if (!eventId || !customerName || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get event details with only needed columns
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        business_id,
        ticket_price,
        available_tickets,
        status,
        event_date,
        event_time,
        location,
        image_url,
        businesses (
          id,
          tax_percentage,
          stripe_account_id
        )
      `)
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    let totalAmount = 0
    let totalTickets = 0
    let ticketTypeMetadata: Record<string, { name: string; price: number; quantity: number }> = {}

    // Handle multiple ticket types - batch fetch all at once to prevent N+1
    if (ticketSelections && Array.isArray(ticketSelections)) {
      // Extract all ticket type IDs and fetch them in one query
      const ticketTypeIds = ticketSelections.map((s: { ticketTypeId: string }) => s.ticketTypeId)
      const ticketTypesMap = await getTicketTypesByIds(ticketTypeIds)

      // Validate all ticket types
      for (const selection of ticketSelections) {
        const ticketType = ticketTypesMap.get(selection.ticketTypeId)

        if (!ticketType) {
          return NextResponse.json(
            { error: `Ticket type not found: ${selection.ticketTypeId}` },
            { status: 404 }
          )
        }

        if (!ticketType.is_active) {
          return NextResponse.json(
            { error: `Ticket type "${ticketType.name}" is not available` },
            { status: 400 }
          )
        }

        if (ticketType.available_quantity < selection.quantity) {
          return NextResponse.json(
            { error: `Not enough "${ticketType.name}" tickets available` },
            { status: 400 }
          )
        }

        const ticketTotal = Math.round(ticketType.price * 100) * selection.quantity
        totalAmount += ticketTotal
        totalTickets += selection.quantity

        ticketTypeMetadata[ticketType.id] = {
          name: ticketType.name,
          price: ticketType.price,
          quantity: selection.quantity
        }
      }
    }
    // Handle legacy single-price tickets
    else if (quantity) {
      if (event.available_tickets < quantity) {
        return NextResponse.json(
          { error: 'Not enough tickets available' },
          { status: 400 }
        )
      }

      const unitAmount = Math.round(event.ticket_price * 100)
      totalAmount = unitAmount * quantity
      totalTickets = quantity
    } else {
      return NextResponse.json(
        { error: 'No tickets selected' },
        { status: 400 }
      )
    }

    // Store the original ticket subtotal before any discounts
    const ticketSubtotalInCents = totalAmount

    // Apply promo code discount if provided
    let discountAmount = 0
    let promoCode = null
    if (promoCodeId) {
      promoCode = await getPromoCodeById(promoCodeId)

      if (promoCode && promoCode.is_active) {
        if (promoCode.discount_type === 'percentage') {
          discountAmount = Math.round((totalAmount * promoCode.discount_value) / 100)
        } else if (promoCode.discount_type === 'fixed') {
          discountAmount = Math.min(Math.round(promoCode.discount_value * 100), totalAmount)
        }

        totalAmount = Math.max(0, totalAmount - discountAmount)
      }
    }

    // Verify this is actually a free order
    if (totalAmount > 0) {
      return NextResponse.json(
        { error: 'This endpoint is only for free orders. Total amount must be $0.' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderNumber = nanoid(10).toUpperCase()

    // Look up tracking link ID if trackingRef is provided
    let trackingLinkId: string | null = null
    if (trackingRef) {
      try {
        const trackingLink = await getTrackingLinkByRefCode(event.business_id, trackingRef)
        if (trackingLink) {
          trackingLinkId = trackingLink.id
        }
      } catch (error) {
        console.error('Error looking up tracking link:', error)
        // Continue anyway - tracking is optional
      }
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        event_id: eventId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        quantity: totalTickets,
        subtotal: ticketSubtotalInCents / 100,
        discount_amount: discountAmount / 100,
        tax_amount: 0,
        platform_fee: 0,
        stripe_fee: 0,
        total: 0,
        status: 'completed',
        promo_code: promoCode?.code || null,
        tracking_ref: trackingRef || null,
        tracking_link_id: trackingLinkId,
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // Create individual tickets
    const ticketsToCreate = []

    if (ticketSelections && Array.isArray(ticketSelections)) {
      for (const selection of ticketSelections) {
        const ticketType = ticketTypeMetadata[selection.ticketTypeId]

        for (let i = 0; i < selection.quantity; i++) {
          const ticketNumber: string = `${orderNumber}-${ticketsToCreate.length + 1}`
          ticketsToCreate.push({
            order_id: order.id,
            event_id: eventId,
            ticket_type_id: selection.ticketTypeId,
            ticket_number: ticketNumber,
            price: ticketType.price,
            qr_code_data: `ticket:${ticketNumber}`,
            status: 'valid',
          })
        }

        // Atomically decrement ticket quantity (single query instead of 3)
        await decrementTicketQuantity(selection.ticketTypeId, selection.quantity)
      }
    } else if (quantity) {
      // Legacy single-price tickets
      for (let i = 0; i < quantity; i++) {
        const ticketNumber = `${orderNumber}-${i + 1}`
        ticketsToCreate.push({
          order_id: order.id,
          event_id: eventId,
          ticket_number: ticketNumber,
          price: event.ticket_price || 0,
          qr_code_data: `ticket:${ticketNumber}`,
          status: 'valid',
        })
      }

      // Update event availability
      await supabase
        .from('events')
        .update({
          available_tickets: event.available_tickets - quantity
        })
        .eq('id', eventId)
    }

    // Insert all tickets
    if (ticketsToCreate.length > 0) {
      const { error: ticketsError } = await supabase
        .from('tickets')
        .insert(ticketsToCreate)

      if (ticketsError) {
        console.error('Error creating tickets:', ticketsError)
      }
    }

    // Increment promo code usage if used
    if (promoCode) {
      await incrementPromoCodeUsage(promoCode.id)
    }

    // Build ticket line items for email
    const ticketLineItems = Object.values(ticketTypeMetadata).map((t) => ({
      name: t.name,
      quantity: t.quantity,
      price: t.price,
    }))

    // Fallback for legacy single-price tickets
    if (ticketLineItems.length === 0 && quantity) {
      ticketLineItems.push({
        name: 'General Admission',
        quantity: quantity,
        price: event.ticket_price || 0,
      })
    }

    // Send confirmation email (fire and forget)
    console.log('Sending ticket confirmation email to:', customerEmail, 'for order:', order.order_number)
    sendTicketConfirmationEmail({
      to: customerEmail,
      customerName,
      orderNumber: order.order_number,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      eventLocation: event.location,
      eventImageUrl: event.image_url,
      tickets: ticketLineItems,
      subtotal: ticketSubtotalInCents / 100,
      discountAmount: discountAmount / 100,
      promoCode: promoCode?.code,
      taxAmount: 0,
      platformFee: 0,
      total: 0,
    }).catch((err) => console.error('Failed to send ticket confirmation email:', err))

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
    })
  } catch (error) {
    console.error('Free order completion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete order' },
      { status: 500 }
    )
  }
}
