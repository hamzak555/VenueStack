import { NextRequest, NextResponse } from 'next/server'
import { createEvent } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    businessId: string
  }>
}

// GET /api/businesses/[businessId]/events - Get all events for a business
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params

    const supabase = await createClient()

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('business_id', businessId)
      .order('event_date', { ascending: false })

    if (error) {
      console.error('Error fetching events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    // Fetch ticket counts for all events
    const eventIds = (events || []).map(e => e.id)

    if (eventIds.length > 0) {
      const { data: ticketCounts, error: ticketError } = await supabase
        .from('tickets')
        .select('event_id, status, checked_in_at')
        .in('event_id', eventIds)

      if (!ticketError && ticketCounts) {
        // Build counts map
        const countsMap: Record<string, { total: number; checkedIn: number }> = {}

        for (const ticket of ticketCounts) {
          if (!countsMap[ticket.event_id]) {
            countsMap[ticket.event_id] = { total: 0, checkedIn: 0 }
          }
          countsMap[ticket.event_id].total++
          if (ticket.status === 'used' || ticket.checked_in_at) {
            countsMap[ticket.event_id].checkedIn++
          }
        }

        // Enrich events with ticket counts
        const enrichedEvents = (events || []).map(event => ({
          ...event,
          total_tickets: countsMap[event.id]?.total || 0,
          available_tickets: (countsMap[event.id]?.total || 0) - (countsMap[event.id]?.checkedIn || 0),
          checked_in_count: countsMap[event.id]?.checkedIn || 0
        }))

        return NextResponse.json({ events: enrichedEvents })
      }
    }

    return NextResponse.json({ events: events || [] })
  } catch (error) {
    console.error('Error in events endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const body = await request.json()

    const {
      title,
      description,
      event_date,
      event_time,
      location,
      location_latitude,
      location_longitude,
      google_place_id,
      image_url,
      ticket_price,
      total_tickets,
      available_tickets,
      status,
      timezone,
      recurrence_rule,
    } = body

    // Validate required fields
    if (!title || !event_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the event
    const event = await createEvent({
      business_id: businessId,
      title,
      description: description || null,
      event_date,
      event_time: event_time || null,
      location: location || null,
      location_latitude: location_latitude || null,
      location_longitude: location_longitude || null,
      google_place_id: google_place_id || null,
      image_url: image_url || null,
      ticket_price: ticket_price || null,
      total_tickets: total_tickets || null,
      available_tickets: available_tickets || total_tickets || null,
      status: status || 'draft',
      timezone: timezone || null,
      recurrence_rule: recurrence_rule || null,
      parent_event_id: null,
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
