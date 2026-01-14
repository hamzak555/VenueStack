import { createClient } from '@/lib/supabase/server'
import { TrackingLink, TrackingLinkAnalytics } from '@/lib/types'

export async function getTrackingLinksByBusinessId(businessId: string): Promise<TrackingLink[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tracking links:', error)
    return []
  }

  return data || []
}

export async function getTrackingLinkById(id: string): Promise<TrackingLink | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching tracking link:', error)
    return null
  }

  return data
}

export async function getTrackingLinkByRefCode(businessId: string, refCode: string): Promise<TrackingLink | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('business_id', businessId)
    .eq('ref_code', refCode.toLowerCase())
    .eq('is_active', true)
    .single()

  if (error) {
    // Not found is expected when ref code doesn't match any link
    if (error.code !== 'PGRST116') {
      console.error('Error fetching tracking link by ref:', error)
    }
    return null
  }

  return data
}

export async function createTrackingLink(data: {
  business_id: string
  name: string
  ref_code: string
  description?: string | null
}): Promise<TrackingLink> {
  const supabase = await createClient()

  const { data: link, error } = await supabase
    .from('tracking_links')
    .insert({
      business_id: data.business_id,
      name: data.name.trim(),
      ref_code: data.ref_code.toLowerCase().trim(),
      description: data.description?.trim() || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating tracking link:', error)
    throw new Error('Failed to create tracking link')
  }

  return link
}

export async function updateTrackingLink(
  id: string,
  updates: Partial<Pick<TrackingLink, 'name' | 'ref_code' | 'description' | 'is_active'>>
): Promise<TrackingLink> {
  const supabase = await createClient()

  const updateData: Record<string, any> = {}
  if (updates.name !== undefined) updateData.name = updates.name.trim()
  if (updates.ref_code !== undefined) updateData.ref_code = updates.ref_code.toLowerCase().trim()
  if (updates.description !== undefined) updateData.description = updates.description?.trim() || null
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active

  const { data, error } = await supabase
    .from('tracking_links')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating tracking link:', error)
    throw new Error('Failed to update tracking link')
  }

  return data
}

export async function deleteTrackingLink(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tracking_links')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting tracking link:', error)
    throw new Error('Failed to delete tracking link')
  }
}

export async function isRefCodeUnique(businessId: string, refCode: string, excludeId?: string): Promise<boolean> {
  const supabase = await createClient()

  let query = supabase
    .from('tracking_links')
    .select('id')
    .eq('business_id', businessId)
    .eq('ref_code', refCode.toLowerCase())

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking ref code uniqueness:', error)
    return false
  }

  return !data || data.length === 0
}

interface DateRangeFilter {
  from: Date
  to: Date
}

export async function getTrackingLinkAnalytics(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<TrackingLinkAnalytics[]> {
  const supabase = await createClient()

  // Get all events for this business
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .eq('business_id', businessId)

  if (!events || events.length === 0) {
    return []
  }

  const eventIds = events.map(e => e.id)

  // Get orders with tracking data
  // Select subtotal, discount, and tax to calculate revenue excluding processing fees
  let ordersQuery = supabase
    .from('orders')
    .select('tracking_ref, tracking_link_id, subtotal, discount_amount, tax_amount, status, created_at')
    .in('event_id', eventIds)
    .eq('status', 'completed')
    .not('tracking_ref', 'is', null)

  if (dateRange) {
    ordersQuery = ordersQuery
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
  }

  const { data: orders } = await ordersQuery

  // Get table bookings with tracking data
  // Select amount and tax_amount to calculate revenue excluding processing fees
  let tableBookingsQuery = supabase
    .from('table_bookings')
    .select('tracking_ref, tracking_link_id, amount, tax_amount, status, created_at')
    .in('event_id', eventIds)
    .eq('status', 'confirmed')
    .not('tracking_ref', 'is', null)

  if (dateRange) {
    tableBookingsQuery = tableBookingsQuery
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
  }

  const { data: tableBookings } = await tableBookingsQuery

  // Get all tracking links for this business (to get names)
  const { data: trackingLinks } = await supabase
    .from('tracking_links')
    .select('id, name, ref_code')
    .eq('business_id', businessId)

  const linkMap = new Map<string, string>()
  trackingLinks?.forEach(link => {
    linkMap.set(link.ref_code, link.name)
  })

  // Aggregate by tracking_ref
  const analyticsMap = new Map<string, TrackingLinkAnalytics>()

  orders?.forEach(order => {
    const ref = order.tracking_ref as string
    if (!analyticsMap.has(ref)) {
      analyticsMap.set(ref, {
        tracking_ref: ref,
        link_name: linkMap.get(ref) || null,
        total_orders: 0,
        total_revenue: 0,
        ticket_orders: 0,
        ticket_revenue: 0,
        table_bookings: 0,
        table_revenue: 0,
        last_activity: null,
      })
    }
    const analytics = analyticsMap.get(ref)!
    // Calculate revenue as subtotal - discount + tax (excluding processing fees)
    const subtotal = parseFloat(order.subtotal?.toString() || '0')
    const discount = parseFloat(order.discount_amount?.toString() || '0')
    const tax = parseFloat(order.tax_amount?.toString() || '0')
    const orderRevenue = subtotal - discount + tax

    analytics.ticket_orders += 1
    analytics.ticket_revenue += orderRevenue
    analytics.total_orders += 1
    analytics.total_revenue += orderRevenue
    // Track most recent activity
    if (!analytics.last_activity || order.created_at > analytics.last_activity) {
      analytics.last_activity = order.created_at
    }
  })

  tableBookings?.forEach(booking => {
    const ref = booking.tracking_ref as string
    if (!analyticsMap.has(ref)) {
      analyticsMap.set(ref, {
        tracking_ref: ref,
        link_name: linkMap.get(ref) || null,
        total_orders: 0,
        total_revenue: 0,
        ticket_orders: 0,
        ticket_revenue: 0,
        table_bookings: 0,
        table_revenue: 0,
        last_activity: null,
      })
    }
    const analytics = analyticsMap.get(ref)!
    // Calculate revenue as amount + tax (excluding processing fees)
    const amount = parseFloat(booking.amount?.toString() || '0')
    const tax = parseFloat(booking.tax_amount?.toString() || '0')
    const bookingRevenue = amount + tax

    analytics.table_bookings += 1
    analytics.table_revenue += bookingRevenue
    analytics.total_orders += 1
    analytics.total_revenue += bookingRevenue
    // Track most recent activity
    if (!analytics.last_activity || booking.created_at > analytics.last_activity) {
      analytics.last_activity = booking.created_at
    }
  })

  // Sort by total revenue descending
  return Array.from(analyticsMap.values()).sort((a, b) => b.total_revenue - a.total_revenue)
}
