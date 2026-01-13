'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface BusinessReport {
  id: string
  name: string
  slug: string
  is_active: boolean
  stripe_onboarding_complete: boolean
  created_at: string
  subscription_status: string | null
  subscription_current_period_end: string | null
  subscription_cancel_at_period_end: boolean
  subscription_revenue_collected: number
  total_events: number
  published_events: number
  total_orders: number
  total_tickets_sold: number
  ticket_gross_revenue: number
  ticket_platform_fees: number
  ticket_stripe_fees: number
  total_table_bookings: number
  table_booking_revenue: number
  total_revenue: number
  total_platform_fees: number
  net_to_business: number
  avg_order_value: number
  last_activity_date: string | null
}

type SortField = 'name' | 'subscription' | 'events' | 'tickets' | 'tables' | 'gross' | 'platform_fees' | 'sub_revenue' | 'last_activity'
type SortDirection = 'asc' | 'desc'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function getSubscriptionBadge(status: string | null, cancelAtPeriodEnd: boolean) {
  if (!status) {
    return <Badge variant="purple" className="text-xs">No Subscription</Badge>
  }

  if (cancelAtPeriodEnd && (status === 'active' || status === 'trialing')) {
    return <Badge variant="warning" className="text-xs">Canceling</Badge>
  }

  switch (status) {
    case 'active':
      return <Badge variant="success" className="text-xs">Active</Badge>
    case 'trialing':
      return <Badge variant="warning" className="text-xs">Trial</Badge>
    case 'past_due':
      return <Badge variant="destructive" className="text-xs">Past Due</Badge>
    case 'canceled':
      return <Badge variant="destructive" className="text-xs">Canceled</Badge>
    default:
      return <Badge variant="purple" className="text-xs">No Subscription</Badge>
  }
}

const subscriptionOrder: Record<string, number> = {
  'active': 1,
  'trialing': 2,
  'past_due': 3,
  'canceled': 4,
}

export function BusinessPerformanceTable({ businesses }: { businesses: BusinessReport[] }) {
  const [sortField, setSortField] = useState<SortField>('platform_fees')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedBusinesses = useMemo(() => {
    return [...businesses].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'subscription':
          const statusA = subscriptionOrder[a.subscription_status || ''] || 5
          const statusB = subscriptionOrder[b.subscription_status || ''] || 5
          comparison = statusA - statusB
          break
        case 'events':
          comparison = a.published_events - b.published_events
          break
        case 'tickets':
          comparison = a.total_tickets_sold - b.total_tickets_sold
          break
        case 'tables':
          comparison = a.total_table_bookings - b.total_table_bookings
          break
        case 'gross':
          comparison = a.total_revenue - b.total_revenue
          break
        case 'platform_fees':
          comparison = a.total_platform_fees - b.total_platform_fees
          break
        case 'sub_revenue':
          comparison = a.subscription_revenue_collected - b.subscription_revenue_collected
          break
        case 'last_activity':
          const dateA = a.last_activity_date ? new Date(a.last_activity_date).getTime() : 0
          const dateB = b.last_activity_date ? new Date(b.last_activity_date).getTime() : 0
          comparison = dateA - dateB
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [businesses, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  )

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="name">Business</SortableHeader>
            <SortableHeader field="subscription" className="text-center">Subscription</SortableHeader>
            <SortableHeader field="events" className="text-center">Events</SortableHeader>
            <SortableHeader field="tickets" className="text-center">Tickets</SortableHeader>
            <SortableHeader field="tables" className="text-center">Tables</SortableHeader>
            <SortableHeader field="gross" className="text-right">Gross Revenue</SortableHeader>
            <SortableHeader field="platform_fees" className="text-right text-green-600">Platform Fees</SortableHeader>
            <SortableHeader field="sub_revenue" className="text-right text-purple-600">Sub Revenue</SortableHeader>
            <SortableHeader field="last_activity" className="text-right">Last Activity</SortableHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBusinesses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No businesses found
              </TableCell>
            </TableRow>
          ) : (
            sortedBusinesses.map((business) => (
              <TableRow key={business.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{business.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      /{business.slug}
                      {!business.stripe_onboarding_complete && (
                        <Badge variant="outline" className="text-xs">No Stripe</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {getSubscriptionBadge(business.subscription_status, business.subscription_cancel_at_period_end)}
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">{business.published_events}</div>
                    <div className="text-xs text-muted-foreground">{business.total_events} total</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">{business.total_tickets_sold.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{business.total_orders} orders</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">{business.total_table_bookings}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(business.table_booking_revenue)}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(business.total_revenue)}
                </TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {formatCurrency(business.total_platform_fees)}
                </TableCell>
                <TableCell className="text-right font-medium text-purple-600">
                  {business.subscription_revenue_collected > 0
                    ? formatCurrency(business.subscription_revenue_collected)
                    : '-'}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDate(business.last_activity_date)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
