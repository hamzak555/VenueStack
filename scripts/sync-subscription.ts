import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function syncSubscription(slug: string) {
  // Get business by slug
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !business) {
    console.log('Business not found:', error)
    return
  }

  console.log('Found business:', business.name, 'ID:', business.id)
  console.log('Current status:', business.subscription_status)
  console.log('Stripe Customer ID:', business.stripe_customer_id)

  if (!business.stripe_customer_id) {
    console.log('No Stripe customer ID - cannot sync')
    return
  }

  // Fetch subscription from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: business.stripe_customer_id,
    limit: 1,
  })

  if (subscriptions.data.length === 0) {
    console.log('No subscriptions found in Stripe')
    return
  }

  const sub = subscriptions.data[0]
  console.log('Stripe subscription:', sub.id, 'Status:', sub.status)

  // Update business
  const periodEnd = (sub as any).current_period_end
  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      subscription_id: sub.id,
      subscription_status: sub.status === 'trialing' ? 'trialing' : sub.status,
      subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      subscription_cancel_at_period_end: sub.cancel_at_period_end,
      trial_end_date: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      subscription_created_at: new Date(sub.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', business.id)

  if (updateError) {
    console.log('Update error:', updateError)
  } else {
    console.log('✓ Subscription synced successfully!')
    console.log('New status:', sub.status)
  }
}

const slug = process.argv[2] || 'umars-club'
syncSubscription(slug)
