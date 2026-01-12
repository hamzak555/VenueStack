'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { DoorOpen, Loader2 } from 'lucide-react'

interface BusinessDashboardLinkProps {
  businessId: string
  businessSlug: string
}

export function BusinessDashboardLink({ businessId, businessSlug }: BusinessDashboardLinkProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      // Set admin bypass session
      await fetch('/api/business/admin-bypass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businessId }),
      })

      // Navigate to business dashboard
      router.push(`/${businessSlug}/dashboard`)
    } catch (error) {
      console.error('Error setting admin bypass:', error)
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={loading}
      title="Dashboard"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
    </Button>
  )
}
