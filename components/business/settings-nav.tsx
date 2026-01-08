'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Settings, CreditCard, Megaphone, LayoutGrid, Users, ChevronDown } from 'lucide-react'
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
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-between',
            isSettingsPath && 'bg-accent'
          )}
        >
          <span className="flex items-center">
            <Settings className="h-4 w-4" />
            <span className="ml-2">Settings</span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-1 mt-1">
        {settingsItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn(
                'w-full justify-start',
                isActive && 'bg-accent'
              )}
              size="sm"
            >
              <Link href={item.href}>
                <item.icon className="h-4 w-4" />
                <span className="ml-2">{item.label}</span>
              </Link>
            </Button>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
