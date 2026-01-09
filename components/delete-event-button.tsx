'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

interface DeleteEventButtonProps {
  eventId: string
  eventTitle: string
  businessId: string
  businessSlug: string
  canDelete: boolean
  reasonCannotDelete?: string
  isRecurringInstance?: boolean
}

export function DeleteEventButton({
  eventId,
  eventTitle,
  businessId,
  businessSlug,
  canDelete,
  reasonCannotDelete,
  isRecurringInstance = false,
}: DeleteEventButtonProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'single' | 'future'>('single')

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const url = new URL(`/api/businesses/${businessId}/events/${eventId}`, window.location.origin)
      if (isRecurringInstance) {
        url.searchParams.set('mode', deleteMode)
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete event')
      }

      // Close the dialog first
      setShowDialog(false)

      // Redirect to events list
      router.push(`/${businessSlug}/dashboard/events`)
      router.refresh()
    } catch (error) {
      console.error('Error deleting event:', error)
      setIsDeleting(false)
      // Only show alert if it's a real API error, not a navigation issue
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete event'
      if (!errorMessage.includes('NEXT_REDIRECT')) {
        alert(errorMessage)
      }
    }
  }

  const button = (
    <Button
      size="sm"
      className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30"
      onClick={() => setShowDialog(true)}
      disabled={!canDelete || isDeleting}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Delete Event
    </Button>
  )

  return (
    <>
      {!canDelete && reasonCannotDelete ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-block">
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {reasonCannotDelete}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to delete <strong>&quot;{eventTitle}&quot;</strong>?
                  This action cannot be undone.
                </p>

                {isRecurringInstance && (
                  <RadioGroup
                    value={deleteMode}
                    onValueChange={(value) => setDeleteMode(value as 'single' | 'future')}
                    className="space-y-3 pt-2"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="single" id="single" />
                      <Label htmlFor="single" className="font-medium cursor-pointer">
                        This event only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="future" id="future" />
                      <Label htmlFor="future" className="font-medium cursor-pointer">
                        This and all future events
                      </Label>
                    </div>
                  </RadioGroup>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
