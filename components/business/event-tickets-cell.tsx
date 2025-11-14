'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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

  if (breakdown.length === 0) {
    return (
      <div>
        <div className="text-sm">{totalSold} sold</div>
        <div className="text-xs text-muted-foreground">
          {availableTickets} available
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <div>
              <div className="text-sm">{totalSold} sold</div>
              <div className="text-xs text-muted-foreground">
                {availableTickets} available
              </div>
            </div>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="p-3 min-w-[200px]">
          <p className="text-xs font-medium mb-2">Sales Breakdown</p>
          <div className="space-y-1">
            {breakdown.map((item, index) => (
              <div key={index} className="flex justify-between text-xs gap-4">
                <span className="text-muted-foreground">{item.name}:</span>
                <span className="font-medium">{item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between text-xs">
            <span className="text-muted-foreground font-medium">Total:</span>
            <span className="font-medium">{totalSold}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
