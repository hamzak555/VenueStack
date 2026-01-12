'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Bell, X } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { parseLocalDate } from '@/lib/utils'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

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
  const supabase = createClient()
  const seenBookingIds = useRef<Set<string>>(new Set())
  const isMobile = useIsMobile()

  // Load notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${businessId}`)
    console.log('[NotificationCenter] Loading from localStorage:', stored)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Notification[]
        console.log('[NotificationCenter] Parsed notifications:', parsed)
        // Filter out invalid notifications (missing required fields or invalid dates)
        const validNotifications = parsed.filter((n) => {
          if (!n.id || !n.bookingId || !n.customerName) {
            console.log('[NotificationCenter] Filtering out - missing fields:', n)
            return false
          }
          // Validate eventDate if present and not empty
          if (n.eventDate && n.eventDate !== '') {
            try {
              parseLocalDate(n.eventDate)
            } catch {
              console.log('[NotificationCenter] Filtering out - invalid date:', n.eventDate)
              return false
            }
          }
          return true
        })
        console.log('[NotificationCenter] Valid notifications:', validNotifications)
        setNotifications(validNotifications)
        // Save back only valid notifications
        if (validNotifications.length !== parsed.length) {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(validNotifications))
        }
        // Add all existing booking IDs to seen set
        validNotifications.forEach((n) => seenBookingIds.current.add(n.bookingId))
      } catch (e) {
        console.error('[NotificationCenter] Error parsing localStorage:', e)
        // Invalid stored data - clear it
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${businessId}`)
      }
    }
  }, [businessId])

  // Save notifications to localStorage
  const saveNotifications = useCallback((notifs: Notification[]) => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(notifs))
  }, [businessId])

  // Subscribe to broadcast notifications
  useEffect(() => {
    const channel = supabase
      .channel(`table-bookings-${businessId}`)
      .on('broadcast', { event: 'new_booking' }, (payload) => {
        const data = payload.payload as {
          bookingId: string
          eventId: string
          customerName: string
          sectionName: string
          eventTitle: string
          eventDate: string
          eventTime: string | null
          createdAt: string
        }

        // Skip if we've already seen this booking
        if (seenBookingIds.current.has(data.bookingId)) {
          return
        }

        // Mark as seen
        seenBookingIds.current.add(data.bookingId)

        const newNotification: Notification = {
          id: crypto.randomUUID(),
          bookingId: data.bookingId,
          eventId: data.eventId,
          customerName: data.customerName,
          sectionName: data.sectionName,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate,
          eventTime: data.eventTime,
          createdAt: data.createdAt || new Date().toISOString(),
        }

        setNotifications((prev) => {
          const updated = [newNotification, ...prev]
          saveNotifications(updated)
          return updated
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId, saveNotifications, supabase])

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
        <button className="relative group">
          <div className="h-7 w-7 rounded-md bg-[rgb(var(--theme-color))]/10 group-hover:bg-[rgb(var(--theme-color))]/20 flex items-center justify-center transition-colors">
            <Bell className="h-3.5 w-3.5" style={{ color: 'var(--theme-color-hex)' }} />
          </div>
          {notifications.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-medium">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[500px] overflow-hidden" align={isMobile ? "end" : "start"} sideOffset={8}>
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-auto py-1 px-2 text-xs">
              Clear All
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
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
                  className="px-4 py-3 hover:bg-muted cursor-pointer flex items-start gap-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.customerName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {notification.eventTitle} - {notification.sectionName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.eventDate && (() => {
                        try {
                          return format(parseLocalDate(notification.eventDate), 'MMM d')
                        } catch {
                          return null
                        }
                      })()}
                      {notification.eventTime && (() => {
                        try {
                          return ` at ${notification.eventTime.slice(0, 5)}`
                        } catch {
                          return null
                        }
                      })()}
                      {notification.createdAt && (() => {
                        try {
                          return (
                            <>
                              {' · '}
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </>
                          )
                        } catch {
                          return null
                        }
                      })()}
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
