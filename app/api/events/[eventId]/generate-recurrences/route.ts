import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEventById } from '@/lib/db/events'
import { generateRecurrenceDates } from '@/lib/utils/recurrence'

interface RouteContext {
  params: Promise<{
    eventId: string
  }>
}

/**
 * POST /api/events/[eventId]/generate-recurrences
 * Generate recurring event instances based on the parent event's recurrence rule
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params

    // Get the parent event
    const parentEvent = await getEventById(eventId)

    if (!parentEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    if (!parentEvent.recurrence_rule || parentEvent.recurrence_rule.type === 'none') {
      return NextResponse.json(
        { error: 'Event does not have a recurrence rule' },
        { status: 400 }
      )
    }

    // Generate dates for recurring instances
    // Parse date as local time to avoid timezone issues
    const dateStr = parentEvent.event_date.split('T')[0]
    const [year, month, day] = dateStr.split('-').map(Number)
    const startDate = new Date(year, month - 1, day)
    const recurrenceDates = generateRecurrenceDates(
      startDate,
      parentEvent.recurrence_rule,
      26 // Max 26 occurrences (about 6 months of weekly events)
    )

    // Filter out any dates that match the parent event's date (extra safety)
    const parentDateStr = dateStr
    const filteredDates = recurrenceDates.filter(d => d !== parentDateStr)

    if (filteredDates.length === 0) {
      return NextResponse.json(
        { message: 'No recurrence dates to generate', created: 0 }
      )
    }

    const supabase = await createClient()

    // First, delete any existing recurring instances for this parent
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('parent_event_id', eventId)

    if (deleteError) {
      console.error('Error deleting old instances:', deleteError)
      // Continue anyway - might be first time generating
    }

    // Create new event instances for each recurrence date
    const eventInstances = filteredDates.map(date => ({
      business_id: parentEvent.business_id,
      title: parentEvent.title,
      description: parentEvent.description,
      event_date: date,
      event_time: parentEvent.event_time,
      location: parentEvent.location,
      location_latitude: parentEvent.location_latitude,
      location_longitude: parentEvent.location_longitude,
      google_place_id: parentEvent.google_place_id,
      image_url: parentEvent.image_url,
      ticket_price: parentEvent.ticket_price,
      total_tickets: parentEvent.total_tickets,
      available_tickets: parentEvent.available_tickets,
      status: parentEvent.status,
      timezone: parentEvent.timezone, // Copy timezone from parent
      recurrence_rule: null, // Instances don't have their own recurrence
      parent_event_id: eventId, // Link to parent
    }))

    const { data: createdEvents, error: createError } = await supabase
      .from('events')
      .insert(eventInstances)
      .select()

    if (createError) {
      console.error('Error creating recurring instances:', createError)
      return NextResponse.json(
        { error: 'Failed to create recurring instances: ' + createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Created ${createdEvents?.length || 0} recurring event instances`,
      created: createdEvents?.length || 0,
      dates: filteredDates,
    })
  } catch (error) {
    console.error('Error generating recurrences:', error)
    return NextResponse.json(
      { error: 'Failed to generate recurring events' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/events/[eventId]/generate-recurrences
 * Delete all recurring instances of an event
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('parent_event_id', eventId)
      .select()

    if (error) {
      console.error('Error deleting recurring instances:', error)
      return NextResponse.json(
        { error: 'Failed to delete recurring instances' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Deleted ${data?.length || 0} recurring event instances`,
      deleted: data?.length || 0,
    })
  } catch (error) {
    console.error('Error deleting recurrences:', error)
    return NextResponse.json(
      { error: 'Failed to delete recurring events' },
      { status: 500 }
    )
  }
}
