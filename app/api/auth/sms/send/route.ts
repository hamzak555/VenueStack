import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS, normalizePhoneNumber, generateVerificationCode } from '@/lib/twilio'
import { getUserByPhone } from '@/lib/db/users'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phone)

    // Check if this phone number exists in our system
    let user = null

    try {
      user = await getUserByPhone(normalizedPhone)
    } catch (dbError) {
      console.error('Database error checking phone:', dbError)
      return NextResponse.json(
        { error: 'Database error. Please try again.' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this phone number' },
        { status: 404 }
      )
    }

    // Generate verification code
    const code = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store the verification code in Supabase
    const supabase = await createClient()

    // Delete any existing codes for this phone
    try {
      await supabase
        .from('phone_verification_codes')
        .delete()
        .eq('phone', normalizedPhone)
    } catch (deleteError) {
      // Table might not exist, continue anyway
      console.error('Error deleting old codes (table may not exist):', deleteError)
    }

    // Insert new code
    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
        phone: normalizedPhone,
        code,
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) {
      console.error('Failed to store verification code:', insertError)
      return NextResponse.json(
        { error: `Failed to store code: ${insertError.message}. Make sure the phone_verification_codes table exists.` },
        { status: 500 }
      )
    }

    // Send the SMS
    const sent = await sendSMS(
      normalizedPhone,
      `Your VenueStack verification code is: ${code}. It expires in 10 minutes.`
    )

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send SMS. Check Twilio configuration.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      phone: normalizedPhone,
      message: 'Verification code sent',
    })
  } catch (error) {
    console.error('Error sending verification code:', error)
    const message = error instanceof Error ? error.message : 'An error occurred'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
