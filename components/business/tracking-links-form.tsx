'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Link2, Plus, Copy, Check, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { TrackingLink } from '@/lib/types'

interface TrackingLinksFormProps {
  businessId: string
  businessSlug: string
}

export function TrackingLinksForm({ businessId, businessSlug }: TrackingLinksFormProps) {
  const router = useRouter()
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<TrackingLink | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<TrackingLink | null>(null)

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'

  useEffect(() => {
    fetchTrackingLinks()
  }, [businessId])

  const fetchTrackingLinks = async () => {
    try {
      const response = await fetch(`/api/businesses/${businessId}/tracking-links`)
      const data = await response.json()
      if (response.ok) {
        setTrackingLinks(data.trackingLinks || [])
      }
    } catch (error) {
      console.error('Error fetching tracking links:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingLink(null)
    setFormData({ name: '', description: '' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (link: TrackingLink) => {
    setEditingLink(link)
    setFormData({
      name: link.name,
      description: link.description || '',
    })
    setDialogOpen(true)
  }

  const generateRefCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingLink
        ? `/api/businesses/${businessId}/tracking-links/${editingLink.id}`
        : `/api/businesses/${businessId}/tracking-links`

      // Auto-generate ref_code from name
      const ref_code = editingLink ? editingLink.ref_code : generateRefCode(formData.name)

      const response = await fetch(url, {
        method: editingLink ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, ref_code }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save tracking link')
      }

      toast.success(editingLink ? 'Tracking link updated!' : 'Tracking link created!')
      setDialogOpen(false)
      fetchTrackingLinks()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!linkToDelete) return

    try {
      const response = await fetch(
        `/api/businesses/${businessId}/tracking-links/${linkToDelete.id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete tracking link')
      }

      toast.success('Tracking link deleted!')
      setDeleteDialogOpen(false)
      setLinkToDelete(null)
      fetchTrackingLinks()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleToggleActive = async (link: TrackingLink) => {
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/tracking-links/${link.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !link.is_active }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update tracking link')
      }

      toast.success(link.is_active ? 'Tracking link deactivated' : 'Tracking link activated')
      fetchTrackingLinks()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const copyToClipboard = async (link: TrackingLink) => {
    const url = `${baseUrl}/${businessSlug}?ref=${link.ref_code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Tracking Links
              </CardTitle>
              <CardDescription>
                Create custom links to track where your ticket sales and table bookings come from
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Create Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : trackingLinks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No tracking links yet</p>
              <Button onClick={handleOpenCreate} variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {trackingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{link.name}</span>
                      {!link.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        ?ref={link.ref_code}
                      </code>
                      {link.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {link.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(link)}
                      title="Copy link"
                    >
                      {copiedId === link.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(`${baseUrl}/${businessSlug}?ref=${link.ref_code}`, '_blank')}
                      title="Open link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEdit(link)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setLinkToDelete(link)
                        setDeleteDialogOpen(true)
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? 'Edit Tracking Link' : 'Create Tracking Link'}
            </DialogTitle>
            <DialogDescription>
              {editingLink
                ? 'Update the tracking link details below.'
                : 'Create a link to track where your sales come from.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Instagram"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Link in Instagram bio for summer campaign"
                />
              </div>

              {formData.name && !editingLink && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Your tracking link:</p>
                  <code className="text-sm break-all">
                    {baseUrl}/{businessSlug}?ref={generateRefCode(formData.name)}
                  </code>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingLink ? 'Save Changes' : 'Create Link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tracking Link</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{linkToDelete?.name}&quot;? Historical data from
              orders using this link will be preserved, but the link will no longer be tracked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
