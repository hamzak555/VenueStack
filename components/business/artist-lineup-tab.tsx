'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Upload, User, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Artist {
  id: string
  event_id: string
  name: string
  photo_url: string | null
  display_order: number
}

interface ArtistLineupTabProps {
  eventId: string
  isRecurringEvent?: boolean
}

export default function ArtistLineupTab({ eventId, isRecurringEvent }: ArtistLineupTabProps) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [propagateToSeries, setPropagateToSeries] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchArtists()
  }, [eventId])

  const fetchArtists = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/events/${eventId}/artists`)
      if (response.ok) {
        const data = await response.json()
        setArtists(data)
      }
    } catch (error) {
      console.error('Error fetching artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('eventId', eventId)

      const response = await fetch('/api/upload/artist', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setPhotoUrl(data.url)
      } else {
        alert('Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    try {
      const url = editingArtist
        ? `/api/events/${eventId}/artists/${editingArtist.id}`
        : `/api/events/${eventId}/artists`

      const method = editingArtist ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          photo_url: photoUrl,
          propagateToSeries: isRecurringEvent && propagateToSeries,
        }),
      })

      if (response.ok) {
        await fetchArtists()
        handleCloseForm()
      } else {
        alert('Failed to save artist')
      }
    } catch (error) {
      console.error('Error saving artist:', error)
      alert('Failed to save artist')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this artist?')) return

    setDeletingId(id)
    try {
      const url = isRecurringEvent && propagateToSeries
        ? `/api/events/${eventId}/artists/${id}?propagateToSeries=true`
        : `/api/events/${eventId}/artists/${id}`

      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchArtists()
      } else {
        alert('Failed to delete artist')
      }
    } catch (error) {
      console.error('Error deleting artist:', error)
      alert('Failed to delete artist')
    } finally {
      setDeletingId(null)
    }
  }

  const moveArtist = async (artistId: string, direction: 'up' | 'down') => {
    const currentIndex = artists.findIndex(a => a.id === artistId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= artists.length) return

    const otherArtist = artists[newIndex]
    const currentArtist = artists[currentIndex]

    try {
      // Swap display_order values
      await Promise.all([
        fetch(`/api/events/${eventId}/artists/${currentArtist.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: otherArtist.display_order }),
        }),
        fetch(`/api/events/${eventId}/artists/${otherArtist.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_order: currentArtist.display_order }),
        }),
      ])

      await fetchArtists()
    } catch (error) {
      console.error('Error reordering artists:', error)
    }
  }

  const openCreateForm = () => {
    setEditingArtist(null)
    setName('')
    setPhotoUrl(null)
    setShowForm(true)
  }

  const openEditForm = (artist: Artist) => {
    setEditingArtist(artist)
    setName(artist.name)
    setPhotoUrl(artist.photo_url)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingArtist(null)
    setName('')
    setPhotoUrl(null)
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
              <CardTitle>Artist Lineup</CardTitle>
              <CardDescription>
                Add artists performing at this event
              </CardDescription>
            </div>
            <Button onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Artist
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {artists.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">
                No artists added yet. Add artists to showcase who's performing at this event.
              </p>
              <Button onClick={openCreateForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Artist
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.map((artist, index) => (
                  <TableRow key={artist.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveArtist(artist.id, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveArtist(artist.id, 'down')}
                          disabled={index === artists.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-muted">
                        {artist.photo_url ? (
                          <Image
                            src={artist.photo_url}
                            alt={artist.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{artist.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(artist)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(artist.id)}
                          disabled={deletingId === artist.id}
                        >
                          {deletingId === artist.id ? (
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingArtist ? 'Edit Artist' : 'Add Artist'}
            </DialogTitle>
            <DialogDescription>
              {editingArtist
                ? 'Update the artist details'
                : 'Add a new artist to the lineup'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Artist Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., DJ Shadow, The Weeknd"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt="Artist photo"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Photo
                      </>
                    )}
                  </Button>
                  {photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPhotoUrl(null)}
                      className="w-full mt-2 text-destructive hover:text-destructive"
                    >
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {isRecurringEvent && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="propagate_artist"
                    checked={propagateToSeries}
                    onChange={(e) => setPropagateToSeries(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="propagate_artist" className="cursor-pointer font-medium">
                    Apply to all events in series
                  </Label>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSaving || !name.trim()} className="flex-1">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>{editingArtist ? 'Update Artist' : 'Add Artist'}</>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseForm} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
