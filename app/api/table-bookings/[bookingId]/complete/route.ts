import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessSession } from '@/lib/auth/business-session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = await request.json()
    const { rating, feedback } = body

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

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
        customer_email,
        table_number,
        event_table_sections (
          section_name
        ),
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

    // Only allow completing 'arrived' bookings
    if (booking.status !== 'arrived') {
      return NextResponse.json(
        { error: 'Only arrived reservations can be marked as completed' },
        { status: 400 }
      )
    }

    // Update status to completed and clear table_number to free up the table
    // Store the table number in completed_table_number for historical reference
    const { error: statusError } = await supabase
      .from('table_bookings')
      .update({
        status: 'completed',
        completed_table_number: booking.table_number,  // Store for historical reference
        table_number: null,  // Clear table so it's available for new bookings
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)

    if (statusError) {
      console.error('Error updating booking status:', statusError)
      return NextResponse.json(
        { error: 'Failed to update booking status' },
        { status: 500 }
      )
    }

    // Insert feedback with table info for historical reference
    const sectionName = (booking.event_table_sections as any)?.section_name || null
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('customer_feedback')
      .insert({
        table_booking_id: bookingId,
        business_id: bookingBusinessId,
        customer_email: booking.customer_email,
        rating,
        feedback: feedback?.trim() || null,
        created_by_name: session.name,
        created_by_email: session.email,
        table_number: booking.table_number,
        section_name: sectionName,
      })
      .select()
      .single()

    if (feedbackError) {
      console.error('Error saving feedback:', feedbackError)
      // Rollback status change
      await supabase
        .from('table_bookings')
        .update({ status: 'arrived', updated_at: new Date().toISOString() })
        .eq('id', bookingId)

      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      feedback: feedbackData,
    })
  } catch (error) {
    console.error('Error completing booking:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
