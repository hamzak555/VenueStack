'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { RefreshCcw, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { useRouter } from 'next/navigation'

interface TableBookingRefundDialogProps {
  bookingId: string
  maxRefundable: number
  totalRefunded: number
  sectionName: string
  tableNumber: number | null
  onRefundComplete?: () => void
}

export function TableBookingRefundDialog({
  bookingId,
  maxRefundable,
  totalRefunded,
  sectionName,
  tableNumber,
  onRefundComplete,
}: TableBookingRefundDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full')
  const [partialAmount, setPartialAmount] = useState('')
  const [reason, setReason] = useState('')

  const remainingRefundable = maxRefundable - totalRefunded

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const refundAmount = refundType === 'full'
      ? remainingRefundable
      : parseFloat(partialAmount)

    // Validation
    if (isNaN(refundAmount) || refundAmount <= 0) {
      toast.error('Please enter a valid refund amount')
      return
    }

    if (refundAmount > remainingRefundable) {
      toast.error(`Refund amount cannot exceed ${formatCurrency(remainingRefundable)}`)
      return
    }

    // Show confirmation dialog
    setShowConfirmation(true)
  }

  const processRefund = async () => {
    const refundAmount = refundType === 'full'
      ? remainingRefundable
      : parseFloat(partialAmount)

    setIsProcessing(true)
    setShowConfirmation(false)

    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: refundAmount,
          reason: reason.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process refund')
      }

      toast.success(`Refund of ${formatCurrency(refundAmount)} processed successfully`)
      setIsOpen(false)
      setRefundType('full')
      setPartialAmount('')
      setReason('')
      router.refresh()
      onRefundComplete?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process refund')
    } finally {
      setIsProcessing(false)
    }
  }

  const refundAmount = refundType === 'full'
    ? remainingRefundable
    : parseFloat(partialAmount)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={remainingRefundable <= 0}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Process Refund
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund for {sectionName} - Table #{tableNumber}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Refund Info */}
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking Amount:</span>
                  <span className="font-medium">{formatCurrency(maxRefundable)}</span>
                </div>
                {totalRefunded > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Refunded:</span>
                    <span className="font-medium text-destructive">-{formatCurrency(totalRefunded)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-border/50">
                  <span className="font-semibold">Remaining Refundable:</span>
                  <span className="font-bold">{formatCurrency(remainingRefundable)}</span>
                </div>
              </div>

              {/* Refund Type */}
              <div className="space-y-3">
                <Label>Refund Type</Label>
                <RadioGroup value={refundType} onValueChange={(value: 'full' | 'partial') => setRefundType(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="full" />
                    <Label htmlFor="full" className="font-normal cursor-pointer">
                      Full Refund ({formatCurrency(remainingRefundable)})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="partial" />
                    <Label htmlFor="partial" className="font-normal cursor-pointer">
                      Partial Refund
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Partial Amount Input */}
              {refundType === 'partial' && (
                <div className="space-y-2">
                  <Label htmlFor="amount">Refund Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remainingRefundable}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum: {formatCurrency(remainingRefundable)}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Customer requested refund due to schedule conflict"
                  rows={3}
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> This will deduct funds from the business&apos;s Stripe account. This action cannot be undone.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Refund'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle>Confirm Refund</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you absolutely sure you want to process this refund?
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-3 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Table:</span>
                <span className="font-medium">{sectionName} #{tableNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Refund Amount:</span>
                <span className="text-lg font-bold text-destructive">{formatCurrency(refundAmount)}</span>
              </div>
              {reason && (
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Reason:</span>
                  <p className="text-sm mt-1">{reason}</p>
                </div>
              )}
            </div>

            <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3">
              <ul className="text-sm space-y-1 text-destructive">
                <li>• Funds will be deducted from the business&apos;s Stripe account</li>
                <li>• This action cannot be undone</li>
                <li>• The customer will be notified of the refund</li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={processRefund}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Refund'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
