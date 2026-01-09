'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BusinessFormProps {
  initialData?: {
    name: string
    slug: string
    description: string
    contact_email: string
    contact_phone: string
    website: string
  }
  businessId?: string
}

export function BusinessForm({ initialData, businessId }: BusinessFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    contact_email: initialData?.contact_email || '',
    contact_phone: initialData?.contact_phone || '',
    website: initialData?.website || '',
  })

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setFormData((prev) => ({
      ...prev,
      name,
      // Auto-generate slug if it hasn't been manually edited
      slug: prev.slug === generateSlug(prev.name) || prev.slug === ''
        ? generateSlug(name)
        : prev.slug,
    }))
  }

  // Check if form has changes
  const hasChanges = useMemo(() => {
    // For create mode, allow save if required fields are filled
    if (!businessId) {
      return formData.name.trim() !== '' && formData.slug.trim() !== ''
    }

    // For edit mode, compare with initial values
    if (!initialData) return false
    if (formData.name !== initialData.name) return true
    if (formData.slug !== initialData.slug) return true
    if (formData.description !== (initialData.description || '')) return true
    if (formData.contact_email !== (initialData.contact_email || '')) return true
    if (formData.contact_phone !== (initialData.contact_phone || '')) return true
    if (formData.website !== (initialData.website || '')) return true

    return false
  }, [formData, initialData, businessId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const url = businessId
        ? `/api/businesses/${businessId}`
        : '/api/businesses'

      const method = businessId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save business')
      }

      router.push('/admin/businesses')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{businessId ? 'Edit Business' : 'Create New Business'}</CardTitle>
          <CardDescription>
            {businessId
              ? 'Update business information and settings'
              : 'Set up a new business account with a custom URL'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleNameChange}
                placeholder="Enter business name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                  /
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: generateSlug(e.target.value) })
                  }
                  placeholder="business-name"
                  required
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will be the public URL: yoursite.com/{formData.slug || 'business-name'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of the business"
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) =>
                  setFormData({ ...formData, contact_email: e.target.value })
                }
                placeholder="contact@business.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) =>
                  setFormData({ ...formData, contact_phone: e.target.value })
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) =>
                setFormData({ ...formData, website: e.target.value })
              }
              placeholder="https://business.com"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading || !hasChanges}>
              {isLoading ? 'Saving...' : businessId ? 'Update Business' : 'Create Business'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/businesses')}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
