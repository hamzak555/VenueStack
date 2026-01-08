import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = await request.json()
    const { status } = body

    // Validate status
    const validStatuses = ['reserved', 'confirmed', 'cancelled', 'arrived', 'seated', 'completed']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      )
    }

    const supabase = await createClient()

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
