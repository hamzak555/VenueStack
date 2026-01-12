'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  AlertCircle,
  RefreshCw,
  FileText,
  Calendar,
  BarChart3,
  Users,
  Bell,
  Zap,
  Check,
  Lock,
  Shield,
  KeyRound,
  Armchair,
  Ticket
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubscriptionAccess } from '@/lib/subscription/check-access'

interface SubscriptionRequiredViewProps {
  businessSlug: string
  businessId: string
  access: SubscriptionAccess
  monthlyFee?: number
  trialDays?: number
  themeColor?: string
}

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export function SubscriptionRequiredView({
  businessSlug,
  businessId,
  access,
  monthlyFee = 49,
  trialDays = 14,
  themeColor = '#6366f1',
}: SubscriptionRequiredViewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Convert theme color to RGB for use with opacity
  const rgb = hexToRgb(themeColor) || { r: 99, g: 102, b: 241 } // fallback to indigo
  const themeRgb = `${rgb.r}, ${rgb.g}, ${rgb.b}`

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

  const showStartButton = access.reason === 'no_subscription' || access.reason === 'canceled'
  const showPortalButton = access.reason === 'past_due' || access.reason === 'unpaid' || access.reason === 'incomplete'

  const features = [
    { icon: Calendar, label: 'Event Management' },
    { icon: Armchair, label: 'Table Service' },
    { icon: Ticket, label: 'Tickets' },
    { icon: BarChart3, label: 'Analytics' },
    { icon: Users, label: 'CRM' },
    { icon: Bell, label: 'Notifications' },
  ]

  const isCanceled = access.reason === 'canceled'
  const isPastDue = access.reason === 'past_due' || access.reason === 'unpaid'

  return (
    <div className="flex items-center justify-center h-full min-h-[calc(100vh-8rem)] p-4">
      <div className="max-w-lg w-full">
        {/* Main Card */}
        <div className="relative">
          <div className="bg-background rounded-2xl border shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div
              className={`relative px-6 pt-8 pb-6 ${
                isPastDue
                  ? 'bg-gradient-to-br from-amber-500/10 via-orange-600/5 to-transparent'
                  : ''
              }`}
              style={!isPastDue ? {
                background: `linear-gradient(to bottom right, rgba(${themeRgb}, 0.1), rgba(${themeRgb}, 0.05), transparent)`
              } : undefined}
            >
              {/* Decorative elements */}
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-bl-full"
                style={{ background: `linear-gradient(to bottom left, rgba(${themeRgb}, 0.1), transparent)` }}
              />
              <div
                className="absolute bottom-0 left-0 w-24 h-24 rounded-tr-full"
                style={{ background: `linear-gradient(to top right, rgba(${themeRgb}, 0.1), transparent)` }}
              />
              {/* Bottom fade gradient */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />

              <div className="relative text-center">
                {/* Icon */}
                <div
                  className={`mx-auto mb-3 h-10 w-10 rounded-xl flex items-center justify-center ${
                    isPastDue
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : ''
                  }`}
                  style={!isPastDue ? {
                    backgroundColor: `rgba(${themeRgb}, 0.15)`,
                    color: themeColor
                  } : undefined}
                >
                  {isCanceled ? (
                    <Lock className="h-5 w-5" />
                  ) : isPastDue ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <KeyRound className="h-5 w-5" />
                  )}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold tracking-tight">
                  {isCanceled ? 'Subscription Ended' : isPastDue ? 'Payment Required' : 'Unlock Your Dashboard'}
                </h2>

                {/* Subtitle */}
                <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
                  {isCanceled
                    ? 'Your subscription has ended. Resubscribe to regain access to all features.'
                    : isPastDue
                    ? 'Please update your payment method to continue using the dashboard.'
                    : 'Get access to powerful tools to manage your venue and grow your business.'}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-8">
              {/* Pricing - only show for new subscriptions */}
              {access.reason === 'no_subscription' && (
                <div className="relative -mt-4 mb-6">
                  <div
                    className="rounded-xl p-[1px]"
                    style={{ background: `linear-gradient(to right, ${themeColor}, ${themeColor})` }}
                  >
                    <div className="bg-background rounded-xl p-4 text-center">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-foreground">
                          ${monthlyFee}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      {trialDays > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium">
                          <Zap className="h-3.5 w-3.5" />
                          {trialDays}-day free trial
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Features Grid - only show for new subscriptions */}
              {access.reason === 'no_subscription' && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {features.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div
                        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: `linear-gradient(to bottom right, rgba(${themeRgb}, 0.2), rgba(${themeRgb}, 0.2))`
                        }}
                      >
                        <feature.icon className="h-4 w-4" style={{ color: themeColor }} />
                      </div>
                      <p className="font-medium text-sm">{feature.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mb-4 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* CTA Buttons */}
              <div className="space-y-3">
                {showStartButton && (
                  <button
                    onClick={handleStartSubscription}
                    disabled={isLoading}
                    className="w-full h-12 text-base font-semibold rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
                  >
                    {isLoading && <RefreshCw className="h-5 w-5 animate-spin mr-2" />}
                    {access.reason === 'canceled' ? 'Reactivate Subscription' : 'Start Free Trial'}
                  </button>
                )}

                {showPortalButton && (
                  <Button
                    onClick={handleOpenPortal}
                    disabled={isLoading}
                    size="lg"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-5 w-5 mr-2" />
                    )}
                    Update Payment Method
                  </Button>
                )}

                {access.reason === 'canceled' && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full h-11"
                    asChild
                  >
                    <Link href={`/${businessSlug}/dashboard/settings/subscription`}>
                      <FileText className="h-4 w-4 mr-2" />
                      View Billing History
                    </Link>
                  </Button>
                )}
              </div>

              {/* Trust indicators */}
              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Secure checkout</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
