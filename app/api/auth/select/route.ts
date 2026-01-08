import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import { createAdminSession, getAdminSession, deleteAdminSession } from '@/lib/auth/admin-session'
import { createBusinessSession, getBusinessSession, deleteBusinessSession } from '@/lib/auth/business-session'
import { getAdminUserByEmail } from '@/lib/db/admin-users'
import { getBusinessUserByEmail, getBusinessUsersByEmail } from '@/lib/db/business-users'
import { createClient } from '@/lib/supabase/server'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

interface UserAffiliation {
  type: 'admin' | 'business'
  id: string
  name: string
  businessId?: string
  businessSlug?: string
  businessName?: string
  businessLogo?: string | null
  role?: 'admin' | 'regular'
}

interface UnifiedLoginSession {
  email: string
  name: string
  affiliations: UserAffiliation[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Support both camelCase (web) and snake_case (mobile) field names
    const affiliationType = body.affiliationType || body.affiliation_type
    const businessId = body.businessId || body.business_id

    if (!affiliationType) {
      return NextResponse.json(
        { error: 'Affiliation type is required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const pendingToken = cookieStore.get('pending_login')?.value

    // Also check Authorization header for mobile apps
    const authHeader = request.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    let email: string | null = null

    // First, try Authorization header (mobile app flow)
    if (bearerToken) {
      try {
        const { payload } = await jwtVerify(bearerToken, SECRET_KEY)
        const session = payload as unknown as UnifiedLoginSession
        email = session.email
      } catch {
        // Invalid bearer token, continue to check other methods
      }
    }

    // Then try pending login cookie (web flow)
    if (!email && pendingToken) {
      try {
        const { payload } = await jwtVerify(pendingToken, SECRET_KEY)
        const session = payload as unknown as UnifiedLoginSession
        email = session.email
        // Clear the pending login cookie
        cookieStore.delete('pending_login')
      } catch {
        // Invalid pending token, continue to check existing sessions
      }
    }

    // If no pending login, check existing sessions (account switching flow)
    if (!email) {
      const adminSession = await getAdminSession()
      const businessSession = await getBusinessSession()

      email = adminSession?.email || businessSession?.email || null

      if (!email) {
        return NextResponse.json(
          { error: 'Not authenticated. Please login again.' },
          { status: 401 }
        )
      }
    }

    let redirectUrl = '/'

    if (affiliationType === 'admin') {
      // Create admin session
      const adminUser = await getAdminUserByEmail(email)
      if (!adminUser) {
        return NextResponse.json(
          { error: 'Admin user not found' },
          { status: 404 }
        )
      }
      // Clear business session when switching to admin
      await deleteBusinessSession()
      await createAdminSession(adminUser)
      redirectUrl = '/admin'
    } else if (affiliationType === 'business' && businessId) {
      // Get business user and verify access
      const businessUser = await getBusinessUserByEmail(businessId, email)
      if (!businessUser) {
        return NextResponse.json(
          { error: 'Business user not found' },
          { status: 404 }
        )
      }

      // Get business details for mobile app
      const supabase = await createClient()
      const { data: business } = await supabase
        .from('businesses')
        .select('id, name, slug, logo_url, theme_color, contact_email')
        .eq('id', businessId)
        .single()

      // Clear admin session when switching to business
      await deleteAdminSession()
      await createBusinessSession(businessUser)
      redirectUrl = `/${business?.slug || businessId}/dashboard`

      // Create a longer-lived token for mobile apps
      const mobileToken = await new SignJWT({
        userId: businessUser.id,
        businessId: businessId,
        email: businessUser.email,
        role: businessUser.role,
        name: businessUser.name,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET_KEY)

      return NextResponse.json({
        success: true,
        redirectUrl,
        token: mobileToken,
        business: business ? {
          id: business.id,
          name: business.name,
          slug: business.slug,
          logo_url: business.logo_url,
          theme_color: business.theme_color || '#007AFF',
          contact_email: business.contact_email,
        } : null,
        user: {
          id: businessUser.id,
          email: businessUser.email,
          name: businessUser.name,
          role: businessUser.role,
          business_id: businessId,
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid selection' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      redirectUrl,
    })
  } catch (error) {
    console.error('Error during affiliation selection:', error)
    return NextResponse.json(
      { error: 'An error occurred during selection' },
      { status: 500 }
    )
  }
}
