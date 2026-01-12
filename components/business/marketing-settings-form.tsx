'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Check, Copy, Code, ExternalLink } from 'lucide-react'

// Render embed code with syntax highlighting as React elements
function HighlightedCode({ code }: { code: string }) {
  const parts: React.ReactNode[] = []
  let key = 0

  // Split by tags, keeping the delimiters
  const segments = code.split(/(<\/?[a-zA-Z][\w-]*(?:\s[^>]*)?>)/g)

  for (const segment of segments) {
    if (!segment) continue

    // Check if this is a tag (starts with < and ends with >)
    if (segment.startsWith('<') && segment.endsWith('>')) {
      // Parse the tag
      const isClosing = segment.startsWith('</')
      const isSelfClosing = segment.endsWith('/>')
      const inner = segment.slice(isClosing ? 2 : 1, isSelfClosing ? -2 : -1)
      const firstSpace = inner.search(/\s/)
      const tagName = firstSpace === -1 ? inner : inner.slice(0, firstSpace)
      const attrsStr = firstSpace === -1 ? '' : inner.slice(firstSpace)

      // Opening bracket
      parts.push(<span key={key++} style={{ color: '#f472b6' }}>{isClosing ? '</' : '<'}</span>)
      // Tag name
      parts.push(<span key={key++} style={{ color: '#60a5fa' }}>{tagName}</span>)

      // Process attributes if any
      if (attrsStr) {
        const attrRegex = /(\s+)([\w-]+)(=)("[^"]*"|'[^']*')|(\s+)/g
        let match
        let lastIndex = 0

        while ((match = attrRegex.exec(attrsStr)) !== null) {
          if (match[5]) {
            // Just whitespace
            parts.push(<span key={key++}>{match[5]}</span>)
          } else {
            // Attribute with value
            parts.push(<span key={key++}>{match[1]}</span>) // whitespace
            parts.push(<span key={key++} style={{ color: '#fbbf24' }}>{match[2]}</span>) // attr name
            parts.push(<span key={key++} style={{ color: '#d1d5db' }}>{match[3]}</span>) // =
            parts.push(<span key={key++} style={{ color: '#4ade80' }}>{match[4]}</span>) // value
          }
          lastIndex = match.index + match[0].length
        }

        // Any remaining text in attrs
        if (lastIndex < attrsStr.length) {
          parts.push(<span key={key++}>{attrsStr.slice(lastIndex)}</span>)
        }
      }

      // Closing bracket
      parts.push(<span key={key++} style={{ color: '#f472b6' }}>{isSelfClosing ? '/>' : '>'}</span>)
    } else {
      // Regular text (whitespace/newlines between tags, or stray characters)
      // Handle any stray > that might appear
      if (segment === '>') {
        parts.push(<span key={key++} style={{ color: '#f472b6' }}>{'>'}</span>)
      } else {
        parts.push(<span key={key++}>{segment}</span>)
      }
    }
  }

  return <>{parts}</>
}

interface MarketingSettingsFormProps {
  businessId: string
  businessSlug: string
  business: {
    facebook_pixel_id: string | null
    google_analytics_id: string | null
    google_tag_manager_id: string | null
    google_ads_id: string | null
    tiktok_pixel_id: string | null
    custom_header_scripts: string | null
    purchase_complete_scripts: string | null
  }
}

