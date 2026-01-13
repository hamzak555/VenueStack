import sgMail from '@sendgrid/mail'
import { ROLE_LABELS, type BusinessRole } from '@/lib/auth/roles'

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@venuestack.io'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'VenueStack'

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail({ to, subject, text, html }: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email not sent.')
    return false
  }

  try {
    await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text,
      html: html || text,
    })
    console.log(`Email sent to ${to}`)
    return true
  } catch (error) {
    console.error('SendGrid error:', error)
    return false
  }
}

/**
 * Send an invitation email to join a business
 */
export async function sendInvitationEmail({
  to,
  businessName,
  inviteUrl,
  role,
}: {
  to: string
  businessName: string
  inviteUrl: string
  role: BusinessRole
}): Promise<boolean> {
  const roleLabel = ROLE_LABELS[role] || role
  const article = ['a', 'e', 'i', 'o', 'u'].includes(roleLabel[0].toLowerCase()) ? 'an' : 'a'
  const roleText = `${article} ${roleLabel}`

  const subject = `You've been invited to join ${businessName} on VenueStack`

  const text = `
You've been invited to join ${businessName} as ${roleText} on VenueStack.

Click the link below to accept your invitation:
${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

- The VenueStack Team
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      You've been invited to join <strong>${businessName}</strong> as ${roleText} on VenueStack.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
        Accept Invitation
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      This invitation will expire in 7 days.
    </p>

    <p style="font-size: 14px; color: #6b7280;">
      If you didn't expect this invitation, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      - The VenueStack Team
    </p>
  </div>
</body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Send a notification email when a user is added to a business
 */
/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName,
}: {
  to: string
  resetUrl: string
  userName: string
}): Promise<boolean> {
  const subject = 'Reset your VenueStack password'

  const text = `
Hi ${userName},

You requested to reset your password for your VenueStack account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.

- The VenueStack Team
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi <strong>${userName}</strong>,
    </p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      You requested to reset your password for your VenueStack account. Click the button below to set a new password.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
        Reset Password
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      This link will expire in 1 hour.
    </p>

    <p style="font-size: 14px; color: #6b7280;">
      If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      - The VenueStack Team
    </p>
  </div>
</body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Send a notification email when a user is added to a business
 */
export async function sendAddedToBusinessEmail({
  to,
  businessName,
  role,
}: {
  to: string
  businessName: string
  role: BusinessRole
}): Promise<boolean> {
  const roleLabel = ROLE_LABELS[role] || role
  const article = ['a', 'e', 'i', 'o', 'u'].includes(roleLabel[0].toLowerCase()) ? 'an' : 'a'
  const roleText = `${article} ${roleLabel}`
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'

  const subject = `You've been added to ${businessName} on VenueStack`

  const text = `
You've been added to ${businessName} as ${roleText} on VenueStack.

Log in to access your dashboard:
${loginUrl}/login

- The VenueStack Team
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${businessName}!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      You've been added to <strong>${businessName}</strong> as ${roleText} on VenueStack.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
        Go to Dashboard
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      - The VenueStack Team
    </p>
  </div>
</body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}
