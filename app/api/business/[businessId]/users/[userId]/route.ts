import { NextRequest, NextResponse } from 'next/server'
import { getBusinessUserById, updateBusinessUser, deleteBusinessUser } from '@/lib/db/business-users'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { normalizePhoneNumber } from '@/lib/twilio'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; userId: string }> }
) {
  try {
    const { businessId, userId } = await params

    // Verify access
    const session = await verifyBusinessAccess(businessId)
    if (!session || session.role !== 'admin') {
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

    const body = await request.json()
    const { email, password, name, phone, role, is_active } = body

    // Build update object
    const updates: any = {}

    if (email !== undefined) updates.email = email
    if (name !== undefined) updates.name = name
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'regular') {
        return NextResponse.json(
          { error: 'Role must be either "admin" or "regular"' },
          { status: 400 }
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

    // Verify access
    const session = await verifyBusinessAccess(businessId)
    if (!session || session.role !== 'admin') {
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
