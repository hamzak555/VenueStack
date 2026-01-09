import { createClient as createServerClient } from '@/lib/supabase/server'
import { Database } from '@/lib/types'

export interface EventWithTicketStats {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  status: string
  total_tickets: number
  scanned_tickets: number
  unscanned_tickets: number
}

export async function getEventsWithTicketStats(businessId: string): Promise<EventWithTicketStats[]> {
  const supabase = await createServerClient()

  // Get all events for the business
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      id,
      title,
      event_date,
      event_time,
      location,
      image_url,
      status
    `)
    .eq('business_id', businessId)
    .order('event_date', { ascending: true })

  if (eventsError || !events) {
    console.error('Error fetching events:', eventsError)
    return []
  }

  const eventIds = events.map(e => e.id)

  // Get ticket types for these events (to filter out events with no ticket types)
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('event_id')
    .in('event_id', eventIds)

  // Get set of event IDs that have ticket types
  const eventsWithTicketTypes = new Set(ticketTypes?.map(tt => tt.event_id) || [])

  // Filter to only include events that have at least one ticket type
  const eventsWithTypes = events.filter(e => eventsWithTicketTypes.has(e.id))
  const filteredEventIds = eventsWithTypes.map(e => e.id)

  // Get tickets for these events
  const { data: tickets } = await supabase
    .from('tickets')
    .select('event_id, checked_in_at')
    .in('event_id', filteredEventIds)

  // Aggregate data per event
  return eventsWithTypes.map(event => {
    const eventTickets = tickets?.filter(t => t.event_id === event.id) || []
    const totalTickets = eventTickets.length
    const scannedTickets = eventTickets.filter(t => t.checked_in_at !== null).length

    return {
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location,
      image_url: event.image_url,
      status: event.status,
      total_tickets: totalTickets,
      scanned_tickets: scannedTickets,
      unscanned_tickets: totalTickets - scannedTickets,
    }
  })
}

export type Ticket = Database['public']['Tables']['tickets']['Row']
export type TicketInsert = Database['public']['Tables']['tickets']['Insert']
export type TicketUpdate = Database['public']['Tables']['tickets']['Update']

/**
 * Generate a unique ticket number
 */
export function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `TKT-${timestamp}-${random}`
}

/**
 * Get all tickets for an event
 */
export async function getTicketsByEventId(eventId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('purchase_date', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Get a ticket by ID
 */
export async function getTicketById(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Get a ticket by ticket number
 */
export async function getTicketByNumber(ticketNumber: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_number', ticketNumber)
    .single()

  if (error) throw error
  return data
}

/**
 * Create a new ticket
 */
export async function createTicket(ticket: Omit<TicketInsert, 'ticket_number'>) {
  const supabase = await createServerClient()

  const ticketWithNumber = {
    ...ticket,
    ticket_number: generateTicketNumber(),
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert(ticketWithNumber)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Create multiple tickets (bulk purchase)
 */
export async function createTickets(
  eventId: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string | null,
  quantity: number
) {
  const supabase = await createServerClient()

  const tickets = Array.from({ length: quantity }, () => ({
    event_id: eventId,
    ticket_number: generateTicketNumber(),
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
  })) as TicketInsert[]

  const { data, error } = await supabase
    .from('tickets')
    .insert(tickets)
    .select()

  if (error) throw error
  return data
}

/**
 * Update a ticket
 */
export async function updateTicket(id: string, updates: TicketUpdate) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Mark ticket as used
 */
export async function markTicketAsUsed(ticketNumber: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tickets')
    .update({ status: 'used' })
    .eq('ticket_number', ticketNumber)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Cancel a ticket
 */
export async function cancelTicket(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get ticket statistics for an event
 */
export async function getTicketStats(eventId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('tickets')
    .select('status')
    .eq('event_id', eventId)

  if (error) throw error

  const stats = {
    total: data.length,
    valid: data.filter((t) => t.status === 'valid').length,
    used: data.filter((t) => t.status === 'used').length,
    cancelled: data.filter((t) => t.status === 'cancelled').length,
  }

  return stats
}

export interface TicketWithDetails {
  id: string
  ticket_number: string
  ticket_type_id: string | null
  price: number
  status: string
  checked_in_at: string | null
  created_at: string
  order_id: string
  order: {
    id: string
    order_number: string
    customer_name: string
    customer_email: string
    customer_phone: string | null
  }
  event: {
    id: string
    title: string
    event_date: string
  }
  ticket_type: {
    name: string
  } | null
}

/**
 * Get all tickets for a business with order and event details
 */
export async function getTicketsByBusinessId(businessId: string, eventId?: string): Promise<TicketWithDetails[]> {
  const supabase = await createServerClient()

  // Get all tickets for events belonging to this business
  let query = supabase
    .from('tickets')
    .select(`
      id,
      ticket_number,
      ticket_type_id,
      price,
      status,
      checked_in_at,
      created_at,
      order_id,
      event_id,
      order:orders!inner (
        id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        event:events!inner (
          id,
          title,
          event_date,
          business_id
        )
      )
    `)
    .eq('order.event.business_id', businessId)
    .order('created_at', { ascending: false })

  // Filter by event if provided
  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data: tickets, error } = await query

  if (error) {
    console.error('Error fetching tickets:', error)
    throw new Error('Failed to fetch tickets')
  }

  if (!tickets || tickets.length === 0) {
    return []
  }

  // Manually fetch ticket types if needed
  const ticketTypeIds = tickets
    .map(t => t.ticket_type_id)
    .filter(Boolean) as string[]

  let ticketTypesMap = new Map<string, { name: string }>()

  if (ticketTypeIds.length > 0) {
    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select('id, name')
      .in('id', ticketTypeIds)

    if (ticketTypes) {
      ticketTypesMap = new Map(ticketTypes.map(tt => [tt.id, { name: tt.name }]))
    }
  }

  // Transform the data to flatten the structure
  return tickets.map(ticket => {
    const order = Array.isArray(ticket.order) ? ticket.order[0] : ticket.order
    const event = Array.isArray(order.event) ? order.event[0] : order.event

    return {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      ticket_type_id: ticket.ticket_type_id,
      price: ticket.price,
      status: ticket.status,
      checked_in_at: ticket.checked_in_at,
      created_at: ticket.created_at,
      order_id: ticket.order_id,
      order: {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
      },
      event: {
        id: event.id,
        title: event.title,
        event_date: event.event_date,
      },
      ticket_type: ticket.ticket_type_id ? ticketTypesMap.get(ticket.ticket_type_id) || null : null,
    }
  })
}
