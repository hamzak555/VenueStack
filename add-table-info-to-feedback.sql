-- Add table_number and section_name to customer_feedback for historical reference
-- This stores what table the customer was seated at when the reservation was completed

ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS table_number VARCHAR(50);
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS section_name VARCHAR(255);
