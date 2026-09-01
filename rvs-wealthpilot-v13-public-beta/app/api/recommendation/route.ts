import {NextResponse} from 'next/server'
export async function POST(req:Request){
 const b=await req.json()
 const amount=Math.max(0,Number(b.amount||0))
 const holdings=Array.isArray(b.holdings)?b.holdings:[]
 if(!amount)return NextResponse.json({error:'amount is required'},{status:400})
 const categoryWeight:Record<string,number>={}
 const total=holdings.reduce((a:any,h:any)=>a+Number(h.current||0),0)
 holdings.forEach((h:any)=>{const c=h.category||'Other';categoryWeight[c]=(categoryWeight[c]||0)+(Number(h.current||0)/Math.max(1,total))*100})
 const candidates=[
  {fund:'Core Diversified Equity',category:'Flexi Cap',score:88},
  {fund:'Low-cost Nifty 50 Index',category:'Index',score:85},
  {fund:'Nifty Next 50 Index',category:'Index',score:79},
  {fund:'Manufacturing / Thematic',category:'Thematic',score:71}
 ]
 const ranked=candidates.map(x=>({...x,existingWeight:categoryWeight[x.category]||0})).sort((a,b)=>b.score-a.score)
 let remaining=amount
 const allocation=ranked.map((x,i)=>{
   const cap=x.category==='Thematic'?0.10:0.45
   const room=Math.max(0,cap-(x.existingWeight/100))
   const base=[.45,.30,.15,.10][i]||0
   const a=Math.min(Math.round(amount*base),Math.round(amount*room))
   remaining-=a
   return {...x,amount:a,reason:x.existingWeight>40?'Existing concentration is high; avoid adding here.':'Adds to a diversified portfolio role while respecting category limits.'}
 }).filter(x=>x.amount>0)
 return NextResponse.json({
  engine:'RVS WealthPilot V10',
  status:'portfolio-aware prototype',
  amount,
  allocation,
  unallocated:Math.max(0,remaining),
  guardrails:['Thematic category capped at 10%','Category concentration reviewed before new SIP','Existing holdings considered before new allocation'],
  next:'Connect validated live NAV, benchmark and scheme data before production recommendations.'
 })
}
