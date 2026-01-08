-- Add timezone fields to businesses and events tables

-- Add default_timezone to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(50) DEFAULT 'America/Los_Angeles';

-- Add timezone to events table (auto-detected from location or inherited from business)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Update existing events to use business default timezone
UPDATE events e
SET timezone = b.default_timezone
FROM businesses b
WHERE e.business_id = b.id
AND e.timezone IS NULL;
