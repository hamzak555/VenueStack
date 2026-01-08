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

async function test() {
  // Try to update closed_tables directly on VIP section
  const sectionId = '17a048ae-b2f6-469f-bc10-466c8e6a8ac6' // VIP business section_id
  const eventId = 'a9caa741-c88c-4301-9eb8-8b0c7bdd9a77'

  console.log('Testing close table API logic...')

  // Find the section
  const { data: section, error: findError } = await supabase
    .from('event_table_sections')
    .select('id, section_id, closed_tables')
    .eq('section_id', sectionId)
    .eq('event_id', eventId)
    .single()

  if (findError) {
    console.error('Find error:', findError)
    return
  }

  console.log('Found section:', section)

  // Try to update
  const closedTables = section.closed_tables || []
  closedTables.push('V1')

  console.log('Updating with:', closedTables)

  const { data, error: updateError } = await supabase
    .from('event_table_sections')
    .update({ closed_tables: closedTables })
    .eq('id', section.id)
    .select()

  if (updateError) {
    console.error('Update error:', updateError)
  } else {
    console.log('Updated successfully:', data)
  }
}

test()
