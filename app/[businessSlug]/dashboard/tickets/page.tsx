import { getOrdersByBusinessId, Order } from '@/lib/db/orders'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireSectionAccess } from '@/lib/auth/role-guard'
import { Card, CardContent } from '@/components/ui/card'
import { TicketsTable } from '@/components/business/tickets-table'

// Force dynamic rendering to always show current data
export const dynamic = 'force-dynamic'

interface TicketsPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function TicketsPage({ params }: TicketsPageProps) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)

  // Protect page - only owner, manager, accounting can access ticket sales
  await requireSectionAccess(business.id, businessSlug, 'ticketSales')

  let orders: Order[] = []
  let errorMessage = ''

  try {
    orders = await getOrdersByBusinessId(business.id)
    console.log('Fetched orders:', orders.length, 'for business:', business.id)
  } catch (error) {
    console.error('Error fetching orders:', error)
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ticket Sales</h1>
      </div>
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-sm text-destructive">Error loading orders: {errorMessage}</p>
        </div>
      )}
      <Card>
        <CardContent className="pt-4">
          <TicketsTable orders={orders} businessSlug={businessSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
