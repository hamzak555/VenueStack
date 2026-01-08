import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { AdminLogoutButton } from './admin-logout-button'
import { AccountSwitcher } from '@/components/account-switcher'
import { LayoutDashboard, Building2, Users, Settings, BarChart3 } from 'lucide-react'

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
        <div className="p-6">
          <Link href="/admin" className="text-xl font-bold">
            Admin Dashboard
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 p-4 space-y-1">
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/admin">
              <LayoutDashboard className="h-4 w-4" />
              <span className="ml-2">Overview</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/admin/businesses">
              <Building2 className="h-4 w-4" />
              <span className="ml-2">Businesses</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/admin/reports">
              <BarChart3 className="h-4 w-4" />
              <span className="ml-2">Reports</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/admin/users">
              <Users className="h-4 w-4" />
              <span className="ml-2">Users</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/admin/settings">
              <Settings className="h-4 w-4" />
              <span className="ml-2">Settings</span>
            </Link>
          </Button>
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
