import { NextRequest, NextResponse } from 'next/server'
import { createBusiness, isSlugAvailable } from '@/lib/db/businesses'
import { createBusinessUserLink } from '@/lib/db/business-users'
import { createUser, getUserByEmail } from '@/lib/db/users'
import { normalizePhoneNumber } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessName, slug, userName, email, password, phone } = body

    // Validate required fields
    if (!businessName || !slug || !userName || !email || !password || !phone) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'URL slug can only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    // Check if slug is available
    const slugAvailable = await isSlugAvailable(slug)
    if (!slugAvailable) {
      return NextResponse.json(
        { error: 'This URL is already taken. Please choose a different one.' },
        { status: 400 }
      )
    }

    // Check if email is already used
    const existingUser = await getUserByEmail(email)

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 }
      )
    }

    // Create the business without an active subscription
    // Trial will start after they enter credit card info
    const business = await createBusiness({
      name: businessName,
      slug: slug.toLowerCase(),
      description: null,
      logo_url: null,
      contact_email: email.toLowerCase(),
      contact_phone: phone,
      website: null,
      address: null,
      address_latitude: null,
      address_longitude: null,
      google_place_id: null,
      instagram: null,
      tiktok: null,
      theme_color: '#6366f1', // Default indigo color
      user_id: null,
      is_active: true,
      stripe_account_id: null,
      stripe_onboarding_complete: false,
      stripe_fee_payer: 'customer',
      platform_fee_payer: 'customer',
      tax_percentage: 0,
      use_custom_fee_settings: false,
      platform_fee_type: null,
      flat_fee_amount: null,
      percentage_fee: null,
      venue_layout_url: null,
      table_service_config: null,
      stripe_customer_id: null,
      subscription_status: null, // No subscription until they add payment method
      subscription_id: null,
      subscription_current_period_end: null,
      subscription_cancel_at_period_end: false,
      trial_end_date: null,
      subscription_created_at: null,
    })

    // Create the user in the global users table
    const user = await createUser({
      email: email.toLowerCase(),
      phone: normalizePhoneNumber(phone),
      password,
      name: userName,
    })

    // Link the user to the business as owner
    const businessUser = await createBusinessUserLink({
      user_id: user.id,
      business_id: business.id,
      role: 'owner',
    })

    return NextResponse.json({
      success: true,
      message: 'Registration successful',
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      requiresPaymentSetup: true,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
