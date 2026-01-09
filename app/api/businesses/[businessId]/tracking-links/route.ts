import { NextRequest, NextResponse } from 'next/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { getBusinessById } from '@/lib/db/businesses'
import {
  getTrackingLinksByBusinessId,
  createTrackingLink,
  isRefCodeUnique,
} from '@/lib/db/tracking-links'

interface RouteContext {
  params: Promise<{
    businessId: string
  }>
}

// Validate ref code format: alphanumeric, hyphens, underscores only
function isValidRefCode(refCode: string): boolean {
  return /^[a-z0-9_-]+$/i.test(refCode) && refCode.length <= 50
}

// Reserved ref codes that cannot be used
const RESERVED_REF_CODES = ['checkout', 'success', 'events', 'dashboard', 'login', 'logout']

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params

    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const trackingLinks = await getTrackingLinksByBusinessId(businessId)

    return NextResponse.json({ trackingLinks })
  } catch (error) {
    console.error('Error fetching tracking links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking links' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const body = await request.json()

    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const business = await getBusinessById(businessId)
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const { name, ref_code, description } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (!ref_code || typeof ref_code !== 'string' || ref_code.trim().length === 0) {
      return NextResponse.json(
        { error: 'Ref code is required' },
        { status: 400 }
      )
    }

    const normalizedRefCode = ref_code.toLowerCase().trim()

    // Validate ref code format
    if (!isValidRefCode(normalizedRefCode)) {
      return NextResponse.json(
        { error: 'Ref code can only contain letters, numbers, hyphens, and underscores (max 50 characters)' },
        { status: 400 }
      )
    }

    // Check reserved words
    if (RESERVED_REF_CODES.includes(normalizedRefCode)) {
      return NextResponse.json(
        { error: 'This ref code is reserved and cannot be used' },
        { status: 400 }
      )
    }

    // Check uniqueness
    const isUnique = await isRefCodeUnique(businessId, normalizedRefCode)
    if (!isUnique) {
      return NextResponse.json(
        { error: 'A tracking link with this ref code already exists' },
        { status: 400 }
      )
    }

    const trackingLink = await createTrackingLink({
      business_id: businessId,
      name: name.trim(),
      ref_code: normalizedRefCode,
      description: description?.trim() || null,
    })

    return NextResponse.json({ trackingLink }, { status: 201 })
  } catch (error) {
    console.error('Error creating tracking link:', error)
    return NextResponse.json(
      { error: 'Failed to create tracking link' },
      { status: 500 }
    )
  }
}
