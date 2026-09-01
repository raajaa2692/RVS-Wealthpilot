import {NextResponse} from 'next/server'

type Row={scheme:string;folio?:string;date:string;type:string;amount:number;units:number;nav:number}
function xirr(cashflows:{date:string;amount:number}[]){
  if(cashflows.length<2)return null
  const d0=new Date(cashflows[0].date).getTime()
  const f=(r:number)=>cashflows.reduce((sum,c)=>sum+c.amount/Math.pow(1+r,(new Date(c.date).getTime()-d0)/31557600000),0)
  let lo=-.9999,hi=10
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid}
  return ((lo+hi)/2)*100
}
export async function POST(req:Request){
 const b=await req.json()
 const rows:Row[]=Array.isArray(b.rows)?b.rows:[]
 const grouped:Record<string,Row[]>={}
 rows.forEach(r=>(grouped[r.scheme]??=[]).push(r))
 const holdings=Object.entries(grouped).map(([scheme,tx])=>{
   const invested=tx.reduce((a,r)=>a+Math.max(0,r.amount),0)
   const units=tx.reduce((a,r)=>a+r.units,0)
   const current=Number((tx.at(-1)?.nav||0))*units
   const flows=tx.map(r=>({date:r.date,amount:-Math.abs(r.amount)}))
   if(current>0)flows.push({date:new Date().toISOString().slice(0,10),amount:current})
   return {scheme,invested,units,current,gain:current-invested,xirr:xirr(flows)}
 })
 return NextResponse.json({status:'parsed',holdings,totalInvested:holdings.reduce((a,x)=>a+x.invested,0),totalCurrent:holdings.reduce((a,x)=>a+x.current,0)})
}
