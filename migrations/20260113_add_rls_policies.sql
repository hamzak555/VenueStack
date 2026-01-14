-- =====================================================
-- VenueStack Database Security: Row Level Security
-- Run this migration AFTER creating a backup
-- =====================================================

-- IMPORTANT: This application uses custom JWT-based auth (not Supabase Auth)
-- RLS policies are designed to work with the service role key for server-side access
-- and protect against unauthorized direct API access with anon key

-- =====================================================
-- HELPER FUNCTION: Check if request is from service role
-- =====================================================

-- Create a function to check if the current role is service_role
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_user = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 1. USERS TABLE
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for server-side operations)
CREATE POLICY "Service role full access to users"
  ON users FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon role cannot access users directly
CREATE POLICY "Anon cannot access users"
  ON users FOR SELECT
  USING (false);

-- =====================================================
-- 2. BUSINESS_USERS TABLE
-- =====================================================

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to business_users"
  ON business_users FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access business_users
CREATE POLICY "Anon cannot access business_users"
  ON business_users FOR SELECT
  USING (false);

-- =====================================================
-- 3. BUSINESSES TABLE
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to businesses"
  ON businesses FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can read active businesses (for public pages)
CREATE POLICY "Anon can read active businesses"
  ON businesses FOR SELECT
  USING (is_active = true);

-- =====================================================
-- 4. EVENTS TABLE
-- =====================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to events"
  ON events FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can read published events (for public event pages)
CREATE POLICY "Anon can read published events"
  ON events FOR SELECT
  USING (status = 'published');

-- =====================================================
-- 5. TICKET_TYPES TABLE
-- =====================================================

ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to ticket_types"
  ON ticket_types FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can read ticket types for published events (for checkout)
CREATE POLICY "Anon can read ticket_types for published events"
  ON ticket_types FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = ticket_types.event_id
      AND events.status = 'published'
    )
  );

-- =====================================================
-- 6. TICKETS TABLE
-- =====================================================

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to tickets"
  ON tickets FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access tickets directly
CREATE POLICY "Anon cannot access tickets"
  ON tickets FOR SELECT
  USING (false);

-- =====================================================
-- 7. ORDERS TABLE
-- =====================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to orders"
  ON orders FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot read orders (contains PII)
CREATE POLICY "Anon cannot access orders"
  ON orders FOR SELECT
  USING (false);

-- =====================================================
-- 8. ORDER_ITEMS TABLE
-- =====================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to order_items"
  ON order_items FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access order_items
CREATE POLICY "Anon cannot access order_items"
  ON order_items FOR SELECT
  USING (false);

-- =====================================================
-- 9. TABLE_BOOKINGS TABLE
-- =====================================================

ALTER TABLE table_bookings ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to table_bookings"
  ON table_bookings FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access table_bookings (contains PII)
CREATE POLICY "Anon cannot access table_bookings"
  ON table_bookings FOR SELECT
  USING (false);

-- =====================================================
-- 10. EVENT_TABLE_SECTIONS TABLE
-- =====================================================

ALTER TABLE event_table_sections ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to event_table_sections"
  ON event_table_sections FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can read sections for published events (for booking flow)
CREATE POLICY "Anon can read sections for published events"
  ON event_table_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_table_sections.event_id
      AND events.status = 'published'
    )
  );

-- =====================================================
-- 11. BOOKING_NOTES TABLE
-- =====================================================

-- Check if table exists first
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'booking_notes') THEN
    ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Service role full access to booking_notes"
      ON booking_notes FOR ALL
      USING (is_service_role())
      WITH CHECK (is_service_role());

    CREATE POLICY "Anon cannot access booking_notes"
      ON booking_notes FOR SELECT
      USING (false);
  END IF;
END $$;

-- =====================================================
-- 12. CUSTOMER_FEEDBACK TABLE
-- =====================================================

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to customer_feedback"
  ON customer_feedback FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access customer_feedback
CREATE POLICY "Anon cannot access customer_feedback"
  ON customer_feedback FOR SELECT
  USING (false);

-- =====================================================
-- 13. PROMO_CODES TABLE
-- =====================================================

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to promo_codes"
  ON promo_codes FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can check active promo codes for published events (validation at checkout)
CREATE POLICY "Anon can read active promo_codes for validation"
  ON promo_codes FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM events
      WHERE events.id = promo_codes.event_id
      AND events.status = 'published'
    )
  );

-- =====================================================
-- 14. TRACKING_LINKS TABLE
-- =====================================================

ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to tracking_links"
  ON tracking_links FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access tracking_links
CREATE POLICY "Anon cannot access tracking_links"
  ON tracking_links FOR SELECT
  USING (false);

-- =====================================================
-- 15. INVITATIONS TABLE
-- =====================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to invitations"
  ON invitations FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can read pending invitations by token (for accepting)
CREATE POLICY "Anon can read invitations by token"
  ON invitations FOR SELECT
  USING (status = 'pending');

-- =====================================================
-- 16. ADMIN_INVITATIONS TABLE
-- =====================================================

-- Check if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_invitations') THEN
    ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Service role full access to admin_invitations"
      ON admin_invitations FOR ALL
      USING (is_service_role())
      WITH CHECK (is_service_role());

    CREATE POLICY "Anon can read pending admin_invitations by token"
      ON admin_invitations FOR SELECT
      USING (status = 'pending');
  END IF;
END $$;

-- =====================================================
-- 17. ADMIN_USERS TABLE
-- =====================================================

-- Check if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_users') THEN
    ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Service role full access to admin_users"
      ON admin_users FOR ALL
      USING (is_service_role())
      WITH CHECK (is_service_role());

    CREATE POLICY "Anon cannot access admin_users"
      ON admin_users FOR SELECT
      USING (false);
  END IF;
END $$;

-- =====================================================
-- 18. LOGIN_LOGS TABLE
-- =====================================================

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to login_logs"
  ON login_logs FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon cannot access login_logs
CREATE POLICY "Anon cannot access login_logs"
  ON login_logs FOR SELECT
  USING (false);

-- =====================================================
-- 19. PLATFORM_SETTINGS TABLE
-- =====================================================

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to platform_settings"
  ON platform_settings FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Anon can read platform settings (needed for fee calculations)
CREATE POLICY "Anon can read platform_settings"
  ON platform_settings FOR SELECT
  USING (true);

-- =====================================================
-- 20. PAGE_VIEWS TABLE (Already has RLS, update policies)
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Business users can view their page views" ON page_views;

-- Service role has full access
CREATE POLICY "Service role full access to page_views"
  ON page_views FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Keep insert policy for public tracking (already exists)
-- "Anyone can insert page views"

-- Anon can only read page views for their visitor_id (not others' data)
CREATE POLICY "Anon can only read own page views"
  ON page_views FOR SELECT
  USING (false);  -- Server handles all reads

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
