import {NextResponse} from 'next/server'
export async function POST(req:Request){
 const b=await req.json()
 const holdings=Array.isArray(b.holdings)?b.holdings:[]
 const results=holdings.map((h:any)=>{
   const x=Number(h.xirr||0), gap=Number(h.benchmarkGap||0), weight=Number(h.weight||0)
   let action='KEEP', reason='Performance and portfolio role are within acceptable range.'
   if(weight>35){action='REDUCE';reason='Position is highly concentrated; direct new SIPs elsewhere until concentration falls.'}
   else if(x<Number(h.benchmarkXirr||0)-3){action='REVIEW';reason='Trailing XIRR is materially below the benchmark; investigate consistency, category and portfolio overlap.'}
   else if(x>Number(h.benchmarkXirr||0)+3){action='INCREASE';reason='Strong risk-adjusted relative performance and a useful portfolio role, subject to overall allocation limits.'}
   return {scheme:h.scheme,action,reason}
 })
 return NextResponse.json({engine:'RVS WealthPilot V9',results,disclaimer:'Prototype decision support, not investment advice.'})
}
