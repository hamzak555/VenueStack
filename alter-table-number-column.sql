-- Migration: Change table_number column from INTEGER NOT NULL to TEXT (nullable)
-- This allows custom table names like "A1", "VIP 1", etc. and allows null for unassigned tables

-- First, drop the unique constraint that includes table_number
ALTER TABLE table_bookings DROP CONSTRAINT IF EXISTS table_bookings_event_table_section_id_table_number_key;

-- Change the column type from INTEGER to TEXT and allow NULL
ALTER TABLE table_bookings
  ALTER COLUMN table_number DROP NOT NULL,
  ALTER COLUMN table_number TYPE TEXT USING table_number::TEXT;

-- Re-add a unique constraint (only when table_number is not null)
CREATE UNIQUE INDEX IF NOT EXISTS table_bookings_section_table_unique
  ON table_bookings (event_table_section_id, table_number)
  WHERE table_number IS NOT NULL AND status != 'cancelled';
