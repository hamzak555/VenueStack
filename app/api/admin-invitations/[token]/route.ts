import { NextRequest, NextResponse } from 'next/server'
import { getAdminInvitationByToken, acceptAdminInvitation } from '@/lib/db/admin-invitations'
import { createUser, getUserByEmail, getUserByPhone } from '@/lib/db/users'
import { normalizePhoneNumber } from '@/lib/twilio'

interface RouteContext {
  params: Promise<{
    token: string
  }>
}

/**
 * GET /api/admin-invitations/[token]
 * Get admin invitation details by token
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params

    const invitation = await getAdminInvitationByToken(token)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has been ${invitation.status}` },
        { status: 400 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      phone: invitation.phone,
      expires_at: invitation.expires_at,
    })
  } catch (error) {
    console.error('Error fetching admin invitation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin-invitations/[token]
 * Accept admin invitation and create/update user
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const body = await request.json()
    const { name, password, email, phone } = body

    const invitation = await getAdminInvitationByToken(token)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has been ${invitation.status}` },
        { status: 400 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Validate required fields for new users
    if (!name || !password) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Use email/phone from invitation or from request
    const finalEmail = email || invitation.email
    const finalPhone = phone ? normalizePhoneNumber(phone) : invitation.phone

    if (!finalEmail || !finalPhone) {
      return NextResponse.json(
        { error: 'Both email and phone are required' },
        { status: 400 }
      )
    }

    // Check if email is already in use
    const existingUserByEmail = await getUserByEmail(finalEmail)
    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'This email is already in use' },
        { status: 409 }
      )
    }

    // Check if phone is already in use
    const existingUserByPhone = await getUserByPhone(finalPhone)
    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'This phone number is already in use' },
        { status: 409 }
      )
    }

    // Create new user as platform admin
    const user = await createUser({
      email: finalEmail,
      phone: finalPhone,
      password,
      name,
      is_platform_admin: true,
    })

    // Mark invitation as accepted
    await acceptAdminInvitation(token)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error) {
    console.error('Error accepting admin invitation:', error)

    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'A user with this email or phone already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
