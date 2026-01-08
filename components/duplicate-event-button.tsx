'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface DuplicateEventButtonProps {
  eventId: string
  eventTitle: string
  businessId: string
  businessSlug: string
}

export function DuplicateEventButton({
  eventId,
  eventTitle,
  businessId,
  businessSlug,
}: DuplicateEventButtonProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  const handleDuplicate = async () => {
    setIsDuplicating(true)
    try {
      const response = await fetch(`/api/businesses/${businessId}/events/${eventId}/duplicate`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate event')
      }

      // Redirect to the new event
      router.push(`/${businessSlug}/dashboard/events/${data.event.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error duplicating event:', error)
      alert(error instanceof Error ? error.message : 'Failed to duplicate event')
      setIsDuplicating(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={isDuplicating}
      >
        <Copy className="h-4 w-4 mr-2" />
        Duplicate
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Event</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a copy of <strong>&quot;{eventTitle}&quot;</strong> with all its details,
              ticket types, and artist lineup. The new event will be saved as a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDuplicating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDuplicate}
              disabled={isDuplicating}
            >
              {isDuplicating ? 'Duplicating...' : 'Duplicate Event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
