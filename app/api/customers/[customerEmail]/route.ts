import { NextRequest, NextResponse } from 'next/server'
import { getBusinessSession } from '@/lib/auth/business-session'
import {
  getCustomerWithRatings,
  getCustomerReservations,
  getCustomerTicketPurchases,
} from '@/lib/db/customers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerEmail: string }> }
) {
  try {
    const session = await getBusinessSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerEmail } = await params
    const decodedIdentifier = decodeURIComponent(customerEmail)

    // Check if the identifier looks like a phone number (contains digits, +, or -)
    // Phone numbers are the primary identifier, email is fallback for customers without phone
    const isPhone = /^[\d\s\-+()]+$/.test(decodedIdentifier) && decodedIdentifier.length >= 7

    // Build the identifier object
    const identifier = isPhone
      ? { phone: decodedIdentifier }
      : { email: decodedIdentifier }

    // Get the customer with all their known emails
    const customer = await getCustomerWithRatings(session.businessId, identifier)

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Build identifier for reservations/tickets lookup
    // Use phone if available, otherwise use emails
    const lookupIdentifier = customer.phone
      ? { phone: customer.phone }
      : { emails: customer.emails.length > 0 ? customer.emails : [decodedIdentifier.toLowerCase()] }

    const [reservations, tickets] = await Promise.all([
      getCustomerReservations(session.businessId, lookupIdentifier),
      getCustomerTicketPurchases(session.businessId, lookupIdentifier),
    ])

    return NextResponse.json({
      customer,
      reservations,
      tickets,
    })
  } catch (error) {
    console.error('Error fetching customer details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
