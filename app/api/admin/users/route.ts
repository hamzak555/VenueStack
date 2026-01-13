import { NextRequest, NextResponse } from 'next/server'
import { getAdminUsers, createAdminUser } from '@/lib/db/admin-users'
import { verifyAdminAccess } from '@/lib/auth/admin-session'

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

    const users = await getAdminUsers()

    // Remove password_hash from response
    const sanitizedUsers = users.map(({ password_hash, ...user }) => user)

    return NextResponse.json(sanitizedUsers)
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

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Create the user
    const user = await createAdminUser({
      email,
      password,
      name,
      phone: phone || null,
      is_active: true,
    })

    // Remove password_hash from response
    const { password_hash, ...sanitizedUser } = user

    return NextResponse.json(sanitizedUser)
  } catch (error: any) {
    console.error('Error creating admin user:', error)

    // Check for unique constraint violation
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'An admin user with this email already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    )
  }
}
