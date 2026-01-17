'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Link2, Ticket, Armchair, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { TrackingLinkAnalytics as TrackingLinkAnalyticsType } from '@/lib/types'

interface TrackingLinkAnalyticsProps {
  analytics: TrackingLinkAnalyticsType[]
}

export function TrackingLinkAnalytics({ analytics }: TrackingLinkAnalyticsProps) {
  if (analytics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Tracking Link Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No orders from tracking links yet. Create tracking links in{' '}
            <span className="font-medium">Settings &gt; Marketing</span> and share them to track conversions.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalOrders = analytics.reduce((sum, a) => sum + a.total_orders, 0)
  const totalBusinessPaidFeesAll = analytics.reduce((sum, a) => sum + a.ticket_business_paid_fees + a.table_business_paid_fees, 0)
  const totalRevenue = analytics.reduce((sum, a) => sum + a.total_revenue, 0) - totalBusinessPaidFeesAll

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Tracking Link Performance</CardTitle>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Tracked Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead className="text-right">Ticket Total</TableHead>
              <TableHead className="text-right">Table Total</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analytics.map((item) => {
              const totalSubtotal = item.ticket_subtotal + item.table_subtotal
              const totalTax = item.ticket_tax + item.table_tax
              const totalBusinessPaidFees = item.ticket_business_paid_fees + item.table_business_paid_fees
              const totalGross = totalSubtotal + totalTax
              // Calculate actual totals after business-paid fees
              const actualTicketTotal = item.ticket_revenue - item.ticket_business_paid_fees
              const actualTableTotal = item.table_revenue - item.table_business_paid_fees
              const actualTotal = totalGross - totalBusinessPaidFees

              return (
                <TableRow key={item.tracking_ref}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {item.link_name || (
                          <span className="text-muted-foreground italic">
                            Unknown: {item.tracking_ref}
                          </span>
                        )}
                      </span>
                      <code className="text-xs text-muted-foreground">
                        ?ref={item.tracking_ref}
                      </code>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-medium">{item.total_orders}</span>
                      <div className="flex gap-1">
                        {item.ticket_orders > 0 && (
                          <Badge variant="secondary" className="text-xs px-1">
                            <Ticket className="h-3 w-3 mr-0.5" />
                            {item.ticket_orders}
                          </Badge>
                        )}
                        {item.table_bookings > 0 && (
                          <Badge variant="secondary" className="text-xs px-1">
                            <Armchair className="h-3 w-3 mr-0.5" />
                            {item.table_bookings}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.ticket_revenue > 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help inline-flex items-center gap-1">
                              {formatCurrency(actualTicketTotal)}
                              <Info className="h-3 w-3 opacity-50" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                            <div className="text-xs">
                              <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                                Ticket Total Calculation
                              </div>
                              <div className="p-3 space-y-1.5">
                                <div className="flex justify-between gap-4">
                                  <span>Subtotal</span>
                                  <span className="font-medium">{formatCurrency(item.ticket_subtotal)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span>+ Tax</span>
                                  <span className="font-medium">{formatCurrency(item.ticket_tax)}</span>
                                </div>
                                {item.ticket_business_paid_fees > 0 && (
                                  <div className="flex justify-between gap-4">
                                    <span>- Fees (paid by you)</span>
                                    <span className="font-medium">{formatCurrency(item.ticket_business_paid_fees)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                                  <span>Ticket Total</span>
                                  <span>{formatCurrency(actualTicketTotal)}</span>
                                </div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.table_revenue > 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help inline-flex items-center gap-1">
                              {formatCurrency(actualTableTotal)}
                              <Info className="h-3 w-3 opacity-50" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                            <div className="text-xs">
                              <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                                Table Total Calculation
                              </div>
                              <div className="p-3 space-y-1.5">
                                <div className="flex justify-between gap-4">
                                  <span>Subtotal</span>
                                  <span className="font-medium">{formatCurrency(item.table_subtotal)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span>+ Tax</span>
                                  <span className="font-medium">{formatCurrency(item.table_tax)}</span>
                                </div>
                                {item.table_business_paid_fees > 0 && (
                                  <div className="flex justify-between gap-4">
                                    <span>- Fees (paid by you)</span>
                                    <span className="font-medium">{formatCurrency(item.table_business_paid_fees)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                                  <span>Table Total</span>
                                  <span>{formatCurrency(actualTableTotal)}</span>
                                </div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex items-center gap-1">
                            {formatCurrency(actualTotal)}
                            <Info className="h-3 w-3 opacity-50" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="p-0 overflow-hidden border border-border" sideOffset={8} hideArrow>
                          <div className="text-xs">
                            <div className="px-3 py-2 bg-muted/50 border-b font-medium">
                              Total Calculation
                            </div>
                            <div className="p-3 space-y-1.5">
                              <div className="flex justify-between gap-4">
                                <span>Subtotal</span>
                                <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                              </div>
                              {item.ticket_subtotal > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tickets</span>
                                  <span>{formatCurrency(item.ticket_subtotal)}</span>
                                </div>
                              )}
                              {item.table_subtotal > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tables</span>
                                  <span>{formatCurrency(item.table_subtotal)}</span>
                                </div>
                              )}
                              <div className="flex justify-between gap-4">
                                <span>+ Tax</span>
                                <span className="font-medium">{formatCurrency(totalTax)}</span>
                              </div>
                              {item.ticket_tax > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tickets</span>
                                  <span>{formatCurrency(item.ticket_tax)}</span>
                                </div>
                              )}
                              {item.table_tax > 0 && (
                                <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                  <span className="pl-4">Tables</span>
                                  <span>{formatCurrency(item.table_tax)}</span>
                                </div>
                              )}
                              {totalBusinessPaidFees > 0 && (
                                <>
                                  <div className="flex justify-between gap-4">
                                    <span>- Fees (paid by you)</span>
                                    <span className="font-medium">{formatCurrency(totalBusinessPaidFees)}</span>
                                  </div>
                                  {item.ticket_business_paid_fees > 0 && (
                                    <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                      <span className="pl-4">Tickets</span>
                                      <span>{formatCurrency(item.ticket_business_paid_fees)}</span>
                                    </div>
                                  )}
                                  {item.table_business_paid_fees > 0 && (
                                    <div className="flex justify-between gap-4 text-[11px] text-muted-foreground/70">
                                      <span className="pl-4">Tables</span>
                                      <span>{formatCurrency(item.table_business_paid_fees)}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                                <span>Total</span>
                                <span>{formatCurrency(actualTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.last_activity
                      ? new Date(item.last_activity).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '-'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            Total from tracked sources: {totalOrders} orders
          </span>
          <span className="font-bold">{formatCurrency(totalRevenue)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
