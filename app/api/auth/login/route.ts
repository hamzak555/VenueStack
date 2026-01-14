import { NextRequest, NextResponse } from 'next/server'
import { verifyUserPassword } from '@/lib/db/users'
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

    // Verify user credentials
    const user = await verifyUserPassword(email, password)
    if (user) {
      globalUserId = user.id
      userName = user.name

      // If user is a platform admin, add admin affiliation
      if (user.is_platform_admin) {
        affiliations.push({
          type: 'admin',
          id: user.id,
          name: user.name,
          userId: user.id,
        })
      }

      // Get all business affiliations for this user
      const businessLinks = await getBusinessUsersByUserId(user.id)
      if (businessLinks && businessLinks.length > 0) {
        for (const link of businessLinks) {
          const business = link.business as { id: string; name: string; slug: string; logo_url: string | null } | null
          affiliations.push({
            type: 'business',
            id: link.id,
            name: user.name,
            userId: user.id,
            businessId: link.business_id,
            businessSlug: business?.slug,
            businessName: business?.name,
            businessLogo: business?.logo_url,
            role: link.role,
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
