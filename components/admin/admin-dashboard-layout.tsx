import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { AdminLogoutButton } from './admin-logout-button'
import { AccountSwitcher } from '@/components/account-switcher'
import { AdminNav } from './admin-nav'

interface AdminDashboardLayoutProps {
  children: ReactNode
}

export async function AdminDashboardLayout({ children }: AdminDashboardLayoutProps) {
  const session = await verifyAdminAccess()

  if (!session) {
    redirect('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col sticky top-0 h-screen">
        {/* Header with gradient */}
        <div className="relative p-6 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-transparent overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full" />
          <Link href="/admin" className="relative block">
            <Image
              src="/venuestack-logo.svg"
              alt="VenueStack"
              width={100}
              height={24}
              className="h-5 w-auto brightness-0 invert"
            />
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 p-4 space-y-1">
          <AdminNav />
        </nav>
        <Separator />
        <div className="p-4 space-y-2">
          <div className="text-xs text-muted-foreground">
            Logged in as: {session.name}
          </div>
          <AccountSwitcher />
          <AdminLogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
