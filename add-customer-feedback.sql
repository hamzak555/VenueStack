-- Create customer_feedback table to store ratings attached to completed reservations
CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_booking_id)
);

-- Add indexes for common queries
CREATE INDEX idx_customer_feedback_business_id ON customer_feedback(business_id);
CREATE INDEX idx_customer_feedback_customer_email ON customer_feedback(customer_email);
CREATE INDEX idx_customer_feedback_created_at ON customer_feedback(created_at);

-- Add 'completed' to table_bookings status
ALTER TABLE table_bookings DROP CONSTRAINT IF EXISTS table_bookings_status_check;
ALTER TABLE table_bookings ADD CONSTRAINT table_bookings_status_check
  CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'arrived', 'completed'));
