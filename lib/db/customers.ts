import { createClient } from '@/lib/supabase/server'

export interface Customer {
  id: string
  name: string
  email: string | null // Primary email
  phone: string | null // Phone number (unique identifier)
  emails: string[] // All known emails for this customer
  total_reservations: number
  total_tickets: number
  total_spent: number
  first_purchase: string
  last_purchase: string
  average_rating: number | null
  total_ratings: number
}

export async function getCustomersByBusinessId(businessId: string): Promise<Customer[]> {
  const supabase = await createClient()

  // Get all orders for this business's events
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      total,
      platform_fee,
      stripe_fee,
      created_at,
      event:events!inner (
        business_id
      )
    `)
    .eq('event.business_id', businessId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching orders for customers:', error)
    throw new Error('Failed to fetch customer data')
  }

  // Get table bookings for this business
  const { data: tableBookings, error: bookingsError } = await supabase
    .from('table_bookings')
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      amount,
      created_at,
      events!inner (
        business_id
      )
    `)
    .eq('events.business_id', businessId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (bookingsError) {
    console.error('Error fetching table bookings for customers:', bookingsError)
  }

  // Get all ratings for this business
  const { data: ratings } = await supabase
    .from('customer_feedback')
    .select('customer_email, rating')
    .eq('business_id', businessId)

  // Group ratings by customer email
  const ratingsMap = new Map<string, number[]>()
  for (const r of ratings || []) {
    const key = r.customer_email.toLowerCase()
    if (!ratingsMap.has(key)) {
      ratingsMap.set(key, [])
    }
    ratingsMap.get(key)!.push(r.rating)
  }

  // Phone number is the unique identifier for customers
  // For customers without phone, use email as fallback identifier
  const phoneToCustomer = new Map<string, Customer>()
  const emailOnlyCustomers = new Map<string, Customer>() // For customers without phone
  let customerIdCounter = 0

  // Helper to find or create customer by phone (primary) or email (fallback)
  const findOrCreateCustomer = (
    email: string | null,
    phone: string | null,
    name: string,
    createdAt: string
  ): Customer => {
    const normalizedEmail = email?.toLowerCase() || null
    const normalizedPhone = phone || null

    // If customer has a phone, use phone as identifier
    if (normalizedPhone) {
      let customer = phoneToCustomer.get(normalizedPhone)

      if (customer) {
        // Add new email to the list if not already present
        if (normalizedEmail && !customer.emails.includes(normalizedEmail)) {
          customer.emails.push(normalizedEmail)
          if (!customer.email) customer.email = email
        }
        return customer
      }

      // Create new customer with phone
      const customerId = `customer-${++customerIdCounter}`

      // Collect ratings from all emails we know about
      const customerRatings = normalizedEmail ? ratingsMap.get(normalizedEmail) : null

      const newCustomer: Customer = {
        id: customerId,
        name,
        email: email || null,
        phone: normalizedPhone,
        emails: normalizedEmail ? [normalizedEmail] : [],
        total_reservations: 0,
        total_tickets: 0,
        total_spent: 0,
        first_purchase: createdAt,
        last_purchase: createdAt,
        average_rating: customerRatings ? customerRatings.reduce((a, b) => a + b, 0) / customerRatings.length : null,
        total_ratings: customerRatings?.length || 0,
      }

      phoneToCustomer.set(normalizedPhone, newCustomer)
      return newCustomer
    }

    // No phone - use email as fallback identifier
    if (normalizedEmail) {
      let customer = emailOnlyCustomers.get(normalizedEmail)

      if (customer) {
        return customer
      }

      // Create new email-only customer
      const customerId = `customer-${++customerIdCounter}`
      const customerRatings = ratingsMap.get(normalizedEmail)

      const newCustomer: Customer = {
        id: customerId,
        name,
        email: email,
        phone: null,
        emails: [normalizedEmail],
        total_reservations: 0,
        total_tickets: 0,
        total_spent: 0,
        first_purchase: createdAt,
        last_purchase: createdAt,
        average_rating: customerRatings ? customerRatings.reduce((a, b) => a + b, 0) / customerRatings.length : null,
        total_ratings: customerRatings?.length || 0,
      }

      emailOnlyCustomers.set(normalizedEmail, newCustomer)
      return newCustomer
    }

    // No phone or email - create anonymous customer (shouldn't happen in practice)
    const customerId = `customer-${++customerIdCounter}`
    return {
      id: customerId,
      name,
      email: null,
      phone: null,
      emails: [],
      total_reservations: 0,
      total_tickets: 0,
      total_spent: 0,
      first_purchase: createdAt,
      last_purchase: createdAt,
      average_rating: null,
      total_ratings: 0,
    }
  }

  // Process ticket orders
  for (const order of orders || []) {
    const customer = findOrCreateCustomer(
      order.customer_email,
      order.customer_phone,
      order.customer_name,
      order.created_at
    )

    const total = parseFloat(order.total?.toString() || '0')
    const platformFee = parseFloat(order.platform_fee?.toString() || '0')
    const stripeFee = parseFloat(order.stripe_fee?.toString() || '0')
    const netRevenue = total - platformFee - stripeFee

    customer.total_tickets += 1
    customer.total_spent += netRevenue

    if (new Date(order.created_at) > new Date(customer.last_purchase)) {
      customer.name = order.customer_name
      customer.last_purchase = order.created_at
    }
    if (new Date(order.created_at) < new Date(customer.first_purchase)) {
      customer.first_purchase = order.created_at
    }
  }

  // Process table bookings
  for (const booking of tableBookings || []) {
    const customer = findOrCreateCustomer(
      booking.customer_email,
      booking.customer_phone,
      booking.customer_name,
      booking.created_at
    )

    const amount = parseFloat(booking.amount?.toString() || '0')

    customer.total_reservations += 1
    customer.total_spent += amount

    if (new Date(booking.created_at) > new Date(customer.last_purchase)) {
      customer.name = booking.customer_name
      customer.last_purchase = booking.created_at
    }
    if (new Date(booking.created_at) < new Date(customer.first_purchase)) {
      customer.first_purchase = booking.created_at
    }
  }

  // Combine all customers and update ratings based on all known emails
  const allCustomers = [
    ...Array.from(phoneToCustomer.values()),
    ...Array.from(emailOnlyCustomers.values()),
  ]

  // Update ratings for customers based on all their known emails
  for (const customer of allCustomers) {
    if (customer.emails.length > 0 && customer.total_ratings === 0) {
      const allRatings: number[] = []
      for (const email of customer.emails) {
        const emailRatings = ratingsMap.get(email)
        if (emailRatings) {
          allRatings.push(...emailRatings)
        }
      }
      if (allRatings.length > 0) {
        customer.average_rating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length
        customer.total_ratings = allRatings.length
      }
    }
  }

  // Sort by total spent (descending)
  return allCustomers.sort((a, b) => b.total_spent - a.total_spent)
}

