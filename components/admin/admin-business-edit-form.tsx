'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Business } from '@/lib/types'

interface PlatformSettings {
  platform_fee_type: 'flat' | 'percentage' | 'higher_of_both'
  flat_fee_amount: number
  percentage_fee: number
}

interface AdminBusinessEditFormProps {
  businessId: string
  business: Business
}

export function AdminBusinessEditForm({ businessId, business }: AdminBusinessEditFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingSettings, setIsFetchingSettings] = useState(true)
  const [globalSettings, setGlobalSettings] = useState<PlatformSettings | null>(null)

  const [formData, setFormData] = useState({
    name: business.name || '',
    slug: business.slug || '',
    use_custom_fee_settings: business.use_custom_fee_settings || false,
    platform_fee_type: business.platform_fee_type || 'higher_of_both',
    flat_fee_amount: business.flat_fee_amount?.toString() || '',
    percentage_fee: business.percentage_fee?.toString() || '',
  })

  // Fetch global platform settings
  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        if (!response.ok) throw new Error('Failed to fetch settings')
        const data = await response.json()
        setGlobalSettings(data)

        // If business doesn't have custom settings, populate with global settings
        if (!business.use_custom_fee_settings) {
          setFormData(prev => ({
            ...prev,
            platform_fee_type: data.platform_fee_type,
            flat_fee_amount: data.flat_fee_amount.toString(),
            percentage_fee: data.percentage_fee.toString(),
          }))
        }
      } catch (err) {
        toast.error('Failed to load platform settings')
      } finally {
        setIsFetchingSettings(false)
      }
    }
    fetchGlobalSettings()
  }, [business.use_custom_fee_settings])

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }))
  }

  const handleResetToDefault = () => {
    if (!globalSettings) return

    setFormData(prev => ({
      ...prev,
      use_custom_fee_settings: false,
      platform_fee_type: globalSettings.platform_fee_type,
      flat_fee_amount: globalSettings.flat_fee_amount.toString(),
      percentage_fee: globalSettings.percentage_fee.toString(),
    }))
    toast.info('Fee settings reset to global defaults')
  }

  // Check if form has changes from original business data
  const hasChanges = useMemo(() => {
    if (formData.name !== (business.name || '')) return true
    if (formData.slug !== (business.slug || '')) return true
    if (formData.use_custom_fee_settings !== (business.use_custom_fee_settings || false)) return true

    // If using custom settings, compare fee fields
    if (formData.use_custom_fee_settings) {
      if (formData.platform_fee_type !== (business.platform_fee_type || 'higher_of_both')) return true
      if (formData.flat_fee_amount !== (business.flat_fee_amount?.toString() || '')) return true
      if (formData.percentage_fee !== (business.percentage_fee?.toString() || '')) return true
    }

    return false
  }, [formData, business])

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

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        slug: formData.slug,
        use_custom_fee_settings: formData.use_custom_fee_settings,
      }

      // Only include custom fee settings if enabled
      if (formData.use_custom_fee_settings) {
        updateData.platform_fee_type = formData.platform_fee_type
        updateData.flat_fee_amount = parseFloat(formData.flat_fee_amount)
        updateData.percentage_fee = parseFloat(formData.percentage_fee)
      } else {
        updateData.platform_fee_type = null
        updateData.flat_fee_amount = null
        updateData.percentage_fee = null
      }

      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
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

  if (isFetchingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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

      {/* Fee Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Fee Configuration</CardTitle>
              <CardDescription>
                {formData.use_custom_fee_settings
                  ? 'This business is using custom fee settings'
                  : 'This business is using global platform fee settings'}
              </CardDescription>
            </div>
            {formData.use_custom_fee_settings && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                disabled={isLoading}
              >
                Reset to Default
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Use Custom Settings Toggle */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="use_custom_fee_settings">Use Custom Fee Settings</Label>
              <p className="text-xs text-muted-foreground">
                Enable to override global platform fee settings for this business
              </p>
            </div>
            <Switch
              id="use_custom_fee_settings"
              checked={formData.use_custom_fee_settings}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, use_custom_fee_settings: checked })
              }
            />
          </div>

          {/* Show global settings as reference */}
          {!formData.use_custom_fee_settings && globalSettings && (
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Current Global Settings</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee Type:</span>
                  <span className="capitalize">{globalSettings.platform_fee_type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flat Fee:</span>
                  <span>${globalSettings.flat_fee_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Percentage Fee:</span>
                  <span>{globalSettings.percentage_fee}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Custom Fee Settings */}
          {formData.use_custom_fee_settings && (
            <>
              <div className="space-y-2">
                <Label htmlFor="platform_fee_type">Fee Calculation Method</Label>
                <Select
                  value={formData.platform_fee_type}
                  onValueChange={(value: typeof formData.platform_fee_type) =>
                    setFormData({ ...formData, platform_fee_type: value })
                  }
                >
                  <SelectTrigger id="platform_fee_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Fee Only</SelectItem>
                    <SelectItem value="percentage">Percentage Only</SelectItem>
                    <SelectItem value="higher_of_both">Higher of Flat or Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="flat_fee_amount">Flat Fee Amount ($)</Label>
                  <Input
                    id="flat_fee_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.flat_fee_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, flat_fee_amount: e.target.value })
                    }
                    placeholder="2.00"
                    required={formData.use_custom_fee_settings}
                    disabled={formData.platform_fee_type === 'percentage'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="percentage_fee">Percentage Fee (%)</Label>
                  <Input
                    id="percentage_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.percentage_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, percentage_fee: e.target.value })
                    }
                    placeholder="3.00"
                    required={formData.use_custom_fee_settings}
                    disabled={formData.platform_fee_type === 'flat'}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isLoading || !hasChanges}>
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
