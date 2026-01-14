import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserByPhone } from '@/lib/db/users'
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
  phone: string
  name: string
  userId?: string
  affiliations: UserAffiliation[]
  [key: string]: unknown
}

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Phone and code are required' },
        { status: 400 }
      )
    }

    // Verify the code from Supabase
    const supabase = await createClient()

    const { data: verificationRecord, error: fetchError } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .single()

    if (fetchError || !verificationRecord) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      )
    }

    // Check if code has expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      // Delete expired code
      await supabase
        .from('phone_verification_codes')
        .delete()
        .eq('phone', phone)

      return NextResponse.json(
        { error: 'Verification code has expired' },
        { status: 401 }
      )
    }

    // Delete the used code
    await supabase
      .from('phone_verification_codes')
      .delete()
      .eq('phone', phone)

    // Get user by phone
    const user = await getUserByPhone(phone)

    const affiliations: UserAffiliation[] = []
    let userName = ''
    let userEmail = ''
    let globalUserId = ''

    if (user) {
      globalUserId = user.id
      userName = user.name
      userEmail = user.email

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

    if (affiliations.length === 0) {
      return NextResponse.json(
        { error: 'No account found with this phone number' },
        { status: 404 }
      )
    }

    // Create a temporary session token for the selection page
    const session: UnifiedLoginSession = {
      email: userEmail,
      phone,
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
      affiliations,
      requiresSelection: affiliations.length > 1,
      token, // Include token for mobile apps
    })
  } catch (error) {
    console.error('Error verifying code:', error)
    return NextResponse.json(
      { error: 'An error occurred during verification' },
      { status: 500 }
    )
  }
}
