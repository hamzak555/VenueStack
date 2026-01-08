import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env.local manually
const envFile = readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrate() {
  console.log('Checking if columns exist...')

  // Try to query with the new columns
  const { data, error } = await supabase
    .from('event_table_sections')
    .select('id, closed_tables, linked_table_pairs')
    .limit(1)

  if (error) {
    console.log('Columns do not exist yet. Please run this SQL in Supabase Dashboard -> SQL Editor:')
    console.log(`
-- Add closed_tables and linked_table_pairs columns
ALTER TABLE event_table_sections
ADD COLUMN IF NOT EXISTS closed_tables JSONB DEFAULT '[]'::jsonb;

ALTER TABLE event_table_sections
ADD COLUMN IF NOT EXISTS linked_table_pairs JSONB DEFAULT '[]'::jsonb;
    `)
  } else {
    console.log('Columns already exist!')
    console.log('Sample data:', data)
  }
}

migrate().catch(console.error)
