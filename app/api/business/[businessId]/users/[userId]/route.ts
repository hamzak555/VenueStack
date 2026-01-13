import { NextRequest, NextResponse } from 'next/server'
import { getBusinessUserById, updateBusinessUser, deleteBusinessUser } from '@/lib/db/business-users'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { normalizePhoneNumber } from '@/lib/twilio'
import { canAccessSection, canModifyUserRole, canDeleteUser, VALID_ROLES, type BusinessRole } from '@/lib/auth/roles'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; userId: string }> }
) {
  try {
    const { businessId, userId } = await params

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Verify the user belongs to this business
    const existingUser = await getBusinessUserById(userId)
    if (!existingUser || existingUser.business_id !== businessId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user can modify this user's role
    if (!canModifyUserRole(session.role as BusinessRole, existingUser.role as BusinessRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this user' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, name, phone, role, is_active } = body

    // Build update object
    const updates: any = {}

    if (email !== undefined) updates.email = email
    if (name !== undefined) updates.name = name
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as BusinessRole)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        )
      }
      // Check if user can assign this new role
      if (!canModifyUserRole(session.role as BusinessRole, role as BusinessRole)) {
        return NextResponse.json(
          { error: 'You do not have permission to assign this role' },
          { status: 403 }
        )
      }
      updates.role = role
    }
    if (is_active !== undefined) updates.is_active = is_active
    if (password) updates.password = password

    // Normalize phone number if provided
    if (phone !== undefined) {
      updates.phone = phone ? normalizePhoneNumber(phone) : null
    }

    const updatedUser = await updateBusinessUser(userId, updates)

    // Remove password hash from response
    const { password_hash, ...safeUser } = updatedUser

    return NextResponse.json(safeUser)
  } catch (error) {
    console.error('Error updating user:', error)

    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; userId: string }> }
) {
  try {
    const { businessId, userId } = await params

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Verify the user belongs to this business
    const existingUser = await getBusinessUserById(userId)
    if (!existingUser || existingUser.business_id !== businessId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user can delete this user (manager cannot delete owner)
    if (!canDeleteUser(session.role as BusinessRole, existingUser.role as BusinessRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this user' },
        { status: 403 }
      )
    }

    // Don't allow deleting yourself
    if (session.userId === userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    await deleteBusinessUser(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
