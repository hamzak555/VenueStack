import { NextRequest, NextResponse } from 'next/server'
import { verifyPlatformAdminPassword } from '@/lib/db/users'
import { createAdminSession } from '@/lib/auth/admin-session'
import { rateLimit, rateLimitResponse, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Rate limit by IP and email
    const ip = getClientIP(request)
    const ipLimit = rateLimit(ip, 'admin-login-ip', RATE_LIMITS.login)
    if (!ipLimit.success) {
      return rateLimitResponse(ipLimit.resetIn)
    }

    const emailLimit = rateLimit(email.toLowerCase(), 'admin-login-email', RATE_LIMITS.login)
    if (!emailLimit.success) {
      return rateLimitResponse(emailLimit.resetIn)
    }

    // Verify credentials against users table with is_platform_admin flag
    const user = await verifyPlatformAdminPassword(email, password)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create session
    const session = await createAdminSession(user)

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
      },
    })
  } catch (error) {
    console.error('Error during admin login:', error)
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