// Enhanced customer with ratings
export interface CustomerWithRatings extends Customer {
  average_rating: number | null
  total_ratings: number
}

// Get customer details by phone (primary identifier) or email (fallback)
export async function getCustomerWithRatings(
  businessId: string,
  identifier: { phone: string } | { email: string }
): Promise<CustomerWithRatings | null> {
  const supabase = await createClient()
  const emailsSet = new Set<string>()

  let customerPhone: string | null = null

  // If looking up by phone, use it directly
  if ('phone' in identifier) {
    customerPhone = identifier.phone

    // Find all emails associated with this phone
    const { data: phoneOrders } = await supabase
      .from('orders')
      .select('customer_email')
      .eq('status', 'completed')
      .eq('customer_phone', customerPhone)

    const { data: phoneBookings } = await supabase
      .from('table_bookings')
      .select('customer_email')
      .neq('status', 'cancelled')
      .eq('customer_phone', customerPhone)

    for (const o of phoneOrders || []) {
      if (o.customer_email) emailsSet.add(o.customer_email.toLowerCase())
    }
    for (const b of phoneBookings || []) {
      if (b.customer_email) emailsSet.add(b.customer_email.toLowerCase())
    }
  } else {
    // Looking up by email - this is for customers without phone
    emailsSet.add(identifier.email.toLowerCase())
  }

  // Build query based on identifier type
  let ordersQuery = supabase
    .from('orders')
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      total,
      platform_fee,
      stripe_fee,
      created_at,
      event:events!inner (
        business_id
      )
    `)
    .eq('event.business_id', businessId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  let bookingsQuery = supabase
    .from('table_bookings')
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      amount,
      created_at,
      events!inner (
        business_id
      )
    `)
    .eq('events.business_id', businessId)
    .neq('status', 'cancelled')

  if (customerPhone) {
    ordersQuery = ordersQuery.eq('customer_phone', customerPhone)
    bookingsQuery = bookingsQuery.eq('customer_phone', customerPhone)
  } else {
    const emails = Array.from(emailsSet)
    ordersQuery = ordersQuery.in('customer_email', emails)
    bookingsQuery = bookingsQuery.in('customer_email', emails)
  }

  const { data: orders, error: ordersError } = await ordersQuery
  const { data: tableBookings } = await bookingsQuery

  if (ordersError) {
    console.error('Error fetching customer orders:', ordersError)
    return null
  }

  // Aggregate customer data
  let totalTickets = orders?.length || 0
  let totalReservations = tableBookings?.length || 0
  let totalSpent = 0
  let firstPurchase: string | null = null
  let lastPurchase: string | null = null
  let name = ''
  let primaryEmail: string | null = null

  for (const order of orders || []) {
    const total = parseFloat(order.total?.toString() || '0')
    const platformFee = parseFloat(order.platform_fee?.toString() || '0')
    const stripeFee = parseFloat(order.stripe_fee?.toString() || '0')
    totalSpent += total - platformFee - stripeFee

    if (!firstPurchase || new Date(order.created_at) < new Date(firstPurchase)) {
      firstPurchase = order.created_at
    }
    if (!lastPurchase || new Date(order.created_at) > new Date(lastPurchase)) {
      lastPurchase = order.created_at
      name = order.customer_name
      if (order.customer_email) primaryEmail = order.customer_email
    }
    if (order.customer_email) emailsSet.add(order.customer_email.toLowerCase())
    if (!customerPhone && order.customer_phone) customerPhone = order.customer_phone
  }

  for (const booking of tableBookings || []) {
    if (booking.amount) {
      totalSpent += parseFloat(booking.amount.toString())
    }
    if (!firstPurchase || new Date(booking.created_at) < new Date(firstPurchase)) {
      firstPurchase = booking.created_at
    }
    if (!lastPurchase || new Date(booking.created_at) > new Date(lastPurchase)) {
      lastPurchase = booking.created_at
      if (!name) name = booking.customer_name
      if (!primaryEmail && booking.customer_email) primaryEmail = booking.customer_email
    }
    if (booking.customer_email) emailsSet.add(booking.customer_email.toLowerCase())
    if (!customerPhone && booking.customer_phone) customerPhone = booking.customer_phone
  }

  if (!firstPurchase || !lastPurchase) {
    return null
  }

  // Get ratings for all known customer emails
  const allEmails = Array.from(emailsSet)
  const { data: ratings } = allEmails.length > 0
    ? await supabase
        .from('customer_feedback')
        .select('rating')
        .eq('business_id', businessId)
        .in('customer_email', allEmails)
    : { data: [] }

  const averageRating = ratings && ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : null

  return {
    id: customerPhone || primaryEmail?.toLowerCase() || 'unknown',
    name,
    email: primaryEmail,
    phone: customerPhone,
    emails: allEmails,
    total_reservations: totalReservations,
    total_tickets: totalTickets,
    total_spent: totalSpent,
    first_purchase: firstPurchase,
    last_purchase: lastPurchase,
    average_rating: averageRating,
    total_ratings: ratings?.length || 0,
  }
}

