'use client'

import { Info } from 'lucide-react'

interface TicketSalesData {
  totalSold: number
  availableTickets: number
  breakdown: Array<{
    name: string
    quantity: number
  }>
}

interface EventTicketsCellProps {
  salesData: TicketSalesData
}

export function EventTicketsCell({ salesData }: EventTicketsCellProps) {
  const { totalSold, availableTickets, breakdown } = salesData

  return (
    <div className="relative group">
      <div className="flex items-center gap-1.5">
        <div>
          <div className="text-sm">{totalSold} sold</div>
          <div className="text-xs text-muted-foreground">
            {availableTickets} available
          </div>
        </div>
        {breakdown.length > 0 && (
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        )}
      </div>

      {/* Tooltip */}
      {breakdown.length > 0 && (
        <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50">
          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
            <p className="text-xs font-medium mb-2">Sales Breakdown</p>
            <div className="space-y-1">
              {breakdown.map((item, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.name}:</span>
                  <span className="font-medium">{item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-1 mt-1 flex justify-between text-xs">
              <span className="text-muted-foreground font-medium">Total:</span>
              <span className="font-medium">{totalSold}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
