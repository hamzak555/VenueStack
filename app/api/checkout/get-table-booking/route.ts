import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get table bookings by order_id
    const { data: bookings, error: bookingsError } = await supabase
      .from('table_bookings')
      .select(`
        *,
        event_table_sections(section_name),
        events(title, event_date, event_time, location, image_url)
      `)
      .eq('order_id', orderId)

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json(
        { error: 'Failed to fetch booking details' },
        { status: 500 }
      )
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    const firstBooking = bookings[0]
    const event = firstBooking.events

    // Build section summary
    const sectionSummary = bookings.reduce((acc: Record<string, number>, b: any) => {
      const name = b.event_table_sections?.section_name || 'Unknown Section'
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {})
    const sectionNames = Object.entries(sectionSummary)
      .map(([name, count]) => `${count}x ${name}`)
      .join(', ')

    // Calculate total amount
    const totalAmount = bookings.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)

    return NextResponse.json({
      success: true,
      type: 'table_booking',
      bookingIds: bookings.map((b: any) => b.id),
      eventTitle: event?.title || 'Event',
      eventDate: event?.event_date,
      eventTime: event?.event_time,
      eventLocation: event?.location,
      eventImageUrl: event?.image_url,
      sectionName: sectionNames,
      tableNumbers: bookings.map((b: any) => b.table_number),
      totalTables: bookings.length,
      amount: totalAmount,
      customerName: firstBooking.customer_name,
      customerEmail: firstBooking.customer_email,
      orderId: orderId,
    })
  } catch (error) {
    console.error('Get table booking error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}
