'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, Settings, BarChart3, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/admin/businesses', icon: Building2, label: 'Businesses' },
    { href: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/login-logs', icon: ScrollText, label: 'Login Logs' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors group',
              isActive
                ? 'bg-violet-500/15'
                : 'hover:bg-violet-500/10'
            )}
          >
            <div className={cn(
              'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
              isActive
                ? 'bg-violet-500/25'
                : 'bg-violet-500/10 group-hover:bg-violet-500/20'
            )}>
              <item.icon className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <span className={cn(
              'font-medium text-xs',
              isActive && 'text-violet-400'
            )}>{item.label}</span>
          </Link>
        )
      })}
    </>
  )
}
