import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { cancelAdminInvitation, deleteAdminInvitation } from '@/lib/db/admin-invitations'

interface RouteContext {
  params: Promise<{
    invitationId: string
  }>
}

/**
 * DELETE /api/admin/invitations/[invitationId]
 * Cancel/delete an admin invitation
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { invitationId } = await context.params

    await deleteAdminInvitation(invitationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting admin invitation:', error)
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 }
    )
  }
}
