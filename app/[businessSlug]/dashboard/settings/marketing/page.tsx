import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { MarketingSettingsForm } from '@/components/business/marketing-settings-form'
import { TrackingLinksForm } from '@/components/business/tracking-links-form'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface MarketingSettingsPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function MarketingSettingsPage({ params }: MarketingSettingsPageProps) {
  const { businessSlug } = await params

  let business
  try {
    business = await getBusinessBySlug(businessSlug)
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing & Analytics</h1>
      </div>

      <TrackingLinksForm
        businessId={business.id}
        businessSlug={businessSlug}
      />

      <MarketingSettingsForm
        businessId={business.id}
        businessSlug={businessSlug}
        business={{
          facebook_pixel_id: business.facebook_pixel_id,
          google_analytics_id: business.google_analytics_id,
          google_tag_manager_id: business.google_tag_manager_id,
          google_ads_id: business.google_ads_id,
          tiktok_pixel_id: business.tiktok_pixel_id,
          custom_header_scripts: business.custom_header_scripts,
          purchase_complete_scripts: business.purchase_complete_scripts,
        }}
      />
    </div>
  )
}
