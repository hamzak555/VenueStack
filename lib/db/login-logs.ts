import { createClient } from '@/lib/supabase/server'
import { LoginLog } from '@/lib/types'

interface CreateLoginLogParams {
  user_type: 'admin' | 'business'
  user_id: string
  user_email: string
  user_name: string
  business_id?: string | null
  business_name?: string | null
  business_slug?: string | null
  ip_address?: string | null
  user_agent?: string | null
}

interface GeoLocation {
  city: string | null
  region: string | null
  country: string | null
}

// Fetch geolocation data from IP address using ip-api.com (free, no API key needed)
async function getGeoLocation(ipAddress: string | null): Promise<GeoLocation> {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return { city: null, region: null, country: null }
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,regionName,country`, {
      next: { revalidate: 86400 } // Cache for 24 hours
    })

    if (!response.ok) {
      return { city: null, region: null, country: null }
    }

    const data = await response.json()
    return {
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
    }
  } catch (error) {
    console.error('Failed to fetch geolocation:', error)
    return { city: null, region: null, country: null }
  }
}

// Delete logs older than 12 months
async function cleanupOldLogs(): Promise<void> {
  const supabase = await createClient()

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { error } = await supabase
    .from('login_logs')
    .delete()
    .lt('created_at', twelveMonthsAgo.toISOString())

  if (error) {
    console.error('Failed to cleanup old login logs:', error)
  }
}

export async function createLoginLog(params: CreateLoginLogParams): Promise<LoginLog | null> {
  const supabase = await createClient()

  // Cleanup old logs periodically (roughly 1% of requests)
  if (Math.random() < 0.01) {
    cleanupOldLogs().catch(err => console.error('Cleanup error:', err))
  }

  // Fetch geolocation data
  const geoLocation = await getGeoLocation(params.ip_address || null)

  const { data, error } = await supabase
    .from('login_logs')
    .insert({
      user_type: params.user_type,
      user_id: params.user_id,
      user_email: params.user_email,
      user_name: params.user_name,
      business_id: params.business_id || null,
      business_name: params.business_name || null,
      business_slug: params.business_slug || null,
      ip_address: params.ip_address || null,
      city: geoLocation.city,
      region: geoLocation.region,
      country: geoLocation.country,
      user_agent: params.user_agent || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create login log:', error)
    return null
  }

  return data
}

export async function getLoginLogs(options?: {
  limit?: number
  offset?: number
  businessId?: string
  userType?: 'admin' | 'business'
}): Promise<{ logs: LoginLog[]; total: number }> {
  const supabase = await createClient()
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  let query = supabase
    .from('login_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (options?.businessId) {
    query = query.eq('business_id', options.businessId)
  }

  if (options?.userType) {
    query = query.eq('user_type', options.userType)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Failed to fetch login logs:', error)
    return { logs: [], total: 0 }
  }

  return { logs: data || [], total: count || 0 }
}

export async function getLoginLogStats(): Promise<{
  totalLogins: number
  todayLogins: number
  uniqueUsers: number
  topBusinesses: { business_name: string; count: number }[]
}> {
  const supabase = await createClient()

  // Get total logins
  const { count: totalLogins } = await supabase
    .from('login_logs')
    .select('*', { count: 'exact', head: true })

  // Get today's logins
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: todayLogins } = await supabase
    .from('login_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  // Get unique users (approximate by counting distinct user_ids)
  const { data: uniqueUsersData } = await supabase
    .from('login_logs')
    .select('user_id')
  const uniqueUsers = new Set(uniqueUsersData?.map(u => u.user_id)).size

  // Get top businesses by login count
  const { data: businessLogins } = await supabase
    .from('login_logs')
    .select('business_name')
    .not('business_name', 'is', null)

  const businessCounts: Record<string, number> = {}
  businessLogins?.forEach(log => {
    if (log.business_name) {
      businessCounts[log.business_name] = (businessCounts[log.business_name] || 0) + 1
    }
  })

  const topBusinesses = Object.entries(businessCounts)
    .map(([business_name, count]) => ({ business_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    totalLogins: totalLogins || 0,
    todayLogins: todayLogins || 0,
    uniqueUsers,
    topBusinesses,
  }
}
