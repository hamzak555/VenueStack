import { createClient as createServerClient } from '@/lib/supabase/server'
import { User } from '@/lib/types'
import bcrypt from 'bcryptjs'

export type { User }
export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at' | 'password_hash' | 'is_platform_admin'> & { password: string; is_platform_admin?: boolean }
export type UserUpdate = Partial<Omit<User, 'id' | 'created_at' | 'updated_at' | 'password_hash'> & { password?: string }>

/**
 * Get a user by ID
 */
export async function getUserById(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as User | null
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as User | null
}

/**
 * Get a user by phone
 */
export async function getUserByPhone(phone: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as User | null
}

/**
 * Get a user by email or phone
 */
export async function getUserByEmailOrPhone(email?: string, phone?: string) {
  if (!email && !phone) return null

  const supabase = await createServerClient()

  // Try email first
  if (email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (data) return data as User
    if (error && error.code !== 'PGRST116') throw error
  }

  // Try phone
  if (phone) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (data) return data as User
    if (error && error.code !== 'PGRST116') throw error
  }

  return null
}

/**
 * Create a new user
 */
export async function createUser(user: UserInsert) {
  const supabase = await createServerClient()

  // Hash the password
  const password_hash = await bcrypt.hash(user.password, 10)

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: user.email.toLowerCase(),
      phone: user.phone || null,
      password_hash,
      name: user.name,
      is_platform_admin: user.is_platform_admin || false,
    })
    .select()
    .single()

  if (error) throw error
  return data as User
}

/**
 * Update a user
 */
export async function updateUser(id: string, updates: UserUpdate) {
  const supabase = await createServerClient()

  const updateData: any = {}

  if (updates.email !== undefined) updateData.email = updates.email.toLowerCase()
  if (updates.phone !== undefined) updateData.phone = updates.phone || null
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.is_platform_admin !== undefined) updateData.is_platform_admin = updates.is_platform_admin
  if (updates.password) {
    updateData.password_hash = await bcrypt.hash(updates.password, 10)
  }

  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Sync name, email, phone changes to all business_users linked to this user
  const businessUserUpdates: any = {}
  if (updates.name !== undefined) businessUserUpdates.name = updates.name
  if (updates.email !== undefined) businessUserUpdates.email = updates.email.toLowerCase()
  if (updates.phone !== undefined) businessUserUpdates.phone = updates.phone || null
  if (updates.password) businessUserUpdates.password_hash = updateData.password_hash

  if (Object.keys(businessUserUpdates).length > 0) {
    await supabase
      .from('business_users')
      .update(businessUserUpdates)
      .eq('user_id', id)
  }

  // Sync password to legacy admin_users table if user exists there (for backwards compatibility)
  if (updates.password && data.email) {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', data.email)
      .single()

    if (adminUser) {
      await supabase
        .from('admin_users')
        .update({ password_hash: updateData.password_hash })
        .eq('id', adminUser.id)
    }
  }

  return data as User
}

/**
 * Verify a user's password
 */
export async function verifyUserPassword(email: string, password: string) {
  const user = await getUserByEmail(email)

  if (!user) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.password_hash)

  if (!isValid) {
    return null
  }

  return user
}

/**
 * Verify a user's password by phone
 */
export async function verifyUserPasswordByPhone(phone: string, password: string) {
  const user = await getUserByPhone(phone)

  if (!user) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.password_hash)

  if (!isValid) {
    return null
  }

  return user
}

// ============================================
// Platform Admin Functions
// ============================================

/**
 * Get all platform admin users
 */
export async function getPlatformAdmins() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_platform_admin', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as User[]
}

/**
 * Set a user's platform admin status
 */
export async function setPlatformAdmin(userId: string, isAdmin: boolean) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .update({
      is_platform_admin: isAdmin,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data as User
}

/**
 * Verify platform admin credentials
 */
export async function verifyPlatformAdminPassword(email: string, password: string) {
  const supabase = await createServerClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_platform_admin', true)
    .single()

  if (error || !user) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.password_hash)

  if (!isValid) {
    return null
  }

  return user as User
}

/**
 * Get platform admin by phone
 */
export async function getPlatformAdminByPhone(phone: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('is_platform_admin', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as User | null
}

/**
 * Get platform admin by email
 */
export async function getPlatformAdminByEmail(email: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_platform_admin', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as User | null
}
