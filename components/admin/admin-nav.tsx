'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Users, Settings, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Overview', exact: true },
    { href: '/admin/businesses', icon: Building2, label: 'Businesses' },
    { href: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <>
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
              isActive
                ? 'bg-violet-500/15'
                : 'hover:bg-violet-500/10'
            )}
          >
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
              isActive
                ? 'bg-violet-500/25'
                : 'bg-violet-500/10 group-hover:bg-violet-500/20'
            )}>
              <item.icon className="h-4 w-4 text-violet-400" />
            </div>
            <span className={cn(
              'font-medium text-sm',
              isActive && 'text-violet-400'
            )}>{item.label}</span>
          </Link>
        )
      })}
    </>
  )
}
