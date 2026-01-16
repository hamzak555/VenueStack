import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'
import { Refund } from '@/lib/types'
import { CheckCircle2, XCircle, Clock, Ban } from 'lucide-react'

interface RefundHistoryProps {
  refunds: Refund[]
}

export function RefundHistory({ refunds }: RefundHistoryProps) {
  if (refunds.length === 0) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />
      case 'cancelled':
        return <Ban className="h-5 w-5 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'success'
      case 'failed':
        return 'destructive'
      case 'pending':
        return 'warning'
      case 'cancelled':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund History</CardTitle>
        <CardDescription>
          {refunds.length} refund{refunds.length !== 1 ? 's' : ''} processed for this order
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {refunds.map((refund, index) => (
            <div
              key={refund.id}
              className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
            >
              {/* Timeline Indicator */}
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-muted p-2">
                  {getStatusIcon(refund.status)}
                </div>
                {index < refunds.length - 1 && (
                  <div className="w-0.5 h-full bg-border mt-2" />
                )}
              </div>

              {/* Refund Details */}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg">
                        {formatCurrency(refund.amount)}
                      </p>
                      <Badge variant={getStatusColor(refund.status) as any} className="capitalize">
                        {refund.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(refund.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {refund.refunded_by_name && (
                        <span> by {refund.refunded_by_name}</span>
                      )}
                    </p>
                    {refund.voided_tickets && (
                      <p className="text-xs text-destructive mt-0.5">Tickets voided</p>
                    )}
                  </div>
                </div>

                {refund.reason && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-medium mb-1">Reason:</p>
                    <p className="text-sm text-muted-foreground">{refund.reason}</p>
                  </div>
                )}

                {refund.stripe_refund_id && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Stripe ID: {refund.stripe_refund_id}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
