'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Receipt, BarChart3, UserCircle, Ticket, Armchair } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardNavProps {
  businessSlug: string
}

export function DashboardNav({ businessSlug }: DashboardNavProps) {
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
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
              isActive
                ? 'bg-[rgb(var(--theme-color))]/15'
                : 'hover:bg-[rgb(var(--theme-color))]/10'
            )}
          >
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
              isActive
                ? 'bg-[rgb(var(--theme-color))]/25'
                : 'bg-[rgb(var(--theme-color))]/10 group-hover:bg-[rgb(var(--theme-color))]/20'
            )}>
              <item.icon className="h-4 w-4" style={{ color: 'var(--theme-color-hex)' }} />
            </div>
            <span className={cn(
              'font-medium text-sm',
              isActive && 'text-[var(--theme-color-hex)]'
            )}>{item.label}</span>
          </Link>
        )
      })}
    </>
  )
}
