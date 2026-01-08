import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env.local file manually
const envContent = readFileSync('.env.local', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  console.log('Adding notes column to table_bookings...')

  // Try to add notes column using an update that would fail if column doesn't exist
  const { data, error } = await supabase
    .from('table_bookings')
    .select('notes')
    .limit(1)

  if (error && error.message.includes('column')) {
    console.log('Notes column does not exist. Please run the following SQL in Supabase dashboard:')
    console.log(`
-- Add notes column to table_bookings as JSONB array
ALTER TABLE table_bookings
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- Example note structure:
-- [
--   {
--     "id": "uuid",
--     "content": "Customer requested corner table",
--     "created_by_name": "John Admin",
--     "created_by_email": "john@business.com",
--     "created_at": "2024-01-15T10:30:00Z"
--   }
-- ]
    `)
    return
  }

  if (error) {
    console.log('Error:', error)
    return
  }

  console.log('Notes column already exists!')
}

runMigration()
