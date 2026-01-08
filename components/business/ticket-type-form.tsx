'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'

interface TicketTypeFormProps {
  eventId: string
  ticketType?: {
    id: string
    name: string
    description: string | null
    price: number
    total_quantity: number
    max_per_customer: number | null
    is_active: boolean
    sale_start_date: string | null
    sale_end_date: string | null
  }
  isRecurringEvent?: boolean
  onSuccess: () => void
  onCancel: () => void
}

export default function TicketTypeForm({ eventId, ticketType, isRecurringEvent, onSuccess, onCancel }: TicketTypeFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [propagateToSeries, setPropagateToSeries] = useState(true) // Default to true for recurring events

  const [formData, setFormData] = useState({
    name: ticketType?.name || '',
    description: ticketType?.description || '',
    price: ticketType?.price.toString() || '',
    total_quantity: ticketType?.total_quantity.toString() || '',
    max_per_customer: ticketType?.max_per_customer?.toString() || '',
    is_active: ticketType?.is_active ?? true,
    sale_start_date: ticketType?.sale_start_date ? new Date(ticketType.sale_start_date) : undefined,
    sale_end_date: ticketType?.sale_end_date ? new Date(ticketType.sale_end_date) : undefined,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const url = ticketType
        ? `/api/ticket-types/${ticketType.id}`
        : `/api/ticket-types`

      const method = ticketType ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          total_quantity: parseInt(formData.total_quantity),
          max_per_customer: formData.max_per_customer ? parseInt(formData.max_per_customer) : null,
          is_active: formData.is_active,
          sale_start_date: formData.sale_start_date?.toISOString() || null,
          sale_end_date: formData.sale_end_date?.toISOString() || null,
          propagateToSeries: isRecurringEvent && propagateToSeries,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save ticket type')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Ticket Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., VIP, General Admission, Early Bird"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what's included with this ticket..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_quantity">Total Quantity *</Label>
              <Input
                id="total_quantity"
                type="number"
                min="1"
                value={formData.total_quantity}
                onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
                placeholder="100"
                required
              />
              {ticketType && (
                <p className="text-xs text-muted-foreground">
                  Changing quantity adjusts availability
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_per_customer">Limit Per Customer</Label>
              <Input
                id="max_per_customer"
                type="number"
                min="1"
                value={formData.max_per_customer}
                onChange={(e) => setFormData({ ...formData, max_per_customer: e.target.value })}
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Sale Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.sale_start_date ? (
                      format(formData.sale_start_date, 'PPP')
                    ) : (
                      <span className="text-muted-foreground">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.sale_start_date}
                    onSelect={(date) => setFormData({ ...formData, sale_start_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Sale End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.sale_end_date ? (
                      format(formData.sale_end_date, 'PPP')
                    ) : (
                      <span className="text-muted-foreground">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.sale_end_date}
                    onSelect={(date) => setFormData({ ...formData, sale_end_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active (available for purchase)
            </Label>
          </div>

          {isRecurringEvent && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="propagate_to_series"
                  checked={propagateToSeries}
                  onChange={(e) => setPropagateToSeries(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="propagate_to_series" className="cursor-pointer font-medium">
                  Apply to all events in series
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                {ticketType
                  ? 'Update matching ticket types across all recurring events'
                  : 'Create this ticket type for all recurring events'}
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{ticketType ? 'Update Ticket' : 'Create Ticket'}</>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
