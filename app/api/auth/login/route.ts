import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminUserPassword } from '@/lib/db/admin-users'
import { verifyUserPassword, verifyPlatformAdminPassword } from '@/lib/db/users'
import { getBusinessUsersByUserId } from '@/lib/db/business-users'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'

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
  [key: string]: unknown
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const affiliations: UserAffiliation[] = []
    let userName = ''
    let globalUserId = ''

    // Check global user credentials first
    const globalUser = await verifyUserPassword(email, password)
    if (globalUser) {
      globalUserId = globalUser.id
      userName = globalUser.name

      // If user is a platform admin, add admin affiliation
      if (globalUser.is_platform_admin) {
        affiliations.push({
          type: 'admin',
          id: globalUser.id,
          name: globalUser.name,
          userId: globalUser.id,
        })
      }

      // Get all business affiliations for this user
      const businessLinks = await getBusinessUsersByUserId(globalUser.id)
      if (businessLinks && businessLinks.length > 0) {
        for (const link of businessLinks) {
          const business = link.business as { id: string; name: string; slug: string; logo_url: string | null } | null
          affiliations.push({
            type: 'business',
            id: link.id,
            name: globalUser.name,
            userId: globalUser.id,
            businessId: link.business_id,
            businessSlug: business?.slug,
            businessName: business?.name,
            businessLogo: business?.logo_url,
            role: link.role,
          })
        }
      }
    }

    // Fallback: Check legacy admin_users table (for backwards compatibility during migration)
    if (affiliations.length === 0 || !affiliations.some(a => a.type === 'admin')) {
      const legacyAdminUser = await verifyAdminUserPassword(email, password)
      if (legacyAdminUser) {
        if (!userName) userName = legacyAdminUser.name
        // Only add if not already added from global users
        if (!affiliations.some(a => a.type === 'admin')) {
          affiliations.push({
            type: 'admin',
            id: legacyAdminUser.id,
            name: legacyAdminUser.name,
          })
        }
      }
    }

    // No valid credentials found
    if (affiliations.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create a temporary session token for the selection page
    const session: UnifiedLoginSession = {
      email,
      name: userName,
      userId: globalUserId || undefined,
      affiliations,
    }

    const token = await new SignJWT(session)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m') // Short expiry - just for selection
      .sign(SECRET_KEY)

    const cookieStore = await cookies()
    cookieStore.set('pending_login', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    })

    return NextResponse.json({
      success: true,
      name: userName,
      affiliations: affiliations,
      requiresSelection: affiliations.length > 1,
      token: token, // Include token for mobile apps
    })
  } catch (error) {
    console.error('Error during unified login:', error)
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
