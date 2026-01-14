-- =====================================================
-- VenueStack Database Optimization: Denormalization
-- Run this migration AFTER creating a backup
-- =====================================================

-- This migration adds denormalized columns to improve query performance
-- These are OPTIONAL - existing queries continue to work via JOINs

-- =====================================================
-- 1. ADD business_id TO ORDERS TABLE
-- =====================================================

-- Add the column (nullable initially for existing data)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id UUID;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_business_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate for existing orders
UPDATE orders
SET business_id = events.business_id
FROM events
WHERE orders.event_id = events.id
AND orders.business_id IS NULL;

-- Create index for fast business lookups
CREATE INDEX IF NOT EXISTS idx_orders_business
  ON orders(business_id);

-- Composite index for business analytics
CREATE INDEX IF NOT EXISTS idx_orders_business_created
  ON orders(business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_business_status
  ON orders(business_id, status);

-- =====================================================
-- 2. ADD business_id TO TABLE_BOOKINGS TABLE
-- =====================================================

-- Add the column
ALTER TABLE table_bookings ADD COLUMN IF NOT EXISTS business_id UUID;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'table_bookings_business_id_fkey'
  ) THEN
    ALTER TABLE table_bookings
      ADD CONSTRAINT table_bookings_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate for existing bookings
UPDATE table_bookings
SET business_id = events.business_id
FROM events
WHERE table_bookings.event_id = events.id
AND table_bookings.business_id IS NULL;

-- Create index for fast business lookups
CREATE INDEX IF NOT EXISTS idx_table_bookings_business
  ON table_bookings(business_id);

-- Composite index for business analytics
CREATE INDEX IF NOT EXISTS idx_table_bookings_business_created
  ON table_bookings(business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_table_bookings_business_status
  ON table_bookings(business_id, status);

-- =====================================================
-- 3. ADD business_id TO TICKETS TABLE
-- =====================================================

-- Add the column
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS business_id UUID;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_business_id_fkey'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate for existing tickets
UPDATE tickets
SET business_id = events.business_id
FROM events
WHERE tickets.event_id = events.id
AND tickets.business_id IS NULL;

-- Create index for fast business lookups
CREATE INDEX IF NOT EXISTS idx_tickets_business
  ON tickets(business_id);

-- =====================================================
-- 4. DATABASE FUNCTION: Auto-populate business_id on INSERT
-- =====================================================

-- Function to set business_id from event on order insert
CREATE OR REPLACE FUNCTION set_order_business_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    SELECT business_id INTO NEW.business_id
    FROM events
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for orders
DROP TRIGGER IF EXISTS trigger_set_order_business_id ON orders;
CREATE TRIGGER trigger_set_order_business_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_business_id();

-- Function to set business_id from event on table_booking insert
CREATE OR REPLACE FUNCTION set_table_booking_business_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    SELECT business_id INTO NEW.business_id
    FROM events
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for table_bookings
DROP TRIGGER IF EXISTS trigger_set_table_booking_business_id ON table_bookings;
CREATE TRIGGER trigger_set_table_booking_business_id
  BEFORE INSERT ON table_bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_table_booking_business_id();

-- Function to set business_id from event on ticket insert
CREATE OR REPLACE FUNCTION set_ticket_business_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    SELECT business_id INTO NEW.business_id
    FROM events
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tickets
DROP TRIGGER IF EXISTS trigger_set_ticket_business_id ON tickets;
CREATE TRIGGER trigger_set_ticket_business_id
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_business_id();

-- =====================================================
-- 5. UNIQUE CONSTRAINTS
-- =====================================================

-- Unique business slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_slug_unique'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- Unique tracking link ref_code per business
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracking_links_business_ref_unique'
  ) THEN
    ALTER TABLE tracking_links
      ADD CONSTRAINT tracking_links_business_ref_unique UNIQUE (business_id, ref_code);
  END IF;
END $$;

-- Unique promo code per event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_event_code_unique'
  ) THEN
    ALTER TABLE promo_codes
      ADD CONSTRAINT promo_codes_event_code_unique UNIQUE (event_id, code);
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check denormalized columns were populated:
-- SELECT COUNT(*) as total, COUNT(business_id) as with_business_id FROM orders;
-- SELECT COUNT(*) as total, COUNT(business_id) as with_business_id FROM table_bookings;
-- SELECT COUNT(*) as total, COUNT(business_id) as with_business_id FROM tickets;

-- Check triggers are installed:
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public';
