import { createClient } from '@/lib/supabase/server'

export interface EventWithTableInfo {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location: string | null
  image_url: string | null
  status: string
  table_bookings_count: number
  total_tables: number
  available_tables: number
  bookings_by_status: {
    seated: number
    arrived: number
    confirmed: number
    approved: number
    requested: number
    completed: number
    cancelled: number
  }
}

export async function getEventsWithTableService(businessId: string): Promise<EventWithTableInfo[]> {
  const supabase = await createClient()

  // Get business table service config for accurate table counts
  const { data: business } = await supabase
    .from('businesses')
    .select('table_service_config')
    .eq('id', businessId)
    .single()

  // Build a map of section_id -> tableCount from the business config
  const sectionTableCounts: Record<string, number> = {}
  if (business?.table_service_config?.sections) {
    for (const section of business.table_service_config.sections) {
      sectionTableCounts[section.id] = section.tableCount || 0
    }
  }

  // Get events that have table service enabled
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      id,
      title,
      event_date,
      event_time,
      location,
      image_url,
      status,
      table_service_enabled
    `)
    .eq('business_id', businessId)
    .eq('table_service_enabled', true)
    .order('event_date', { ascending: true })

  if (eventsError || !events) {
    console.error('Error fetching events:', eventsError)
    return []
  }

  // Get table sections and bookings for these events
  const eventIds = events.map(e => e.id)

  const { data: tableSections } = await supabase
    .from('event_table_sections')
    .select('event_id, section_id, total_tables, is_enabled, closed_tables, linked_table_pairs')
    .in('event_id', eventIds)
    .eq('is_enabled', true)

  // Get all bookings for counting (including cancelled for the cancelled count display)
  const { data: tableBookings } = await supabase
    .from('table_bookings')
    .select('event_id, status, table_number')
    .in('event_id', eventIds)

  // Aggregate data per event
  return events.map(event => {
    const eventSections = tableSections?.filter(s => s.event_id === event.id) || []
    // All bookings for status display
    const allBookings = tableBookings?.filter(b => b.event_id === event.id) || []
    // Active bookings (not cancelled) for counting active reservations
    const activeBookings = allBookings.filter(b => b.status !== 'cancelled')
    // Bookings occupying a table: has table assigned, not cancelled, not completed
    const occupyingBookings = activeBookings.filter(b => b.status !== 'completed' && b.table_number !== null)

    // Use tableCount from business config (source of truth) or fall back to stored total_tables
    const totalTables = eventSections.reduce((sum, s) => {
      const configCount = sectionTableCounts[s.section_id]
      return sum + (configCount !== undefined ? configCount : (s.total_tables || 0))
    }, 0)
    // Count closed tables across all sections
    const closedTablesCount = eventSections.reduce((sum, s) => sum + ((s as any).closed_tables?.length || 0), 0)
    // Count linked table pairs (each pair combines 2 tables into 1, so subtract 1 per pair)
    const linkedPairsCount = eventSections.reduce((sum, s) => {
      const pairs = (s as any).linked_table_pairs || []
      return sum + pairs.length
    }, 0)
    // Calculate available tables dynamically (subtract occupying bookings, closed tables, and linked pairs)
    const availableTables = Math.max(0, totalTables - occupyingBookings.length - closedTablesCount - linkedPairsCount)

    // Count bookings by status
    const bookingsByStatus = {
      seated: activeBookings.filter(b => b.status === 'seated').length,
      arrived: activeBookings.filter(b => b.status === 'arrived').length,
      confirmed: activeBookings.filter(b => b.status === 'confirmed').length,
      approved: activeBookings.filter(b => b.status === 'approved').length,
      requested: activeBookings.filter(b => b.status === 'requested').length,
      completed: activeBookings.filter(b => b.status === 'completed').length,
      cancelled: allBookings.filter(b => b.status === 'cancelled').length,
    }

    return {
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location,
      image_url: event.image_url,
      status: event.status,
      table_bookings_count: activeBookings.length,
      total_tables: totalTables,
      available_tables: availableTables,
      bookings_by_status: bookingsByStatus,
    }
  })
}

export interface BookingNote {
  id: string
  content: string
  created_by_name: string
  created_by_email: string
  created_at: string
}

export interface TableBooking {
  id: string
  event_id: string
  event_table_section_id: string
  table_number: number | null // null until business assigns a specific table
  completed_table_number?: string | null // stored when reservation is completed
  requested_table_number?: string | null // stored for server-created reservations (table they selected but not assigned)
  order_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  amount: number | null
  tax_amount: number | null
  total_refunded: number // Total amount refunded for this booking
  status: 'requested' | 'approved' | 'confirmed' | 'cancelled' | 'arrived' | 'seated' | 'completed'
  created_at: string
  updated_at: string
  created_by_name?: string | null
  created_by_email?: string | null
  notes?: BookingNote[]
  // Joined fields
  event_title: string
  event_date: string
  section_name: string
  section_id: string
}

export async function getTableBookingsByBusinessId(businessId: string, eventId?: string): Promise<TableBooking[]> {
  const supabase = await createClient()

  let query = supabase
    .from('table_bookings')
    .select(`
      *,
      events!inner (
        id,
        title,
        event_date,
        business_id
      ),
      event_table_sections (
        id,
        section_id,
        section_name
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
    console.error('Error fetching table bookings:', error)
    return []
  }

  if (!data) {
    return []
  }

  // Get all order IDs and booking IDs to fetch refunds
  const orderIds = [...new Set(data.map((b: any) => b.order_id).filter(Boolean))]
  const bookingIds = data.map((b: any) => b.id)

  // Fetch refunds by order_id (for paid reservations) - refunds are tied to orders, not individual bookings
  let refundsByOrder: Record<string, number> = {}
  if (orderIds.length > 0) {
    const { data: orderRefunds } = await supabase
      .from('table_booking_refunds')
      .select('order_id, amount, status')
      .in('order_id', orderIds)
      .eq('status', 'succeeded')

    if (orderRefunds) {
      orderRefunds.forEach((refund: any) => {
        const orderId = refund.order_id
        const amount = parseFloat(refund.amount?.toString() || '0')
        refundsByOrder[orderId] = (refundsByOrder[orderId] || 0) + amount
      })
    }
  }

  // Also fetch refunds by booking_id for manual reservations without order_id
  const bookingsWithoutOrder = data.filter((b: any) => !b.order_id).map((b: any) => b.id)
  let refundsByBooking: Record<string, number> = {}
  if (bookingsWithoutOrder.length > 0) {
    const { data: bookingRefunds } = await supabase
      .from('table_booking_refunds')
      .select('table_booking_id, amount, status')
      .in('table_booking_id', bookingsWithoutOrder)
      .eq('status', 'succeeded')

    if (bookingRefunds) {
      bookingRefunds.forEach((refund: any) => {
        const bookingId = refund.table_booking_id
        const amount = parseFloat(refund.amount?.toString() || '0')
        refundsByBooking[bookingId] = (refundsByBooking[bookingId] || 0) + amount
      })
    }
  }

  return data.map((booking: any) => ({
    id: booking.id,
    event_id: booking.event_id,
    event_table_section_id: booking.event_table_section_id,
    table_number: booking.table_number,
    completed_table_number: booking.completed_table_number,
    requested_table_number: booking.requested_table_number,
    order_id: booking.order_id,
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
    customer_phone: booking.customer_phone,
    amount: booking.amount,
    tax_amount: booking.tax_amount,
    total_refunded: booking.order_id ? (refundsByOrder[booking.order_id] || 0) : (refundsByBooking[booking.id] || 0),
    status: booking.status,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    notes: booking.notes || [],
    event_title: booking.events.title,
    event_date: booking.events.event_date,
    section_name: booking.event_table_sections?.section_name || 'Unknown Section',
    section_id: booking.event_table_sections?.section_id || '',
  }))
}

