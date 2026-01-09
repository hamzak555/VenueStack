import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { updateTicketTypeAvailability } from '@/lib/db/ticket-types'
import { incrementPromoCodeUsage } from '@/lib/db/promo-codes'
import { getTrackingLinkByRefCode } from '@/lib/db/tracking-links'

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
      type, // 'table_booking' or undefined (regular ticket)
      eventId,
      businessId,
      totalTickets,
      customerName,
      customerEmail,
      hasTicketTypes,
      ticketTypes: ticketTypesJson,
      quantity, // Legacy field
      promoCodeId,
      promoCode: promoCodeUsed,
      ticketSubtotal: ticketSubtotalStr,
      discountAmount: discountAmountStr,
      taxAmount: taxAmountStr,
      taxPercentage: taxPercentageStr,
      platformFee: platformFeeStr,
      stripeFee: stripeFeeStr,
      // Table booking specific fields
      tableSelections, // JSON string of section ID -> quantity
      orderDetails, // JSON string of order details array
      totalTables,
      totalTablePrice,
      // Marketing attribution tracking
      trackingRef,
    } = paymentIntent.metadata

    const supabase = await createClient()

    // Handle table booking
    if (type === 'table_booking') {
      return handleTableBookingVerification(
        paymentIntent,
        supabase,
        {
          eventId,
          businessId,
          tableSelections,
          orderDetails,
          totalTables,
          totalTablePrice,
          customerName,
          customerEmail,
          customerPhone: paymentIntent.metadata.customerPhone,
          taxAmountStr,
          taxPercentageStr,
          platformFeeStr,
          stripeFeeStr,
          trackingRef,
        }
      )
    }

    // Check if order already exists for this payment intent (idempotency check)
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('*, events(title, event_date, event_time, location, image_url)')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    // If order exists, return it (prevents duplicate orders from page refreshes)
    if (existingOrder && !existingOrderError) {
      console.log('Order already exists for payment intent:', paymentIntentId)
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        eventTitle: existingOrder.events.title,
        eventDate: existingOrder.events.event_date,
        eventTime: existingOrder.events.event_time,
        eventLocation: existingOrder.events.location,
        eventImageUrl: existingOrder.events.image_url,
        quantity: existingOrder.quantity,
        amount: existingOrder.total,
        customerName: existingOrder.customer_name,
        customerEmail: existingOrder.customer_email,
        paymentIntentId: paymentIntent.id,
      })
    }

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

    // Get amounts from metadata
    const subtotal = ticketSubtotalStr ? parseFloat(ticketSubtotalStr) : 0
    const discountAmount = discountAmountStr ? parseFloat(discountAmountStr) : 0
    const taxAmount = taxAmountStr ? parseFloat(taxAmountStr) : 0
    const taxPercentage = taxPercentageStr ? parseFloat(taxPercentageStr) : 0
    const platformFee = platformFeeStr ? parseFloat(platformFeeStr) : 0
    const stripeFee = stripeFeeStr ? parseFloat(stripeFeeStr) : 0
    const totalAmount = paymentIntent.amount / 100 // Convert from cents to dollars

    // Increment promo code usage if one was applied
    if (promoCodeId) {
      try {
        await incrementPromoCodeUsage(promoCodeId)
      } catch (error) {
        console.error('Error incrementing promo code usage:', error)
        // Continue anyway - payment succeeded
      }
    }

    // Look up tracking link ID if trackingRef is provided
    let trackingLinkId: string | null = null
    if (trackingRef) {
      try {
        const trackingLink = await getTrackingLinkByRefCode(businessId, trackingRef)
        if (trackingLink) {
          trackingLinkId = trackingLink.id
        }
      } catch (error) {
        console.error('Error looking up tracking link:', error)
        // Continue anyway - tracking is optional
      }
    }

    // Create order record
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    const ticketQuantity = parseInt(totalTickets)

    let orderId: string | null = null
    try {
      const { data: orderData, error: orderInsertError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          event_id: eventId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: paymentIntent.metadata.customerPhone || null,
          quantity: ticketQuantity,
          subtotal: subtotal,
          discount_amount: discountAmount,
          promo_code: promoCodeUsed || null,
          tax_amount: taxAmount,
          tax_percentage: taxPercentage,
          platform_fee: platformFee,
          stripe_fee: stripeFee,
          total: totalAmount,
          stripe_payment_intent_id: paymentIntentId,
          status: 'completed',
          tracking_ref: trackingRef || null,
          tracking_link_id: trackingLinkId,
        })
        .select()
        .single()

      if (!orderInsertError && orderData) {
        orderId = orderData.id

        // Create individual tickets
        const ticketsToCreate = []

        // If ticket types are used, assign tickets to their types
        if (hasTicketTypes === 'true' && ticketTypesJson) {
          try {
            const ticketTypesMetadata = JSON.parse(ticketTypesJson)

            // Create tickets for each ticket type
            for (const [ticketTypeId, data] of Object.entries(ticketTypesMetadata)) {
              const { quantity: typeQuantity, price } = data as { name: string; price: number; quantity: number }

              for (let i = 0; i < typeQuantity; i++) {
                const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
                const qrCodeData = `${ticketNumber}|${eventId}|${orderId}`

                ticketsToCreate.push({
                  order_id: orderId,
                  event_id: eventId,
                  ticket_type_id: ticketTypeId,
                  ticket_number: ticketNumber,
                  price: price,
                  qr_code_data: qrCodeData,
                  status: 'valid'
                })
              }
            }
          } catch (error) {
            console.error('Error creating tickets with types:', error)
            // Fallback to creating tickets without types
            for (let i = 0; i < ticketQuantity; i++) {
              const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
              const qrCodeData = `${ticketNumber}|${eventId}|${orderId}`

              ticketsToCreate.push({
                order_id: orderId,
                event_id: eventId,
                ticket_number: ticketNumber,
                price: subtotal / ticketQuantity,
                qr_code_data: qrCodeData,
                status: 'valid'
              })
            }
          }
        } else {
          // Legacy: Create tickets without ticket types
          for (let i = 0; i < ticketQuantity; i++) {
            const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
            const qrCodeData = `${ticketNumber}|${eventId}|${orderId}`

            ticketsToCreate.push({
              order_id: orderId,
              event_id: eventId,
              ticket_number: ticketNumber,
              price: subtotal / ticketQuantity,
              qr_code_data: qrCodeData,
              status: 'valid'
            })
          }
        }

        await supabase
          .from('tickets')
          .insert(ticketsToCreate)
      }
    } catch (error) {
      console.error('Error creating order record:', error)
      // Continue anyway - payment succeeded and tickets updated
    }

    // Return order details
    return NextResponse.json({
      success: true,
      orderId: orderId,
      orderNumber: orderNumber,
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

// Handle table booking verification
async function handleTableBookingVerification(
  paymentIntent: any,
  supabase: any,
  metadata: {
    eventId: string
    businessId: string
    tableSelections: string // JSON string
    orderDetails: string // JSON string
    totalTables: string
    totalTablePrice: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    taxAmountStr?: string
    taxPercentageStr?: string
    platformFeeStr?: string
    stripeFeeStr?: string
    trackingRef?: string
  }
) {
  const {
    eventId,
    businessId,
    tableSelections,
    orderDetails,
    totalTables,
    customerName,
    customerEmail,
    customerPhone,
    trackingRef,
  } = metadata

  // Look up tracking link ID if trackingRef is provided
  let trackingLinkId: string | null = null
  if (trackingRef) {
    try {
      const trackingLink = await getTrackingLinkByRefCode(businessId, trackingRef)
      if (trackingLink) {
        trackingLinkId = trackingLink.id
      }
    } catch (error) {
      console.error('Error looking up tracking link:', error)
      // Continue anyway - tracking is optional
    }
  }

  // Check if table bookings already exist for this payment intent
  const { data: existingBookings, error: existingBookingsError } = await supabase
    .from('table_bookings')
    .select('*, event_table_sections(section_name), events(title, event_date, event_time, location, image_url)')
    .eq('order_id', paymentIntent.id)

  if (existingBookings && existingBookings.length > 0 && !existingBookingsError) {
    // Bookings already exist, return summary
    const firstBooking = existingBookings[0]
    const sectionSummary = existingBookings.reduce((acc: Record<string, number>, b: any) => {
      const name = b.event_table_sections.section_name
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {})
    const sectionNames = Object.entries(sectionSummary).map(([name, count]) => `${count}x ${name}`).join(', ')

    return NextResponse.json({
      success: true,
      type: 'table_booking',
      bookingIds: existingBookings.map((b: any) => b.id),
      eventTitle: firstBooking.events.title,
      eventDate: firstBooking.events.event_date,
      eventTime: firstBooking.events.event_time,
      eventLocation: firstBooking.events.location,
      eventImageUrl: firstBooking.events.image_url,
      sectionName: sectionNames,
      tableNumbers: existingBookings.map((b: any) => b.table_number),
      totalTables: existingBookings.length,
      amount: paymentIntent.amount / 100,
      customerName: firstBooking.customer_name,
      customerEmail: firstBooking.customer_email,
      paymentIntentId: paymentIntent.id,
    })
  }

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('title, event_date, event_time, location, image_url')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: 'Event not found' },
      { status: 404 }
    )
  }

  // Parse order details
  let parsedOrderDetails: { sectionId: string; sectionName: string; quantity: number; price: number }[] = []
  try {
    parsedOrderDetails = JSON.parse(orderDetails)
  } catch (e) {
    return NextResponse.json(
      { error: 'Invalid order details' },
      { status: 400 }
    )
  }

  const createdBookings: any[] = []
  const sectionUpdates: { sectionId: string; decrement: number }[] = []

  // Process each section
  for (const detail of parsedOrderDetails) {
    const { sectionId, sectionName, quantity } = detail

    // Get table section
    const { data: tableSection, error: sectionError } = await supabase
      .from('event_table_sections')
      .select('*')
      .eq('id', sectionId)
      .single()

    if (sectionError || !tableSection) {
      console.error(`Table section not found: ${sectionId}`)
      continue
    }

    // Create bookings for each table in this section (table_number left null for business to assign)
    for (let i = 0; i < quantity; i++) {
      // Create table booking record with amount (price per table)
      // table_number is left null - business will assign specific table later
      const { data: bookingData, error: bookingError } = await supabase
        .from('table_bookings')
        .insert({
          event_id: eventId,
          event_table_section_id: sectionId,
          table_number: null,
          order_id: paymentIntent.id,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          amount: detail.price, // Store the price per table
          status: 'confirmed',
          tracking_ref: trackingRef || null,
          tracking_link_id: trackingLinkId,
        })
        .select()
        .single()

      if (!bookingError && bookingData) {
        createdBookings.push({
          ...bookingData,
          sectionName,
        })
      }
    }

    // Track section update
    sectionUpdates.push({ sectionId, decrement: quantity })
  }

  // Update available tables count for each section
  for (const update of sectionUpdates) {
    const { data: currentSection } = await supabase
      .from('event_table_sections')
      .select('available_tables')
      .eq('id', update.sectionId)
      .single()

    if (currentSection) {
      await supabase
        .from('event_table_sections')
        .update({ available_tables: Math.max(0, currentSection.available_tables - update.decrement) })
        .eq('id', update.sectionId)
    }
  }

  // Build summary for response
  const sectionSummary = createdBookings.reduce((acc: Record<string, number>, b: any) => {
    acc[b.sectionName] = (acc[b.sectionName] || 0) + 1
    return acc
  }, {})
  const sectionNames = Object.entries(sectionSummary).map(([name, count]) => `${count}x ${name}`).join(', ')

  return NextResponse.json({
    success: true,
    type: 'table_booking',
    bookingIds: createdBookings.map(b => b.id),
    eventTitle: event.title,
    eventDate: event.event_date,
    eventTime: event.event_time,
    eventLocation: event.location,
    eventImageUrl: event.image_url,
    sectionName: sectionNames,
    tableNumbers: createdBookings.map(b => b.table_number),
    totalTables: createdBookings.length,
    amount: paymentIntent.amount / 100,
    customerName,
    customerEmail,
    paymentIntentId: paymentIntent.id,
  })
}
