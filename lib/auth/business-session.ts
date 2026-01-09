import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { BusinessUser } from '@/lib/types'

const SESSION_COOKIE_NAME = 'business_session'
const ADMIN_BYPASS_COOKIE_NAME = 'admin_bypass'
const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

export interface BusinessSession {
  userId: string
  businessId: string
  email: string
  role: 'admin' | 'regular'
  name: string
  adminBypass?: boolean // Set to true when accessed from admin dashboard
  [key: string]: unknown
}

/**
 * Create a JWT session token
 */
async function createSessionToken(session: BusinessSession): Promise<string> {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET_KEY)

  return token
}

/**
 * Verify and decode a JWT session token
 */
async function verifySessionToken(token: string): Promise<BusinessSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as BusinessSession
  } catch (error) {
    return null
  }
}

/**
 * Create a new business session
 */
export async function createBusinessSession(user: BusinessUser, adminBypass = false) {
  const session: BusinessSession = {
    userId: user.id,
    businessId: user.business_id,
    email: user.email,
    role: user.role,
    name: user.name,
    adminBypass,
  }

  const token = await createSessionToken(session)
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return session
}

/**
 * Create an admin bypass session (when accessing from admin dashboard)
 */
export async function createAdminBypassSession(businessId: string) {
  const cookieStore = await cookies()

  cookieStore.set(ADMIN_BYPASS_COOKIE_NAME, businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  })
}

/**
 * Get the current business session
 */
export async function getBusinessSession(): Promise<BusinessSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return await verifySessionToken(token)
}

/**
 * Check if admin bypass is active for a business
 */
export async function hasAdminBypass(businessId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const bypassBusinessId = cookieStore.get(ADMIN_BYPASS_COOKIE_NAME)?.value

  return bypassBusinessId === businessId
}

/**
 * Delete the current business session
 */
export async function deleteBusinessSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.delete(ADMIN_BYPASS_COOKIE_NAME)
}

/**
 * Verify if the current user has access to a business
 */
export async function verifyBusinessAccess(businessId: string): Promise<BusinessSession | null> {
  // Check if admin bypass is active
  if (await hasAdminBypass(businessId)) {
    return {
      userId: 'admin-bypass',
      businessId,
      email: 'admin@platform.com',
      role: 'admin',
      name: 'Platform Admin',
      adminBypass: true,
    }
  }

  // Check regular session
  const session = await getBusinessSession()

  if (!session || session.businessId !== businessId) {
    return null
  }

  return session
}
