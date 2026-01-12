'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CreditCard, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SubscriptionData {
  status: string | null
  subscriptionId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEndDate: string | null
  createdAt: string | null
  access: {
    hasAccess: boolean
    status: string | null
    reason: string
    gracePeriodEnd?: string
    trialEndsAt?: string
    periodEndsAt?: string
    canManageSubscription: boolean
  }
  settings: {
    monthlyFee: number
    trialDays: number
  }
  invoices: Array<{
    id: string
    number: string | null
    amount: number
    status: string | null
    date: string
    pdfUrl: string | null
    hostedUrl: string | null
  }>
}

interface SubscriptionSettingsProps {
  businessId: string
  businessSlug: string
}

export function SubscriptionSettings({ businessId, businessSlug }: SubscriptionSettingsProps) {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)

  const fetchSubscription = async () => {
    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription`)
      if (!response.ok) {
        throw new Error('Failed to fetch subscription')
      }
      const subscriptionData = await response.json()
      setData(subscriptionData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch subscription')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscription()
  }, [businessId])

  const handleStartSubscription = async () => {
    setIsActionLoading(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start subscription')
      }

      const responseData = await response.json()
      if (responseData.checkoutUrl) {
        window.location.href = responseData.checkoutUrl
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start subscription')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setIsActionLoading(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      toast.success('Subscription will be canceled at the end of the current billing period')
      await fetchSubscription()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setIsActionLoading(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription/reactivate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reactivate subscription')
      }

      toast.success('Subscription reactivated successfully')
      await fetchSubscription()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reactivate subscription')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleOpenPortal = async () => {
    setIsActionLoading(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}/subscription/portal`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to open billing portal')
      }

      const responseData = await response.json()
      if (responseData.portalUrl) {
        window.location.href = responseData.portalUrl
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setIsActionLoading(false)
    }
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/50 hover:bg-green-500/20">Active</Badge>
      case 'trialing':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/20">Trial</Badge>
      case 'past_due':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/20">Past Due</Badge>
      case 'canceled':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20">Canceled</Badge>
      case 'incomplete':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/50 hover:bg-orange-500/20">Incomplete</Badge>
      case 'unpaid':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20">Unpaid</Badge>
      default:
        return <Badge variant="outline">No Subscription</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showStartButton = !data?.status || data.status === 'canceled'
  const showCancelButton = (data?.status === 'active' || data?.status === 'trialing') && !data?.cancelAtPeriodEnd
  const showReactivateButton = data?.cancelAtPeriodEnd && data?.currentPeriodEnd && new Date(data.currentPeriodEnd) > new Date()
  const showPortalButton = data?.status && data.status !== 'canceled'

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>Your current subscription plan and billing information</CardDescription>
            </div>
            {getStatusBadge(data?.status || null)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.status === 'trialing' && data.access.trialEndsAt && !data?.cancelAtPeriodEnd && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <p className="text-sm text-yellow-500">
                Your trial ends on <strong>{formatDate(data.access.trialEndsAt)}</strong>.
                Your card will be charged ${data.settings.monthlyFee}/month after the trial ends.
              </p>
            </div>
          )}

          {data?.cancelAtPeriodEnd && data.currentPeriodEnd && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <p className="text-sm">
                Your subscription will end on <strong>{formatDate(data.currentPeriodEnd)}</strong>.
                You can reactivate before this date to continue your subscription.
              </p>
            </div>
          )}

          <div className="flex gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="font-medium">${data?.settings.monthlyFee || 49}/month</p>
            </div>
            {data?.createdAt && (
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">{formatDate(data.createdAt)}</p>
              </div>
            )}
            {data?.status !== 'canceled' && (data?.currentPeriodEnd || data?.access.trialEndsAt) && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {data.cancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
                </p>
                <p className="font-medium">
                  {formatDate(data.status === 'trialing' ? (data.access.trialEndsAt ?? null) : data.currentPeriodEnd)}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-3">
            {showStartButton && (
              <Button
                onClick={handleStartSubscription}
                disabled={isActionLoading}
                className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50"
              >
                {isActionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Start Subscription
              </Button>
            )}

            {showReactivateButton && (
              <Button onClick={handleReactivateSubscription} disabled={isActionLoading}>
                {isActionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Reactivate Subscription
              </Button>
            )}

            {showPortalButton && (
              <Button variant="outline" onClick={handleOpenPortal} disabled={isActionLoading}>
                {isActionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Billing
              </Button>
            )}

            {showCancelButton && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30" disabled={isActionLoading}>
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your subscription will remain active until the end of your current billing period
                      ({formatDate(data?.currentPeriodEnd || null)}). After that, you will lose access to the dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30"
                    >
                      Confirm Cancellation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      {data?.invoices && data.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Your past invoices and payment history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{invoice.number || 'Invoice'}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(invoice.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium">${invoice.amount.toFixed(2)}</p>
                    <Badge
                      className={
                        invoice.status === 'paid'
                          ? 'bg-green-500/10 text-green-500 border-green-500/50'
                          : invoice.status === 'open'
                            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50'
                            : 'bg-muted text-muted-foreground'
                      }
                    >
                      {invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'Unknown'}
                    </Badge>
                    {invoice.hostedUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.hostedUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
