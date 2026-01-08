import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { randomUUID } from 'crypto'

interface Note {
  id: string
  content: string
  created_by_name: string
  created_by_email: string
  created_at: string
}

// GET - Fetch notes for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const supabase = await createClient()

    // Get the booking with notes
    const { data: booking, error } = await supabase
      .from('table_bookings')
      .select('id, notes, event_id')
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify the booking belongs to the user's business
    const { data: event } = await supabase
      .from('events')
      .select('business_id')
      .eq('id', booking.event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const session = await verifyBusinessAccess(event.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      notes: booking.notes || [],
    })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

// POST - Add a note to a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the booking with current notes
    const { data: booking, error: fetchError } = await supabase
      .from('table_bookings')
      .select('id, notes, event_id')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify the booking belongs to the user's business
    const { data: event } = await supabase
      .from('events')
      .select('business_id')
      .eq('id', booking.event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const session = await verifyBusinessAccess(event.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create the new note
    const newNote: Note = {
      id: randomUUID(),
      content: content.trim(),
      created_by_name: session.name || 'Unknown',
      created_by_email: session.email || 'unknown@example.com',
      created_at: new Date().toISOString(),
    }

    // Add to existing notes array
    const currentNotes: Note[] = booking.notes || []
    const updatedNotes = [...currentNotes, newNote]

    // Update the booking
    const { error: updateError } = await supabase
      .from('table_bookings')
      .update({ notes: updatedNotes })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error updating notes:', updateError)
      return NextResponse.json(
        { error: 'Failed to add note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note: newNote,
      notes: updatedNotes,
    })
  } catch (error) {
    console.error('Error adding note:', error)
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a note from a booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the booking with current notes
    const { data: booking, error: fetchError } = await supabase
      .from('table_bookings')
      .select('id, notes, event_id')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify the booking belongs to the user's business
    const { data: event } = await supabase
      .from('events')
      .select('business_id')
      .eq('id', booking.event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const session = await verifyBusinessAccess(event.business_id)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remove the note
    const currentNotes: Note[] = booking.notes || []
    const updatedNotes = currentNotes.filter(note => note.id !== noteId)

    // Update the booking
    const { error: updateError } = await supabase
      .from('table_bookings')
      .update({ notes: updatedNotes })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error removing note:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      notes: updatedNotes,
    })
  } catch (error) {
    console.error('Error removing note:', error)
    return NextResponse.json(
      { error: 'Failed to remove note' },
      { status: 500 }
    )
  }
}
