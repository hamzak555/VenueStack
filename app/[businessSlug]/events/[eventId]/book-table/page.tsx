'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function BookTablePage({ params }: { params: Promise<{ businessSlug: string; eventId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()

  useEffect(() => {
    // Redirect to the unified checkout page with tables mode
    router.replace(`/${resolvedParams.businessSlug}/events/${resolvedParams.eventId}/checkout?mode=tables`)
  }, [router, resolvedParams.businessSlug, resolvedParams.eventId])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
