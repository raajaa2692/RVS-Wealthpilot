import { NextResponse } from 'next/server'
import { snapshotAnalytics } from '@/lib/analytics-snapshot'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  try {
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM fund_analytics_daily
       WHERE snapshot_date = CURRENT_DATE`
    )

    // The number already written today becomes the next batch offset.
    // This makes the hourly cron continue automatically without storing a cursor.
    const offset = Number(countResult.rows[0]?.count || 0)
    const limit = 2000

    const result = await snapshotAnalytics({ limit, offset })

    return NextResponse.json({
      status: 'success',
      job: 'analytics-snapshot',
      ...result,
      at: new Date().toISOString()
    })
  } catch (e) {
    return NextResponse.json(
      {
        status: 'error',
        message: e instanceof Error ? e.message : 'Analytics snapshot failed'
      },
      { status: 500 }
    )
  }
}
