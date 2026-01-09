import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessFeeSettings, calculatePlatformFee } from '@/lib/db/platform-settings'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventId,
      tableSelections, // Record<sectionId, quantity>
      customerName,
      customerEmail,
      customerPhone,
      trackingRef, // Marketing attribution tracking
    } = body

    if (!eventId || !tableSelections || !customerName || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate tableSelections is not empty
    const sectionIds = Object.keys(tableSelections).filter(id => tableSelections[id] > 0)
    if (sectionIds.length === 0) {
      return NextResponse.json(
        { error: 'No tables selected' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get event details with business
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

    // Check if table service is enabled
    if (!event.table_service_enabled) {
      return NextResponse.json(
        { error: 'Table service is not available for this event' },
        { status: 400 }
      )
    }

    // Check if business has Stripe connected
    if (!event.businesses.stripe_account_id || !event.businesses.stripe_onboarding_complete) {
      return NextResponse.json(
        { error: 'Payment processing not available for this event' },
        { status: 400 }
      )
    }

    // Get all selected table sections
    const { data: tableSections, error: sectionsError } = await supabase
      .from('event_table_sections')
      .select('*')
      .eq('event_id', eventId)
      .in('id', sectionIds)

    if (sectionsError || !tableSections || tableSections.length === 0) {
      return NextResponse.json(
        { error: 'Table sections not found' },
        { status: 404 }
      )
    }

    // Validate each section and calculate totals
    let totalTablePrice = 0
    let totalTables = 0
    const orderDetails: { sectionId: string; sectionName: string; quantity: number; price: number }[] = []

    for (const section of tableSections) {
      const quantity = tableSelections[section.id] || 0
      if (quantity <= 0) continue

      if (!section.is_enabled) {
        return NextResponse.json(
          { error: `Table section "${section.section_name}" is not available` },
          { status: 400 }
        )
      }

      if (section.available_tables < quantity) {
        return NextResponse.json(
          { error: `Not enough tables available in "${section.section_name}". Only ${section.available_tables} available.` },
          { status: 400 }
        )
      }

      // Check max per customer limit
      if (section.max_per_customer && quantity > section.max_per_customer) {
        return NextResponse.json(
          { error: `Maximum ${section.max_per_customer} tables per customer in "${section.section_name}"` },
          { status: 400 }
        )
      }

      totalTablePrice += section.price * quantity
      totalTables += quantity
      orderDetails.push({
        sectionId: section.id,
        sectionName: section.section_name,
        quantity,
        price: section.price,
      })
    }

    if (totalTables === 0) {
      return NextResponse.json(
        { error: 'No valid tables selected' },
        { status: 400 }
      )
    }

    // Calculate amounts
    const totalAmount = Math.round(totalTablePrice * 100) // Convert to cents

    // Calculate tax
    const taxPercentage = event.businesses.tax_percentage || 0
    const taxInCents = Math.round((totalTablePrice * taxPercentage))

    // Get business-specific fee settings and calculate platform fee
    const feeSettings = await getBusinessFeeSettings(event.businesses)
    const taxableAmountWithTaxInCents = totalAmount + taxInCents
    const platformFeeInCents = calculatePlatformFee(
      totalTablePrice,
      1, // Pass 1 since we've already multiplied by quantity
      feeSettings,
      taxableAmountWithTaxInCents
    )
    const platformFeeInDollars = platformFeeInCents / 100

    // Start with table amount plus tax
    let finalChargeAmount = totalAmount + taxInCents
    let platformFeeForCustomer = 0
    let stripeFeeForCustomer = 0

    // Add platform fee if customer pays it
    if (event.businesses.platform_fee_payer === 'customer') {
      platformFeeForCustomer = platformFeeInCents
      finalChargeAmount += platformFeeInCents
    }

    // Add Stripe fee if customer pays it
    if (event.businesses.stripe_fee_payer === 'customer') {
      const baseInDollars = finalChargeAmount / 100
      const finalWithStripeFee = (baseInDollars + 0.30) / (1 - 0.029)
      stripeFeeForCustomer = Math.round((finalWithStripeFee - baseInDollars) * 100)
      finalChargeAmount = Math.round(finalWithStripeFee * 100)
    }

    // Calculate transfer amount (what business receives)
    let transferAmount: number
    let actualStripeFeeInCents: number

    if (event.businesses.stripe_fee_payer === 'customer') {
      actualStripeFeeInCents = stripeFeeForCustomer
      transferAmount = finalChargeAmount - platformFeeInCents - stripeFeeForCustomer
    } else {
      actualStripeFeeInCents = Math.round((finalChargeAmount * 0.029) + 30)
      transferAmount = finalChargeAmount - actualStripeFeeInCents - platformFeeInCents
    }

    // Create description with all sections
    const sectionDescriptions = orderDetails.map(d => `${d.quantity}x ${d.sectionName}`).join(', ')
    const description = `[${event.businesses.name}] Table reservation (${sectionDescriptions}) for ${event.title}`

    // Create Stripe PaymentIntent
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
        amount: transferAmount,
      },
      metadata: {
        type: 'table_booking',
        eventId: event.id,
        businessId: event.business_id,
        businessName: event.businesses.name,
        tableSelections: JSON.stringify(tableSelections),
        orderDetails: JSON.stringify(orderDetails),
        totalTables: totalTables.toString(),
        totalTablePrice: totalTablePrice.toFixed(2),
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        platformFee: platformFeeInDollars.toFixed(2),
        platformFeeForCustomer: (platformFeeForCustomer / 100).toFixed(2),
        stripeFee: (actualStripeFeeInCents / 100).toFixed(2),
        stripeFeePayer: event.businesses.stripe_fee_payer,
        platformFeePayer: event.businesses.platform_fee_payer,
        taxPercentage: taxPercentage.toString(),
        taxAmount: (taxInCents / 100).toFixed(2),
        ...(trackingRef ? { trackingRef } : {}),
      },
      description,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    })
  } catch (error) {
    console.error('Table payment intent error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
