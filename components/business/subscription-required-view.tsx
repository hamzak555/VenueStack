'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreditCard, Sparkles, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SubscriptionAccess } from '@/lib/subscription/check-access'

interface SubscriptionRequiredViewProps {
  businessSlug: string
  businessId: string
  access: SubscriptionAccess
  monthlyFee?: number
  trialDays?: number
}

export function SubscriptionRequiredView({
  businessSlug,
  businessId,
  access,
  monthlyFee = 49,
  trialDays = 14,
}: SubscriptionRequiredViewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartSubscription = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start subscription')
      }

      const data = await response.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start subscription')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenPortal = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription/portal`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to open billing portal')
      }

      const data = await response.json()
      if (data.portalUrl) {
        window.location.href = data.portalUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setIsLoading(false)
    }
  }

  const getTitle = () => {
    switch (access.reason) {
      case 'no_subscription':
        return 'Subscription Required'
      case 'canceled':
        return 'Subscription Canceled'
      case 'past_due':
        return 'Payment Failed'
      case 'unpaid':
        return 'Payment Required'
      case 'incomplete':
        return 'Complete Your Subscription'
      default:
        return 'Subscription Required'
    }
  }

  const getMessage = () => {
    switch (access.reason) {
      case 'no_subscription':
        return `Start your subscription to unlock the full dashboard. ${trialDays > 0 ? `Includes a ${trialDays}-day free trial.` : ''}`
      case 'canceled':
        return 'Your subscription has been canceled. Start a new subscription to regain access to the dashboard.'
      case 'past_due':
        return 'Your payment has failed. Please update your payment method to continue using the dashboard.'
      case 'unpaid':
        return 'Your subscription is unpaid due to multiple payment failures. Please update your payment method.'
      case 'incomplete':
        return 'Your subscription setup was not completed. Please complete the payment to access the dashboard.'
      default:
        return 'A subscription is required to access the dashboard.'
    }
  }

  const showStartButton = access.reason === 'no_subscription' || access.reason === 'canceled'
  const showPortalButton = access.reason === 'past_due' || access.reason === 'unpaid' || access.reason === 'incomplete'

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center ${
            access.reason === 'canceled' ? 'bg-red-500/10' : 'bg-primary/10'
          }`}>
            {access.reason === 'no_subscription' ? (
              <Sparkles className="h-6 w-6 text-primary" />
            ) : access.reason === 'canceled' ? (
              <AlertCircle className="h-6 w-6 text-red-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-yellow-500" />
            )}
          </div>
          <CardTitle>{getTitle()}</CardTitle>
          <CardDescription className="mt-2">{getMessage()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {access.reason === 'no_subscription' && (
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">${monthlyFee}/month</p>
              {trialDays > 0 && (
                <p className="text-sm text-muted-foreground">
                  {trialDays}-day free trial included
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {showStartButton && (
              <Button
                onClick={handleStartSubscription}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {access.reason === 'canceled' ? 'Start New Subscription' : 'Start Subscription'}
              </Button>
            )}

            {showPortalButton && (
              <Button
                onClick={handleOpenPortal}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Update Payment Method
              </Button>
            )}

            {access.reason === 'canceled' && (
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                asChild
              >
                <Link href={`/${businessSlug}/dashboard/settings/subscription`}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Billing History
                </Link>
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment powered by Stripe
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
