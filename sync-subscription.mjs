import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const businessSlug = process.argv[2] || 'lunasol-miami'

async function syncSubscription() {
  console.log(`Syncing subscription for: ${businessSlug}`)

  // Get business
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', businessSlug)
    .single()

  if (error || !business) {
    console.error('Business not found:', error)
    return
  }

  console.log('Business ID:', business.id)
  console.log('Stripe Customer ID:', business.stripe_customer_id)

  if (!business.stripe_customer_id) {
    console.error('No Stripe customer ID found')
    return
  }

  // Get subscriptions from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: business.stripe_customer_id,
    limit: 1,
  })

  if (subscriptions.data.length === 0) {
    console.log('No subscriptions found in Stripe')
    return
  }

  const subscription = subscriptions.data[0]
  console.log('Found subscription:', subscription.id)
  console.log('Status:', subscription.status)

  // Map status
  const statusMap = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'unpaid',
    paused: 'past_due',
  }

  const status = statusMap[subscription.status]

  // Update business
  // In newer Stripe API, current_period_end is inside items.data[0]
  const periodEndTimestamp = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end
  const periodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000).toISOString()
    : null
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null
  const createdAt = subscription.created
    ? new Date(subscription.created * 1000).toISOString()
    : new Date().toISOString()

  console.log('Period End:', periodEnd)
  console.log('Trial End:', trialEnd)

  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      subscription_id: subscription.id,
      subscription_status: status,
      subscription_current_period_end: periodEnd,
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end_date: trialEnd,
      subscription_created_at: createdAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', business.id)

  if (updateError) {
    console.error('Failed to update:', updateError)
    return
  }

  console.log('✓ Subscription synced successfully!')
  console.log('  Status:', status)
}

syncSubscription().catch(console.error)
