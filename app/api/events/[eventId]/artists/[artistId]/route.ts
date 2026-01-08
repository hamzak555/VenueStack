import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    eventId: string
    artistId: string
  }>
}

// Helper function to get series event IDs
async function getSeriesEventIds(supabase: any, eventId: string): Promise<string[]> {
  const { data: event } = await supabase
    .from('events')
    .select('parent_event_id')
    .eq('id', eventId)
    .single()

  if (!event) return []

  const isRecurringInstance = !!event.parent_event_id
  const parentId = isRecurringInstance ? event.parent_event_id : eventId

  let seriesEventIds: string[] = []

  if (isRecurringInstance) {
    const { data: siblingInstances } = await supabase
      .from('events')
      .select('id')
      .eq('parent_event_id', parentId)
      .neq('id', eventId)

    if (siblingInstances) {
      seriesEventIds = siblingInstances.map((e: any) => e.id)
    }
    if (parentId) {
      seriesEventIds.push(parentId)
    }
  } else {
    const { data: instances } = await supabase
      .from('events')
      .select('id')
      .eq('parent_event_id', eventId)

    if (instances) {
      seriesEventIds = instances.map((e: any) => e.id)
    }
  }

  return seriesEventIds
}

// PATCH update an artist
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { eventId, artistId } = await context.params
    const body = await request.json()
    const supabase = await createClient()

    const { name, photo_url, display_order, propagateToSeries } = body

    // Get the current artist to know the original name for matching
    const { data: currentArtist } = await supabase
      .from('event_artists')
      .select('name')
      .eq('id', artistId)
      .single()

    const originalName = currentArtist?.name

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (photo_url !== undefined) updateData.photo_url = photo_url
    if (display_order !== undefined) updateData.display_order = display_order

    const { data: artist, error } = await supabase
      .from('event_artists')
      .update(updateData)
      .eq('id', artistId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) {
      console.error('Error updating artist:', error)
      return NextResponse.json(
        { error: 'Failed to update artist' },
        { status: 500 }
      )
    }

    // If propagating to series, update matching artists in all related events
    if (propagateToSeries && originalName) {
      const seriesEventIds = await getSeriesEventIds(supabase, eventId)

      if (seriesEventIds.length > 0) {
        // Update artists with matching name in related events
        const seriesUpdateData: Record<string, any> = {}
        if (name !== undefined) seriesUpdateData.name = name
        if (photo_url !== undefined) seriesUpdateData.photo_url = photo_url

        if (Object.keys(seriesUpdateData).length > 0) {
          await supabase
            .from('event_artists')
            .update(seriesUpdateData)
            .eq('name', originalName)
            .in('event_id', seriesEventIds)
        }
      }
    }

    return NextResponse.json(artist)
  } catch (error) {
    console.error('Error updating artist:', error)
    return NextResponse.json(
      { error: 'Failed to update artist' },
      { status: 500 }
    )
  }
}

// DELETE an artist
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { eventId, artistId } = await context.params
    const { searchParams } = new URL(request.url)
    const propagateToSeries = searchParams.get('propagateToSeries') === 'true'

    const supabase = await createClient()

    // Get the artist before deleting to know the name for matching
    const { data: artist } = await supabase
      .from('event_artists')
      .select('name')
      .eq('id', artistId)
      .single()

    // If propagating to series, delete matching artists from all related events
    if (propagateToSeries && artist) {
      const seriesEventIds = await getSeriesEventIds(supabase, eventId)

      if (seriesEventIds.length > 0) {
        await supabase
          .from('event_artists')
          .delete()
          .eq('name', artist.name)
          .in('event_id', seriesEventIds)
      }
    }

    // Delete the original artist
    const { error } = await supabase
      .from('event_artists')
      .delete()
      .eq('id', artistId)
      .eq('event_id', eventId)

    if (error) {
      console.error('Error deleting artist:', error)
      return NextResponse.json(
        { error: 'Failed to delete artist' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting artist:', error)
    return NextResponse.json(
      { error: 'Failed to delete artist' },
      { status: 500 }
    )
  }
}
