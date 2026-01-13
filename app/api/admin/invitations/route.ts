import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import {
  createAdminInvitation,
  getPendingAdminInvitations,
  getExistingAdminInvitation,
} from '@/lib/db/admin-invitations'
import { getUserByEmailOrPhone, setPlatformAdmin, getPlatformAdminByEmail } from '@/lib/db/users'
import { normalizePhoneNumber, sendSMS } from '@/lib/twilio'
import { sendInvitationEmail } from '@/lib/sendgrid'

/**
 * GET /api/admin/invitations
 * Get all pending admin invitations
 */
export async function GET() {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const invitations = await getPendingAdminInvitations()

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching admin invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/invitations
 * Create a new admin invitation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    let { email, phone } = body

    // At least one of email or phone is required
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Either email or phone is required' },
        { status: 400 }
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

    // Check if user is already a platform admin
    if (email) {
      const existingAdmin = await getPlatformAdminByEmail(email)
      if (existingAdmin) {
        return NextResponse.json(
          { error: 'This user is already a platform admin' },
          { status: 409 }
        )
      }
    }

    // Check if there's already a pending invitation
    const existingInvite = await getExistingAdminInvitation(email, phone)
    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email/phone' },
        { status: 409 }
      )
    }

    // Check if user already exists in the system
    const existingUser = await getUserByEmailOrPhone(email, phone)

    if (existingUser) {
      // User exists - auto-promote them to platform admin
      await setPlatformAdmin(existingUser.id, true)

      // Send notification email if user has email
      if (existingUser.email) {
        const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
        // We'll reuse the sendInvitationEmail but with a different message
        // For now, just log it
        console.log(`User ${existingUser.email} promoted to platform admin`)
      }

      // Send SMS notification if user has a phone number
      if (existingUser.phone) {
        const message = `You've been granted admin access to VenueStack. Log in at venuestack.io to access the admin dashboard.`
        sendSMS(existingUser.phone, message).catch(err => console.error('Failed to send admin promotion SMS:', err))
      }

      return NextResponse.json({
        success: true,
        autoPromoted: true,
        message: 'User has been promoted to platform admin',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      }, { status: 201 })
    }

    // User doesn't exist - create invitation
    const invitation = await createAdminInvitation({
      email,
      phone,
      invited_by: session.userId,
    })

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'}/admin-invite/${invitation.token}`

    // Send invitation email if email is provided
    if (email) {
      sendInvitationEmail({
        to: email,
        businessName: 'VenueStack Admin',
        inviteUrl,
        role: 'owner', // Platform admins get owner-level access
      }).catch(err => console.error('Failed to send admin invitation email:', err))
    }

    // Send invitation SMS if phone is provided
    if (phone) {
      const message = `You've been invited to become a VenueStack admin. Accept your invitation: ${inviteUrl}`
      sendSMS(phone, message).catch(err => console.error('Failed to send admin invitation SMS:', err))
    }

    return NextResponse.json({
      success: true,
      autoPromoted: false,
      message: 'Invitation sent',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        phone: invitation.phone,
        expires_at: invitation.expires_at,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating admin invitation:', error)

    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'This user already has a pending invitation' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
