import { NextRequest, NextResponse } from 'next/server'
import { getInvitationByToken } from '@/lib/db/invitations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const invitation = await getInvitationByToken(token)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has already been ${invitation.status}` },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        phone: invitation.phone,
        role: invitation.role,
        expires_at: invitation.expires_at,
        business: invitation.business,
      },
    })
  } catch (error) {
    console.error('Error fetching invitation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
}
