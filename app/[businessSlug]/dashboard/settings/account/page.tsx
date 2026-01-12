import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AccountSettingsForm } from '@/components/business/account-settings-form'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface AccountSettingsPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function AccountSettingsPage({ params }: AccountSettingsPageProps) {
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
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            Update your business details, contact information, and social media links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm businessId={business.id} businessSlug={businessSlug} business={business} />
        </CardContent>
      </Card>
    </div>
  )
}
