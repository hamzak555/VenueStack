import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireSectionAccess } from '@/lib/auth/role-guard'
import { UsersManagement } from '@/components/business/users-management'

interface UsersPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function UsersPage({ params }: UsersPageProps) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)

  // Protect page - only owner and manager can access users
  const session = await requireSectionAccess(business.id, businessSlug, 'users')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      </div>

      <UsersManagement businessId={business.id} businessSlug={businessSlug} userRole={session.role} />
    </div>
  )
}
