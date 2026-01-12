import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getEventById } from '@/lib/db/events'
import { getTicketTypes } from '@/lib/db/ticket-types'
import { getPromoCodeById } from '@/lib/db/promo-codes'
import { Button } from '@/components/ui/button'
import { PromoCodeForm } from '@/components/business/promo-code-form'

export const dynamic = 'force-dynamic'

interface EditPromoCodePageProps {
  params: Promise<{
    businessSlug: string
    eventId: string
    promoCodeId: string
  }>
}

export default async function EditPromoCodePage({ params }: EditPromoCodePageProps) {
  const { businessSlug, eventId, promoCodeId } = await params

  const [event, ticketTypes, promoCode] = await Promise.all([
    getEventById(eventId),
    getTicketTypes(eventId),
    getPromoCodeById(promoCodeId),
  ])

  if (!promoCode) {
    notFound()
  }

  // Verify the promo code belongs to this event
  if (promoCode.event_id !== eventId) {
    notFound()
  }

  // Check if this is a recurring event
  let isRecurringEvent = !!event.parent_event_id
  if (!isRecurringEvent && event.recurrence_rule) {
    isRecurringEvent = event.recurrence_rule.type !== 'none'
  }
  if (event.parent_event_id && !event.recurrence_rule) {
    try {
      const parentEvent = await getEventById(event.parent_event_id)
      if (parentEvent?.recurrence_rule && parentEvent.recurrence_rule.type !== 'none') {
        isRecurringEvent = true
      }
    } catch (error) {
      // Parent event not found, continue
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessSlug}/dashboard/events/${eventId}?tab=promo`}>
            ← Back to Promo Codes
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Promo Code</h1>
      </div>

      <PromoCodeForm
        eventId={eventId}
        businessId={event.business_id}
        businessSlug={businessSlug}
        ticketTypes={ticketTypes}
        isRecurringEvent={isRecurringEvent}
        initialData={{
          id: promoCode.id,
          code: promoCode.code,
          discount_type: promoCode.discount_type,
          discount_value: promoCode.discount_value,
          max_uses: promoCode.max_uses,
          valid_from: promoCode.valid_from,
          valid_until: promoCode.valid_until,
          is_active: promoCode.is_active,
          ticket_type_ids: promoCode.ticket_type_ids,
        }}
      />
    </div>
  )
}
