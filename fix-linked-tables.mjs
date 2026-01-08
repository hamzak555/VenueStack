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

async function fix() {
  const eventId = 'a9caa741-c88c-4301-9eb8-8b0c7bdd9a77'

  // Get sections
  const { data: sections } = await supabase
    .from('event_table_sections')
    .select('id, section_id, linked_table_pairs')
    .eq('event_id', eventId)
    .order('id')

  if (!sections) {
    console.log('No sections found')
    return
  }

  const businessSectionIds = sections.map(s => s.section_id)
  console.log('Valid business section IDs:', businessSectionIds)

  // Get first section (where linked_table_pairs are stored)
  const firstSection = sections[0]
  const pairs = firstSection.linked_table_pairs || []

  // Filter to only valid pairs
  const validPairs = pairs.filter(pair => {
    const valid1 = businessSectionIds.includes(pair.table1.sectionId)
    const valid2 = businessSectionIds.includes(pair.table2.sectionId)
    return valid1 && valid2
  })

  console.log(`\nOriginal pairs: ${pairs.length}`)
  console.log(`Valid pairs: ${validPairs.length}`)
  console.log('Valid pairs:', JSON.stringify(validPairs, null, 2))

  // Update with only valid pairs
  const { error } = await supabase
    .from('event_table_sections')
    .update({ linked_table_pairs: validPairs })
    .eq('id', firstSection.id)

  if (error) {
    console.error('Error updating:', error)
  } else {
    console.log('\nSuccessfully cleaned up linked_table_pairs!')
  }
}

fix()
