import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const body = await request.json()
    const { sectionId, tableName, closed } = body

    if (!sectionId || !tableName || typeof closed !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: sectionId, tableName, closed' },
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

    // Verify access (supports admin bypass)
    const session = await verifyBusinessAccess(event.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the event table section by business section_id
    const { data: section, error: sectionError } = await supabase
      .from('event_table_sections')
      .select('id, section_id, closed_tables')
      .eq('section_id', sectionId) // Match by business section_id
      .eq('event_id', eventId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Update closed_tables array
    const closedTables: string[] = section.closed_tables || []
    const tableIndex = closedTables.indexOf(tableName)

    if (closed && tableIndex === -1) {
      closedTables.push(tableName)
    } else if (!closed && tableIndex !== -1) {
      closedTables.splice(tableIndex, 1)
    }

    // Save the updated closed_tables
    const { error: updateError } = await supabase
      .from('event_table_sections')
      .update({ closed_tables: closedTables })
      .eq('id', section.id)

    if (updateError) {
      console.error('Error updating closed tables:', updateError)
      return NextResponse.json(
        { error: 'Failed to update table status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      closed_tables: closedTables,
    })
  } catch (error) {
    console.error('Error in close table:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
