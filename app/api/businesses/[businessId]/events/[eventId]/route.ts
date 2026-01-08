import { NextRequest, NextResponse } from 'next/server'
import { updateEvent, getEventById, deleteEvent } from '@/lib/db/events'
import { hasEventBeenSold } from '@/lib/db/orders'
import { hasTableBookings } from '@/lib/db/table-bookings'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    businessId: string
    eventId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const event = await getEventById(eventId)

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { businessId, eventId } = await context.params
    const body = await request.json()
    const supabase = await createClient()

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
      updateMode, // 'single' or 'all'
    } = body

    // Validate required fields
    if (!title || !event_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Build the update payload (excluding date-specific fields for series updates)
    const baseUpdatePayload = {
      title,
      description: description !== undefined ? description : undefined,
      event_time: event_time !== undefined ? event_time : undefined,
      location: location !== undefined ? location : undefined,
      location_latitude: location_latitude !== undefined ? location_latitude : undefined,
      location_longitude: location_longitude !== undefined ? location_longitude : undefined,
      google_place_id: google_place_id !== undefined ? google_place_id : undefined,
      image_url: image_url !== undefined ? image_url : undefined,
      status: status !== undefined ? status : undefined,
      timezone: timezone !== undefined ? timezone : undefined,
    }

    // Single event update payload includes the date
    const singleUpdatePayload = {
      ...baseUpdatePayload,
      event_date,
      ticket_price: ticket_price !== undefined ? ticket_price : undefined,
      total_tickets: total_tickets !== undefined ? total_tickets : undefined,
      available_tickets: available_tickets !== undefined ? available_tickets : undefined,
      recurrence_rule: recurrence_rule !== undefined ? recurrence_rule : undefined,
    }

    // Update the current event
    const event = await updateEvent(eventId, singleUpdatePayload)

    // If updateMode is 'all', update all events in the series
    if (updateMode === 'all') {
      // Get the current event to determine if it's a parent or instance
      const currentEvent = await getEventById(eventId)

      if (currentEvent) {
        const isRecurringInstance = !!currentEvent.parent_event_id
        const parentId = isRecurringInstance ? currentEvent.parent_event_id : eventId

        // Get all events in the series (excluding the one we just updated)
        let seriesEventIds: string[] = []

        if (isRecurringInstance) {
          // This is an instance - get parent and all other instances
          const { data: siblingInstances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', parentId)
            .neq('id', eventId)

          if (siblingInstances) {
            seriesEventIds = siblingInstances.map(e => e.id)
          }

          // Also include the parent if it exists
          if (parentId) {
            seriesEventIds.push(parentId)
          }
        } else {
          // This is a parent - get all instances
          const { data: instances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', eventId)

          if (instances) {
            seriesEventIds = instances.map(e => e.id)
          }
        }

        // Update all related events with common fields (not date or recurrence)
        if (seriesEventIds.length > 0) {
          await supabase
            .from('events')
            .update({
              title,
              description: description || null,
              event_time: event_time || null,
              location: location || null,
              location_latitude: location_latitude || null,
              location_longitude: location_longitude || null,
              google_place_id: google_place_id || null,
              image_url: image_url || null,
              status: status || 'draft',
              timezone: timezone || null,
            })
            .in('id', seriesEventIds)
        }
      }
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const supabase = await createClient()

    // Get delete mode from query params (single or future)
    const { searchParams } = new URL(request.url)
    const deleteMode = searchParams.get('mode') || 'single'

    // Check if event exists
    const event = await getEventById(eventId)
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check if this event has ticket sales or table bookings
    const hasSales = await hasEventBeenSold(eventId)
    let hasBookings = false
    try {
      hasBookings = await hasTableBookings(eventId)
    } catch (e) {
      // Function might not exist yet, ignore
    }
    const eventHasSalesOrBookings = hasSales || hasBookings

    // Check if this is a recurring instance
    const isRecurringInstance = !!event.parent_event_id
    let deletedCount = 0
    let skippedCount = 0

    // For single event delete (not part of a series delete), block if has sales/bookings
    const isSingleDelete = (isRecurringInstance && deleteMode === 'single') ||
                           (!isRecurringInstance && !event.parent_event_id)

    // Check if this is a standalone event (no parent, no children)
    const { data: childEvents } = await supabase
      .from('events')
      .select('id')
      .eq('parent_event_id', eventId)
      .limit(1)

    const isStandaloneEvent = !isRecurringInstance && (!childEvents || childEvents.length === 0)

    // Block single/standalone event deletion if it has sales or bookings
    if ((isRecurringInstance && deleteMode === 'single') || isStandaloneEvent) {
      if (eventHasSalesOrBookings) {
        return NextResponse.json(
          { error: hasSales ? 'Cannot delete event with sold tickets' : 'Cannot delete event with table reservations' },
          { status: 400 }
        )
      }
    }

    if (isRecurringInstance && deleteMode === 'future') {
      // Delete this event and all future recurring instances (skip those with sales/reservations)
      const { data: futureInstances } = await supabase
        .from('events')
        .select('id, event_date')
        .eq('parent_event_id', event.parent_event_id)
        .gte('event_date', event.event_date)

      if (futureInstances && futureInstances.length > 0) {
        // Filter to only deletable instances (no sales or reservations)
        const deletableIds: string[] = []

        for (const instance of futureInstances) {
          const instanceHasSales = await hasEventBeenSold(instance.id)
          let instanceHasBookings = false
          try {
            instanceHasBookings = await hasTableBookings(instance.id)
          } catch (e) {
            // Function might not exist yet, ignore
          }

          if (!instanceHasSales && !instanceHasBookings) {
            deletableIds.push(instance.id)
          } else {
            skippedCount += 1
            // Detach this instance from the series so it becomes standalone
            await supabase
              .from('events')
              .update({ parent_event_id: null, recurrence_rule: null })
              .eq('id', instance.id)
          }
        }

        if (deletableIds.length > 0) {
          // First delete related records for deletable instances
          await supabase
            .from('event_table_sections')
            .delete()
            .in('event_id', deletableIds)

          await supabase
            .from('ticket_types')
            .delete()
            .in('event_id', deletableIds)

          // Then delete the events
          await supabase
            .from('events')
            .delete()
            .in('id', deletableIds)

          deletedCount = deletableIds.length
        } else {
          deletedCount = 0
        }

        // Check if there are any remaining instances after deletion
        const { data: remainingInstances } = await supabase
          .from('events')
          .select('id')
          .eq('parent_event_id', event.parent_event_id)
          .limit(1)

        try {
          if (!remainingInstances || remainingInstances.length === 0) {
            // No more instances - clear the parent's recurrence rule entirely
            await supabase
              .from('events')
              .update({ recurrence_rule: null })
              .eq('id', event.parent_event_id)
          } else {
            // Still have some instances - update parent's recurrence rule to end before this date
            const parentEvent = await getEventById(event.parent_event_id)
            if (parentEvent && parentEvent.recurrence_rule) {
              // Calculate the day before this event as the new end date
              const endDate = new Date(event.event_date + 'T00:00:00')
              endDate.setDate(endDate.getDate() - 1)
              const newEndDate = endDate.toISOString().split('T')[0]

              const updatedRule = {
                ...parentEvent.recurrence_rule,
                endType: 'date',
                endDate: newEndDate,
              }

              await updateEvent(event.parent_event_id, {
                recurrence_rule: updatedRule,
              })
            }
          }
        } catch (e) {
          // Parent event may have been deleted, that's okay
          console.log('Could not update parent recurrence rule:', e)
        }
      }
    } else if (isRecurringInstance && deleteMode === 'single') {
      // Delete only this single instance
      // First delete related records
      await supabase
        .from('event_table_sections')
        .delete()
        .eq('event_id', eventId)

      await supabase
        .from('ticket_types')
        .delete()
        .eq('event_id', eventId)

      await deleteEvent(eventId)
      deletedCount = 1
    } else if (isStandaloneEvent) {
      // This is a standalone event (no parent, no children)
      await supabase
        .from('event_table_sections')
        .delete()
        .eq('event_id', eventId)

      await supabase
        .from('ticket_types')
        .delete()
        .eq('event_id', eventId)

      await deleteEvent(eventId)
      deletedCount = 1
    } else if (!isRecurringInstance) {
      // This is a parent event with child instances
      const { data: instances } = await supabase
        .from('events')
        .select('id')
        .eq('parent_event_id', eventId)

      if (instances && instances.length > 0) {
        // Filter to only deletable instances (no sales or reservations)
        const deletableIds: string[] = []

        for (const instance of instances) {
          const instanceHasSales = await hasEventBeenSold(instance.id)
          let instanceHasBookings = false
          try {
            instanceHasBookings = await hasTableBookings(instance.id)
          } catch (e) {
            // Function might not exist yet, ignore
          }

          if (!instanceHasSales && !instanceHasBookings) {
            deletableIds.push(instance.id)
          } else {
            skippedCount += 1
            // Detach this instance from the series so it becomes standalone
            await supabase
              .from('events')
              .update({ parent_event_id: null, recurrence_rule: null })
              .eq('id', instance.id)
          }
        }

        if (deletableIds.length > 0) {
          // Delete related records for deletable instances first
          await supabase
            .from('event_table_sections')
            .delete()
            .in('event_id', deletableIds)

          await supabase
            .from('ticket_types')
            .delete()
            .in('event_id', deletableIds)

          // Delete the instances
          await supabase
            .from('events')
            .delete()
            .in('id', deletableIds)

          deletedCount += deletableIds.length
        }
      }

      // Only delete the parent event if it has no sales/bookings
      if (!eventHasSalesOrBookings) {
        // Delete related records for the parent event
        await supabase
          .from('event_table_sections')
          .delete()
          .eq('event_id', eventId)

        await supabase
          .from('ticket_types')
          .delete()
          .eq('event_id', eventId)

        // Delete the parent event
        await deleteEvent(eventId)
        deletedCount += 1
      } else {
        skippedCount += 1
        // Clear recurrence rule since we're breaking up the series
        await supabase
          .from('events')
          .update({ recurrence_rule: null })
          .eq('id', eventId)
      }
    }

    // Build response message
    let message = ''
    if (deletedCount === 0 && skippedCount > 0) {
      message = 'No events deleted - all events have sold tickets or reservations'
    } else if (deletedCount === 1 && skippedCount === 0) {
      message = 'Event deleted'
    } else if (skippedCount > 0) {
      message = `Deleted ${deletedCount} event${deletedCount > 1 ? 's' : ''}, skipped ${skippedCount} with sales/reservations`
    } else {
      message = `Deleted ${deletedCount} events`
    }

    return NextResponse.json({
      success: deletedCount > 0,
      deleted: deletedCount,
      skipped: skippedCount,
      message
    })
  } catch (error) {
    console.error('Error deleting event:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete event'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
