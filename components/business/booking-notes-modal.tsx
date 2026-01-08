'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, StickyNote, Star, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Note {
  id: string
  content: string
  created_by_name: string
  created_by_email: string
  created_at: string
}

interface BookingNotesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  customerName: string
  tableName?: string
  mode?: 'notes' | 'complete'
  onComplete?: () => void
  onNoteAdded?: () => void
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [hoverValue, setHoverValue] = useState(0)

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          className="p-1 transition-transform hover:scale-110"
        >
          <Star
            strokeWidth={1.5}
            className={cn(
              'h-8 w-8 transition-colors',
              (hoverValue || value) >= star
                ? 'text-yellow-400 fill-yellow-900'
                : 'text-muted-foreground/30 fill-transparent'
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function BookingNotesModal({
  open,
  onOpenChange,
  bookingId,
  customerName,
  tableName,
  mode = 'notes',
  onComplete,
  onNoteAdded,
}: BookingNotesModalProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Completion mode state
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')

  // Reset completion mode state when modal opens
  useEffect(() => {
    if (open && mode === 'complete') {
      setRating(0)
      setFeedback('')
    }
  }, [open, mode])

  // Fetch notes when modal opens (only in notes mode)
  useEffect(() => {
    if (open && bookingId && mode === 'notes') {
      fetchNotes()
    }
  }, [open, bookingId, mode])

  const fetchNotes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/notes`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add note')
      }

      const data = await response.json()
      setNotes(data.notes)
      setNewNote('')
      toast.success('Note added')
      onNoteAdded?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleComplete = async () => {
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to complete reservation')
      }

      toast.success('Reservation completed')
      onOpenChange(false)
      onComplete?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to complete reservation'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Completion mode UI
  if (mode === 'complete') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Complete Reservation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Completing reservation for
              </p>
              <p className="font-medium text-lg">{customerName}</p>
              {tableName && (
                <p className="text-sm text-muted-foreground">Table {tableName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Rating</label>
              <div className="flex justify-center">
                <StarRating value={rating} onChange={setRating} />
              </div>
              {rating > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Feedback <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Any notes about this customer's visit..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleComplete}
              disabled={rating === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Complete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Notes mode UI (original)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes for {customerName}
            {tableName && <span className="text-muted-foreground font-normal">· Table {tableName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <StickyNote className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No notes yet</p>
              <p className="text-sm">Add a note below</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-muted/50 rounded-lg p-3 space-y-2"
              >
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <div className="text-xs text-muted-foreground">
                  {note.created_by_name} · {formatDate(note.created_at)}
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmitNote} className="flex gap-2 pt-2 border-t">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitNote(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-[60px] w-10 flex-shrink-0"
            disabled={!newNote.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          Press ⌘+Enter to send
        </p>
      </DialogContent>
    </Dialog>
  )
}
