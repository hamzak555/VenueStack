import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTicketTypes } from '@/lib/db/ticket-types'
import { getBusinessFeeSettings } from '@/lib/db/platform-settings'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessSlug: string; eventId: string }> }
) {
  try {
    const { businessSlug, eventId } = await context.params
    const supabase = await createClient()

    // Get business by slug
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', businessSlug)
      .single()

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Get event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('business_id', business.id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Get ticket types for this event
    const ticketTypes = await getTicketTypes(eventId)

    // Get business-specific fee settings (custom or global)
    const feeSettings = await getBusinessFeeSettings(business)

    // Get artists for this event
    const { data: artists } = await supabase
      .from('event_artists')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })

    // Get table service sections for this event (if enabled)
    let tableSections: any[] = []
    let bookedTables: { section_id: string; table_number: string }[] = []
    if (event.table_service_enabled) {
      const { data: sections } = await supabase
        .from('event_table_sections')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_enabled', true)
        .order('section_name', { ascending: true })

      tableSections = sections || []

      // Get booked tables for this event (non-cancelled bookings with assigned table numbers)
      const { data: bookings } = await supabase
        .from('table_bookings')
        .select('event_table_section_id, table_number')
        .eq('event_id', eventId)
        .neq('status', 'cancelled')
        .not('table_number', 'is', null)

      if (bookings) {
        // Map event_table_section_id to section_id for the component
        const sectionIdMap: Record<string, string> = {}
        for (const section of tableSections) {
          sectionIdMap[section.id] = section.section_id
        }
        bookedTables = bookings.map(b => ({
          section_id: sectionIdMap[b.event_table_section_id] || '',
          table_number: b.table_number,
        })).filter(b => b.section_id)
      }

      // Build set of linked tables
      const linkedTablesSet = new Set<string>()
      for (const section of tableSections) {
        if (section.linked_table_pairs && Array.isArray(section.linked_table_pairs)) {
          for (const pair of section.linked_table_pairs) {
            linkedTablesSet.add(`${pair.table1.sectionId}-${pair.table1.tableName}`)
            linkedTablesSet.add(`${pair.table2.sectionId}-${pair.table2.tableName}`)
          }
        }
      }

      // Recalculate available_tables for each section
      // Get business table service config for table names
      const tableServiceConfig = business.table_service_config as { sections?: { id: string; tableCount: number; tableNames?: string[] }[] } | null

      for (const section of tableSections) {
        const businessSection = tableServiceConfig?.sections?.find(s => s.id === section.section_id)
        const tableCount = businessSection?.tableCount || section.total_tables
        const tableNames = businessSection?.tableNames || []

        let available = 0
        for (let i = 0; i < tableCount; i++) {
          const tableName = tableNames[i] || `${i + 1}`
          const sectionId = section.section_id

          // Check if closed
          const isClosed = section.closed_tables?.includes(tableName)
          // Check if booked
          const isBooked = bookedTables.some(b => b.section_id === sectionId && b.table_number === tableName)
          // Check if linked
          const isLinked = linkedTablesSet.has(`${sectionId}-${tableName}`)

          if (!isClosed && !isBooked && !isLinked) {
            available++
          }
        }
        section.available_tables = available
      }
    }

    return NextResponse.json({
      event,
      business,
      ticketTypes: ticketTypes.filter(tt => tt.is_active),
      platformSettings: feeSettings,
      artists: artists || [],
      tableSections,
      bookedTables,
    })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}