export async function getTableBookingById(bookingId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('table_bookings')
    .select(`
      *,
      events (
        id,
        title,
        event_date,
        event_time,
        location,
        image_url,
        business_id
      ),
      event_table_sections (
        id,
        section_name,
        price,
        capacity
      )
    `)
    .eq('id', bookingId)
    .single()

  if (error) {
    console.error('Error fetching table booking:', error)
    throw new Error('Failed to fetch table booking')
  }

  return data
}

export async function updateTableBookingStatus(
  bookingId: string,
  status: 'requested' | 'approved' | 'confirmed' | 'cancelled' | 'arrived' | 'seated' | 'completed'
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('table_bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) {
    console.error('Error updating table booking status:', error)
    throw new Error('Failed to update table booking status')
  }

  return data
}

export async function getTableBookingsByOrderId(orderId: string): Promise<TableBooking[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('table_bookings')
    .select(`
      *,
      events (
        id,
        title,
        event_date
      ),
      event_table_sections (
        id,
        section_name
      )
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching table bookings by order:', error)
    return []
  }

  if (!data) {
    return []
  }

  return data.map((booking: any) => ({
    id: booking.id,
    event_id: booking.event_id,
    event_table_section_id: booking.event_table_section_id,
    table_number: booking.table_number,
    order_id: booking.order_id,
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
    customer_phone: booking.customer_phone,
    amount: booking.amount,
    tax_amount: booking.tax_amount,
    status: booking.status,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    event_title: booking.events?.title || '',
    event_date: booking.events?.event_date || '',
    section_name: booking.event_table_sections?.section_name || 'Unknown Section',
    section_id: booking.event_table_section_id,
  }))
}

/**
 * Check if an event has any table bookings (excluding cancelled)
 */
export async function hasTableBookings(eventId: string): Promise<boolean> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('table_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('status', 'cancelled')

  if (error) {
    console.error('Error checking table bookings:', error)
    return false
  }

  return (count || 0) > 0
}
