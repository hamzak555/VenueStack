import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminAccess } from '@/lib/auth/admin-session'
import { getLoginLogs, getLoginLogStats } from '@/lib/db/login-logs'

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const adminSession = await verifyAdminAccess()
    if (!adminSession) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const businessId = searchParams.get('businessId') || undefined
    const userType = searchParams.get('userType') as 'admin' | 'business' | undefined
    const includeStats = searchParams.get('includeStats') === 'true'

    const [logsResult, stats] = await Promise.all([
      getLoginLogs({ limit, offset, businessId, userType }),
      includeStats ? getLoginLogStats() : null,
    ])

    return NextResponse.json({
      logs: logsResult.logs,
      total: logsResult.total,
      stats: stats,
    })
  } catch (error) {
    console.error('Error fetching login logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch login logs' },
      { status: 500 }
    )
  }
}
