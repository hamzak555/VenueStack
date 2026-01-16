-- Add tracking columns to refunds table
-- Records who processed each refund and whether tickets were voided

-- Add refunded_by_id column (references users table)
ALTER TABLE refunds
ADD COLUMN IF NOT EXISTS refunded_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add refunded_by_name column (stores name for display)
ALTER TABLE refunds
ADD COLUMN IF NOT EXISTS refunded_by_name TEXT;

-- Add voided_tickets column (whether tickets were voided with this refund)
ALTER TABLE refunds
ADD COLUMN IF NOT EXISTS voided_tickets BOOLEAN DEFAULT FALSE;

-- Add reservation_number column to table_bookings
-- Short, human-readable reservation number (e.g., TB1234567)
ALTER TABLE table_bookings
ADD COLUMN IF NOT EXISTS reservation_number TEXT;

-- Create unique index on reservation_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_bookings_reservation_number
ON table_bookings(reservation_number) WHERE reservation_number IS NOT NULL;

-- Add tracking columns to table_booking_refunds table
-- Note: refunded_by_id is stored without foreign key constraint since the users table
-- may have different structure depending on auth setup
ALTER TABLE table_booking_refunds
ADD COLUMN IF NOT EXISTS refunded_by_id UUID;

ALTER TABLE table_booking_refunds
ADD COLUMN IF NOT EXISTS refunded_by_name TEXT;

-- Drop the foreign key constraint if it exists (it may have been added previously)
ALTER TABLE table_booking_refunds
DROP CONSTRAINT IF EXISTS table_booking_refunds_refunded_by_id_fkey;

-- Add order_id column if it doesn't exist (needed for multi-table order refund lookups)
ALTER TABLE table_booking_refunds
ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Create index on order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_booking_refunds_order_id
ON table_booking_refunds(order_id) WHERE order_id IS NOT NULL;
