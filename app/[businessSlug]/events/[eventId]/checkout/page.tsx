'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Minus, Plus, Info } from 'lucide-react'
import Image from 'next/image'
import { calculateStripeFee, calculateCustomerPaysAmount, calculateBusinessPaysAmount } from '@/lib/utils/stripe-fees'

interface Event {
  id: string
  business_id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  ticket_price: number
  available_tickets: number
  total_tickets: number
  status: string
}

interface Business {
  id: string
  name: string
  slug: string
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  stripe_fee_payer: 'customer' | 'business'
  platform_fee_payer: 'customer' | 'business'
  tax_percentage: number
}

interface TicketType {
  id: string
  name: string
  description: string | null
  price: number
  available_quantity: number
  is_active: boolean
}

interface TicketSelection {
  ticketTypeId: string
  quantity: number
}

function PaymentForm({
  clientSecret,
  event,
  business,
  total,
  customerInfo,
}: {
  clientSecret: string
  event: Event
  business: Business
  total: number
  customerInfo: { name: string; email: string; phone: string }
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/${business.slug}/events/${event.id}/success`,
          payment_method_data: {
            billing_details: {
              name: customerInfo.name,
              email: customerInfo.email,
              phone: customerInfo.phone || undefined,
            },
          },
        },
      })

      if (submitError) {
        setError(submitError.message || 'Payment failed')
        setIsProcessing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <Label>Payment Details</Label>
        <div className="p-4 border rounded-md bg-card">
          <PaymentElement
            options={{
              layout: {
                type: 'tabs',
                defaultCollapsed: false,
              },
              wallets: {
                applePay: 'auto',
                googlePay: 'never',
              },
            }}
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium">Total</span>
          <span className="text-2xl font-bold">${total.toFixed(2)}</span>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            `Pay $${total.toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  )
}

export default function CheckoutPage({ params }: { params: Promise<{ businessSlug: string; eventId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [platformSettings, setPlatformSettings] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For legacy single-price tickets
  const [quantity, setQuantity] = useState(1)

  // For multiple ticket types
  const [ticketSelections, setTicketSelections] = useState<Record<string, number>>({})

  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const [fieldErrors, setFieldErrors] = useState({
    name: false,
    email: false,
  })

  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [promoCodeData, setPromoCodeData] = useState<any>(null)
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null)
  const [isValidatingPromo, setIsValidatingPromo] = useState(false)

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<any>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [imageGlowColors, setImageGlowColors] = useState<string[]>([
    'rgba(255, 255, 255, 0.1)',
    'rgba(200, 200, 200, 0.1)',
    'rgba(150, 150, 150, 0.1)'
  ])

  const hasTicketTypes = ticketTypes.length > 0

  useEffect(() => {
    fetchEventDetails()
    fetchPlatformSettings()
  }, [])

  // Extract multiple dominant colors from image for multi-color glow effect
  useEffect(() => {
    if (!event?.image_url) return

    const img = document.createElement('img')
    img.crossOrigin = 'Anonymous'
    img.src = event.image_url

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const sampleSize = 60
        const colors: string[] = []

        // Sample from 4 different areas: center, top-left, top-right, bottom
        const samplePoints = [
          { x: img.width / 2, y: img.height / 2 },      // center
          { x: img.width / 4, y: img.height / 4 },      // top-left
          { x: (3 * img.width) / 4, y: img.height / 4 }, // top-right
          { x: img.width / 2, y: (3 * img.height) / 4 }  // bottom
        ]

        for (const point of samplePoints) {
          const imageData = ctx.getImageData(
            Math.max(0, point.x - sampleSize / 2),
            Math.max(0, point.y - sampleSize / 2),
            sampleSize,
            sampleSize
          )

          let r = 0, g = 0, b = 0
          const pixels = imageData.data.length / 4

          for (let i = 0; i < imageData.data.length; i += 4) {
            r += imageData.data[i]
            g += imageData.data[i + 1]
            b += imageData.data[i + 2]
          }

          r = Math.floor(r / pixels)
          g = Math.floor(g / pixels)
          b = Math.floor(b / pixels)

          colors.push(`rgba(${r}, ${g}, ${b}, 0.6)`)
        }

        setImageGlowColors(colors)
      } catch (error) {
        console.error('Error extracting image colors:', error)
      }
    }
  }, [event?.image_url])

  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`/api/public/${resolvedParams.businessSlug}/events/${resolvedParams.eventId}`)
      if (!response.ok) {
        throw new Error('Event not found')
      }
      const data = await response.json()
      setEvent(data.event)
      setBusiness(data.business)
      setTicketTypes(data.ticketTypes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPlatformSettings = async () => {
    try {
      const response = await fetch('/api/platform-settings')
      if (response.ok) {
        const data = await response.json()
        setPlatformSettings(data)
      }
    } catch (err) {
      console.error('Failed to fetch platform settings:', err)
    }
  }

  const updateTicketSelection = (ticketTypeId: string, delta: number) => {
    setTicketSelections(prev => {
      const current = prev[ticketTypeId] || 0
      const ticketType = ticketTypes.find(tt => tt.id === ticketTypeId)
      const maxQty = ticketType?.available_quantity || 0

      const newQty = Math.max(0, Math.min(maxQty, current + delta))

      if (newQty === 0) {
        const { [ticketTypeId]: _, ...rest } = prev
        return rest
      }

      return { ...prev, [ticketTypeId]: newQty }
    })
  }

  const setTicketQuantity = (ticketTypeId: string, quantity: number) => {
    const ticketType = ticketTypes.find(tt => tt.id === ticketTypeId)
    const maxQty = ticketType?.available_quantity || 0
    const newQty = Math.max(0, Math.min(maxQty, quantity))

    setTicketSelections(prev => {
      if (newQty === 0) {
        const { [ticketTypeId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [ticketTypeId]: newQty }
    })
  }

  const calculateTotal = () => {
    if (hasTicketTypes) {
      return Object.entries(ticketSelections).reduce((sum, [ticketTypeId, qty]) => {
        const ticketType = ticketTypes.find(tt => tt.id === ticketTypeId)
        return sum + (ticketType?.price || 0) * qty
      }, 0)
    } else {
      return (event?.ticket_price || 0) * quantity
    }
  }

  const getTotalTicketCount = () => {
    if (hasTicketTypes) {
      return Object.values(ticketSelections).reduce((sum, qty) => sum + qty, 0)
    }
    return quantity
  }

  const getDiscountAmount = () => {
    if (!promoCodeData) return 0

    const subtotal = calculateTotal()

    if (promoCodeData.discount_type === 'percentage') {
      return (subtotal * promoCodeData.discount_value) / 100
    } else {
      return Math.min(promoCodeData.discount_value, subtotal)
    }
  }

  const getPlatformFee = () => {
    if (!platformSettings || !business) return 0

    const subtotal = calculateTotal()
    const totalTickets = getTotalTicketCount()

    if (totalTickets === 0) return 0

    let fee = 0
    switch (platformSettings.platform_fee_type) {
      case 'flat':
        fee = platformSettings.flat_fee_amount
        break

      case 'percentage':
        fee = (subtotal * platformSettings.percentage_fee) / 100
        break

      case 'higher_of_both': {
        const flatFee = platformSettings.flat_fee_amount
        const percentageFee = (subtotal * platformSettings.percentage_fee) / 100
        fee = Math.max(flatFee, percentageFee)
        break
      }

      default:
        fee = 0
    }

    // Only return fee if customer pays platform fees
    return business.platform_fee_payer === 'customer' ? fee : 0
  }

  const getTax = () => {
    if (!business) return 0

    const subtotal = calculateTotal()
    const discount = getDiscountAmount()
    const taxableAmount = subtotal - discount

    return (taxableAmount * (business.tax_percentage || 0)) / 100
  }

  const getStripeFee = () => {
    if (!business) return 0

    // Only show Stripe fee if customer pays it
    if (business.stripe_fee_payer !== 'customer') return 0

    const subtotal = calculateTotal()
    const discount = getDiscountAmount()
    const tax = getTax()
    const platformFee = getPlatformFee()

    // Calculate Stripe fee on the amount customer will pay (including tax)
    return calculateStripeFee(subtotal - discount + tax + platformFee)
  }

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoCodeError('Please enter a promo code')
      return
    }

    setIsValidatingPromo(true)
    setPromoCodeError(null)

    try {
      // Get the first selected ticket type ID for validation
      const ticketTypeId = hasTicketTypes
        ? Object.keys(ticketSelections)[0]
        : undefined

      const response = await fetch(`/api/events/${resolvedParams.eventId}/promo-codes/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode,
          ticketTypeId,
        }),
      })

      const data = await response.json()

      if (data.valid && data.promoCode) {
        setPromoCodeData(data.promoCode)
        setPromoCodeError(null)
      } else {
        setPromoCodeError(data.message || 'Invalid promo code')
        setPromoCodeData(null)
      }
    } catch (error) {
      setPromoCodeError('Failed to validate promo code')
      setPromoCodeData(null)
    } finally {
      setIsValidatingPromo(false)
    }
  }

  const handleRemovePromoCode = () => {
    setPromoCode('')
    setPromoCodeData(null)
    setPromoCodeError(null)
  }

  const handleContinueToPayment = async () => {
    // Validate required fields
    const errors = {
      name: !customerInfo.name.trim(),
      email: !customerInfo.email.trim(),
    }

    setFieldErrors(errors)

    if (errors.name || errors.email) {
      return
    }

    const totalTickets = getTotalTicketCount()
    if (totalTickets === 0) {
      setError('Please select at least one ticket')
      return
    }

    if (!business?.stripe_onboarding_complete) {
      setError('This business has not completed payment setup')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const requestBody = hasTicketTypes
        ? {
            eventId: resolvedParams.eventId,
            ticketSelections: Object.entries(ticketSelections).map(([ticketTypeId, quantity]) => ({
              ticketTypeId,
              quantity,
            })),
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone || null,
            promoCodeId: promoCodeData?.id || null,
          }
        : {
            eventId: resolvedParams.eventId,
            quantity,
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone || null,
            promoCodeId: promoCodeData?.id || null,
          }

      const response = await fetch(`/api/checkout/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initialize payment')
      }

      const { clientSecret, publishableKey } = await response.json()
      setClientSecret(clientSecret)
      setStripePromise(loadStripe(publishableKey))
      setShowPaymentForm(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !showPaymentForm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event || !business) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>The event you're looking for doesn't exist</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const subtotal = calculateTotal()
  const discount = getDiscountAmount()
  const tax = getTax()
  const platformFee = getPlatformFee()
  const stripeFee = getStripeFee()
  const total = subtotal - discount + tax + platformFee + stripeFee
  const totalTickets = getTotalTicketCount()

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret!,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: 'oklch(0.85 0 0)',
        colorBackground: 'oklch(0.12 0 0)',
        colorText: 'oklch(0.98 0 0)',
        colorDanger: 'oklch(0.71 0.2 22)',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '0.625rem',
      },
      rules: {
        '.Input': {
          backgroundColor: 'oklch(0.12 0 0)',
          border: '1px solid oklch(0.25 0 0)',
          padding: '12px',
          fontSize: '14px',
        },
        '.Input:focus': {
          border: '1px solid oklch(0.85 0 0)',
          boxShadow: '0 0 0 1px oklch(0.85 0 0)',
        },
        '.Label': {
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '8px',
        },
        '.Tab': {
          backgroundColor: 'oklch(0.12 0 0)',
          border: '1px solid oklch(0.25 0 0)',
          borderRadius: '0.625rem',
        },
        '.Tab:hover': {
          backgroundColor: 'oklch(0.15 0 0)',
        },
        '.Tab--selected': {
          backgroundColor: 'oklch(0.12 0 0)',
          border: '1px solid oklch(0.85 0 0)',
        },
      },
    },
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          ← Back
        </Button>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Event Details */}
          <div className="relative md:sticky md:top-4 md:self-start">
            {event.image_url && (
              <>
                <style jsx>{`
                  @keyframes glow-pulse {
                    0%, 100% {
                      opacity: 0.6;
                      transform: scale(1);
                    }
                    50% {
                      opacity: 0.9;
                      transform: scale(1.05);
                    }
                  }
                  @keyframes glow-shift-1 {
                    0%, 100% {
                      transform: translate(-50%, 0) rotate(0deg);
                    }
                    33% {
                      transform: translate(-45%, 5%) rotate(5deg);
                    }
                    66% {
                      transform: translate(-55%, -5%) rotate(-5deg);
                    }
                  }
                  @keyframes glow-shift-2 {
                    0%, 100% {
                      transform: translate(-50%, 0) rotate(0deg) scale(1);
                    }
                    50% {
                      transform: translate(-50%, 3%) rotate(10deg) scale(1.1);
                    }
                  }
                  @keyframes glow-shift-3 {
                    0%, 100% {
                      transform: translate(-50%, 0) scale(1);
                    }
                    25% {
                      transform: translate(-48%, 2%) scale(1.05);
                    }
                    75% {
                      transform: translate(-52%, -2%) scale(0.95);
                    }
                  }
                  .glow-layer-1 {
                    animation: glow-pulse 4s ease-in-out infinite, glow-shift-1 8s ease-in-out infinite;
                  }
                  .glow-layer-2 {
                    animation: glow-pulse 3s ease-in-out infinite 0.5s, glow-shift-2 6s ease-in-out infinite;
                  }
                  .glow-layer-3 {
                    animation: glow-pulse 5s ease-in-out infinite 1s, glow-shift-3 10s ease-in-out infinite;
                  }
                `}</style>
                <div
                  className="glow-layer-1 absolute top-0 left-1/2 w-[200%] h-[500px] blur-[100px] pointer-events-none z-0"
                  style={{
                    background: `
                      radial-gradient(ellipse 80% 70% at 30% 30%, ${imageGlowColors[1]}, transparent 60%)
                    `
                  }}
                />
                <div
                  className="glow-layer-2 absolute top-0 left-1/2 w-[200%] h-[500px] blur-[120px] pointer-events-none z-0"
                  style={{
                    background: `
                      radial-gradient(ellipse 80% 70% at 70% 30%, ${imageGlowColors[2]}, transparent 60%),
                      radial-gradient(ellipse 100% 80% at 50% 60%, ${imageGlowColors[3] || imageGlowColors[0]}, transparent 70%)
                    `
                  }}
                />
                <div
                  className="glow-layer-3 absolute top-0 left-1/2 w-[200%] h-[500px] blur-[140px] pointer-events-none z-0"
                  style={{
                    background: `
                      radial-gradient(ellipse at center, ${imageGlowColors[0]}, transparent 50%)
                    `
                  }}
                />
              </>
            )}
            <Card className="overflow-hidden p-0 relative z-10 bg-card/90 backdrop-blur-sm">
              {event.image_url && (
                <div className="relative w-full aspect-square">
                  <Image
                    src={event.image_url}
                    alt={event.title}
                    fill
                    className="object-cover rounded-t-lg"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div>
                  <h2 className="text-2xl font-bold">{event.title}</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Hosted by {business.name}
                  </p>
                </div>

                {event.description && (
                  <p className="text-sm">{event.description}</p>
                )}

                <div className="space-y-2 text-sm pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Date:</span>
                    <span className="text-muted-foreground">
                      {new Date(event.event_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {event.event_time && ` at ${event.event_time}`}
                    </span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Location:</span>
                      <span className="text-muted-foreground">{event.location}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Checkout Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{showPaymentForm ? 'Payment' : 'Purchase Tickets'}</CardTitle>
                <CardDescription>
                  {showPaymentForm ? 'Complete your payment' : 'Select your tickets and enter your information'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!showPaymentForm ? (
                  <>
                    {error && (
                      <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={customerInfo.name}
                        onChange={(e) => {
                          setCustomerInfo({ ...customerInfo, name: e.target.value })
                          setFieldErrors({ ...fieldErrors, name: false })
                        }}
                        placeholder="John Doe"
                        required
                        className={fieldErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => {
                          setCustomerInfo({ ...customerInfo, email: e.target.value })
                          setFieldErrors({ ...fieldErrors, email: false })
                        }}
                        placeholder="john@example.com"
                        required
                        className={fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    {hasTicketTypes ? (
                      <div className="space-y-4">
                        <Label>Select Tickets</Label>
                        {ticketTypes.map((ticketType) => (
                          <Card key={ticketType.id}>
                            <CardContent className="px-4 py-1.5">
                              <div className="space-y-2">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <h3 className="font-medium">{ticketType.name}</h3>
                                    <span className="font-bold">${ticketType.price.toFixed(2)}</span>
                                  </div>
                                  {ticketType.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {ticketType.description}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {ticketType.available_quantity} available
                                  </p>
                                </div>

                                <div className="flex items-center gap-4">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateTicketSelection(ticketType.id, -1)}
                                    disabled={!ticketSelections[ticketType.id]}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={ticketType.available_quantity}
                                    value={ticketSelections[ticketType.id] || 0}
                                    onChange={(e) => setTicketQuantity(ticketType.id, parseInt(e.target.value) || 0)}
                                    className="w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateTicketSelection(ticketType.id, 1)}
                                    disabled={(ticketSelections[ticketType.id] || 0) >= ticketType.available_quantity}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Ticket Price</Label>
                          <span className="font-medium">${event.ticket_price ? event.ticket_price.toFixed(2) : '0.00'}</span>
                        </div>
                        <Label>Quantity</Label>
                        <div className="flex items-center gap-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity(Math.min(event.available_tickets, quantity + 1))}
                            disabled={quantity >= event.available_tickets}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Maximum {event.available_tickets} tickets available
                        </p>
                      </div>
                    )}

                    {/* Promo Code Section */}
                    <div className="space-y-2">
                      <Label htmlFor="promoCode">Promo Code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="promoCode"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="Enter promo code"
                          disabled={!!promoCodeData}
                          className="uppercase"
                        />
                        {!promoCodeData ? (
                          <Button
                            type="button"
                            onClick={handleApplyPromoCode}
                            disabled={isValidatingPromo || !promoCode.trim()}
                          >
                            {isValidatingPromo ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </>
                            ) : (
                              'Apply'
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleRemovePromoCode}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      {promoCodeError && (
                        <p className="text-xs text-destructive">{promoCodeError}</p>
                      )}
                      {promoCodeData && (
                        <p className="text-xs text-green-600">
                          Promo code applied: {promoCodeData.discount_type === 'percentage'
                            ? `${promoCodeData.discount_value}% off`
                            : `$${promoCodeData.discount_value.toFixed(2)} off`}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      {totalTickets > 0 && (discount > 0 || tax > 0 || platformFee > 0 || stripeFee > 0) && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Subtotal</span>
                          <span className="text-sm text-muted-foreground">${subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {totalTickets > 0 && discount > 0 && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-green-600">Discount</span>
                          <span className="text-sm text-green-600">-${discount.toFixed(2)}</span>
                        </div>
                      )}
                      {totalTickets > 0 && tax > 0 && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Tax ({business?.tax_percentage || 0}%)</span>
                          <span className="text-sm text-muted-foreground">${tax.toFixed(2)}</span>
                        </div>
                      )}
                      {totalTickets > 0 && (platformFee > 0 || stripeFee > 0) && (
                        <div className="flex items-center justify-between mb-2 group relative">
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">Processing Fees</span>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </div>
                          <span className="text-sm text-muted-foreground">${(platformFee + stripeFee).toFixed(2)}</span>

                          {/* Tooltip */}
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[250px]">
                              <p className="text-xs font-medium mb-2">Fee Breakdown</p>
                              {platformFee > 0 && (
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">Platform Fee:</span>
                                  <span className="font-medium">${platformFee.toFixed(2)}</span>
                                </div>
                              )}
                              {stripeFee > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Stripe Processing:</span>
                                  <span className="font-medium">${stripeFee.toFixed(2)}</span>
                                </div>
                              )}
                              {(business?.stripe_fee_payer === 'business' || business?.platform_fee_payer === 'business') && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                  {business.stripe_fee_payer === 'business' && business.platform_fee_payer === 'business' && 'All fees covered by ' + business.name}
                                  {business.stripe_fee_payer === 'business' && business.platform_fee_payer === 'customer' && 'Stripe fees covered by ' + business.name}
                                  {business.stripe_fee_payer === 'customer' && business.platform_fee_payer === 'business' && 'Platform fees covered by ' + business.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-medium">Total ({totalTickets} {totalTickets === 1 ? 'ticket' : 'tickets'})</span>
                        <span className="text-2xl font-bold">${total.toFixed(2)}</span>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleContinueToPayment}
                        disabled={isLoading || !business.stripe_onboarding_complete || totalTickets === 0}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Continue to Payment'
                        )}
                      </Button>

                      {!business.stripe_onboarding_complete && (
                        <p className="text-xs text-destructive mt-2 text-center">
                          Payment processing is not yet available for this event
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {clientSecret && stripePromise && (
                      <Elements stripe={stripePromise} options={elementsOptions}>
                        <PaymentForm
                          clientSecret={clientSecret}
                          event={event}
                          business={business}
                          total={total}
                          customerInfo={customerInfo}
                        />
                      </Elements>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
