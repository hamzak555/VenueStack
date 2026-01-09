import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessSession } from '@/lib/auth/business-session'
import { updateBusinessSubscription } from '@/lib/db/subscriptions'
import { canReactivateSubscription } from '@/lib/subscription/check-access'

interface RouteContext {
  params: Promise<{ businessId: string }>
}

/**
 * POST - Reactivate a canceled subscription before the period ends
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
      .select('*')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!canReactivateSubscription(business)) {
      return NextResponse.json(
        { error: 'Cannot reactivate subscription. Please start a new subscription.' },
        { status: 400 }
      )
    }

    if (!business.subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
    }

    // Remove the cancellation
    await stripe.subscriptions.update(business.subscription_id, {
      cancel_at_period_end: false,
    })

    // Update local status - only update cancel flag, keep existing status
    await updateBusinessSubscription(businessId, {
      subscription_cancel_at_period_end: false,
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
    })
  } catch (error) {
    console.error('Error reactivating subscription:', error)
    return NextResponse.json({ error: 'Failed to reactivate subscription' }, { status: 500 })
  }
}
