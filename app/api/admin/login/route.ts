import { NextRequest, NextResponse } from 'next/server'
import { verifyPlatformAdminPassword } from '@/lib/db/users'
import { createAdminSession } from '@/lib/auth/admin-session'

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
