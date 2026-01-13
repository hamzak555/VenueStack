// Centralized role definitions and permission helpers

export type BusinessRole = 'owner' | 'manager' | 'host' | 'accounting' | 'server'

export const ROLE_LABELS: Record<BusinessRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  host: 'Host',
  accounting: 'Accounting',
  server: 'Server',
}

// All valid roles for validation
export const VALID_ROLES: BusinessRole[] = ['owner', 'manager', 'host', 'accounting', 'server']

// Section permissions - which roles can access each section
const SECTION_PERMISSIONS: Record<string, BusinessRole[]> = {
  events: ['owner', 'manager', 'host', 'accounting', 'server'],
  tables: ['owner', 'manager', 'host', 'accounting', 'server'],
  tickets: ['owner', 'manager', 'host', 'accounting'],
  ticketSales: ['owner', 'manager', 'accounting'],
  reports: ['owner', 'manager', 'accounting'],
  customers: ['owner', 'manager'],
  accountSettings: ['owner'],
  subscription: ['owner'],
  payments: ['owner'],
  marketing: ['owner', 'manager'],
  floorPlan: ['owner', 'manager'],
  users: ['owner', 'manager'],
}

/**
 * Check if a role can access a specific section
 */
export function canAccessSection(role: BusinessRole, section: string): boolean {
  return SECTION_PERMISSIONS[section]?.includes(role) ?? false
}

/**
 * Check if a role can see financial statistics (revenue, etc.)
 */
export function canSeeFinancialStats(role: BusinessRole): boolean {
  return ['owner', 'manager', 'accounting'].includes(role)
}

/**
 * Check if a role can edit events (create, update, delete)
 */
export function canEditEvents(role: BusinessRole): boolean {
  return ['owner', 'manager', 'host', 'accounting'].includes(role)
}

/**
 * Check if a role can manage tables (close, link, assign servers)
 */
export function canManageTables(role: BusinessRole): boolean {
  return ['owner', 'manager', 'host', 'accounting'].includes(role)
}

/**
 * Check if a role can invite another role
 * - Owner can invite any role
 * - Manager can invite any role except owner
 * - Other roles cannot invite anyone
 */
export function canInviteRole(inviterRole: BusinessRole, targetRole: BusinessRole): boolean {
  if (inviterRole === 'owner') return true
  if (inviterRole === 'manager') return targetRole !== 'owner'
  return false
}

/**
 * Check if a role can modify another user's role
 * - Owner can modify any role
 * - Manager can modify any role except owner
 * - Other roles cannot modify anyone
 */
export function canModifyUserRole(modifierRole: BusinessRole, targetRole: BusinessRole): boolean {
  if (modifierRole === 'owner') return true
  if (modifierRole === 'manager') return targetRole !== 'owner'
  return false
}

/**
 * Check if a role can delete a user
 * - Owner can delete any user except themselves
 * - Manager can delete any user except owner
 * - Other roles cannot delete anyone
 */
export function canDeleteUser(deleterRole: BusinessRole, targetRole: BusinessRole): boolean {
  if (deleterRole === 'owner') return true
  if (deleterRole === 'manager') return targetRole !== 'owner'
  return false
}

/**
 * Get roles that a user can invite based on their own role
 */
export function getInvitableRoles(role: BusinessRole): BusinessRole[] {
  if (role === 'owner') return VALID_ROLES
  if (role === 'manager') return VALID_ROLES.filter(r => r !== 'owner')
  return []
}

/**
 * Check if the role is a server (for special table filtering)
 */
export function isServerRole(role: BusinessRole): boolean {
  return role === 'server'
}

/**
 * Check if the role has settings access
 */
export function hasSettingsAccess(role: BusinessRole): boolean {
  return ['owner', 'manager'].includes(role)
}
