import { NextRequest, NextResponse } from 'next/server'
import { getInvitationByToken, acceptInvitation } from '@/lib/db/invitations'
import { createUser, getUserByEmailOrPhone } from '@/lib/db/users'
import { createBusinessUserLink, checkBusinessUserExists } from '@/lib/db/business-users'
import { normalizePhoneNumber } from '@/lib/twilio'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { name, password, email: newEmail, phone: newPhone } = body

    // Get the invitation
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

    // Use provided email/phone or fall back to invitation values
    const email = newEmail?.toLowerCase() || invitation.email
    const phone = newPhone ? normalizePhoneNumber(newPhone) : invitation.phone

    // Check if user already exists
    let user = await getUserByEmailOrPhone(email || undefined, phone || undefined)

    if (user) {
      // User exists - check if they're already linked to this business
      const alreadyLinked = await checkBusinessUserExists(user.id, invitation.business_id)
      
      if (alreadyLinked) {
        // Mark invitation as accepted anyway
        await acceptInvitation(token)
        
        return NextResponse.json({
          success: true,
          message: 'You are already a member of this business',
          alreadyMember: true,
          businessSlug: invitation.business?.slug,
        })
      }
    } else {
      // New user - validate required fields
      if (!name || !password) {
        return NextResponse.json(
          { error: 'Name and password are required for new users' },
          { status: 400 }
        )
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        )
      }

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 }
        )
      }

      // Create the user
      user = await createUser({
        email,
        phone,
        password,
        name,
      })
    }

    // Link user to business
    await createBusinessUserLink({
      user_id: user.id,
      business_id: invitation.business_id,
      role: invitation.role,
    })

    // Mark invitation as accepted
    await acceptInvitation(token)

    return NextResponse.json({
      success: true,
      message: 'Welcome! You have been added to the business',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      businessSlug: invitation.business?.slug,
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)

    // Check for duplicate constraint
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'An account with this email or phone already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
