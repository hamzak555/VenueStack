'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeBookingsOptions {
  eventId: string
  enabled?: boolean
}

/**
 * Hook to subscribe to realtime changes on table_bookings and event_table_sections
 * for a specific event. When changes are detected, it triggers a router refresh.
 */
export function useRealtimeBookings({ eventId, enabled = true }: UseRealtimeBookingsOptions) {
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled || !eventId) return

    const supabase = createClient()

    const triggerRefresh = (source: string, eventType: string) => {
      console.log(`Realtime update received (${source}):`, eventType)

      // Debounce rapid updates (e.g., multiple fields changing)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        router.refresh()
      }, 300) // 300ms debounce
    }

    // Subscribe to changes on both table_bookings and event_table_sections
    const channel = supabase
      .channel(`tables_realtime:${eventId}`)
      // Listen to table_bookings changes (reservations, status updates)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_bookings',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => triggerRefresh('table_bookings', payload.eventType)
      )
      // Listen to event_table_sections changes (server assignments, closed tables, linked tables)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_table_sections',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => triggerRefresh('event_table_sections', payload.eventType)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to realtime updates for event:', eventId)
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error')
        }
      })

    channelRef.current = channel

    // Cleanup on unmount or when eventId changes
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [eventId, enabled, router])
}
