'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Settings, CreditCard, Megaphone, LayoutGrid, Users, ChevronDown, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsNavProps {
  businessSlug: string
  isAdmin: boolean
}

export function SettingsNav({ businessSlug, isAdmin }: SettingsNavProps) {
  const pathname = usePathname()
  const isSettingsPath = pathname.includes('/dashboard/settings') || pathname.includes('/dashboard/users')
  const [isOpen, setIsOpen] = useState(isSettingsPath)

  const settingsItems = [
    {
      href: `/${businessSlug}/dashboard/settings/account`,
      icon: Settings,
      label: 'Account',
    },
    {
      href: `/${businessSlug}/dashboard/settings/subscription`,
      icon: Receipt,
      label: 'Subscription',
    },
    {
      href: `/${businessSlug}/dashboard/settings/stripe`,
      icon: CreditCard,
      label: 'Payments',
    },
    {
      href: `/${businessSlug}/dashboard/settings/marketing`,
      icon: Megaphone,
      label: 'Marketing',
    },
    {
      href: `/${businessSlug}/dashboard/settings/table-service`,
      icon: LayoutGrid,
      label: 'Floor Plan',
    },
  ]

  if (isAdmin) {
    settingsItems.push({
      href: `/${businessSlug}/dashboard/users`,
      icon: Users,
      label: 'Users',
    })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-[rgb(var(--theme-color))]/10 transition-colors group',
            isSettingsPath && 'bg-[rgb(var(--theme-color))]/10'
          )}
        >
          <span className="flex items-center gap-3">
            <div className={cn(
              'h-8 w-8 rounded-lg bg-[rgb(var(--theme-color))]/10 flex items-center justify-center group-hover:bg-[rgb(var(--theme-color))]/20 transition-colors',
              isSettingsPath && 'bg-[rgb(var(--theme-color))]/20'
            )}>
              <Settings className="h-4 w-4" style={{ color: 'var(--theme-color-hex)' }} />
            </div>
            <span className="font-medium text-sm">Settings</span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-11 space-y-1 mt-1">
        {settingsItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[rgb(var(--theme-color))]/10 transition-colors',
                isActive && 'bg-[rgb(var(--theme-color))]/10'
              )}
              style={isActive ? { color: 'var(--theme-color-hex)' } : undefined}
            >
              <item.icon className="h-4 w-4" style={{ color: isActive ? 'var(--theme-color-hex)' : undefined }} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
