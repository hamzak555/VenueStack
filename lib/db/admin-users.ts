import { createClient as createServerClient } from '@/lib/supabase/server'
import { Database } from '@/lib/types'
import bcrypt from 'bcryptjs'

export type AdminUser = Database['public']['Tables']['admin_users']['Row']
export type AdminUserInsert = Database['public']['Tables']['admin_users']['Insert']
export type AdminUserUpdate = Database['public']['Tables']['admin_users']['Update']

/**
 * Get all admin users
 */
export async function getAdminUsers() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Get an admin user by ID
 */
export async function getAdminUserById(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Get an admin user by email
 */
export async function getAdminUserByEmail(email: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
  return data
}

/**
 * Create a new admin user
 */
export async function createAdminUser(user: Omit<AdminUserInsert, 'password_hash'> & { password: string }) {
  const supabase = await createServerClient()

  // Hash the password
  const password_hash = await bcrypt.hash(user.password, 10)

  const { password, ...userData } = user

  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      ...userData,
      password_hash,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update an admin user
 */
export async function updateAdminUser(
  id: string,
  updates: Partial<Omit<AdminUserInsert, 'password_hash'> & { password?: string }>
) {
  const supabase = await createServerClient()

  let updateData: any = { ...updates }

  // If password is being updated, hash it
  if (updates.password) {
    updateData.password_hash = await bcrypt.hash(updates.password, 10)
    delete updateData.password
  }

  const { data, error } = await supabase
    .from('admin_users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete an admin user
 */
export async function deleteAdminUser(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('admin_users')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Verify an admin user's password
 */
export async function verifyAdminUserPassword(email: string, password: string) {
  const user = await getAdminUserByEmail(email)

  if (!user || !user.is_active) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.password_hash)

  if (!isValid) {
    return null
  }

  return user
}

/**
 * Get an admin user by phone number
 */
export async function getAdminUserByPhone(phone: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('phone', phone)
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
  return data
}
