import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/db/businesses'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Floor Plan</h1>
        <p className="text-muted-foreground">
          Configure your venue layout and table sections for table service
        </p>
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
