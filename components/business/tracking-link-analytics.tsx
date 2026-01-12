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
import { Badge } from '@/components/ui/badge'
import { Link2, Ticket, Armchair } from 'lucide-react'
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
  const totalRevenue = analytics.reduce((sum, a) => sum + a.total_revenue, 0)

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
              <TableHead className="text-right">Ticket Revenue</TableHead>
              <TableHead className="text-right">Table Revenue</TableHead>
              <TableHead className="text-right">Total Revenue</TableHead>
              <TableHead className="text-right">Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analytics.map((item) => (
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
                  {item.ticket_revenue > 0 ? formatCurrency(item.ticket_revenue) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {item.table_revenue > 0 ? formatCurrency(item.table_revenue) : '-'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.total_revenue)}
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
            ))}
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
