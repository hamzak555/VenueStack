import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/events/[eventId]/tickets - Get all tickets for an event (for iOS app offline caching)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // First verify the event belongs to the business
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, business_id, title')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    if (event.business_id !== businessId) {
      return NextResponse.json(
        { error: 'This event does not belong to your business' },
        { status: 403 }
      )
    }

    // Get all tickets for this event with order info
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        *,
        order:orders (
          customer_name,
          customer_email,
          customer_phone
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError)
      return NextResponse.json(
        { error: 'Failed to fetch tickets', details: ticketsError.message },
        { status: 500 }
      )
    }

    // Get unique ticket type IDs
    const ticketTypeIds = [...new Set(
      (tickets || [])
        .map(t => t.ticket_type_id)
        .filter((id): id is string => id !== null)
    )]

    // Fetch ticket types if there are any
    let ticketTypesMap = new Map<string, string>()
    if (ticketTypeIds.length > 0) {
      const { data: ticketTypes } = await supabase
        .from('ticket_types')
        .select('id, name')
        .in('id', ticketTypeIds)

      if (ticketTypes) {
        ticketTypes.forEach(tt => ticketTypesMap.set(tt.id, tt.name))
      }
    }

    // Flatten order info and add ticket type name
    const flattenedTickets = (tickets || []).map(ticket => {
      const order = ticket.order
      return {
        ...ticket,
        customer_name: order?.customer_name || null,
        customer_email: order?.customer_email || null,
        customer_phone: order?.customer_phone || null,
        ticket_type_name: ticket.ticket_type_id ? ticketTypesMap.get(ticket.ticket_type_id) || null : null,
        order: undefined // Remove nested order object
      }
    })

    return NextResponse.json({
      tickets: flattenedTickets,
      total: flattenedTickets.length,
      event_id: eventId
    })
  } catch (error) {
    console.error('Error in tickets endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
