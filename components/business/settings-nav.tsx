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
            'flex items-center justify-between w-full px-2.5 py-2 rounded-md hover:bg-[rgb(var(--theme-color))]/10 transition-colors group',
            isSettingsPath && 'bg-[rgb(var(--theme-color))]/10'
          )}
        >
          <span className="flex items-center gap-2.5">
            <div className={cn(
              'h-7 w-7 rounded-md bg-[rgb(var(--theme-color))]/10 flex items-center justify-center group-hover:bg-[rgb(var(--theme-color))]/20 transition-colors',
              isSettingsPath && 'bg-[rgb(var(--theme-color))]/20'
            )}>
              <Settings className="h-3.5 w-3.5" style={{ color: 'var(--theme-color-hex)' }} />
            </div>
            <span className="font-medium text-xs">Settings</span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-10 space-y-0.5 mt-1">
        {settingsItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-[rgb(var(--theme-color))]/10 transition-colors',
                isActive && 'bg-[rgb(var(--theme-color))]/10'
              )}
            >
              <item.icon className="h-3.5 w-3.5" style={{ color: 'var(--theme-color-hex)' }} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
