import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim()
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const eventId = 'a9caa741-c88c-4301-9eb8-8b0c7bdd9a77'

  const { data, error } = await supabase
    .from('event_table_sections')
    .select('id, section_id, section_name, closed_tables')
    .eq('event_id', eventId)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('All sections closed_tables:')
  data.forEach(s => {
    console.log(`${s.section_name} (section_id: ${s.section_id}): closed_tables =`, s.closed_tables)
  })
}

check()
