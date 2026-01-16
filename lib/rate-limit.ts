/**
 * Simple in-memory rate limiter for API endpoints
 *
 * For production with multiple instances, consider using Upstash Redis:
 * https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number // seconds until reset
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, email, phone)
 * @param action - The action being rate limited (e.g., 'login', 'password-reset')
 * @param config - Rate limit configuration
 */
export function rateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries()

  const key = `${action}:${identifier}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  const entry = rateLimitStore.get(key)

  // No existing entry or expired - create new one
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Increment counter
  entry.count++
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  }
}

/**
 * Create a rate limit response for API routes
 */
export function rateLimitResponse(resetIn: number) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: resetIn,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(resetIn),
      },
    }
  )
}

// Preset configurations for common use cases
export const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes per identifier
  login: { limit: 5, windowSeconds: 15 * 60 },

  // Password reset: 3 requests per hour per email
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },

  // SMS sending: 3 SMS per 5 minutes per phone
  smsSend: { limit: 3, windowSeconds: 5 * 60 },

  // Registration: 3 per hour per IP
  registration: { limit: 3, windowSeconds: 60 * 60 },

  // Invitation creation: 10 per hour per business
  invitationCreate: { limit: 10, windowSeconds: 60 * 60 },

  // Invitation resend: 3 per 5 minutes per invitation
  invitationResend: { limit: 3, windowSeconds: 5 * 60 },

  // Table bookings: 10 per hour per IP/phone
  tableBooking: { limit: 10, windowSeconds: 60 * 60 },
}

/**
 * Get client IP from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 */
export function getClientIP(request: Request): string {
  const headers = request.headers

  // Vercel
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Real IP header
  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback
  return 'unknown'
}
