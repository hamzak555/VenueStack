-- Add processing fee columns to table_bookings table
-- These track the platform fee and stripe fee for each table booking

ALTER TABLE table_bookings
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_fee DECIMAL(10, 2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN table_bookings.platform_fee IS 'Platform fee charged for this booking';
COMMENT ON COLUMN table_bookings.stripe_fee IS 'Stripe processing fee for this booking';
