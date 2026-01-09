import { NextRequest, NextResponse } from 'next/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import {
  getTrackingLinkById,
  updateTrackingLink,
  deleteTrackingLink,
  isRefCodeUnique,
} from '@/lib/db/tracking-links'

interface RouteContext {
  params: Promise<{
    businessId: string
    linkId: string
  }>
}

// Validate ref code format: alphanumeric, hyphens, underscores only
function isValidRefCode(refCode: string): boolean {
  return /^[a-z0-9_-]+$/i.test(refCode) && refCode.length <= 50
}

const RESERVED_REF_CODES = ['checkout', 'success', 'events', 'dashboard', 'login', 'logout']

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { businessId, linkId } = await context.params

    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const trackingLink = await getTrackingLinkById(linkId)
    if (!trackingLink || trackingLink.business_id !== businessId) {
      return NextResponse.json({ error: 'Tracking link not found' }, { status: 404 })
    }

    return NextResponse.json({ trackingLink })
  } catch (error) {
    console.error('Error fetching tracking link:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking link' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { businessId, linkId } = await context.params
    const body = await request.json()

    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingLink = await getTrackingLinkById(linkId)
    if (!existingLink || existingLink.business_id !== businessId) {
      return NextResponse.json({ error: 'Tracking link not found' }, { status: 404 })
    }

    const updates: Record<string, any> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updates.name = body.name.trim()
    }

    if (body.ref_code !== undefined) {
      const normalizedRefCode = body.ref_code.toLowerCase().trim()

      if (!isValidRefCode(normalizedRefCode)) {
        return NextResponse.json(
          { error: 'Ref code can only contain letters, numbers, hyphens, and underscores (max 50 characters)' },
          { status: 400 }
        )
      }

      if (RESERVED_REF_CODES.includes(normalizedRefCode)) {
        return NextResponse.json(
          { error: 'This ref code is reserved and cannot be used' },
          { status: 400 }
        )
      }

      // Check uniqueness only if ref_code is being changed
      if (normalizedRefCode !== existingLink.ref_code) {
        const isUnique = await isRefCodeUnique(businessId, normalizedRefCode, linkId)
        if (!isUnique) {
          return NextResponse.json(
            { error: 'A tracking link with this ref code already exists' },
            { status: 400 }
          )
        }
      }

      updates.ref_code = normalizedRefCode
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null
    }

    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active)
    }

    const trackingLink = await updateTrackingLink(linkId, updates)

    return NextResponse.json({ trackingLink })
  } catch (error) {
    console.error('Error updating tracking link:', error)
    return NextResponse.json(
      { error: 'Failed to update tracking link' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { businessId, linkId } = await context.params

    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingLink = await getTrackingLinkById(linkId)
    if (!existingLink || existingLink.business_id !== businessId) {
      return NextResponse.json({ error: 'Tracking link not found' }, { status: 404 })
    }

    await deleteTrackingLink(linkId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tracking link:', error)
    return NextResponse.json(
      { error: 'Failed to delete tracking link' },
      { status: 500 }
    )
  }
}
