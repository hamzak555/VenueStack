import { createClient as createServerClient } from '@/lib/supabase/server'
import { Invitation } from '@/lib/types'
import { randomBytes } from 'crypto'

export type { Invitation }

/**
 * Generate a secure random token for invitations
 */
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create a new invitation
 */
export async function createInvitation({
  business_id,
  email,
  phone,
  role,
  invited_by,
}: {
  business_id: string
  email?: string | null
  phone?: string | null
  role: 'admin' | 'regular'
  invited_by: string
}) {
  if (!email && !phone) {
    throw new Error('Either email or phone is required')
  }

  const supabase = await createServerClient()

  const token = generateToken()
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      business_id,
      email: email?.toLowerCase() || null,
      phone: phone || null,
      role,
      status: 'pending',
      token,
      invited_by,
      expires_at: expires_at.toISOString(),
    })
    .select(`
      *,
      business:businesses(id, name, slug, logo_url)
    `)
    .single()

  if (error) throw error
  return data as Invitation
}

/**
 * Get an invitation by token
 */
export async function getInvitationByToken(token: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('invitations')
    .select(`
      *,
      business:businesses(id, name, slug, logo_url)
    `)
    .eq('token', token)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as Invitation | null
}

/**
 * Get all pending invitations for a business
 */
export async function getInvitationsByBusiness(business_id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('business_id', business_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Invitation[]
}

/**
 * Check if an invitation already exists for email/phone in a business
 */
export async function getExistingInvitation(
  business_id: string,
  email?: string | null,
  phone?: string | null
) {
  const supabase = await createServerClient()

  let query = supabase
    .from('invitations')
    .select('*')
    .eq('business_id', business_id)
    .eq('status', 'pending')

  if (email) {
    const { data, error } = await query.eq('email', email.toLowerCase()).single()
    if (data) return data as Invitation
    if (error && error.code !== 'PGRST116') throw error
  }

  if (phone) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('business_id', business_id)
      .eq('status', 'pending')
      .eq('phone', phone)
      .single()
    if (data) return data as Invitation
    if (error && error.code !== 'PGRST116') throw error
  }

  return null
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(token: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('token', token)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) throw error
  return data as Invitation
}

/**
 * Cancel an invitation
 */
export async function cancelInvitation(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) throw error
}

/**
 * Delete an invitation
 */
export async function deleteInvitation(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Resend an invitation (regenerate token and extend expiry)
 */
export async function resendInvitation(id: string) {
  const supabase = await createServerClient()

  const token = generateToken()
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const { data, error } = await supabase
    .from('invitations')
    .update({
      token,
      expires_at: expires_at.toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select(`
      *,
      business:businesses(id, name, slug, logo_url)
    `)
    .single()

  if (error) throw error
  return data as Invitation
}

/**
 * Mark expired invitations as expired
 */
export async function expireOldInvitations() {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  if (error) throw error
}
