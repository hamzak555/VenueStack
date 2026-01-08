import { NextRequest, NextResponse } from 'next/server'
import { createTicketType } from '@/lib/db/ticket-types'
import { getEventById } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propagateToSeries, ...ticketTypeData } = body

    // Create the ticket type for this event
    const ticketType = await createTicketType(ticketTypeData)

    // If propagateToSeries is true, create the same ticket type for all events in the series
    if (propagateToSeries) {
      const supabase = await createClient()
      const event = await getEventById(ticketTypeData.event_id)

      if (event) {
        const isRecurringInstance = !!event.parent_event_id
        const parentId = isRecurringInstance ? event.parent_event_id : ticketTypeData.event_id

        // Get all events in the series (excluding the one we just created for)
        let seriesEventIds: string[] = []

        if (isRecurringInstance) {
          // This is an instance - get parent and all other instances
          const { data: siblingInstances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', parentId)
            .neq('id', ticketTypeData.event_id)

          if (siblingInstances) {
            seriesEventIds = siblingInstances.map(e => e.id)
          }

          // Also include the parent
          if (parentId) {
            seriesEventIds.push(parentId)
          }
        } else {
          // This is a parent - get all instances
          const { data: instances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', ticketTypeData.event_id)

          if (instances) {
            seriesEventIds = instances.map(e => e.id)
          }
        }

        // Create ticket types for all related events
        if (seriesEventIds.length > 0) {
          const ticketTypesToCreate = seriesEventIds.map(eventId => ({
            event_id: eventId,
            name: ticketTypeData.name,
            description: ticketTypeData.description || null,
            price: ticketTypeData.price,
            total_quantity: ticketTypeData.total_quantity,
            available_quantity: ticketTypeData.total_quantity, // Start fresh for each event
            max_per_customer: ticketTypeData.max_per_customer || null,
            display_order: ticketType.display_order,
            is_active: ticketTypeData.is_active !== false,
            sale_start_date: ticketTypeData.sale_start_date || null,
            sale_end_date: ticketTypeData.sale_end_date || null,
          }))

          await supabase.from('ticket_types').insert(ticketTypesToCreate)
        }
      }
    }

    return NextResponse.json(ticketType, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket type:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create ticket type' },
      { status: 500 }
    )
  }
}
