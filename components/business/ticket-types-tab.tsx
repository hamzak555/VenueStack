'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import TicketTypeForm from './ticket-type-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'

interface TicketType {
  id: string
  name: string
  description: string | null
  price: number
  total_quantity: number
  available_quantity: number
  max_per_customer: number | null
  display_order: number
  is_active: boolean
  sale_start_date: string | null
  sale_end_date: string | null
}

interface TicketTypesTabProps {
  eventId: string
  isRecurringEvent?: boolean
}

export default function TicketTypesTab({ eventId, isRecurringEvent }: TicketTypesTabProps) {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<TicketType | null>(null)
  const [deleteFromSeries, setDeleteFromSeries] = useState(true)

  useEffect(() => {
    fetchTicketTypes()
  }, [eventId])

  const fetchTicketTypes = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/events/${eventId}/ticket-types`)
      if (response.ok) {
        const data = await response.json()
        setTicketTypes(data)
      }
    } catch (error) {
      console.error('Error fetching ticket types:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openDeleteDialog = (ticketType: TicketType) => {
    setTicketToDelete(ticketType)
    setDeleteFromSeries(true)
    setShowDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!ticketToDelete) return

    try {
      setDeletingId(ticketToDelete.id)
      setShowDeleteDialog(false)

      const url = isRecurringEvent && deleteFromSeries
        ? `/api/ticket-types/${ticketToDelete.id}?propagateToSeries=true`
        : `/api/ticket-types/${ticketToDelete.id}`

      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchTicketTypes()
      } else {
        alert('Failed to delete ticket')
      }
    } catch (error) {
      console.error('Error deleting ticket type:', error)
      alert('Failed to delete ticket')
    } finally {
      setDeletingId(null)
      setTicketToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setTicketToDelete(null)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingTicketType(null)
    fetchTicketTypes()
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingTicketType(null)
  }

  const openCreateForm = () => {
    setEditingTicketType(null)
    setShowForm(true)
  }

  const openEditForm = (ticketType: TicketType) => {
    setEditingTicketType(ticketType)
    setShowForm(true)
  }

  const soldTickets = (ticketType: TicketType) => {
    return ticketType.total_quantity - ticketType.available_quantity
  }

  const moveTicketType = async (ticketTypeId: string, direction: 'up' | 'down') => {
    const currentIndex = ticketTypes.findIndex(t => t.id === ticketTypeId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= ticketTypes.length) return

    const otherTicketType = ticketTypes[newIndex]
    const currentTicketType = ticketTypes[currentIndex]

    try {
      // If display_order values are the same (legacy data), normalize all orders first
      if (currentTicketType.display_order === otherTicketType.display_order) {
        // Normalize: assign sequential display_order based on current positions
        await Promise.all(
          ticketTypes.map((tt, idx) =>
            fetch(`/api/ticket-types/${tt.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ display_order: idx }),
            })
          )
        )
        // Now swap with the normalized values
        await Promise.all([
          fetch(`/api/ticket-types/${currentTicketType.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order: newIndex }),
          }),
          fetch(`/api/ticket-types/${otherTicketType.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order: currentIndex }),
          }),
        ])
      } else {
        // Swap display_order values
        await Promise.all([
          fetch(`/api/ticket-types/${currentTicketType.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order: otherTicketType.display_order }),
          }),
          fetch(`/api/ticket-types/${otherTicketType.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_order: currentTicketType.display_order }),
          }),
        ])
      }

      await fetchTicketTypes()
    } catch (error) {
      console.error('Error reordering ticket types:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tickets</CardTitle>
              <CardDescription>
                Create multiple ticket options with different prices and availability
              </CardDescription>
            </div>
            <Button onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Ticket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ticketTypes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">
                No tickets created yet. Add different ticket options like VIP, General Admission, or Early Bird.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Ticket
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketTypes.map((ticketType, index) => (
                  <TableRow key={ticketType.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveTicketType(ticketType.id, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveTicketType(ticketType.id, 'down')}
                          disabled={index === ticketTypes.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {ticketType.name}
                      {ticketType.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {ticketType.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      ${ticketType.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {soldTickets(ticketType)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ticketType.available_quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {ticketType.total_quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ticketType.is_active ? 'success' : 'secondary'}>
                        {ticketType.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(ticketType)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(ticketType)}
                          disabled={deletingId === ticketType.id}
                        >
                          {deletingId === ticketType.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTicketType ? 'Edit Ticket' : 'Create Ticket'}
            </DialogTitle>
            <DialogDescription>
              {editingTicketType
                ? 'Update the details of this ticket'
                : 'Add a new ticket option for this event'}
            </DialogDescription>
          </DialogHeader>
          <TicketTypeForm
            eventId={eventId}
            ticketType={editingTicketType || undefined}
            isRecurringEvent={isRecurringEvent}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Ticket Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{ticketToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isRecurringEvent && (
            <div className="py-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="delete_from_series"
                    checked={deleteFromSeries}
                    onChange={(e) => setDeleteFromSeries(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="delete_from_series" className="cursor-pointer font-medium">
                    Delete from all events in series
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Remove this ticket type from all recurring events
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
