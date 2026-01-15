'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ResendTicketsButtonProps {
  orderId: string
  customerEmail: string
}

export function ResendTicketsButton({ orderId, customerEmail }: ResendTicketsButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleResend = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/resend`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend tickets')
      }

      toast.success(`Tickets sent to ${customerEmail}`)
    } catch (error) {
      console.error('Error resending tickets:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to resend tickets')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleResend}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Mail className="mr-2 h-4 w-4" />
      )}
      Resend Tickets
    </Button>
  )
}
