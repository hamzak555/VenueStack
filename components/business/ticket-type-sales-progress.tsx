'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { Ticket } from 'lucide-react'

interface TicketType {
  id: string
  name: string
  price: number
  total_quantity: number
  available_quantity: number
  is_active: boolean
}

interface TicketTypeSalesProgressProps {
  ticketTypes: TicketType[]
  compact?: boolean
}

export function TicketTypeSalesProgress({ ticketTypes, compact = false }: TicketTypeSalesProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState<Record<string, number>>({})

  // Animate progress bars on mount
  useEffect(() => {
    // Start with 0
    const initial: Record<string, number> = {}
    ticketTypes.forEach(tt => {
      initial[tt.id] = 0
    })
    setAnimatedProgress(initial)

    // Animate to actual values after a short delay
    const timer = setTimeout(() => {
      const final: Record<string, number> = {}
      ticketTypes.forEach(tt => {
        const sold = tt.total_quantity - tt.available_quantity
        const percentage = tt.total_quantity > 0 ? (sold / tt.total_quantity) * 100 : 0
        final[tt.id] = percentage
      })
      setAnimatedProgress(final)
    }, 100)

    return () => clearTimeout(timer)
  }, [ticketTypes])

  // Calculate totals
  const totalCapacity = ticketTypes.reduce((sum, tt) => sum + tt.total_quantity, 0)
  const totalSold = ticketTypes.reduce((sum, tt) => sum + (tt.total_quantity - tt.available_quantity), 0)
  const totalRevenue = ticketTypes.reduce((sum, tt) => {
    const sold = tt.total_quantity - tt.available_quantity
    return sum + (sold * tt.price)
  }, 0)

  const getProgressColor = () => {
    return 'bg-green-500'
  }

  if (compact) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Sales by Type</CardTitle>
            <div className="text-right">
              <span className="text-lg font-bold">{totalSold}/{totalCapacity}</span>
              <span className="text-xs text-muted-foreground ml-2">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 pt-0">
          {ticketTypes.map((ticketType) => {
            const sold = ticketType.total_quantity - ticketType.available_quantity
            const percentage = ticketType.total_quantity > 0
              ? (sold / ticketType.total_quantity) * 100
              : 0
            const animatedValue = animatedProgress[ticketType.id] ?? 0

            return (
              <div key={ticketType.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{ticketType.name}</span>
                  <span className="text-muted-foreground ml-2 shrink-0">
                    {sold}/{ticketType.total_quantity}
                  </span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${getProgressColor()}`}
                    style={{ width: `${animatedValue}%` }}
                  />
                </div>
              </div>
            )
          })}

          {ticketTypes.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No ticket types configured
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Sales by Ticket Type
          </CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold">{totalSold} / {totalCapacity}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(totalRevenue)} revenue
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {ticketTypes.map((ticketType) => {
          const sold = ticketType.total_quantity - ticketType.available_quantity
          const percentage = ticketType.total_quantity > 0
            ? (sold / ticketType.total_quantity) * 100
            : 0
          const revenue = sold * ticketType.price
          const animatedValue = animatedProgress[ticketType.id] ?? 0

          return (
            <div key={ticketType.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ticketType.name}</span>
                  {!ticketType.is_active && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-semibold">{sold}</span>
                  <span className="text-muted-foreground"> / {ticketType.total_quantity}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                {/* Animated progress bar */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${getProgressColor()}`}
                  style={{ width: `${animatedValue}%` }}
                />
                {/* Subtle gradient overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  style={{
                    transform: 'translateX(-100%)',
                    animation: animatedValue > 0 ? 'shimmer 2s ease-in-out' : 'none'
                  }}
                />
              </div>

              {/* Details row */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatCurrency(ticketType.price)} each</span>
                <span>{formatCurrency(revenue)} revenue</span>
              </div>
            </div>
          )
        })}

        {ticketTypes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No ticket types configured for this event</p>
          </div>
        )}
      </CardContent>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </Card>
  )
}
