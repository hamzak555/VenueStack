import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import {
  updateBusinessSubscription,
  getBusinessByStripeCustomerId,
  getBusinessBySubscriptionId,
  isWebhookEventProcessed,
  recordWebhookEvent,
} from '@/lib/db/subscriptions'
import Stripe from 'stripe'

// Disable body parsing - we need the raw body for signature verification
export const runtime = 'nodejs'

/**
 * Handle Stripe webhook events for subscription management
 *
 * Events handled:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check - skip if already processed
  const alreadyProcessed = await isWebhookEventProcessed(event.id)
  if (alreadyProcessed) {
    console.log(`Webhook event ${event.id} already processed, skipping`)
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled webhook event type: ${event.type}`)
    }

    // Record the processed event
    await recordWebhookEvent(event.id, event.type, event.data.object)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error)
    // Still return 200 to prevent Stripe from retrying
    // Log the error for investigation
    return NextResponse.json({ received: true, error: 'Processing error logged' })
  }
}

/**
 * Handle subscription created or updated events
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  // Try to find business by customer ID first, then by subscription ID
  let business = await getBusinessByStripeCustomerId(customerId)
  if (!business) {
    business = await getBusinessBySubscriptionId(subscription.id)
  }

  if (!business) {
    console.error(`No business found for customer ${customerId} or subscription ${subscription.id}`)
    return
  }

  // Map Stripe status to our status
  const statusMap: Record<Stripe.Subscription.Status, string | null> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'unpaid',
    paused: 'past_due', // Treat paused as past_due for access purposes
  }

  const status = statusMap[subscription.status] as any

  // In newer Stripe API, current_period_end is inside items.data[0]
  const periodEndTimestamp = (subscription as any).items?.data?.[0]?.current_period_end || (subscription as any).current_period_end
  const periodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000).toISOString()
    : null

  await updateBusinessSubscription(business.id, {
    stripe_customer_id: customerId,
    subscription_id: subscription.id,
    subscription_status: status,
    subscription_current_period_end: periodEnd,
    subscription_cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end_date: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    subscription_created_at: business.subscription_created_at || new Date(subscription.created * 1000).toISOString(),
  })

  console.log(`Updated subscription for business ${business.id}: status=${status}`)
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  let business = await getBusinessByStripeCustomerId(customerId)
  if (!business) {
    business = await getBusinessBySubscriptionId(subscription.id)
  }

  if (!business) {
    console.error(`No business found for deleted subscription ${subscription.id}`)
    return
  }

  await updateBusinessSubscription(business.id, {
    subscription_status: 'canceled',
    subscription_cancel_at_period_end: false,
  })

  console.log(`Marked subscription as canceled for business ${business.id}`)
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  const subscription = (invoice as any).subscription
  if (!subscription) return

  const subscriptionId = typeof subscription === 'string'
    ? subscription
    : subscription.id

  const business = await getBusinessBySubscriptionId(subscriptionId)
  if (!business) {
    console.error(`No business found for subscription ${subscriptionId}`)
    return
  }

  // If the subscription was past_due, mark it as active now that payment succeeded
  if (business.subscription_status === 'past_due') {
    await updateBusinessSubscription(business.id, {
      subscription_status: 'active',
    })
    console.log(`Marked subscription as active after successful payment for business ${business.id}`)
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  const subscription = (invoice as any).subscription
  if (!subscription) return

  const subscriptionId = typeof subscription === 'string'
    ? subscription
    : subscription.id

  const business = await getBusinessBySubscriptionId(subscriptionId)
  if (!business) {
    console.error(`No business found for subscription ${subscriptionId}`)
    return
  }

  // Mark as past_due
  await updateBusinessSubscription(business.id, {
    subscription_status: 'past_due',
  })

  console.log(`Marked subscription as past_due after failed payment for business ${business.id}`)

  // TODO: Send notification email to business about failed payment
}
