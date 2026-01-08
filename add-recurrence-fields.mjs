import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addRecurrenceFields() {
  console.log('Adding recurrence fields to events table...')

  // Add recurrence_rule column (JSONB for flexible storage)
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS recurrence_rule JSONB DEFAULT NULL;
    `
  })

  if (error1) {
    // Try direct SQL if RPC doesn't work
    console.log('Trying alternative method...')
    const { error: altError1 } = await supabase
      .from('events')
      .select('recurrence_rule')
      .limit(1)

    if (altError1 && altError1.message.includes('does not exist')) {
      console.log('Column does not exist, please run this SQL in Supabase dashboard:')
      console.log(`
-- Add recurrence fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS recurrence_rule JSONB DEFAULT NULL;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS parent_event_id UUID DEFAULT NULL REFERENCES events(id) ON DELETE SET NULL;

-- Add index for parent event lookups
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id);

-- Add comment for documentation
COMMENT ON COLUMN events.recurrence_rule IS 'JSON object containing recurrence configuration (type, interval, daysOfWeek, endType, etc.)';
COMMENT ON COLUMN events.parent_event_id IS 'For recurring event instances, points to the parent/template event';
      `)
    } else {
      console.log('recurrence_rule column already exists or could not determine status')
    }
  } else {
    console.log('Added recurrence_rule column')
  }

  // Add parent_event_id column
  const { error: error2 } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS parent_event_id UUID DEFAULT NULL REFERENCES events(id) ON DELETE SET NULL;
    `
  })

  if (error2) {
    console.log('Could not add parent_event_id via RPC')
  } else {
    console.log('Added parent_event_id column')
  }

  console.log('\nMigration complete!')
  console.log('\nIf the automatic migration did not work, please run the SQL above in your Supabase dashboard.')
}

addRecurrenceFields().catch(console.error)
