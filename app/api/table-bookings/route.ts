import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { isServerRole, type BusinessRole } from '@/lib/auth/roles'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const body = await request.json()
    const {
      eventId,
      eventTableSectionId,
      tableName,
      customerName,
      customerEmail,
      customerPhone,
    } = body

    // Validate required fields
    if (!eventId || !eventTableSectionId || !tableName || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, business_id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify the user has access to this business (supports admin bypass)
    const session = await verifyBusinessAccess(event.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the section exists and belongs to the event
    const { data: section, error: sectionError } = await supabase
      .from('event_table_sections')
      .select('id, available_tables')
      .eq('id', eventTableSectionId)
      .eq('event_id', eventId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Check if user is a server role
    const userIsServer = isServerRole(session.role as BusinessRole)

    // For non-server users, check if the table is already booked
    // Server reservations don't occupy tables, so skip this check
    if (!userIsServer) {
      const { data: existingBooking } = await supabase
        .from('table_bookings')
        .select('id')
        .eq('event_table_section_id', eventTableSectionId)
        .eq('table_number', tableName)
        .neq('status', 'cancelled')
        .single()

      if (existingBooking) {
        return NextResponse.json(
          { error: 'This table is already booked' },
          { status: 400 }
        )
      }
    }

    // Create the booking
    // For servers: table_number is null, requested_table_number stores their selection, status is 'confirmed'
    // For others: table_number is assigned, status is 'seated'
    const { data: booking, error: bookingError } = await supabase
      .from('table_bookings')
      .insert({
        event_id: eventId,
        event_table_section_id: eventTableSectionId,
        table_number: userIsServer ? null : tableName,
        requested_table_number: userIsServer ? tableName : null,
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        status: userIsServer ? 'confirmed' : 'seated', // Server reservations are confirmed, others are seated
        amount: null, // No payment for manual reservations
        order_id: null,
        created_by_name: session.name || null,
        created_by_email: session.email || null,
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create reservation' },
        { status: 500 }
      )
    }

    // Update available tables count only for non-server reservations
    // (server reservations don't occupy tables)
    if (!userIsServer && section.available_tables > 0) {
      await supabase
        .from('event_table_sections')
        .update({ available_tables: section.available_tables - 1 })
        .eq('id', eventTableSectionId)
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/table-bookings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
