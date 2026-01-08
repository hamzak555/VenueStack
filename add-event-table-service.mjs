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

async function addEventTableServiceTables() {
  console.log('Creating event table service tables...')

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Create event_table_sections table
      CREATE TABLE IF NOT EXISTS event_table_sections (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        section_id TEXT NOT NULL,
        section_name TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_tables INTEGER NOT NULL DEFAULT 0,
        available_tables INTEGER NOT NULL DEFAULT 0,
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, section_id)
      );

      -- Create table_bookings table
      CREATE TABLE IF NOT EXISTS table_bookings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        event_table_section_id UUID NOT NULL REFERENCES event_table_sections(id) ON DELETE CASCADE,
        table_number INTEGER NOT NULL,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_table_section_id, table_number)
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_event_table_sections_event_id ON event_table_sections(event_id);
      CREATE INDEX IF NOT EXISTS idx_table_bookings_event_id ON table_bookings(event_id);
      CREATE INDEX IF NOT EXISTS idx_table_bookings_order_id ON table_bookings(order_id);
      CREATE INDEX IF NOT EXISTS idx_table_bookings_section_id ON table_bookings(event_table_section_id);

      -- Add table_service_enabled column to events table
      ALTER TABLE events ADD COLUMN IF NOT EXISTS table_service_enabled BOOLEAN DEFAULT false;
    `
  })

  if (error) {
    console.error('Error running migration:', error.message)
    console.log('\n--- Run this SQL in your Supabase dashboard: ---\n')
    console.log(`
-- Create event_table_sections table
CREATE TABLE IF NOT EXISTS event_table_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  section_name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_tables INTEGER NOT NULL DEFAULT 0,
  available_tables INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, section_id)
);

-- Create table_bookings table
CREATE TABLE IF NOT EXISTS table_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_table_section_id UUID NOT NULL REFERENCES event_table_sections(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_table_section_id, table_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_table_sections_event_id ON event_table_sections(event_id);
CREATE INDEX IF NOT EXISTS idx_table_bookings_event_id ON table_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_table_bookings_order_id ON table_bookings(order_id);
CREATE INDEX IF NOT EXISTS idx_table_bookings_section_id ON table_bookings(event_table_section_id);

-- Add table_service_enabled column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS table_service_enabled BOOLEAN DEFAULT false;
    `)
    return
  }

  console.log('Event table service tables created successfully!')
}

addEventTableServiceTables()
