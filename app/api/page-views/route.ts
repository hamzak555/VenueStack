import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { businessId, pageType, eventId, visitorId } = await request.json()

    if (!businessId || !pageType || !visitorId) {
      return NextResponse.json(
        { error: 'businessId, pageType, and visitorId are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get request metadata
    const userAgent = request.headers.get('user-agent')
    const referrer = request.headers.get('referer')
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || null

    const { error } = await supabase.from('page_views').insert({
      business_id: businessId,
      page_type: pageType,
      event_id: eventId || null,
      visitor_id: visitorId,
      referrer: referrer,
      user_agent: userAgent,
      ip_address: ipAddress,
    })

    if (error) {
      console.error('Error recording page view:', error)
      return NextResponse.json(
        { error: 'Failed to record page view' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in page-views API:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
