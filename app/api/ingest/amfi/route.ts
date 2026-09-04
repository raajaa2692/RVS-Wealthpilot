import { NextResponse } from 'next/server'
import { ingestAmfi } from '@/lib/amfi-ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  try {
    const ingestion = await ingestAmfi()

    // Analytics is intentionally NOT run here.
    // AMFI ingestion must finish independently so the Vercel function
    // does not spend its time processing thousands of schemes.
    return NextResponse.json({
      status: 'success',
      source: 'AMFI',
      ingestion,
      analytics: 'queued-for-separate-batch-job',
      at: new Date().toISOString()
    })
  } catch (e) {
    return NextResponse.json(
      {
        status: 'error',
        message: e instanceof Error ? e.message : 'AMFI ingestion failed'
      },
      { status: 500 }
    )
  }
}
