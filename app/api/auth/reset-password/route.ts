import { NextRequest, NextResponse } from 'next/server'
import { updateUser } from '@/lib/db/users'
import { jwtVerify } from 'jose'
import { validatePassword, getPasswordRequirements } from '@/lib/auth/password-validation'

// Validate SESSION_SECRET is properly configured
if (!process.env.SESSION_SECRET) {
  throw new Error(
    'CRITICAL: SESSION_SECRET environment variable is not set. ' +
    'This is required for secure session management.'
  )
}

const SECRET_KEY = new TextEncoder().encode(process.env.SESSION_SECRET)

interface ResetTokenPayload {
  userId: string
  email: string
  type: string
}

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] || getPasswordRequirements() },
        { status: 400 }
      )
    }

    // Verify and decode the token
    let payload: ResetTokenPayload
    try {
      const verified = await jwtVerify(token, SECRET_KEY)
      payload = verified.payload as unknown as ResetTokenPayload

      // Verify it's a password reset token
      if (payload.type !== 'password_reset') {
        throw new Error('Invalid token type')
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      )
    }

    // Update the user's password
    await updateUser(payload.userId, { password })

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    })
  } catch (error) {
    console.error('Error in reset-password:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
