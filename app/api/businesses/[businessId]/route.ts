import { NextRequest, NextResponse } from 'next/server'
import { updateBusiness, getBusinessById } from '@/lib/db/businesses'

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
