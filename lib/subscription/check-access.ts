import { Business, SubscriptionStatus } from '@/lib/types'

export interface SubscriptionAccess {
  hasAccess: boolean
  status: SubscriptionStatus
  reason: 'active' | 'trialing' | 'no_subscription' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
  gracePeriodEnd?: Date
  trialEndsAt?: Date
  periodEndsAt?: Date
  canManageSubscription: boolean // Always true so they can fix payment issues
}

// Grace period in days for past_due subscriptions
const GRACE_PERIOD_DAYS = 7

/**
 * Check if a business has access to the dashboard based on subscription status
 *
 * Access rules:
 * - active: Full access
 * - trialing: Full access
 * - past_due: Access with warning for grace period (7 days), then gated
 * - canceled: No access (but can still access subscription page)
 * - incomplete: No access
 * - unpaid: No access
 * - null: No access (never subscribed)
 */
export function checkSubscriptionAccess(business: Business): SubscriptionAccess {
  const status = business.subscription_status

  // Never subscribed
  if (!status) {
    return {
      hasAccess: false,
      status: null,
      reason: 'no_subscription',
      canManageSubscription: true,
    }
  }

  // Active subscription - full access
  if (status === 'active') {
    return {
      hasAccess: true,
      status,
      reason: 'active',
      periodEndsAt: business.subscription_current_period_end
        ? new Date(business.subscription_current_period_end)
        : undefined,
      canManageSubscription: true,
    }
  }

  // Trialing - full access
  if (status === 'trialing') {
    const trialEnd = business.trial_end_date
      ? new Date(business.trial_end_date)
      : business.subscription_current_period_end
        ? new Date(business.subscription_current_period_end)
        : undefined

    return {
      hasAccess: true,
      status,
      reason: 'trialing',
      trialEndsAt: trialEnd,
      canManageSubscription: true,
    }
  }

  // Past due - give grace period
  if (status === 'past_due') {
    const periodEnd = business.subscription_current_period_end
      ? new Date(business.subscription_current_period_end)
      : new Date()

    const gracePeriodEnd = new Date(periodEnd.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    const hasAccess = new Date() < gracePeriodEnd

    return {
      hasAccess,
      status,
      reason: 'past_due',
      gracePeriodEnd,
      periodEndsAt: periodEnd,
      canManageSubscription: true,
    }
  }

  // Canceled - no access but can still manage subscription to reactivate
  if (status === 'canceled') {
    return {
      hasAccess: false,
      status,
      reason: 'canceled',
      canManageSubscription: true,
    }
  }

  // Incomplete - payment setup not completed
  if (status === 'incomplete') {
    return {
      hasAccess: false,
      status,
      reason: 'incomplete',
      canManageSubscription: true,
    }
  }

  // Unpaid - multiple payment failures
  if (status === 'unpaid') {
    return {
      hasAccess: false,
      status,
      reason: 'unpaid',
      canManageSubscription: true,
    }
  }

  // Fallback - no access
  return {
    hasAccess: false,
    status,
    reason: 'no_subscription',
    canManageSubscription: true,
  }
}

/**
 * Check if the business is in a state where they can start a new subscription
 */
export function canStartSubscription(business: Business): boolean {
  const status = business.subscription_status

  // Can start if never subscribed or canceled
  return !status || status === 'canceled'
}

/**
 * Check if the business can reactivate their subscription
 * (possible if cancel_at_period_end is true and period hasn't ended yet)
 */
export function canReactivateSubscription(business: Business): boolean {
  // Must have cancel_at_period_end set to true
  if (!business.subscription_cancel_at_period_end) return false

  // Must have a subscription that's still active/trialing (not fully canceled yet)
  const status = business.subscription_status
  if (!status || (status !== 'active' && status !== 'trialing')) return false

  // Must have a period end date in the future
  if (!business.subscription_current_period_end) return false
  return new Date() < new Date(business.subscription_current_period_end)
}

/**
 * Get a human-readable subscription status message
 */
export function getSubscriptionStatusMessage(access: SubscriptionAccess): string {
  switch (access.reason) {
    case 'active':
      return 'Your subscription is active.'
    case 'trialing':
      if (access.trialEndsAt) {
        const daysLeft = Math.ceil((access.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
      }
      return 'You are currently on a free trial.'
    case 'past_due':
      if (access.gracePeriodEnd) {
        const daysLeft = Math.ceil((access.gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysLeft > 0) {
          return `Payment failed. Please update your payment method within ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
        }
      }
      return 'Payment failed. Please update your payment method.'
    case 'canceled':
      return 'Your subscription has been canceled.'
    case 'incomplete':
      return 'Please complete your subscription setup.'
    case 'unpaid':
      return 'Your subscription is unpaid. Please update your payment method.'
    case 'no_subscription':
      return 'Start your subscription to access the dashboard.'
    default:
      return 'Please set up your subscription.'
  }
}
