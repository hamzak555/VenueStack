import { createClient } from '@/lib/supabase/server'

export interface ServerAssignment {
  tableName: string
  serverUserIds: string[]
}

/**
 * Get all server assignments for an event
 */
export async function getServerAssignments(eventId: string): Promise<Record<string, ServerAssignment[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('event_table_sections')
    .select('section_id, server_assignments')
    .eq('event_id', eventId)

  if (error) {
    console.error('Error fetching server assignments:', error)
    return {}
  }

  const assignments: Record<string, ServerAssignment[]> = {}
  for (const section of data || []) {
    if (section.server_assignments && Array.isArray(section.server_assignments)) {
      assignments[section.section_id] = section.server_assignments
    }
  }

  return assignments
}

/**
 * Get tables assigned to a specific server for an event
 * Returns a map of sectionId -> table names
 */
export async function getTablesAssignedToServer(
  eventId: string,
  serverUserId: string
): Promise<Record<string, string[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('event_table_sections')
    .select('section_id, server_assignments')
    .eq('event_id', eventId)

  if (error) {
    console.error('Error fetching server assignments:', error)
    return {}
  }

  const assignedTables: Record<string, string[]> = {}
  for (const section of data || []) {
    const assignments = section.server_assignments as ServerAssignment[] | null
    if (assignments && Array.isArray(assignments)) {
      const tablesForServer = assignments
        .filter(a => a.serverUserIds?.includes(serverUserId))
        .map(a => a.tableName)
      if (tablesForServer.length > 0) {
        assignedTables[section.section_id] = tablesForServer
      }
    }
  }

  return assignedTables
}

/**
 * Update server assignment for a specific table
 */
export async function updateServerAssignment(
  eventId: string,
  sectionId: string,
  tableName: string,
  serverUserIds: string[]
): Promise<void> {
  const supabase = await createClient()

  // Get current section data
  const { data: section, error: fetchError } = await supabase
    .from('event_table_sections')
    .select('id, server_assignments')
    .eq('event_id', eventId)
    .eq('section_id', sectionId)
    .single()

  if (fetchError || !section) {
    throw new Error('Section not found')
  }

  const assignments = (section.server_assignments as ServerAssignment[] | null) || []

  // Find existing assignment for this table
  const existingIndex = assignments.findIndex(a => a.tableName === tableName)

  if (serverUserIds.length === 0) {
    // Remove assignment if no servers
    if (existingIndex !== -1) {
      assignments.splice(existingIndex, 1)
    }
  } else if (existingIndex !== -1) {
    // Update existing assignment
    assignments[existingIndex].serverUserIds = serverUserIds
  } else {
    // Add new assignment
    assignments.push({ tableName, serverUserIds })
  }

  // Save updated assignments
  const { error: updateError } = await supabase
    .from('event_table_sections')
    .update({ server_assignments: assignments })
    .eq('id', section.id)

  if (updateError) {
    throw new Error('Failed to update server assignment')
  }
}
