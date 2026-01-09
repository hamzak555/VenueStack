'use client'

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface SubscriptionGateWrapperProps {
  children: ReactNode
  gatedContent: ReactNode
  hasAccess: boolean
  isCanceledOrNoSubscription: boolean
}

/**
 * Client-side wrapper that detects the current path and decides
 * whether to show gated content or allow access.
 */
export function SubscriptionGateWrapper({
  children,
  gatedContent,
  hasAccess,
  isCanceledOrNoSubscription,
}: SubscriptionGateWrapperProps) {
  const pathname = usePathname()

  // Only allow access to subscription settings page for users who need to manage subscription
  const isSubscriptionPage = pathname?.includes('/settings/subscription')

  if (isSubscriptionPage && isCanceledOrNoSubscription) {
    return <>{children}</>
  }

  // If user has access, show children
  if (hasAccess) {
    return <>{children}</>
  }

  // Otherwise show gated content
  return <>{gatedContent}</>
}
