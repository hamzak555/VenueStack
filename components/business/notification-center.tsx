'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, X } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface Notification {
  id: string
  bookingId: string
  eventId: string
  customerName: string
  sectionName: string
  eventTitle: string
  eventDate: string
  eventTime: string | null
  createdAt: string
}

interface NotificationCenterProps {
  businessId: string
  businessSlug: string
}

const STORAGE_KEY_PREFIX = 'notifications_'

export function NotificationCenter({ businessId, businessSlug }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Load notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${businessId}`)
    if (stored) {
      try {
        setNotifications(JSON.parse(stored))
      } catch {
        // Invalid stored data
      }
    }
  }, [businessId])

  // Save notifications to localStorage
  const saveNotifications = useCallback((notifs: Notification[]) => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(notifs))
  }, [businessId])

  // Subscribe to real-time table booking inserts
  useEffect(() => {
    const channel = supabase
      .channel(`table-bookings-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_bookings',
        },
        async (payload) => {
          console.log('[NotificationCenter] Received table booking insert:', payload.new.id)

          // Fetch additional details about the booking
          const { data: booking, error } = await supabase
            .from('table_bookings')
            .select(`
              id,
              event_id,
              customer_name,
              created_at,
              event_table_sections (
                section_name
              ),
              events!inner (
                business_id,
                title,
                event_date,
                event_time
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (error) {
            console.error('[NotificationCenter] Error fetching booking details:', error)
            return
          }

          console.log('[NotificationCenter] Booking details:', booking)
          console.log('[NotificationCenter] Business ID check:', (booking?.events as any)?.business_id, '===', businessId)

          // Only add notification if booking belongs to this business
          if (booking && (booking.events as any)?.business_id === businessId) {
            const event = booking.events as any
            const newNotification: Notification = {
              id: crypto.randomUUID(),
              bookingId: booking.id,
              eventId: booking.event_id,
              customerName: booking.customer_name,
              sectionName: (booking.event_table_sections as any)?.section_name || 'Unknown Section',
              eventTitle: event?.title || 'Unknown Event',
              eventDate: event?.event_date || '',
              eventTime: event?.event_time || null,
              createdAt: booking.created_at || new Date().toISOString(),
            }

            console.log('[NotificationCenter] Adding notification:', newNotification)

            setNotifications((prev) => {
              const updated = [newNotification, ...prev]
              saveNotifications(updated)
              return updated
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('[NotificationCenter] Subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId, supabase, saveNotifications])

  const handleNotificationClick = (notification: Notification) => {
    router.push(`/${businessSlug}/dashboard/tables?eventId=${notification.eventId}&bookingId=${notification.bookingId}`)
    setOpen(false)
  }

  const handleClearAll = () => {
    setNotifications([])
    saveNotifications([])
  }

  const handleRemoveOne = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== notificationId)
      saveNotifications(updated)
      return updated
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-auto py-1 px-2 text-xs">
              Clear All
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="p-3 hover:bg-muted cursor-pointer flex items-start gap-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.customerName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {notification.sectionName} - {notification.eventTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.eventDate && format(new Date(notification.eventDate + 'T00:00:00'), 'MMM d')}
                      {notification.eventTime && ` at ${notification.eventTime.slice(0, 5)}`}
                      {notification.createdAt && (
                        <>
                          {' · '}
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleRemoveOne(e, notification.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
