import { createClient } from '@/lib/supabase/server'

export interface SingleEventAnalytics {
  tickets_sold: number
  tickets_available: number
  tickets_total: number
  ticket_orders: number
  ticket_gross_revenue: number
  ticket_net_revenue: number
  ticket_fees: number
  ticket_tax: number
  tables_booked: number
  table_revenue: number
  table_tax: number
  gross_revenue: number
  net_revenue: number
}

export async function getEventAnalytics(eventId: string): Promise<SingleEventAnalytics> {
  const supabase = await createClient()

  // Get completed ticket orders for this event
  const { data: orders } = await supabase
    .from('orders')
    .select('quantity, total, tax_amount, platform_fee, stripe_fee')
    .eq('event_id', eventId)
    .eq('status', 'completed')

  // Get confirmed table bookings for this event
  const { data: tableBookings } = await supabase
    .from('table_bookings')
    .select('amount, tax_amount')
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'arrived', 'seated', 'completed'])

  // Get ticket types for available/total counts
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('total_quantity, available_quantity')
    .eq('event_id', eventId)

  // Calculate ticket stats
  let tickets_sold = 0
  let ticket_orders = 0
  let ticket_gross_revenue = 0
  let ticket_net_revenue = 0
  let ticket_fees = 0
  let ticket_tax = 0

  if (orders) {
    for (const order of orders) {
      const total = parseFloat(order.total?.toString() || '0')
      const taxAmount = parseFloat(order.tax_amount?.toString() || '0')
      const platformFee = parseFloat(order.platform_fee?.toString() || '0')
      const stripeFee = parseFloat(order.stripe_fee?.toString() || '0')
      const netRevenue = total - platformFee - stripeFee

      tickets_sold += order.quantity
      ticket_orders += 1
      ticket_gross_revenue += total
      ticket_net_revenue += netRevenue
      ticket_fees += platformFee + stripeFee
      ticket_tax += taxAmount
    }
  }

  // Calculate table stats
  let tables_booked = 0
  let table_revenue = 0
  let table_tax = 0

  if (tableBookings) {
    for (const booking of tableBookings) {
      tables_booked += 1
      table_revenue += parseFloat(booking.amount?.toString() || '0')
      table_tax += parseFloat(booking.tax_amount?.toString() || '0')
    }
  }

  // Calculate ticket inventory
  let tickets_total = 0
  let tickets_available = 0

  if (ticketTypes) {
    for (const tt of ticketTypes) {
      tickets_total += tt.total_quantity
      tickets_available += tt.available_quantity
    }
  }

  const gross_revenue = ticket_gross_revenue + table_revenue
  const net_revenue = ticket_net_revenue + table_revenue

  return {
    tickets_sold,
    tickets_available,
    tickets_total,
    ticket_orders,
    ticket_gross_revenue,
    ticket_net_revenue,
    ticket_fees,
    ticket_tax,
    tables_booked,
    table_revenue,
    table_tax,
    gross_revenue,
    net_revenue,
  }
}

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
  table_fees: number
  // Fee payer breakdown
  ticket_customer_paid_fees: number
  ticket_business_paid_fees: number
  table_customer_paid_fees: number
  table_business_paid_fees: number
  // Refunds
  ticket_refunds: number
  table_refunds: number
  total_refunds: number
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
  ticket_platform_fees: number
  ticket_stripe_fees: number
  // Fee payer breakdown for tickets (based on stored values at time of purchase)
  ticket_customer_paid_platform_fees: number
  ticket_customer_paid_stripe_fees: number
  ticket_business_paid_platform_fees: number
  ticket_business_paid_stripe_fees: number
  // Table service totals
  total_table_bookings: number
  total_table_revenue: number
  table_fees: number
  table_platform_fees: number
  table_stripe_fees: number
  // Fee payer breakdown for tables (based on stored values at time of booking)
  table_customer_paid_platform_fees: number
  table_customer_paid_stripe_fees: number
  table_business_paid_platform_fees: number
  table_business_paid_stripe_fees: number
  // Refunds
  total_refunds: number
  ticket_refunds: number
  table_refunds: number
  refund_count: number
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
      stripe_fee_payer,
      platform_fee_payer,
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

  // Get all confirmed/completed table bookings for this business's events
  let tableBookingsQuery = supabase
    .from('table_bookings')
    .select(`
      id,
      event_id,
      amount,
      tax_amount,
      platform_fee,
      stripe_fee,
      stripe_fee_payer,
      platform_fee_payer,
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
    .in('status', ['confirmed', 'arrived', 'seated', 'completed'])

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

  // Get all events for this business to use for refund queries
  const { data: businessEvents } = await supabase
    .from('events')
    .select('id')
    .eq('business_id', businessId)

  const eventIds = businessEvents?.map(e => e.id) || []

  // Get ticket order refunds by first getting all order IDs for the business's events
  let ticketRefunds: any[] | null = null
  let ticketRefundsError: any = null

  if (eventIds.length > 0) {
    // Get all order IDs for the business's events
    const { data: businessOrders } = await supabase
      .from('orders')
      .select('id, event_id')
      .in('event_id', eventIds)

    const orderIds = businessOrders?.map(o => o.id) || []

    if (orderIds.length > 0) {
      let ticketRefundsQuery = supabase
        .from('refunds')
        .select(`
          id,
          order_id,
          amount,
          status,
          created_at
        `)
        .in('order_id', orderIds)
        .eq('status', 'succeeded')

      if (dateRange) {
        ticketRefundsQuery = ticketRefundsQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
      }

      const result = await ticketRefundsQuery
      ticketRefunds = result.data
      ticketRefundsError = result.error

      // Add event_id to each refund for later processing
      if (ticketRefunds && businessOrders) {
        const orderEventMap = new Map(businessOrders.map(o => [o.id, o.event_id]))
        ticketRefunds = ticketRefunds.map(r => ({
          ...r,
          event_id: orderEventMap.get(r.order_id)
        }))
      }
    }
  }

  if (ticketRefundsError) {
    console.error('Error fetching ticket refunds:', ticketRefundsError)
  }

  // Get table booking refunds by first getting all booking IDs for the business's events
  let tableRefunds: any[] | null = null
  let tableRefundsError: any = null

  if (eventIds.length > 0) {
    // Get all table booking IDs for the business's events
    const { data: businessBookings } = await supabase
      .from('table_bookings')
      .select('id, event_id')
      .in('event_id', eventIds)

    const bookingIds = businessBookings?.map(b => b.id) || []

    if (bookingIds.length > 0) {
      let tableRefundsQuery = supabase
        .from('table_booking_refunds')
        .select(`
          id,
          table_booking_id,
          amount,
          status,
          created_at
        `)
        .in('table_booking_id', bookingIds)
        .eq('status', 'succeeded')

      if (dateRange) {
        tableRefundsQuery = tableRefundsQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
      }

      const result = await tableRefundsQuery
      tableRefunds = result.data
      tableRefundsError = result.error

      // Add event_id to each refund for later processing
      if (tableRefunds && businessBookings) {
        const bookingEventMap = new Map(businessBookings.map(b => [b.id, b.event_id]))
        tableRefunds = tableRefunds.map(r => ({
          ...r,
          event_id: bookingEventMap.get(r.table_booking_id)
        }))
      }
    }
  }

  if (tableRefundsError) {
    console.error('Error fetching table refunds:', tableRefundsError)
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
      ticket_platform_fees: 0,
      ticket_stripe_fees: 0,
      ticket_customer_paid_platform_fees: 0,
      ticket_customer_paid_stripe_fees: 0,
      ticket_business_paid_platform_fees: 0,
      ticket_business_paid_stripe_fees: 0,
      total_table_bookings: 0,
      total_table_revenue: 0,
      table_fees: 0,
      table_platform_fees: 0,
      table_stripe_fees: 0,
      table_customer_paid_platform_fees: 0,
      table_customer_paid_stripe_fees: 0,
      table_business_paid_platform_fees: 0,
      table_business_paid_stripe_fees: 0,
      total_refunds: 0,
      ticket_refunds: 0,
      table_refunds: 0,
      refund_count: 0,
      events: []
    }
  }

  // Aggregate by event
  const eventMap = new Map<string, EventAnalytics>()
  let ticket_tax_collected = 0
  let table_tax_collected = 0
  let ticket_platform_fees = 0
  let ticket_stripe_fees = 0
  let table_platform_fees = 0
  let table_stripe_fees = 0
  // Track fees based on who paid (stored at time of purchase)
  let ticket_customer_paid_platform_fees = 0
  let ticket_customer_paid_stripe_fees = 0
  let ticket_business_paid_platform_fees = 0
  let ticket_business_paid_stripe_fees = 0
  let table_customer_paid_platform_fees = 0
  let table_customer_paid_stripe_fees = 0
  let table_business_paid_platform_fees = 0
  let table_business_paid_stripe_fees = 0

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
          table_fees: 0,
          ticket_customer_paid_fees: 0,
          ticket_business_paid_fees: 0,
          table_customer_paid_fees: 0,
          table_business_paid_fees: 0,
          ticket_refunds: 0,
          table_refunds: 0,
          total_refunds: 0,
        })
      }

      // Calculate net revenue for the business (what they actually receive)
      // Business receives: total charged - platform_fee - stripe_fee
      // This is what gets transferred to the business's Stripe account
      const total = parseFloat(order.total?.toString() || '0')
      const taxAmount = parseFloat(order.tax_amount?.toString() || '0')
      const platformFee = parseFloat(order.platform_fee?.toString() || '0')
      const stripeFee = parseFloat(order.stripe_fee?.toString() || '0')
      // Get who paid the fees (defaults to 'customer' for legacy orders without this field)
      const platformFeePayer = order.platform_fee_payer || 'customer'
      const stripeFeePayer = order.stripe_fee_payer || 'customer'

      // Net revenue = total charged minus all fees kept by platform/Stripe
      const netRevenue = total - platformFee - stripeFee
      const fees = platformFee + stripeFee

      // Track ticket tax and fees collected
      ticket_tax_collected += taxAmount
      ticket_platform_fees += platformFee
      ticket_stripe_fees += stripeFee

      // Track fees by who paid them
      if (platformFeePayer === 'customer') {
        ticket_customer_paid_platform_fees += platformFee
      } else {
        ticket_business_paid_platform_fees += platformFee
      }
      if (stripeFeePayer === 'customer') {
        ticket_customer_paid_stripe_fees += stripeFee
      } else {
        ticket_business_paid_stripe_fees += stripeFee
      }

      const analytics = eventMap.get(eventId)!
      analytics.total_orders += 1
      analytics.total_tickets_sold += order.quantity
      analytics.total_revenue += netRevenue
      analytics.ticket_gross_revenue += total
      analytics.ticket_net_revenue += netRevenue
      analytics.ticket_fees += fees
      analytics.ticket_tax += taxAmount
      // Track fee payer at event level
      if (platformFeePayer === 'customer') {
        analytics.ticket_customer_paid_fees += platformFee
      } else {
        analytics.ticket_business_paid_fees += platformFee
      }
      if (stripeFeePayer === 'customer') {
        analytics.ticket_customer_paid_fees += stripeFee
      } else {
        analytics.ticket_business_paid_fees += stripeFee
      }
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
          table_fees: 0,
          ticket_customer_paid_fees: 0,
          ticket_business_paid_fees: 0,
          table_customer_paid_fees: 0,
          table_business_paid_fees: 0,
          ticket_refunds: 0,
          table_refunds: 0,
          total_refunds: 0,
        })
      }

      const bookingAmount = parseFloat(booking.amount?.toString() || '0')
      const bookingTax = parseFloat(booking.tax_amount?.toString() || '0')
      const bookingPlatformFee = parseFloat(booking.platform_fee?.toString() || '0')
      const bookingStripeFee = parseFloat(booking.stripe_fee?.toString() || '0')
      const bookingFees = bookingPlatformFee + bookingStripeFee
      // Get who paid the fees (defaults to 'customer' for legacy bookings without this field)
      const bookingPlatformFeePayer = booking.platform_fee_payer || 'customer'
      const bookingStripeFeePayer = booking.stripe_fee_payer || 'customer'

      // Track table tax and fees collected
      table_tax_collected += bookingTax
      table_platform_fees += bookingPlatformFee
      table_stripe_fees += bookingStripeFee

      // Track fees by who paid them
      if (bookingPlatformFeePayer === 'customer') {
        table_customer_paid_platform_fees += bookingPlatformFee
      } else {
        table_business_paid_platform_fees += bookingPlatformFee
      }
      if (bookingStripeFeePayer === 'customer') {
        table_customer_paid_stripe_fees += bookingStripeFee
      } else {
        table_business_paid_stripe_fees += bookingStripeFee
      }

      const analytics = eventMap.get(eventId)!
      analytics.total_table_bookings += 1
      analytics.table_revenue += bookingAmount
      analytics.table_tax += bookingTax
      analytics.table_fees += bookingFees
      analytics.total_revenue += bookingAmount // Add to total revenue as well
      // Track fee payer at event level for tables
      if (bookingPlatformFeePayer === 'customer') {
        analytics.table_customer_paid_fees += bookingPlatformFee
      } else {
        analytics.table_business_paid_fees += bookingPlatformFee
      }
      if (bookingStripeFeePayer === 'customer') {
        analytics.table_customer_paid_fees += bookingStripeFee
      } else {
        analytics.table_business_paid_fees += bookingStripeFee
      }
    }
  }

  // Process ticket refunds
  let total_ticket_refunds = 0
  let total_table_refunds_amount = 0
  let refund_count = 0

  if (ticketRefunds) {
    for (const refund of ticketRefunds) {
      const eventId = refund.event_id
      if (!eventId) continue

      const refundAmount = parseFloat(refund.amount?.toString() || '0')

      total_ticket_refunds += refundAmount
      refund_count += 1

      // Add to event if it exists in the map
      if (eventMap.has(eventId)) {
        const analytics = eventMap.get(eventId)!
        analytics.ticket_refunds += refundAmount
        analytics.total_refunds += refundAmount
      }
    }
  }

  // Process table booking refunds
  if (tableRefunds) {
    for (const refund of tableRefunds) {
      const eventId = refund.event_id
      if (!eventId) continue

      const refundAmount = parseFloat(refund.amount?.toString() || '0')

      total_table_refunds_amount += refundAmount
      refund_count += 1

      // Add to event if it exists in the map
      if (eventMap.has(eventId)) {
        const analytics = eventMap.get(eventId)!
        analytics.table_refunds += refundAmount
        analytics.total_refunds += refundAmount
      }
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
  const total_refunds = total_ticket_refunds + total_table_refunds_amount

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
    ticket_platform_fees,
    ticket_stripe_fees,
    ticket_customer_paid_platform_fees,
    ticket_customer_paid_stripe_fees,
    ticket_business_paid_platform_fees,
    ticket_business_paid_stripe_fees,
    total_table_bookings,
    total_table_revenue,
    table_fees: table_platform_fees + table_stripe_fees,
    table_platform_fees,
    table_stripe_fees,
    table_customer_paid_platform_fees,
    table_customer_paid_stripe_fees,
    table_business_paid_platform_fees,
    table_business_paid_stripe_fees,
    total_refunds,
    ticket_refunds: total_ticket_refunds,
    table_refunds: total_table_refunds_amount,
    refund_count,
    events: eventAnalytics.sort((a, b) => b.total_revenue - a.total_revenue), // Sort by revenue
  }
}
