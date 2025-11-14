import { createClient as createServerClient } from '@/lib/supabase/server'
import { Database } from '@/lib/types'

export type Event = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

/**
 * Helper function to get price display for an event
 * Returns either a single price or a range based on ticket types
 */
export function getEventPriceDisplay(event: any): string {
  // If event has ticket types, calculate price range
  if (event.ticket_types && Array.isArray(event.ticket_types) && event.ticket_types.length > 0) {
    const activePrices = event.ticket_types
      .filter((tt: any) => tt.is_active)
      .map((tt: any) => tt.price)

    if (activePrices.length === 0) {
      return 'N/A'
    }

    const minPrice = Math.min(...activePrices)
    const maxPrice = Math.max(...activePrices)

    if (minPrice === maxPrice) {
      return `$${minPrice.toFixed(2)}`
    }

    return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
  }

  // Fallback to legacy ticket_price
  if (event.ticket_price != null) {
    return `$${event.ticket_price.toFixed(2)}`
  }

  return 'N/A'
}

/**
 * Helper function to calculate total available tickets for an event
 * Uses ticket types if available, otherwise falls back to event.available_tickets
 */
export function getEventAvailableTickets(event: any): number {
  // If event has ticket types, sum up available quantities
  if (event.ticket_types && Array.isArray(event.ticket_types) && event.ticket_types.length > 0) {
    return event.ticket_types
      .filter((tt: any) => tt.is_active)
      .reduce((sum: number, tt: any) => sum + tt.available_quantity, 0)
  }

  // Fallback to legacy available_tickets
  return event.available_tickets || 0
}

/**
 * Helper function to calculate total tickets for an event
 * Uses ticket types if available, otherwise falls back to event.total_tickets
 */
export function getEventTotalTickets(event: any): number {
  // If event has ticket types, sum up total quantities
  if (event.ticket_types && Array.isArray(event.ticket_types) && event.ticket_types.length > 0) {
    return event.ticket_types
      .filter((tt: any) => tt.is_active)
      .reduce((sum: number, tt: any) => sum + tt.total_quantity, 0)
  }

  // Fallback to legacy total_tickets
  return event.total_tickets || 0
}

/**
 * Get all events for a business
 */
export async function getEventsByBusinessId(businessId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      ticket_types (
        id,
        name,
        price,
        total_quantity,
        available_quantity,
        is_active
      )
    `)
    .eq('business_id', businessId)
    .order('event_date', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Get published events for a business (public-facing)
 */
export async function getPublishedEventsByBusinessId(businessId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      ticket_types (
        id,
        name,
        price,
        total_quantity,
        available_quantity,
        is_active
      )
    `)
    .eq('business_id', businessId)
    .eq('status', 'published')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Get an event by ID
 */
export async function getEventById(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Create a new event
 */
export async function createEvent(event: EventInsert) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update an event
 */
export async function updateEvent(id: string, updates: EventUpdate) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Update event ticket availability
 */
export async function updateTicketAvailability(
  eventId: string,
  ticketsSold: number
) {
  const supabase = await createServerClient()

  // Get current event
  const event = await getEventById(eventId)

  // Calculate new available tickets
  const newAvailable = event.total_tickets - ticketsSold

  const { data, error } = await supabase
    .from('events')
    .update({ available_tickets: newAvailable })
    .eq('id', eventId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get ticket sales breakdown for an event
 */
export async function getEventTicketSales(eventId: string) {
  const supabase = await createServerClient()

  // Get all orders for this event
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, quantity, ticket_type_id')
    .eq('event_id', eventId)
    .eq('status', 'completed')

  if (error) throw error

  // Calculate totals
  let totalSold = 0
  const ticketTypeBreakdown: Record<string, { name: string; quantity: number }> = {}

  // Get ticket type names
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, name')
    .eq('event_id', eventId)

  const ticketTypeMap = new Map(ticketTypes?.map(tt => [tt.id, tt.name]) || [])

  for (const order of orders || []) {
    totalSold += order.quantity

    if (order.ticket_type_id) {
      const typeName = ticketTypeMap.get(order.ticket_type_id) || 'Unknown Type'
      if (!ticketTypeBreakdown[order.ticket_type_id]) {
        ticketTypeBreakdown[order.ticket_type_id] = {
          name: typeName,
          quantity: 0
        }
      }
      ticketTypeBreakdown[order.ticket_type_id].quantity += order.quantity
    } else {
      // Legacy tickets without type
      if (!ticketTypeBreakdown['legacy']) {
        ticketTypeBreakdown['legacy'] = {
          name: 'General Admission',
          quantity: 0
        }
      }
      ticketTypeBreakdown['legacy'].quantity += order.quantity
    }
  }

  return {
    totalSold,
    breakdown: Object.values(ticketTypeBreakdown)
  }
}
