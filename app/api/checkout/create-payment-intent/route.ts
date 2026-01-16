import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessFeeSettings, calculatePlatformFee } from '@/lib/db/platform-settings'
import { getTicketType } from '@/lib/db/ticket-types'
import { getPromoCodeById } from '@/lib/db/promo-codes'
import { calculateStripeFee } from '@/lib/utils/stripe-fees'
import { rateLimit, rateLimitResponse, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP to prevent checkout spam
    const ip = getClientIP(request)
    const ipLimit = rateLimit(ip, 'ticket-checkout', RATE_LIMITS.tableBooking)
    if (!ipLimit.success) {
      return rateLimitResponse(ipLimit.resetIn)
    }

    const body = await request.json()
    const {
      eventId,
      quantity, // For legacy single-price tickets
      ticketSelections, // For multiple ticket types: [{ticketTypeId, quantity}]
      customerName,
      customerEmail,
      customerPhone,
      promoCodeId, // Promo code to apply
      trackingRef // Marketing attribution tracking
    } = body

    if (!eventId || !customerName || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, businesses(*)')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check if business has Stripe connected
    if (!event.businesses.stripe_account_id || !event.businesses.stripe_onboarding_complete) {
      return NextResponse.json(
        { error: 'Payment processing not available for this event' },
        { status: 400 }
      )
    }

    let totalAmount = 0
    let totalTickets = 0
    let description = ''
    let ticketTypeMetadata: any = {}

    // Handle multiple ticket types
    if (ticketSelections && Array.isArray(ticketSelections)) {
      for (const selection of ticketSelections) {
        const ticketType = await getTicketType(selection.ticketTypeId)

        if (!ticketType) {
          return NextResponse.json(
            { error: `Ticket type not found: ${selection.ticketTypeId}` },
            { status: 404 }
          )
        }

        if (!ticketType.is_active) {
          return NextResponse.json(
            { error: `Ticket type "${ticketType.name}" is not available` },
            { status: 400 }
          )
        }

        if (ticketType.available_quantity < selection.quantity) {
          return NextResponse.json(
            { error: `Not enough "${ticketType.name}" tickets available` },
            { status: 400 }
          )
        }

        const ticketTotal = Math.round(ticketType.price * 100) * selection.quantity
        totalAmount += ticketTotal
        totalTickets += selection.quantity

        // Store ticket type selections in metadata
        ticketTypeMetadata[ticketType.id] = {
          name: ticketType.name,
          price: ticketType.price,
          quantity: selection.quantity
        }
      }

      description = `[${event.businesses.name}] ${totalTickets} ticket${totalTickets > 1 ? 's' : ''} for ${event.title}`
    }
    // Handle legacy single-price tickets
    else if (quantity) {
      if (event.available_tickets < quantity) {
        return NextResponse.json(
          { error: 'Not enough tickets available' },
          { status: 400 }
        )
      }

      const unitAmount = Math.round(event.ticket_price * 100)
      totalAmount = unitAmount * quantity
      totalTickets = quantity
      description = `[${event.businesses.name}] ${quantity}x ${event.title}`
    } else {
      return NextResponse.json(
        { error: 'No tickets selected' },
        { status: 400 }
      )
    }

    // Store the original ticket subtotal before any discounts
    const ticketSubtotalInCents = totalAmount

    // Apply promo code discount if provided
    let discountAmount = 0
    let promoCode = null
    if (promoCodeId) {
      promoCode = await getPromoCodeById(promoCodeId)

      if (promoCode && promoCode.is_active) {
        // Calculate discount based on the promo code type
        const subtotalInDollars = totalAmount / 100

        if (promoCode.discount_type === 'percentage') {
          discountAmount = Math.round((totalAmount * promoCode.discount_value) / 100)
        } else if (promoCode.discount_type === 'fixed') {
          // Fixed discount in dollars, convert to cents and ensure it doesn't exceed total
          discountAmount = Math.min(Math.round(promoCode.discount_value * 100), totalAmount)
        }

        // Apply the discount
        totalAmount = Math.max(0, totalAmount - discountAmount)
      }
    }

    // Calculate tax on the amount after discount
    const taxableAmountInDollars = totalAmount / 100
    const taxPercentage = event.businesses.tax_percentage || 0
    const taxInCents = Math.round((taxableAmountInDollars * taxPercentage))

    // Check if this is a free ticket (no charge after discount)
    const isFreeTicket = totalAmount <= 0

    // Get business-specific fee settings (custom or global) and calculate platform fee
    // Platform fee should be calculated on the amount INCLUDING tax
    // No fees for free tickets
    const feeSettings = await getBusinessFeeSettings(event.businesses)
    const subtotalInDollars = (totalAmount + discountAmount) / 100
    const taxableAmountWithTaxInCents = totalAmount + taxInCents
    const platformFeeInCents = isFreeTicket ? 0 : calculatePlatformFee(
      subtotalInDollars / totalTickets,
      totalTickets,
      feeSettings,
      taxableAmountWithTaxInCents
    )
    const platformFeeInDollars = platformFeeInCents / 100

    // Start with ticket amount after discount, plus tax
    let finalChargeAmount = totalAmount + taxInCents
    let platformFeeForCustomer = 0
    let stripeFeeForCustomer = 0

    // Add platform fee if customer pays it (skip for free tickets)
    if (!isFreeTicket && event.businesses.platform_fee_payer === 'customer') {
      platformFeeForCustomer = platformFeeInCents
      finalChargeAmount += platformFeeInCents
    }

    // Add Stripe fee if customer pays it (skip for free tickets)
    if (!isFreeTicket && event.businesses.stripe_fee_payer === 'customer') {
      // Use "gross up" formula to calculate the Stripe fee
      // Since Stripe calculates their fee on the final amount (including their fee),
      // we need to solve: final = base + (final * 0.029 + 0.30)
      // Which gives us: final = (base + 0.30) / (1 - 0.029)
      const baseInDollars = finalChargeAmount / 100
      const finalWithStripeFee = (baseInDollars + 0.30) / (1 - 0.029)
      stripeFeeForCustomer = Math.round((finalWithStripeFee - baseInDollars) * 100)
      finalChargeAmount = Math.round(finalWithStripeFee * 100)
    }

    // Calculate what the business receives and the actual Stripe fee
    // This depends on who pays which fees
    let transferAmount: number
    let actualStripeFeeInCents: number

    if (isFreeTicket) {
      // No fees for free tickets
      actualStripeFeeInCents = 0
      transferAmount = 0
    } else if (event.businesses.stripe_fee_payer === 'customer') {
      // Customer is paying the Stripe fee (it's already included in finalChargeAmount)
      // Platform gets: platform fee + stripe fee (customer paid)
      // Business gets: finalChargeAmount - platform fee - stripe fee
      actualStripeFeeInCents = stripeFeeForCustomer
      transferAmount = finalChargeAmount - platformFeeInCents - stripeFeeForCustomer
    } else {
      // Business is paying the Stripe fee
      // Stripe will deduct their fee from finalChargeAmount automatically
      // We need to calculate Stripe's actual fee on finalChargeAmount
      actualStripeFeeInCents = Math.round((finalChargeAmount * 0.029) + 30)

      // Platform gets: platform fee only (Stripe takes their fee separately)
      // Business gets: finalChargeAmount - actual Stripe fee - platform fee
      transferAmount = finalChargeAmount - actualStripeFeeInCents - platformFeeInCents
    }

    // Create Stripe PaymentIntent
    // Note: We use transfer_data.amount to specify exactly what the business receives
    // The platform automatically receives: (charge - Stripe fee - transfer amount)
    // on_behalf_of shifts chargeback liability to the business
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalChargeAmount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      on_behalf_of: event.businesses.stripe_account_id,
      transfer_data: {
        destination: event.businesses.stripe_account_id,
        amount: transferAmount, // Exact amount business receives
      },
      metadata: {
        eventId: event.id,
        businessId: event.business_id,
        businessName: event.businesses.name,
        totalTickets: totalTickets.toString(),
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        // Store ticket subtotal (before discount, tax, fees)
        ticketSubtotal: (ticketSubtotalInCents / 100).toFixed(2),
        // Store fee information
        platformFee: platformFeeInDollars.toFixed(2),
        platformFeeForCustomer: (platformFeeForCustomer / 100).toFixed(2),
        stripeFee: (actualStripeFeeInCents / 100).toFixed(2), // Actual Stripe fee (regardless of who pays)
        stripeFeePayer: event.businesses.stripe_fee_payer,
        platformFeePayer: event.businesses.platform_fee_payer,
        // Store tax information
        taxPercentage: taxPercentage.toString(),
        taxAmount: (taxInCents / 100).toFixed(2),
        // Store promo code information if applied
        ...(promoCode ? {
          promoCodeId: promoCode.id,
          promoCode: promoCode.code,
          discountAmount: (discountAmount / 100).toFixed(2),
        } : {}),
        // Store ticket type information if applicable
        ...(ticketSelections ? {
          ticketTypes: JSON.stringify(ticketTypeMetadata),
          hasTicketTypes: 'true'
        } : {
          quantity: quantity.toString(),
          hasTicketTypes: 'false'
        }),
        // Marketing attribution tracking
        ...(trackingRef ? { trackingRef } : {})
      },
      description,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    })
  } catch (error) {
    console.error('Payment intent error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
