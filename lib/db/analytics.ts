import { createClient } from '@/lib/supabase/server'

export interface EventAnalytics {
  event_id: string
  event_title: string
  event_date: string
  event_status: string
  total_orders: number
  total_tickets_sold: number
  total_revenue: number
  // Detailed ticket revenue breakdown
  ticket_gross_revenue: number
  ticket_net_revenue: number
  ticket_fees: number
  ticket_tax: number
  // Table service specific
  total_table_bookings: number
  table_revenue: number
  table_tax: number
}

export interface BusinessAnalytics {
  total_revenue: number
  total_tax_collected: number
  ticket_tax_collected: number
  table_tax_collected: number
  total_tickets_sold: number
  total_orders: number
  // Detailed ticket revenue breakdown
  ticket_gross_revenue: number
  ticket_net_revenue: number
  ticket_fees: number
  // Table service totals
  total_table_bookings: number
  total_table_revenue: number
  events: EventAnalytics[]
}

export interface DateRangeFilter {
  from: Date
  to: Date
}

export async function getBusinessAnalytics(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<BusinessAnalytics> {
  const supabase = await createClient()

  // Get all completed orders for this business's events
  // Include fee fields to calculate net revenue (what business actually receives)
  let ordersQuery = supabase
    .from('orders')
    .select(`
      id,
      event_id,
      quantity,
      total,
      tax_amount,
      platform_fee,
      stripe_fee,
      status,
      created_at,
      event:events!inner (
        id,
        title,
        event_date,
        status,
        business_id
      )
    `)
    .eq('event.business_id', businessId)
    .eq('status', 'completed')

  // Apply date filter if provided
  if (dateRange) {
    ordersQuery = ordersQuery
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
  }

  const { data: orders, error } = await ordersQuery

  if (error) {
    console.error('Error fetching analytics:', error)
    throw new Error('Failed to fetch analytics data')
  }

  // Get all confirmed table bookings for this business's events
  let tableBookingsQuery = supabase
    .from('table_bookings')
    .select(`
      id,
      event_id,
      amount,
      tax_amount,
      status,
      created_at,
      event:events!inner (
        id,
        title,
        event_date,
        status,
        business_id
      )
    `)
    .eq('event.business_id', businessId)
    .eq('status', 'confirmed')

  // Apply date filter if provided
  if (dateRange) {
    tableBookingsQuery = tableBookingsQuery
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
  }

  const { data: tableBookings, error: tableBookingsError } = await tableBookingsQuery

  if (tableBookingsError) {
    console.error('Error fetching table bookings:', tableBookingsError)
  }

  if ((!orders || orders.length === 0) && (!tableBookings || tableBookings.length === 0)) {
    return {
      total_revenue: 0,
      total_tax_collected: 0,
      ticket_tax_collected: 0,
      table_tax_collected: 0,
      total_tickets_sold: 0,
      total_orders: 0,
      ticket_gross_revenue: 0,
      ticket_net_revenue: 0,
      ticket_fees: 0,
      total_table_bookings: 0,
      total_table_revenue: 0,
      events: []
    }
  }

  // Aggregate by event
  const eventMap = new Map<string, EventAnalytics>()
  let ticket_tax_collected = 0
  let table_tax_collected = 0

  // Process ticket orders
  if (orders) {
    for (const order of orders) {
      const event = Array.isArray(order.event) ? order.event[0] : order.event

      if (!event) continue

      const eventId = event.id

      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          event_id: eventId,
          event_title: event.title,
          event_date: event.event_date,
          event_status: event.status,
          total_orders: 0,
          total_tickets_sold: 0,
          total_revenue: 0,
          ticket_gross_revenue: 0,
          ticket_net_revenue: 0,
          ticket_fees: 0,
          ticket_tax: 0,
          total_table_bookings: 0,
          table_revenue: 0,
          table_tax: 0,
        })
      }

      // Calculate net revenue for the business (what they actually receive)
      // Business receives: total charged - platform_fee - stripe_fee
      // This is what gets transferred to the business's Stripe account
      const total = parseFloat(order.total?.toString() || '0')
      const taxAmount = parseFloat(order.tax_amount?.toString() || '0')
      const platformFee = parseFloat(order.platform_fee?.toString() || '0')
      const stripeFee = parseFloat(order.stripe_fee?.toString() || '0')

      // Net revenue = total charged minus all fees kept by platform/Stripe
      const netRevenue = total - platformFee - stripeFee
      const fees = platformFee + stripeFee

      // Track ticket tax collected
      ticket_tax_collected += taxAmount

      const analytics = eventMap.get(eventId)!
      analytics.total_orders += 1
      analytics.total_tickets_sold += order.quantity
      analytics.total_revenue += netRevenue
      analytics.ticket_gross_revenue += total
      analytics.ticket_net_revenue += netRevenue
      analytics.ticket_fees += fees
      analytics.ticket_tax += taxAmount
    }
  }

  // Process table bookings
  if (tableBookings) {
    for (const booking of tableBookings) {
      const event = Array.isArray(booking.event) ? booking.event[0] : booking.event

      if (!event) continue

      const eventId = event.id

      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          event_id: eventId,
          event_title: event.title,
          event_date: event.event_date,
          event_status: event.status,
          total_orders: 0,
          total_tickets_sold: 0,
          total_revenue: 0,
          ticket_gross_revenue: 0,
          ticket_net_revenue: 0,
          ticket_fees: 0,
          ticket_tax: 0,
          total_table_bookings: 0,
          table_revenue: 0,
          table_tax: 0,
        })
      }

      const bookingAmount = parseFloat(booking.amount?.toString() || '0')
      const bookingTax = parseFloat(booking.tax_amount?.toString() || '0')

      // Track table tax collected
      table_tax_collected += bookingTax

      const analytics = eventMap.get(eventId)!
      analytics.total_table_bookings += 1
      analytics.table_revenue += bookingAmount
      analytics.table_tax += bookingTax
      analytics.total_revenue += bookingAmount // Add to total revenue as well
    }
  }

  // Calculate totals
  const eventAnalytics = Array.from(eventMap.values())
  const total_revenue = eventAnalytics.reduce((sum, e) => sum + e.total_revenue, 0)
  const total_tickets_sold = eventAnalytics.reduce((sum, e) => sum + e.total_tickets_sold, 0)
  const total_orders = eventAnalytics.reduce((sum, e) => sum + e.total_orders, 0)
  const ticket_gross_revenue = eventAnalytics.reduce((sum, e) => sum + e.ticket_gross_revenue, 0)
  const ticket_net_revenue = eventAnalytics.reduce((sum, e) => sum + e.ticket_net_revenue, 0)
  const ticket_fees = eventAnalytics.reduce((sum, e) => sum + e.ticket_fees, 0)
  const total_table_bookings = eventAnalytics.reduce((sum, e) => sum + e.total_table_bookings, 0)
  const total_table_revenue = eventAnalytics.reduce((sum, e) => sum + e.table_revenue, 0)

  return {
    total_revenue,
    total_tax_collected: ticket_tax_collected + table_tax_collected,
    ticket_tax_collected,
    table_tax_collected,
    total_tickets_sold,
    total_orders,
    ticket_gross_revenue,
    ticket_net_revenue,
    ticket_fees,
    total_table_bookings,
    total_table_revenue,
    events: eventAnalytics.sort((a, b) => b.total_revenue - a.total_revenue), // Sort by revenue
  }
}
