import { notFound } from 'next/navigation'
import { getBusinessById } from '@/lib/db/businesses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AdminBusinessEditForm } from '@/components/admin/admin-business-edit-form'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

interface AdminBusinessEditPageProps {
  params: Promise<{
    businessId: string
  }>
}

export default async function AdminBusinessEditPage({ params }: AdminBusinessEditPageProps) {
  const { businessId } = await params

  let business
  try {
    business = await getBusinessById(businessId)
  } catch (error) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/businesses">← Back to Businesses</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Business</h1>
        <p className="text-muted-foreground">
          Update business information and settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
          <CardDescription>
            Update the business name and URL slug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminBusinessEditForm businessId={businessId} business={business} />
        </CardContent>
      </Card>
    </div>
  )
}
