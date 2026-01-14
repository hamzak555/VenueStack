'use client'

import { useState, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { X, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

interface LogoUploadProps {
  businessId: string
  currentLogoUrl: string | null
  onLogoChange: (url: string | null) => void
  disabled?: boolean
}

export function LogoUpload({ businessId, currentLogoUrl, onLogoChange, disabled }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(currentLogoUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploading(true)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('businessId', businessId)

      // Upload to API
      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await response.json()

      // Update preview and notify parent
      setLogoPreview(data.url)
      onLogoChange(data.url)

      toast.success('Logo uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = () => {
    setLogoPreview(null)
    onLogoChange(null)
    toast.success('Logo removed')
  }

  return (
    <div className="space-y-2">
      <Label>Business Logo</Label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {/* Logo Preview - Clickable */}
      <div className="inline-block">
        {logoPreview ? (
          <div
            className="relative w-32 h-32 rounded-lg border bg-muted overflow-hidden group cursor-pointer hover:border-primary transition-colors"
            onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          >
            <Image
              src={logoPreview}
              alt="Business logo"
              fill
              className="object-contain p-2"
            />
            {uploading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Uploading...</span>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveLogo()
              }}
              disabled={disabled || uploading}
              className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            className="w-32 h-32 rounded-lg border-2 border-dashed bg-muted flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <span className="text-xs text-muted-foreground">Uploading...</span>
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Max size: 5MB.
        </p>
      </div>
    </div>
  )
}
