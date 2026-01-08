import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface PendingScan {
  qr_code_data: string
  scanned_at: string
}

interface BatchSyncResult {
  qr_code_data: string
  success: boolean
  message: string | null
  conflict: boolean
}

// POST /api/tickets/batch-validate - Process multiple offline scans at once
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scans, business_id: businessId } = body as {
      scans: PendingScan[]
      business_id: string
    }

    if (!scans || !Array.isArray(scans) || scans.length === 0) {
      return NextResponse.json(
        { error: 'No scans provided' },
        { status: 400 }
      )
    }

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const results: BatchSyncResult[] = []
    let syncedCount = 0
    let failedCount = 0

    // Process each scan
    for (const scan of scans) {
      const result = await processScan(supabase, scan, businessId)
      results.push(result)

      if (result.success) {
        syncedCount++
      } else {
        failedCount++
      }
    }

    return NextResponse.json({
      results,
      synced_count: syncedCount,
      failed_count: failedCount
    })
  } catch (error) {
    console.error('Batch validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processScan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scan: PendingScan,
  businessId: string
): Promise<BatchSyncResult> {
  const { qr_code_data: qrCodeData, scanned_at: scannedAt } = scan

  try {
    // Parse QR code data
    const parts = qrCodeData.split('|')
    if (parts.length !== 3) {
      return {
        qr_code_data: qrCodeData,
        success: false,
        message: 'Invalid QR code format',
        conflict: false
      }
    }

    const [ticketNumber] = parts

    // Get ticket with event info
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        event:events (
          title,
          business_id
        )
      `)
      .eq('ticket_number', ticketNumber)
      .eq('qr_code_data', qrCodeData)
      .single()

    if (ticketError || !ticket) {
      return {
        qr_code_data: qrCodeData,
        success: false,
        message: 'Ticket not found',
        conflict: false
      }
    }

    // Verify ticket belongs to business
    if (ticket.event.business_id !== businessId) {
      return {
        qr_code_data: qrCodeData,
        success: false,
        message: 'Ticket does not belong to your business',
        conflict: false
      }
    }

    // Check if ticket was already checked in on server
    if (ticket.checked_in_at) {
      // This is a conflict - already checked in
      const existingCheckIn = new Date(ticket.checked_in_at)
      const offlineCheckIn = new Date(scannedAt)

      // If offline scan was before server check-in, it's a true conflict
      // If offline scan was after, the server check-in takes precedence
      if (offlineCheckIn < existingCheckIn) {
        return {
          qr_code_data: qrCodeData,
          success: true,
          message: 'Ticket was already checked in (conflict resolved)',
          conflict: true
        }
      } else {
        // Offline scan was after - already synced or duplicate
        return {
          qr_code_data: qrCodeData,
          success: true,
          message: 'Ticket already checked in',
          conflict: false
        }
      }
    }

    // Check ticket status
    if (ticket.status !== 'valid') {
      return {
        qr_code_data: qrCodeData,
        success: false,
        message: `Ticket is ${ticket.status}`,
        conflict: false
      }
    }

    // Update ticket - use the offline scan time if earlier than now
    const checkInTime = new Date(scannedAt) < new Date()
      ? scannedAt
      : new Date().toISOString()

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        checked_in_at: checkInTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticket.id)

    if (updateError) {
      return {
        qr_code_data: qrCodeData,
        success: false,
        message: 'Failed to update ticket',
        conflict: false
      }
    }

    return {
      qr_code_data: qrCodeData,
      success: true,
      message: 'Ticket synced successfully',
      conflict: false
    }
  } catch (error) {
    console.error('Error processing scan:', error)
    return {
      qr_code_data: qrCodeData,
      success: false,
      message: 'Processing error',
      conflict: false
    }
  }
}
