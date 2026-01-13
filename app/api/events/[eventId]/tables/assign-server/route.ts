import { NextRequest, NextResponse } from 'next/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { createClient } from '@/lib/supabase/server'
import { canAccessSection, type BusinessRole } from '@/lib/auth/roles'

interface ServerAssignment {
  tableName: string
  serverUserIds: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const body = await request.json()
    const { sectionId, tableName, serverUserIds } = body

    if (!sectionId || !tableName) {
      return NextResponse.json(
        { error: 'Missing required fields: sectionId, tableName' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify the event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, business_id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify access (only owner and manager can assign servers)
    const session = await verifyBusinessAccess(event.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only owner and manager can assign servers (they manage users)
    if (!canAccessSection(session.role as BusinessRole, 'users')) {
      return NextResponse.json(
        { error: 'You do not have permission to assign servers to tables' },
        { status: 403 }
      )
    }

    // Get current section data
    const { data: section, error: sectionError } = await supabase
      .from('event_table_sections')
      .select('id, server_assignments')
      .eq('event_id', eventId)
      .eq('section_id', sectionId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const assignments = (section.server_assignments as ServerAssignment[] | null) || []

    // Find existing assignment for this table
    const existingIndex = assignments.findIndex(a => a.tableName === tableName)

    if (!serverUserIds || serverUserIds.length === 0) {
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
      console.error('Error updating server assignments:', updateError)
      return NextResponse.json(
        { error: 'Failed to update server assignments' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      assignments,
    })
  } catch (error) {
    console.error('Error in assign server:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
