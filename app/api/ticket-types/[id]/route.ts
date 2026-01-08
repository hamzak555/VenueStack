import { NextRequest, NextResponse } from 'next/server'
import { getTicketType, updateTicketType, deleteTicketType } from '@/lib/db/ticket-types'
import { getEventById } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticketType = await getTicketType(id)

    if (!ticketType) {
      return NextResponse.json(
        { error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(ticketType)
  } catch (error) {
    console.error('Error fetching ticket type:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket type' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { propagateToSeries, ...updateData } = body

    // Get the current ticket type to find its event
    const currentTicketType = await getTicketType(id)
    if (!currentTicketType) {
      return NextResponse.json(
        { error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    const originalName = currentTicketType.name

    // Update this ticket type
    const ticketType = await updateTicketType(id, updateData)

    // If propagateToSeries is true, update matching ticket types in all events in the series
    if (propagateToSeries) {
      const supabase = await createClient()
      const event = await getEventById(currentTicketType.event_id)

      if (event) {
        const isRecurringInstance = !!event.parent_event_id
        const parentId = isRecurringInstance ? event.parent_event_id : currentTicketType.event_id

        // Get all events in the series (excluding current event)
        let seriesEventIds: string[] = []

        if (isRecurringInstance) {
          const { data: siblingInstances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', parentId)
            .neq('id', currentTicketType.event_id)

          if (siblingInstances) {
            seriesEventIds = siblingInstances.map(e => e.id)
          }

          if (parentId) {
            seriesEventIds.push(parentId)
          }
        } else {
          const { data: instances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', currentTicketType.event_id)

          if (instances) {
            seriesEventIds = instances.map(e => e.id)
          }
        }

        // Update ticket types with matching name in all related events
        // Only update template fields, not quantity/availability which varies per event
        if (seriesEventIds.length > 0) {
          const templateUpdates: Record<string, unknown> = {}
          if (updateData.name !== undefined) templateUpdates.name = updateData.name
          if (updateData.description !== undefined) templateUpdates.description = updateData.description
          if (updateData.price !== undefined) templateUpdates.price = updateData.price
          if (updateData.max_per_customer !== undefined) templateUpdates.max_per_customer = updateData.max_per_customer
          if (updateData.is_active !== undefined) templateUpdates.is_active = updateData.is_active
          if (updateData.sale_start_date !== undefined) templateUpdates.sale_start_date = updateData.sale_start_date
          if (updateData.sale_end_date !== undefined) templateUpdates.sale_end_date = updateData.sale_end_date

          if (Object.keys(templateUpdates).length > 0) {
            await supabase
              .from('ticket_types')
              .update(templateUpdates)
              .eq('name', originalName)
              .in('event_id', seriesEventIds)
          }
        }
      }
    }

    return NextResponse.json(ticketType)
  } catch (error) {
    console.error('Error updating ticket type:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update ticket type' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const propagateToSeries = searchParams.get('propagateToSeries') === 'true'

    // Get the ticket type before deleting to know its event and name
    const ticketType = await getTicketType(id)
    if (!ticketType) {
      return NextResponse.json(
        { error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    // If propagating, delete matching ticket types from all events in the series
    if (propagateToSeries) {
      const supabase = await createClient()
      const event = await getEventById(ticketType.event_id)

      if (event) {
        const isRecurringInstance = !!event.parent_event_id
        const parentId = isRecurringInstance ? event.parent_event_id : ticketType.event_id

        let seriesEventIds: string[] = []

        if (isRecurringInstance) {
          const { data: siblingInstances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', parentId)
            .neq('id', ticketType.event_id)

          if (siblingInstances) {
            seriesEventIds = siblingInstances.map(e => e.id)
          }

          if (parentId) {
            seriesEventIds.push(parentId)
          }
        } else {
          const { data: instances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', ticketType.event_id)

          if (instances) {
            seriesEventIds = instances.map(e => e.id)
          }
        }

        // Delete ticket types with matching name from all related events
        if (seriesEventIds.length > 0) {
          await supabase
            .from('ticket_types')
            .delete()
            .eq('name', ticketType.name)
            .in('event_id', seriesEventIds)
        }
      }
    }

    // Delete the original ticket type
    await deleteTicketType(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ticket type:', error)
    return NextResponse.json(
      { error: 'Failed to delete ticket type' },
      { status: 500 }
    )
  }
}
