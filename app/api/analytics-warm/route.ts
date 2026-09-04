import { NextResponse } from 'next/server'
import { cachedHistoryWindow, AMFI_HISTORY } from '@/lib/amfi-cache'

export const dynamic = 'force-dynamic'

function fmt(d:Date){const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${String(d.getUTCDate()).padStart(2,'0')}-${m[d.getUTCMonth()]}-${d.getUTCFullYear()}`}

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET
  const auth=req.headers.get('authorization')||''
  if(secret && auth!==`Bearer ${secret}`) return NextResponse.json({status:'unauthorized'},{status:401})
  const u=new URL(req.url)
  const days=Math.max(1,Math.min(Number(u.searchParams.get('days')||7),30))
  const now=new Date()
  const jobs=[]
  for(let i=0;i<days;i++){
    const target=new Date(now); target.setUTCDate(target.getUTCDate()-i)
    const from=new Date(target); from.setUTCDate(from.getUTCDate()-7)
    const to=new Date(target); to.setUTCDate(to.getUTCDate()+7)
    const url=`${AMFI_HISTORY}?frmdt=${encodeURIComponent(fmt(from))}&todt=${encodeURIComponent(fmt(to))}`
    jobs.push(cachedHistoryWindow(url))
  }
  const results=await Promise.allSettled(jobs)
  return NextResponse.json({status:'warmed',windows:results.length,successful:results.filter(x=>x.status==='fulfilled').length,cache:'AMFI history windows are cached for 24 hours',at:new Date().toISOString()})
}
