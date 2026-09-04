import {NextResponse} from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

type LiveFund={code:string;isin:string;isinReinvestment:string;name:string;nav:number;navDate:string;amc:string;category:string}

function parseAmfi(text:string):LiveFund[]{
  const out:LiveFund[]=[]
  let category='Mutual Fund', amc=''
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim(); if(!line) continue
    const p=line.split(';').map(x=>x.trim())
    if(p.length>=6 && /^\d+$/.test(p[0])){
      const nav=Number(p[4]); if(!Number.isFinite(nav)) continue
      out.push({code:p[0],isin:p[1]||'',isinReinvestment:p[2]||'',name:p[3],nav,navDate:p[5],amc,category})
    } else if(p.length===1){
      if(/Mutual Fund$/i.test(p[0])) amc=p[0]
      else if(/Scheme|Fund|ETF|Index|Debt|Equity|Hybrid|Solution|Thematic|Gold|Liquid|Overnight|Money Market|Arbitrage|FoF|ELSS/i.test(p[0])) category=p[0]
    }
  }
  return out
}

const fallback=[
 {code:'100033',isin:'INF879O01027',name:'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',nav:0,navDate:'fallback',amc:'PPFAS Mutual Fund',category:'Flexi Cap'},
 {code:'120716',isin:'INF789F01XW1',name:'UTI Nifty 50 Index Fund - Direct Plan - Growth',nav:0,navDate:'fallback',amc:'UTI Mutual Fund',category:'Index'},
 {code:'120847',isin:'INF179K01TX0',name:'HDFC Nifty Next 50 Index Fund - Direct Plan - Growth',nav:0,navDate:'fallback',amc:'HDFC Mutual Fund',category:'Index'}
]

export async function GET(req:Request){
 const url=new URL(req.url), q=(url.searchParams.get('q')||'').trim(), limit=Math.min(Number(url.searchParams.get('limit')||80),1000)
 try{
   const r=await query(`SELECT f.scheme_code AS code,f.isin,f.isin_reinvestment AS "isinReinvestment",f.scheme_name AS name, n.nav, n.nav_date AS "navDate", f.amc, f.category
     FROM fund_schemes f JOIN LATERAL (SELECT nav,nav_date FROM nav_observations n WHERE n.scheme_code=f.scheme_code AND n.isin=f.isin ORDER BY nav_date DESC LIMIT 1) n ON true
     WHERE ($1='' OR f.scheme_name ILIKE '%'||$1||'%' OR f.amc ILIKE '%'||$1||'%' OR f.category ILIKE '%'||$1||'%' OR f.isin ILIKE '%'||$1||'%')
     ORDER BY f.scheme_name LIMIT $2`,[q,limit])
   if(r.rowCount) {
     const navDate=String(r.rows[0].navDate||'')
     return NextResponse.json({status:'live',source:'RVS normalized PostgreSQL database (AMFI ingested)',asOfLabel:navDate,count:r.rowCount,funds:r.rows})
   }
   throw new Error('Fund database is empty. Run AMFI ingestion first.')
 }catch(dbError){
   try {
     const r=await fetch('https://portal.amfiindia.com/spages/NAVAll.txt',{headers:{'User-Agent':'RVS-WealthPilot/14.0'},cache:'no-store'})
     if(!r.ok) throw new Error(`AMFI HTTP ${r.status}`)
     const text=await r.text(); let funds=parseAmfi(text)
     if(q) funds=funds.filter(f=>`${f.name} ${f.amc} ${f.category} ${f.isin}`.toLowerCase().includes(q.toLowerCase()))
     const navDate=funds.find(f=>f.navDate)?.navDate||new Date().toISOString().slice(0,10)
     return NextResponse.json({status:'bootstrap',source:'AMFI NAVAll.txt (database not yet populated)',asOfLabel:navDate,count:funds.length,funds:funds.slice(0,limit)})
   } catch(e) {
     return NextResponse.json({status:'fallback',source:'AMFI unavailable and fund database unavailable',asOfLabel:'fallback',count:fallback.length,funds:fallback,error:e instanceof Error?e.message:'Unknown error'})
   }
 }
}
