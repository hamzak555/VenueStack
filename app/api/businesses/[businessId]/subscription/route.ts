import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessSession } from '@/lib/auth/business-session'
import { getSubscriptionSettings, updateBusinessSubscription } from '@/lib/db/subscriptions'
import { checkSubscriptionAccess } from '@/lib/subscription/check-access'

interface RouteContext {
  params: Promise<{ businessId: string }>
}

/**
 * GET - Get subscription status and details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const session = await getBusinessSession()

    if (!session || (session.businessId !== businessId && !session.adminBypass)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const access = checkSubscriptionAccess(business)
    const settings = await getSubscriptionSettings()

    // Get invoices from Stripe if customer exists
    let invoices: any[] = []
    if (business.stripe_customer_id) {
      try {
        const stripeInvoices = await stripe.invoices.list({
          customer: business.stripe_customer_id,
          limit: 12,
        })
        invoices = stripeInvoices.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          amount: inv.amount_paid / 100,
          status: inv.status,
          date: new Date(inv.created * 1000).toISOString(),
          pdfUrl: inv.invoice_pdf,
          hostedUrl: inv.hosted_invoice_url,
        }))
      } catch (err) {
        console.error('Error fetching invoices:', err)
      }
    }

    return NextResponse.json({
      status: business.subscription_status,
      subscriptionId: business.subscription_id,
      currentPeriodEnd: business.subscription_current_period_end,
      cancelAtPeriodEnd: business.subscription_cancel_at_period_end,
      trialEndDate: business.trial_end_date,
      createdAt: business.subscription_created_at,
      access,
      settings: {
        monthlyFee: settings.monthlyFee,
        trialDays: settings.trialDays,
      },
      invoices,
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

/**
 * POST - Create subscription checkout session
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const session = await getBusinessSession()

    if (!session || (session.businessId !== businessId && !session.adminBypass)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Check if already has active subscription
    if (business.subscription_status === 'active' || business.subscription_status === 'trialing') {
      return NextResponse.json({ error: 'Already has active subscription' }, { status: 400 })
    }

    const settings = await getSubscriptionSettings()

    if (!settings.priceId) {
      return NextResponse.json(
        { error: 'Subscription not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // Create or retrieve Stripe customer
    let customerId = business.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: business.contact_email || undefined,
        name: business.name,
        metadata: {
          businessId: business.id,
          businessSlug: business.slug,
        },
      })
      customerId = customer.id

      // Save customer ID to business
      await updateBusinessSubscription(businessId, {
        stripe_customer_id: customerId,
      })
    }

    // Create checkout session for subscription
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Only offer trial if business hasn't had a subscription before
    const hasHadSubscription = !!business.subscription_created_at
    const trialDays = hasHadSubscription ? undefined : (settings.trialDays > 0 ? settings.trialDays : undefined)

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: settings.priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          businessId: business.id,
        },
      },
      success_url: `${appUrl}/${business.slug}/dashboard/settings/subscription?success=true`,
      cancel_url: `${appUrl}/${business.slug}/dashboard/settings/subscription?canceled=true`,
      metadata: {
        businessId: business.id,
      },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.url })
  } catch (error) {
    console.error('Error creating subscription checkout:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}

/**
 * DELETE - Cancel subscription (at period end)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const session = await getBusinessSession()

    if (!session || (session.businessId !== businessId && !session.adminBypass)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!business.subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // Cancel at period end (don't immediately revoke access)
    await stripe.subscriptions.update(business.subscription_id, {
      cancel_at_period_end: true,
    })

    // Update local status
    await updateBusinessSubscription(businessId, {
      subscription_cancel_at_period_end: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      cancelAt: business.subscription_current_period_end,
    })
  } catch (error) {
    console.error('Error canceling subscription:', error)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
