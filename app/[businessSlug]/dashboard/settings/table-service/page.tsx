import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireSectionAccess } from '@/lib/auth/role-guard'
import { Card, CardContent } from '@/components/ui/card'
import { TableServiceForm } from '@/components/business/table-service-form'
import { Business } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface TableServicePageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function TableServicePage({ params }: TableServicePageProps) {
  const { businessSlug } = await params

  let business: Business
  try {
    business = await getBusinessBySlug(businessSlug) as Business
  } catch {
    notFound()
  }

  // Protect page - only owner and manager can access floor plan
  await requireSectionAccess(business.id, businessSlug, 'floorPlan')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Floor Plan</h1>
      </div>

      <Card>
        <CardContent>
          <TableServiceForm
            businessId={business.id}
            businessSlug={businessSlug}
            venueLayoutUrl={business.venue_layout_url}
            tableServiceConfig={business.table_service_config}
          />
        </CardContent>
      </Card>
    </div>
  )
}
