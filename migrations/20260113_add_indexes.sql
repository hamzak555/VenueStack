-- =====================================================
-- VenueStack Database Optimization: Indexes
-- Run this migration AFTER creating a backup
-- =====================================================

-- This migration adds indexes to improve query performance
-- All indexes are non-breaking and additive

-- =====================================================
-- 1. ORDERS TABLE INDEXES
-- =====================================================

-- Index for filtering orders by event and status (revenue calculations)
CREATE INDEX IF NOT EXISTS idx_orders_event_status
  ON orders(event_id, status);

-- Index for customer lookup by email
CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders(customer_email);

-- Index for customer lookup by phone
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone
  ON orders(customer_phone)
  WHERE customer_phone IS NOT NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_event_created
  ON orders(event_id, created_at);

-- Index for tracking link analytics
CREATE INDEX IF NOT EXISTS idx_orders_tracking_ref
  ON orders(tracking_ref)
  WHERE tracking_ref IS NOT NULL;

-- =====================================================
-- 2. TABLE_BOOKINGS INDEXES
-- =====================================================

-- Index for filtering bookings by event and status
CREATE INDEX IF NOT EXISTS idx_table_bookings_event_status
  ON table_bookings(event_id, status);

-- Index for customer lookup by email
CREATE INDEX IF NOT EXISTS idx_table_bookings_customer_email
  ON table_bookings(customer_email);

-- Index for customer lookup by phone
CREATE INDEX IF NOT EXISTS idx_table_bookings_customer_phone
  ON table_bookings(customer_phone)
  WHERE customer_phone IS NOT NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_table_bookings_created_at
  ON table_bookings(created_at);

-- Index for tracking link analytics
CREATE INDEX IF NOT EXISTS idx_table_bookings_tracking_ref
  ON table_bookings(tracking_ref)
  WHERE tracking_ref IS NOT NULL;

-- Index for section lookups
CREATE INDEX IF NOT EXISTS idx_table_bookings_section
  ON table_bookings(event_table_section_id);

-- =====================================================
-- 3. EVENTS TABLE INDEXES
-- =====================================================

-- Index for business timeline queries
CREATE INDEX IF NOT EXISTS idx_events_business_date
  ON events(business_id, event_date);

-- Index for published events listing
CREATE INDEX IF NOT EXISTS idx_events_status_date
  ON events(status, event_date);

-- Index for recurring event lookups
CREATE INDEX IF NOT EXISTS idx_events_parent_id
  ON events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

-- =====================================================
-- 4. TICKETS TABLE INDEXES
-- =====================================================

-- Index for ticket inventory checks
CREATE INDEX IF NOT EXISTS idx_tickets_event_status
  ON tickets(event_id, status);

-- Index for order ticket lookups
CREATE INDEX IF NOT EXISTS idx_tickets_order_id
  ON tickets(order_id)
  WHERE order_id IS NOT NULL;

-- Index for ticket type lookups
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type
  ON tickets(ticket_type_id)
  WHERE ticket_type_id IS NOT NULL;

-- =====================================================
-- 5. TICKET_TYPES TABLE INDEXES
-- =====================================================

-- Index for event ticket types with display order
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_order
  ON ticket_types(event_id, display_order);

-- =====================================================
-- 6. BUSINESS_USERS TABLE INDEXES
-- =====================================================

-- Index for business user lookups
CREATE INDEX IF NOT EXISTS idx_business_users_business_email
  ON business_users(business_id, email);

-- Index for user_id foreign key lookups
CREATE INDEX IF NOT EXISTS idx_business_users_user_id
  ON business_users(user_id)
  WHERE user_id IS NOT NULL;

-- Index for active users per business
CREATE INDEX IF NOT EXISTS idx_business_users_business_active
  ON business_users(business_id, is_active);

-- =====================================================
-- 7. INVITATIONS TABLE INDEXES
-- =====================================================

-- Index for invitation lookups by business and email
CREATE INDEX IF NOT EXISTS idx_invitations_business_email
  ON invitations(business_id, email)
  WHERE email IS NOT NULL;

-- Index for pending invitations
CREATE INDEX IF NOT EXISTS idx_invitations_business_status
  ON invitations(business_id, status);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON invitations(token);

-- =====================================================
-- 8. TRACKING_LINKS TABLE INDEXES
-- =====================================================

-- Index for tracking link validation
CREATE INDEX IF NOT EXISTS idx_tracking_links_business_ref
  ON tracking_links(business_id, ref_code);

-- Index for active tracking links
CREATE INDEX IF NOT EXISTS idx_tracking_links_business_active
  ON tracking_links(business_id, is_active);

-- =====================================================
-- 9. EVENT_TABLE_SECTIONS TABLE INDEXES
-- =====================================================

-- Index for event section lookups
CREATE INDEX IF NOT EXISTS idx_event_table_sections_event
  ON event_table_sections(event_id);

-- =====================================================
-- 10. CUSTOMER_FEEDBACK TABLE INDEXES
-- =====================================================

-- Index for business feedback lookups
CREATE INDEX IF NOT EXISTS idx_customer_feedback_business
  ON customer_feedback(business_id);

-- Index for booking feedback lookups
CREATE INDEX IF NOT EXISTS idx_customer_feedback_booking
  ON customer_feedback(table_booking_id);

-- Index for customer email feedback
CREATE INDEX IF NOT EXISTS idx_customer_feedback_email
  ON customer_feedback(customer_email);

-- =====================================================
-- 11. LOGIN_LOGS TABLE INDEXES
-- =====================================================

-- Index for user login history
CREATE INDEX IF NOT EXISTS idx_login_logs_user
  ON login_logs(user_id, created_at);

-- Index for business login activity
CREATE INDEX IF NOT EXISTS idx_login_logs_business
  ON login_logs(business_id, created_at)
  WHERE business_id IS NOT NULL;

-- =====================================================
-- 12. USERS TABLE INDEXES
-- =====================================================

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Index for phone lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone)
  WHERE phone IS NOT NULL;

-- =====================================================
-- 13. PROMO_CODES TABLE INDEXES
-- =====================================================

-- Index for event promo codes
CREATE INDEX IF NOT EXISTS idx_promo_codes_event_active
  ON promo_codes(event_id, is_active);

-- Index for code lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_event_code
  ON promo_codes(event_id, code);

-- =====================================================
-- 14. ORDER_ITEMS TABLE INDEXES
-- =====================================================

-- Index for order item lookups
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Run this to verify indexes were created:
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
