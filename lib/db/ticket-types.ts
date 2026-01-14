import { createClient } from '@/lib/supabase/server'

export interface TicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  total_quantity: number
  available_quantity: number
  max_per_customer: number | null
  display_order: number
  is_active: boolean
  sale_start_date: string | null
  sale_end_date: string | null
  created_at: string
  updated_at: string
}

export interface TicketTypeCreate {
  event_id: string
  name: string
  description?: string
  price: number
  total_quantity: number
  max_per_customer?: number | null
  is_active?: boolean
  sale_start_date?: string
  sale_end_date?: string
}

export interface TicketTypeUpdate {
  name?: string
  description?: string
  price?: number
  total_quantity?: number
  max_per_customer?: number | null
  display_order?: number
  is_active?: boolean
  sale_start_date?: string
  sale_end_date?: string
}

export async function getTicketTypes(eventId: string): Promise<TicketType[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Error fetching ticket types:', error)
    throw new Error('Failed to fetch ticket types')
  }

  return data || []
}

export async function getTicketType(id: string): Promise<TicketType | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching ticket type:', error)
    return null
  }

  return data
}

/**
 * Batch fetch multiple ticket types by IDs
 * Prevents N+1 queries when validating multiple ticket selections
 */
export async function getTicketTypesByIds(ids: string[]): Promise<Map<string, TicketType>> {
  if (ids.length === 0) return new Map()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ticket_types')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('Error fetching ticket types:', error)
    throw new Error('Failed to fetch ticket types')
  }

  const ticketTypeMap = new Map<string, TicketType>()
  for (const ticketType of data || []) {
    ticketTypeMap.set(ticketType.id, ticketType)
  }

  return ticketTypeMap
}

/**
 * Atomically decrement ticket quantity
 * Uses database function to prevent race conditions
 */
export async function decrementTicketQuantity(
  id: string,
  quantity: number
): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('decrement_ticket_quantity', {
    ticket_type_id: id,
    quantity: quantity,
  })

  if (error) {
    console.error('Error decrementing ticket quantity:', error)
    // Fallback to manual update if RPC not available
    const ticketType = await getTicketType(id)
    if (!ticketType) throw new Error('Ticket type not found')

    const newQuantity = Math.max(0, ticketType.available_quantity - quantity)
    await supabase
      .from('ticket_types')
      .update({ available_quantity: newQuantity })
      .eq('id', id)

    return newQuantity
  }

  return data
}

export async function createTicketType(ticketTypeData: TicketTypeCreate): Promise<TicketType> {
  const supabase = await createClient()

  // Get the max display_order for this event to set the new ticket at the end
  const { data: existingTickets } = await supabase
    .from('ticket_types')
    .select('display_order')
    .eq('event_id', ticketTypeData.event_id)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextDisplayOrder = existingTickets && existingTickets.length > 0
    ? existingTickets[0].display_order + 1
    : 0

  const { data, error } = await supabase
    .from('ticket_types')
    .insert({
      ...ticketTypeData,
      available_quantity: ticketTypeData.total_quantity,
      display_order: nextDisplayOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating ticket type:', error)
    throw new Error('Failed to create ticket type')
  }

  return data
}

export async function updateTicketType(id: string, updates: TicketTypeUpdate): Promise<TicketType> {
  const supabase = await createClient()

  // If total_quantity is being updated, adjust available_quantity proportionally
  let updateData: any = { ...updates }

  if (updates.total_quantity !== undefined) {
    const currentTicketType = await getTicketType(id)
    if (currentTicketType) {
      const soldTickets = currentTicketType.total_quantity - currentTicketType.available_quantity
      updateData.available_quantity = updates.total_quantity - soldTickets
    }
  }

  const { data, error } = await supabase
    .from('ticket_types')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating ticket type:', error)
    throw new Error('Failed to update ticket type')
  }

  return data
}

export async function deleteTicketType(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_types')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting ticket type:', error)
    throw new Error('Failed to delete ticket type')
  }
}

export async function updateTicketTypeAvailability(
  id: string,
  quantityChange: number
): Promise<TicketType> {
  const supabase = await createClient()

  const ticketType = await getTicketType(id)
  if (!ticketType) {
    throw new Error('Ticket type not found')
  }

  const newAvailableQuantity = ticketType.available_quantity + quantityChange

  if (newAvailableQuantity < 0) {
    throw new Error('Not enough tickets available')
  }

  if (newAvailableQuantity > ticketType.total_quantity) {
    throw new Error('Available quantity cannot exceed total quantity')
  }

  const { data, error } = await supabase
    .from('ticket_types')
    .update({ available_quantity: newAvailableQuantity })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating ticket availability:', error)
    throw new Error('Failed to update ticket availability')
  }

  return data
}
