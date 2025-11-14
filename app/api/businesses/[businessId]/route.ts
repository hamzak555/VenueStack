import { NextRequest, NextResponse } from 'next/server'
import { updateBusiness, getBusinessById, getBusinessBySlug } from '@/lib/db/businesses'

interface RouteContext {
  params: Promise<{
    businessId: string
  }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params
    const body = await request.json()

    // Validate business exists
    const existingBusiness = await getBusinessById(businessId)
    if (!existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Validate slug if it's being updated
    if (body.slug && body.slug !== existingBusiness.slug) {
      // Check slug format
      if (!/^[a-z0-9-]+$/.test(body.slug)) {
        return NextResponse.json(
          { error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
          { status: 400 }
        )
      }

      if (body.slug.length < 3) {
        return NextResponse.json(
          { error: 'Slug must be at least 3 characters long' },
          { status: 400 }
        )
      }

      // Check if slug is already taken by another business
      try {
        const slugCheck = await getBusinessBySlug(body.slug)
        if (slugCheck && slugCheck.id !== businessId) {
          return NextResponse.json(
            { error: 'This URL slug is already taken by another business' },
            { status: 400 }
          )
        }
      } catch (error) {
        // Slug doesn't exist, which is good
      }
    }

    // Validate stripe_fee_payer if it's being updated
    if (body.stripe_fee_payer && !['customer', 'business'].includes(body.stripe_fee_payer)) {
      return NextResponse.json(
        { error: 'Invalid stripe_fee_payer value. Must be "customer" or "business"' },
        { status: 400 }
      )
    }

    // Validate platform_fee_payer if it's being updated
    if (body.platform_fee_payer && !['customer', 'business'].includes(body.platform_fee_payer)) {
      return NextResponse.json(
        { error: 'Invalid platform_fee_payer value. Must be "customer" or "business"' },
        { status: 400 }
      )
    }

    // Validate tax_percentage if it's being updated
    if (body.tax_percentage !== undefined) {
      const taxValue = parseFloat(body.tax_percentage)
      if (isNaN(taxValue) || taxValue < 0 || taxValue > 100) {
        return NextResponse.json(
          { error: 'Invalid tax_percentage value. Must be between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Update the business
    const updatedBusiness = await updateBusiness(businessId, body)

    return NextResponse.json(updatedBusiness)
  } catch (error) {
    console.error('Error updating business:', error)
    return NextResponse.json(
      { error: 'Failed to update business' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { businessId } = await context.params

    // Validate business exists
    const existingBusiness = await getBusinessById(businessId)
    if (!existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Import here to avoid circular dependencies
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Check if business has any events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .eq('business_id', businessId)
      .limit(1)

    if (eventsError) throw eventsError

    if (events && events.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete business with existing events. Please delete all events first.' },
        { status: 400 }
      )
    }

    // Import deleteBusiness function
    const { deleteBusiness } = await import('@/lib/db/businesses')

    // Delete the business
    await deleteBusiness(businessId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting business:', error)
    return NextResponse.json(
      { error: 'Failed to delete business' },
      { status: 500 }
    )
  }
}
