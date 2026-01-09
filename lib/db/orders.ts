import { createClient } from '@/lib/supabase/server'

export interface EventWithSalesInfo {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  status: string
  orders_count: number
  tickets_sold: number
  total_revenue: number
  available_tickets: number
  total_tickets: number
}

export async function getEventsWithSales(businessId: string): Promise<EventWithSalesInfo[]> {
  const supabase = await createClient()

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

  // Get orders for these events
  const { data: orders } = await supabase
    .from('orders')
    .select('event_id, quantity, total, status')
    .in('event_id', eventIds)
    .eq('status', 'completed')

  // Get ticket types for available/total counts
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('event_id, available_quantity, total_quantity')
    .in('event_id', eventIds)

  // Aggregate data per event
  return events.map(event => {
    const eventOrders = orders?.filter(o => o.event_id === event.id) || []
    const eventTicketTypes = ticketTypes?.filter(t => t.event_id === event.id) || []

    const ordersCount = eventOrders.length
    const ticketsSold = eventOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
    const totalRevenue = eventOrders.reduce((sum, o) => sum + parseFloat(o.total?.toString() || '0'), 0)
    const availableTickets = eventTicketTypes.reduce((sum, t) => sum + (t.available_quantity || 0), 0)
    const totalTickets = eventTicketTypes.reduce((sum, t) => sum + (t.total_quantity || 0), 0)

    return {
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location,
      image_url: event.image_url,
      status: event.status,
      orders_count: ordersCount,
      tickets_sold: ticketsSold,
      total_revenue: totalRevenue,
      available_tickets: availableTickets,
      total_tickets: totalTickets,
    }
  })
}

export interface Order {
  id: string
  order_number: string
  event_id: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  quantity: number
  total: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  created_at: string
  event_title: string
  event_date: string
  event_image_url: string | null
  payment_intent_id?: string
}

export async function getOrdersByBusinessId(businessId: string, eventId?: string): Promise<Order[]> {
  const supabase = await createClient()

  // Get all orders for events belonging to this business
  let query = supabase
    .from('orders')
    .select(`
      *,
      events!inner (
        id,
        title,
        event_date,
        image_url,
        business_id
      )
    `)
    .eq('events.business_id', businessId)
    .order('created_at', { ascending: false })

  // Filter by event if provided
  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching orders:', error)
    return [] // Return empty array instead of throwing
  }

  if (!data) {
    return []
  }

  return data.map((order: any) => ({
    id: order.id,
    order_number: order.order_number,
    event_id: order.event_id,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    quantity: order.quantity || 0,
    total: order.total,
    status: order.status,
    created_at: order.created_at,
    event_title: order.events.title,
    event_date: order.events.event_date,
    event_image_url: order.events.image_url,
  }))
}

export async function getOrderById(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      events (
        id,
        title,
        event_date,
        event_time,
        location,
        business_id
      )
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    console.error('Error fetching order:', error)
    throw new Error('Failed to fetch order')
  }

  return data
}

export async function hasEventBeenSold(eventId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)

  if (error) {
    console.error('Error checking event sales:', error)
    return false
  }

  return data && data.length > 0
}
