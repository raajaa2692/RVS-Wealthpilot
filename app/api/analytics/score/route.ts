import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
export const dynamic='force-dynamic'
export async function GET(req:Request){
 const u=new URL(req.url),q=u.searchParams.get('q')||'',limit=Math.min(Number(u.searchParams.get('limit')||20),100)
 try{
  const r=await query(`SELECT scheme_code,isin,scheme_name,amc,category,nav,snapshot_date,daily_return_pct,cagr_5y,cagr_7y,cagr_10y,benchmark_name,riskometer,ter_direct,ter_regular,score,score_confidence,data_coverage FROM latest_fund_analytics WHERE ($1='' OR scheme_name ILIKE '%'||$1||'%' OR amc ILIKE '%'||$1||'%' OR category ILIKE '%'||$1||'%') ORDER BY score DESC NULLS LAST LIMIT $2`,[q,limit])
  return NextResponse.json({status:'live',source:'RVS normalized fund database',count:r.rowCount,funds:r.rows})
 }catch(e){return NextResponse.json({status:'unavailable',message:e instanceof Error?e.message:'Database unavailable'},{status:503})}
}
