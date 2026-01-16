-- Add fee payer columns to orders table to track who paid the fees at time of purchase
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stripe_fee_payer VARCHAR(20) DEFAULT 'customer',
ADD COLUMN IF NOT EXISTS platform_fee_payer VARCHAR(20) DEFAULT 'customer';

-- Add fee payer columns to table_bookings table
ALTER TABLE table_bookings
ADD COLUMN IF NOT EXISTS stripe_fee_payer VARCHAR(20) DEFAULT 'customer',
ADD COLUMN IF NOT EXISTS platform_fee_payer VARCHAR(20) DEFAULT 'customer';

-- Add comments explaining the columns
COMMENT ON COLUMN orders.stripe_fee_payer IS 'Who paid the Stripe processing fee at time of purchase: customer or business';
COMMENT ON COLUMN orders.platform_fee_payer IS 'Who paid the platform fee at time of purchase: customer or business';
COMMENT ON COLUMN table_bookings.stripe_fee_payer IS 'Who paid the Stripe processing fee at time of booking: customer or business';
COMMENT ON COLUMN table_bookings.platform_fee_payer IS 'Who paid the platform fee at time of booking: customer or business';
