import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { updateBusinessSubscription } from '@/lib/db/subscriptions'

interface RouteContext {
  params: Promise<{ businessId: string }>
}

/**
 * POST - Manually sync subscription status from Stripe (admin only)
 * Useful when webhooks weren't received (e.g., local development)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId } = await context.params

    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!business.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer ID found' }, { status: 400 })
    }

    // Fetch subscriptions from Stripe for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: business.stripe_customer_id,
      limit: 1,
      status: 'all',
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: 'No subscriptions found in Stripe' }, { status: 404 })
    }

    const subscription = subscriptions.data[0]

    // Map Stripe status to our status
    const statusMap: Record<Stripe.Subscription.Status, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      incomplete: 'incomplete',
      incomplete_expired: 'canceled',
      unpaid: 'unpaid',
      paused: 'past_due',
    }

    const status = statusMap[subscription.status] as any

    // Update the business with subscription data
    await updateBusinessSubscription(businessId, {
      subscription_id: subscription.id,
      subscription_status: status,
      subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end_date: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      subscription_created_at: new Date(subscription.created * 1000).toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription synced successfully',
      subscription: {
        id: subscription.id,
        status: status,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
      },
    })
  } catch (error) {
    console.error('Error syncing subscription:', error)
    return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 })
  }
}
