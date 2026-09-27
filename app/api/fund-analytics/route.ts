import {NextResponse} from 'next/server'
import {query} from '@/lib/db'

export const dynamic='force-dynamic'

export async function GET(req:Request){
  const u=new URL(req.url)
  const code=u.searchParams.get('code')||''
  const name=u.searchParams.get('name')||''

  if(!code){
    return NextResponse.json(
      {status:'error',message:'scheme code required'},
      {status:400}
    )
  }

  try{
    const r=await query(`
      SELECT
        a.scheme_code AS code,
        a.isin,
        a.snapshot_date,
        a.nav,
        a.daily_return_pct,
        a.cagr_5y,
        a.cagr_7y,
        a.cagr_10y,
        a.benchmark_name,
        a.riskometer,
        a.ter_direct,
        a.ter_regular,
        a.score,
        a.score_confidence,
        a.data_coverage,
        a.source
      FROM fund_analytics_daily a
      WHERE a.scheme_code=$1
      ORDER BY a.snapshot_date DESC
      LIMIT 1
    `,[code])

    if(!r.rowCount){
      return NextResponse.json({
        status:'unavailable',
        scheme:{code,name},
        returns:{5:null,7:null,10:null},
        benchmark:null,
        risk:null,
        ter:{direct:null,regular:null},
        message:'Analytics not available for this scheme yet.'
      })
    }

    const a=r.rows[0]

    return NextResponse.json({
      status:'live',
      scheme:{code,name},
      returns:{
        5:a.cagr_5y===null?null:Number(a.cagr_5y),
        7:a.cagr_7y===null?null:Number(a.cagr_7y),
        10:a.cagr_10y===null?null:Number(a.cagr_10y)
      },
      benchmark:a.benchmark_name||null,
      risk:a.riskometer||null,
      ter:{
        direct:a.ter_direct===null?null:Number(a.ter_direct),
        regular:a.ter_regular===null?null:Number(a.ter_regular)
      },
      dailyReturn:a.daily_return_pct===null?null:Number(a.daily_return_pct),
      score:a.score===null?null:Number(a.score),
      scoreConfidence:a.score_confidence||null,
      coverage:a.data_coverage||{},
      snapshotDate:a.snapshot_date,
      source:a.source||'RVS_ANALYTICS',
      note:'Analytics are served from the RVS WealthPilot PostgreSQL analytics snapshot.'
    })

  }catch(e){
    return NextResponse.json({
      status:'unavailable',
      scheme:{code,name},
      returns:{5:null,7:null,10:null},
      benchmark:null,
      risk:null,
      ter:{direct:null,regular:null},
      message:e instanceof Error?e.message:'Analytics unavailable'
    })
  }
}