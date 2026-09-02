import {NextResponse} from 'next/server'

export async function POST(req:Request){
 const b=await req.json()
 const rows=Array.isArray(b.rows)?b.rows:[]
 const normalized=rows.map((r:any,i:number)=>({
  id:String(r.id||i+1),
  scheme:String(r.scheme||r.fund||'Unknown scheme'),
  folio:String(r.folio||''),
  units:Number(r.units||0),
  invested:Number(r.invested||0),
  current:Number(r.current||0),
  category:String(r.category||'Unknown')
 }))
 const invested=normalized.reduce((a:number,x:any)=>a+x.invested,0)
 const current=normalized.reduce((a:number,x:any)=>a+x.current,0)
 return NextResponse.json({
  status:'normalized',
  holdings:normalized,
  totals:{invested,current,gain:current-invested,returnPct:invested?(current/invested-1)*100:0},
  next:'Map schemes to canonical scheme identifiers before live scoring.'
 })
}
