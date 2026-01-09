import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessSession } from '@/lib/auth/business-session'

interface RouteContext {
  params: Promise<{ businessId: string }>
}

/**
 * POST - Create Stripe Customer Portal session for managing billing
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const session = await getBusinessSession()

    if (!session || (session.businessId !== businessId && !session.adminBypass)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('stripe_customer_id, slug')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!business.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${appUrl}/${business.slug}/dashboard/settings/subscription`,
    })

    return NextResponse.json({ portalUrl: portalSession.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 })
  }
}
