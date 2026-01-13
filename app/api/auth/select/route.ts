import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import { createAdminSession, getAdminSession, deleteAdminSession } from '@/lib/auth/admin-session'
import { createBusinessSession, getBusinessSession, deleteBusinessSession } from '@/lib/auth/business-session'
import { getAdminUserByEmail } from '@/lib/db/admin-users'
import { getPlatformAdminByEmail, getUserById } from '@/lib/db/users'
import { getBusinessUserByEmail, getBusinessUsersByEmail, getBusinessUserByUserId } from '@/lib/db/business-users'
import { createClient } from '@/lib/supabase/server'
import { createLoginLog } from '@/lib/db/login-logs'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

interface UserAffiliation {
  type: 'admin' | 'business'
  id: string
  name: string
  userId?: string
  businessId?: string
  businessSlug?: string
  businessName?: string
  businessLogo?: string | null
  role?: 'admin' | 'regular'
}

interface UnifiedLoginSession {
  email: string
  name: string
  userId?: string
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
    let globalUserId: string | null = null

    // First, try Authorization header (mobile app flow)
    if (bearerToken) {
      try {
        const { payload } = await jwtVerify(bearerToken, SECRET_KEY)
        const session = payload as unknown as UnifiedLoginSession
        email = session.email
        globalUserId = session.userId || null
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
        globalUserId = session.userId || null
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
      // Get globalUserId from business session for account switching
      if (!globalUserId && businessSession?.globalUserId) {
        globalUserId = businessSession.globalUserId
      }

      if (!email) {
        return NextResponse.json(
          { error: 'Not authenticated. Please login again.' },
          { status: 401 }
        )
      }
    }

    let redirectUrl = '/'

    // Get IP and user agent for login logging
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : headersList.get('x-real-ip') || null
    const userAgent = headersList.get('user-agent') || null

    if (affiliationType === 'admin') {
      // Try to find platform admin from global users first
      let adminUser = null

      // If we have a globalUserId, check if that user is a platform admin
      if (globalUserId) {
        const user = await getUserById(globalUserId)
        if (user?.is_platform_admin) {
          adminUser = user
        }
      }

      // If not found by ID, try by email
      if (!adminUser) {
        adminUser = await getPlatformAdminByEmail(email)
      }

      // Fallback to legacy admin_users table
      if (!adminUser) {
        const legacyAdmin = await getAdminUserByEmail(email)
        if (legacyAdmin) {
          adminUser = legacyAdmin
        }
      }

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

      // Log the admin login
      createLoginLog({
        user_type: 'admin',
        user_id: adminUser.id,
        user_email: adminUser.email,
        user_name: adminUser.name,
        user_role: 'Platform Admin',
        business_id: null,
        business_name: null,
        business_slug: null,
        ip_address: ipAddress,
        user_agent: userAgent,
      }).catch(err => console.error('Failed to log admin login:', err))
    } else if (affiliationType === 'business' && businessId) {
      // Get business user and verify access - try user_id first, then fall back to email
      let businessUser = null
      if (globalUserId) {
        businessUser = await getBusinessUserByUserId(businessId, globalUserId)
      }
      if (!businessUser) {
        businessUser = await getBusinessUserByEmail(businessId, email)
      }
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

      // If user has a linked user_id, get the name from users table (source of truth)
      // This ensures updated profile names are reflected in the session
      if (businessUser.user_id) {
        const globalUser = await getUserById(businessUser.user_id)
        if (globalUser?.name) {
          businessUser = { ...businessUser, name: globalUser.name }
        }
      }

      // Clear admin session when switching to business
      await deleteAdminSession()
      await createBusinessSession(businessUser)
      redirectUrl = `/${business?.slug || businessId}/dashboard`

      // Log the business login
      createLoginLog({
        user_type: 'business',
        user_id: businessUser.id,
        user_email: businessUser.email,
        user_name: businessUser.name,
        user_role: businessUser.role,
        business_id: businessId,
        business_name: business?.name || null,
        business_slug: business?.slug || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      }).catch(err => console.error('Failed to log business login:', err))

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
