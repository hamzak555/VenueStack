import { getBusinessBySlug } from '@/lib/db/businesses'
import { getCustomersByBusinessId, Customer } from '@/lib/db/customers'
import { requireSectionAccess } from '@/lib/auth/role-guard'
import { Card, CardContent } from '@/components/ui/card'
import { CustomersTable } from '@/components/business/customers-table'

// Force dynamic rendering to always show current data
export const dynamic = 'force-dynamic'

interface CustomersPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function CustomersPage({ params }: CustomersPageProps) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)

  // Protect page - only owner and manager can access customers
  await requireSectionAccess(business.id, businessSlug, 'customers')

  let customers: Customer[] = []
  let errorMessage = ''

  try {
    customers = await getCustomersByBusinessId(business.id)
  } catch (error) {
    console.error('Error fetching customers:', error)
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-sm text-destructive">Error loading customers: {errorMessage}</p>
        </div>
      )}
      <Card>
        <CardContent className="pt-2">
          <CustomersTable customers={customers} businessSlug={businessSlug} title="Customer Database" />
        </CardContent>
      </Card>
    </div>
  )
}
