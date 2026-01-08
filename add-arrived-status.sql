-- Add 'arrived' to the status check constraint on table_bookings
-- First drop the existing constraint, then add a new one with 'arrived' included

ALTER TABLE table_bookings DROP CONSTRAINT IF EXISTS table_bookings_status_check;
ALTER TABLE table_bookings ADD CONSTRAINT table_bookings_status_check
  CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'arrived'));
