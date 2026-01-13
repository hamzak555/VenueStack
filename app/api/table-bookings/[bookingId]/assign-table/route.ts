import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { canManageTables, type BusinessRole } from '@/lib/auth/roles'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = await request.json()
    const { tableName, newSectionId } = body // tableName can be string (custom name) or null to unassign

    const supabase = await createClient()

    // Get the booking to find its section
    const { data: booking, error: bookingError } = await supabase
      .from('table_bookings')
      .select('*, event_table_sections(*)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Get the event to verify access
    const { data: section } = await supabase
      .from('event_table_sections')
      .select('events(business_id)')
      .eq('id', booking.event_table_section_id)
      .single()

    if (section?.events) {
      const businessId = (section.events as any).business_id
      const session = await verifyBusinessAccess(businessId)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Only owner, manager, host, accounting can move reservations
      if (!canManageTables(session.role as BusinessRole)) {
        return NextResponse.json(
          { error: 'You do not have permission to move reservations between tables' },
          { status: 403 }
        )
      }
    }

    const targetSectionId = newSectionId || booking.event_table_section_id

    // If assigning a table (not unassigning), check if it's already taken in the target section
    // Exclude cancelled and completed bookings - those tables are available
    if (tableName !== null && tableName !== undefined && tableName !== '') {
      const { data: existingBooking } = await supabase
        .from('table_bookings')
        .select('id')
        .eq('event_table_section_id', targetSectionId)
        .eq('table_number', tableName)
        .neq('id', bookingId)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .single()

      if (existingBooking) {
        return NextResponse.json(
          { error: 'This table is already assigned to another booking' },
          { status: 400 }
        )
      }
    }

    // If moving to a different section, update available_tables counts
    if (newSectionId && newSectionId !== booking.event_table_section_id) {
      // Increment available_tables in the old section (if booking had a table assigned)
      if (booking.table_number) {
        const { data: oldSection } = await supabase
          .from('event_table_sections')
          .select('available_tables, total_tables')
          .eq('id', booking.event_table_section_id)
          .single()

        if (oldSection) {
          await supabase
            .from('event_table_sections')
            .update({ available_tables: Math.min(oldSection.available_tables + 1, oldSection.total_tables) })
            .eq('id', booking.event_table_section_id)
        }
      }

      // Decrement available_tables in the new section (if assigning a table)
      if (tableName) {
        const { data: newSection } = await supabase
          .from('event_table_sections')
          .select('available_tables')
          .eq('id', newSectionId)
          .single()

        if (newSection && newSection.available_tables > 0) {
          await supabase
            .from('event_table_sections')
            .update({ available_tables: newSection.available_tables - 1 })
            .eq('id', newSectionId)
        }
      }
    }

    // Update the booking with the assigned table and optionally new section
    const updateData: Record<string, unknown> = {
      table_number: tableName === '' ? null : tableName,
      updated_at: new Date().toISOString(),
    }

    // When assigning a table, automatically set status to 'seated'
    // (only if current status is reserved or confirmed - arrived stays arrived)
    if (tableName !== null && tableName !== undefined && tableName !== '') {
      const seateableStatuses = ['reserved', 'confirmed']
      if (seateableStatuses.includes(booking.status)) {
        updateData.status = 'seated'
      }
    }

    if (newSectionId) {
      updateData.event_table_section_id = newSectionId
    }

    const { data, error } = await supabase
      .from('table_bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single()

    if (error) {
      console.error('Error assigning table:', error)
      return NextResponse.json(
        { error: `Failed to assign table: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      booking: data,
    })
  } catch (error) {
    console.error('Error in table assignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
