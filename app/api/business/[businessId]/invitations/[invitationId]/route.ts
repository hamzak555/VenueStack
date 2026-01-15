import { NextRequest, NextResponse } from 'next/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { deleteInvitation, resendInvitation } from '@/lib/db/invitations'
import { createClient } from '@/lib/supabase/server'
import { canAccessSection, type BusinessRole } from '@/lib/auth/roles'
import { sendInvitationEmail } from '@/lib/sendgrid'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; invitationId: string }> }
) {
  try {
    const { businessId, invitationId } = await params

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Verify the invitation belongs to this business
    const supabase = await createClient()
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, business_id')
      .eq('id', invitationId)
      .single()

    if (!invitation || invitation.business_id !== businessId) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    await deleteInvitation(invitationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; invitationId: string }> }
) {
  try {
    const { businessId, invitationId } = await params
    const body = await request.json()
    const { action } = body

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Verify the invitation belongs to this business
    const supabase = await createClient()
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, business_id, status')
      .eq('id', invitationId)
      .single()

    if (!invitation || invitation.business_id !== businessId) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only resend pending invitations' },
        { status: 400 }
      )
    }

    if (action === 'resend') {
      const updated = await resendInvitation(invitationId)

      // Send invitation email if email exists
      if (updated.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
        const inviteUrl = `${appUrl}/invitations/${updated.token}`

        sendInvitationEmail({
          to: updated.email,
          businessName: updated.business?.name || 'a business',
          inviteUrl,
          role: updated.role as BusinessRole,
        }).catch(err => console.error('Failed to send invitation email:', err))
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation resent',
        invitation: {
          id: updated.id,
          email: updated.email,
          phone: updated.phone,
          expires_at: updated.expires_at,
        },
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to update invitation' },
      { status: 500 }
    )
  }
}
