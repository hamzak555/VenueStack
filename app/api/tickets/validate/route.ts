import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { qrCodeData, businessId } = await request.json()

    if (!qrCodeData || !businessId) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Missing required fields'
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Parse QR code data: format is "ticketNumber|eventId|orderId"
    const parts = qrCodeData.split('|')
    if (parts.length !== 3) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid QR code format'
      })
    }

    const [ticketNumber, eventId, orderId] = parts

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        event:events (
          title,
          event_date,
          event_time,
          location,
          business_id
        ),
        order:orders (
          customer_name,
          customer_email
        )
      `)
      .eq('ticket_number', ticketNumber)
      .eq('qr_code_data', qrCodeData)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({
        valid: false,
        message: 'Ticket not found'
      })
    }

    // Verify ticket belongs to this business
    if (ticket.event.business_id !== businessId) {
      return NextResponse.json({
        valid: false,
        message: 'This ticket does not belong to your business'
      })
    }

    // Check if ticket is already checked in (either by checked_in_at or status being 'used')
    const alreadyCheckedIn = ticket.checked_in_at !== null || ticket.status === 'used'

    // Check if ticket status is invalid or cancelled (not scannable)
    if (ticket.status === 'invalid' || ticket.status === 'cancelled') {
      return NextResponse.json({
        valid: false,
        message: `Ticket is ${ticket.status}`,
        ticket: {
          ticketNumber: ticket.ticket_number,
          eventTitle: ticket.event.title,
          customerName: ticket.order.customer_name,
          customerEmail: ticket.order.customer_email,
          price: parseFloat(ticket.price),
          status: ticket.status,
          checkedInAt: ticket.checked_in_at,
          eventDate: ticket.event.event_date,
          eventTime: ticket.event.event_time,
          location: ticket.event.location
        }
      })
    }

    // Update ticket status to used and set checked in time (if not already)
    if (!alreadyCheckedIn) {
      await supabase
        .from('tickets')
        .update({
          status: 'used',
          checked_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id)
    }

    return NextResponse.json({
      valid: true,
      message: alreadyCheckedIn
        ? 'Ticket already checked in'
        : 'Ticket validated successfully',
      ticket: {
        ticketNumber: ticket.ticket_number,
        eventTitle: ticket.event.title,
        customerName: ticket.order.customer_name,
        customerEmail: ticket.order.customer_email,
        price: parseFloat(ticket.price),
        status: 'used',
        checkedInAt: ticket.checked_in_at || new Date().toISOString(),
        eventDate: ticket.event.event_date,
        eventTime: ticket.event.event_time,
        location: ticket.event.location
      }
    })
  } catch (error) {
    console.error('Ticket validation error:', error)
    return NextResponse.json(
      {
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to validate ticket'
      },
      { status: 500 }
    )
  }
}
