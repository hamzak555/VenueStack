import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmins, createPlatformAdmin } from '@/lib/db/users'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { validatePassword, getPasswordRequirements } from '@/lib/auth/password-validation'

export async function GET(request: NextRequest) {
  try {
    // Verify admin is authenticated
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch platform admins from users table
    const platformAdmins = await getPlatformAdmins()

    // Remove password_hash and format response
    const sanitizedAdmins = platformAdmins.map(({ password_hash, ...user }) => ({
      ...user,
      is_active: true,
    }))

    // Sort by created_at descending
    sanitizedAdmins.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json(sanitizedAdmins)
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin is authenticated
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, password, name, phone } = body

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: getPasswordRequirements() },
        { status: 400 }
      )
    }

    // Create the platform admin user
    const user = await createPlatformAdmin({
      email,
      password,
      name,
      phone: phone || null,
    })

    // Remove password_hash from response
    const { password_hash, ...sanitizedUser } = user

    return NextResponse.json(sanitizedUser)
  } catch (error: any) {
    console.error('Error creating admin user:', error)

    // Check for unique constraint violation
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    )
  }
}
