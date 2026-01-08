-- Add recurrence fields to events table for recurring events support

-- Add recurrence_rule column (JSONB for flexible storage of recurrence configuration)
-- Structure: { type, interval, daysOfWeek, dayOfMonth, weekOfMonth, monthOfYear, endType, endDate, endCount }
ALTER TABLE events
ADD COLUMN IF NOT EXISTS recurrence_rule JSONB DEFAULT NULL;

-- Add parent_event_id for linking recurring event instances to their parent/template event
ALTER TABLE events
ADD COLUMN IF NOT EXISTS parent_event_id UUID DEFAULT NULL REFERENCES events(id) ON DELETE SET NULL;

-- Add index for efficient parent event lookups
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id);

-- Add comments for documentation
COMMENT ON COLUMN events.recurrence_rule IS 'JSON object containing recurrence configuration. Structure: { type: "none"|"daily"|"weekly"|"monthly"|"yearly"|"weekdays"|"custom", interval: number, daysOfWeek?: number[], dayOfMonth?: number, weekOfMonth?: number, monthOfYear?: number, endType: "never"|"date"|"count", endDate?: string, endCount?: number }';

COMMENT ON COLUMN events.parent_event_id IS 'For recurring event instances, points to the parent/template event. NULL for standalone events and parent events.';
