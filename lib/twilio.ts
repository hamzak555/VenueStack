import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const phoneNumber = process.env.TWILIO_PHONE_NUMBER

if (!accountSid || !authToken || !phoneNumber) {
  console.warn('Twilio credentials not configured')
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null

export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!client || !phoneNumber) {
    console.error('Twilio client not initialized')
    return false
  }

  try {
    await client.messages.create({
      body,
      from: phoneNumber,
      to,
    })
    return true
  } catch (error) {
    console.error('Failed to send SMS:', error)
    return false
  }
}

/**
 * Normalize a phone number to E.164 format
 * Assumes US numbers if no country code provided
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // If it starts with 1 and has 11 digits, it's likely a US number with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // If it has 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If it already has a +, return as-is (already normalized)
  if (phone.startsWith('+')) {
    return `+${digits}`
  }

  // Otherwise return with + prefix
  return `+${digits}`
}

/**
 * Generate a random 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
