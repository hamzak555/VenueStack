-- Add capacity column to event_table_sections table
ALTER TABLE event_table_sections ADD COLUMN IF NOT EXISTS capacity INTEGER;
