import { NextRequest, NextResponse } from 'next/server'
import { getAdminUsers, createAdminUser } from '@/lib/db/admin-users'
import { getPlatformAdmins } from '@/lib/db/users'
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

    // Fetch from both legacy admin_users table and new users table
    const [legacyUsers, platformAdmins] = await Promise.all([
      getAdminUsers(),
      getPlatformAdmins()
    ])

    // Remove password_hash from legacy users
    const sanitizedLegacyUsers = legacyUsers.map(({ password_hash, ...user }) => ({
      ...user,
      source: 'legacy'
    }))

    // Format platform admins to match the expected structure and remove password_hash
    const sanitizedPlatformAdmins = platformAdmins.map(({ password_hash, ...user }) => ({
      ...user,
      is_active: true, // Platform admins are always active
      source: 'global'
    }))

    // Combine both lists, avoiding duplicates by email
    const seenEmails = new Set<string>()
    const allUsers = []

    // Add platform admins first (newer system takes priority)
    for (const user of sanitizedPlatformAdmins) {
      if (user.email && !seenEmails.has(user.email.toLowerCase())) {
        seenEmails.add(user.email.toLowerCase())
        allUsers.push(user)
      }
    }

    // Add legacy users that aren't already in the list
    for (const user of sanitizedLegacyUsers) {
      if (user.email && !seenEmails.has(user.email.toLowerCase())) {
        seenEmails.add(user.email.toLowerCase())
        allUsers.push(user)
      }
    }

    // Sort by created_at descending
    allUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json(allUsers)
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
