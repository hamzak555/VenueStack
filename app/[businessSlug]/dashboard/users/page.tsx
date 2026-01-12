import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { redirect } from 'next/navigation'
import { UsersManagement } from '@/components/business/users-management'

interface UsersPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function UsersPage({ params }: UsersPageProps) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)

  // Verify user has admin access
  const session = await verifyBusinessAccess(business.id)

  if (!session || session.role !== 'admin') {
    redirect(`/${businessSlug}/dashboard`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      </div>

      <UsersManagement businessId={business.id} businessSlug={businessSlug} />
    </div>
  )
}
