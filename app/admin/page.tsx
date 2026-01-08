import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout'
import { createClient } from '@/lib/supabase/server'

async function getAdminStats() {
  const supabase = await createClient()

  // Get business counts
  const { count: totalBusinesses } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })

  const { count: activeBusinesses } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Get total events count
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  // Get total tickets sold (sum of quantity from completed orders)
  const { data: ticketData } = await supabase
    .from('orders')
    .select('quantity')
    .eq('status', 'completed')

  const totalTickets = ticketData?.reduce((sum, order) => sum + (order.quantity || 0), 0) || 0

  // Get total revenue
  const { data: revenueData } = await supabase
    .from('orders')
    .select('total')
    .eq('status', 'completed')

  const totalRevenue = revenueData?.reduce((sum, order) => sum + (parseFloat(order.total?.toString() || '0')), 0) || 0

  return {
    totalBusinesses: totalBusinesses || 0,
    activeBusinesses: activeBusinesses || 0,
    totalEvents: totalEvents || 0,
    totalTickets,
    totalRevenue,
  }
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats()

  return (
    <AdminDashboardLayout>
      <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage business accounts and monitor platform activity
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/businesses/new">Create Business Account</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBusinesses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBusinesses} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBusinesses}</div>
            <p className="text-xs text-muted-foreground">Currently operational</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Across all businesses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{stats.totalTickets.toLocaleString()} tickets sold</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/admin/businesses/new">
                Create New Business Account
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/admin/businesses">View All Businesses</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform updates</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </AdminDashboardLayout>
  )
}
