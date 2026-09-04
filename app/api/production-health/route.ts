import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
export const dynamic='force-dynamic'
export async function GET(){
 try{
  const [funds,navs,analytics,runs]=await Promise.all([
   query<{n:number}>(`SELECT count(*)::int AS n FROM fund_schemes`),
   query<{n:number}>(`SELECT count(*)::int AS n FROM nav_observations`),
   query<{n:number;latest:string|null}>(`SELECT count(*)::int AS n,max(snapshot_date)::text AS latest FROM fund_analytics_daily`),
   query<any>(`SELECT source,status,started_at,finished_at,records_seen,records_upserted FROM ingestion_runs ORDER BY started_at DESC LIMIT 1`)
  ])
  return NextResponse.json({status:'healthy',database:'ok',funds:funds.rows[0].n,navObservations:navs.rows[0].n,analyticsSnapshots:analytics.rows[0].n,latestAnalyticsDate:analytics.rows[0].latest,lastIngestion:runs.rows[0]||null,at:new Date().toISOString()})
 }catch(e){return NextResponse.json({status:'degraded',database:'unavailable',message:e instanceof Error?e.message:'Database unavailable',at:new Date().toISOString()},{status:503})}
}
