import { createClient } from '@/lib/supabase/server'
import { Business, SubscriptionStatus } from '@/lib/types'

export interface SubscriptionUpdateData {
  stripe_customer_id?: string
  subscription_status?: SubscriptionStatus
  subscription_id?: string | null
  subscription_current_period_end?: string | null
  subscription_cancel_at_period_end?: boolean
  trial_end_date?: string | null
  subscription_created_at?: string | null
}

/**
 * Update subscription fields for a business
 */
export async function updateBusinessSubscription(
  businessId: string,
  data: SubscriptionUpdateData
): Promise<Business> {
  const supabase = await createClient()

  const { data: business, error } = await supabase
    .from('businesses')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId)
    .select()
    .single()

  if (error) {
    console.error('Error updating business subscription:', error)
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  return business
}

/**
 * Get business by Stripe Customer ID (used in webhook handling)
 */
export async function getBusinessByStripeCustomerId(
  customerId: string
): Promise<Business | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Error fetching business by customer ID:', error)
    throw new Error(`Failed to fetch business: ${error.message}`)
  }

  return data
}

/**
 * Get business by Stripe Subscription ID (used in webhook handling)
 */
export async function getBusinessBySubscriptionId(
  subscriptionId: string
): Promise<Business | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching business by subscription ID:', error)
    throw new Error(`Failed to fetch business: ${error.message}`)
  }

  return data
}

/**
 * Check if a webhook event has already been processed (for idempotency)
 */
export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking webhook event:', error)
  }

  return !!data
}

/**
 * Record a processed webhook event
 */
export async function recordWebhookEvent(
  eventId: string,
  eventType: string,
  payload: any
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('stripe_webhook_events').insert({
    stripe_event_id: eventId,
    event_type: eventType,
    payload,
  })

  if (error) {
    // Ignore unique constraint violations (duplicate events)
    if (error.code !== '23505') {
      console.error('Error recording webhook event:', error)
    }
  }
}

/**
 * Extend trial for a business (admin action)
 */
export async function extendBusinessTrial(
  businessId: string,
  newTrialEndDate: Date
): Promise<Business> {
  const supabase = await createClient()

  const { data: business, error } = await supabase
    .from('businesses')
    .update({
      trial_end_date: newTrialEndDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId)
    .select()
    .single()

  if (error) {
    console.error('Error extending trial:', error)
    throw new Error(`Failed to extend trial: ${error.message}`)
  }

  return business
}

/**
 * Get subscription settings from platform_settings
 */
export async function getSubscriptionSettings(): Promise<{
  monthlyFee: number
  trialDays: number
  productId: string | null
  priceId: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('platform_settings')
    .select('subscription_monthly_fee, subscription_trial_days, stripe_subscription_product_id, stripe_subscription_price_id')
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching subscription settings:', error)
    // Return defaults if not configured
    return {
      monthlyFee: 49.0,
      trialDays: 14,
      productId: null,
      priceId: null,
    }
  }

  return {
    monthlyFee: data.subscription_monthly_fee || 49.0,
    trialDays: data.subscription_trial_days || 14,
    productId: data.stripe_subscription_product_id,
    priceId: data.stripe_subscription_price_id,
  }
}

/**
 * Update subscription settings in platform_settings
 */
export async function updateSubscriptionSettings(settings: {
  monthlyFee?: number
  trialDays?: number
  productId?: string | null
  priceId?: string | null
}): Promise<void> {
  const supabase = await createClient()

  const updates: any = {}
  if (settings.monthlyFee !== undefined) {
    updates.subscription_monthly_fee = settings.monthlyFee
  }
  if (settings.trialDays !== undefined) {
    updates.subscription_trial_days = settings.trialDays
  }
  if (settings.productId !== undefined) {
    updates.stripe_subscription_product_id = settings.productId
  }
  if (settings.priceId !== undefined) {
    updates.stripe_subscription_price_id = settings.priceId
  }

  const { error } = await supabase
    .from('platform_settings')
    .update(updates)
    .eq('id', (await supabase.from('platform_settings').select('id').limit(1).single()).data?.id)

  if (error) {
    console.error('Error updating subscription settings:', error)
    throw new Error(`Failed to update subscription settings: ${error.message}`)
  }
}
