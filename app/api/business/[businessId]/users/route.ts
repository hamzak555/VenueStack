import { NextRequest, NextResponse } from 'next/server'
import { getBusinessUsers, createBusinessUser } from '@/lib/db/business-users'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { createClient } from '@/lib/supabase/server'
import { canAccessSection, VALID_ROLES, type BusinessRole } from '@/lib/auth/roles'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')

    // Verify access - only owner and manager can access users
    const session = await verifyBusinessAccess(businessId)
    if (!session || !canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Fetch business users with joined user data for those linked to global users
    const supabase = await createClient()
    let query = supabase
      .from('business_users')
      .select(`
        id,
        user_id,
        business_id,
        email,
        name,
        phone,
        role,
        is_active,
        created_at,
        user:users(id, email, phone, name)
      `)
      .eq('business_id', businessId)

    // Filter by role if specified
    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    const { data: users, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // Map users to use global user data when available
    const safeUsers = users.map((bu: any) => {
      const globalUser = bu.user
      return {
        id: bu.id,
        user_id: bu.user_id,
        business_id: bu.business_id,
        // Use global user data if available, fall back to business_users data
        email: globalUser?.email || bu.email,
        name: globalUser?.name || bu.name,
        phone: globalUser?.phone || bu.phone,
        role: bu.role,
        is_active: bu.is_active,
        created_at: bu.created_at,
      }
    })

    return NextResponse.json(safeUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
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
    const { email, password, name, phone, role } = body

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, password, name, and role are required' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(role as BusinessRole)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const user = await createBusinessUser({
      user_id: null, // Legacy: will be replaced by invitation flow
      business_id: businessId,
      email,
      password,
      name,
      phone: phone || null,
      role,
      is_active: true,
    })

    // Remove password hash from response
    const { password_hash, ...safeUser } = user

    return NextResponse.json(safeUser, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)

    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'A user with this email already exists for this business' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
