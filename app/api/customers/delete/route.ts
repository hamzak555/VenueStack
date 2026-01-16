import { NextResponse } from 'next/server'
import { getBusinessSession } from '@/lib/auth/business-session'
import { deleteCustomer } from '@/lib/db/customers'

export async function POST(request: Request) {
  try {
    const session = await getBusinessSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only owners and managers can delete customers
    if (!['owner', 'manager'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Only owners and managers can delete customers' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { identifier } = body

    if (!identifier) {
      return NextResponse.json(
        { error: 'Customer identifier (phone or email) is required' },
        { status: 400 }
      )
    }

    // Identifier should be either { phone: string } or { email: string }
    if (!identifier.phone && !identifier.email) {
      return NextResponse.json(
        { error: 'Invalid identifier - must include phone or email' },
        { status: 400 }
      )
    }

    const result = await deleteCustomer(
      session.businessId,
      identifier.phone ? { phone: identifier.phone } : { email: identifier.email }
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete customer' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Customer data anonymized (${result.anonymizedCount} records updated)`,
      anonymizedCount: result.anonymizedCount,
    })
  } catch (error) {
    console.error('Error in customer delete API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
