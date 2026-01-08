-- Add minimum_spend column to event_table_sections
-- This is the minimum amount customers are required to spend while at the venue
-- It's displayed as information during checkout, not charged at booking time

ALTER TABLE event_table_sections ADD COLUMN IF NOT EXISTS minimum_spend DECIMAL(10,2) DEFAULT 0;
