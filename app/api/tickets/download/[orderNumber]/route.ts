import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 350,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  businessName: {
    fontSize: 14,
    color: '#A1A1AA',
    marginBottom: 5,
    textAlign: 'center',
  },
  orderNumber: {
    fontSize: 11,
    color: '#71717A',
    marginBottom: 30,
    textAlign: 'center',
  },
  eventImageContainer: {
    width: '70%',
    height: 220,
    marginBottom: 20,
    marginLeft: 'auto',
    marginRight: 'auto',
    overflow: 'hidden',
    borderRadius: 12,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#FAFAFA',
    textAlign: 'center',
  },
  eventDetails: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 6,
    textAlign: 'center',
  },
  eventDescription: {
    fontSize: 11,
    color: '#D4D4D8',
    marginTop: 10,
    marginBottom: 25,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 25,
    marginBottom: 10,
    color: '#FAFAFA',
    textAlign: 'center',
  },
  customerInfo: {
    fontSize: 11,
    marginBottom: 6,
    color: '#D4D4D8',
    textAlign: 'center',
  },
  ticketsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ticketCard: {
    backgroundColor: '#18181B',
    border: '2px solid #27272A',
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  ticketLeft: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#FAFAFA',
  },
  ticketCode: {
    fontSize: 8,
    color: '#A1A1AA',
    marginBottom: 15,
    fontFamily: 'Courier',
  },
  ticketPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ticketStatus: {
    fontSize: 11,
    color: '#22C55E',
    marginTop: 10,
    fontWeight: 'bold',
  },
  ticketRight: {
    alignItems: 'center',
  },
  qrCode: {
    width: 110,
    height: 110,
    marginBottom: 8,
  },
  ticketTypeName: {
    fontSize: 10,
    color: '#A1A1AA',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  footer: {
    fontSize: 10,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 30,
    paddingTop: 20,
    borderTop: '1px solid #27272A',
    lineHeight: 1.5,
  },
  paymentSummary: {
    backgroundColor: '#18181B',
    border: '2px solid #27272A',
    borderRadius: 8,
    padding: 20,
    marginTop: 25,
    marginBottom: 25,
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#D4D4D8',
  },
  summaryValue: {
    fontSize: 12,
    color: '#FAFAFA',
    fontWeight: 'bold',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid #27272A',
  },
  summaryTotalLabel: {
    fontSize: 14,
    color: '#FAFAFA',
    fontWeight: 'bold',
  },
  summaryTotalValue: {
    fontSize: 14,
    color: '#FAFAFA',
    fontWeight: 'bold',
  },
})

