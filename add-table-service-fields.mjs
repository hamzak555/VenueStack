import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addTableServiceFields() {
  console.log('Adding table service fields to businesses table...')

  // Add table service columns to businesses table
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS venue_layout_url TEXT,
      ADD COLUMN IF NOT EXISTS table_service_config JSONB;
    `
  })

  if (error) {
    // If exec_sql doesn't exist, try direct SQL through Supabase dashboard
    console.error('Error running migration:', error.message)
    console.log('\n--- Run this SQL in your Supabase dashboard: ---\n')
    console.log(`
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS venue_layout_url TEXT,
ADD COLUMN IF NOT EXISTS table_service_config JSONB;
    `)
    return
  }

  console.log('Table service fields added successfully!')
}

addTableServiceFields()
