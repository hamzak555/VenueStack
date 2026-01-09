import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { updateBusinessSubscription, extendBusinessTrial } from '@/lib/db/subscriptions'
import { checkSubscriptionAccess } from '@/lib/subscription/check-access'

interface RouteContext {
  params: Promise<{ businessId: string }>
}

/**
 * GET - Get detailed subscription info for a business (admin view)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId } = await context.params

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

    // Get Stripe subscription details if exists
    let stripeSubscription: Stripe.Subscription | null = null
    if (business.subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(business.subscription_id)
      } catch (err) {
        console.error('Error fetching Stripe subscription:', err)
      }
    }

    // Get invoices if customer exists
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
        }))
      } catch (err) {
        console.error('Error fetching invoices:', err)
      }
    }

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        contactEmail: business.contact_email,
      },
      subscription: {
        status: business.subscription_status,
        subscriptionId: business.subscription_id,
        stripeCustomerId: business.stripe_customer_id,
        currentPeriodEnd: business.subscription_current_period_end,
        cancelAtPeriodEnd: business.subscription_cancel_at_period_end,
        trialEndDate: business.trial_end_date,
        createdAt: business.subscription_created_at,
      },
      access,
      stripeSubscription: stripeSubscription ? {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000).toISOString(),
        cancelAt: stripeSubscription.cancel_at
          ? new Date(stripeSubscription.cancel_at * 1000).toISOString()
          : null,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000).toISOString()
          : null,
      } : null,
      invoices,
    })
  } catch (error) {
    console.error('Error fetching business subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

/**
 * PATCH - Admin actions on business subscription
 * Actions: extend_trial, cancel_immediately, grant_access, revoke_access
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId } = await context.params
    const body = await request.json()
    const { action, trialEndDate } = body

    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    switch (action) {
      case 'extend_trial': {
        if (!trialEndDate) {
          return NextResponse.json({ error: 'trialEndDate is required' }, { status: 400 })
        }

        const newEndDate = new Date(trialEndDate)
        if (isNaN(newEndDate.getTime()) || newEndDate < new Date()) {
          return NextResponse.json({ error: 'Invalid trial end date' }, { status: 400 })
        }

        // Update Stripe subscription trial if exists
        if (business.subscription_id) {
          try {
            await stripe.subscriptions.update(business.subscription_id, {
              trial_end: Math.floor(newEndDate.getTime() / 1000),
            })
          } catch (err) {
            console.error('Error updating Stripe trial:', err)
          }
        }

        // Update local database
        const updatedBusiness = await extendBusinessTrial(businessId, newEndDate)

        return NextResponse.json({
          success: true,
          message: 'Trial extended successfully',
          trialEndDate: updatedBusiness.trial_end_date,
        })
      }

      case 'cancel_immediately': {
        if (!business.subscription_id) {
          return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
        }

        // Cancel in Stripe immediately
        try {
          await stripe.subscriptions.cancel(business.subscription_id)
        } catch (err) {
          console.error('Error canceling Stripe subscription:', err)
          return NextResponse.json({ error: 'Failed to cancel Stripe subscription' }, { status: 500 })
        }

        // Update local status
        await updateBusinessSubscription(businessId, {
          subscription_status: 'canceled',
          subscription_cancel_at_period_end: false,
        })

        return NextResponse.json({
          success: true,
          message: 'Subscription canceled immediately',
        })
      }

      case 'grant_access': {
        // Grant temporary access by setting status to trialing with a trial end date
        const grantUntil = trialEndDate ? new Date(trialEndDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days

        await updateBusinessSubscription(businessId, {
          subscription_status: 'trialing',
          trial_end_date: grantUntil.toISOString(),
        })

        return NextResponse.json({
          success: true,
          message: 'Access granted successfully',
          grantedUntil: grantUntil.toISOString(),
        })
      }

      case 'revoke_access': {
        await updateBusinessSubscription(businessId, {
          subscription_status: 'canceled',
        })

        return NextResponse.json({
          success: true,
          message: 'Access revoked',
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating business subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
