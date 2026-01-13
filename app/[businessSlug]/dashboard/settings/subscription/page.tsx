import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireOwnerAccess } from '@/lib/auth/role-guard'
import { SubscriptionSettings } from '@/components/business/subscription-settings'
import { stripe } from '@/lib/stripe/server'
import { updateBusinessSubscription } from '@/lib/db/subscriptions'

export const dynamic = 'force-dynamic'

interface SubscriptionSettingsPageProps {
  params: Promise<{
    businessSlug: string
  }>
  searchParams: Promise<{
    success?: string
    canceled?: string
  }>
}

/**
 * Sync subscription status from Stripe (fallback for when webhooks aren't configured)
 */
async function syncSubscriptionFromStripe(business: any) {
  if (!business.stripe_customer_id) return

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: business.stripe_customer_id,
      limit: 1,
      status: 'all',
    })

    if (subscriptions.data.length === 0) return

    const subscription = subscriptions.data[0] as any

    // Map Stripe status to our status
    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      incomplete: 'incomplete',
      incomplete_expired: 'canceled',
      unpaid: 'unpaid',
      paused: 'past_due',
    }

    const status = statusMap[subscription.status] || 'canceled'

    // Get period end
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null

    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null

    // Update database
    await updateBusinessSubscription(business.id, {
      subscription_id: subscription.id,
      subscription_status: status as any,
      subscription_current_period_end: periodEnd,
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end_date: trialEnd,
      subscription_created_at: business.subscription_created_at || new Date(subscription.created * 1000).toISOString(),
    })
  } catch (error) {
    console.error('Error syncing subscription from Stripe:', error)
  }
}

export default async function SubscriptionSettingsPage({
  params,
  searchParams,
}: SubscriptionSettingsPageProps) {
  const { businessSlug } = await params
  const { success, canceled } = await searchParams

  let business
  try {
    business = await getBusinessBySlug(businessSlug)
  } catch {
    notFound()
  }

  // Protect page - only owner can access subscription settings
  await requireOwnerAccess(business.id, businessSlug)

  // Sync subscription status from Stripe when returning from checkout
  if (success === 'true') {
    await syncSubscriptionFromStripe(business)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
      </div>

      {success === 'true' && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
          <p className="text-sm text-green-500">
            Your subscription has been set up successfully. Welcome aboard!
          </p>
        </div>
      )}

      {canceled === 'true' && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
          <p className="text-sm text-yellow-500">
            Subscription setup was canceled. You can start your subscription anytime.
          </p>
        </div>
      )}

      <SubscriptionSettings businessId={business.id} businessSlug={businessSlug} />
    </div>
  )
}
