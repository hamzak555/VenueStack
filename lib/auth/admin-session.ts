import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { AdminUser } from '@/lib/types'

const SESSION_COOKIE_NAME = 'admin_session'
const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production'
)

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
 */
export async function createAdminSession(user: AdminUser) {
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
