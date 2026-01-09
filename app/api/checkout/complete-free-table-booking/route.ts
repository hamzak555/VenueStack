import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrackingLinkByRefCode } from '@/lib/db/tracking-links'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventId,
      tableSelections, // Record<sectionId, quantity>
      customerName,
      customerEmail,
      customerPhone,
      trackingRef,
    } = body

    if (!eventId || !tableSelections || !customerName || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate tableSelections is not empty
    const sectionIds = Object.keys(tableSelections).filter(id => tableSelections[id] > 0)
    if (sectionIds.length === 0) {
      return NextResponse.json(
        { error: 'No tables selected' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get event details with business
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, businesses(*)')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check if table service is enabled
    if (!event.table_service_enabled) {
      return NextResponse.json(
        { error: 'Table service is not available for this event' },
        { status: 400 }
      )
    }

    // Get all selected table sections
    const { data: tableSections, error: sectionsError } = await supabase
      .from('event_table_sections')
      .select('*')
      .eq('event_id', eventId)
      .in('id', sectionIds)

    if (sectionsError || !tableSections || tableSections.length === 0) {
      return NextResponse.json(
        { error: 'Table sections not found' },
        { status: 404 }
      )
    }

    // Validate each section and calculate totals
    let totalTablePrice = 0
    let totalTables = 0
    const orderDetails: { sectionId: string; sectionName: string; quantity: number; price: number }[] = []

    for (const section of tableSections) {
      const quantity = tableSelections[section.id] || 0
      if (quantity <= 0) continue

      if (!section.is_enabled) {
        return NextResponse.json(
          { error: `Table section "${section.section_name}" is not available` },
          { status: 400 }
        )
      }

      if (section.available_tables < quantity) {
        return NextResponse.json(
          { error: `Not enough tables available in "${section.section_name}". Only ${section.available_tables} available.` },
          { status: 400 }
        )
      }

      // Check max per customer limit
      if (section.max_per_customer && quantity > section.max_per_customer) {
        return NextResponse.json(
          { error: `Maximum ${section.max_per_customer} tables per customer in "${section.section_name}"` },
          { status: 400 }
        )
      }

      totalTablePrice += section.price * quantity
      totalTables += quantity
      orderDetails.push({
        sectionId: section.id,
        sectionName: section.section_name,
        quantity,
        price: section.price,
      })
    }

    if (totalTables === 0) {
      return NextResponse.json(
        { error: 'No valid tables selected' },
        { status: 400 }
      )
    }

    // Verify this is actually a free booking (all section prices are $0)
    if (totalTablePrice > 0) {
      return NextResponse.json(
        { error: 'This endpoint is only for free table reservations. Total amount must be $0.' },
        { status: 400 }
      )
    }

    // Look up tracking link ID if trackingRef is provided
    let trackingLinkId: string | null = null
    if (trackingRef) {
      try {
        const trackingLink = await getTrackingLinkByRefCode(event.business_id, trackingRef)
        if (trackingLink) {
          trackingLinkId = trackingLink.id
        }
      } catch (error) {
        console.error('Error looking up tracking link:', error)
      }
    }

    // Generate a unique order ID for this free booking
    const orderId = `FREE-${nanoid(12).toUpperCase()}`

    const createdBookings: any[] = []
    const sectionUpdates: { sectionId: string; decrement: number }[] = []

    // Process each section and create bookings
    for (const detail of orderDetails) {
      const { sectionId, sectionName, quantity } = detail

      // Create bookings for each table in this section
      for (let i = 0; i < quantity; i++) {
        const { data: bookingData, error: bookingError } = await supabase
          .from('table_bookings')
          .insert({
            event_id: eventId,
            event_table_section_id: sectionId,
            table_number: null, // Business will assign specific table later
            order_id: orderId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            amount: 0, // Free booking
            status: 'confirmed',
            tracking_ref: trackingRef || null,
            tracking_link_id: trackingLinkId,
          })
          .select()
          .single()

        if (!bookingError && bookingData) {
          createdBookings.push({
            ...bookingData,
            sectionName,
          })
        }
      }

      // Track section update
      sectionUpdates.push({ sectionId, decrement: quantity })
    }

    // Update available tables count for each section
    for (const update of sectionUpdates) {
      const { data: currentSection } = await supabase
        .from('event_table_sections')
        .select('available_tables')
        .eq('id', update.sectionId)
        .single()

      if (currentSection) {
        await supabase
          .from('event_table_sections')
          .update({ available_tables: Math.max(0, currentSection.available_tables - update.decrement) })
          .eq('id', update.sectionId)
      }
    }

    // Build summary for response
    const sectionSummary = createdBookings.reduce((acc: Record<string, number>, b: any) => {
      acc[b.sectionName] = (acc[b.sectionName] || 0) + 1
      return acc
    }, {})
    const sectionNames = Object.entries(sectionSummary).map(([name, count]) => `${count}x ${name}`).join(', ')

    return NextResponse.json({
      success: true,
      orderId: orderId,
      bookingIds: createdBookings.map(b => b.id),
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      eventLocation: event.location,
      eventImageUrl: event.image_url,
      sectionName: sectionNames,
      totalTables: createdBookings.length,
      customerName,
      customerEmail,
    })
  } catch (error) {
    console.error('Free table booking error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete reservation' },
      { status: 500 }
    )
  }
}
