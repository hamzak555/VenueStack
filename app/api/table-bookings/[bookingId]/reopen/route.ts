import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessSession } from '@/lib/auth/business-session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params

    const session = await getBusinessSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get booking to verify access and check status
    const { data: booking, error: bookingError } = await supabase
      .from('table_bookings')
      .select(`
        id,
        status,
        completed_table_number,
        event_table_section_id,
        events!inner (
          business_id
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify business access
    const bookingBusinessId = (booking.events as any).business_id
    if (session.businessId !== bookingBusinessId && !session.adminBypass) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow reopening 'completed' bookings
    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed reservations can be reopened' },
        { status: 400 }
      )
    }

    // Check if the original table is still available
    if (booking.completed_table_number) {
      const { data: existingBooking } = await supabase
        .from('table_bookings')
        .select('id')
        .eq('event_table_section_id', booking.event_table_section_id)
        .eq('table_number', booking.completed_table_number)
        .neq('id', bookingId)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .single()

      if (existingBooking) {
        return NextResponse.json(
          { error: 'The original table is now occupied by another reservation' },
          { status: 400 }
        )
      }
    }

    // Restore the booking to arrived status with the original table
    const { error: updateError } = await supabase
      .from('table_bookings')
      .update({
        status: 'arrived',
        table_number: booking.completed_table_number,
        completed_table_number: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error reopening booking:', updateError)
      return NextResponse.json(
        { error: 'Failed to reopen reservation' },
        { status: 500 }
      )
    }

    // Delete the feedback record
    await supabase
      .from('customer_feedback')
      .delete()
      .eq('table_booking_id', bookingId)

    return NextResponse.json({
      success: true,
      message: 'Reservation reopened successfully'
    })
  } catch (error) {
    console.error('Error reopening booking:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
