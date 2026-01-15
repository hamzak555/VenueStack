import sgMail from '@sendgrid/mail'
import { ROLE_LABELS, type BusinessRole } from '@/lib/auth/roles'
import { hexToRgb, isLightColor } from '@/lib/utils/color'

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
  } catch (error: any) {
    console.error('SendGrid error:', error?.message || error, error?.response?.body || '')
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
/**
 * Ticket line item for email
 */
interface TicketLineItem {
  name: string
  quantity: number
  price: number
}

/**
 * Send a ticket confirmation email after purchase
 */
export async function sendTicketConfirmationEmail({
  to,
  customerName,
  orderNumber,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventImageUrl,
  tickets,
  subtotal,
  discountAmount,
  promoCode,
  taxAmount,
  processingFees,
  total,
  paymentMethod,
}: {
  to: string
  customerName: string
  orderNumber: string
  eventTitle: string
  eventDate: string
  eventTime?: string | null
  eventLocation?: string | null
  eventImageUrl?: string | null
  tickets: TicketLineItem[]
  subtotal: number
  discountAmount?: number
  promoCode?: string | null
  taxAmount?: number
  processingFees?: number
  total: number
  paymentMethod?: string | null
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jovbrnjczxnppzqvjkji.supabase.co'
  const emailImagesUrl = `${supabaseUrl}/storage/v1/object/public/business-assets/email-images`

  // Format date nicely
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'TBA'

  // Format time from "23:30:00" to "11:30 PM"
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formattedDateTime = eventTime
    ? `${formattedDate} at ${formatTime(eventTime)}`
    : formattedDate

  const subject = `Your Tickets for ${eventTitle} - Order #${orderNumber}`

  // Build ticket line items HTML
  const ticketLinesHtml = tickets.map(ticket => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #3f3f46;">
                ${ticket.name} x ${ticket.quantity}
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b;">
                $${(ticket.price * ticket.quantity).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `).join('')

  // Build optional discount line
  const discountHtml = discountAmount && discountAmount > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #16a34a;">
                Discount${promoCode ? ` (${promoCode})` : ''}
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #16a34a;">
                -$${discountAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Build optional tax line
  const taxHtml = taxAmount && taxAmount > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                Tax
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                $${taxAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Build optional fee line
  const feeHtml = processingFees && processingFees > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                Processing Fees
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                $${processingFees.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Payment method line
  const paymentMethodHtml = paymentMethod ? `
    <tr>
      <td style="padding: 0;">
        <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; color: #71717a;">
          Paid with ${paymentMethod}
        </div>
      </td>
    </tr>
  ` : total === 0 ? `
    <tr>
      <td style="padding: 0;">
        <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; color: #71717a;">
          Free order - no payment required
        </div>
      </td>
    </tr>
  ` : ''

  // Event image HTML (only if image URL exists)
  const eventImageHtml = eventImageUrl ? `
    <tr>
      <td align="left" style="padding: 0 0 24px 0;">
        <img src="${eventImageUrl}" alt="${eventTitle}" width="260" style="display: block; border-radius: 8px; max-width: 100%; height: auto;">
      </td>
    </tr>
  ` : ''

  const text = `
Your Tickets Are Confirmed!

Thanks for your purchase. Download your tickets below.

Event: ${eventTitle}
Date: ${formattedDateTime}
${eventLocation ? `Venue: ${eventLocation}` : ''}
Order Number: #${orderNumber}

Total: $${total.toFixed(2)}

Download your tickets at: ${appUrl}/api/tickets/download/${orderNumber}

Present your tickets at the door by showing the QR code on your phone or printed PDF.

- The VenueStack Team
`.trim()

  const html = `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>Your Tickets Are Confirmed - VenueStack</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding: 0 }
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100% }
      table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0 }
      img { border: 0; height: auto; line-height: 100%; outline: 0; text-decoration: none; -ms-interpolation-mode: bicubic }
      p { display: block; margin: 13px 0 }
    </style>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">.mj-outlook-group-fix{width:100%!important}</style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (max-width:480px) {
        .body { padding-top: 24px !important; padding-bottom: 24px !important; padding-left: 16px !important; padding-right: 16px !important }
        .header-padding { padding-left: 20px !important; padding-right: 20px !important }
        .content-padding { padding: 24px 20px !important }
        .footer-padding { padding-left: 20px !important; padding-right: 20px !important }
        .button-stack { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
        .button-stack a { display: block !important; text-align: center !important; }
      }
    </style>
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
    <div class="body" style="padding-top: 40px; padding-bottom: 40px; background-color: #f4f4f5;">

      <!-- EMAIL WRAPPER WITH BORDER AND ROUNDED CORNERS -->
      <div class="email-wrapper" style="margin: 0px auto; max-width: 600px; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">

        <!-- EMAIL HEADER -->
        <div class="header" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="header-padding" style="border-bottom: 1px solid #e4e4e7; padding: 24px 40px;" align="left">
                  <!-- Logo -->
                  <img src="${emailImagesUrl}/VS%20Logo%20Black.png" alt="VenueStack" width="140" height="auto" style="display: block; border: 0; outline: none;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MAIN CONTENT SECTION -->
        <div class="section" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="content-padding" style="padding: 40px;" align="left">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                    <tbody>
                      <!-- Heading -->
                      <tr>
                        <td align="left" style="padding: 0 0 8px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; color: #18181b;">Your Tickets Are Confirmed!</div>
                        </td>
                      </tr>
                      <!-- Subheading -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; color: #3f3f46;">
                            Thanks for your purchase. Download your tickets below.
                          </div>
                        </td>
                      </tr>

                      <!-- EVENT IMAGE -->
                      ${eventImageHtml}

                      <!-- EVENT DETAILS CARD -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #f4f4f5; border-radius: 8px;">
                            <tbody>
                              <tr>
                                <td style="padding: 24px;">
                                  <!-- Event Name -->
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 24px; color: #18181b; padding-bottom: 16px;">
                                    ${eventTitle}
                                  </div>
                                  <!-- Event Details Grid -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${formattedDateTime}</div>
                                        </td>
                                      </tr>
                                      ${eventLocation ? `
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Venue</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${eventLocation}</div>
                                        </td>
                                      </tr>
                                      ` : ''}
                                      <tr>
                                        <td style="padding: 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">#${orderNumber}</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- PAYMENT BREAKDOWN -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #18181b; padding-bottom: 12px;">Payment Summary</div>
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-top: 1px solid #e4e4e7;">
                            <tbody>
                              ${ticketLinesHtml}
                              ${discountHtml}
                              ${taxHtml}
                              ${feeHtml}
                              <!-- Total -->
                              <tr>
                                <td style="padding: 12px 0;">
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #18181b;">
                                          Total Paid
                                        </td>
                                        <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 20px; color: #18181b;">
                                          $${total.toFixed(2)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                              ${paymentMethodHtml}
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- ACTION BUTTONS -->
                      <tr>
                        <td align="left" style="padding: 8px 0 0 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                              <tr style="vertical-align: middle;">
                                <!-- Download Tickets Button -->
                                <td class="button-stack" style="padding-right: 12px; vertical-align: middle;">
                                  <a href="${appUrl}/api/tickets/download/${orderNumber}" style="display: inline-block; background: #18181b; color: #ffffff; font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; text-decoration: none; padding: 12px 20px; border-radius: 6px;">Download Tickets</a>
                                </td>
                                <!-- Add to Calendar Button -->
                                <td class="button-stack" style="vertical-align: middle;">
                                  <a href="${appUrl}/api/tickets/calendar/${orderNumber}" style="display: inline-block; border: 1px solid #18181b; background: transparent; color: #18181b; font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; text-decoration: none; padding: 11px 19px; border-radius: 6px;">Add to Calendar</a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Additional Info -->
                      <tr>
                        <td align="left" style="padding: 24px 0 0 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                            Present your tickets at the door by showing the QR code on your phone or printed PDF. If you have any questions, contact the event organizer.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer" style="background: #18181b;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #18181b; width: 100%;" width="100%" bgcolor="#18181b">
            <tbody>
              <tr>
                <td class="footer-padding" style="padding: 32px 40px;" align="left">
                  <!-- Icon -->
                  <img src="${emailImagesUrl}/VS%20Icon%20White.png" alt="VenueStack" width="24" height="24" style="display: block; margin: 0 0 24px 0; border: 0; outline: none; opacity: 0.6;">
                  <!-- Reason for email -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    You're receiving this email because you purchased tickets through VenueStack.
                  </div>
                  <!-- Legal Text -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    &copy; ${new Date().getFullYear()} VenueStack. All rights reserved. <a href="${appUrl}/privacy" style="color: #a1a1aa; text-decoration: underline;">Privacy Policy</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
      <!-- END EMAIL WRAPPER -->

    </div>
  </body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Send a ticket refund email
 */
export async function sendTicketRefundEmail({
  to,
  customerName,
  orderNumber,
  eventTitle,
  eventDate,
  eventTime,
  refundAmount,
}: {
  to: string
  customerName: string
  orderNumber: string
  eventTitle: string
  eventDate: string
  eventTime?: string | null
  refundAmount: number
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jovbrnjczxnppzqvjkji.supabase.co'
  const emailImagesUrl = `${supabaseUrl}/storage/v1/object/public/business-assets/email-images`

  // Format date nicely
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'TBA'

  // Format time from "23:30:00" to "11:30 PM"
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formattedDateTime = eventTime
    ? `${formattedDate} at ${formatTime(eventTime)}`
    : formattedDate

  const subject = `Refund Processed for ${eventTitle} - Order #${orderNumber}`

  const text = `
Refund Processed

Hi ${customerName},

A refund of $${refundAmount.toFixed(2)} has been processed for your ticket order.

Event: ${eventTitle}
Date: ${formattedDateTime}
Order Number: #${orderNumber}
Refund Amount: $${refundAmount.toFixed(2)}

The refund will be credited to your original payment method within 5-10 business days.

If you have any questions, please contact the event organizer.

- The VenueStack Team
`.trim()

  const html = `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>Refund Processed - VenueStack</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding: 0 }
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100% }
      table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0 }
      img { border: 0; height: auto; line-height: 100%; outline: 0; text-decoration: none; -ms-interpolation-mode: bicubic }
      p { display: block; margin: 13px 0 }
    </style>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">.mj-outlook-group-fix{width:100%!important}</style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (max-width:480px) {
        .body { padding-top: 24px !important; padding-bottom: 24px !important; padding-left: 16px !important; padding-right: 16px !important }
        .header-padding { padding-left: 20px !important; padding-right: 20px !important }
        .content-padding { padding: 24px 20px !important }
        .footer-padding { padding-left: 20px !important; padding-right: 20px !important }
      }
    </style>
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
    <div class="body" style="padding-top: 40px; padding-bottom: 40px; background-color: #f4f4f5;">

      <!-- EMAIL WRAPPER WITH BORDER AND ROUNDED CORNERS -->
      <div class="email-wrapper" style="margin: 0px auto; max-width: 600px; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">

        <!-- EMAIL HEADER -->
        <div class="header" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="header-padding" style="border-bottom: 1px solid #e4e4e7; padding: 24px 40px;" align="left">
                  <!-- Logo -->
                  <img src="${emailImagesUrl}/VS%20Logo%20Black.png" alt="VenueStack" width="140" height="auto" style="display: block; border: 0; outline: none;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MAIN CONTENT SECTION -->
        <div class="section" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="content-padding" style="padding: 40px;" align="left">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                    <tbody>
                      <!-- Heading -->
                      <tr>
                        <td align="left" style="padding: 0 0 8px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; color: #18181b;">Refund Processed</div>
                        </td>
                      </tr>
                      <!-- Subheading -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; color: #3f3f46;">
                            Hi ${customerName}, a refund has been processed for your ticket order.
                          </div>
                        </td>
                      </tr>

                      <!-- REFUND DETAILS CARD -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #f4f4f5; border-radius: 8px;">
                            <tbody>
                              <tr>
                                <td style="padding: 24px;">
                                  <!-- Event Name -->
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 24px; color: #18181b; padding-bottom: 16px;">
                                    ${eventTitle}
                                  </div>
                                  <!-- Details Grid -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Event Date</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${formattedDateTime}</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">#${orderNumber}</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Refund Amount</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 28px; color: #16a34a; padding-top: 4px;">$${refundAmount.toFixed(2)}</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Additional Info -->
                      <tr>
                        <td align="left" style="padding: 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                            The refund will be credited to your original payment method within 5-10 business days. If you have any questions, please contact the event organizer.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer" style="background: #18181b;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #18181b; width: 100%;" width="100%" bgcolor="#18181b">
            <tbody>
              <tr>
                <td class="footer-padding" style="padding: 32px 40px;" align="left">
                  <!-- Icon -->
                  <img src="${emailImagesUrl}/VS%20Icon%20White.png" alt="VenueStack" width="24" height="24" style="display: block; margin: 0 0 24px 0; border: 0; outline: none; opacity: 0.6;">
                  <!-- Reason for email -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    You're receiving this email because a refund was processed for your ticket purchase through VenueStack.
                  </div>
                  <!-- Legal Text -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    &copy; ${new Date().getFullYear()} VenueStack. All rights reserved. <a href="${appUrl}/privacy" style="color: #a1a1aa; text-decoration: underline;">Privacy Policy</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
      <!-- END EMAIL WRAPPER -->

    </div>
  </body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Table line item for email
 */
interface TableLineItem {
  name: string
  quantity: number
  price: number
  depositType: 'paid' | 'free'
}

/**
 * Send a table reservation confirmed email (for paid tables only)
 */
export async function sendTableReservationConfirmedEmail({
  to,
  customerName,
  reservationNumber,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventImageUrl,
  tables,
  subtotal,
  discountAmount,
  promoCode,
  taxAmount,
  processingFees,
  total,
  paymentMethod,
}: {
  to: string
  customerName: string
  reservationNumber: string
  eventTitle: string
  eventDate: string
  eventTime?: string | null
  eventLocation?: string | null
  eventImageUrl?: string | null
  tables: TableLineItem[]
  subtotal: number
  discountAmount?: number
  promoCode?: string | null
  taxAmount?: number
  processingFees?: number
  total: number
  paymentMethod?: string | null
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jovbrnjczxnppzqvjkji.supabase.co'
  const emailImagesUrl = `${supabaseUrl}/storage/v1/object/public/business-assets/email-images`

  // Format date nicely
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'TBA'

  // Format time from "23:30:00" to "11:30 PM"
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formattedDateTime = eventTime
    ? `${formattedDate} at ${formatTime(eventTime)}`
    : formattedDate

  // Event image HTML (half size of ticket confirmation)
  const eventImageHtml = eventImageUrl ? `
    <tr>
      <td align="left" style="padding: 0 0 24px 0;">
        <img src="${eventImageUrl}" alt="${eventTitle}" width="260" style="display: block; border-radius: 8px; max-width: 100%; height: auto;">
      </td>
    </tr>
  ` : ''

  const subject = `Table Reservation Confirmed for ${eventTitle} - #${reservationNumber}`

  // Build table line items HTML
  const tableLinesHtml = tables.map(table => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #3f3f46;">
                ${table.name} x ${table.quantity}
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b;">
                $${(table.price * table.quantity).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `).join('')

  // Build optional discount line
  const discountHtml = discountAmount && discountAmount > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #16a34a;">
                Discount${promoCode ? ` (${promoCode})` : ''}
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #16a34a;">
                -$${discountAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Build optional tax line
  const taxHtml = taxAmount && taxAmount > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                Tax
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                $${taxAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Build optional fee line
  const feeHtml = processingFees && processingFees > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                Processing Fees
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                $${processingFees.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Payment method line
  const paymentMethodHtml = paymentMethod ? `
    <tr>
      <td style="padding: 0;">
        <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; color: #71717a;">
          Paid with ${paymentMethod}
        </div>
      </td>
    </tr>
  ` : ''

  const text = `
Table Reservation Confirmed!

Hi ${customerName}, your table reservation has been confirmed.

Event: ${eventTitle}
Date: ${formattedDateTime}
${eventLocation ? `Venue: ${eventLocation}` : ''}
Reservation Number: #${reservationNumber}

Total: $${total.toFixed(2)}

Please arrive on time to ensure your table is ready. If you have any questions, please contact the venue.

- The VenueStack Team
`.trim()

  const html = `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>Table Reservation Confirmed - VenueStack</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding: 0 }
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100% }
      table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0 }
      img { border: 0; height: auto; line-height: 100%; outline: 0; text-decoration: none; -ms-interpolation-mode: bicubic }
      p { display: block; margin: 13px 0 }
    </style>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">.mj-outlook-group-fix{width:100%!important}</style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (max-width:480px) {
        .body { padding-top: 24px !important; padding-bottom: 24px !important; padding-left: 16px !important; padding-right: 16px !important }
        .header-padding { padding-left: 20px !important; padding-right: 20px !important }
        .content-padding { padding: 24px 20px !important }
        .footer-padding { padding-left: 20px !important; padding-right: 20px !important }
      }
    </style>
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
    <div class="body" style="padding-top: 40px; padding-bottom: 40px; background-color: #f4f4f5;">

      <!-- EMAIL WRAPPER WITH BORDER AND ROUNDED CORNERS -->
      <div class="email-wrapper" style="margin: 0px auto; max-width: 600px; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">

        <!-- EMAIL HEADER -->
        <div class="header" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="header-padding" style="border-bottom: 1px solid #e4e4e7; padding: 24px 40px;" align="left">
                  <!-- Logo -->
                  <img src="${emailImagesUrl}/VS%20Logo%20Black.png" alt="VenueStack" width="140" height="auto" style="display: block; border: 0; outline: none;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MAIN CONTENT SECTION -->
        <div class="section" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="content-padding" style="padding: 40px;" align="left">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                    <tbody>
                      <!-- Heading -->
                      <tr>
                        <td align="left" style="padding: 0 0 8px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; color: #18181b;">Table Reservation Confirmed!</div>
                        </td>
                      </tr>
                      <!-- Subheading -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; color: #3f3f46;">
                            Hi ${customerName}, your table reservation has been confirmed.
                          </div>
                        </td>
                      </tr>

                      <!-- EVENT IMAGE -->
                      ${eventImageHtml}

                      <!-- RESERVATION DETAILS CARD -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #f4f4f5; border-radius: 8px;">
                            <tbody>
                              <tr>
                                <td style="padding: 24px;">
                                  <!-- Event Name -->
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 24px; color: #18181b; padding-bottom: 16px;">
                                    ${eventTitle}
                                  </div>
                                  <!-- Event Details Grid -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${formattedDateTime}</div>
                                        </td>
                                      </tr>
                                      ${eventLocation ? `
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Venue</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${eventLocation}</div>
                                        </td>
                                      </tr>
                                      ` : ''}
                                      <tr>
                                        <td style="padding: 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Reservation Number</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">#${reservationNumber}</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- PAYMENT BREAKDOWN -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #18181b; padding-bottom: 12px;">Payment Summary</div>
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-top: 1px solid #e4e4e7;">
                            <tbody>
                              ${tableLinesHtml}
                              ${discountHtml}
                              ${taxHtml}
                              ${feeHtml}
                              <!-- Total -->
                              <tr>
                                <td style="padding: 12px 0;">
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #18181b;">
                                          Total Paid
                                        </td>
                                        <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 20px; color: #18181b;">
                                          $${total.toFixed(2)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                              ${paymentMethodHtml}
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Additional Info -->
                      <tr>
                        <td align="left" style="padding: 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                            Please arrive on time to ensure your table is ready. If you have any questions, please contact the venue directly.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer" style="background: #18181b;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #18181b; width: 100%;" width="100%" bgcolor="#18181b">
            <tbody>
              <tr>
                <td class="footer-padding" style="padding: 32px 40px;" align="left">
                  <!-- Icon -->
                  <img src="${emailImagesUrl}/VS%20Icon%20White.png" alt="VenueStack" width="24" height="24" style="display: block; margin: 0 0 24px 0; border: 0; outline: none; opacity: 0.6;">
                  <!-- Reason for email -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    You're receiving this email because you made a table reservation through VenueStack.
                  </div>
                  <!-- Legal Text -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    &copy; ${new Date().getFullYear()} VenueStack. All rights reserved. <a href="${appUrl}/privacy" style="color: #a1a1aa; text-decoration: underline;">Privacy Policy</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
      <!-- END EMAIL WRAPPER -->

    </div>
  </body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Send a table reservation received email (for orders with free/no-deposit tables)
 */
export async function sendTableReservationReceivedEmail({
  to,
  customerName,
  reservationNumber,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventImageUrl,
  tables,
  subtotal,
  discountAmount,
  promoCode,
  taxAmount,
  processingFees,
  total,
  paymentMethod,
  hasFreeTablesOnly,
}: {
  to: string
  customerName: string
  reservationNumber: string
  eventTitle: string
  eventDate: string
  eventTime?: string | null
  eventLocation?: string | null
  eventImageUrl?: string | null
  tables: TableLineItem[]
  subtotal: number
  discountAmount?: number
  promoCode?: string | null
  taxAmount?: number
  processingFees?: number
  total: number
  paymentMethod?: string | null
  hasFreeTablesOnly: boolean
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jovbrnjczxnppzqvjkji.supabase.co'
  const emailImagesUrl = `${supabaseUrl}/storage/v1/object/public/business-assets/email-images`

  // Format date nicely
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'TBA'

  // Format time from "23:30:00" to "11:30 PM"
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formattedDateTime = eventTime
    ? `${formattedDate} at ${formatTime(eventTime)}`
    : formattedDate

  // Event image HTML (half size of ticket confirmation)
  const eventImageHtml = eventImageUrl ? `
    <tr>
      <td align="left" style="padding: 0 0 24px 0;">
        <img src="${eventImageUrl}" alt="${eventTitle}" width="260" style="display: block; border-radius: 8px; max-width: 100%; height: auto;">
      </td>
    </tr>
  ` : ''

  const subject = `Table Reservation Request Received for ${eventTitle} - #${reservationNumber}`

  // Build table line items HTML
  const tableLinesHtml = tables.map(table => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #3f3f46;">
                ${table.name} x ${table.quantity}${table.depositType === 'free' ? ' <span style="color: #f59e0b;">(Pending Approval)</span>' : ''}
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b;">
                ${table.depositType === 'free' ? 'No Deposit' : `$${(table.price * table.quantity).toFixed(2)}`}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `).join('')

  // Build optional discount line
  const discountHtml = discountAmount && discountAmount > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #16a34a;">
                Discount${promoCode ? ` (${promoCode})` : ''}
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #16a34a;">
                -$${discountAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Build optional tax line
  const taxHtml = taxAmount && taxAmount > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                Tax
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                $${taxAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Build optional fee line
  const feeHtml = processingFees && processingFees > 0 ? `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tbody>
            <tr>
              <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                Processing Fees
              </td>
              <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                $${processingFees.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  ` : ''

  // Payment method line
  const paymentMethodHtml = paymentMethod ? `
    <tr>
      <td style="padding: 0;">
        <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; color: #71717a;">
          Paid with ${paymentMethod}
        </div>
      </td>
    </tr>
  ` : total === 0 ? `
    <tr>
      <td style="padding: 0;">
        <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 16px; color: #71717a;">
          No deposit required
        </div>
      </td>
    </tr>
  ` : ''

  const text = `
Table Reservation Request Received

Hi ${customerName}, your table reservation request has been received.

Event: ${eventTitle}
Date: ${formattedDateTime}
${eventLocation ? `Venue: ${eventLocation}` : ''}
Reservation Number: #${reservationNumber}

${total > 0 ? `Total Paid: $${total.toFixed(2)}` : 'No deposit required'}

IMPORTANT: Tables without a deposit are not guaranteed and require confirmation from the venue. You will receive an email or phone call from the venue to confirm your reservation.

- The VenueStack Team
`.trim()

  const html = `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>Table Reservation Request Received - VenueStack</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding: 0 }
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100% }
      table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0 }
      img { border: 0; height: auto; line-height: 100%; outline: 0; text-decoration: none; -ms-interpolation-mode: bicubic }
      p { display: block; margin: 13px 0 }
    </style>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">.mj-outlook-group-fix{width:100%!important}</style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (max-width:480px) {
        .body { padding-top: 24px !important; padding-bottom: 24px !important; padding-left: 16px !important; padding-right: 16px !important }
        .header-padding { padding-left: 20px !important; padding-right: 20px !important }
        .content-padding { padding: 24px 20px !important }
        .footer-padding { padding-left: 20px !important; padding-right: 20px !important }
      }
    </style>
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
    <div class="body" style="padding-top: 40px; padding-bottom: 40px; background-color: #f4f4f5;">

      <!-- EMAIL WRAPPER WITH BORDER AND ROUNDED CORNERS -->
      <div class="email-wrapper" style="margin: 0px auto; max-width: 600px; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">

        <!-- EMAIL HEADER -->
        <div class="header" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="header-padding" style="border-bottom: 1px solid #e4e4e7; padding: 24px 40px;" align="left">
                  <!-- Logo -->
                  <img src="${emailImagesUrl}/VS%20Logo%20Black.png" alt="VenueStack" width="140" height="auto" style="display: block; border: 0; outline: none;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MAIN CONTENT SECTION -->
        <div class="section" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="content-padding" style="padding: 40px;" align="left">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                    <tbody>
                      <!-- Heading -->
                      <tr>
                        <td align="left" style="padding: 0 0 8px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; color: #18181b;">Reservation Request Received</div>
                        </td>
                      </tr>
                      <!-- Subheading -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; color: #3f3f46;">
                            Hi ${customerName}, your table reservation request has been received.
                          </div>
                        </td>
                      </tr>

                      <!-- IMPORTANT NOTICE -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <tbody>
                              <tr>
                                <td style="padding: 16px;">
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #92400e; padding-bottom: 4px;">
                                    Confirmation Required
                                  </div>
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #92400e;">
                                    ${hasFreeTablesOnly
                                      ? 'Tables without a deposit are not guaranteed. The venue will contact you via email or phone to confirm your reservation.'
                                      : 'Some tables in your reservation require venue confirmation. Tables with a deposit are confirmed, but tables without a deposit require approval from the venue.'}
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- EVENT IMAGE -->
                      ${eventImageHtml}

                      <!-- RESERVATION DETAILS CARD -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #f4f4f5; border-radius: 8px;">
                            <tbody>
                              <tr>
                                <td style="padding: 24px;">
                                  <!-- Event Name -->
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 24px; color: #18181b; padding-bottom: 16px;">
                                    ${eventTitle}
                                  </div>
                                  <!-- Event Details Grid -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${formattedDateTime}</div>
                                        </td>
                                      </tr>
                                      ${eventLocation ? `
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Venue</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${eventLocation}</div>
                                        </td>
                                      </tr>
                                      ` : ''}
                                      <tr>
                                        <td style="padding: 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Reservation Number</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">#${reservationNumber}</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- RESERVATION BREAKDOWN -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #18181b; padding-bottom: 12px;">Reservation Summary</div>
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-top: 1px solid #e4e4e7;">
                            <tbody>
                              ${tableLinesHtml}
                              ${discountHtml}
                              ${taxHtml}
                              ${feeHtml}
                              <!-- Total -->
                              <tr>
                                <td style="padding: 12px 0;">
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #18181b;">
                                          ${total > 0 ? 'Total Paid' : 'Total'}
                                        </td>
                                        <td align="right" style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 20px; color: #18181b;">
                                          ${total > 0 ? `$${total.toFixed(2)}` : '$0.00'}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                              ${paymentMethodHtml}
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Additional Info -->
                      <tr>
                        <td align="left" style="padding: 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                            If you have any questions about your reservation, please contact the venue directly.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer" style="background: #18181b;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #18181b; width: 100%;" width="100%" bgcolor="#18181b">
            <tbody>
              <tr>
                <td class="footer-padding" style="padding: 32px 40px;" align="left">
                  <!-- Icon -->
                  <img src="${emailImagesUrl}/VS%20Icon%20White.png" alt="VenueStack" width="24" height="24" style="display: block; margin: 0 0 24px 0; border: 0; outline: none; opacity: 0.6;">
                  <!-- Reason for email -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    You're receiving this email because you requested a table reservation through VenueStack.
                  </div>
                  <!-- Legal Text -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    &copy; ${new Date().getFullYear()} VenueStack. All rights reserved. <a href="${appUrl}/privacy" style="color: #a1a1aa; text-decoration: underline;">Privacy Policy</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
      <!-- END EMAIL WRAPPER -->

    </div>
  </body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Send a table reservation approved email (for free/no-deposit tables that have been seated)
 */
export async function sendTableReservationApprovedEmail({
  to,
  customerName,
  reservationNumber,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventImageUrl,
  tableName,
}: {
  to: string
  customerName: string
  reservationNumber: string
  eventTitle: string
  eventDate: string
  eventTime?: string | null
  eventLocation?: string | null
  eventImageUrl?: string | null
  tableName: string
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jovbrnjczxnppzqvjkji.supabase.co'
  const emailImagesUrl = `${supabaseUrl}/storage/v1/object/public/business-assets/email-images`

  // Format date nicely
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'TBA'

  // Format time from "23:30:00" to "11:30 PM"
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formattedDateTime = eventTime
    ? `${formattedDate} at ${formatTime(eventTime)}`
    : formattedDate

  // Event image HTML (half size of ticket confirmation)
  const eventImageHtml = eventImageUrl ? `
    <tr>
      <td align="left" style="padding: 0 0 24px 0;">
        <img src="${eventImageUrl}" alt="${eventTitle}" width="260" style="display: block; border-radius: 8px; max-width: 100%; height: auto;">
      </td>
    </tr>
  ` : ''

  const subject = `Table Reservation Confirmed for ${eventTitle} - #${reservationNumber}`

  const text = `
Table Reservation Confirmed!

Hi ${customerName}, great news! Your table reservation has been approved by the venue.

Event: ${eventTitle}
Date: ${formattedDateTime}
${eventLocation ? `Venue: ${eventLocation}` : ''}
Table: ${tableName}
Reservation Number: #${reservationNumber}

Please arrive on time to ensure your table is ready. If you have any questions, please contact the venue.

- The VenueStack Team
`.trim()

  const html = `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>Table Reservation Confirmed - VenueStack</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding: 0 }
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100% }
      table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0 }
      img { border: 0; height: auto; line-height: 100%; outline: 0; text-decoration: none; -ms-interpolation-mode: bicubic }
      p { display: block; margin: 13px 0 }
    </style>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">.mj-outlook-group-fix{width:100%!important}</style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (max-width:480px) {
        .body { padding-top: 24px !important; padding-bottom: 24px !important; padding-left: 16px !important; padding-right: 16px !important }
        .header-padding { padding-left: 20px !important; padding-right: 20px !important }
        .content-padding { padding: 24px 20px !important }
        .footer-padding { padding-left: 20px !important; padding-right: 20px !important }
      }
    </style>
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
    <div class="body" style="padding-top: 40px; padding-bottom: 40px; background-color: #f4f4f5;">

      <!-- EMAIL WRAPPER WITH BORDER AND ROUNDED CORNERS -->
      <div class="email-wrapper" style="margin: 0px auto; max-width: 600px; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">

        <!-- EMAIL HEADER -->
        <div class="header" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="header-padding" style="border-bottom: 1px solid #e4e4e7; padding: 24px 40px;" align="left">
                  <!-- Logo -->
                  <img src="${emailImagesUrl}/VS%20Logo%20Black.png" alt="VenueStack" width="140" height="auto" style="display: block; border: 0; outline: none;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MAIN CONTENT SECTION -->
        <div class="section" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="content-padding" style="padding: 40px;" align="left">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                    <tbody>
                      <!-- Heading -->
                      <tr>
                        <td align="left" style="padding: 0 0 8px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; color: #18181b;">Table Reservation Confirmed!</div>
                        </td>
                      </tr>
                      <!-- Subheading -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; color: #3f3f46;">
                            Hi ${customerName}, great news! Your table reservation has been approved by the venue.
                          </div>
                        </td>
                      </tr>

                      <!-- SUCCESS NOTICE -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #dcfce7; border-radius: 8px; border-left: 4px solid #16a34a;">
                            <tbody>
                              <tr>
                                <td style="padding: 16px;">
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; color: #166534; padding-bottom: 4px;">
                                    Reservation Approved
                                  </div>
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #166534;">
                                    Your table has been confirmed. Please arrive on time to ensure your table is ready.
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- EVENT IMAGE -->
                      ${eventImageHtml}

                      <!-- RESERVATION DETAILS CARD -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #f4f4f5; border-radius: 8px;">
                            <tbody>
                              <tr>
                                <td style="padding: 24px;">
                                  <!-- Event Name -->
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 24px; color: #18181b; padding-bottom: 16px;">
                                    ${eventTitle}
                                  </div>
                                  <!-- Event Details Grid -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${formattedDateTime}</div>
                                        </td>
                                      </tr>
                                      ${eventLocation ? `
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Venue</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${eventLocation}</div>
                                        </td>
                                      </tr>
                                      ` : ''}
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Table</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${tableName}</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Reservation Number</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">#${reservationNumber}</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Additional Info -->
                      <tr>
                        <td align="left" style="padding: 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                            If you have any questions about your reservation, please contact the venue directly.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer" style="background: #18181b;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #18181b; width: 100%;" width="100%" bgcolor="#18181b">
            <tbody>
              <tr>
                <td class="footer-padding" style="padding: 32px 40px;" align="left">
                  <!-- Icon -->
                  <img src="${emailImagesUrl}/VS%20Icon%20White.png" alt="VenueStack" width="24" height="24" style="display: block; margin: 0 0 24px 0; border: 0; outline: none; opacity: 0.6;">
                  <!-- Reason for email -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    You're receiving this email because your table reservation was approved through VenueStack.
                  </div>
                  <!-- Legal Text -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    &copy; ${new Date().getFullYear()} VenueStack. All rights reserved. <a href="${appUrl}/privacy" style="color: #a1a1aa; text-decoration: underline;">Privacy Policy</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
      <!-- END EMAIL WRAPPER -->

    </div>
  </body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

/**
 * Send a table reservation refund email
 */
export async function sendTableRefundEmail({
  to,
  customerName,
  reservationNumber,
  eventTitle,
  eventDate,
  eventTime,
  refundAmount,
}: {
  to: string
  customerName: string
  reservationNumber: string
  eventTitle: string
  eventDate: string
  eventTime?: string | null
  refundAmount: number
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jovbrnjczxnppzqvjkji.supabase.co'
  const emailImagesUrl = `${supabaseUrl}/storage/v1/object/public/business-assets/email-images`

  // Format date nicely
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'TBA'

  // Format time from "23:30:00" to "11:30 PM"
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formattedDateTime = eventTime
    ? `${formattedDate} at ${formatTime(eventTime)}`
    : formattedDate

  const subject = `Refund Processed for ${eventTitle} - Reservation #${reservationNumber}`

  const text = `
Refund Processed

Hi ${customerName},

A refund of $${refundAmount.toFixed(2)} has been processed for your table reservation.

Event: ${eventTitle}
Date: ${formattedDateTime}
Reservation Number: #${reservationNumber}
Refund Amount: $${refundAmount.toFixed(2)}

The refund will be credited to your original payment method within 5-10 business days.

If you have any questions, please contact the venue.

- The VenueStack Team
`.trim()

  const html = `
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title>Refund Processed - VenueStack</title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding: 0 }
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100% }
      table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0 }
      img { border: 0; height: auto; line-height: 100%; outline: 0; text-decoration: none; -ms-interpolation-mode: bicubic }
      p { display: block; margin: 13px 0 }
    </style>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">.mj-outlook-group-fix{width:100%!important}</style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (max-width:480px) {
        .body { padding-top: 24px !important; padding-bottom: 24px !important; padding-left: 16px !important; padding-right: 16px !important }
        .header-padding { padding-left: 20px !important; padding-right: 20px !important }
        .content-padding { padding: 24px 20px !important }
        .footer-padding { padding-left: 20px !important; padding-right: 20px !important }
      }
    </style>
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v8/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2) format('woff2');
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
    <div class="body" style="padding-top: 40px; padding-bottom: 40px; background-color: #f4f4f5;">

      <!-- EMAIL WRAPPER WITH BORDER AND ROUNDED CORNERS -->
      <div class="email-wrapper" style="margin: 0px auto; max-width: 600px; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">

        <!-- EMAIL HEADER -->
        <div class="header" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="header-padding" style="border-bottom: 1px solid #e4e4e7; padding: 24px 40px;" align="left">
                  <!-- Logo -->
                  <img src="${emailImagesUrl}/VS%20Logo%20Black.png" alt="VenueStack" width="140" height="auto" style="display: block; border: 0; outline: none;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MAIN CONTENT SECTION -->
        <div class="section" style="background: #ffffff;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; width: 100%;" width="100%" bgcolor="#ffffff">
            <tbody>
              <tr>
                <td class="content-padding" style="padding: 40px;" align="left">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                    <tbody>
                      <!-- Heading -->
                      <tr>
                        <td align="left" style="padding: 0 0 8px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; color: #18181b;">Refund Processed</div>
                        </td>
                      </tr>
                      <!-- Subheading -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 24px; color: #3f3f46;">
                            Hi ${customerName}, a refund has been processed for your table reservation.
                          </div>
                        </td>
                      </tr>

                      <!-- REFUND DETAILS CARD -->
                      <tr>
                        <td align="left" style="padding: 0 0 24px 0;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background: #f4f4f5; border-radius: 8px;">
                            <tbody>
                              <tr>
                                <td style="padding: 24px;">
                                  <!-- Event Name -->
                                  <div style="font-family: Inter, Arial, sans-serif; font-size: 18px; font-weight: 600; line-height: 24px; color: #18181b; padding-bottom: 16px;">
                                    ${eventTitle}
                                  </div>
                                  <!-- Details Grid -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Event Date</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">${formattedDateTime}</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 0 0 12px 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Reservation Number</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #18181b; padding-top: 4px;">#${reservationNumber}</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 0;">
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Refund Amount</div>
                                          <div style="font-family: Inter, Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 28px; color: #16a34a; padding-top: 4px;">$${refundAmount.toFixed(2)}</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Additional Info -->
                      <tr>
                        <td align="left" style="padding: 0;">
                          <div style="font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #71717a;">
                            The refund will be credited to your original payment method within 5-10 business days. If you have any questions, please contact the venue.
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer" style="background: #18181b;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background: #18181b; width: 100%;" width="100%" bgcolor="#18181b">
            <tbody>
              <tr>
                <td class="footer-padding" style="padding: 32px 40px;" align="left">
                  <!-- Icon -->
                  <img src="${emailImagesUrl}/VS%20Icon%20White.png" alt="VenueStack" width="24" height="24" style="display: block; margin: 0 0 24px 0; border: 0; outline: none; opacity: 0.6;">
                  <!-- Reason for email -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    You're receiving this email because a refund was processed for your table reservation through VenueStack.
                  </div>
                  <!-- Legal Text -->
                  <div style="font-family: Inter, Arial, sans-serif; font-size: 12px; font-weight: 400; line-height: 18px; color: #a1a1aa; padding-top: 16px;">
                    &copy; ${new Date().getFullYear()} VenueStack. All rights reserved. <a href="${appUrl}/privacy" style="color: #a1a1aa; text-decoration: underline;">Privacy Policy</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
      <!-- END EMAIL WRAPPER -->

    </div>
  </body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

export async function sendAddedToBusinessEmail({
  to,
  businessName,
  role,
  themeColor,
}: {
  to: string
  businessName: string
  role: BusinessRole
  themeColor?: string | null
}): Promise<boolean> {
  const roleLabel = ROLE_LABELS[role] || role
  const article = ['a', 'e', 'i', 'o', 'u'].includes(roleLabel[0].toLowerCase()) ? 'an' : 'a'
  const roleText = `${article} ${roleLabel}`
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://venuestack.io'
  const rawThemeColor = (themeColor || '').trim()
  const themeHex = rawThemeColor
    ? rawThemeColor.startsWith('#')
      ? rawThemeColor
      : `#${rawThemeColor}`
    : '#8b5cf6'
  const parsedThemeRgb = hexToRgb(themeHex)
  const resolvedThemeHex = parsedThemeRgb ? themeHex : '#8b5cf6'
  const themeRgb = parsedThemeRgb || { r: 139, g: 92, b: 246 }
  const buttonTextColor = isLightColor(resolvedThemeHex) ? '#0b0d10' : '#ffffff'
  const glowStrong = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, 0.35)`
  const glowSoft = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, 0.16)`
  const glowFaint = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, 0.08)`

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
<body style="margin: 0; background-color: #0b0d10; color: #e2e8f0; font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 32px 16px;">
  <div style="max-width: 640px; margin: 0 auto;">
    <div style="background-color: #141820; border: 1px solid #1f242d; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px ${glowFaint};">
      <div style="padding: 28px 32px; background-color: #141820; background-image: linear-gradient(135deg, ${glowStrong} 0%, ${glowSoft} 45%, rgba(20, 24, 32, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
        <p style="margin: 0 0 8px 0; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(226, 232, 240, 0.6);">
          VenueStack Dashboard
        </p>
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
          Welcome to ${businessName}
        </h1>
        <p style="margin: 12px 0 0 0; font-size: 15px; color: rgba(226, 232, 240, 0.85);">
          You now have access as ${roleText}.
        </p>
      </div>

      <div style="padding: 24px 32px 32px;">
        <p style="margin: 0 0 20px 0; font-size: 15px; color: rgba(226, 232, 240, 0.85);">
          Log in to manage events, tickets, and tables for ${businessName}.
        </p>

        <div style="margin: 24px 0 10px;">
          <a href="${loginUrl}/login" style="background: ${resolvedThemeHex}; color: ${buttonTextColor}; padding: 12px 22px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block; font-size: 14px; box-shadow: 0 12px 24px ${glowSoft};">
            Open Dashboard
          </a>
        </div>

        <p style="margin: 18px 0 0 0; font-size: 12px; color: rgba(148, 163, 184, 0.8);">
          If you weren't expecting this, you can ignore this email.
        </p>
      </div>

      <div style="padding: 0 32px 28px; text-align: center;">
        <div style="height: 1px; background: rgba(255, 255, 255, 0.08); margin-bottom: 16px;"></div>
        <p style="margin: 0; font-size: 12px; color: rgba(148, 163, 184, 0.6);">
          - The VenueStack Team
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}