// Customer reservation with rating info
export interface CustomerReservation {
  id: string
  event_id: string
  event_title: string
  event_date: string
  event_time: string | null
  section_name: string
  table_number: string | null
  status: string
  amount: number | null
  rating: number | null
  feedback: string | null
  feedback_by: string | null
}

export async function getCustomerReservations(
  businessId: string,
  identifier: { phone: string } | { emails: string[] }
): Promise<{ past: CustomerReservation[]; upcoming: CustomerReservation[] }> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Build query based on identifier type
  let query = supabase
    .from('table_bookings')
    .select(`
      id,
      table_number,
      status,
      amount,
      created_at,
      event_table_section_id,
      event_table_sections!event_table_section_id (
        section_name
      ),
      events!inner (
        id,
        title,
        event_date,
        event_time,
        business_id
      )
    `)
    .eq('events.business_id', businessId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if ('phone' in identifier) {
    query = query.eq('customer_phone', identifier.phone)
  } else {
    query = query.in('customer_email', identifier.emails.map(e => e.toLowerCase()))
  }

  const { data: bookings, error } = await query

  if (error) {
    console.error('Error fetching customer reservations:', error)
    return { past: [], upcoming: [] }
  }

  // Get feedback for these bookings
  const bookingIds = bookings?.map(b => b.id) || []
  const { data: feedbacks } = await supabase
    .from('customer_feedback')
    .select('table_booking_id, rating, feedback, created_by_name')
    .in('table_booking_id', bookingIds)

  const feedbackMap = new Map(feedbacks?.map(f => [f.table_booking_id, f]) || [])

  const reservations: CustomerReservation[] = (bookings || []).map((b: any) => ({
    id: b.id,
    event_id: b.events.id,
    event_title: b.events.title,
    event_date: b.events.event_date,
    event_time: b.events.event_time,
    section_name: b.event_table_sections?.section_name || 'Unknown',
    table_number: b.table_number,
    status: b.status,
    amount: b.amount,
    rating: feedbackMap.get(b.id)?.rating || null,
    feedback: feedbackMap.get(b.id)?.feedback || null,
    feedback_by: feedbackMap.get(b.id)?.created_by_name || null,
  }))

  // Completed reservations always go to past, others based on date
  return {
    past: reservations.filter(r => r.event_date < today || r.status === 'completed'),
    upcoming: reservations.filter(r => r.event_date >= today && r.status !== 'completed'),
  }
}

// Customer ticket purchase
export interface CustomerTicketPurchase {
  id: string
  order_number: string
  event_title: string
  event_date: string
  quantity: number
  total: number
  status: string
  created_at: string
}

export async function getCustomerTicketPurchases(
  businessId: string,
  identifier: { phone: string } | { emails: string[] }
): Promise<CustomerTicketPurchase[]> {
  const supabase = await createClient()

  // Build query based on identifier type
  let query = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      quantity,
      total,
      status,
      created_at,
      events!inner (
        title,
        event_date,
        business_id
      )
    `)
    .eq('events.business_id', businessId)
    .order('created_at', { ascending: false })

  if ('phone' in identifier) {
    query = query.eq('customer_phone', identifier.phone)
  } else {
    query = query.in('customer_email', identifier.emails.map(e => e.toLowerCase()))
  }

  const { data: orders, error } = await query

  if (error) {
    console.error('Error fetching customer ticket purchases:', error)
    return []
  }

  return (orders || []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    event_title: o.events.title,
    event_date: o.events.event_date,
    quantity: o.quantity || 0,
    total: parseFloat(o.total?.toString() || '0'),
    status: o.status,
    created_at: o.created_at,
  }))
}
