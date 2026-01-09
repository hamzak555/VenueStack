import { NextRequest, NextResponse } from 'next/server'
import { getPlatformSettings, updatePlatformSettings } from '@/lib/db/platform-settings'
import { verifyAdminAccess } from '@/lib/auth/admin-session'

export async function GET() {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await getPlatformSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching platform settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifyAdminAccess()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, any> = {}

    // Handle fee settings
    if (body.platform_fee_type !== undefined) {
      updates.platform_fee_type = body.platform_fee_type
    }
    if (body.flat_fee_amount !== undefined) {
      updates.flat_fee_amount = body.flat_fee_amount
    }
    if (body.percentage_fee !== undefined) {
      updates.percentage_fee = body.percentage_fee
    }
    if (body.platform_stripe_account_id !== undefined) {
      updates.platform_stripe_account_id = body.platform_stripe_account_id
    }

    // Handle subscription settings
    if (body.subscription_monthly_fee !== undefined) {
      const fee = Number(body.subscription_monthly_fee)
      if (isNaN(fee) || fee < 0) {
        return NextResponse.json({ error: 'Invalid monthly fee' }, { status: 400 })
      }
      updates.subscription_monthly_fee = fee
    }
    if (body.subscription_trial_days !== undefined) {
      const days = Number(body.subscription_trial_days)
      if (isNaN(days) || days < 0 || !Number.isInteger(days)) {
        return NextResponse.json({ error: 'Invalid trial days' }, { status: 400 })
      }
      updates.subscription_trial_days = days
    }
    if (body.stripe_subscription_product_id !== undefined) {
      updates.stripe_subscription_product_id = body.stripe_subscription_product_id
    }
    if (body.stripe_subscription_price_id !== undefined) {
      updates.stripe_subscription_price_id = body.stripe_subscription_price_id
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const settings = await updatePlatformSettings(updates)

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating platform settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    )
  }
}