/**
 * GET /api/tickets/download/[orderNumber]
 * Downloads ticket PDF by order number (for email links)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Missing order number' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get order by order_number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        event:events (
          title,
          description,
          event_date,
          event_time,
          location,
          image_url,
          business:businesses (
            name,
            tax_percentage
          )
        )
      `)
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Extract event data
    const event = Array.isArray(order.event) ? order.event[0] : order.event

    if (!event) {
      console.error('Event data not found in order')
      return NextResponse.json(
        { error: 'Event data not found' },
        { status: 404 }
      )
    }

    // Extract business data
    const business = Array.isArray(event.business) ? event.business[0] : event.business

    // Get tickets for this order
    let { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('order_id', order.id)

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError)
    }

    // Fetch ticket types if tickets have ticket_type_id
    if (tickets && tickets.length > 0) {
      const ticketTypeIds = tickets
        .map(t => t.ticket_type_id)
        .filter(Boolean)

      if (ticketTypeIds.length > 0) {
        const { data: ticketTypes, error: typesError } = await supabase
          .from('ticket_types')
          .select('id, name')
          .in('id', ticketTypeIds)

        if (!typesError && ticketTypes) {
          const typeMap = new Map(ticketTypes.map(tt => [tt.id, tt]))
          tickets = tickets.map(ticket => ({
            ...ticket,
            ticket_type: ticket.ticket_type_id ? typeMap.get(ticket.ticket_type_id) : null
          }))
        }
      }
    }

    // If no tickets exist, create them
    if (!tickets || tickets.length === 0) {
      const ticketsToCreate = []
      for (let i = 0; i < order.quantity; i++) {
        const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        const qrCodeData = `${ticketNumber}|${order.event_id}|${order.id}`

        ticketsToCreate.push({
          order_id: order.id,
          event_id: order.event_id,
          ticket_number: ticketNumber,
          price: (order.subtotal || 0) / (order.quantity || 1),
          qr_code_data: qrCodeData,
          status: 'valid'
        })
      }

      const { data: createdTickets, error: createError } = await supabase
        .from('tickets')
        .insert(ticketsToCreate)
        .select()

      if (createError) {
        console.error('Error creating tickets:', createError)
        return NextResponse.json(
          { error: 'Failed to create tickets' },
          { status: 500 }
        )
      }

      tickets = createdTickets || []
    }

    // Generate QR codes for all tickets
    const ticketsWithQR = await Promise.all(
      tickets.map(async (ticket) => {
        const qrCodeDataUrl = await QRCode.toDataURL(ticket.qr_code_data, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
        return { ...ticket, qrCodeDataUrl }
      })
    )

    // Format event date and time
    const eventDate = new Date(event.event_date)
    const dateStr = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    let timeStr = ''
    if (event.event_time) {
      const [hours, minutes] = event.event_time.split(':').map(Number)
      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      timeStr = `${displayHours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`
    }

    // Create PDF document
    const pages = []

    // First page: Header and event information
    const firstPageChildren: React.ReactElement[] = [
      React.createElement(Text, { style: styles.header }, 'Your Tickets'),
    ]

    if (business?.name) {
      firstPageChildren.push(
        React.createElement(Text, { style: styles.businessName }, business.name)
      )
    }

    firstPageChildren.push(
      React.createElement(Text, { style: styles.orderNumber }, `Order #${order.order_number}`)
    )

    if (event.image_url) {
      firstPageChildren.push(
        React.createElement(
          View,
          { style: styles.eventImageContainer },
          React.createElement(Image, { src: event.image_url, style: styles.eventImage })
        )
      )
    }

    firstPageChildren.push(
      React.createElement(Text, { style: styles.eventTitle }, event.title),
      React.createElement(
        Text,
        { style: styles.eventDetails },
        `${dateStr}${timeStr ? ` at ${timeStr}` : ''}`
      )
    )

    if (event.location) {
      firstPageChildren.push(
        React.createElement(Text, { style: styles.eventDetails }, event.location)
      )
    }

    if (event.description) {
      firstPageChildren.push(
        React.createElement(Text, { style: styles.eventDescription }, event.description)
      )
    }

    firstPageChildren.push(
      React.createElement(Text, { style: styles.sectionTitle }, 'Customer Information'),
      React.createElement(Text, { style: styles.customerInfo }, `Name: ${order.customer_name}`),
      React.createElement(Text, { style: styles.customerInfo }, `Email: ${order.customer_email}`)
    )

    // Payment summary
    const paymentSummaryChildren = []

    paymentSummaryChildren.push(
      React.createElement(
        View,
        { style: styles.summaryRow },
        React.createElement(Text, { style: styles.summaryLabel }, `Subtotal (${order.quantity} ${order.quantity === 1 ? 'ticket' : 'tickets'})`),
        React.createElement(Text, { style: styles.summaryValue }, `$${parseFloat(order.subtotal || 0).toFixed(2)}`)
      )
    )

    if (order.discount_amount && parseFloat(order.discount_amount) > 0) {
      paymentSummaryChildren.push(
        React.createElement(
          View,
          { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, order.promo_code ? `Discount (${order.promo_code})` : 'Discount'),
          React.createElement(Text, { style: styles.summaryValue }, `-$${parseFloat(order.discount_amount).toFixed(2)}`)
        )
      )
    }

    if (order.tax_amount && parseFloat(order.tax_amount) > 0) {
      let taxLabel = 'Tax'
      if (business?.tax_percentage) {
        taxLabel = `Tax (${business.tax_percentage}%)`
      }

      paymentSummaryChildren.push(
        React.createElement(
          View,
          { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, taxLabel),
          React.createElement(Text, { style: styles.summaryValue }, `$${parseFloat(order.tax_amount).toFixed(2)}`)
        )
      )
    }

    // Only show processing fees if customer paid them
    const customerPaidFees = order.stripe_fee_payer === 'customer' || order.platform_fee_payer === 'customer'
    const totalProcessingFee = (parseFloat(order.platform_fee || 0) + parseFloat(order.stripe_fee || 0))
    if (customerPaidFees && totalProcessingFee > 0) {
      paymentSummaryChildren.push(
        React.createElement(
          View,
          { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, 'Processing Fee'),
          React.createElement(Text, { style: styles.summaryValue }, `$${totalProcessingFee.toFixed(2)}`)
        )
      )
    }

    paymentSummaryChildren.push(
      React.createElement(
        View,
        { style: styles.summaryTotal },
        React.createElement(Text, { style: styles.summaryTotalLabel }, 'Total Paid'),
        React.createElement(Text, { style: styles.summaryTotalValue }, `$${parseFloat(order.total || 0).toFixed(2)}`)
      )
    )

    firstPageChildren.push(
      React.createElement(Text, { style: styles.sectionTitle }, 'Payment Summary'),
      React.createElement(
        View,
        { style: styles.paymentSummary },
        ...paymentSummaryChildren
      ),
      React.createElement(Text, { style: styles.ticketsHeader }, 'Your Tickets')
    )

    // Split tickets into pages
    const TICKETS_PER_PAGE = 3
    const ticketGroups = []
    for (let i = 0; i < ticketsWithQR.length; i += TICKETS_PER_PAGE) {
      ticketGroups.push(ticketsWithQR.slice(i, i + TICKETS_PER_PAGE))
    }

    if (ticketGroups.length > 0) {
      ticketGroups[0].forEach((ticket, index) => {
        const ticketType = Array.isArray(ticket.ticket_type) ? ticket.ticket_type[0] : ticket.ticket_type
        const ticketTypeName = ticketType?.name || `Ticket #${index + 1}`

        firstPageChildren.push(
          React.createElement(
            View,
            { key: ticket.id, style: styles.ticketCard },
            React.createElement(
              View,
              { style: styles.ticketLeft },
              React.createElement(Text, { style: styles.ticketNumber }, ticketTypeName),
              React.createElement(Text, { style: styles.ticketCode }, ticket.ticket_number),
              React.createElement(Text, { style: styles.ticketPrice }, `$${parseFloat(ticket.price).toFixed(2)}`),
              React.createElement(Text, { style: styles.ticketStatus }, 'Valid')
            ),
            React.createElement(
              View,
              { style: styles.ticketRight },
              React.createElement(Image, { src: ticket.qrCodeDataUrl, style: styles.qrCode }),
              React.createElement(Text, { style: styles.ticketTypeName }, ticketTypeName)
            )
          )
        )
      })

      if (ticketGroups.length === 1) {
        firstPageChildren.push(
          React.createElement(
            Text,
            { style: styles.footer },
            'Important: Please bring this ticket (printed or on your phone) to the event.\nEach QR code is unique and can only be used once for entry.'
          )
        )
      }
    }

    pages.push(
      React.createElement(
        Page,
        { key: 'page-0', size: { width: 400, height: 842 }, style: styles.page },
        React.createElement(
          View,
          { style: styles.contentWrapper },
          ...firstPageChildren
        )
      )
    )

    // Additional pages for more tickets
    for (let groupIndex = 1; groupIndex < ticketGroups.length; groupIndex++) {
      const ticketGroup = ticketGroups[groupIndex]
      const pageChildren: React.ReactElement[] = [
        React.createElement(Text, { style: styles.ticketsHeader }, 'Your Tickets (continued)')
      ]

      ticketGroup.forEach((ticket, indexInGroup) => {
        const overallIndex = (groupIndex * TICKETS_PER_PAGE) + indexInGroup
        const ticketType = Array.isArray(ticket.ticket_type) ? ticket.ticket_type[0] : ticket.ticket_type
        const ticketTypeName = ticketType?.name || `Ticket #${overallIndex + 1}`

        pageChildren.push(
          React.createElement(
            View,
            { key: ticket.id, style: styles.ticketCard },
            React.createElement(
              View,
              { style: styles.ticketLeft },
              React.createElement(Text, { style: styles.ticketNumber }, ticketTypeName),
              React.createElement(Text, { style: styles.ticketCode }, ticket.ticket_number),
              React.createElement(Text, { style: styles.ticketPrice }, `$${parseFloat(ticket.price).toFixed(2)}`),
              React.createElement(Text, { style: styles.ticketStatus }, 'Valid')
            ),
            React.createElement(
              View,
              { style: styles.ticketRight },
              React.createElement(Image, { src: ticket.qrCodeDataUrl, style: styles.qrCode }),
              React.createElement(Text, { style: styles.ticketTypeName }, ticketTypeName)
            )
          )
        )
      })

      if (groupIndex === ticketGroups.length - 1) {
        pageChildren.push(
          React.createElement(
            Text,
            { style: styles.footer },
            'Important: Please bring this ticket (printed or on your phone) to the event.\nEach QR code is unique and can only be used once for entry.'
          )
        )
      }

      pages.push(
        React.createElement(
          Page,
          { key: `page-${groupIndex}`, size: { width: 400, height: 842 }, style: styles.page },
          React.createElement(
            View,
            { style: styles.contentWrapper },
            ...pageChildren
          )
        )
      )
    }

    const MyDocument = React.createElement(
      Document,
      null,
      ...pages
    )

    // Generate PDF
    const pdfBlob = await pdf(MyDocument).toBlob()
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tickets-${order.order_number}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
