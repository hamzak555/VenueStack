'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface EventCardHoverProps {
  event: {
    id: string
    title: string
    status: string
    event_date: string
    available_tickets: number
    total_tickets: number
    image_url: string | null
  }
  businessId: string
}

export function EventCardHover({ event, businessId }: EventCardHoverProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div
      className="relative flex items-center gap-4 p-4 border rounded-lg overflow-hidden group cursor-pointer bg-card transition-colors"
      onMouseMove={handleMouseMove}
    >
      {/* Animated gradient that follows cursor */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255, 255, 255, 0.1), transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center gap-4 flex-1">
        {event.image_url && (
          <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{event.title}</h3>
            <Badge
              variant={
                event.status === 'published'
                  ? 'success'
                  : event.status === 'cancelled'
                  ? 'destructive'
                  : 'secondary'
              }
              className="capitalize"
            >
              {event.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(event.event_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} • {event.available_tickets} /{' '}
            {event.total_tickets} tickets available
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="flex-shrink-0 relative z-20">
          <Link href={`/business/${businessId}/events/${event.id}`}>Manage</Link>
        </Button>
      </div>
    </div>
  )
}
