import { getBusinessBySlug } from '@/lib/db/businesses'
import { getCustomersByBusinessId, Customer } from '@/lib/db/customers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CustomersTable } from '@/components/business/customers-table'
import { formatCurrency } from '@/lib/utils/currency'

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
  let customers: Customer[] = []
  let errorMessage = ''

  try {
    customers = await getCustomersByBusinessId(business.id)
  } catch (error) {
    console.error('Error fetching customers:', error)
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  // Calculate stats
  const totalCustomers = customers.length
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0)
  const avgSpendPerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            View and manage your customer database
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Unique customer profiles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From all customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Spend per Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgSpendPerCustomer)}</div>
            <p className="text-xs text-muted-foreground">
              Average customer value
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Database</CardTitle>
          <CardDescription>
            All customers who have purchased tickets to your events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-4">
              <p className="text-sm text-destructive">Error loading customers: {errorMessage}</p>
            </div>
          )}
          <CustomersTable customers={customers} businessSlug={businessSlug} />
        </CardContent>
      </Card>
    </div>
  )
}
