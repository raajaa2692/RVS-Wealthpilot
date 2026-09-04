import {NextResponse} from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const AMFI_LATEST='https://portal.amfiindia.com/spages/NAVAll.txt'
const AMFI_HISTORY='https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx'

type FundRow={code:string;name:string;nav:number;navDate:string;amc:string;category:string}
type Pulse={code:string;name:string;shortName:string;category:string;nav:number;previousNav:number;change:number;changePct:number;navDate:string;previousDate:string}

function parseDate(s:string){
  const m=s.trim().match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/)
  if(!m)return null
  const months:any={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11}
  const month=months[m[2].slice(0,3)]
  if(month===undefined)return null
  return new Date(Date.UTC(Number(m[3]),month,Number(m[1])))
}
function formatAmfiDate(d:Date){
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${String(d.getUTCDate()).padStart(2,'0')}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`
}
function parseLatest(text:string):FundRow[]{
  const out:FundRow[]=[]; let category='Mutual Fund',amc=''
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim(); if(!line)continue
    const p=line.split(';').map(x=>x.trim())
    if(p.length>=6 && /^\d+$/.test(p[0])){
      const nav=Number(p[4]); if(!Number.isFinite(nav))continue
      out.push({code:p[0],name:p[3],nav,navDate:p[5],amc,category})
    }else if(p.length===1){
      if(/Mutual Fund$/i.test(p[0]))amc=p[0]
      else if(/Scheme|Fund|ETF|Index|Debt|Equity|Hybrid|Solution|Thematic|Gold|Liquid|Overnight|Money Market|Arbitrage|FoF|ELSS/i.test(p[0]))category=p[0]
    }
  }
  return out
}
function parseHistory(text:string,wanted:Set<string>){
  const out=new Map<string,{nav:number;date:string}[]>()
  for(const raw of text.split(/\r?\n/)){
    const p=raw.trim().split(';').map(x=>x.trim())
    if(p.length>=8 && /^\d+$/.test(p[0]) && wanted.has(p[0])){
      const nav=Number(p[4]); const date=p[7]
      if(!Number.isFinite(nav)||!date)continue
      const arr=out.get(p[0])||[]; arr.push({nav,date}); out.set(p[0],arr)
    }
  }
  for(const [code,arr] of out){
    arr.sort((a,b)=>(parseDate(a.date)?.getTime()||0)-(parseDate(b.date)?.getTime()||0))
    out.set(code,arr)
  }
  return out
}
function pickFunds(all:FundRow[]){
  const patterns=[
    ['Parag Parikh Flexi Cap','flexi cap'],['HDFC Flexi Cap','hdfc flexi cap'],['UTI Nifty 50 Index','uti nifty 50'],['HDFC Nifty Next 50','hdfc nifty next 50'],['Motilal Oswal Midcap','motilal oswal midcap'],['SBI Small Cap','sbi small cap'],['Parag Parikh Conservative Hybrid','parag parikh conservative hybrid'],['ICICI Prudential Nifty 50 Index','icici prudential nifty 50']
  ]
  const picked:FundRow[]=[]; const used=new Set<string>()
  for(const [,match] of patterns){
    const f=all.find(x=>!used.has(x.code)&&x.name.toLowerCase().includes(match)&&/direct plan.*growth|direct.*growth|growth/i.test(x.name)) || all.find(x=>!used.has(x.code)&&x.name.toLowerCase().includes(match)&&/growth/i.test(x.name))
    if(f){picked.push(f);used.add(f.code)}
  }
  return picked
}

export async function GET(){
  try{
    const dbRows=await query<any>(`SELECT scheme_code AS code, scheme_name AS name, category, nav, previous_nav AS "previousNav", daily_return_pct AS "changePct", snapshot_date AS "navDate" FROM latest_fund_analytics WHERE daily_return_pct IS NOT NULL ORDER BY ABS(daily_return_pct) DESC NULLS LAST LIMIT 12`)
    if(dbRows.rowCount){
      const pulses=dbRows.rows.map(r=>({code:r.code,name:r.name,shortName:String(r.name).replace(/\s+-\s+(Direct|Regular) Plan.*$/i,'').replace(/\s+-\s+(Growth|IDCW).*$/i,''),category:r.category||'Mutual Fund',nav:Number(r.nav),previousNav:Number(r.previousNav),change:Number(r.nav)-Number(r.previousNav),changePct:Number(r.changePct),navDate:String(r.navDate),previousDate:''}))
      return NextResponse.json({status:'live',source:'RVS daily analytics snapshot (AMFI ingested)',asOf:pulses[0]?.navDate||new Date().toISOString().slice(0,10),count:pulses.length,pulses})
    }
  }catch{}
  try{
    const latestRes=await fetch(AMFI_LATEST,{headers:{'User-Agent':'RVS-WealthPilot/13'},next:{revalidate:900}})
    if(!latestRes.ok)throw new Error(`AMFI latest NAV HTTP ${latestRes.status}`)
    const latest=parseLatest(await latestRes.text())
    const picked=pickFunds(latest)
    if(!picked.length)throw new Error('No representative funds found in AMFI latest NAV feed')
    const latestDates=picked.map(x=>parseDate(x.navDate)).filter(Boolean) as Date[]
    const latestDate=new Date(Math.max(...latestDates.map(d=>d.getTime())))
    const from=new Date(latestDate); from.setUTCDate(from.getUTCDate()-5)
    const historyUrl=`${AMFI_HISTORY}?frmdt=${encodeURIComponent(formatAmfiDate(from))}&todt=${encodeURIComponent(formatAmfiDate(latestDate))}`
    const historyRes=await fetch(historyUrl,{headers:{'User-Agent':'RVS-WealthPilot/13'},next:{revalidate:900}})
    if(!historyRes.ok)throw new Error(`AMFI NAV history HTTP ${historyRes.status}`)
    const history=parseHistory(await historyRes.text(),new Set(picked.map(x=>x.code)))
    const pulses:Pulse[]=[]
    for(const f of picked){
      const rows=history.get(f.code)||[]
      const prior=rows.filter(x=>x.date!==f.navDate).at(-1)
      if(!prior||prior.nav===0)continue
      const change=f.nav-prior.nav
      pulses.push({code:f.code,name:f.name,shortName:f.name.replace(/\s+-\s+Direct Plan.*$/i,'').replace(/\s+-\s+Regular Plan.*$/i,''),category:f.category,nav:f.nav,previousNav:prior.nav,change,changePct:change/prior.nav*100,navDate:f.navDate,previousDate:prior.date})
    }
    return NextResponse.json({status:'live',source:'AMFI latest NAV + NAV history',asOf:pulses[0]?.navDate||latestDate.toISOString().slice(0,10),count:pulses.length,pulses})
  }catch(e){
    return NextResponse.json({status:'fallback',source:'AMFI daily NAV change unavailable',asOf:new Date().toISOString(),count:0,pulses:[],error:e instanceof Error?e.message:'Unknown error'})
  }
}
