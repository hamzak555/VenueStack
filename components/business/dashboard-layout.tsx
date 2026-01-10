import { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { verifyBusinessAccess } from '@/lib/auth/business-session'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LogoutButton } from '@/components/business/logout-button'
import { AccountSwitcher } from '@/components/account-switcher'
import { SettingsNav } from '@/components/business/settings-nav'
import { SubscriptionGate } from '@/components/business/subscription-gate'
import { Calendar, Receipt, BarChart3, UserCircle, Ticket, Armchair } from 'lucide-react'
import { NotificationCenter } from '@/components/business/notification-center'
import { MobileNav } from '@/components/business/mobile-nav'

interface DashboardLayoutProps {
  businessSlug: string
  children: ReactNode
  bypassSubscriptionGate?: boolean
}

export async function DashboardLayout({ businessSlug, children, bypassSubscriptionGate = false }: DashboardLayoutProps) {
  const business = await getBusinessBySlug(businessSlug)

  // Check authentication
  const session = await verifyBusinessAccess(business.id)

  if (!session) {
    redirect(`/${businessSlug}/login`)
  }
  const isAdmin = session.role === 'admin'

  // Get current path for subscription gate
  const headersList = await headers()
  let currentPath = headersList.get('x-pathname') || ''

  // Fallback: try to get path from x-url or referer if x-pathname is not set
  if (!currentPath) {
    const fullUrl = headersList.get('x-url') || headersList.get('referer') || ''
    if (fullUrl) {
      try {
        currentPath = new URL(fullUrl).pathname
      } catch {
        // Ignore URL parsing errors
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Navigation */}
      <MobileNav
        businessSlug={businessSlug}
        businessName={business.name}
        businessId={business.id}
        isAdmin={isAdmin}
        showAdminBypass={session.adminBypass ?? false}
        hideLogout={session.adminBypass ?? false}
      />

      <div className="flex">
        {/* Desktop Sidebar - hidden on mobile */}
        <aside className="hidden lg:flex w-64 border-r bg-card flex-col h-screen sticky top-0">
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/${businessSlug}/dashboard/events`} className="text-xl font-bold hover:text-primary truncate flex-1 min-w-0">
              {business.name}
            </Link>
            <NotificationCenter businessId={business.id} businessSlug={businessSlug} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Business Dashboard</p>
          {session.adminBypass && (
            <Button variant="outline" size="sm" asChild className="mt-2 h-6 text-xs">
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          )}
        </div>
        <Separator className="flex-shrink-0" />
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href={`/${businessSlug}/dashboard/events`}>
              <Calendar className="h-4 w-4" />
              <span className="ml-2">Events</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href={`/${businessSlug}/dashboard/tables`}>
              <Armchair className="h-4 w-4" />
              <span className="ml-2">Table Service</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href={`/${businessSlug}/dashboard/all-tickets`}>
              <Ticket className="h-4 w-4" />
              <span className="ml-2">Tickets</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href={`/${businessSlug}/dashboard/tickets`}>
              <Receipt className="h-4 w-4" />
              <span className="ml-2">Ticket Sales</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href={`/${businessSlug}/dashboard/reports`}>
              <BarChart3 className="h-4 w-4" />
              <span className="ml-2">Reports</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href={`/${businessSlug}/dashboard/customers`}>
              <UserCircle className="h-4 w-4" />
              <span className="ml-2">Customers</span>
            </Link>
          </Button>
          <SettingsNav businessSlug={businessSlug} isAdmin={isAdmin} />
        </nav>
        <Separator className="flex-shrink-0" />
        <div className="p-4 space-y-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/${business.slug}`} target="_blank">
              View Public Page
            </Link>
          </Button>
          <AccountSwitcher />
          {!session.adminBypass && <LogoutButton />}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <SubscriptionGate
          business={business}
          businessSlug={businessSlug}
          isAdminBypass={session.adminBypass || bypassSubscriptionGate}
          currentPath={currentPath}
        >
          {children}
        </SubscriptionGate>
      </main>
      </div>
    </div>
  )
}
