'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Receipt, BarChart3, UserCircle, Ticket, Armchair, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardNavProps {
  businessSlug: string
  showLocks?: boolean
}

export function DashboardNav({ businessSlug, showLocks = false }: DashboardNavProps) {
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
            {showLocks && (
              <Lock className="h-2.5 w-2.5" style={{ color: 'var(--theme-color-hex)' }} />
            )}
          </Link>
        )
      })}
    </>
  )
}
