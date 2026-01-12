import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BusinessForm } from '@/components/admin/business-form'
import { AdminDashboardLayout } from '@/components/admin/admin-dashboard-layout'

export default function NewBusinessPage() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/businesses">← Back to Businesses</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Business Account</h1>
      </div>

      <BusinessForm />
      </div>
    </AdminDashboardLayout>
  )
}
