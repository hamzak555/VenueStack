import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
import { NotificationCenter } from '@/components/business/notification-center'
import { MobileNav } from '@/components/business/mobile-nav'
import { DashboardNav } from '@/components/business/dashboard-nav'
import { getThemeColorStyle } from '@/lib/utils/color'

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

  // Get theme color CSS variables
  const themeStyle = getThemeColorStyle(business.theme_color || '#8b5cf6')

  return (
    <div className="min-h-screen bg-background" style={themeStyle as React.CSSProperties}>
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
        {/* Header with gradient */}
        <div className="relative p-6 flex-shrink-0 overflow-hidden" style={{ background: `linear-gradient(to bottom right, rgb(var(--theme-color), 0.05), rgb(var(--theme-color), 0.02), transparent)` }}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: `linear-gradient(to bottom left, rgb(var(--theme-color), 0.1), transparent)` }} />
          <div className="relative flex items-center justify-between gap-2">
            <Link href={`/${businessSlug}/dashboard/events`} className="text-xl font-bold truncate flex-1 min-w-0">
              {business.name}
            </Link>
            <NotificationCenter businessId={business.id} businessSlug={businessSlug} />
          </div>
          {session.adminBypass && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="mt-2 h-6 text-xs"
              style={{
                borderColor: 'rgb(var(--theme-color), 0.3)',
                color: 'var(--theme-color-hex)'
              }}
            >
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          )}
        </div>
        <Separator className="flex-shrink-0" />
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <DashboardNav businessSlug={businessSlug} />
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
          <div className="flex items-center justify-center gap-1 pt-2 text-[10px] text-muted-foreground/60">
            <span>Powered by</span>
            <Image
              src="/venuestack-logo.svg"
              alt="VenueStack"
              width={60}
              height={12}
              className="h-2.5 w-auto brightness-0 invert opacity-50"
            />
          </div>
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
