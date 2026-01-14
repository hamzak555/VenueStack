-- =====================================================
-- VenueStack Database Optimization: RPC Functions
-- Run this migration AFTER creating a backup
-- =====================================================

-- These functions provide atomic operations to prevent race conditions

-- =====================================================
-- 1. ATOMIC TICKET QUANTITY DECREMENT
-- =====================================================

-- Safely decrement available_quantity with a minimum of 0
CREATE OR REPLACE FUNCTION decrement_ticket_quantity(
  ticket_type_id UUID,
  quantity INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_quantity INTEGER;
BEGIN
  UPDATE ticket_types
  SET available_quantity = GREATEST(available_quantity - quantity, 0)
  WHERE id = ticket_type_id
  RETURNING available_quantity INTO new_quantity;

  RETURN new_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. ATOMIC TABLE AVAILABILITY DECREMENT
-- =====================================================

-- Safely decrement available_tables with a minimum of 0
CREATE OR REPLACE FUNCTION decrement_table_quantity(
  section_id UUID,
  quantity INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  new_quantity INTEGER;
BEGIN
  UPDATE event_table_sections
  SET available_tables = GREATEST(available_tables - quantity, 0)
  WHERE id = section_id
  RETURNING available_tables INTO new_quantity;

  RETURN new_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. ATOMIC PROMO CODE USAGE INCREMENT
-- =====================================================

-- Safely increment promo code usage
CREATE OR REPLACE FUNCTION increment_promo_code_usage(
  promo_code_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  new_uses INTEGER;
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = promo_code_id
  RETURNING current_uses INTO new_uses;

  RETURN new_uses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. BATCH FETCH TICKET TYPES
-- =====================================================

-- Get multiple ticket types in one query (prevents N+1)
CREATE OR REPLACE FUNCTION get_ticket_types_batch(
  ticket_type_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  name TEXT,
  price DECIMAL,
  total_quantity INTEGER,
  available_quantity INTEGER,
  max_per_customer INTEGER,
  display_order INTEGER,
  sale_start_date TIMESTAMPTZ,
  sale_end_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tt.id,
    tt.event_id,
    tt.name,
    tt.price,
    tt.total_quantity,
    tt.available_quantity,
    tt.max_per_customer,
    tt.display_order,
    tt.sale_start_date,
    tt.sale_end_date
  FROM ticket_types tt
  WHERE tt.id = ANY(ticket_type_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CUSTOMER AGGREGATION (Database-level)
-- =====================================================

-- Aggregate customer data from orders and table_bookings
-- This replaces the JavaScript aggregation in customers.ts
CREATE OR REPLACE FUNCTION get_customer_summary(
  p_business_id UUID
)
RETURNS TABLE (
  identifier TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  total_reservations BIGINT,
  total_tickets BIGINT,
  total_spent DECIMAL,
  first_purchase TIMESTAMPTZ,
  last_purchase TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH order_customers AS (
    SELECT
      COALESCE(o.customer_phone, o.customer_email) as identifier,
      o.customer_name as name,
      o.customer_email as email,
      o.customer_phone as phone,
      0::BIGINT as reservations,
      COALESCE(SUM(o.quantity), 0)::BIGINT as tickets,
      COALESCE(SUM(o.total - COALESCE(o.platform_fee, 0) - COALESCE(o.stripe_fee, 0)), 0) as spent,
      MIN(o.created_at) as first_purchase,
      MAX(o.created_at) as last_purchase
    FROM orders o
    JOIN events e ON o.event_id = e.id
    WHERE e.business_id = p_business_id
    AND o.status = 'completed'
    GROUP BY COALESCE(o.customer_phone, o.customer_email), o.customer_name, o.customer_email, o.customer_phone
  ),
  booking_customers AS (
    SELECT
      COALESCE(tb.customer_phone, tb.customer_email) as identifier,
      tb.customer_name as name,
      tb.customer_email as email,
      tb.customer_phone as phone,
      COUNT(*)::BIGINT as reservations,
      0::BIGINT as tickets,
      COALESCE(SUM(tb.amount), 0) as spent,
      MIN(tb.created_at) as first_purchase,
      MAX(tb.created_at) as last_purchase
    FROM table_bookings tb
    JOIN events e ON tb.event_id = e.id
    WHERE e.business_id = p_business_id
    AND tb.status != 'cancelled'
    GROUP BY COALESCE(tb.customer_phone, tb.customer_email), tb.customer_name, tb.customer_email, tb.customer_phone
  ),
  combined AS (
    SELECT * FROM order_customers
    UNION ALL
    SELECT * FROM booking_customers
  )
  SELECT
    c.identifier,
    MAX(c.name) as name,
    MAX(c.email) as email,
    MAX(c.phone) as phone,
    SUM(c.reservations)::BIGINT as total_reservations,
    SUM(c.tickets)::BIGINT as total_tickets,
    SUM(c.spent) as total_spent,
    MIN(c.first_purchase) as first_purchase,
    MAX(c.last_purchase) as last_purchase
  FROM combined c
  WHERE c.identifier IS NOT NULL
  GROUP BY c.identifier
  ORDER BY SUM(c.spent) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. EVENT ANALYTICS (Database-level aggregation)
-- =====================================================

-- Get event analytics without N+1 queries
CREATE OR REPLACE FUNCTION get_event_analytics(
  p_business_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  event_id UUID,
  event_title TEXT,
  event_date DATE,
  event_status TEXT,
  total_orders BIGINT,
  total_tickets_sold BIGINT,
  ticket_gross_revenue DECIMAL,
  ticket_net_revenue DECIMAL,
  ticket_fees DECIMAL,
  ticket_tax DECIMAL,
  total_table_bookings BIGINT,
  table_revenue DECIMAL,
  table_tax DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH order_stats AS (
    SELECT
      o.event_id,
      COUNT(*)::BIGINT as order_count,
      COALESCE(SUM(o.quantity), 0)::BIGINT as tickets_sold,
      COALESCE(SUM(o.total), 0) as gross_revenue,
      COALESCE(SUM(o.total - COALESCE(o.platform_fee, 0) - COALESCE(o.stripe_fee, 0)), 0) as net_revenue,
      COALESCE(SUM(COALESCE(o.platform_fee, 0) + COALESCE(o.stripe_fee, 0)), 0) as fees,
      COALESCE(SUM(COALESCE(o.tax_amount, 0)), 0) as tax
    FROM orders o
    WHERE o.status = 'completed'
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    GROUP BY o.event_id
  ),
  booking_stats AS (
    SELECT
      tb.event_id,
      COUNT(*)::BIGINT as booking_count,
      COALESCE(SUM(tb.amount), 0) as revenue,
      COALESCE(SUM(COALESCE(tb.tax_amount, 0)), 0) as tax
    FROM table_bookings tb
    WHERE tb.status IN ('confirmed', 'arrived', 'seated', 'completed')
    AND (p_date_from IS NULL OR tb.created_at >= p_date_from)
    AND (p_date_to IS NULL OR tb.created_at <= p_date_to)
    GROUP BY tb.event_id
  )
  SELECT
    e.id as event_id,
    e.title as event_title,
    e.event_date::DATE,
    e.status as event_status,
    COALESCE(os.order_count, 0) as total_orders,
    COALESCE(os.tickets_sold, 0) as total_tickets_sold,
    COALESCE(os.gross_revenue, 0) as ticket_gross_revenue,
    COALESCE(os.net_revenue, 0) as ticket_net_revenue,
    COALESCE(os.fees, 0) as ticket_fees,
    COALESCE(os.tax, 0) as ticket_tax,
    COALESCE(bs.booking_count, 0) as total_table_bookings,
    COALESCE(bs.revenue, 0) as table_revenue,
    COALESCE(bs.tax, 0) as table_tax
  FROM events e
  LEFT JOIN order_stats os ON e.id = os.event_id
  LEFT JOIN booking_stats bs ON e.id = bs.event_id
  WHERE e.business_id = p_business_id
  ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Test the functions:
-- SELECT * FROM decrement_ticket_quantity('ticket-type-uuid', 1);
-- SELECT * FROM get_customer_summary('business-uuid');
-- SELECT * FROM get_event_analytics('business-uuid');
