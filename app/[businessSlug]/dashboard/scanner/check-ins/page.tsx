import { createClient } from '@/lib/supabase/server'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function CheckInsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)
  const supabase = await createClient()

  // Get all checked-in tickets for this business
  const { data: checkedInTickets } = await supabase
    .from('tickets')
    .select(`
      *,
      event:events (
        id,
        title,
        event_date,
        event_time,
        business_id
      ),
      order:orders (
        customer_name,
        customer_email
      )
    `)
    .not('checked_in_at', 'is', null)
    .eq('event.business_id', business.id)
    .order('checked_in_at', { ascending: false })
    .limit(100)

  const formatTimeTo12Hour = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${businessSlug}/dashboard/scanner`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Scanner
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Check-In History</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Check-Ins</CardTitle>
          <CardDescription>
            Showing the latest 100 ticket check-ins
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!checkedInTickets || checkedInTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No check-ins yet</p>
              <p className="text-sm mt-2">Start scanning tickets to see check-in history</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checked In</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Ticket Number</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkedInTickets.map((ticket: any) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(ticket.checked_in_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(ticket.checked_in_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{ticket.order.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{ticket.order.customer_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{ticket.event.title}</div>
                      {ticket.event.event_date && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(ticket.event.event_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {ticket.event.event_time && ` at ${formatTimeTo12Hour(ticket.event.event_time)}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {ticket.ticket_number}
                      </code>
                    </TableCell>
                    <TableCell>
                      ${parseFloat(ticket.price).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ticket.status === 'valid' ? 'success' : 'secondary'}>
                        {ticket.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
