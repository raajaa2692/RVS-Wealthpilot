import {NextResponse} from 'next/server'

export async function POST(req:Request){
  const p=await req.json()
  const holdings=Array.isArray(p.holdings)?p.holdings:[]
  const total=holdings.reduce((a:number,h:any)=>a+Number(h.current||0),0)
  const byCategory:Record<string,number>={}
  holdings.forEach((h:any)=>{
    const c=h.category||'Other'
    byCategory[c]=(byCategory[c]||0)+Number(h.current||0)
  })
  const concentration=Object.entries(byCategory)
    .map(([category,value])=>({category,value,weight:total?Number(value)/total*100:0}))
    .sort((a,b)=>b.weight-a.weight)
  const alerts=concentration.filter(x=>x.weight>45).map(x=>`${x.category} is ${x.weight.toFixed(1)}% of portfolio`)
  return NextResponse.json({
    totalValue:total,
    concentration,
    alerts,
    health:Math.max(0,Math.min(100,85-alerts.length*12))
  })
}
