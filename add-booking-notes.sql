-- Add table_booking_notes table for tracking notes on reservations
CREATE TABLE IF NOT EXISTS table_booking_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by booking
CREATE INDEX IF NOT EXISTS idx_table_booking_notes_booking_id ON table_booking_notes(table_booking_id);

-- Create index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_table_booking_notes_created_at ON table_booking_notes(created_at DESC);
