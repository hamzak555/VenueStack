'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface AdminBusinessEditFormProps {
  businessId: string
  business: {
    name: string
    slug: string
  }
}

export function AdminBusinessEditForm({ businessId, business }: AdminBusinessEditFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: business.name || '',
    slug: business.slug || '',
  })

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData({
      name,
      slug: generateSlug(name),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        throw new Error('Slug can only contain lowercase letters, numbers, and hyphens')
      }

      if (formData.slug.length < 3) {
        throw new Error('Slug must be at least 3 characters long')
      }

      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update business')
      }

      toast.success('Business updated successfully!')
      router.push('/admin/businesses')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Business Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Business Name"
          required
        />
        <p className="text-xs text-muted-foreground">
          The display name for this business
        </p>
      </div>

      {/* URL Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">URL Slug</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">/</span>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
            placeholder="business-name"
            required
            pattern="[a-z0-9-]+"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The unique URL identifier for this business. Only lowercase letters, numbers, and hyphens allowed.
        </p>
        <p className="text-xs text-muted-foreground">
          Public URL: <span className="font-mono">/{formData.slug}</span>
        </p>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Changes'}
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
    </form>
  )
}
