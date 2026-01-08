import { NextRequest, NextResponse } from 'next/server'
import { getPromoCodeById, updatePromoCode, deletePromoCode, type PromoCodeInsert } from '@/lib/db/promo-codes'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    eventId: string
    promoCodeId: string
  }>
}

// Helper function to get series event IDs
async function getSeriesEventIds(supabase: any, eventId: string): Promise<string[]> {
  const { data: event } = await supabase
    .from('events')
    .select('parent_event_id')
    .eq('id', eventId)
    .single()

  if (!event) return []

  const isRecurringInstance = !!event.parent_event_id
  const parentId = isRecurringInstance ? event.parent_event_id : eventId

  let seriesEventIds: string[] = []

  if (isRecurringInstance) {
    const { data: siblingInstances } = await supabase
      .from('events')
      .select('id')
      .eq('parent_event_id', parentId)
      .neq('id', eventId)

    if (siblingInstances) {
      seriesEventIds = siblingInstances.map((e: any) => e.id)
    }
    if (parentId) {
      seriesEventIds.push(parentId)
    }
  } else {
    const { data: instances } = await supabase
      .from('events')
      .select('id')
      .eq('parent_event_id', eventId)

    if (instances) {
      seriesEventIds = instances.map((e: any) => e.id)
    }
  }

  return seriesEventIds
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { promoCodeId } = await context.params
    const promoCode = await getPromoCodeById(promoCodeId)

    if (!promoCode) {
      return NextResponse.json(
        { error: 'Promo code not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(promoCode)
  } catch (error) {
    console.error('Error fetching promo code:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo code' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { eventId, promoCodeId } = await context.params
    const body = await request.json()
    const { propagateToSeries, ...updateData } = body

    // Get the current promo code to know the original code for matching
    const currentPromoCode = await getPromoCodeById(promoCodeId)
    const originalCode = currentPromoCode?.code

    const updates: Partial<PromoCodeInsert> = {
      code: updateData.code,
      discount_type: updateData.discount_type,
      discount_value: updateData.discount_value,
      max_uses: updateData.max_uses || null,
      valid_from: updateData.valid_from || null,
      valid_until: updateData.valid_until || null,
      is_active: updateData.is_active,
      ticket_type_ids: updateData.ticket_type_ids || null,
    }

    const promoCode = await updatePromoCode(promoCodeId, updates)

    // If propagating to series, update matching promo codes in all related events
    if (propagateToSeries && originalCode) {
      const supabase = await createClient()
      const seriesEventIds = await getSeriesEventIds(supabase, eventId)

      if (seriesEventIds.length > 0) {
        // Update promo codes with matching code in related events
        // Only update template fields, not usage counts
        const seriesUpdates: Record<string, any> = {}
        if (updateData.code !== undefined) seriesUpdates.code = updateData.code
        if (updateData.discount_type !== undefined) seriesUpdates.discount_type = updateData.discount_type
        if (updateData.discount_value !== undefined) seriesUpdates.discount_value = updateData.discount_value
        if (updateData.max_uses !== undefined) seriesUpdates.max_uses = updateData.max_uses
        if (updateData.valid_from !== undefined) seriesUpdates.valid_from = updateData.valid_from
        if (updateData.valid_until !== undefined) seriesUpdates.valid_until = updateData.valid_until
        if (updateData.is_active !== undefined) seriesUpdates.is_active = updateData.is_active

        if (Object.keys(seriesUpdates).length > 0) {
          await supabase
            .from('promo_codes')
            .update(seriesUpdates)
            .eq('code', originalCode)
            .in('event_id', seriesEventIds)
        }
      }
    }

    return NextResponse.json(promoCode)
  } catch (error) {
    console.error('Error updating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to update promo code' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { eventId, promoCodeId } = await context.params
    const { searchParams } = new URL(request.url)
    const propagateToSeries = searchParams.get('propagateToSeries') === 'true'

    const supabase = await createClient()

    // Get the promo code before deleting to know the code for matching
    const promoCode = await getPromoCodeById(promoCodeId)

    // If propagating to series, delete matching promo codes from all related events
    if (propagateToSeries && promoCode) {
      const seriesEventIds = await getSeriesEventIds(supabase, eventId)

      if (seriesEventIds.length > 0) {
        await supabase
          .from('promo_codes')
          .delete()
          .eq('code', promoCode.code)
          .in('event_id', seriesEventIds)
      }
    }

    // Delete the original promo code
    await deletePromoCode(promoCodeId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting promo code:', error)
    return NextResponse.json(
      { error: 'Failed to delete promo code' },
      { status: 500 }
    )
  }
}
