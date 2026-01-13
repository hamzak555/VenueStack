import { NextRequest, NextResponse } from 'next/server'
import { getBusinessSession } from '@/lib/auth/business-session'
import { getUserById, getUserByEmail, updateUser } from '@/lib/db/users'
import { normalizePhoneNumber } from '@/lib/twilio'

/**
 * GET /api/user/account
 * Get the current user's global profile
 */
export async function GET() {
  try {
    const session = await getBusinessSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get the global user by ID first, fall back to email
    let user = null
    if (session.globalUserId) {
      user = await getUserById(session.globalUserId)
    }
    if (!user) {
      user = await getUserByEmail(session.email)
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Return user without password hash
    return NextResponse.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      created_at: user.created_at,
      updated_at: user.updated_at,
    })
  } catch (error) {
    console.error('Error fetching user account:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/account
 * Update the current user's global profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getBusinessSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get the global user by ID first, fall back to email
    let user = null
    if (session.globalUserId) {
      user = await getUserById(session.globalUserId)
    }
    if (!user) {
      user = await getUserByEmail(session.email)
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, email, phone, password, currentPassword } = body

    // If changing password, verify current password first
    if (password) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 }
        )
      }

      const bcrypt = await import('bcryptjs')
      const isValid = await bcrypt.compare(currentPassword, user.password_hash)

      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        )
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters' },
          { status: 400 }
        )
      }
    }

    // Build updates object
    const updates: any = {}

    if (name !== undefined && name.trim()) {
      updates.name = name.trim()
    }

    if (email !== undefined && email.toLowerCase() !== user.email) {
      // Verify email is not already taken
      const existingUser = await getUserByEmail(email)
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 409 }
        )
      }
      updates.email = email.toLowerCase()
    }

    if (phone !== undefined) {
      const normalizedPhone = phone ? normalizePhoneNumber(phone) : null
      if (normalizedPhone !== user.phone) {
        // Verify phone is not already taken
        if (normalizedPhone) {
          const { getUserByPhone } = await import('@/lib/db/users')
          const existingUser = await getUserByPhone(normalizedPhone)
          if (existingUser && existingUser.id !== user.id) {
            return NextResponse.json(
              { error: 'Phone number is already in use' },
              { status: 409 }
            )
          }
        }
        updates.phone = normalizedPhone
      }
    }

    if (password) {
      updates.password = password
    }

    // If no updates, return current user
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at,
      })
    }

    // Update the user
    const updatedUser = await updateUser(user.id, updates)

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      name: updatedUser.name,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
    })
  } catch (error) {
    console.error('Error updating user account:', error)

    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email or phone is already in use' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
}
