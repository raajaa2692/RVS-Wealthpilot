import { NextResponse } from 'next/server'
import { ingestAmfi } from '@/lib/amfi-ingest'
import { snapshotAnalytics } from '@/lib/analytics-snapshot'

export const dynamic='force-dynamic'
export const maxDuration=60

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET
  if(secret && req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({status:'unauthorized'},{status:401})
  try {
    const ingestion=await ingestAmfi()
    const snapshot=await snapshotAnalytics()
    return NextResponse.json({status:'success',source:'AMFI',ingestion,snapshot,at:new Date().toISOString()})
  } catch(e) {
    return NextResponse.json({status:'error',message:e instanceof Error?e.message:'AMFI ingestion failed'},{status:500})
  }
}