export function MarketingSettingsForm({ businessId, businessSlug, business }: MarketingSettingsFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const initialFormData = useMemo(() => ({
    facebook_pixel_id: business.facebook_pixel_id || '',
    google_analytics_id: business.google_analytics_id || '',
    google_tag_manager_id: business.google_tag_manager_id || '',
    google_ads_id: business.google_ads_id || '',
    tiktok_pixel_id: business.tiktok_pixel_id || '',
    custom_header_scripts: business.custom_header_scripts || '',
    purchase_complete_scripts: business.purchase_complete_scripts || '',
  }), [business])

  const [formData, setFormData] = useState(initialFormData)

  const hasChanges = useMemo(() => {
    return Object.keys(formData).some(
      key => formData[key as keyof typeof formData] !== initialFormData[key as keyof typeof initialFormData]
    )
  }, [formData, initialFormData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}/marketing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update marketing settings')
      }

      toast.success('Marketing settings updated successfully!')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Embed code section
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'

  const publicPageUrl = `${baseUrl}/${businessSlug}`

  const embedCode = `<iframe src="${publicPageUrl}" width="100%" height="800" style="border: none; border-radius: 8px;" title="Events" loading="lazy"></iframe>`

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success('Embed code copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy embed code')
    }
  }

  return (
    <div className="space-y-6">
      {/* Embed Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Embed Code
          </CardTitle>
          <CardDescription>
            Add your events page to your own website using this embed code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <div className="border-input dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 pr-9 text-sm shadow-xs overflow-x-auto">
              <code className="font-mono text-xs whitespace-pre-wrap break-all">
                <HighlightedCode code={embedCode} />
              </code>
            </div>
            <button
              type="button"
              className="absolute top-1/2 -translate-y-1/2 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleCopyEmbed}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Tracking & Analytics Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Google Section */}
        <Card>
          <CardHeader>
            <CardTitle>Google</CardTitle>
            <CardDescription>
              Connect your Google analytics and advertising accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="google_analytics_id">Google Analytics 4 (GA4)</Label>
                <Input
                  id="google_analytics_id"
                  value={formData.google_analytics_id}
                  onChange={(e) => setFormData({ ...formData, google_analytics_id: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Measurement ID from GA4 property
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_tag_manager_id">Google Tag Manager</Label>
                <Input
                  id="google_tag_manager_id"
                  value={formData.google_tag_manager_id}
                  onChange={(e) => setFormData({ ...formData, google_tag_manager_id: e.target.value })}
                  placeholder="GTM-XXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Container ID from Tag Manager
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_ads_id">Google Ads</Label>
                <Input
                  id="google_ads_id"
                  value={formData.google_ads_id}
                  onChange={(e) => setFormData({ ...formData, google_ads_id: e.target.value })}
                  placeholder="AW-XXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Conversion ID from Google Ads
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta Section */}
        <Card>
          <CardHeader>
            <CardTitle>Meta (Facebook & Instagram)</CardTitle>
            <CardDescription>
              Track conversions from Facebook and Instagram ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="facebook_pixel_id">Meta Pixel ID</Label>
              <Input
                id="facebook_pixel_id"
                value={formData.facebook_pixel_id}
                onChange={(e) => setFormData({ ...formData, facebook_pixel_id: e.target.value })}
                placeholder="XXXXXXXXXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Find your Pixel ID in Meta Events Manager
              </p>
            </div>
          </CardContent>
        </Card>

        {/* TikTok Section */}
        <Card>
          <CardHeader>
            <CardTitle>TikTok</CardTitle>
            <CardDescription>
              Track conversions from TikTok ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="tiktok_pixel_id">TikTok Pixel ID</Label>
              <Input
                id="tiktok_pixel_id"
                value={formData.tiktok_pixel_id}
                onChange={(e) => setFormData({ ...formData, tiktok_pixel_id: e.target.value })}
                placeholder="XXXXXXXXXXXXXXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Find your Pixel ID in TikTok Ads Manager under Events
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Custom Scripts */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Header Scripts</CardTitle>
            <CardDescription>
              Add custom tracking scripts or code to your public page&apos;s header. Use this for any tracking service not listed above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="custom_header_scripts">Custom Scripts</Label>
              <Textarea
                id="custom_header_scripts"
                value={formData.custom_header_scripts}
                onChange={(e) => setFormData({ ...formData, custom_header_scripts: e.target.value })}
                placeholder={`<!-- Paste your tracking scripts here -->
<script>
  // Your custom tracking code
</script>`}
                rows={6}
                className="font-mono text-sm max-h-48 overflow-y-auto resize-none"               />
              <p className="text-xs text-muted-foreground">
                Scripts will be injected into the &lt;head&gt; section of your public page. Include full &lt;script&gt; tags.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Complete Scripts */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Complete Scripts</CardTitle>
            <CardDescription>
              Add conversion tracking scripts that run after a successful purchase. Perfect for tracking conversions in Google Ads, Meta, TikTok, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="purchase_complete_scripts">Conversion Scripts</Label>
              <Textarea
                id="purchase_complete_scripts"
                value={formData.purchase_complete_scripts}
                onChange={(e) => setFormData({ ...formData, purchase_complete_scripts: e.target.value })}
                placeholder={`<!-- Example: Meta Purchase Event -->
<script>
  fbq('track', 'Purchase', {value: 0.00, currency: 'USD'});
</script>

<!-- Example: Google Ads Conversion -->
<script>
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXX/XXXXXXXXX'
  });
</script>`}
                rows={6}
                className="font-mono text-sm max-h-48 overflow-y-auto resize-none"               />
              <p className="text-xs text-muted-foreground">
                These scripts run on the purchase confirmation page after a successful checkout. Include full &lt;script&gt; tags.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || !hasChanges}>
            {isLoading ? 'Saving...' : 'Save Marketing Settings'}
          </Button>
        </div>
      </form>

      {/* Help Links */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Guides</CardTitle>
          <CardDescription>
            Learn how to find your tracking IDs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a
              href="https://support.google.com/analytics/answer/9539598"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Google Analytics 4 Setup
            </a>
            <a
              href="https://support.google.com/tagmanager/answer/6102821"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Google Tag Manager Setup
            </a>
            <a
              href="https://www.facebook.com/business/help/952192354843755"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Meta Pixel Setup
            </a>
            <a
              href="https://ads.tiktok.com/help/article/get-started-pixel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              TikTok Pixel Setup
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
