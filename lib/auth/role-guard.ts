import { redirect } from 'next/navigation'
import { verifyBusinessAccess, BusinessSession } from './business-session'
import { canAccessSection, type BusinessRole } from './roles'

/**
 * Verify user has access to a specific section.
 * Redirects to events page if access is denied.
 */
export async function requireSectionAccess(
  businessId: string,
  businessSlug: string,
  section: string
): Promise<BusinessSession> {
  const session = await verifyBusinessAccess(businessId)

  if (!session) {
    redirect(`/${businessSlug}/login`)
  }

  if (!canAccessSection(session.role as BusinessRole, section)) {
    redirect(`/${businessSlug}/dashboard/events`)
  }

  return session
}

/**
 * Verify user has owner access to a business.
 * Non-owners are redirected to events page.
 */
export async function requireOwnerAccess(
  businessId: string,
  businessSlug: string
): Promise<BusinessSession> {
  const session = await verifyBusinessAccess(businessId)

  if (!session) {
    redirect(`/${businessSlug}/login`)
  }

  if (session.role !== 'owner') {
    redirect(`/${businessSlug}/dashboard/events`)
  }

  return session
}

/**
 * Verify user has non-server access to a business.
 * Servers are redirected to the tables page.
 * @deprecated Use requireSectionAccess instead
 */
export async function requireNonServerAccess(
  businessId: string,
  businessSlug: string
): Promise<BusinessSession> {
  const session = await verifyBusinessAccess(businessId)

  if (!session) {
    redirect(`/${businessSlug}/login`)
  }

  if (session.role === 'server') {
    redirect(`/${businessSlug}/dashboard/tables`)
  }

  return session
}
