import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEventById } from '@/lib/db/events'
import { getTicketTypes } from '@/lib/db/ticket-types'

interface RouteContext {
  params: Promise<{
    businessId: string
    eventId: string
  }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { businessId, eventId } = await context.params
    const supabase = await createClient()

    // Get the original event
    const originalEvent = await getEventById(eventId)
    if (!originalEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Verify the event belongs to this business
    if (originalEvent.business_id !== businessId) {
      return NextResponse.json(
        { error: 'Event does not belong to this business' },
        { status: 403 }
      )
    }

    // Get the original ticket types
    const originalTicketTypes = await getTicketTypes(eventId)

    // Get the original artists
    const { data: originalArtists } = await supabase
      .from('event_artists')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })

    // Create the duplicated event with "Copy of" prefix and draft status
    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert({
        business_id: businessId,
        title: `Copy of ${originalEvent.title}`,
        description: originalEvent.description,
        event_date: originalEvent.event_date,
        event_time: originalEvent.event_time,
        location: originalEvent.location,
        location_latitude: originalEvent.location_latitude,
        location_longitude: originalEvent.location_longitude,
        google_place_id: originalEvent.google_place_id,
        image_url: originalEvent.image_url,
        ticket_price: originalEvent.ticket_price,
        total_tickets: originalEvent.total_tickets,
        available_tickets: originalEvent.total_tickets, // Reset to full availability
        status: 'draft', // Always create as draft
      })
      .select()
      .single()

    if (eventError) {
      console.error('Error creating duplicated event:', eventError)
      return NextResponse.json(
        { error: 'Failed to duplicate event' },
        { status: 500 }
      )
    }

    // Duplicate ticket types if they exist
    if (originalTicketTypes.length > 0) {
      const ticketTypesToInsert = originalTicketTypes.map(tt => ({
        event_id: newEvent.id,
        name: tt.name,
        description: tt.description,
        price: tt.price,
        total_quantity: tt.total_quantity,
        available_quantity: tt.total_quantity, // Reset to full availability
        max_per_customer: tt.max_per_customer,
        display_order: tt.display_order,
        is_active: tt.is_active,
        sale_start_date: tt.sale_start_date,
        sale_end_date: tt.sale_end_date,
      }))

      const { error: ticketTypesError } = await supabase
        .from('ticket_types')
        .insert(ticketTypesToInsert)

      if (ticketTypesError) {
        console.error('Error duplicating ticket types:', ticketTypesError)
        // Don't fail the whole operation, just log the error
      }
    }

    // Duplicate artists if they exist
    if (originalArtists && originalArtists.length > 0) {
      const artistsToInsert = originalArtists.map(artist => ({
        event_id: newEvent.id,
        name: artist.name,
        photo_url: artist.photo_url,
        display_order: artist.display_order,
      }))

      const { error: artistsError } = await supabase
        .from('event_artists')
        .insert(artistsToInsert)

      if (artistsError) {
        console.error('Error duplicating artists:', artistsError)
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      event: newEvent,
    })
  } catch (error) {
    console.error('Error duplicating event:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate event' },
      { status: 500 }
    )
  }
}
