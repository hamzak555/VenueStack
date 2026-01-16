import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db/users'
import { sendPasswordResetEmail } from '@/lib/sendgrid'
import { SignJWT } from 'jose'
import { rateLimit, rateLimitResponse, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Rate limit by IP and email to prevent spam
    const ip = getClientIP(request)
    const ipLimit = rateLimit(ip, 'password-reset-ip', RATE_LIMITS.passwordReset)
    if (!ipLimit.success) {
      return rateLimitResponse(ipLimit.resetIn)
    }

    const emailLimit = rateLimit(email.toLowerCase(), 'password-reset-email', RATE_LIMITS.passwordReset)
    if (!emailLimit.success) {
      return rateLimitResponse(emailLimit.resetIn)
    }

    // Look up the user
    const user = await getUserByEmail(email)

    // Always return success to prevent email enumeration attacks
    // But only send email if user exists
    if (user) {
      // Create a reset token that expires in 1 hour
      const resetToken = await new SignJWT({
        userId: user.id,
        email: user.email,
        type: 'password_reset'
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(SECRET_KEY)

      // Generate the reset URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

      // Send the email
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userName: user.name,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    })
  } catch (error) {
    console.error('Error in forgot-password:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
