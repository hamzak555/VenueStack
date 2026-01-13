import { createClient as createServerClient } from '@/lib/supabase/server'
import { AdminInvitation } from '@/lib/types'
import crypto from 'crypto'

export type { AdminInvitation }
export type AdminInvitationInsert = Omit<AdminInvitation, 'id' | 'created_at' | 'status' | 'token' | 'expires_at'>

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create a new admin invitation
 */
export async function createAdminInvitation(invitation: AdminInvitationInsert) {
  const supabase = await createServerClient()

  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

  const { data, error } = await supabase
    .from('admin_invitations')
    .insert({
      email: invitation.email?.toLowerCase() || null,
      phone: invitation.phone || null,
      status: 'pending',
      token,
      invited_by: invitation.invited_by,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as AdminInvitation
}

/**
 * Get an admin invitation by token
 */
export async function getAdminInvitationByToken(token: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as AdminInvitation | null
}

/**
 * Get all pending admin invitations
 */
export async function getPendingAdminInvitations() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_invitations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as AdminInvitation[]
}

/**
 * Get all admin invitations
 */
export async function getAllAdminInvitations() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as AdminInvitation[]
}

/**
 * Check if there's an existing pending invitation for an email or phone
 */
export async function getExistingAdminInvitation(email?: string, phone?: string) {
  if (!email && !phone) return null

  const supabase = await createServerClient()

  // Try email first
  if (email) {
    const { data, error } = await supabase
      .from('admin_invitations')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (data) return data as AdminInvitation
    if (error && error.code !== 'PGRST116') throw error
  }

  // Try phone
  if (phone) {
    const { data, error } = await supabase
      .from('admin_invitations')
      .select('*')
      .eq('phone', phone)
      .eq('status', 'pending')
      .single()

    if (data) return data as AdminInvitation
    if (error && error.code !== 'PGRST116') throw error
  }

  return null
}

/**
 * Accept an admin invitation
 */
export async function acceptAdminInvitation(token: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_invitations')
    .update({ status: 'accepted' })
    .eq('token', token)
    .select()
    .single()

  if (error) throw error
  return data as AdminInvitation
}

/**
 * Cancel an admin invitation
 */
export async function cancelAdminInvitation(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_invitations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as AdminInvitation
}

/**
 * Delete an admin invitation
 */
export async function deleteAdminInvitation(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('admin_invitations')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Expire old invitations (run periodically)
 */
export async function expireOldAdminInvitations() {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('admin_invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  if (error) throw error
}
