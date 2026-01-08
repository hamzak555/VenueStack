import { NextRequest, NextResponse } from 'next/server'
import { updateBusiness, getBusinessById } from '@/lib/db/businesses'
import { verifyBusinessAccess } from '@/lib/auth/business-session'

interface RouteContext {
  params: Promise<{
    businessId: string
  }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const body = await request.json()

    // Verify user has access to this business
    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate business exists
    const existingBusiness = await getBusinessById(businessId)
    if (!existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Only allow marketing-related fields to be updated
    const allowedFields = [
      'facebook_pixel_id',
      'google_analytics_id',
      'google_tag_manager_id',
      'google_ads_id',
      'tiktok_pixel_id',
      'custom_header_scripts',
      'purchase_complete_scripts',
    ]

    const updateData: Record<string, string | null> = {}

    for (const field of allowedFields) {
      if (field in body) {
        // Sanitize and validate the values
        const value = body[field]

        if (value === '' || value === null) {
          updateData[field] = null
        } else if (typeof value === 'string') {
          // Basic sanitization - trim whitespace
          updateData[field] = value.trim()

          // Validate specific field formats
          if (field === 'google_analytics_id' && value && !value.match(/^G-[A-Z0-9]+$/i)) {
            // Allow but warn - some users might have older UA format
          }

          if (field === 'google_tag_manager_id' && value && !value.match(/^GTM-[A-Z0-9]+$/i)) {
            return NextResponse.json(
              { error: 'Invalid Google Tag Manager ID format. Should be like GTM-XXXXXXX' },
              { status: 400 }
            )
          }

          if (field === 'google_ads_id' && value && !value.match(/^AW-[0-9]+$/i)) {
            return NextResponse.json(
              { error: 'Invalid Google Ads ID format. Should be like AW-XXXXXXXXX' },
              { status: 400 }
            )
          }
        }
      }
    }

    // Update the business
    const updatedBusiness = await updateBusiness(businessId, updateData)

    return NextResponse.json({
      success: true,
      business: updatedBusiness,
    })
  } catch (error) {
    console.error('Error updating marketing settings:', error)
    return NextResponse.json(
      { error: 'Failed to update marketing settings' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params

    // Verify user has access to this business
    const session = await verifyBusinessAccess(businessId)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const business = await getBusinessById(businessId)
    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      facebook_pixel_id: business.facebook_pixel_id,
      google_analytics_id: business.google_analytics_id,
      google_tag_manager_id: business.google_tag_manager_id,
      google_ads_id: business.google_ads_id,
      tiktok_pixel_id: business.tiktok_pixel_id,
      custom_header_scripts: business.custom_header_scripts,
      purchase_complete_scripts: business.purchase_complete_scripts,
    })
  } catch (error) {
    console.error('Error fetching marketing settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch marketing settings' },
      { status: 500 }
    )
  }
}
