'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'

interface MarkArrivedButtonProps {
  bookingId: string
  currentStatus: string
  onStatusChange?: () => void
}

export function MarkArrivedButton({ bookingId, currentStatus, onStatusChange }: MarkArrivedButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleMarkArrived = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'arrived' }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      router.refresh()
      onStatusChange?.()
    } catch (error) {
      console.error('Error marking as arrived:', error)
      alert('Failed to mark as arrived. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (currentStatus === 'arrived') {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        Arrived
      </Button>
    )
  }

  if (currentStatus === 'seated') {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-teal-600" />
        Seated
      </Button>
    )
  }

  if (currentStatus === 'completed') {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-600" />
        Completed
      </Button>
    )
  }

  if (currentStatus === 'cancelled') {
    return null
  }

  return (
    <Button onClick={handleMarkArrived} disabled={isLoading} className="gap-2">
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      Mark as Arrived
    </Button>
  )
}
