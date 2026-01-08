'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface EventTableSection {
  id: string
  section_id: string
  section_name: string
}

interface NewReservationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventTableSections: EventTableSection[]
  sectionTableNames: Record<string, string[]>
  preSelectedSection?: string
  preSelectedTable?: string
  existingBookings: { event_table_section_id: string; table_number: string | null }[]
  closedTables?: Record<string, string[]>
}

export function NewReservationModal({
  open,
  onOpenChange,
  eventId,
  eventTableSections,
  sectionTableNames,
  preSelectedSection,
  preSelectedTable,
  existingBookings,
  closedTables = {},
}: NewReservationModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    sectionId: preSelectedSection || '',
    tableName: preSelectedTable || '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  })

  // Update form when modal opens with pre-selected values
  useEffect(() => {
    if (open && (preSelectedSection || preSelectedTable)) {
      setFormData(prev => ({
        ...prev,
        sectionId: preSelectedSection || prev.sectionId,
        tableName: preSelectedTable || prev.tableName,
      }))
    }
  }, [open, preSelectedSection, preSelectedTable])

  // Get available tables for selected section
  const getAvailableTables = () => {
    if (!formData.sectionId) return []

    const section = eventTableSections.find(s => s.id === formData.sectionId)
    if (!section) return []

    const tableNames = sectionTableNames[section.id] || []
    const sectionClosedTables = closedTables[section.section_id] || []

    // Filter out tables that already have bookings or are closed
    return tableNames.filter(tableName => {
      const hasBooking = existingBookings.some(
        b => b.event_table_section_id === formData.sectionId && b.table_number === tableName
      )
      const isClosed = sectionClosedTables.includes(tableName)
      return !hasBooking && !isClosed
    })
  }

  const availableTables = getAvailableTables()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.sectionId || !formData.tableName || !formData.customerName) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/table-bookings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          eventTableSectionId: formData.sectionId,
          tableName: formData.tableName,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail || null,
          customerPhone: formData.customerPhone || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create reservation')
      }

      toast.success('Reservation created successfully')
      onOpenChange(false)

      // Reset form
      setFormData({
        sectionId: '',
        tableName: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
      })

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create reservation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSectionChange = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      sectionId,
      tableName: '', // Reset table when section changes
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
          <DialogDescription>
            Create a manual reservation for a table.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="section">Section *</Label>
            <Select
              value={formData.sectionId}
              onValueChange={handleSectionChange}
            >
              <SelectTrigger id="section">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {eventTableSections.map(section => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.section_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="table">Table *</Label>
            <Select
              value={formData.tableName}
              onValueChange={(value) => setFormData(prev => ({ ...prev, tableName: value }))}
              disabled={!formData.sectionId}
            >
              <SelectTrigger id="table">
                <SelectValue placeholder={formData.sectionId ? "Select a table" : "Select a section first"} />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map(tableName => (
                  <SelectItem key={tableName} value={tableName}>
                    Table {tableName}
                  </SelectItem>
                ))}
                {availableTables.length === 0 && formData.sectionId && (
                  <SelectItem value="" disabled>
                    No available tables
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name *</Label>
            <Input
              id="customerName"
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail">Customer Email</Label>
            <Input
              id="customerEmail"
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPhone">Customer Phone</Label>
            <Input
              id="customerPhone"
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
