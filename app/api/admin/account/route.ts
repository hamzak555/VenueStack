import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/admin-session'
import { getUserById, updateUser } from '@/lib/db/users'
import { validatePassword, getPasswordRequirements } from '@/lib/auth/password-validation'
import bcrypt from 'bcryptjs'

/**
 * GET /api/admin/account
 * Get the current admin user's profile
 */
export async function GET() {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get user from users table
    const user = await getUserById(session.userId)

    if (!user || !user.is_platform_admin) {
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
    console.error('Error fetching admin account:', error)
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/account
 * Update the current admin user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get user from users table
    const user = await getUserById(session.userId)

    if (!user || !user.is_platform_admin) {
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

      const isValid = await bcrypt.compare(currentPassword, user.password_hash)

      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        )
      }

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: getPasswordRequirements() },
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
      updates.email = email.toLowerCase()
    }

    if (phone !== undefined && phone !== user.phone) {
      updates.phone = phone || null
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
    console.error('Error updating admin account:', error)

    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
}
