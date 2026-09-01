import {NextResponse} from 'next/server'

function cagr(start:number,end:number,years:number){
 if(start<=0||end<=0)return null
 return (Math.pow(end/start,1/years)-1)*100
}
export async function POST(req:Request){
 const b=await req.json()
 const startNav=Number(b.startNav), endNav=Number(b.endNav)
 const years=[1,3,5,7,10]
 const returns=years.map(y=>({years:y,annualized:cagr(startNav,endNav,y)}))
 return NextResponse.json({
  status:'calculation-ready',
  method:'CAGR',
  returns,
  note:'For SIP performance, use XIRR from dated cashflows rather than CAGR.'
 })
}
