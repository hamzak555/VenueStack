'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PlatformSettings {
  platform_fee_type: 'flat' | 'percentage' | 'higher_of_both'
  flat_fee_amount: number
  percentage_fee: number
}

interface StripeStatus {
  connected: boolean
  onboarding_complete: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  stripe_fee_payer?: 'customer' | 'business'
  platform_fee_payer?: 'customer' | 'business'
  tax_percentage?: number
  platform_settings?: PlatformSettings
}

export default function StripeSettingsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const businessSlug = params.businessSlug as string

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [status, setStatus] = useState<StripeStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isUpdatingFees, setIsUpdatingFees] = useState(false)
  const [isUpdatingTax, setIsUpdatingTax] = useState(false)
  const [taxInput, setTaxInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const success = searchParams.get('success')
  const refresh = searchParams.get('refresh')

  useEffect(() => {
    fetchBusinessId()
  }, [])

  const fetchBusinessId = async () => {
    try {
      const response = await fetch(`/api/businesses/slug/${businessSlug}`)
      if (!response.ok) {
        throw new Error('Failed to fetch business')
      }
      const data = await response.json()
      setBusinessId(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (businessId) {
      fetchStripeStatus()
    }
  }, [businessId])

  const fetchStripeStatus = async () => {
    if (!businessId) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/businesses/${businessId}/stripe/connect`)
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe status')
      }
      const data = await response.json()
      setStatus(data)
      setTaxInput(data.tax_percentage?.toString() || '0')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!businessId) return

    setIsConnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/businesses/${businessId}/stripe/connect`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to create Stripe Connect link')
      }

      const data = await response.json()
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsConnecting(false)
    }
  }

  const handleUpdateStripeFee = async (feePayer: 'customer' | 'business') => {
    if (!businessId) return

    setIsUpdatingFees(true)
    setError(null)

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_fee_payer: feePayer }),
      })

      if (!response.ok) {
        throw new Error('Failed to update Stripe fee settings')
      }

      setStatus(prev => prev ? { ...prev, stripe_fee_payer: feePayer } : null)
      toast.success('Fee settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to update fee settings')
    } finally {
      setIsUpdatingFees(false)
    }
  }

  const handleUpdatePlatformFee = async (feePayer: 'customer' | 'business') => {
    if (!businessId) return

    setIsUpdatingFees(true)
    setError(null)

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_fee_payer: feePayer }),
      })

      if (!response.ok) {
        throw new Error('Failed to update platform fee settings')
      }

      setStatus(prev => prev ? { ...prev, platform_fee_payer: feePayer } : null)
      toast.success('Fee settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to update fee settings')
    } finally {
      setIsUpdatingFees(false)
    }
  }

  const handleUpdateTax = async () => {
    if (!businessId) return

    setIsUpdatingTax(true)
    setError(null)

    const taxValue = parseFloat(taxInput)

    if (isNaN(taxValue) || taxValue < 0 || taxValue > 100) {
      setError('Tax percentage must be between 0 and 100')
      toast.error('Invalid tax percentage')
      setIsUpdatingTax(false)
      return
    }

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tax_percentage: taxValue }),
      })

      if (!response.ok) {
        throw new Error('Failed to update tax settings')
      }

      setStatus(prev => prev ? { ...prev, tax_percentage: taxValue } : null)
      toast.success('Tax settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Failed to update tax settings')
    } finally {
      setIsUpdatingTax(false)
    }
  }

  const getPlatformFeeDescription = () => {
    if (!status?.platform_settings) return 'Set by platform administrator'

    const settings = status.platform_settings

    switch (settings.platform_fee_type) {
      case 'flat':
        return `$${settings.flat_fee_amount.toFixed(2)} per order`
      case 'percentage':
        return `${settings.percentage_fee}% of ticket price`
      case 'higher_of_both':
        return `$${settings.flat_fee_amount.toFixed(2)} or ${settings.percentage_fee}% (whichever is higher)`
      default:
        return 'Set by platform administrator'
    }
  }

  const calculatePlatformFee = (ticketPrice: number) => {
    if (!status?.platform_settings) return 5.0 // Default fallback

    const settings = status.platform_settings
    const flatFee = settings.flat_fee_amount
    const percentageFee = (ticketPrice * settings.percentage_fee) / 100

    switch (settings.platform_fee_type) {
      case 'flat':
        return flatFee
      case 'percentage':
        return percentageFee
      case 'higher_of_both':
        return Math.max(flatFee, percentageFee)
      default:
        return 5.0
    }
  }

  const calculateStripeFee = (amount: number) => {
    return (amount * 0.029) + 0.30
  }

  const getExampleScenarios = () => {
    const ticketPrice = 100
    const platformFee = calculatePlatformFee(ticketPrice)

    // Scenario 1: Customer pays both
    const scenario1_subtotal = ticketPrice
    const scenario1_platform = platformFee
    const scenario1_stripe = calculateStripeFee(scenario1_subtotal + scenario1_platform)
    const scenario1_total = scenario1_subtotal + scenario1_platform + scenario1_stripe
    const scenario1_business = ticketPrice

    // Scenario 2: Business pays both
    const scenario2_total = ticketPrice
    const scenario2_stripe = calculateStripeFee(ticketPrice)
    const scenario2_business = ticketPrice - platformFee - scenario2_stripe

    // Scenario 3: Customer pays Stripe only
    const scenario3_subtotal = ticketPrice
    const scenario3_stripe = calculateStripeFee(ticketPrice)
    const scenario3_total = ticketPrice + scenario3_stripe
    const scenario3_business = ticketPrice - platformFee

    // Scenario 4: Customer pays platform only
    const scenario4_subtotal = ticketPrice
    const scenario4_platform = platformFee
    const scenario4_total = ticketPrice + platformFee
    const scenario4_stripe = calculateStripeFee(scenario4_total)
    const scenario4_business = ticketPrice - scenario4_stripe

    return {
      customerPaysBoth: {
        customerPays: scenario1_total,
        businessReceives: scenario1_business,
      },
      businessPaysBoth: {
        customerPays: scenario2_total,
        businessReceives: scenario2_business,
      },
      customerPaysStripe: {
        customerPays: scenario3_total,
        businessReceives: scenario3_business,
      },
      customerPaysPlatform: {
        customerPays: scenario4_total,
        businessReceives: scenario4_business,
      },
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
      </div>

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500 rounded-md">
          <p className="text-sm text-green-600 dark:text-green-400">
            Stripe account connected successfully! You can now accept payments.
          </p>
        </div>
      )}

      {refresh && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-md">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Stripe onboarding was not completed. Please try again.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>
            Connect your Stripe account to receive ticket sales payments directly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              {status?.connected ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">Account Status</p>
                <p className="text-sm text-muted-foreground">
                  {status?.connected ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>

            {status?.connected && (
              <>
                <div className="flex items-center gap-2">
                  {status.onboarding_complete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  <div>
                    <p className="font-medium">Onboarding Status</p>
                    <p className="text-sm text-muted-foreground">
                      {status.onboarding_complete ? 'Complete' : 'Incomplete'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {status.charges_enabled ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Accept Payments</p>
                    <p className="text-sm text-muted-foreground">
                      {status.charges_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {status.payouts_enabled ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Receive Payouts</p>
                    <p className="text-sm text-muted-foreground">
                      {status.payouts_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pt-4">
            {!status?.connected || !status?.onboarding_complete ? (
              <Button onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : status?.connected ? (
                  'Complete Stripe Onboarding'
                ) : (
                  'Connect Stripe Account'
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your Stripe account is connected and ready to accept payments.
                </p>
                <Button variant="outline" onClick={handleConnect}>
                  Update Stripe Settings
                </Button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">About Stripe Connect</h3>
            <p className="text-sm text-muted-foreground">
              Stripe Connect allows you to receive payments directly to your bank account with automatic payouts. Stripe handles all payment processing and security, and you can view detailed transaction history in your Stripe dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processing Fee Settings</CardTitle>
          <CardDescription>
            Configure who pays each type of processing fee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Two-column layout for fee settings */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Stripe Processing Fees */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Stripe Processing Fees</Label>
                <p className="text-sm text-muted-foreground mt-1">2.9% + $0.30 per transaction</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleUpdateStripeFee('customer')}
                  disabled={isUpdatingFees}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    status?.stripe_fee_payer === 'customer'
                      ? 'border-green-600 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-green-600/50'
                  } ${isUpdatingFees ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      status?.stripe_fee_payer === 'customer' ? 'border-green-600' : 'border-muted-foreground'
                    }`}>
                      {status?.stripe_fee_payer === 'customer' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Customer Pays</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Added to checkout total
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleUpdateStripeFee('business')}
                  disabled={isUpdatingFees}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    status?.stripe_fee_payer === 'business'
                      ? 'border-green-600 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-green-600/50'
                  } ${isUpdatingFees ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      status?.stripe_fee_payer === 'business' ? 'border-green-600' : 'border-muted-foreground'
                    }`}>
                      {status?.stripe_fee_payer === 'business' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Business Pays</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Deducted from revenue
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Platform Fees */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Platform Fees</Label>
                <p className="text-sm text-muted-foreground mt-1">{getPlatformFeeDescription()}</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleUpdatePlatformFee('customer')}
                  disabled={isUpdatingFees}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    status?.platform_fee_payer === 'customer'
                      ? 'border-green-600 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-green-600/50'
                  } ${isUpdatingFees ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      status?.platform_fee_payer === 'customer' ? 'border-green-600' : 'border-muted-foreground'
                    }`}>
                      {status?.platform_fee_payer === 'customer' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Customer Pays</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Added to checkout total
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleUpdatePlatformFee('business')}
                  disabled={isUpdatingFees}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    status?.platform_fee_payer === 'business'
                      ? 'border-green-600 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-green-600/50'
                  } ${isUpdatingFees ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      status?.platform_fee_payer === 'business' ? 'border-green-600' : 'border-muted-foreground'
                    }`}>
                      {status?.platform_fee_payer === 'business' && (
                        <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Business Pays</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Deducted from revenue
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-3">Example Scenarios (for $100 ticket)</h4>
            <div className="space-y-2 text-xs">
              {(() => {
                const scenarios = getExampleScenarios()
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer pays both:</span>
                      <span className="font-medium">
                        Customer pays ${scenarios.customerPaysBoth.customerPays.toFixed(2)} • You receive ${scenarios.customerPaysBoth.businessReceives.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Business pays both:</span>
                      <span className="font-medium">
                        Customer pays ${scenarios.businessPaysBoth.customerPays.toFixed(2)} • You receive ${scenarios.businessPaysBoth.businessReceives.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer pays Stripe only:</span>
                      <span className="font-medium">
                        Customer pays ${scenarios.customerPaysStripe.customerPays.toFixed(2)} • You receive ${scenarios.customerPaysStripe.businessReceives.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer pays platform only:</span>
                      <span className="font-medium">
                        Customer pays ${scenarios.customerPaysPlatform.customerPays.toFixed(2)} • You receive ${scenarios.customerPaysPlatform.businessReceives.toFixed(2)}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Settings</CardTitle>
          <CardDescription>
            Configure tax percentage to be applied to ticket sales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tax-percentage">Tax Percentage (%)</Label>
            <div className="flex gap-2">
              <input
                id="tax-percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxInput}
                onChange={(e) => setTaxInput(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="0.00"
                disabled={isUpdatingTax}
              />
              <Button
                onClick={handleUpdateTax}
                disabled={isUpdatingTax}
                className="whitespace-nowrap"
              >
                {isUpdatingTax ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Tax'
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Tax will be calculated on the ticket subtotal and added to the customer&apos;s total at checkout.
              Current tax rate: {status?.tax_percentage || 0}%
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">Tax Calculation Example</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket Subtotal:</span>
                <span className="font-medium">$100.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({status?.tax_percentage || 0}%):</span>
                <span className="font-medium">${((100 * (status?.tax_percentage || 0)) / 100).toFixed(2)}</span>
              </div>
              <div className="border-t pt-1 mt-1 flex justify-between">
                <span className="text-muted-foreground font-medium">Total with Tax:</span>
                <span className="font-medium">${(100 + (100 * (status?.tax_percentage || 0)) / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
