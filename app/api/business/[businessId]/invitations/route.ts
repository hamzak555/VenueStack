import { NextRequest, NextResponse } from 'next/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { createInvitation, getInvitationsByBusiness, getExistingInvitation } from '@/lib/db/invitations'
import { getUserByEmailOrPhone } from '@/lib/db/users'
import { createBusinessUserLink, checkBusinessUserExistsByEmail, checkBusinessUserExistsByPhone } from '@/lib/db/business-users'
import { normalizePhoneNumber, sendSMS } from '@/lib/twilio'
import { getBusinessById } from '@/lib/db/businesses'
import { sendInvitationEmail, sendAddedToBusinessEmail } from '@/lib/sendgrid'
import { canAccessSection, canInviteRole, VALID_ROLES, type BusinessRole } from '@/lib/auth/roles'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const invitations = await getInvitationsByBusiness(businessId)

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    let { email, phone, role } = body

    // At least one of email or phone is required
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Either email or phone is required' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(role as BusinessRole)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Check if user can invite this role (manager cannot invite owner)
    if (!canInviteRole(session.role as BusinessRole, role as BusinessRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to invite users with this role' },
        { status: 403 }
      )
    }

    // Normalize phone if provided
    if (phone) {
      phone = normalizePhoneNumber(phone)
    }

    // Normalize email if provided
    if (email) {
      email = email.toLowerCase()
    }

    // Check if user is already a member of this business
    if (email) {
      const alreadyMember = await checkBusinessUserExistsByEmail(email, businessId)
      if (alreadyMember) {
        return NextResponse.json(
          { error: 'This user is already a member of this business' },
          { status: 409 }
        )
      }
    }

    if (phone) {
      const alreadyMember = await checkBusinessUserExistsByPhone(phone, businessId)
      if (alreadyMember) {
        return NextResponse.json(
          { error: 'This user is already a member of this business' },
          { status: 409 }
        )
      }
    }

    // Check if there's already a pending invitation
    const existingInvite = await getExistingInvitation(businessId, email, phone)
    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email/phone' },
        { status: 409 }
      )
    }

    // Check if user already exists in the system
    const existingUser = await getUserByEmailOrPhone(email, phone)

    if (existingUser) {
      // User exists - auto-link them to the business
      const businessUser = await createBusinessUserLink({
        user_id: existingUser.id,
        business_id: businessId,
        role,
      })

      const business = await getBusinessById(businessId)

      // Send email notification if user has email
      if (existingUser.email) {
        sendAddedToBusinessEmail({
          to: existingUser.email,
          businessName: business.name,
          role,
          themeColor: business.theme_color,
        }).catch(err => console.error('Failed to send added-to-business email:', err))
      }

      // Send SMS notification if user has a phone number
      if (existingUser.phone) {
        const message = `You've been added to ${business.name} on VenueStack. Log in at venuestack.io to access your dashboard.`
        sendSMS(existingUser.phone, message).catch(err => console.error('Failed to send added-to-business SMS:', err))
      }

      return NextResponse.json({
        success: true,
        autoLinked: true,
        message: 'User has been added to your business',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      }, { status: 201 })
    }

    // User doesn't exist - create invitation
    const invitation = await createInvitation({
      business_id: businessId,
      email,
      phone,
      role,
      invited_by: session.userId,
    })

    const business = await getBusinessById(businessId)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'}/invite/${invitation.token}`

    // Send invitation email if email is provided
    if (email) {
      sendInvitationEmail({
        to: email,
        businessName: business.name,
        inviteUrl,
        role,
      }).catch(err => console.error('Failed to send invitation email:', err))
    }

    // Send invitation SMS if phone is provided
    if (phone) {
      const message = `You've been invited to join ${business.name} on VenueStack. Accept your invitation: ${inviteUrl}`
      sendSMS(phone, message).catch(err => console.error('Failed to send invitation SMS:', err))
    }

    return NextResponse.json({
      success: true,
      autoLinked: false,
      message: 'Invitation sent',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        phone: invitation.phone,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating invitation:', error)

    // Check for duplicate constraint
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'This user is already associated with this business' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
