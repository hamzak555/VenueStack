'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Settings, CreditCard, Megaphone, LayoutGrid, Users, ChevronDown, Receipt, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccessSection, hasSettingsAccess, type BusinessRole } from '@/lib/auth/roles'

interface SettingsNavProps {
  businessSlug: string
  showLocks?: boolean
  userRole?: BusinessRole
}

export function SettingsNav({ businessSlug, showLocks = false, userRole }: SettingsNavProps) {
  const pathname = usePathname()

  // Hide settings completely for roles without settings access
  if (!userRole || !hasSettingsAccess(userRole)) {
    return null
  }

  const isSettingsPath = pathname.includes('/dashboard/settings') || pathname.includes('/dashboard/users')
  const [isOpen, setIsOpen] = useState(isSettingsPath)

  // Define all settings items with their required sections
  const allSettingsItems = [
    {
      href: `/${businessSlug}/dashboard/settings/account`,
      icon: Settings,
      label: 'Account',
      section: 'accountSettings',
      showLock: true,
    },
    {
      href: `/${businessSlug}/dashboard/settings/subscription`,
      icon: Receipt,
      label: 'Subscription',
      section: 'subscription',
      showLock: false,
    },
    {
      href: `/${businessSlug}/dashboard/settings/stripe`,
      icon: CreditCard,
      label: 'Payments',
      section: 'payments',
      showLock: true,
    },
    {
      href: `/${businessSlug}/dashboard/settings/marketing`,
      icon: Megaphone,
      label: 'Marketing',
      section: 'marketing',
      showLock: true,
    },
    {
      href: `/${businessSlug}/dashboard/settings/table-service`,
      icon: LayoutGrid,
      label: 'Floor Plan',
      section: 'floorPlan',
      showLock: true,
    },
    {
      href: `/${businessSlug}/dashboard/users`,
      icon: Users,
      label: 'Users',
      section: 'users',
      showLock: false,
    },
  ]

  // Filter settings items based on role permissions
  const settingsItems = allSettingsItems.filter(item =>
    canAccessSection(userRole, item.section)
  )

  // Don't show settings section if no items are accessible
  if (settingsItems.length === 0) {
    return null
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
          <span className="flex items-center gap-2.5 flex-1">
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
              <span className="flex-1">{item.label}</span>
              {showLocks && item.showLock && (
                <Lock className="h-2.5 w-2.5" style={{ color: 'var(--theme-color-hex)' }} />
              )}
            </Link>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
