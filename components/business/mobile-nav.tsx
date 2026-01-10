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
import { NotificationCenter } from '@/components/business/notification-center'
import { Menu, Calendar, Receipt, BarChart3, UserCircle, Ticket, Armchair } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  businessSlug: string
  businessName: string
  businessId: string
  isAdmin: boolean
  showAdminBypass: boolean
  hideLogout: boolean
}

export function MobileNav({ businessSlug, businessName, businessId, isAdmin, showAdminBypass, hideLogout }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: `/${businessSlug}/dashboard/events`, icon: Calendar, label: 'Events' },
    { href: `/${businessSlug}/dashboard/tables`, icon: Armchair, label: 'Table Service' },
    { href: `/${businessSlug}/dashboard/all-tickets`, icon: Ticket, label: 'Tickets' },
    { href: `/${businessSlug}/dashboard/tickets`, icon: Receipt, label: 'Ticket Sales' },
    { href: `/${businessSlug}/dashboard/reports`, icon: BarChart3, label: 'Reports' },
    { href: `/${businessSlug}/dashboard/customers`, icon: UserCircle, label: 'Customers' },
  ]

  return (
    <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3">
      <Link href={`/${businessSlug}/dashboard/events`} className="text-lg font-bold hover:text-primary truncate max-w-[200px]">
        {businessName}
      </Link>

      <div className="flex items-center gap-1">
        <NotificationCenter businessId={businessId} businessSlug={businessSlug} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
        <SheetContent side="right" className="w-64 p-0 flex flex-col">
          <div className="p-4">
            <SheetTitle className="text-lg font-bold truncate">{businessName}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-1">Business Dashboard</p>
            {showAdminBypass && (
              <Button variant="outline" size="sm" asChild className="mt-2 h-6 text-xs" onClick={() => setOpen(false)}>
                <Link href="/admin">Admin Dashboard</Link>
              </Button>
            )}
          </div>
          <Separator />
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  asChild
                  className={cn('w-full justify-start', isActive && 'bg-accent')}
                  onClick={() => setOpen(false)}
                >
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4" />
                    <span className="ml-2">{item.label}</span>
                  </Link>
                </Button>
              )
            })}
            <SettingsNav businessSlug={businessSlug} isAdmin={isAdmin} />
          </nav>
          <Separator />
          <div className="p-4 space-y-2">
            <Button variant="outline" size="sm" className="w-full" asChild onClick={() => setOpen(false)}>
              <Link href={`/${businessSlug}`} target="_blank">
                View Public Page
              </Link>
            </Button>
            <AccountSwitcher />
            {!hideLogout && <LogoutButton />}
          </div>
        </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
