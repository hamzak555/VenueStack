'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, Shield, ChevronDown, Check, Loader2 } from 'lucide-react'

interface UserAffiliation {
  type: 'admin' | 'business'
  id: string
  name: string
  businessId?: string
  businessSlug?: string
  businessName?: string
  businessLogo?: string | null
  role?: 'admin' | 'regular'
  isCurrentSession?: boolean
}

interface AffiliationsResponse {
  email: string
  currentSession: 'admin' | 'business'
  currentBusinessId?: string
  affiliations: UserAffiliation[]
}

export function AccountSwitcher() {
  const router = useRouter()
  const [affiliations, setAffiliations] = useState<UserAffiliation[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [currentAffiliation, setCurrentAffiliation] = useState<UserAffiliation | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    async function fetchAffiliations() {
      try {
        const response = await fetch('/api/auth/affiliations')
        if (response.ok) {
          const data: AffiliationsResponse = await response.json()
          setAffiliations(data.affiliations)

          // Find the current session's affiliation
          const current = data.affiliations.find(a => a.isCurrentSession)
          setCurrentAffiliation(current || null)
        }
      } catch (error) {
        console.error('Failed to fetch affiliations:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAffiliations()
  }, [])

  const handleSwitch = async (affiliation: UserAffiliation) => {
    if (affiliation.isCurrentSession) return

    setSwitching(affiliation.type === 'admin' ? 'admin' : affiliation.businessId || '')

    try {
      const response = await fetch('/api/auth/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affiliationType: affiliation.type,
          businessId: affiliation.businessId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push(data.redirectUrl)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to switch account:', error)
    } finally {
      setSwitching(null)
    }
  }

  // Don't render if only one affiliation
  if (!loading && affiliations.length <= 1) {
    return null
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" className="w-full justify-start" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading...</span>
      </Button>
    )
  }

  const adminAffiliation = affiliations.find(a => a.type === 'admin')
  const businessAffiliations = affiliations.filter(a => a.type === 'business')

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-center gap-1">
          <span className="truncate">Switch Account</span>
          <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64">
        <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {adminAffiliation && (
          <DropdownMenuItem
            onClick={() => handleSwitch(adminAffiliation)}
            disabled={switching !== null}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Admin Dashboard</p>
                <p className="text-xs text-muted-foreground">Platform administration</p>
              </div>
              {adminAffiliation.isCurrentSession && (
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
              )}
              {switching === 'admin' && (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        )}

        {adminAffiliation && businessAffiliations.length > 0 && (
          <DropdownMenuSeparator />
        )}

        {businessAffiliations.map((affiliation) => (
          <DropdownMenuItem
            key={affiliation.businessId}
            onClick={() => handleSwitch(affiliation)}
            disabled={switching !== null}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                {affiliation.businessLogo ? (
                  <Image
                    src={affiliation.businessLogo}
                    alt=""
                    width={24}
                    height={24}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{affiliation.businessName}</p>
                <p className="text-xs text-muted-foreground capitalize">{affiliation.role} access</p>
              </div>
              {affiliation.isCurrentSession && (
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
              )}
              {switching === affiliation.businessId && (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
