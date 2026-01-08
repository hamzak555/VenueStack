-- Add max_per_customer column to event_table_sections table
ALTER TABLE event_table_sections ADD COLUMN IF NOT EXISTS max_per_customer INTEGER;
