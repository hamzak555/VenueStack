import Link from 'next/link'
import { getBusinesses } from '@/lib/db/businesses'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function BusinessesListPage() {
  let businesses: Awaited<ReturnType<typeof getBusinesses>> = []
  let error: string | null = null

  try {
    businesses = await getBusinesses()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load businesses'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Businesses</h1>
          <p className="text-muted-foreground">
            Manage business accounts and their settings
          </p>
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
        <CardHeader>
          <CardTitle>All Businesses</CardTitle>
          <CardDescription>
            {businesses.length} business{businesses.length !== 1 ? 'es' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug (URL)</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell className="font-medium">{business.name}</TableCell>
                    <TableCell>
                      <Link
                        href={`/${business.slug}`}
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        /{business.slug}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {business.contact_email || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={business.is_active ? 'success' : 'secondary'}>
                        {business.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(business.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/business/${business.id}`}>
                            Dashboard
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/businesses/${business.id}`}>
                            Edit
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
