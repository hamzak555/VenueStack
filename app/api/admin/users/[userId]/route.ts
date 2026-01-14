import { NextRequest, NextResponse } from 'next/server'
import { getUserById, setPlatformAdmin, updatePlatformAdmin } from '@/lib/db/users'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { validatePassword, getPasswordRequirements } from '@/lib/auth/password-validation'

interface RouteContext {
  params: Promise<{
    userId: string
  }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // Verify admin is authenticated
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { userId } = await context.params
    const body = await request.json()

    // Validate that the user exists and is a platform admin
    const existingUser = await getUserById(userId)
    if (!existingUser || !existingUser.is_platform_admin) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }

    // Validate email format if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    // Validate password strength if provided
    if (body.password) {
      const passwordValidation = validatePassword(body.password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: getPasswordRequirements() },
          { status: 400 }
        )
      }
    }

    // Update the user
    const updatedUser = await updatePlatformAdmin(userId, body)

    // Remove password_hash from response
    const { password_hash, ...sanitizedUser } = updatedUser

    return NextResponse.json(sanitizedUser)
  } catch (error: any) {
    console.error('Error updating admin user:', error)

    // Check for unique constraint violation
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update admin user' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Verify admin is authenticated
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { userId } = await context.params

    // Prevent deleting yourself
    if (userId === session.userId) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin access' },
        { status: 400 }
      )
    }

    // Check if user exists and is a platform admin
    const user = await getUserById(userId)
    if (!user || !user.is_platform_admin) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }

    // Remove admin status (don't delete the user, just remove admin privileges)
    await setPlatformAdmin(userId, false)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing admin access:', error)
    return NextResponse.json(
      { error: 'Failed to remove admin access' },
      { status: 500 }
    )
  }
}
