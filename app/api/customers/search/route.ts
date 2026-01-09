import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessSession } from '@/lib/auth/business-session'

/**
 * GET - Search customers by name for a business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getBusinessSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const businessId = session.businessId

    if (!query || query.length < 2) {
      return NextResponse.json({ customers: [] })
    }

    const supabase = await createClient()

    // Search in orders
    const { data: orderCustomers } = await supabase
      .from('orders')
      .select(`
        customer_name,
        customer_email,
        customer_phone,
        events!inner (business_id)
      `)
      .eq('events.business_id', businessId)
      .eq('status', 'completed')
      .ilike('customer_name', `%${query}%`)
      .limit(10)

    // Search in table bookings
    const { data: bookingCustomers } = await supabase
      .from('table_bookings')
      .select(`
        customer_name,
        customer_email,
        customer_phone,
        events!inner (business_id)
      `)
      .eq('events.business_id', businessId)
      .neq('status', 'cancelled')
      .ilike('customer_name', `%${query}%`)
      .limit(10)

    // Combine and deduplicate by phone (primary) or email (fallback)
    const customerMap = new Map<string, { name: string; email: string | null; phone: string | null; emails: string[] }>()

    const processCustomer = (c: any) => {
      const key = c.customer_phone || c.customer_email?.toLowerCase() || c.customer_name.toLowerCase()
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: c.customer_name,
          email: c.customer_email,
          phone: c.customer_phone,
          emails: c.customer_email ? [c.customer_email.toLowerCase()] : [],
        })
      } else if (c.customer_email) {
        const existing = customerMap.get(key)!
        if (!existing.emails.includes(c.customer_email.toLowerCase())) {
          existing.emails.push(c.customer_email.toLowerCase())
        }
      }
    }

    orderCustomers?.forEach(processCustomer)
    bookingCustomers?.forEach(processCustomer)

    // Get all unique emails to fetch ratings
    const allEmails = Array.from(customerMap.values()).flatMap(c => c.emails)

    // Fetch ratings for these customers
    const { data: ratings } = allEmails.length > 0
      ? await supabase
          .from('customer_feedback')
          .select('customer_email, rating')
          .eq('business_id', businessId)
          .in('customer_email', allEmails)
      : { data: [] }

    // Group ratings by email
    const ratingsMap = new Map<string, number[]>()
    for (const r of ratings || []) {
      const key = r.customer_email.toLowerCase()
      if (!ratingsMap.has(key)) {
        ratingsMap.set(key, [])
      }
      ratingsMap.get(key)!.push(r.rating)
    }

    // Build final customer list with ratings
    const customers = Array.from(customerMap.values()).map(c => {
      // Calculate average rating from all known emails
      const allRatings: number[] = []
      for (const email of c.emails) {
        const emailRatings = ratingsMap.get(email)
        if (emailRatings) {
          allRatings.push(...emailRatings)
        }
      }
      const averageRating = allRatings.length > 0
        ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
        : null

      return {
        name: c.name,
        email: c.email,
        phone: c.phone,
        rating: averageRating,
      }
    }).slice(0, 10)

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('Error searching customers:', error)
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 })
  }
}
