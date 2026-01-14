import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { AdminUser, User } from '@/lib/types'

const SESSION_COOKIE_NAME = 'admin_session'

// Validate SESSION_SECRET is properly configured
if (!process.env.SESSION_SECRET) {
  throw new Error(
    'CRITICAL: SESSION_SECRET environment variable is not set. ' +
    'This is required for secure session management. ' +
    'Generate a secure secret with: openssl rand -base64 32'
  )
}

const SECRET_KEY = new TextEncoder().encode(process.env.SESSION_SECRET)

export interface AdminSession {
  userId: string
  email: string
  name: string
  [key: string]: unknown
}

/**
 * Create a JWT session token
 */
async function createSessionToken(session: AdminSession): Promise<string> {
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
async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as AdminSession
  } catch (error) {
    return null
  }
}

/**
 * Create a new admin session
 * Accepts either a legacy AdminUser or a global User with is_platform_admin
 */
export async function createAdminSession(user: AdminUser | User) {
  const session: AdminSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
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
 * Get the current admin session
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return await verifySessionToken(token)
}

/**
 * Delete the current admin session
 */
export async function deleteAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Verify if the user is authenticated as an admin
 */
export async function verifyAdminAccess(): Promise<AdminSession | null> {
  return await getAdminSession()
}
