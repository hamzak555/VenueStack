import { ReactNode } from 'react'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { requireOwnerAccess } from '@/lib/auth/role-guard'

interface StripeSettingsLayoutProps {
  children: ReactNode
  params: Promise<{
    businessSlug: string
  }>
}

export default async function StripeSettingsLayout({
  children,
  params,
}: StripeSettingsLayoutProps) {
  const { businessSlug } = await params
  const business = await getBusinessBySlug(businessSlug)

  // Protect page - only owner can access payment settings
  await requireOwnerAccess(business.id, businessSlug)

  return <>{children}</>
}
