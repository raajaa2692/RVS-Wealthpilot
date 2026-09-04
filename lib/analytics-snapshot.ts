import { query } from '@/lib/db'

export async function snapshotAnalytics(snapshotDate?:string) {
  const date = snapshotDate || new Date().toISOString().slice(0,10)
  const schemes = await query<{scheme_code:string;isin:string;benchmark_name:string|null;riskometer:string|null;ter_direct:number|null;ter_regular:number|null}>(`SELECT scheme_code,isin,benchmark_name,riskometer,ter_direct,ter_regular FROM fund_schemes WHERE last_seen_at >= now()-interval '7 days'`)
  let written=0
  for (const s of schemes.rows) {
    const navs = await query<{nav:number;nav_date:string}>(`SELECT nav,nav_date FROM nav_observations WHERE scheme_code=$1 AND isin=$2 ORDER BY nav_date DESC LIMIT 4000`,[s.scheme_code,s.isin])
    if (!navs.rows.length) continue
    const latest=navs.rows[0]
    const previous=navs.rows[1]
    const daily=previous ? ((Number(latest.nav)-Number(previous.nav))/Number(previous.nav))*100 : null
    const cagr5=nearestCagr(navs.rows,latest,5)
    const cagr7=nearestCagr(navs.rows,latest,7)
    const cagr10=nearestCagr(navs.rows,latest,10)
    const score=researchScore({cagr5,cagr7,cagr10,ter:s?.ter_direct,risk:s?.riskometer})
    const coverage={daily:!!daily,cagr5:cagr5!==null,cagr7:cagr7!==null,cagr10:cagr10!==null,benchmark:!!s.benchmark_name,riskometer:!!s.riskometer,ter: s.ter_direct!==null}
    await query(`INSERT INTO fund_analytics_daily(scheme_code,isin,snapshot_date,nav,previous_nav,daily_return_pct,cagr_5y,cagr_7y,cagr_10y,benchmark_name,riskometer,ter_direct,ter_regular,score,score_confidence,data_coverage)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
      ON CONFLICT(scheme_code,isin,snapshot_date) DO UPDATE SET nav=EXCLUDED.nav,previous_nav=EXCLUDED.previous_nav,daily_return_pct=EXCLUDED.daily_return_pct,cagr_5y=EXCLUDED.cagr_5y,cagr_7y=EXCLUDED.cagr_7y,cagr_10y=EXCLUDED.cagr_10y,benchmark_name=EXCLUDED.benchmark_name,riskometer=EXCLUDED.riskometer,ter_direct=EXCLUDED.ter_direct,ter_regular=EXCLUDED.ter_regular,score=EXCLUDED.score,score_confidence=EXCLUDED.score_confidence,data_coverage=EXCLUDED.data_coverage`,
      [s.scheme_code,s.isin,date,latest.nav,previous?.nav??null,daily,cagr5,cagr7,cagr10,s.benchmark_name,s.riskometer,s.ter_direct,s.ter_regular,score.score,score.confidence,JSON.stringify(coverage)])
    written++
  }
  return {snapshotDate:date,schemes:schemes.rows.length,written}
}

function nearestCagr(rows:{nav:number;nav_date:string}[],latest:{nav:number;nav_date:string},years:number) {
  const target=new Date(latest.nav_date); target.setUTCFullYear(target.getUTCFullYear()-years)
  let best:any=null,bestDiff=Infinity
  for(const r of rows){const diff=Math.abs(new Date(r.nav_date).getTime()-target.getTime()); if(diff<bestDiff){best=r;bestDiff=diff}}
  if(!best || bestDiff>1000*60*60*24*10) return null
  const start=Number(best.nav),end=Number(latest.nav); if(start<=0||end<=0)return null
  return (Math.pow(end/start,1/years)-1)*100
}

export function researchScore(x:{cagr5:number|null;cagr7:number|null;cagr10:number|null;ter:number|null|undefined;risk:string|null|undefined}) {
  const values=[x.cagr5,x.cagr7,x.cagr10].filter(v=>typeof v==='number'&&Number.isFinite(v)) as number[]
  let score=50
  if(values.length){ const avg=values.reduce((a,b)=>a+b,0)/values.length; score += Math.max(-15,Math.min(25,avg*1.4)) }
  if(typeof x.ter==='number'&&Number.isFinite(x.ter)) score += Math.max(-8,Math.min(8, (1.5-x.ter)*5))
  if(x.risk){ const r=x.risk.toLowerCase(); if(r.includes('very high')) score-=3; else if(r.includes('high')) score-=1 }
  const confidence=values.length>=3&&x.ter!==null&&x.ter!==undefined?'High':values.length>=2?'Medium':'Low'
  return {score:Math.round(Math.max(0,Math.min(100,score))),confidence}
}
