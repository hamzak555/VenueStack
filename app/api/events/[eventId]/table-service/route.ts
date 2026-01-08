import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    eventId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const supabase = await createClient()

    // Get event table sections
    const { data: sections, error } = await supabase
      .from('event_table_sections')
      .select('*')
      .eq('event_id', eventId)
      .order('section_name', { ascending: true })

    if (error) {
      console.error('Error fetching table sections:', error)
      return NextResponse.json(
        { error: 'Failed to fetch table service settings' },
        { status: 500 }
      )
    }

    // Get event to check if table service is enabled
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('table_service_enabled')
      .eq('id', eventId)
      .single()

    if (eventError) {
      console.error('Error fetching event:', eventError)
      return NextResponse.json(
        { error: 'Failed to fetch event' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      table_service_enabled: event?.table_service_enabled || false,
      sections: sections || [],
    })
  } catch (error) {
    console.error('Error in table service GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch table service settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const body = await request.json()
    const { table_service_enabled, sections, propagateToSeries } = body

    const supabase = await createClient()

    // Helper function to update table service for a single event (preserves bookings)
    const updateTableServiceForEvent = async (targetEventId: string) => {
      // Update event table_service_enabled flag
      await supabase
        .from('events')
        .update({ table_service_enabled })
        .eq('id', targetEventId)

      // Get existing sections to preserve IDs
      const { data: targetExistingSections } = await supabase
        .from('event_table_sections')
        .select('id, section_id')
        .eq('event_id', targetEventId)

      const targetSectionMap = new Map(
        (targetExistingSections || []).map(s => [s.section_id, s.id])
      )

      // Update or insert sections
      if (sections && sections.length > 0) {
        for (const section of sections) {
          const existingId = targetSectionMap.get(section.section_id)

          if (existingId) {
            // UPDATE existing section
            await supabase
              .from('event_table_sections')
              .update({
                section_name: section.section_name,
                price: section.price || 0,
                minimum_spend: section.minimum_spend || null,
                total_tables: section.total_tables || 0,
                capacity: section.capacity || null,
                max_per_customer: section.max_per_customer || null,
                is_enabled: section.is_enabled || false,
              })
              .eq('id', existingId)
            targetSectionMap.delete(section.section_id)
          } else {
            // INSERT new section
            await supabase
              .from('event_table_sections')
              .insert({
                event_id: targetEventId,
                section_id: section.section_id,
                section_name: section.section_name,
                price: section.price || 0,
                minimum_spend: section.minimum_spend || null,
                total_tables: section.total_tables || 0,
                available_tables: section.total_tables || 0,
                capacity: section.capacity || null,
                max_per_customer: section.max_per_customer || null,
                is_enabled: section.is_enabled || false,
              })
          }
        }

        // Delete sections without bookings
        for (const [, id] of targetSectionMap) {
          const { count } = await supabase
            .from('table_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('event_table_section_id', id)
            .neq('status', 'cancelled')

          if (count === 0) {
            await supabase
              .from('event_table_sections')
              .delete()
              .eq('id', id)
          }
        }
      }
    }

    // Update the current event
    const { error: eventError } = await supabase
      .from('events')
      .update({ table_service_enabled })
      .eq('id', eventId)

    if (eventError) {
      console.error('Error updating event:', eventError)
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      )
    }

    // Get existing sections to preserve IDs (and linked bookings)
    const { data: existingSections } = await supabase
      .from('event_table_sections')
      .select('id, section_id')
      .eq('event_id', eventId)

    const existingSectionMap = new Map(
      (existingSections || []).map(s => [s.section_id, s.id])
    )

    // Update or insert sections for current event
    if (sections && sections.length > 0) {
      for (const section of sections) {
        const existingId = existingSectionMap.get(section.section_id)

        if (existingId) {
          // UPDATE existing section (preserves the ID and linked bookings)
          const { error: updateError } = await supabase
            .from('event_table_sections')
            .update({
              section_name: section.section_name,
              price: section.price || 0,
              minimum_spend: section.minimum_spend || null,
              total_tables: section.total_tables || 0,
              // Don't reset available_tables for existing sections
              capacity: section.capacity || null,
              max_per_customer: section.max_per_customer || null,
              is_enabled: section.is_enabled || false,
            })
            .eq('id', existingId)

          if (updateError) {
            console.error('Error updating section:', updateError)
          }
          existingSectionMap.delete(section.section_id) // Mark as processed
        } else {
          // INSERT new section
          const { error: insertError } = await supabase
            .from('event_table_sections')
            .insert({
              event_id: eventId,
              section_id: section.section_id,
              section_name: section.section_name,
              price: section.price || 0,
              minimum_spend: section.minimum_spend || null,
              total_tables: section.total_tables || 0,
              available_tables: section.total_tables || 0,
              capacity: section.capacity || null,
              max_per_customer: section.max_per_customer || null,
              is_enabled: section.is_enabled || false,
            })

          if (insertError) {
            console.error('Error inserting section:', insertError)
          }
        }
      }

      // Delete sections that no longer exist in the business config
      // Only delete if they have NO bookings
      for (const [sectionId, id] of existingSectionMap) {
        const { count } = await supabase
          .from('table_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('event_table_section_id', id)
          .neq('status', 'cancelled')

        if (count === 0) {
          await supabase
            .from('event_table_sections')
            .delete()
            .eq('id', id)
        }
      }
    }

    // If propagating to series, update all related events
    if (propagateToSeries) {
      // Get the current event to determine parent/instance relationship
      const { data: event } = await supabase
        .from('events')
        .select('parent_event_id')
        .eq('id', eventId)
        .single()

      if (event) {
        const isRecurringInstance = !!event.parent_event_id
        const parentId = isRecurringInstance ? event.parent_event_id : eventId

        let seriesEventIds: string[] = []

        if (isRecurringInstance) {
          // Get parent and all other instances
          const { data: siblingInstances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', parentId)
            .neq('id', eventId)

          if (siblingInstances) {
            seriesEventIds = siblingInstances.map(e => e.id)
          }
          if (parentId) {
            seriesEventIds.push(parentId)
          }
        } else {
          // Get all instances
          const { data: instances } = await supabase
            .from('events')
            .select('id')
            .eq('parent_event_id', eventId)

          if (instances) {
            seriesEventIds = instances.map(e => e.id)
          }
        }

        // Update table service for all related events
        for (const relatedEventId of seriesEventIds) {
          await updateTableServiceForEvent(relatedEventId)
        }
      }
    }

    // Fetch updated sections for current event
    const { data: updatedSections, error: fetchError } = await supabase
      .from('event_table_sections')
      .select('*')
      .eq('event_id', eventId)
      .order('section_name', { ascending: true })

    if (fetchError) {
      console.error('Error fetching updated sections:', fetchError)
    }

    return NextResponse.json({
      table_service_enabled,
      sections: updatedSections || [],
    })
  } catch (error) {
    console.error('Error in table service PUT:', error)
    return NextResponse.json(
      { error: 'Failed to update table service settings' },
      { status: 500 }
    )
  }
}
