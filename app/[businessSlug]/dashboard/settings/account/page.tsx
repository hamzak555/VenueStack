import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireOwnerAccess } from '@/lib/auth/role-guard'
import { Card, CardContent } from '@/components/ui/card'
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

  // Protect page - only owner can access account settings
  await requireOwnerAccess(business.id, businessSlug)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AccountSettingsForm businessId={business.id} businessSlug={businessSlug} business={business} />
        </CardContent>
      </Card>
    </div>
  )
}
