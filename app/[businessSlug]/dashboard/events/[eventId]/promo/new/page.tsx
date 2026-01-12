import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PromoCodeForm } from '@/components/business/promo-code-form'
import { getEventById } from '@/lib/db/events'
import { getTicketTypes } from '@/lib/db/ticket-types'

export const dynamic = 'force-dynamic'

interface NewPromoCodePageProps {
  params: Promise<{
    businessSlug: string
    eventId: string
  }>
}

export default async function NewPromoCodePage({ params }: NewPromoCodePageProps) {
  const { businessSlug, eventId } = await params

  let event
  try {
    event = await getEventById(eventId)
  } catch (error) {
    notFound()
  }

  const ticketTypes = await getTicketTypes(eventId)

  // Check if this is a recurring event (has recurrence_rule or is an instance)
  let isRecurringEvent = !!event.parent_event_id
  if (!isRecurringEvent && event.recurrence_rule) {
    isRecurringEvent = event.recurrence_rule.type !== 'none'
  }
  // If it's an instance, check parent for recurrence rule
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
            ← Back to Event
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Promo Code</h1>
      </div>

      <PromoCodeForm
        eventId={eventId}
        businessId={event.business_id}
        businessSlug={businessSlug}
        ticketTypes={ticketTypes}
        isRecurringEvent={isRecurringEvent}
      />
    </div>
  )
}
