'use client'

import { useEffect, useRef } from 'react'

interface PageViewTrackerProps {
  businessId: string
  pageType: 'business_home' | 'event_page' | 'checkout'
  eventId?: string
}

function getOrCreateVisitorId(): string {
  const storageKey = 'vs_visitor_id'

  // Try to get existing visitor ID from localStorage
  if (typeof window !== 'undefined') {
    let visitorId = localStorage.getItem(storageKey)

    if (!visitorId) {
      // Generate a new visitor ID
      visitorId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem(storageKey, visitorId)
    }

    return visitorId
  }

  // Fallback for SSR
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

export function PageViewTracker({ businessId, pageType, eventId }: PageViewTrackerProps) {
  const hasTracked = useRef(false)

  useEffect(() => {
    // Prevent double-tracking in React StrictMode
    if (hasTracked.current) return
    hasTracked.current = true

    const trackPageView = async () => {
      try {
        const visitorId = getOrCreateVisitorId()

        await fetch('/api/page-views', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessId,
            pageType,
            eventId,
            visitorId,
          }),
        })
      } catch (error) {
        // Silently fail - don't disrupt user experience for analytics
        console.error('Failed to track page view:', error)
      }
    }

    trackPageView()
  }, [businessId, pageType, eventId])

  return null
}
