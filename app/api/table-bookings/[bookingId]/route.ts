import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { stripe } from '@/lib/stripe/server'

// GET - Fetch booking details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const supabase = await createClient()

    // Get the booking with related data
    const { data: booking, error } = await supabase
      .from('table_bookings')
      .select(`
        *,
        events (
          id,
          title,
          event_date,
          event_time,
          location,
          image_url,
          business_id
        ),
        event_table_sections (
          id,
          section_name,
          price,
          capacity
        )
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify the user has access to this business (supports admin bypass)
    const session = await verifyBusinessAccess(booking.events.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get related bookings if this is part of a multi-table order
    let relatedBookings: any[] = []
    if (booking.order_id) {
      const { data: related } = await supabase
        .from('table_bookings')
        .select(`
          id,
          table_number,
          status,
          amount,
          event_table_sections (
            section_name
          )
        `)
        .eq('order_id', booking.order_id)
        .order('created_at', { ascending: true })

      relatedBookings = related?.map((b: any) => ({
        id: b.id,
        table_number: b.table_number,
        status: b.status,
        amount: b.amount,
        section_name: b.event_table_sections?.section_name || 'Unknown',
      })) || []
    }

    // Fetch refunds for this booking
    const { data: refunds } = await supabase
      .from('table_booking_refunds')
      .select('*')
      .eq('table_booking_id', bookingId)
      .order('created_at', { ascending: false })

    // Fetch customer feedback for this booking (if completed)
    const { data: feedback } = await supabase
      .from('customer_feedback')
      .select('*')
      .eq('table_booking_id', bookingId)
      .single()

    // Fetch payment intent to get fee breakdown
    let paymentMetadata: {
      subtotal: number
      taxAmount: number
      taxPercentage: number
      platformFee: number
      stripeFee: number
      totalCharged: number
      transferAmount: number
    } | null = null

    if (booking.order_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.order_id)
        const metadata = paymentIntent.metadata

        const subtotal = parseFloat(metadata.totalTablePrice || '0')
        const taxAmount = parseFloat(metadata.taxAmount || '0')
        const taxPercentage = parseFloat(metadata.taxPercentage || '0')
        const platformFeeForCustomer = parseFloat(metadata.platformFeeForCustomer || '0')
        const stripeFee = parseFloat(metadata.stripeFee || '0')
        const totalCharged = paymentIntent.amount / 100

        // Calculate transfer amount (what business receives)
        const platformFee = parseFloat(metadata.platformFee || '0')
        const transferAmount = totalCharged - platformFee - stripeFee

        paymentMetadata = {
          subtotal,
          taxAmount,
          taxPercentage,
          platformFee: platformFeeForCustomer,
          stripeFee: metadata.stripeFeePayer === 'customer' ? stripeFee : 0,
          totalCharged,
          transferAmount,
        }
      } catch (error) {
        console.error('Error fetching payment intent:', error)
      }
    }

    // Calculate refund amounts
    const bookingAmount = parseFloat(booking.amount?.toString() || '0')
    const totalRefunded = refunds?.filter(r => r.status === 'succeeded')
      .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0

    return NextResponse.json({
      booking: {
        id: booking.id,
        table_number: booking.table_number,
        completed_table_number: booking.completed_table_number,
        status: booking.status,
        amount: booking.amount,
        order_id: booking.order_id,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        created_at: booking.created_at,
        notes: booking.notes || [],
        event: {
          id: booking.events.id,
          title: booking.events.title,
          event_date: booking.events.event_date,
          event_time: booking.events.event_time,
          location: booking.events.location,
        },
        section: {
          id: booking.event_table_sections?.id,
          name: booking.event_table_sections?.section_name,
          capacity: booking.event_table_sections?.capacity,
          price: booking.event_table_sections?.price,
        },
      },
      relatedBookings,
      refunds: refunds || [],
      paymentMetadata,
      bookingAmount,
      totalRefunded,
      feedback: feedback || null,
    })
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}
