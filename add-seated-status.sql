-- Add 'seated' status to table_bookings
-- This status is for reservations that have been placed on a table

-- Drop the existing constraint and add a new one with 'seated' status
ALTER TABLE table_bookings DROP CONSTRAINT IF EXISTS table_bookings_status_check;
ALTER TABLE table_bookings ADD CONSTRAINT table_bookings_status_check
  CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'arrived', 'seated', 'completed'));
