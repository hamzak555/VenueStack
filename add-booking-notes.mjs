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
  console.log('Creating table_booking_notes table...')

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS table_booking_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_by_name VARCHAR(255) NOT NULL,
        created_by_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_table_booking_notes_booking_id ON table_booking_notes(table_booking_id);
      CREATE INDEX IF NOT EXISTS idx_table_booking_notes_created_at ON table_booking_notes(created_at DESC);
    `
  })

  if (error) {
    // Try direct table creation via REST API
    console.log('RPC not available, trying alternative method...')

    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('table_booking_notes')
      .select('id')
      .limit(1)

    if (checkError && checkError.code === '42P01') {
      console.log('Table does not exist. Please run the following SQL in the Supabase dashboard:')
      console.log(`
CREATE TABLE IF NOT EXISTS table_booking_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_booking_id UUID NOT NULL REFERENCES table_bookings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_booking_notes_booking_id ON table_booking_notes(table_booking_id);
CREATE INDEX IF NOT EXISTS idx_table_booking_notes_created_at ON table_booking_notes(created_at DESC);
      `)
    } else if (!checkError) {
      console.log('Table already exists!')
    } else {
      console.log('Error:', checkError)
    }
  } else {
    console.log('Migration completed successfully!')
  }
}

runMigration()
