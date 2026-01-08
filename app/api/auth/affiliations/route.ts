import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/admin-session'
import { getBusinessSession } from '@/lib/auth/business-session'
import { getAdminUserByEmail } from '@/lib/db/admin-users'
import { getBusinessUsersByEmail } from '@/lib/db/business-users'
import { jwtVerify } from 'jose'
import { createClient } from '@/lib/supabase/server'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

export async function GET(request: NextRequest) {
  try {
    // Get the current path from referer to determine which dashboard we're on
    const referer = request.headers.get('referer') || ''
    const isOnAdminDashboard = referer.includes('/admin')

    let email: string | undefined
    let adminSession: Awaited<ReturnType<typeof getAdminSession>> = null
    let businessSession: Awaited<ReturnType<typeof getBusinessSession>> = null
    let isFromMobileApp = false

    // Check for Authorization header first (mobile app)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const verified = await jwtVerify(token, SECRET_KEY)
        // The mobile token contains email directly
        const tokenEmail = verified.payload.email as string

        if (tokenEmail) {
          email = tokenEmail
          isFromMobileApp = true
        }
      } catch (err) {
        // Token invalid, fall through to cookie check
        console.error('Token verification failed:', err)
      }
    }

    // If no email from token, check sessions (web flow)
    if (!email) {
      adminSession = await getAdminSession()
      businessSession = await getBusinessSession()

      if (!adminSession && !businessSession) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        )
      }

      email = adminSession?.email || businessSession?.email
    }

    if (!email) {
      return NextResponse.json(
        { error: 'No email found in session' },
        { status: 400 }
      )
    }

    interface UserAffiliation {
      type: 'admin' | 'business'
      id: string
      name: string
      email?: string
      businessId?: string
      businessSlug?: string
      businessName?: string
      businessLogo?: string | null
      themeColor?: string | null
      role?: 'admin' | 'regular'
      isCurrentSession?: boolean
    }

    const affiliations: UserAffiliation[] = []

    // Check if user is an admin (only include for web, not mobile scanner)
    if (!isFromMobileApp) {
      const adminUser = await getAdminUserByEmail(email)
      if (adminUser && adminUser.is_active) {
        affiliations.push({
          type: 'admin',
          id: adminUser.id,
          name: adminUser.name,
          // Admin is current if we're on admin dashboard AND have admin session
          isCurrentSession: isOnAdminDashboard && !!adminSession,
        })
      }
    }

    // Get all business affiliations
    const businessUsers = await getBusinessUsersByEmail(email)
    if (businessUsers && businessUsers.length > 0) {
      for (const user of businessUsers) {
        const business = user.business as { id: string; name: string; slug: string; logo_url: string | null; theme_color: string | null } | null
        affiliations.push({
          type: 'business',
          id: user.id,
          name: user.name,
          email: email,
          businessId: user.business_id,
          businessSlug: business?.slug,
          businessName: business?.name,
          businessLogo: business?.logo_url,
          themeColor: business?.theme_color,
          role: user.role,
          // Business is current if we're NOT on admin dashboard AND this is the active business session
          isCurrentSession: !isFromMobileApp && !isOnAdminDashboard && businessSession?.businessId === user.business_id,
        })
      }
    }

    return NextResponse.json({
      email,
      currentSession: isOnAdminDashboard ? 'admin' : 'business',
      currentBusinessId: businessSession?.businessId,
      affiliations,
    })
  } catch (error) {
    console.error('Error fetching affiliations:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
