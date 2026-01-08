import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'

interface LinkedTablePair {
  table1: { sectionId: string; tableName: string }
  table2: { sectionId: string; tableName: string }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const body = await request.json()
    const { sectionId, tableName, linkToSectionId, linkToTableName, unlink } = body

    if (!sectionId || !tableName || (!unlink && (!linkToSectionId || !linkToTableName))) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Get all event table sections for this event to store linked pairs
    // We'll store linked pairs on the first section (they apply to the whole event)
    const { data: sections, error: sectionsError } = await supabase
      .from('event_table_sections')
      .select('id, linked_table_pairs')
      .eq('event_id', eventId)
      .order('id')
      .limit(1)

    if (sectionsError || !sections || sections.length === 0) {
      return NextResponse.json({ error: 'No sections found' }, { status: 404 })
    }

    const primarySection = sections[0]
    const linkedPairs: LinkedTablePair[] = primarySection.linked_table_pairs || []

    if (unlink) {
      // Remove any links involving this table
      const filteredPairs = linkedPairs.filter(pair => {
        const involvesTable =
          (pair.table1.sectionId === sectionId && pair.table1.tableName === tableName) ||
          (pair.table2.sectionId === sectionId && pair.table2.tableName === tableName)
        return !involvesTable
      })

      const { error: updateError } = await supabase
        .from('event_table_sections')
        .update({ linked_table_pairs: filteredPairs })
        .eq('id', primarySection.id)

      if (updateError) {
        console.error('Error unlinking tables:', updateError)
        return NextResponse.json(
          { error: 'Failed to unlink tables' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        linked_table_pairs: filteredPairs,
      })
    }

    // Check if this exact pair already exists
    const pairExists = linkedPairs.some(pair => {
      return (
        (pair.table1.sectionId === sectionId && pair.table1.tableName === tableName &&
         pair.table2.sectionId === linkToSectionId && pair.table2.tableName === linkToTableName) ||
        (pair.table2.sectionId === sectionId && pair.table2.tableName === tableName &&
         pair.table1.sectionId === linkToSectionId && pair.table1.tableName === linkToTableName)
      )
    })

    if (pairExists) {
      return NextResponse.json({
        success: true,
        message: 'Tables are already linked',
        linked_table_pairs: linkedPairs,
      })
    }

    // Add the new link
    linkedPairs.push({
      table1: { sectionId, tableName },
      table2: { sectionId: linkToSectionId, tableName: linkToTableName },
    })

    const { error: updateError } = await supabase
      .from('event_table_sections')
      .update({ linked_table_pairs: linkedPairs })
      .eq('id', primarySection.id)

    if (updateError) {
      console.error('Error linking tables:', updateError)
      return NextResponse.json(
        { error: 'Failed to link tables' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      linked_table_pairs: linkedPairs,
    })
  } catch (error) {
    console.error('Error in link tables:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
