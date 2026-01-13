import Link from 'next/link'
import { getBusinesses } from '@/lib/db/businesses'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout'
import { BusinessesTable } from '@/components/admin/businesses-table'
import { createClient } from '@/lib/supabase/server'

export default async function BusinessesListPage() {
  let businesses: Awaited<ReturnType<typeof getBusinesses>> = []
  let error: string | null = null
  let globalSettings: any = null
  let businessOwners: Record<string, { name: string; email: string; phone: string | null }[]> = {}

  try {
    businesses = await getBusinesses()

    // Fetch global platform settings
    const supabase = await createClient()
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('*')
      .single()
    globalSettings = settings

    // Fetch owners for each business
    const { data: owners } = await supabase
      .from('business_users')
      .select('business_id, name, email, phone')
      .eq('role', 'owner')
      .eq('is_active', true)

    if (owners) {
      owners.forEach((owner) => {
        if (!businessOwners[owner.business_id]) {
          businessOwners[owner.business_id] = []
        }
        businessOwners[owner.business_id].push({
          name: owner.name,
          email: owner.email,
          phone: owner.phone
        })
      })
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load businesses'
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Businesses</h1>
        </div>
        <Button asChild>
          <Link href="/admin/businesses/new">Create Business</Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Make sure you have run the database schema and configured your Supabase credentials.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {businesses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No businesses created yet
              </p>
              <Button asChild>
                <Link href="/admin/businesses/new">Create Your First Business</Link>
              </Button>
            </div>
          ) : (
            <BusinessesTable
              businesses={businesses}
              businessOwners={businessOwners}
              globalSettings={globalSettings}
            />
          )}
        </CardContent>
      </Card>
    </div>
    </AdminDashboardLayout>
  )
}
