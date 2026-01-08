-- Add completed_table_number to table_bookings for historical reference
-- This stores what table the customer was seated at when the reservation was completed
-- We clear table_number to free up the table, but keep this for display purposes

ALTER TABLE table_bookings ADD COLUMN IF NOT EXISTS completed_table_number VARCHAR(50);
