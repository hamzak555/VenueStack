-- Create table_booking_refunds table to track refunds for table bookings
CREATE TABLE IF NOT EXISTS table_booking_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL, -- The payment intent ID shared by all bookings in the same order
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  stripe_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_table_booking_refunds_booking_id ON table_booking_refunds(table_booking_id);
CREATE INDEX IF NOT EXISTS idx_table_booking_refunds_order_id ON table_booking_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_table_booking_refunds_status ON table_booking_refunds(status);
