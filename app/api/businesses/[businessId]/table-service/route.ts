import { NextRequest, NextResponse } from 'next/server'
import { getBusinessById, updateBusiness } from '@/lib/db/businesses'
import { Business, TableSection } from '@/lib/types'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    businessId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params

    const business = await getBusinessById(businessId) as Business | null

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      venue_layout_url: business.venue_layout_url || null,
      table_service_config: business.table_service_config || null,
    })
  } catch (error) {
    console.error('Error fetching table service settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch table service settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const body = await request.json()

    // Validate business exists
    const existingBusiness = await getBusinessById(businessId) as Business | null
    if (!existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Validate table_service_config structure if provided
    if (body.table_service_config) {
      const config = body.table_service_config

      if (!config.sections || !Array.isArray(config.sections)) {
        return NextResponse.json(
          { error: 'Invalid table_service_config: sections must be an array' },
          { status: 400 }
        )
      }

      for (const section of config.sections) {
        if (!section.id || typeof section.id !== 'string') {
          return NextResponse.json(
            { error: 'Invalid section: missing or invalid id' },
            { status: 400 }
          )
        }
        if (!section.name || typeof section.name !== 'string') {
          return NextResponse.json(
            { error: 'Invalid section: missing or invalid name' },
            { status: 400 }
          )
        }
        if (typeof section.tableCount !== 'number' || section.tableCount < 1) {
          return NextResponse.json(
            { error: 'Invalid section: tableCount must be a positive number' },
            { status: 400 }
          )
        }
      }
    }

    // Check for deleted tables and unassign any reservations
    const oldConfig = existingBusiness.table_service_config
    const newConfig = body.table_service_config

    if (oldConfig?.sections && newConfig?.sections) {
      const supabase = await createClient()

      // Create a map of old sections by ID
      const oldSectionsMap = new Map<string, TableSection>(
        oldConfig.sections.map((s: TableSection) => [s.id, s])
      )

      // Create a map of new sections by ID
      const newSectionsMap = new Map<string, TableSection>(
        newConfig.sections.map((s: TableSection) => [s.id, s])
      )

      // Find sections where table count decreased or section was removed
      for (const [sectionId, oldSection] of oldSectionsMap) {
        const newSection = newSectionsMap.get(sectionId)

        if (!newSection) {
          // Section was removed entirely - unassign all bookings in this section
          // First find all event_table_sections for this section
          const { data: eventTableSections } = await supabase
            .from('event_table_sections')
            .select('id')
            .eq('section_id', sectionId)

          if (eventTableSections && eventTableSections.length > 0) {
            const sectionIds = eventTableSections.map(s => s.id)

            // Unassign all bookings in these sections
            await supabase
              .from('table_bookings')
              .update({ table_number: null })
              .in('event_table_section_id', sectionIds)
              .not('table_number', 'is', null)
          }
        } else if (newSection.tableCount < oldSection.tableCount) {
          // Table count decreased - unassign bookings for tables that no longer exist
          const { data: eventTableSections } = await supabase
            .from('event_table_sections')
            .select('id')
            .eq('section_id', sectionId)

          if (eventTableSections && eventTableSections.length > 0) {
            const sectionIds = eventTableSections.map(s => s.id)

            // Unassign bookings where table_number >= new table count
            // table_number is 1-indexed, so if we have 3 tables now, unassign anything >= 4
            // Actually table_number is the index in tableNames array (0-indexed based on usage)
            // Let's unassign any booking with table_number >= newSection.tableCount
            await supabase
              .from('table_bookings')
              .update({ table_number: null })
              .in('event_table_section_id', sectionIds)
              .gte('table_number', newSection.tableCount)
          }
        }
      }
    }

    // Update the business with table service settings
    const updatedBusiness = await updateBusiness(businessId, {
      venue_layout_url: body.venue_layout_url,
      table_service_config: body.table_service_config,
    }) as Business

    return NextResponse.json({
      venue_layout_url: updatedBusiness.venue_layout_url || null,
      table_service_config: updatedBusiness.table_service_config || null,
    })
  } catch (error) {
    console.error('Error updating table service settings:', error)
    return NextResponse.json(
      { error: 'Failed to update table service settings' },
      { status: 500 }
    )
  }
}
