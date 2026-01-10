'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Minus, Plus, Ticket, Armchair, Map } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatedImageGlow } from '@/components/business/animated-image-glow'
import { EventMap } from '@/components/business/event-map'
import { TermsModal } from '@/components/business/terms-modal'
import { Checkbox } from '@/components/ui/checkbox'
import { calculateStripeFee, calculateCustomerPaysAmount, calculateBusinessPaysAmount } from '@/lib/utils/stripe-fees'
import { parseLocalDate } from '@/lib/utils'
import { InteractiveTableMap } from '@/components/business/interactive-table-map'
import { TableServiceConfig } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Helper function to format time to 12-hour format
function formatTimeTo12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`
}

interface Event {
  id: string
  business_id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location: string | null
  location_latitude: number | null
  location_longitude: number | null
  image_url: string | null
  ticket_price: number
  available_tickets: number
  total_tickets: number
  status: string
  table_service_enabled?: boolean
}

interface TableSection {
  id: string
  section_id: string
  section_name: string
  price: number
  minimum_spend?: number
  total_tables: number
  available_tables: number
  capacity?: number
  max_per_customer?: number
  is_enabled: boolean
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
  terms_and_conditions: string | null
}

interface TicketType {
  id: string
  name: string
  description: string | null
  price: number
  available_quantity: number
  max_per_customer: number | null
  is_active: boolean
}

interface TicketSelection {
  ticketTypeId: string
  quantity: number
}

interface Artist {
  id: string
  name: string
  photo_url: string | null
}

function PaymentForm({
  clientSecret,
  event,
  business,
  total,
  customerInfo,
  mode = 'tickets',
}: {
  clientSecret: string
  event: Event
  business: Business
  total: number
  customerInfo: { name: string; email: string; phone: string }
  mode?: 'tickets' | 'tables'
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

    const successUrl = mode === 'tables'
      ? `${window.location.origin}/${business.slug}/events/${event.id}/book-table/success`
      : `${window.location.origin}/${business.slug}/events/${event.id}/success`

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: successUrl,
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
    </form>
  )
}

export default function CheckoutPage({ params }: { params: Promise<{ businessSlug: string; eventId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Checkout mode: 'tickets' or 'tables'
  const initialMode = searchParams.get('mode') === 'tables' ? 'tables' : 'tickets'
  const [checkoutMode, setCheckoutMode] = useState<'tickets' | 'tables'>(initialMode)

  // Tracking ref for attribution
  const trackingRef = searchParams.get('ref') || null

  const [event, setEvent] = useState<Event | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [tableSections, setTableSections] = useState<TableSection[]>([])
  const [platformSettings, setPlatformSettings] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Table booking state
  const [tableSelections, setTableSelections] = useState<Record<string, number>>({})
  const [venueLayoutUrl, setVenueLayoutUrl] = useState<string | null>(null)
  const [tableServiceConfig, setTableServiceConfig] = useState<TableServiceConfig | null>(null)
  const [tableMapModalOpen, setTableMapModalOpen] = useState(false)
  const [bookedTables, setBookedTables] = useState<{ section_id: string; table_number: string }[]>([])

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
  const [isInitializingPayment, setIsInitializingPayment] = useState(false)
  const [isCompletingFreeOrder, setIsCompletingFreeOrder] = useState(false)
  const [isCompletingFreeTableBooking, setIsCompletingFreeTableBooking] = useState(false)

  // Terms and conditions state
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)

  const hasTicketTypes = ticketTypes.length > 0

  useEffect(() => {
    fetchEventDetails()
  }, [])

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
      setArtists(data.artists || [])
      setTableSections(data.tableSections || [])
      setPlatformSettings(data.platformSettings || null)
      setBookedTables(data.bookedTables || [])

      // Fetch venue layout URL and table service config if table service is enabled
      if (data.business?.id && data.tableSections?.length > 0) {
        const tableServiceResponse = await fetch(`/api/businesses/${data.business.id}/table-service`)
        if (tableServiceResponse.ok) {
          const tableServiceData = await tableServiceResponse.json()
          setVenueLayoutUrl(tableServiceData.venue_layout_url || null)
          setTableServiceConfig(tableServiceData.table_service_config || null)
        }
      }

      // If mode=tables but no table sections available, switch to tickets
      if (initialMode === 'tables' && (!data.tableSections || data.tableSections.length === 0)) {
        setCheckoutMode('tickets')
      }
      // If mode=tickets but no tickets available, switch to tables
      if (initialMode === 'tickets' && (!data.ticketTypes || data.ticketTypes.length === 0) && data.event?.available_tickets === 0 && data.tableSections?.length > 0) {
        setCheckoutMode('tables')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setIsLoading(false)
    }
  }

  const updateTicketSelection = (ticketTypeId: string, delta: number) => {
    setTicketSelections(prev => {
      const current = prev[ticketTypeId] || 0
      const ticketType = ticketTypes.find(tt => tt.id === ticketTypeId)
      const availableQty = ticketType?.available_quantity || 0
      const maxPerCustomer = ticketType?.max_per_customer

      // Use the lower of available quantity and max per customer limit
      const maxQty = maxPerCustomer ? Math.min(availableQty, maxPerCustomer) : availableQty

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
    const availableQty = ticketType?.available_quantity || 0
    const maxPerCustomer = ticketType?.max_per_customer

    // Use the lower of available quantity and max per customer limit
    const maxQty = maxPerCustomer ? Math.min(availableQty, maxPerCustomer) : availableQty
    const newQty = Math.max(0, Math.min(maxQty, quantity))

    setTicketSelections(prev => {
      if (newQty === 0) {
        const { [ticketTypeId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [ticketTypeId]: newQty }
    })
  }

  // Table selection functions
  const updateTableSelection = (sectionId: string, delta: number) => {
    setTableSelections(prev => {
      const section = tableSections.find(s => s.id === sectionId)
      if (!section) return prev

      const currentQty = prev[sectionId] || 0
      const maxQty = section.max_per_customer
        ? Math.min(section.available_tables, section.max_per_customer)
        : section.available_tables
      const newQty = Math.max(0, Math.min(maxQty, currentQty + delta))

      if (newQty === 0) {
        const { [sectionId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [sectionId]: newQty }
    })
  }

  const setTableQuantity = (sectionId: string, quantity: number) => {
    const section = tableSections.find(s => s.id === sectionId)
    if (!section) return

    const maxQty = section.max_per_customer
      ? Math.min(section.available_tables, section.max_per_customer)
      : section.available_tables
    const newQty = Math.max(0, Math.min(maxQty, quantity))

    setTableSelections(prev => {
      if (newQty === 0) {
        const { [sectionId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [sectionId]: newQty }
    })
  }

  const getTotalTables = () => {
    return Object.values(tableSelections).reduce((sum, qty) => sum + qty, 0)
  }

  const getTableSubtotal = () => {
    return Object.entries(tableSelections).reduce((total, [sectionId, qty]) => {
      const section = tableSections.find(s => s.id === sectionId)
      return total + (section?.price || 0) * qty
    }, 0)
  }

  const getTableTax = () => {
    if (!business) return 0
    const subtotal = getTableSubtotal()
    return (subtotal * (business.tax_percentage || 0)) / 100
  }

  const getTablePlatformFee = () => {
    if (!platformSettings || !business) return 0
    const subtotal = getTableSubtotal()
    if (subtotal <= 0) return 0

    const tax = getTableTax()
    const taxableAmount = subtotal + tax

    let fee = 0
    switch (platformSettings.platform_fee_type) {
      case 'flat':
        fee = platformSettings.flat_fee_amount
        break
      case 'percentage':
        fee = (taxableAmount * platformSettings.percentage_fee) / 100
        break
      case 'higher_of_both': {
        const flatFee = platformSettings.flat_fee_amount
        const percentageFee = (taxableAmount * platformSettings.percentage_fee) / 100
        fee = Math.max(flatFee, percentageFee)
        break
      }
      default:
        fee = 0
    }

    return business.platform_fee_payer === 'customer' ? fee : 0
  }

  const getTableStripeFee = () => {
    if (!business) return 0
    if (business.stripe_fee_payer !== 'customer') return 0

    const subtotal = getTableSubtotal()
    if (subtotal <= 0) return 0

    const tax = getTableTax()
    const platformFee = getTablePlatformFee()
    const baseAmount = subtotal + tax + platformFee

    if (baseAmount <= 0) return 0

    const finalWithStripeFee = (baseAmount + 0.30) / (1 - 0.029)
    return finalWithStripeFee - baseAmount
  }

  const getTableTotal = () => {
    return getTableSubtotal() + getTableTax() + getTablePlatformFee() + getTableStripeFee()
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
    const discount = getDiscountAmount()
    const tax = getTax()
    const totalTickets = getTotalTicketCount()

    if (totalTickets === 0) return 0

    // No fees for free tickets
    const netAmount = subtotal - discount
    if (netAmount <= 0) return 0

    // Platform fee should be calculated on (subtotal - discount + tax)
    const taxableAmount = subtotal - discount + tax

    let fee = 0
    switch (platformSettings.platform_fee_type) {
      case 'flat':
        fee = platformSettings.flat_fee_amount
        break

      case 'percentage':
        fee = (taxableAmount * platformSettings.percentage_fee) / 100
        break

      case 'higher_of_both': {
        const flatFee = platformSettings.flat_fee_amount
        const percentageFee = (taxableAmount * platformSettings.percentage_fee) / 100
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

    // No fees for free tickets
    const netAmount = subtotal - discount
    if (netAmount <= 0) return 0

    const tax = getTax()
    const platformFee = getPlatformFee()

    const baseAmount = subtotal - discount + tax + platformFee

    // Don't calculate Stripe fee if there's nothing to charge
    if (baseAmount <= 0) return 0

    // Use "gross up" formula to calculate the Stripe fee
    // Since Stripe calculates their fee on the final amount (including their fee),
    // we need to solve: final = base + (final * 0.029 + 0.30)
    // Which gives us: final = (base + 0.30) / (1 - 0.029)
    const finalWithStripeFee = (baseAmount + 0.30) / (1 - 0.029)
    return finalWithStripeFee - baseAmount
  }

  const isFreeOrder = () => {
    const subtotal = calculateTotal()
    const discount = getDiscountAmount()
    return subtotal - discount <= 0
  }

  const isTableFreeBooking = () => {
    return getTableSubtotal() === 0
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
        // Note: If payment is already initialized, user needs to restart checkout
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
    // Note: If payment is already initialized, user needs to restart checkout
  }

  const initializePayment = async () => {
    const totalTickets = getTotalTicketCount()
    if (totalTickets === 0 || !customerInfo.name.trim() || !customerInfo.email.trim()) {
      return
    }

    if (!business?.stripe_onboarding_complete) {
      return
    }

    setIsInitializingPayment(true)
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
            trackingRef,
          }
        : {
            eventId: resolvedParams.eventId,
            quantity,
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone || null,
            promoCodeId: promoCodeData?.id || null,
            trackingRef,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsInitializingPayment(false)
    }
  }

  const completeFreeOrder = async () => {
    const totalTickets = getTotalTicketCount()
    if (totalTickets === 0 || !customerInfo.name.trim() || !customerInfo.email.trim()) {
      return
    }

    setIsCompletingFreeOrder(true)
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
            trackingRef,
          }
        : {
            eventId: resolvedParams.eventId,
            quantity,
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone || null,
            promoCodeId: promoCodeData?.id || null,
            trackingRef,
          }

      const response = await fetch(`/api/checkout/complete-free-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to complete order')
      }

      const { orderId } = await response.json()

      // Redirect to success page
      router.push(`/${resolvedParams.businessSlug}/events/${resolvedParams.eventId}/success?orderId=${orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCompletingFreeOrder(false)
    }
  }

  const completeFreeTableBooking = async () => {
    if (getTotalTables() === 0 || !customerInfo.name.trim() || !customerInfo.email.trim()) {
      return
    }

    setIsCompletingFreeTableBooking(true)
    setError(null)

    try {
      const response = await fetch(`/api/checkout/complete-free-table-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: resolvedParams.eventId,
          tableSelections: tableSelections,
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone || null,
          trackingRef,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to complete reservation')
      }

      const { orderId } = await response.json()

      // Redirect to success page
      router.push(`/${resolvedParams.businessSlug}/events/${resolvedParams.eventId}/book-table/success?orderId=${orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCompletingFreeTableBooking(false)
    }
  }

  // Table payment initialization
  const initializeTablePayment = async () => {
    if (getTotalTables() === 0 || !customerInfo.name.trim() || !customerInfo.email.trim()) {
      return
    }

    if (!business?.stripe_onboarding_complete) {
      return
    }

    setIsInitializingPayment(true)
    setError(null)

    try {
      const response = await fetch(`/api/checkout/create-table-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: resolvedParams.eventId,
          tableSelections: tableSelections,
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone || null,
          trackingRef,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initialize payment')
      }

      const { clientSecret, publishableKey } = await response.json()
      setClientSecret(clientSecret)
      setStripePromise(loadStripe(publishableKey))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsInitializingPayment(false)
    }
  }

  // Handle mode switch - reset selections when switching
  const handleModeSwitch = (mode: 'tickets' | 'tables') => {
    if (mode === checkoutMode) return
    // Reset payment state when switching modes
    setClientSecret(null)
    setStripePromise(null)
    setCheckoutMode(mode)
  }

  // Don't auto-initialize payment to avoid creating incomplete PaymentIntents
  // User will click "Continue to Payment" button instead

  if (isLoading) {
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

  // Ticket calculations
  const subtotal = calculateTotal()
  const discount = getDiscountAmount()
  const tax = getTax()
  const platformFee = getPlatformFee()
  const stripeFee = getStripeFee()
  const total = subtotal - discount + tax + platformFee + stripeFee
  const totalTickets = getTotalTicketCount()

  // Table calculations
  const tableSubtotal = getTableSubtotal()
  const tableTax = getTableTax()
  const tablePlatformFee = getTablePlatformFee()
  const tableStripeFee = getTableStripeFee()
  const tableTotal = getTableTotal()
  const totalTables = getTotalTables()

  // Determine which options are available
  const hasTickets = hasTicketTypes || (event?.available_tickets || 0) > 0
  const hasTables = tableSections.length > 0
  const showToggle = hasTickets && hasTables

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
    <div className="min-h-screen bg-background p-4 md:p-8 relative">
      {/* Animated Background Glow from Event Image */}
      <AnimatedImageGlow imageUrl={event.image_url} />

      <div className="max-w-4xl mx-auto relative z-10">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${resolvedParams.businessSlug}`)}
          className="mb-6"
        >
          ← Back
        </Button>

        <div className="grid gap-8 md:grid-cols-2 items-start">
          {/* Event Details */}
          <div className="relative md:sticky md:top-4">
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
              <CardContent className="space-y-4 py-6">
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
                    <span className="font-medium">Date & Time:</span>
                    <span className="text-muted-foreground">
                      {parseLocalDate(event.event_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {event.event_time && ` at ${formatTimeTo12Hour(event.event_time)}`}
                    </span>
                  </div>

                  {event.location && !event.location_latitude && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Location:</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary hover:underline"
                      >
                        {event.location}
                      </a>
                    </div>
                  )}
                </div>

                {/* Artist Lineup */}
                {artists.length > 0 && (
                  <div className="pt-2 border-t">
                    <h3 className="text-sm font-medium mb-3">Artist Lineup</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {artists.map((artist) => (
                        <div key={artist.id} className="flex flex-col items-center gap-1">
                          <div className="relative h-24 w-24 rounded-full overflow-hidden bg-muted">
                            {artist.photo_url ? (
                              <Image
                                src={artist.photo_url}
                                alt={artist.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xl font-medium">
                                {artist.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-center">{artist.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event Map - only show if location coordinates are available */}
                {event.location && event.location_latitude && event.location_longitude && (
                  <div className="pt-2 border-t">
                    <EventMap
                      location={event.location}
                      latitude={event.location_latitude}
                      longitude={event.location_longitude}
                      eventTitle={event.title}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Checkout Form */}
          <div className="md:sticky md:top-4 md:self-start space-y-6">
            <Card>
              <CardHeader>
                {/* Show toggle when both tickets and tables are available */}
                {showToggle ? (
                  <div className="space-y-2">
                    <div className="flex rounded-lg bg-muted p-1">
                      <button
                        onClick={() => handleModeSwitch('tickets')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          checkoutMode === 'tickets'
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Ticket className="h-4 w-4" />
                        Buy Tickets
                      </button>
                      <button
                        onClick={() => handleModeSwitch('tables')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          checkoutMode === 'tables'
                            ? 'bg-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Armchair className="h-4 w-4" />
                        Book a Table
                      </button>
                    </div>
                    <CardDescription>
                      {checkoutMode === 'tickets'
                        ? 'Select your tickets and complete your purchase'
                        : 'Select a section and complete your reservation'}
                    </CardDescription>
                  </div>
                ) : hasTables && !hasTickets ? (
                  <>
                    <CardTitle>Book a Table</CardTitle>
                    <CardDescription>
                      Select a section and complete your reservation
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle>Purchase Tickets</CardTitle>
                    <CardDescription>
                      Select your tickets and complete your purchase
                    </CardDescription>
                  </>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
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
                    disabled={!!clientSecret}
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
                    disabled={!!clientSecret}
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
                    disabled={!!clientSecret}
                  />
                </div>

                {/* Ticket Selection - Show when in tickets mode */}
                {checkoutMode === 'tickets' && (
                  <>
                    {hasTicketTypes ? (
                      <div className="space-y-4">
                        <Label>Select Tickets</Label>
                        {ticketTypes.map((ticketType) => {
                          const maxQty = ticketType.max_per_customer
                            ? Math.min(ticketType.available_quantity, ticketType.max_per_customer)
                            : ticketType.available_quantity
                          return (
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
                                      {ticketType.max_per_customer && ` · Limit ${ticketType.max_per_customer} per customer`}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => updateTicketSelection(ticketType.id, -1)}
                                      disabled={!ticketSelections[ticketType.id] || !!clientSecret}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={maxQty}
                                      value={ticketSelections[ticketType.id] || 0}
                                      onChange={(e) => setTicketQuantity(ticketType.id, parseInt(e.target.value) || 0)}
                                      className="w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      disabled={!!clientSecret}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => updateTicketSelection(ticketType.id, 1)}
                                      disabled={(ticketSelections[ticketType.id] || 0) >= maxQty || !!clientSecret}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
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
                            disabled={quantity <= 1 || !!clientSecret}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity(Math.min(event.available_tickets, quantity + 1))}
                            disabled={quantity >= event.available_tickets || !!clientSecret}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Maximum {event.available_tickets} tickets available
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Table Selection - Show when in tables mode */}
                {checkoutMode === 'tables' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Select Section *</Label>
                      {(venueLayoutUrl || tableServiceConfig?.drawnLayout?.boundary) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTableMapModalOpen(true)}
                          className="text-xs h-7 px-2"
                        >
                          <Map className="h-3 w-3 mr-1" />
                          View Table Map
                        </Button>
                      )}
                    </div>
                    {tableSections.map((section) => {
                      const quantity = tableSelections[section.id] || 0
                      const maxQty = section.max_per_customer
                        ? Math.min(section.available_tables, section.max_per_customer)
                        : section.available_tables
                      const isSoldOut = section.available_tables === 0
                      return (
                        <Card key={section.id} className={isSoldOut ? 'opacity-50 bg-muted/50' : ''}>
                          <CardContent className="px-4 py-3">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium">{section.section_name}</h3>
                                    {isSoldOut && (
                                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                                        Sold Out
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {isSoldOut ? 'No tables available' : `${section.available_tables} available`}
                                    {section.capacity && ` · ${section.capacity} guests per table`}
                                    {!isSoldOut && section.max_per_customer && ` · Limit ${section.max_per_customer}`}
                                  </p>
                                  {Number(section.minimum_spend) > 0 && (
                                    <p className="text-xs text-amber-500 mt-1">
                                      Minimum spend: ${Number(section.minimum_spend).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                                {isSoldOut ? (
                                  <span className="text-sm font-medium text-muted-foreground">Unavailable</span>
                                ) : section.price > 0 ? (
                                  <span className="font-bold text-lg">${section.price.toFixed(2)}</span>
                                ) : (
                                  <span className="text-sm font-medium text-green-600">No Deposit Required</span>
                                )}
                              </div>
                              {!isSoldOut && (
                                <div className="flex items-center gap-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateTableSelection(section.id, -1)}
                                    disabled={quantity === 0 || !!clientSecret}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={maxQty}
                                    value={quantity}
                                    onChange={(e) => setTableQuantity(section.id, parseInt(e.target.value) || 0)}
                                    className="w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    disabled={!!clientSecret}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateTableSelection(section.id, 1)}
                                    disabled={quantity >= maxQty || !!clientSecret}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {/* Promo Code Section - Only for tickets */}
                {checkoutMode === 'tickets' && (
                <div className="space-y-2">
                  <Label htmlFor="promoCode">Promo Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="promoCode"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Enter promo code"
                      disabled={!!promoCodeData || !!clientSecret}
                      className="uppercase"
                    />
                    {!promoCodeData ? (
                      <Button
                        type="button"
                        onClick={handleApplyPromoCode}
                        disabled={isValidatingPromo || !promoCode.trim() || !!clientSecret}
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
                        disabled={!!clientSecret}
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
                )}

                {/* Order Summary - Tickets */}
                {checkoutMode === 'tickets' && (
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
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Processing Fees</span>
                        <span className="text-sm text-muted-foreground">${(platformFee + stripeFee).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">Total ({totalTickets} {totalTickets === 1 ? 'ticket' : 'tickets'})</span>
                      <span className="text-2xl font-bold">${total.toFixed(2)}</span>
                    </div>

                    {!business.stripe_onboarding_complete && (
                      <p className="text-xs text-destructive mt-2 text-center">
                        Payment processing is not yet available for this event
                      </p>
                    )}
                  </div>
                )}

                {/* Order Summary - Tables */}
                {checkoutMode === 'tables' && totalTables > 0 && (
                  <div className="pt-4 border-t space-y-2">
                    {!isTableFreeBooking() && Object.entries(tableSelections).map(([sectionId, qty]) => {
                      const section = tableSections.find(s => s.id === sectionId)
                      if (!section || qty === 0) return null
                      return (
                        <div key={sectionId} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {section.section_name} × {qty}
                          </span>
                          <span className="text-sm">${(section.price * qty).toFixed(2)}</span>
                        </div>
                      )
                    })}
                    {!isTableFreeBooking() && tableTax > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tax ({business?.tax_percentage || 0}%)</span>
                        <span className="text-sm">${tableTax.toFixed(2)}</span>
                      </div>
                    )}
                    {!isTableFreeBooking() && (tablePlatformFee > 0 || tableStripeFee > 0) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Processing Fees</span>
                        <span className="text-sm">${(tablePlatformFee + tableStripeFee).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-medium">Total ({totalTables} {totalTables === 1 ? 'table' : 'tables'})</span>
                      {isTableFreeBooking() ? (
                        <span className="text-lg font-bold text-green-600">No Deposit Required</span>
                      ) : (
                        <span className="text-2xl font-bold">${tableTotal.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Terms and Conditions Checkbox - Only show if business has terms */}
                {business.terms_and_conditions && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      disabled={!!clientSecret}
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      By completing this purchase you agree to our{' '}
                      <button
                        type="button"
                        onClick={() => setTermsModalOpen(true)}
                        className="text-primary hover:underline font-medium"
                      >
                        terms of service
                      </button>
                    </label>
                  </div>
                )}

                {/* Complete Free Order Button - Shows for $0 orders (tickets only) */}
                {checkoutMode === 'tickets' && !clientSecret && totalTickets > 0 && customerInfo.name.trim() && customerInfo.email.trim() && isFreeOrder() && (
                  <div className="pt-4 border-t">
                    <Button
                      type="button"
                      onClick={completeFreeOrder}
                      disabled={isCompletingFreeOrder || !!(business.terms_and_conditions && !termsAccepted)}
                      className="w-full"
                      size="lg"
                    >
                      {isCompletingFreeOrder ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Complete Order'
                      )}
                    </Button>
                  </div>
                )}

                {/* Continue to Payment Button - Tickets */}
                {checkoutMode === 'tickets' && !clientSecret && totalTickets > 0 && customerInfo.name.trim() && customerInfo.email.trim() && business.stripe_onboarding_complete && !isFreeOrder() && (
                  <div className="pt-4 border-t">
                    <Button
                      type="button"
                      onClick={initializePayment}
                      disabled={isInitializingPayment || !!(business.terms_and_conditions && !termsAccepted)}
                      className="w-full"
                      size="lg"
                    >
                      {isInitializingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading Payment...
                        </>
                      ) : (
                        'Continue to Payment'
                      )}
                    </Button>
                  </div>
                )}

                {/* Complete Free Table Reservation Button - Shows for $0 table bookings */}
                {checkoutMode === 'tables' && !clientSecret && totalTables > 0 && customerInfo.name.trim() && customerInfo.email.trim() && isTableFreeBooking() && (
                  <div className="pt-4 border-t">
                    <Button
                      type="button"
                      onClick={completeFreeTableBooking}
                      disabled={isCompletingFreeTableBooking || !!(business.terms_and_conditions && !termsAccepted)}
                      className="w-full"
                      size="lg"
                    >
                      {isCompletingFreeTableBooking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Complete Reservation'
                      )}
                    </Button>
                  </div>
                )}

                {/* Continue to Payment Button - Tables (only for paid bookings) */}
                {checkoutMode === 'tables' && !clientSecret && totalTables > 0 && customerInfo.name.trim() && customerInfo.email.trim() && business.stripe_onboarding_complete && !isTableFreeBooking() && (
                  <div className="pt-4 border-t">
                    <Button
                      type="button"
                      onClick={initializeTablePayment}
                      disabled={isInitializingPayment || !!(business.terms_and_conditions && !termsAccepted)}
                      className="w-full"
                      size="lg"
                    >
                      {isInitializingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading Payment...
                        </>
                      ) : (
                        'Continue to Payment'
                      )}
                    </Button>
                  </div>
                )}

                {/* Payment Form - Shows when payment intent is ready */}
                {clientSecret && stripePromise && (
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Enter your payment details below</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setClientSecret(null)
                          setStripePromise(null)
                        }}
                      >
                        Edit Order
                      </Button>
                    </div>
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <PaymentForm
                        clientSecret={clientSecret}
                        event={event}
                        business={business}
                        total={checkoutMode === 'tickets' ? total : tableTotal}
                        customerInfo={customerInfo}
                        mode={checkoutMode}
                      />
                    </Elements>
                  </div>
                )}

                {/* Loading state while initializing payment */}
                {isInitializingPayment && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Loading payment...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Powered by</span>
            <Link
              href="https://venuestack.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Image
                src="/venuestack-icon.svg"
                alt="VenueStack"
                width={18}
                height={18}
                className="invert dark:invert-0"
              />
              <span className="font-medium">VenueStack.io</span>
            </Link>
          </div>
        </footer>
      </div>

      {/* Terms Modal */}
      {business.terms_and_conditions && (
        <TermsModal
          isOpen={termsModalOpen}
          onClose={() => setTermsModalOpen(false)}
          businessName={business.name}
          termsAndConditions={business.terms_and_conditions}
        />
      )}

      {/* Table Map Modal */}
      <Dialog open={tableMapModalOpen} onOpenChange={setTableMapModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Table Layout</DialogTitle>
          </DialogHeader>
          {(venueLayoutUrl || tableServiceConfig?.drawnLayout?.boundary) && tableServiceConfig ? (
            <InteractiveTableMap
              venueLayoutUrl={venueLayoutUrl}
              tableServiceConfig={tableServiceConfig}
              tableSections={tableSections}
              bookedTables={bookedTables}
            />
          ) : venueLayoutUrl ? (
            <div className="relative w-full">
              <Image
                src={venueLayoutUrl}
                alt="Venue table layout"
                width={800}
                height={600}
                className="w-full h-auto object-contain rounded-lg"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
