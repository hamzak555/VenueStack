'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { AddressAutocomplete } from '@/components/business/address-autocomplete'
import { GoogleMapsProvider } from '@/components/providers/google-maps-provider'
import { LogoUpload } from '@/components/business/logo-upload'
import { ThemeColorPicker } from '@/components/business/theme-color-picker'
import { TimezoneSelector } from '@/components/business/timezone-selector'

interface AccountSettingsFormProps {
  businessId: string
  businessSlug: string
  business: {
    name: string
    logo_url: string | null
    theme_color: string
    contact_email: string | null
    contact_phone: string | null
    address: string | null
    address_latitude: number | null
    address_longitude: number | null
    google_place_id: string | null
    website: string | null
    instagram: string | null
    tiktok: string | null
    facebook: string | null
    terms_and_conditions: string | null
    default_timezone: string | null
  }
}

export function AccountSettingsForm({ businessId, businessSlug, business }: AccountSettingsFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Store initial values for comparison
  const initialFormData = useMemo(() => ({
    name: business.name || '',
    logo_url: business.logo_url,
    theme_color: business.theme_color || '#3b82f6',
    contact_email: business.contact_email || '',
    contact_phone: business.contact_phone || '',
    address: business.address || '',
    address_latitude: business.address_latitude,
    address_longitude: business.address_longitude,
    google_place_id: business.google_place_id,
    website: business.website || '',
    instagram: business.instagram || '',
    tiktok: business.tiktok || '',
    facebook: business.facebook || '',
    terms_and_conditions: business.terms_and_conditions || '',
    default_timezone: business.default_timezone || 'America/Los_Angeles',
  }), [business])

  const [formData, setFormData] = useState({
    name: business.name || '',
    logo_url: business.logo_url,
    theme_color: business.theme_color || '#3b82f6',
    contact_email: business.contact_email || '',
    contact_phone: business.contact_phone || '',
    address: business.address || '',
    address_latitude: business.address_latitude,
    address_longitude: business.address_longitude,
    google_place_id: business.google_place_id,
    website: business.website || '',
    instagram: business.instagram || '',
    tiktok: business.tiktok || '',
    facebook: business.facebook || '',
    terms_and_conditions: business.terms_and_conditions || '',
    default_timezone: business.default_timezone || 'America/Los_Angeles',
  })

  // Check if form has changes
  const hasChanges = useMemo(() => {
    return (
      formData.name !== initialFormData.name ||
      formData.logo_url !== initialFormData.logo_url ||
      formData.theme_color !== initialFormData.theme_color ||
      formData.contact_email !== initialFormData.contact_email ||
      formData.contact_phone !== initialFormData.contact_phone ||
      formData.address !== initialFormData.address ||
      formData.website !== initialFormData.website ||
      formData.instagram !== initialFormData.instagram ||
      formData.tiktok !== initialFormData.tiktok ||
      formData.facebook !== initialFormData.facebook ||
      formData.terms_and_conditions !== initialFormData.terms_and_conditions ||
      formData.default_timezone !== initialFormData.default_timezone
    )
  }, [formData, initialFormData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update account settings')
      }

      toast.success('Account settings updated successfully!')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Logo */}
      <LogoUpload
        businessId={businessId}
        currentLogoUrl={formData.logo_url}
        onLogoChange={(url) => setFormData({ ...formData, logo_url: url })}
        disabled={isLoading}
      />

      {/* Theme Color */}
      <ThemeColorPicker
        value={formData.theme_color}
        onChange={(color) => setFormData({ ...formData, theme_color: color })}
        disabled={isLoading}
      />

      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Business Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Your Business Name"
          required
        />
      </div>

      {/* Contact Email */}
      <div className="space-y-2">
        <Label htmlFor="contact_email">Contact Email</Label>
        <Input
          id="contact_email"
          type="email"
          value={formData.contact_email}
          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          placeholder="contact@yourbusiness.com"
        />
        <p className="text-xs text-muted-foreground">
          This email will be displayed to customers for support inquiries
        </p>
      </div>

      {/* Phone Number */}
      <div className="space-y-2">
        <Label htmlFor="contact_phone">Phone Number</Label>
        <Input
          id="contact_phone"
          type="tel"
          value={formData.contact_phone}
          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
          placeholder="+1 (555) 123-4567"
        />
      </div>

      {/* Address */}
      <GoogleMapsProvider>
        <AddressAutocomplete
          value={formData.address}
          onChange={(address, placeId, lat, lng) =>
            setFormData({
              ...formData,
              address,
              google_place_id: placeId,
              address_latitude: lat,
              address_longitude: lng,
            })
          }
          disabled={isLoading}
        />
      </GoogleMapsProvider>

      {/* Default Timezone */}
      <TimezoneSelector
        value={formData.default_timezone}
        onChange={(timezone) => setFormData({ ...formData, default_timezone: timezone })}
        disabled={isLoading}
        label="Timezone"
        description="All events will use this timezone for displaying dates and times."
      />

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          placeholder="https://yourbusiness.com"
        />
      </div>

      {/* Social Media */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            value={formData.instagram}
            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            placeholder="@yourbusiness or URL"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tiktok">TikTok</Label>
          <Input
            id="tiktok"
            value={formData.tiktok}
            onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
            placeholder="@yourbusiness or URL"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="facebook">Facebook</Label>
          <Input
            id="facebook"
            value={formData.facebook}
            onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
            placeholder="Page name or URL"
          />
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="space-y-2">
        <Label htmlFor="terms_and_conditions">Terms and Conditions</Label>
        <Textarea
          id="terms_and_conditions"
          value={formData.terms_and_conditions}
          onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
          placeholder="Enter your terms and conditions for ticket purchases..."
          rows={4}
          className="resize-none max-h-32 overflow-y-auto"
        />
        <p className="text-xs text-muted-foreground">
          These terms will be shown to customers during checkout. Leave empty to hide the terms checkbox.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isLoading || !hasChanges}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
