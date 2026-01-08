'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon, Upload, X } from 'lucide-react'
import { format } from 'date-fns'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { GoogleMapsProvider } from '@/components/providers/google-maps-provider'
import { LocationAutocomplete } from '@/components/business/location-autocomplete'

interface DefaultLocation {
  address: string | null
  latitude: number | null
  longitude: number | null
  placeId: string | null
}

interface QuickEventModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  businessSlug: string
  initialDate?: Date
  defaultLocation?: DefaultLocation
  defaultTimezone?: string
}

export function QuickEventModal({
  open,
  onOpenChange,
  businessId,
  businessSlug,
  initialDate,
  defaultLocation,
  defaultTimezone = 'America/Los_Angeles',
}: QuickEventModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState<Date | undefined>(initialDate)
  const [time, setTime] = useState('')
  const [location, setLocation] = useState(defaultLocation?.address || '')
  const [locationLatitude, setLocationLatitude] = useState<number | null>(defaultLocation?.latitude || null)
  const [locationLongitude, setLocationLongitude] = useState<number | null>(defaultLocation?.longitude || null)
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(defaultLocation?.placeId || null)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Sync date with initialDate when it changes (e.g., clicking different calendar dates)
  useEffect(() => {
    if (initialDate) {
      setDate(initialDate)
    }
  }, [initialDate])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null

    try {
      const supabase = createClient()
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${businessId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, imageFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (err) {
      console.error('Image upload error:', err)
      throw new Error('Failed to upload image')
    }
  }

  const handleLocationChange = (
    loc: string,
    placeId: string | null,
    lat: number | null,
    lng: number | null
  ) => {
    setLocation(loc)
    setGooglePlaceId(placeId)
    setLocationLatitude(lat)
    setLocationLongitude(lng)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !date) {
      toast.error('Please enter a title and select a date.')
      return
    }

    setLoading(true)

    try {
      // Upload image if there's one
      const imageUrl = await uploadImage()

      const response = await fetch(`/api/businesses/${businessId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          event_date: format(date, 'yyyy-MM-dd'),
          event_time: time || null,
          location: location || null,
          location_latitude: locationLatitude,
          location_longitude: locationLongitude,
          google_place_id: googlePlaceId,
          image_url: imageUrl,
          timezone: defaultTimezone, // Always use business timezone
          status,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create event')
      }

      toast.success('Event created successfully!')
      resetForm()
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setTime('')
    // Reset location to default business address
    setLocation(defaultLocation?.address || '')
    setLocationLatitude(defaultLocation?.latitude || null)
    setLocationLongitude(defaultLocation?.longitude || null)
    setGooglePlaceId(defaultLocation?.placeId || null)
    setStatus('draft')
    setImageFile(null)
    setImagePreview(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      if (initialDate) {
        setDate(initialDate)
      }
      // Set default location when opening
      if (defaultLocation?.address) {
        setLocation(defaultLocation.address)
        setLocationLatitude(defaultLocation.latitude)
        setLocationLongitude(defaultLocation.longitude)
        setGooglePlaceId(defaultLocation.placeId)
      }
    }
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Add a new event to your calendar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                placeholder="Enter event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your event..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Event Image */}
            <div className="space-y-2">
              <Label>Event Image</Label>
              {imagePreview ? (
                <div className="relative w-20 h-20 border rounded-md overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Event preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-1 right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('modal-image-upload')?.click()}
                  className="w-20 h-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground mt-1">Add image</p>
                </div>
              )}
              <input
                id="modal-image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Location */}
            <GoogleMapsProvider>
              <LocationAutocomplete
                value={location}
                onChange={handleLocationChange}
                disabled={loading}
                label="Location"
                placeholder="Search for a venue..."
              />
            </GoogleMapsProvider>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value: 'draft' | 'published') => setStatus(value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
