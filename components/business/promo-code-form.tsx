'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TicketType {
  id: string
  name: string
  price: number
}

interface PromoCodeFormProps {
  eventId: string
  businessId: string
  businessSlug: string
  ticketTypes: TicketType[]
  isRecurringEvent?: boolean
  initialData?: {
    id: string
    code: string
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    max_uses: number | null
    valid_from: string | null
    valid_until: string | null
    is_active: boolean
    ticket_type_ids: string[] | null
  }
}

export function PromoCodeForm({ eventId, businessId, businessSlug, ticketTypes, isRecurringEvent, initialData }: PromoCodeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [propagateToSeries, setPropagateToSeries] = useState(true)
  const [formData, setFormData] = useState({
    code: initialData?.code || '',
    discount_type: initialData?.discount_type || 'percentage' as 'percentage' | 'fixed',
    discount_value: initialData?.discount_value || 0,
    max_uses: initialData?.max_uses || null as number | null,
    valid_from: initialData?.valid_from ? new Date(initialData.valid_from) : undefined as Date | undefined,
    valid_until: initialData?.valid_until ? new Date(initialData.valid_until) : undefined as Date | undefined,
    is_active: initialData?.is_active ?? true,
    ticket_type_ids: initialData?.ticket_type_ids || [] as string[],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = initialData
        ? `/api/events/${eventId}/promo-codes/${initialData.id}`
        : `/api/events/${eventId}/promo-codes`

      const method = initialData ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          event_id: eventId,
          valid_from: formData.valid_from ? formData.valid_from.toISOString() : null,
          valid_until: formData.valid_until ? formData.valid_until.toISOString() : null,
          ticket_type_ids: formData.ticket_type_ids.length > 0 ? formData.ticket_type_ids : null,
          propagateToSeries: isRecurringEvent && propagateToSeries,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save promo code')
      }

      router.push(`/${businessSlug}/dashboard/events/${eventId}?tab=promo`)
      router.refresh()
    } catch (error) {
      console.error('Error saving promo code:', error)
      alert(error instanceof Error ? error.message : 'Failed to save promo code')
    } finally {
      setLoading(false)
    }
  }

  const toggleTicketType = (ticketTypeId: string) => {
    setFormData(prev => ({
      ...prev,
      ticket_type_ids: prev.ticket_type_ids.includes(ticketTypeId)
        ? prev.ticket_type_ids.filter(id => id !== ticketTypeId)
        : [...prev.ticket_type_ids, ticketTypeId],
    }))
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{initialData ? 'Edit' : 'Create'} Promo Code</CardTitle>
          <CardDescription>
            Create discount codes for your event tickets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="code">Promo Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="SUMMER2024"
              required
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Code will be converted to uppercase
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount_type">Discount Type *</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value: 'percentage' | 'fixed') =>
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger id="discount_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_value">
                Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
              </Label>
              <Input
                id="discount_value"
                type="number"
                min="0"
                max={formData.discount_type === 'percentage' ? '100' : undefined}
                step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                value={formData.discount_value}
                onChange={(e) =>
                  setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_uses">Maximum Uses</Label>
            <Input
              id="max_uses"
              type="number"
              min="0"
              value={formData.max_uses || ''}
              onChange={(e) =>
                setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : null })
              }
              placeholder="Unlimited"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for unlimited uses
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Valid From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.valid_from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.valid_from ? format(formData.valid_from, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.valid_from}
                    onSelect={(date) => setFormData({ ...formData, valid_from: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.valid_until && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.valid_until ? format(formData.valid_until, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.valid_until}
                    onSelect={(date) => setFormData({ ...formData, valid_until: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {ticketTypes.length > 0 && (
            <div className="space-y-3">
              <Label>Applicable Ticket Types</Label>
              <p className="text-sm text-muted-foreground">
                Select which ticket types this promo code applies to (leave all unchecked for all types)
              </p>
              <div className="space-y-2 border rounded-lg p-4">
                {ticketTypes.map((ticketType) => (
                  <div key={ticketType.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`ticket-${ticketType.id}`}
                      checked={formData.ticket_type_ids.includes(ticketType.id)}
                      onCheckedChange={() => toggleTicketType(ticketType.id)}
                    />
                    <Label
                      htmlFor={`ticket-${ticketType.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {ticketType.name} - ${ticketType.price.toFixed(2)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked as boolean })
              }
            />
            <Label htmlFor="is_active" className="text-sm font-normal cursor-pointer">
              Active (customers can use this code)
            </Label>
          </div>

          {isRecurringEvent && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="propagate_promo"
                  checked={propagateToSeries}
                  onCheckedChange={(checked) => setPropagateToSeries(checked as boolean)}
                />
                <Label htmlFor="propagate_promo" className="cursor-pointer font-medium">
                  Apply to all events in series
                </Label>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : initialData ? 'Update Promo Code' : 'Create Promo Code'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
