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
    .select('id, section_id, section_name, closed_tables, linked_table_pairs')
    .eq('event_id', eventId)
    .order('id')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Event table sections (ordered by ID):')
  data.forEach((s, i) => {
    console.log(`\n${i + 1}. Section: ${s.section_name}`)
    console.log(`   Event section ID: ${s.id}`)
    console.log(`   Business section_id: ${s.section_id}`)
    console.log(`   Closed tables:`, s.closed_tables)
    console.log(`   Linked pairs:`, JSON.stringify(s.linked_table_pairs, null, 2))
  })

  // Check which pairs have valid business section IDs
  const firstSection = data[0]
  if (firstSection?.linked_table_pairs?.length > 0) {
    console.log('\n\nValidating linked pairs:')
    const businessSectionIds = data.map(s => s.section_id)
    firstSection.linked_table_pairs.forEach((pair, i) => {
      const valid1 = businessSectionIds.includes(pair.table1.sectionId)
      const valid2 = businessSectionIds.includes(pair.table2.sectionId)
      console.log(`Pair ${i + 1}: ${pair.table1.tableName} <-> ${pair.table2.tableName}`)
      console.log(`  Table1 sectionId valid: ${valid1} (${pair.table1.sectionId})`)
      console.log(`  Table2 sectionId valid: ${valid2} (${pair.table2.sectionId})`)
    })
  }
}

check()
