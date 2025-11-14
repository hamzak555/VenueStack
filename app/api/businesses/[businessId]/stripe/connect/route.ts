import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { getPlatformSettings } from '@/lib/db/platform-settings'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await context.params
    const supabase = await createClient()

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    let accountId = business.stripe_account_id

    // Create Stripe Connect account if it doesn't exist
    if (!accountId) {
      console.log('Creating new Stripe account for business:', {
        name: business.name,
        email: business.contact_email,
        website: business.website,
      })

      // Note: We're omitting the business_profile.url field here because Stripe
      // will collect this information during their onboarding flow
      const accountData: any = {
        type: 'express',
        country: 'US',
        email: business.contact_email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: business.name,
        },
      }

      console.log('Account data being sent to Stripe:', JSON.stringify(accountData, null, 2))
      const account = await stripe.accounts.create(accountData)

      accountId = account.id

      // Save Stripe account ID to database
      await supabase
        .from('businesses')
        .update({ stripe_account_id: accountId })
        .eq('id', businessId)
    } else {
      console.log('Using existing Stripe account ID:', accountId)
    }

    // Create account link for onboarding
    console.log('Creating account link for account:', accountId)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/business/${businessId}/settings/stripe?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/business/${businessId}/settings/stripe?success=true`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error('Stripe Connect error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Stripe Connect link' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await context.params
    const supabase = await createClient()

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('stripe_account_id, stripe_onboarding_complete, stripe_fee_payer, platform_fee_payer, tax_percentage')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Get platform settings
    const platformSettings = await getPlatformSettings()

    if (!business.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        onboarding_complete: false,
        stripe_fee_payer: business.stripe_fee_payer || 'customer',
        platform_fee_payer: business.platform_fee_payer || 'customer',
        tax_percentage: business.tax_percentage || 0,
        platform_settings: platformSettings,
      })
    }

    // Check if onboarding is complete
    const account = await stripe.accounts.retrieve(business.stripe_account_id)

    const onboardingComplete = account.details_submitted && account.charges_enabled

    // Update database if onboarding status changed
    if (onboardingComplete !== business.stripe_onboarding_complete) {
      await supabase
        .from('businesses')
        .update({ stripe_onboarding_complete: onboardingComplete })
        .eq('id', businessId)
    }

    return NextResponse.json({
      connected: true,
      onboarding_complete: onboardingComplete,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      stripe_fee_payer: business.stripe_fee_payer || 'customer',
      platform_fee_payer: business.platform_fee_payer || 'customer',
      tax_percentage: business.tax_percentage || 0,
      platform_settings: platformSettings,
    })
  } catch (error) {
    console.error('Stripe status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check Stripe status' },
      { status: 500 }
    )
  }
}
