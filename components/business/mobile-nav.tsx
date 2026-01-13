'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { SettingsNav } from '@/components/business/settings-nav'
import { LogoutButton } from '@/components/business/logout-button'
import { AccountSwitcher } from '@/components/account-switcher'
import { MyAccountButton } from '@/components/business/my-account-button'
import { NotificationCenter } from '@/components/business/notification-center'
import { Menu, Calendar, Receipt, BarChart3, UserCircle, Ticket, Armchair, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getThemeColorStyle } from '@/lib/utils/color'
import { canAccessSection, type BusinessRole } from '@/lib/auth/roles'

interface MobileNavProps {
  businessSlug: string
  businessName: string
  businessId: string
  showAdminBypass: boolean
  hideLogout: boolean
  showNavLocks?: boolean
  themeColor?: string
  userRole?: BusinessRole
}

export function MobileNav({ businessSlug, businessName, businessId, showAdminBypass, hideLogout, showNavLocks = false, themeColor = '#8b5cf6', userRole }: MobileNavProps) {
  const themeStyle = getThemeColorStyle(themeColor)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const allNavItems = [
    { href: `/${businessSlug}/dashboard/events`, icon: Calendar, label: 'Events', section: 'events' },
    { href: `/${businessSlug}/dashboard/tables`, icon: Armchair, label: 'Table Service', section: 'tables' },
    { href: `/${businessSlug}/dashboard/all-tickets`, icon: Ticket, label: 'Tickets', section: 'tickets' },
    { href: `/${businessSlug}/dashboard/tickets`, icon: Receipt, label: 'Ticket Sales', section: 'ticketSales' },
    { href: `/${businessSlug}/dashboard/reports`, icon: BarChart3, label: 'Reports', section: 'reports' },
    { href: `/${businessSlug}/dashboard/customers`, icon: UserCircle, label: 'Customers', section: 'customers' },
  ]

  // Filter nav items based on user role permissions
  const navItems = userRole
    ? allNavItems.filter(item => canAccessSection(userRole, item.section))
    : allNavItems

  return (
    <div
      className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 relative overflow-hidden"
      style={{
        ...themeStyle as React.CSSProperties,
        background: `linear-gradient(to bottom right, rgb(var(--theme-color) / 0.05), rgb(var(--theme-color) / 0.02), transparent)`
      }}
    >
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-bl-full"
        style={{ background: `linear-gradient(to bottom left, rgb(var(--theme-color) / 0.1), transparent)` }}
      />
      <Link href={`/${businessSlug}/dashboard/events`} className="text-lg font-bold hover:text-primary truncate max-w-[200px] relative">
        {businessName}
      </Link>

      <div className="flex items-center gap-1 relative">
        <NotificationCenter businessId={businessId} businessSlug={businessSlug} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
        <SheetContent side="right" className="w-64 p-0 flex flex-col [&>button]:hidden" style={themeStyle as React.CSSProperties}>
          <SheetTitle className="sr-only">{businessName}</SheetTitle>
          {/* Header area matching mobile header height */}
          <div
            className="relative flex-shrink-0 overflow-hidden border-b flex items-center justify-end px-4 min-h-[61px]"
            style={{ background: `linear-gradient(to bottom right, rgb(var(--theme-color) / 0.05), rgb(var(--theme-color) / 0.02), transparent)` }}
          >
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-bl-full"
              style={{ background: `linear-gradient(to bottom left, rgb(var(--theme-color) / 0.1), transparent)` }}
            />
            {showAdminBypass && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-6 text-xs mr-auto relative"
                style={{
                  borderColor: 'rgb(var(--theme-color) / 0.3)',
                  color: 'var(--theme-color-hex)'
                }}
                onClick={() => setOpen(false)}
              >
                <Link href="/admin">Admin Dashboard</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <span className="sr-only">Close</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </Button>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors group',
                    isActive
                      ? 'bg-[rgb(var(--theme-color))]/15'
                      : 'hover:bg-[rgb(var(--theme-color))]/10'
                  )}
                >
                  <div className={cn(
                    'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                    isActive
                      ? 'bg-[rgb(var(--theme-color))]/25'
                      : 'bg-[rgb(var(--theme-color))]/10 group-hover:bg-[rgb(var(--theme-color))]/20'
                  )}>
                    <item.icon className="h-3.5 w-3.5" style={{ color: 'var(--theme-color-hex)' }} />
                  </div>
                  <span className="font-medium text-xs flex-1">{item.label}</span>
                  {showNavLocks && (
                    <Lock className="h-2.5 w-2.5" style={{ color: 'var(--theme-color-hex)' }} />
                  )}
                </Link>
              )
            })}
            <SettingsNav businessSlug={businessSlug} showLocks={showNavLocks} userRole={userRole} />
          </nav>
          <Separator />
          <div className="p-4 space-y-2">
            <Button variant="outline" size="sm" className="w-full" asChild onClick={() => setOpen(false)}>
              <Link href={`/${businessSlug}`} target="_blank">
                View Public Page
              </Link>
            </Button>
            {!hideLogout && <MyAccountButton />}
            <AccountSwitcher />
            {!hideLogout && <LogoutButton />}
          </div>
        </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
