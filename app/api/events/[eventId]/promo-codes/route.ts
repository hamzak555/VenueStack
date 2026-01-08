import { NextRequest, NextResponse } from 'next/server'
import { createPromoCode, getPromoCodesByEventId, type PromoCodeInsert } from '@/lib/db/promo-codes'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    eventId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const promoCodes = await getPromoCodesByEventId(eventId)

    return NextResponse.json(promoCodes)
  } catch (error) {
    console.error('Error fetching promo codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const body = await request.json()
    const { propagateToSeries, ...promoData } = body

    const promoCodeData: PromoCodeInsert = {
      event_id: eventId,
      code: promoData.code,
      discount_type: promoData.discount_type,
      discount_value: promoData.discount_value,
      max_uses: promoData.max_uses || null,
      valid_from: promoData.valid_from || null,
      valid_until: promoData.valid_until || null,
      is_active: promoData.is_active ?? true,
      ticket_type_ids: promoData.ticket_type_ids || null,
    }

    const promoCode = await createPromoCode(promoCodeData)

    // If propagating to series, create the same promo code for all related events
    if (propagateToSeries) {
      const supabase = await createClient()

      const { data: event } = await supabase
        .from('events')
        .select('parent_event_id')
        .eq('id', eventId)
        .single()

      if (event) {
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
            seriesEventIds = siblingInstances.map(e => e.id)
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
            seriesEventIds = instances.map(e => e.id)
          }
        }

        // Create promo code for all related events
        if (seriesEventIds.length > 0) {
          const promoCodesToCreate = seriesEventIds.map(relatedEventId => ({
            event_id: relatedEventId,
            code: promoData.code,
            discount_type: promoData.discount_type,
            discount_value: promoData.discount_value,
            max_uses: promoData.max_uses || null,
            current_uses: 0,
            valid_from: promoData.valid_from || null,
            valid_until: promoData.valid_until || null,
            is_active: promoData.is_active ?? true,
            ticket_type_ids: null, // Reset ticket_type_ids as they're event-specific
          }))

          await supabase.from('promo_codes').insert(promoCodesToCreate)
        }
      }
    }

    return NextResponse.json(promoCode, { status: 201 })
  } catch (error) {
    console.error('Error creating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to create promo code' },
      { status: 500 }
    )
  }
}
