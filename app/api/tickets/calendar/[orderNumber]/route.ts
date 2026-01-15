import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/tickets/calendar/[orderNumber]
 * Downloads .ics calendar file for the event (for email links)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Missing order number' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get order with event details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        event:events (
          title,
          description,
          event_date,
          event_time,
          location
        )
      `)
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Extract event data
    const event = Array.isArray(order.event) ? order.event[0] : order.event

    if (!event) {
      return NextResponse.json(
        { error: 'Event data not found' },
        { status: 404 }
      )
    }

    // Parse date and time
    const eventDate = new Date(event.event_date)
    let startDate = eventDate
    let endDate = new Date(eventDate)

    // If we have a time, use it
    if (event.event_time) {
      const [hours, minutes] = event.event_time.split(':').map(Number)
      startDate = new Date(eventDate)
      startDate.setHours(hours, minutes, 0, 0)

      // End time is 2 hours after start (default duration)
      endDate = new Date(startDate)
      endDate.setHours(endDate.getHours() + 2)
    } else {
      // All-day event if no time specified
      endDate.setDate(endDate.getDate() + 1)
    }

    // Format dates for ICS (YYYYMMDDTHHMMSS format)
    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    // Escape special characters for ICS
    const escapeICS = (str: string): string => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
    }

    // Generate unique ID for the event
    const uid = `order-${orderNumber}@venuestack.io`
    const now = formatICSDate(new Date())

    // Build description
    let description = `You have tickets for ${event.title}!`
    if (event.description) {
      description += `\\n\\n${escapeICS(event.description)}`
    }
    description += `\\n\\nOrder #${orderNumber}`
    description += `\\n\\nDownload your tickets at: https://venuestack.io/api/tickets/download/${orderNumber}`

    // Build ICS content with proper CRLF line endings
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VenueStack//Tickets//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeICS(event.title)}`,
      `DESCRIPTION:${description}`,
      event.location ? `LOCATION:${escapeICS(event.location)}` : null,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    // Return as .ics file
    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics"`,
      },
    })
  } catch (error) {
    console.error('Calendar generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate calendar' },
      { status: 500 }
    )
  }
}
