import { ReactNode } from 'react'
import { Business } from '@/lib/types'
import { checkSubscriptionAccess } from '@/lib/subscription/check-access'
import { getSubscriptionSettings } from '@/lib/db/subscriptions'
import { SubscriptionRequiredView } from './subscription-required-view'
import { PaymentWarningBanner } from './payment-warning-banner'
import { SubscriptionGateWrapper } from './subscription-gate-wrapper'

interface SubscriptionGateProps {
  business: Business
  businessSlug: string
  children: ReactNode
  isAdminBypass?: boolean
  currentPath?: string
}

/**
 * Subscription gate component that wraps dashboard content.
 *
 * - Always allows access to subscription settings page
 * - Shows warning banner for past_due with grace period
 * - Shows gated view for no access
 * - Bypasses check for admin users
 */
export async function SubscriptionGate({
  business,
  businessSlug,
  children,
  isAdminBypass = false,
  currentPath = '',
}: SubscriptionGateProps) {
  // Admin bypass - skip all subscription checks
  if (isAdminBypass) {
    return <>{children}</>
  }

  const access = checkSubscriptionAccess(business)
  const settings = await getSubscriptionSettings()

  // Check if user needs subscription management access
  const isCanceledOrNoSubscription = access.reason === 'canceled' || access.reason === 'no_subscription'

  // If past_due with access (within grace period), show warning banner
  if (access.reason === 'past_due' && access.hasAccess) {
    return (
      <>
        <PaymentWarningBanner
          businessSlug={businessSlug}
          gracePeriodEnd={access.gracePeriodEnd}
        />
        {children}
      </>
    )
  }

  // Create the gated content view
  const gatedContent = (
    <SubscriptionRequiredView
      businessSlug={businessSlug}
      businessId={business.id}
      access={access}
      monthlyFee={settings.monthlyFee}
      trialDays={settings.trialDays}
    />
  )

  // Use client-side wrapper for reliable path detection
  return (
    <SubscriptionGateWrapper
      hasAccess={access.hasAccess}
      isCanceledOrNoSubscription={isCanceledOrNoSubscription}
      gatedContent={gatedContent}
    >
      {children}
    </SubscriptionGateWrapper>
  )
}
