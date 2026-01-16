import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTableReservationApprovedEmail, sendTableReservationCancelledEmail } from '@/lib/sendgrid'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = await request.json()
    const { status } = body

    // Validate status
    const validStatuses = ['requested', 'approved', 'confirmed', 'cancelled', 'arrived', 'seated', 'completed']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current booking to check if we need to send approval email
    const { data: currentBooking, error: fetchError } = await supabase
      .from('table_bookings')
      .select(`
        *,
        events (
          id,
          title,
          event_date,
          event_time,
          location
        ),
        event_table_sections (
          section_name
        )
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError || !currentBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Update the booking status
    const { data, error } = await supabase
      .from('table_bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single()

    if (error) {
      console.error('Error updating table booking status:', error)
      return NextResponse.json(
        { error: 'Failed to update booking status' },
        { status: 500 }
      )
    }

    // Send approval email if status changed to 'approved'
    if (status === 'approved' && currentBooking.status !== 'approved') {
      const event = currentBooking.events
      sendTableReservationApprovedEmail({
        to: currentBooking.customer_email,
        customerName: currentBooking.customer_name || currentBooking.customer_email.split('@')[0],
        eventTitle: event.title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        eventLocation: event.location,
        tableName: currentBooking.event_table_sections?.section_name || 'Table',
      }).catch(err => console.error('Failed to send table reservation approved email:', err))
    }

    // Send cancellation email if status changed to 'cancelled'
    if (status === 'cancelled' && currentBooking.status !== 'cancelled') {
      const event = currentBooking.events
      sendTableReservationCancelledEmail({
        to: currentBooking.customer_email,
        customerName: currentBooking.customer_name || currentBooking.customer_email.split('@')[0],
        eventTitle: event.title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        eventLocation: event.location,
        tableName: currentBooking.event_table_sections?.section_name || 'Table',
      }).catch(err => console.error('Failed to send table reservation cancelled email:', err))
    }

    return NextResponse.json({
      success: true,
      booking: data,
    })
  } catch (error) {
    console.error('Error in table booking status update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
