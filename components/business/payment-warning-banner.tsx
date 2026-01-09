'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PaymentWarningBannerProps {
  businessSlug: string
  gracePeriodEnd?: Date
  message?: string
}

export function PaymentWarningBanner({
  businessSlug,
  gracePeriodEnd,
  message,
}: PaymentWarningBannerProps) {
  const daysLeft = gracePeriodEnd
    ? Math.max(0, Math.ceil((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-yellow-500">Payment Required</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {message ||
              (daysLeft > 0
                ? `Your payment failed. Please update your payment method within ${daysLeft} day${daysLeft === 1 ? '' : 's'} to avoid losing access.`
                : 'Your payment has failed. Please update your payment method to continue using the dashboard.')}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="flex-shrink-0">
          <Link href={`/${businessSlug}/dashboard/settings/subscription`}>
            Update Payment
          </Link>
        </Button>
      </div>
    </div>
  )
}
