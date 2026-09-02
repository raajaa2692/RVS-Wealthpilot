import {NextResponse} from 'next/server'
export async function POST(req:Request){
 const b=await req.json()
 const holdings=Array.isArray(b.holdings)?b.holdings:[]
 const totalInvested=holdings.reduce((a:any,h:any)=>a+Number(h.invested||0),0)
 const totalCurrent=holdings.reduce((a:any,h:any)=>a+Number(h.current||0),0)
 const gain=totalCurrent-totalInvested
 const xirr=Number(b.xirr||0)
 const benchmark=Number(b.benchmarkXirr||0)
 const categories:Record<string,number>={}
 holdings.forEach((h:any)=>{const c=h.category||'Other';categories[c]=(categories[c]||0)+Number(h.current||0)})
 const concentration=Object.entries(categories).map(([category,value])=>({category,value,weight:totalCurrent?value/totalCurrent*100:0})).sort((a,b)=>b.weight-a.weight)
 const health=Math.max(0,Math.min(100,85-(concentration[0]?.weight||0>45?10:0)-(xirr<benchmark-3?10:0)))
 return NextResponse.json({totalInvested,totalCurrent,gain,returnPct:totalInvested?(gain/totalInvested)*100:0,xirr,benchmark,xirrGap:xirr-benchmark,health,concentration})
}
