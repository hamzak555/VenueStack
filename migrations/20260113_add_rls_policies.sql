-- =====================================================
-- VenueStack Database Security: Row Level Security
-- Run this migration AFTER creating a backup
-- =====================================================

-- NOTE: This application uses custom JWT-based auth (not Supabase Auth)
-- and the server uses the anon key. RLS is enabled with permissive policies
-- to allow the application layer to handle authorization.

-- USERS TABLE
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);

-- BUSINESS_USERS TABLE
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to business_users" ON business_users FOR ALL USING (true) WITH CHECK (true);

-- BUSINESSES TABLE
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);

-- EVENTS TABLE
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to events" ON events FOR ALL USING (true) WITH CHECK (true);

-- TICKET_TYPES TABLE
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ticket_types" ON ticket_types FOR ALL USING (true) WITH CHECK (true);

-- TICKETS TABLE
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);

-- ORDERS TABLE
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to orders" ON orders FOR ALL USING (true) WITH CHECK (true);

-- ORDER_ITEMS TABLE
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- TABLE_BOOKINGS TABLE
ALTER TABLE table_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to table_bookings" ON table_bookings FOR ALL USING (true) WITH CHECK (true);

-- EVENT_TABLE_SECTIONS TABLE
ALTER TABLE event_table_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to event_table_sections" ON event_table_sections FOR ALL USING (true) WITH CHECK (true);

-- BOOKING_NOTES TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'booking_notes') THEN
    ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all access to booking_notes" ON booking_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- CUSTOMER_FEEDBACK TABLE
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to customer_feedback" ON customer_feedback FOR ALL USING (true) WITH CHECK (true);

-- PROMO_CODES TABLE
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to promo_codes" ON promo_codes FOR ALL USING (true) WITH CHECK (true);

-- TRACKING_LINKS TABLE
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tracking_links" ON tracking_links FOR ALL USING (true) WITH CHECK (true);

-- INVITATIONS TABLE
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to invitations" ON invitations FOR ALL USING (true) WITH CHECK (true);

-- ADMIN_INVITATIONS TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_invitations') THEN
    ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all access to admin_invitations" ON admin_invitations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ADMIN_USERS TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'admin_users') THEN
    ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all access to admin_users" ON admin_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- LOGIN_LOGS TABLE
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to login_logs" ON login_logs FOR ALL USING (true) WITH CHECK (true);

-- PLATFORM_SETTINGS TABLE
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to platform_settings" ON platform_settings FOR ALL USING (true) WITH CHECK (true);

-- PAGE_VIEWS TABLE
DROP POLICY IF EXISTS "Business users can view their page views" ON page_views;
DROP POLICY IF EXISTS "Anyone can insert page views" ON page_views;
CREATE POLICY "Allow all access to page_views" ON page_views FOR ALL USING (true) WITH CHECK (true);
