-- Add amount field to table_bookings table to track revenue
ALTER TABLE table_bookings ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2);
