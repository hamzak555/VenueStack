import { NextRequest, NextResponse } from 'next/server'
import { updateUser } from '@/lib/db/users'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
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
