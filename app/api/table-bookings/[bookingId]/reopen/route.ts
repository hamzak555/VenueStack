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
        amount,
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

    // Only allow reopening 'completed' or 'cancelled' bookings
    if (booking.status !== 'completed' && booking.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only completed or cancelled reservations can be reopened' },
        { status: 400 }
      )
    }

    // Reopen the booking - free reservations go to 'requested', paid go to 'confirmed'
    const isFreeBooking = !booking.amount || booking.amount === 0
    const { error: updateError } = await supabase
      .from('table_bookings')
      .update({
        status: isFreeBooking ? 'requested' : 'confirmed',
        table_number: null,
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
