import { ReactNode } from 'react'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { TrackingScripts, GTMNoscript } from '@/components/tracking-scripts'
import type { Metadata } from 'next'

interface CustomerLayoutProps {
  children: ReactNode
  params: Promise<{
    businessSlug: string
  }>
}

export async function generateMetadata({ params }: CustomerLayoutProps): Promise<Metadata> {
  const { businessSlug } = await params

  try {
    const business = await getBusinessBySlug(businessSlug)
    if (!business) {
      return {
        title: 'Business Not Found',
      }
    }
    return {
      title: {
        template: `%s | ${business.name}`,
        default: business.name,
      },
    }
  } catch {
    return {
      title: 'Business',
    }
  }
}

export default async function CustomerLayout({ children, params }: CustomerLayoutProps) {
  const { businessSlug } = await params

  let business = null
  try {
    business = await getBusinessBySlug(businessSlug)
  } catch {
    // Business not found, continue without tracking
  }

  return (
    <>
      {business && (
        <TrackingScripts
          facebookPixelId={business.facebook_pixel_id}
          googleAnalyticsId={business.google_analytics_id}
          googleTagManagerId={business.google_tag_manager_id}
          googleAdsId={business.google_ads_id}
          tiktokPixelId={business.tiktok_pixel_id}
          customHeaderScripts={business.custom_header_scripts}
        />
      )}
      <GTMNoscript googleTagManagerId={business?.google_tag_manager_id} />
      {children}
    </>
  )
}
